import { StreamingArrayParser } from "./streamJson";
import {
  BoundingBoxFormat,
  buildTranscriptionSystemPrompt,
  canonicalizeLanguageTag,
  translationPropertyName,
} from "./transcription";
import {
  LLMProvider,
  NoteBox,
  OpenAIProviderConfig,
  TranscribeEvent,
  TranscribeOptions,
  TranscribedNote,
  TranscriptionTimings,
} from "./types";

interface BoundingBoxDefinition {
  key: "box_2d";
  range: number;
}

interface OpenAIChatCompletionDelta {
  content?: unknown;
  reasoning?: unknown;
  reasoning_content?: unknown;
}

interface OpenAIChatCompletionChunk {
  choices?: { finish_reason?: unknown; delta?: OpenAIChatCompletionDelta }[];
  timings?: unknown;
}

function getBoundingBoxDefinition(
  format: BoundingBoxFormat,
): BoundingBoxDefinition {
  switch (format) {
    case "gemini-bbox-2d":
      return { key: "box_2d", range: 1000 };
  }
}

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

function finiteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function parseTimings(value: unknown): TranscriptionTimings | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Record<string, unknown>;
  const promptTokensPerSecond = finiteNumber(raw["prompt_per_second"]);
  const generatedTokensPerSecond = finiteNumber(raw["predicted_per_second"]);
  if (
    promptTokensPerSecond === undefined &&
    generatedTokensPerSecond === undefined
  ) {
    return undefined;
  }
  return {
    ...(promptTokensPerSecond === undefined ? {} : { promptTokensPerSecond }),
    ...(generatedTokensPerSecond === undefined
      ? {}
      : { generatedTokensPerSecond }),
  };
}

function hasReasoningDelta(
  delta: OpenAIChatCompletionDelta | undefined,
): boolean {
  if (!delta) return false;
  for (const value of [delta.reasoning_content, delta.reasoning]) {
    if (typeof value === "string" ? value.length > 0 : value != null) {
      return true;
    }
  }
  return false;
}

