import { StreamingArrayParser } from "./streamJson";
import {
  LLMProvider,
  NoteBox,
  OpenAIProviderConfig,
  TranscribeEvent,
  TranscribeOptions,
  TranscribedNote,
} from "./types";

const TRANSCRIBE_PROMPT =
  'Transcribe and translate all text in the image. You must provide a complete transcription of all text in the image, you may not output generic descriptions of text such as "text bubble" or "text".';

const BOX_RANGE = 1000;

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.readAsDataURL(blob);
  });
}

function authHeaders(config: OpenAIProviderConfig): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (config.apiKey) {
    headers["Authorization"] = `Bearer ${config.apiKey}`;
  }
  return headers;
}

function joinUrl(base: string, path: string): string {
  return base.replace(/\/+$/, "") + path;
}

export class OpenAIProvider implements LLMProvider {
  constructor(private config: OpenAIProviderConfig) {}

  async listModels(signal: AbortSignal): Promise<string[]> {
    const res = await fetch(joinUrl(this.config.baseUrl, "/v1/models"), {
      headers: authHeaders(this.config),
      signal,
    });
    if (!res.ok) {
      throw new Error(`Failed to list models: HTTP ${res.status}`);
    }
    const body = (await res.json()) as {
      data?: { id?: string }[];
      models?: { id?: string; name?: string }[];
    };
    const ids: string[] = [];
    for (const m of body.data ?? []) if (m.id) ids.push(m.id);
    for (const m of body.models ?? []) {
      const id = m.id ?? m.name;
      if (id) ids.push(id);
    }
    return ids;
  }

  transcribe(opts: TranscribeOptions): AsyncIterable<TranscribeEvent> {
    const { config } = this;
    return {
      [Symbol.asyncIterator]: () => {
        const pending: TranscribeEvent[] = [];
        let resolveNext: ((r: IteratorResult<TranscribeEvent>) => void) | null =
          null;
        let rejectNext: ((e: unknown) => void) | null = null;
        let finished = false;
        let error: unknown = undefined;

        const pump = () => {
          if (!resolveNext) return;
          if (pending.length > 0) {
            const value = pending.shift()!;
            const r = resolveNext;
            resolveNext = null;
            rejectNext = null;
            r({ value, done: false });
            return;
          }
          if (error) {
            const j = rejectNext!;
            resolveNext = null;
            rejectNext = null;
            j(error);
            return;
          }
          if (finished) {
            const r = resolveNext;
            resolveNext = null;
            rejectNext = null;
            r({ value: undefined, done: true });
          }
        };

        const emit = (ev: TranscribeEvent) => {
          pending.push(ev);
          pump();
        };

        const labels: string[] = [];
        const parser = new StreamingArrayParser({
          onItemValue: (index, key, value) => {
            if (key === "box_2d") {
              const box = denormalizeBox(value, opts.width, opts.height);
              if (box) emit({ type: "box", index, box });
            } else if (key === "label_en" && typeof value === "string") {
              labels[index] = value;
              emit({ type: "text", index, body: value });
            }
          },
          onItemTextDelta: (index, key, delta) => {
            if (key !== "label_en") return;
            labels[index] = (labels[index] ?? "") + delta;
            emit({ type: "text", index, body: labels[index]! });
          },
          onItemEnd: (index, raw) => {
            emit({
              type: "end",
              index,
              note: denormalizeNote(raw, opts.width, opts.height),
            });
          },
        });

        (async () => {
          try {
            const dataUrl = await blobToDataUrl(opts.blob);
            const body = {
              ...(config.extra ?? {}),
              model: config.model,
              reasoning_effort: "none",
              stream: true,
              messages: [
                {
                  role: "user",
                  content: [
                    { type: "image_url", image_url: { url: dataUrl } },
                    { type: "text", text: TRANSCRIBE_PROMPT },
                  ],
                },
              ],
              response_format: {
                type: "json_schema",
                json_schema: {
                  name: "TranscriptionArray",
                  strict: true,
                  schema: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        box_2d: {
                          type: "array",
                          items: { type: "number" },
                          minItems: 4,
                          maxItems: 4,
                        },
                        label: { type: "string" },
                        label_en: { type: "string" },
                      },
                      required: ["box_2d", "label", "label_en"],
                      additionalProperties: false,
                    },
                  },
                },
              },
            };
            const res = await fetch(
              joinUrl(config.baseUrl, "/v1/chat/completions"),
              {
                method: "POST",
                headers: authHeaders(config),
                body: JSON.stringify(body),
                signal: opts.signal,
              },
            );
            if (!res.ok || !res.body) {
              throw new Error(`Model request failed: HTTP ${res.status}`);
            }
            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let sseBuf = "";
            for (;;) {
              const { value, done } = await reader.read();
              if (done) break;
              sseBuf += decoder.decode(value, { stream: true });
              for (;;) {
                const nl = sseBuf.indexOf("\n");
                if (nl === -1) break;
                const line = sseBuf.slice(0, nl).replace(/\r$/, "");
                sseBuf = sseBuf.slice(nl + 1);
                if (!line.startsWith("data:")) continue;
                const payload = line.slice(5).trim();
                if (!payload || payload === "[DONE]") continue;
                try {
                  const event = JSON.parse(payload) as {
                    choices?: { delta?: { content?: string } }[];
                  };
                  const delta = event.choices?.[0]?.delta?.content;
                  if (delta) parser.push(delta);
                } catch {
                  // Ignore malformed SSE chunks.
                }
              }
            }
          } catch (e) {
            error = e;
          } finally {
            finished = true;
            pump();
          }
        })();

        return {
          next() {
            return new Promise<IteratorResult<TranscribeEvent>>(
              (resolve, reject) => {
                resolveNext = resolve;
                rejectNext = reject;
                pump();
              },
            );
          },
        };
      },
    };
  }
}

function denormalizeBox(
  raw: unknown,
  imgWidth: number,
  imgHeight: number,
): NoteBox | null {
  if (!Array.isArray(raw) || raw.length !== 4) return null;
  const nums = raw.map((v) => Number(v));
  if (nums.some((n) => !Number.isFinite(n))) return null;
  const [yMin, xMin, yMax, xMax] = nums as [number, number, number, number];
  return {
    x: (Math.min(xMin, xMax) / BOX_RANGE) * imgWidth,
    y: (Math.min(yMin, yMax) / BOX_RANGE) * imgHeight,
    width: (Math.abs(xMax - xMin) / BOX_RANGE) * imgWidth,
    height: (Math.abs(yMax - yMin) / BOX_RANGE) * imgHeight,
  };
}

function denormalizeNote(
  raw: unknown,
  imgWidth: number,
  imgHeight: number,
): TranscribedNote | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as { box_2d?: unknown; label_en?: unknown };
  const box = denormalizeBox(obj.box_2d, imgWidth, imgHeight);
  if (!box) return null;
  const text =
    typeof obj.label_en === "string"
      ? obj.label_en
      : String(obj.label_en ?? "");
  return { ...box, body: text };
}
