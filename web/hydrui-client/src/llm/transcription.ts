export const DEFAULT_TRANSCRIPTION_SYSTEM_PROMPT =
  'Transcribe and translate all text in the image. You must provide a complete transcription of all text in the image; do not output generic descriptions such as "text bubble" or "text". Use the "label" attribute for the raw transcription and "language" for its BCP-47 language identifier. Follow the request-specific target-language instruction for the translation.';

export function canonicalizeLanguageTag(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    return Intl.getCanonicalLocales(trimmed)[0] ?? null;
  } catch {
    return null;
  }
}

const displayLanguage =
  typeof document === "undefined" ? "" : document.documentElement.lang;

export const DEFAULT_TRANSLATION_LANGUAGE =
  canonicalizeLanguageTag(displayLanguage) ?? "en";

export function translationPropertyName(language: string): string {
  return `label_${language}`;
}

export function buildTranscriptionSystemPrompt(
  systemPrompt: string,
  translationLanguage: string,
): string {
  const translationProperty = translationPropertyName(translationLanguage);
  return `${systemPrompt.trim()}\n\nTranslate into the language identified by BCP-47 tag "${translationLanguage}" and place that text in "${translationProperty}". If the source text is already in that language, repeat "label" in "${translationProperty}".`;
}

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
  translationLanguage: string;
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
