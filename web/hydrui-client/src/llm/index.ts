import { OpenAIProvider } from "./openai";
import { LLMProvider, ProviderConfig } from "./types";

export * from "./types";
export * from "./transcription";
export { readServerLLMProvider, serverLLMProvider } from "./server";

export function createProvider(config: ProviderConfig): LLMProvider {
  switch (config.kind) {
    case "openai":
      return new OpenAIProvider(config);
  }
}
