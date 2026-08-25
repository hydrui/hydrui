import { create } from "zustand";
import { persist } from "zustand/middleware";

import {
  DEFAULT_TRANSCRIPTION_SYSTEM_PROMPT,
  DEFAULT_TRANSLATION_LANGUAGE,
  ProviderConfig,
  ProviderTranscriptionDefaults,
  TranscriptionPromptHistoryEntry,
  canonicalizeLanguageTag,
  recordPromptHistory,
  resolveProviderTranscriptionDefaults,
  serverLLMProvider,
} from "@/llm";
import { isServerMode } from "@/utils/modes";

import { jsonStorage } from "./storage";

interface LLMState {
  providers: ProviderConfig[];
  selectedProviderId: string | null;
  transcriptionSystemPrompt: string;
  translationLanguage: string;
  transcriptionPromptHistory: TranscriptionPromptHistoryEntry[];
  providerTranscriptionDefaults: Record<string, ProviderTranscriptionDefaults>;
  actions: {
    addProvider: (provider: ProviderConfig) => void;
    updateProvider: (id: string, patch: Partial<ProviderConfig>) => void;
    removeProvider: (id: string) => void;
    selectProvider: (id: string | null) => void;
    setTranscriptionSystemPrompt: (prompt: string) => void;
    setTranslationLanguage: (language: string) => void;
    resetTranscriptionSystemPrompt: () => void;
    recordTranscriptionSystemPrompt: (prompt: string) => void;
    updateProviderTranscriptionDefaults: (
      id: string,
      patch: Partial<ProviderTranscriptionDefaults>,
    ) => void;
  };
}

export const useLLMStore = create<LLMState>()(
  persist(
    (set) => ({
      providers: [],
      selectedProviderId: null,
      transcriptionSystemPrompt: DEFAULT_TRANSCRIPTION_SYSTEM_PROMPT,
      translationLanguage: DEFAULT_TRANSLATION_LANGUAGE,
      transcriptionPromptHistory: [],
      providerTranscriptionDefaults: {},
      actions: {
        addProvider: (provider) =>
          set((state) => ({
            providers: [...state.providers, provider],
            selectedProviderId: state.selectedProviderId ?? provider.id,
          })),
        updateProvider: (id, patch) =>
          set((state) => ({
            providers: state.providers.map((p) =>
              p.id === id ? ({ ...p, ...patch } as ProviderConfig) : p,
            ),
          })),
        removeProvider: (id) =>
          set((state) => {
            const providers = state.providers.filter((p) => p.id !== id);
            const providerTranscriptionDefaults = {
              ...state.providerTranscriptionDefaults,
            };
            delete providerTranscriptionDefaults[id];
            return {
              providers,
              providerTranscriptionDefaults,
              selectedProviderId:
                state.selectedProviderId === id
                  ? (providers[0]?.id ?? null)
                  : state.selectedProviderId,
            };
          }),
        selectProvider: (id) => set({ selectedProviderId: id }),
        setTranscriptionSystemPrompt: (transcriptionSystemPrompt) =>
          set({ transcriptionSystemPrompt }),
        setTranslationLanguage: (language) => {
          const translationLanguage = canonicalizeLanguageTag(language);
          if (translationLanguage) set({ translationLanguage });
        },
        resetTranscriptionSystemPrompt: () =>
          set({
            transcriptionSystemPrompt: DEFAULT_TRANSCRIPTION_SYSTEM_PROMPT,
          }),
        recordTranscriptionSystemPrompt: (prompt) =>
          set((state) => ({
            transcriptionSystemPrompt: prompt,
            transcriptionPromptHistory: recordPromptHistory(
              state.transcriptionPromptHistory,
              prompt,
            ),
          })),
        updateProviderTranscriptionDefaults: (id, patch) =>
          set((state) => ({
            providerTranscriptionDefaults: {
              ...state.providerTranscriptionDefaults,
              [id]: {
                ...resolveProviderTranscriptionDefaults(
                  state.providerTranscriptionDefaults[id],
                ),
                ...patch,
              },
            },
          })),
      },
    }),
    {
      name: "hydrui-llm",
      storage: jsonStorage,
      version: 1,
      partialize: (state) => ({
        providers: state.providers,
        selectedProviderId: state.selectedProviderId,
        transcriptionSystemPrompt: state.transcriptionSystemPrompt,
        translationLanguage: state.translationLanguage,
        transcriptionPromptHistory: state.transcriptionPromptHistory,
        providerTranscriptionDefaults: state.providerTranscriptionDefaults,
      }),
    },
  ),
);

export const useAvailableLLMProviders = (): ProviderConfig[] => {
  const providers = useLLMStore((s) => s.providers);
  return resolveAvailableLLMProviders(
    isServerMode,
    serverLLMProvider,
    providers,
  );
};

export const useSelectedLLMProvider = (): ProviderConfig | null => {
  const providers = useLLMStore((s) => s.providers);
  const selected = useLLMStore((s) => s.selectedProviderId);
  return resolveSelectedLLMProvider(
    isServerMode,
    serverLLMProvider,
    providers,
    selected,
  );
};

export function resolveSelectedLLMProvider(
  serverMode: boolean,
  serverProvider: ProviderConfig | null,
  browserProviders: ProviderConfig[],
  selectedBrowserProviderId: string | null,
): ProviderConfig | null {
  if (serverMode) return serverProvider;
  return (
    browserProviders.find((p) => p.id === selectedBrowserProviderId) ?? null
  );
}

export function resolveAvailableLLMProviders(
  serverMode: boolean,
  serverProvider: ProviderConfig | null,
  browserProviders: ProviderConfig[],
): ProviderConfig[] {
  if (serverMode) return serverProvider ? [serverProvider] : [];
  return browserProviders;
}
