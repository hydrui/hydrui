import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UIState {
  // Tag edit modal state
  lastActiveTagService: string | null;

  // Tab scroll positions
  scrollPositions: Record<string, number>;

  actions: {
    setLastActiveTagService: (serviceKey: string | null) => void;
    setScrollPosition: (pageKey: string, position: number) => void;
    getScrollPosition: (pageKey: string) => number;
  };
}

export const useUIStateActions = () =>
  useUIStateStore((state) => state.actions);

export const useUIStateStore = create<UIState>()(
  persist(
    (set, get) => ({
      // Initial state
      lastActiveTagService: null,
      scrollPositions: {},
      scrollLocks: {},

      // Actions
      actions: {
        setLastActiveTagService: (serviceKey) =>
          set({ lastActiveTagService: serviceKey }),

        setScrollPosition: (pageKey, position) =>
          set((state) => ({
            scrollPositions: {
              ...state.scrollPositions,
              [pageKey]: position,
            },
          })),

        getScrollPosition: (pageKey) => get().scrollPositions[pageKey] || 0,
      },
    }),
    {
      name: "hydrui-ui-state",
      // Only persist specific keys
      partialize: (state) => ({
        lastActiveTagService: state.lastActiveTagService,
        scrollPositions: state.scrollPositions,
      }),
    },
  ),
);
