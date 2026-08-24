import type { TranscriptionRequestSettings } from "./transcription";

export interface NoteBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TranscribedNote extends NoteBox {
  body: string;
}

export type TranscribeEvent =
  // The note's bounding box is known (already denormalized to image pixels).
  | { type: "box"; index: number; box: NoteBox }
  // The note's label text so far.
  | { type: "text"; index: number; body: string }
  // The note finished parsing. `note` is null if it had no usable box.
  | { type: "end"; index: number; note: TranscribedNote | null };

export type LLMProviderKind = "openai";

export interface BaseProviderConfig {
  id: string;
  name: string;
  kind: LLMProviderKind;
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface OpenAIProviderConfig extends BaseProviderConfig {
  kind: "openai";
  // Extra options merged into the request body (e.g. llama.cpp-specific keys).
  extra?: Record<string, unknown>;
}

export type ProviderConfig = OpenAIProviderConfig;

export interface TranscribeOptions extends TranscriptionRequestSettings {
  // Raw image data (encoded; will be sent as base64 data URL).
  blob: Blob;
  // Original image pixel dimensions, used to denormalize box coordinates.
  width: number;
  height: number;
  signal: AbortSignal;
}

export interface LLMProvider {
  listModels(signal: AbortSignal): Promise<string[]>;
  transcribe(opts: TranscribeOptions): AsyncIterable<TranscribeEvent>;
}
