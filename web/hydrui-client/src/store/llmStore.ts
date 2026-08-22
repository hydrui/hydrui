import { create } from "zustand";
import { persist } from "zustand/middleware";

import { ProviderConfig, serverLLMProvider } from "@/llm";
import { isServerMode } from "@/utils/modes";

import { jsonStorage } from "./storage";

interface LLMState {
  providers: ProviderConfig[];
  selectedProviderId: string | null;
  actions: {
    addProvider: (provider: ProviderConfig) => void;
    updateProvider: (id: string, patch: Partial<ProviderConfig>) => void;
    removeProvider: (id: string) => void;
    selectProvider: (id: string | null) => void;
  };
}

export const useLLMStore = create<LLMState>()(
  persist(
    (set) => ({
      providers: [],
      selectedProviderId: null,
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
            return {
              providers,
              selectedProviderId:
                state.selectedProviderId === id
                  ? (providers[0]?.id ?? null)
                  : state.selectedProviderId,
            };
          }),
        selectProvider: (id) => set({ selectedProviderId: id }),
      },
    }),
    {
      name: "hydrui-llm",
      storage: jsonStorage,
      version: 1,
      partialize: (state) => ({
        providers: state.providers,
        selectedProviderId: state.selectedProviderId,
      }),
    },
  ),
);

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
