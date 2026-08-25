import { ProviderConfig } from "./types";

export function readServerLLMProvider(
  element: HTMLElement,
): ProviderConfig | null {
  if (element.dataset["serverMode"] !== "true") return null;
  const name = element.dataset["llmProviderName"];
  const model = element.dataset["llmModel"];
  if (!name || !model) return null;
  return {
    id: "server-proxy",
    name,
    kind: "openai",
    baseUrl: "/llm",
    apiKey: "",
    model,
  };
}

export const serverLLMProvider = readServerLLMProvider(document.body);
