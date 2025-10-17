import { create } from "zustand";
import { persist } from "zustand/middleware";

import { SearchFilesResponse } from "@/api/types";

import { client } from "./apiStore";
import { jsonStorage } from "./storage";

export type SearchStatus = "initial" | "loading" | "loaded";

interface SearchState {
  searchTags: string[];
  searchResults: number[];
  searchStatus: SearchStatus;
  searchError: string | null;
  autoSearch: boolean;
  cancelSearch: (() => void) | null;

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
      cancelSearch: null,

      actions: {
        addSearchTag: (tag: string) => {
          const {
            searchTags,
            autoSearch,
            actions: { performSearch },
          } = get();
          if (!searchTags.includes(tag)) {
            const newTags = [...searchTags, tag];
            set({ searchTags: newTags, searchError: null });

            // Auto-search if enabled
            if (autoSearch) {
              setTimeout(() => performSearch(), 0);
            }
          }
        },

        removeSearchTag: (tag: string) => {
          const {
            searchTags,
            autoSearch,
            actions: { performSearch },
          } = get();
          const newTags = searchTags.filter((t) => t !== tag);
          set({ searchTags: newTags, searchError: null });

          // Auto-search if enabled
          if (autoSearch) {
            setTimeout(() => performSearch(), 0);
          }
        },

        setSearchTags: (tags: string[]) => {
          const {
            autoSearch,
            actions: { performSearch },
          } = get();
          set({ searchTags: tags });

          // Auto-search if enabled
          if (autoSearch) {
            setTimeout(() => performSearch(), 0);
          }
        },

        setAutoSearch: (autoSearch: boolean) => {
          set({ autoSearch });
        },

        performSearch: async () => {
          const { searchTags, cancelSearch } = get();

          // Abort existing request, if one exists.
          if (cancelSearch) {
            cancelSearch();
          }

          if (searchTags.length === 0) {
            set({
              searchResults: [],
              searchStatus: "loaded",
              cancelSearch: null,
            });
            return;
          }

          let promise: Promise<SearchFilesResponse> | null = null;
          let rejectPromise: ((reason: unknown) => void) | null = null;
          let abortController: AbortController | null = null;
          if (typeof AbortController !== "undefined") {
            abortController = new AbortController();
          }
          set({
            searchStatus: "loading",
            searchError: null,
            cancelSearch: () => {
              promise?.catch(() => {});
              rejectPromise?.(new Error("Aborted"));
              abortController?.abort();
            },
          });
          try {
            promise = new Promise<SearchFilesResponse>((resolve, reject) => {
              rejectPromise = reject;
              client
                .searchFiles({ tags: searchTags }, abortController?.signal)
                .then(resolve, reject);
            });
            const response = await promise;
            set({ searchResults: response.file_ids, searchStatus: "loaded" });
          } catch (error) {
            set({
              searchResults: [],
              searchStatus: "loaded",
              searchError:
                error instanceof Error ? error.message : "Unknown error",
            });
          } finally {
            set({
              cancelSearch: null,
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