export function buildTranscriptionRequestBody(
  config: OpenAIProviderConfig,
  opts: Pick<
    TranscribeOptions,
    | "additionalParameters"
    | "boundingBoxFormat"
    | "model"
    | "reasoningEffort"
    | "systemPrompt"
    | "translationLanguage"
  >,
  dataUrl: string,
): Record<string, unknown> {
  const box = getBoundingBoxDefinition(opts.boundingBoxFormat);
  const translationLanguage = canonicalizeLanguageTag(opts.translationLanguage);
  if (!translationLanguage) {
    throw new Error(
      `Invalid BCP-47 translation language: ${opts.translationLanguage}`,
    );
  }
  const translationProperty = translationPropertyName(translationLanguage);
  return {
    ...(config.extra ?? {}),
    ...(opts.additionalParameters ?? {}),
    model: opts.model ?? config.model,
    ...(opts.reasoningEffort !== undefined
      ? { reasoning_effort: opts.reasoningEffort }
      : {}),
    stream: true,
    messages: [
      {
        role: "system",
        content: buildTranscriptionSystemPrompt(
          opts.systemPrompt,
          translationLanguage,
        ),
      },
      {
        role: "user",
        content: [{ type: "image_url", image_url: { url: dataUrl } }],
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
              [box.key]: {
                type: "array",
                items: { type: "number" },
                minItems: 4,
                maxItems: 4,
              },
              language: {
                type: "string",
                description: "BCP-47 language identifier for label",
              },
              label: { type: "string", description: "Raw transcription" },
              [translationProperty]: {
                type: "string",
                description: `Translation into ${translationLanguage}`,
              },
            },
            required: [box.key, "language", "label", translationProperty],
            additionalProperties: false,
          },
        },
      },
    },
  };
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
    const boxFormat = getBoundingBoxDefinition(opts.boundingBoxFormat);
    const translationLanguage = canonicalizeLanguageTag(
      opts.translationLanguage,
    );
    if (!translationLanguage) {
      throw new Error(
        `Invalid BCP-47 translation language: ${opts.translationLanguage}`,
      );
    }
    const translationProperty = translationPropertyName(translationLanguage);
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

        const translations: string[] = [];
        const parser = new StreamingArrayParser({
          onItemValue: (index, key, value) => {
            if (key === boxFormat.key) {
              const box = denormalizeBox(
                value,
                opts.width,
                opts.height,
                boxFormat.range,
              );
              if (box) emit({ type: "box", index, box });
            } else if (
              key === translationProperty &&
              typeof value === "string"
            ) {
              translations[index] = value;
              emit({ type: "text", index, body: value });
            }
          },
          onItemTextDelta: (index, key, delta) => {
            if (key !== translationProperty) return;
            translations[index] = (translations[index] ?? "") + delta;
            emit({ type: "text", index, body: translations[index]! });
          },
          onItemEnd: (index, raw) => {
            emit({
              type: "end",
              index,
              note: denormalizeNote(
                raw,
                opts.width,
                opts.height,
                boxFormat,
                translationLanguage,
                translationProperty,
              ),
            });
          },
        });

        (async () => {
          let reasoningStarted = false;
          let outputStarted = false;
          let finishReason: string | undefined;
          let timings: TranscriptionTimings | undefined;
          try {
            emit({ type: "progress", phase: "initializing" });
            const dataUrl = await blobToDataUrl(opts.blob);
            const body = buildTranscriptionRequestBody(config, opts, dataUrl);
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
                  const event = JSON.parse(
                    payload,
                  ) as OpenAIChatCompletionChunk;
                  const choice = event.choices?.[0];
                  const delta = choice?.delta;
                  if (
                    !outputStarted &&
                    !reasoningStarted &&
                    hasReasoningDelta(delta)
                  ) {
                    reasoningStarted = true;
                    emit({ type: "progress", phase: "reasoning" });
                  }
                  const content = delta?.content;
                  if (typeof content === "string" && content.length > 0) {
                    if (!outputStarted) {
                      outputStarted = true;
                      emit({ type: "progress", phase: "output" });
                    }
                    parser.push(content);
                  }
                  if (typeof choice?.finish_reason === "string") {
                    finishReason = choice.finish_reason;
                  }
                  const eventTimings = parseTimings(event.timings);
                  if (eventTimings) {
                    timings = { ...timings, ...eventTimings };
                  }
                } catch {
                  // Ignore malformed SSE chunks.
                }
              }
            }
            emit({
              type: "complete",
              ...(finishReason === undefined ? {} : { finishReason }),
              ...(timings === undefined ? {} : { timings }),
            });
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
  range: number,
): NoteBox | null {
  if (!Array.isArray(raw) || raw.length !== 4) return null;
  const nums = raw.map((v) => Number(v));
  if (nums.some((n) => !Number.isFinite(n))) return null;
  const [yMin, xMin, yMax, xMax] = nums as [number, number, number, number];
  return {
    x: (Math.min(xMin, xMax) / range) * imgWidth,
    y: (Math.min(yMin, yMax) / range) * imgHeight,
    width: (Math.abs(xMax - xMin) / range) * imgWidth,
    height: (Math.abs(yMax - yMin) / range) * imgHeight,
  };
}

function denormalizeNote(
  raw: unknown,
  imgWidth: number,
  imgHeight: number,
  format: BoundingBoxDefinition,
  translationLanguage: string,
  translationProperty: string,
): TranscribedNote | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const box = denormalizeBox(
    obj[format.key],
    imgWidth,
    imgHeight,
    format.range,
  );
  if (!box) return null;
  const transcription =
    typeof obj["label"] === "string"
      ? obj["label"]
      : String(obj["label"] ?? "");
  const translation =
    typeof obj[translationProperty] === "string"
      ? obj[translationProperty]
      : String(obj[translationProperty] ?? "");
  const sourceLanguage =
    typeof obj["language"] === "string"
      ? (canonicalizeLanguageTag(obj["language"]) ?? "und")
      : "und";
  return {
    ...box,
    body: translation,
    contents: [
      {
        language: sourceLanguage,
        contentType: "transcription",
        body: transcription,
      },
      {
        language: translationLanguage,
        contentType: "translation",
        body: translation,
      },
    ],
  };
}
