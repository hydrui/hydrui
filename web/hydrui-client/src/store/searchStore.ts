import { create } from "zustand";
import { persist } from "zustand/middleware";

import { SearchFilesResponse } from "@/api/types";
import { SortFilesBy } from "@/constants/sort";

import { client } from "./apiStore";
import { jsonStorage } from "./storage";

export type SearchStatus = "initial" | "loading" | "loaded";

interface SearchState {
  searchTags: string[];
  searchSort: SortFilesBy;
  searchAscending: boolean;
  searchResults: number[];
  searchStatus: SearchStatus;
  searchError: string | null;
  autoSearch: boolean;
  cancelSearch: (() => void) | null;
  serial: number;

  actions: {
    addSearchTag: (tag: string) => void;
    removeSearchTag: (tag: string) => void;
    setSearchTags: (tags: string[]) => void;
    setSearchSort: (sort: SortFilesBy) => void;
    setSearchAscending: (ascending: boolean) => void;
    performSearch: () => Promise<void>;
    setAutoSearch: (autoSearch: boolean) => void;
  };
}

export const useSearchActions = () => useSearchStore((state) => state.actions);

export const useSearchStore = create<SearchState>()(
  persist(
    (set, get) => ({
      searchTags: [],
      searchSort: SortFilesBy.IMPORT_TIME,
      searchAscending: false,
      searchResults: [],
      searchStatus: "initial",
      searchError: null,
      autoSearch: true,
      cancelSearch: null,
      serial: 0,

      actions: {
        addSearchTag: (tag: string) => {
          const {
            searchTags,
            actions: { setSearchTags },
          } = get();
          if (!searchTags.includes(tag)) {
            setSearchTags([...searchTags, tag]);
          }
        },

        removeSearchTag: (tag: string) => {
          const {
            searchTags,
            actions: { setSearchTags },
          } = get();
          if (searchTags.includes(tag)) {
            setSearchTags(searchTags.filter((t) => t !== tag));
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

        setSearchSort: (sort: SortFilesBy) => {
          const {
            autoSearch,
            actions: { performSearch },
          } = get();
          set({ searchSort: sort });
          // Auto-search if enabled
          if (autoSearch) {
            setTimeout(() => performSearch(), 0);
          }
        },

        setSearchAscending: (ascending: boolean) => {
          const {
            autoSearch,
            actions: { performSearch },
          } = get();
          set({ searchAscending: ascending });
          // Auto-search if enabled
          if (autoSearch) {
            setTimeout(() => performSearch(), 0);
          }
        },

        setAutoSearch: (autoSearch: boolean) => {
          set({ autoSearch });
        },

        performSearch: async () => {
          const { searchTags, searchSort, searchAscending, cancelSearch } =
            get();

          // Abort existing request, if one exists.
          if (cancelSearch) {
            cancelSearch();
          }

          if (searchTags.length === 0) {
            set(({ serial }) => ({
              searchResults: [],
              searchStatus: "loaded",
              cancelSearch: null,
              serial: serial + 1,
            }));
            return;
          }

          let promise: Promise<SearchFilesResponse> | null = null;
          let rejectPromise: ((reason: unknown) => void) | null = null;
          let abortController: AbortController | null = null;
          if (typeof AbortController !== "undefined") {
            abortController = new AbortController();
          }
          let currentSerial = 0;
          set(({ serial }) => {
            currentSerial = serial + 1;
            return {
              searchStatus: "loading",
              searchError: null,
              cancelSearch: () => {
                promise?.catch(() => {});
                rejectPromise?.(new Error("Aborted"));
                abortController?.abort();
              },
              serial: currentSerial,
            };
          });
          try {
            promise = new Promise<SearchFilesResponse>((resolve, reject) => {
              rejectPromise = reject;
              client
                .searchFiles(
                  {
                    tags: searchTags,
                    file_sort_type: searchSort,
                    file_sort_asc: searchAscending,
                  },
                  abortController?.signal,
                )
                .then(resolve, reject);
            });
            const response = await promise;
            set(({ serial }) => {
              if (serial !== currentSerial) {
                return {};
              }
              return {
                searchResults: response.file_ids,
                searchStatus: "loaded",
              };
            });
          } catch (error) {
            set(({ serial }) => {
              if (serial !== currentSerial) {
                return {};
              }
              return {
                searchResults: [],
                searchStatus: "loaded",
                searchError:
                  error instanceof Error
                    ? error.message === "Aborted"
                      ? null
                      : error.message
                    : "Unknown error",
              };
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
        searchSort: state.searchSort,
        searchAscending: state.searchAscending,
        autoSearch: state.autoSearch,
      }),
      storage: jsonStorage,
    },
  ),
);
