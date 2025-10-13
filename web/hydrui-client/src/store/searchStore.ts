import { create } from "zustand";
import { persist } from "zustand/middleware";

import { client } from "./apiStore";
import { jsonStorage } from "./storage";

export type SearchStatus = "initial" | "loading" | "loaded";

interface SearchState {
  searchTags: string[];
  searchResults: number[];
  searchStatus: SearchStatus;
  searchError: string | null;
  autoSearch: boolean;

  actions: {
    addSearchTag: (tag: string) => void;
    removeSearchTag: (tag: string) => void;
    setSearchTags: (tags: string[]) => void;
    performSearch: () => Promise<void>;
    setAutoSearch: (autoSearch: boolean) => void;
  };
}

export const useSearchActions = () => useSearchStore((state) => state.actions);

export const useSearchStore = create<SearchState>()(
  persist(
    (set, get) => ({
      searchTags: [],
      searchResults: [],
      searchStatus: "initial",
      searchError: null,
      autoSearch: true,

      actions: {
        addSearchTag: (tag: string) => {
          const { searchTags, autoSearch } = get();
          if (!searchTags.includes(tag)) {
            const newTags = [...searchTags, tag];
            set({ searchTags: newTags, searchError: null });

            // Auto-search if enabled
            if (autoSearch) {
              setTimeout(() => get().actions.performSearch(), 0);
            }
          }
        },

        removeSearchTag: (tag: string) => {
          const { searchTags, autoSearch } = get();
          const newTags = searchTags.filter((t) => t !== tag);
          set({ searchTags: newTags, searchError: null });

          // Auto-search if enabled
          if (autoSearch) {
            setTimeout(() => get().actions.performSearch(), 0);
          }
        },

        setSearchTags: (tags: string[]) => {
          const { autoSearch } = get();
          set({ searchTags: tags });

          // Auto-search if enabled
          if (autoSearch) {
            setTimeout(() => get().actions.performSearch(), 0);
          }
        },

        setAutoSearch: (autoSearch: boolean) => {
          set({ autoSearch });
        },

        performSearch: async () => {
          const { searchTags } = get();

          // Don't auto-search with no tags to avoid loading everything
          if (searchTags.length === 0) {
            set({ searchResults: [], searchStatus: "loaded" });
            return;
          }

          set({ searchStatus: "loading", searchError: null });

          try {
            const response = await client.searchFiles({ tags: searchTags });
            set({ searchResults: response.file_ids, searchStatus: "loaded" });
          } catch (error) {
            console.error("Search failed:", error);
            set({
              searchResults: [],
              searchStatus: "loaded",
              searchError:
                error instanceof Error ? error.message : "Unknown error",
            });
          }
        },
      },
    }),
    {
      name: "hydrui-search-state",
      // Only persist specific keys
      partialize: (state) => ({
        searchTags: state.searchTags,
        autoSearch: state.autoSearch,
      }),
      storage: jsonStorage,
    },
  ),
);
