import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UIState {
  // Tag edit modal state
  lastActiveTagService: string | null;

  // Tab scroll positions
  scrollPositions: Record<string, number>;

  // Autotag model
  autotagModel: string;

  // Autotag threshold
  autotagThreshold: number;

  // Sidebar positioning
  sidebarWidthPercent: number;
  sidebarHidden: boolean;
  tagListHeightPercent: number;
  tagListHidden: boolean;
  previewHidden: boolean;

  actions: {
    setLastActiveTagService: (serviceKey: string | null) => void;
    setScrollPosition: (pageKey: string, position: number) => void;
    getScrollPosition: (pageKey: string) => number;
    setAutotagModel: (model: string) => void;
    setAutotagThreshold: (threshold: number) => void;
    setSidebarWidthPercent: (value: number) => void;
    setSidebarHidden: (value: boolean) => void;
    setTagListHeightPercent: (value: number) => void;
    setTagListHidden: (value: boolean) => void;
    setPreviewHidden: (value: boolean) => void;
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
      autotagModel: "",
      autotagThreshold: 0.85,
      sidebarWidthPercent: 25,
      sidebarHidden: false,
      tagListHeightPercent: 50,
      tagListHidden: false,
      previewHidden: false,

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

        setAutotagModel(model: string) {
          set({ autotagModel: model });
        },

        setAutotagThreshold(threshold: number) {
          set({ autotagThreshold: threshold });
        },

        setSidebarWidthPercent(value: number) {
          set({ sidebarWidthPercent: value });
        },

        setSidebarHidden(value: boolean) {
          set({ sidebarHidden: value });
        },

        setTagListHeightPercent(value: number) {
          set({ tagListHeightPercent: value });
        },

        setTagListHidden(value: boolean) {
          set({ tagListHidden: value });
        },

        setPreviewHidden(value: boolean) {
          set({ previewHidden: value });
        },
      },
    }),
    {
      name: "hydrui-ui-state",
      // Only persist specific keys
      partialize: (state) => ({
        lastActiveTagService: state.lastActiveTagService,
        scrollPositions: state.scrollPositions,
        autotagModel: state.autotagModel,
        autotagThreshold: state.autotagThreshold,
        sidebarWidthPercent: state.sidebarWidthPercent,
        sidebarHidden: state.sidebarHidden,
        tagListHeightPercent: state.tagListHeightPercent,
        tagListHidden: state.tagListHidden,
        previewHidden: state.previewHidden,
      }),
    },
  ),
);
