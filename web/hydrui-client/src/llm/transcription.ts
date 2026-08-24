export const DEFAULT_TRANSCRIPTION_SYSTEM_PROMPT =
  'Transcribe and translate all text in the image. You must provide a complete transcription of all text in the image, you may not output generic descriptions of text such as "text bubble" or "text". Use the "label" attribute for a raw transcription, then, if the text is in a language other than English, place a translation in "label_en", otherwise, repeat the text from "label".';

export const BOUNDING_BOX_FORMATS = [
  {
    id: "gemini-bbox-2d",
    label: "Gemini / Gemma - bbox_2d (0-1000)",
  },
] as const;

export type BoundingBoxFormat = (typeof BOUNDING_BOX_FORMATS)[number]["id"];

export interface ProviderTranscriptionDefaults {
  boundingBoxFormat: BoundingBoxFormat;
  overrideModel: boolean;
  model: string;
  overrideReasoningEffort: boolean;
  reasoningEffort: string;
  includeAdditionalParameters: boolean;
  additionalParameters: string;
}

export interface TranscriptionRequestSettings {
  systemPrompt: string;
  boundingBoxFormat: BoundingBoxFormat;
  model?: string;
  reasoningEffort?: string;
  additionalParameters?: Record<string, unknown>;
}

export interface TranscriptionPromptHistoryEntry {
  prompt: string;
  usedAt: number;
}

export const DEFAULT_PROVIDER_TRANSCRIPTION_DEFAULTS: ProviderTranscriptionDefaults =
  {
    boundingBoxFormat: "gemini-bbox-2d",
    overrideModel: false,
    model: "",
    overrideReasoningEffort: false,
    reasoningEffort: "none",
    includeAdditionalParameters: false,
    additionalParameters: "{}",
  };

export function resolveProviderTranscriptionDefaults(
  value: Partial<ProviderTranscriptionDefaults> | undefined,
): ProviderTranscriptionDefaults {
  const boundingBoxFormat =
    BOUNDING_BOX_FORMATS.find(
      (format) => format.id === value?.boundingBoxFormat,
    )?.id ?? DEFAULT_PROVIDER_TRANSCRIPTION_DEFAULTS.boundingBoxFormat;
  return {
    ...DEFAULT_PROVIDER_TRANSCRIPTION_DEFAULTS,
    ...value,
    boundingBoxFormat,
  };
}

export function parseAdditionalParameters(
  input: string,
): Record<string, unknown> {
  const value: unknown = JSON.parse(input);
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Additional parameters must be a JSON object.");
  }
  return value as Record<string, unknown>;
}

export function recordPromptHistory(
  history: TranscriptionPromptHistoryEntry[],
  prompt: string,
  usedAt = Date.now(),
): TranscriptionPromptHistoryEntry[] {
  return [
    { prompt, usedAt },
    ...history.filter((entry) => entry.prompt !== prompt),
  ].slice(0, 100);
}
