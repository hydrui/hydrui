import { create } from "zustand";
import { persist } from "zustand/middleware";

import { FileMetadata, FileRelationshipPair, Page } from "@/api/types";
import { FileRelationship } from "@/constants/relationships";
import { client, useApiStore } from "@/store/apiStore";
import { useSearchStore } from "@/store/searchStore";
import { jsonStorage } from "@/store/storage";

// Special page key for our search tab - this will never conflict with API page keys
export const SEARCH_PAGE_KEY = "hydrui-search-tab";

export type PageType = "search" | "hydrus" | "virtual";

// Interface for virtual pages
export interface VirtualPage {
  name: string;
  fileIds?: number[];
  hashes?: string[];
}

// Map of virtual page keys to their data
export type VirtualPages = Record<string, VirtualPage>;

// Interface for persisted state
interface PersistedState {
  virtualPages: VirtualPages;
  virtualPageKeys: string[];
  pages: Page[];
  activePageKey: string | null;
  pageType: PageType;
  pageName: string | null;
  selectedPageKeys: string[];
}

interface PageState extends PersistedState {
  fileIds: number[];
  files: FileMetadata[];
  selectedFilesByPage: Record<string, number[]>;
  activeFileByPage: Record<string, number | null>;
  isLoadingFiles: boolean;
  loadedFileCount: number;
  totalFileCount: number;
  error: string | null;
  lastRequestId: number;
  currentAbortController: AbortController | null;
  clearDuringLoad: boolean;
  // Actions
  actions: {
    setPage: (pageKey: string, type: PageType) => Promise<void>;
    updatePageContents: (
      pageKey: string,
      type: PageType,
      clearDuringLoad?: boolean,
    ) => Promise<void>;
    refreshPage: (pageKey: string, type: PageType) => Promise<void>;
    fetchPages: () => Promise<void>;
    setSelectedPageKeys: (keys: string[]) => void;
    addSelectedPageKey: (key: string) => void;
    removeSelectedPageKey: (key: string) => void;
    setSelectedFiles: (pageKey: string, fileIds: number[]) => void;
    addSelectedFiles: (pageKey: string, fileIds: number[]) => void;
    clearSelectedFiles: (pageKey: string) => void;
    setActiveFileId: (pageKey: string, fileId: number | null) => void;
    markActiveFileAsBetter: () => Promise<void>;
    addFilesToPage: (
      pageKey: string,
      pageType: PageType,
      fileIds: number[],
    ) => Promise<void>;
    removeFilesFromPage: (
      pageKey: string,
      pageType: PageType,
      fileIds: number[],
    ) => Promise<void>;
    refreshFileMetadata: (fileIds: number[]) => Promise<void>;
    cancelCurrentPageLoad: () => void;
    addFilesToView: (fileIds: number[]) => Promise<void>;
    removeFilesFromView: (fileIds: number[]) => void;
    addVirtualPage: (pageKey: string, page: VirtualPage) => void;
    removeVirtualPage: (pageKey: string) => void;
    updateVirtualPage: (
      pageKey: string,
      updates: Partial<VirtualPage>,
    ) => Promise<void>;
  };
}

export const usePageActions = () => usePageStore((state) => state.actions);

export const usePageStore = create<PageState>()(
  persist(
    (set, get) => {
      // Helper function to update state with file IDs
      const updateWithFileIds = async (
        fileIds: number[],
        pageKey: string,
        requestId: number,
      ) => {
        const state = get();
        const CHUNK_SIZE = 256;

        set({ fileIds });

        // Only update if we're on the same page.
        if (get().activePageKey !== pageKey) return;

        if (fileIds.length > 0) {
          // Abort any existing request
          if (state.currentAbortController) {
            state.currentAbortController.abort();
          }

          // AbortController isn't supported in Servo yet. It's not critical, so just ignore it.
          // An on-going page load can still be cancelled, just not as quickly.
          let abortController: AbortController | null = null;
          if (typeof AbortController !== "undefined") {
            abortController = new AbortController();
          }
          set({
            isLoadingFiles: true,
            loadedFileCount: 0,
            totalFileCount: fileIds.length,
            currentAbortController: abortController,
          });

          try {
            const allMetadata = [];

            // Process files in chunks
            for (let i = 0; i < fileIds.length; i += CHUNK_SIZE) {
              const chunk = fileIds.slice(i, i + CHUNK_SIZE);
              const response = await client.getFileMetadata(
                chunk,
                abortController?.signal,
              );

              // Check if this is still the current request
              if (
                get().lastRequestId !== requestId ||
                get().activePageKey !== pageKey
              ) {
                return;
              }

              // Update progress
              allMetadata.push(...response.metadata);
              set({
                isLoadingFiles: true,
                loadedFileCount: Math.min(i + CHUNK_SIZE, fileIds.length),
              });
            }

            // Only update if we're still on the same page and this is the most recent request
            if (
              get().activePageKey !== pageKey ||
              get().lastRequestId !== requestId
            )
              return;
            set({
              isLoadingFiles: false,
              files: allMetadata,
              currentAbortController: null,
              loadedFileCount: fileIds.length,
              totalFileCount: fileIds.length,
            });
          } catch (error: unknown) {
            // Only update error if it wasn't due to abort
            if (
              error instanceof Error &&
              error.name !== "AbortError" &&
              get().activePageKey === pageKey &&
              get().lastRequestId === requestId
            ) {
              console.error("Failed to load file metadata:", error);
              set({
                error: "Failed to load file data",
                isLoadingFiles: false,
                currentAbortController: null,
              });
            }
          }
        } else {
          if (get().activePageKey === pageKey) {
            set({
              isLoadingFiles: false,
              files: [],
              fileIds: [],
              loadedFileCount: 0,
              totalFileCount: 0,
            });
          }
        }
      };

      // Helper function to update state with hashes
      const updateWithHashes = async (
        hashes: string[],
        pageKey: string,
        requestId: number,
      ) => {
        const state = get();
        const CHUNK_SIZE = 256;

        // Abort any existing request
        if (state.currentAbortController) {
          state.currentAbortController.abort();
        }

        // AbortController isn't supported in Servo yet. It's not critical, so just ignore it.
        // An on-going page load can still be cancelled, just not as quickly.
        let abortController: AbortController | null = null;
        if (typeof AbortController !== "undefined") {
          abortController = new AbortController();
        }
        if (get().activePageKey === pageKey) {
          set({
            isLoadingFiles: true,
            loadedFileCount: 0,
            totalFileCount: hashes.length,
            currentAbortController: abortController,
          });
        } else {
          set({
            currentAbortController: abortController,
          });
        }

        try {
          const allMetadata = [];

          // Process hashes in chunks
          for (let i = 0; i < hashes.length; i += CHUNK_SIZE) {
            // Check if this is still the current request
            if (
              get().lastRequestId !== requestId ||
              get().activePageKey !== pageKey
            ) {
              return;
            }

            const chunk = hashes.slice(i, i + CHUNK_SIZE);
            const response = await client.getFileMetadataByHashes(
              chunk,
              abortController?.signal,
            );

            // Update progress
            allMetadata.push(...response.metadata);
            if (get().activePageKey === pageKey) {
              set({ loadedFileCount: Math.min(i + CHUNK_SIZE, hashes.length) });
            }
          }

          // Only update if we're still on the same page and this is the most recent request
          if (
            get().activePageKey === pageKey &&
            get().lastRequestId === requestId
          ) {
            const fileIds = allMetadata.map((m) => m.file_id);
            set({
              isLoadingFiles: false,
              files: allMetadata,
              fileIds,
              currentAbortController: null,
              loadedFileCount: hashes.length,
              totalFileCount: hashes.length,
            });
          }
        } catch (error: unknown) {
          // Only update error if it wasn't due to abort
          if (
            error instanceof Error &&
            error.name !== "AbortError" &&
            get().activePageKey === pageKey &&
            get().lastRequestId === requestId
          ) {
            console.error("Failed to load file metadata:", error);
            if (get().activePageKey === pageKey) {
              set({
                error: "Failed to load file data",
                isLoadingFiles: false,
                currentAbortController: null,
              });
            }
          }
        }
      };

      return {
        // Initial state
        activePageKey: SEARCH_PAGE_KEY,
        pageType: "search" as PageType,
        pageName: null,
        pages: [],
        virtualPages: {},
        virtualPageKeys: [],
        selectedPageKeys: [],
        fileIds: [],
        files: [],
        selectedFilesByPage: {},
        activeFileByPage: {},
        isLoadingFiles: false,
        loadedFileCount: 0,
        totalFileCount: 0,
        error: null,
        lastRequestId: 0,
        currentAbortController: null,
        clearDuringLoad: true,

        actions: {
          fetchPages: async () => {
            try {
              const response = await client.getPages();

              set({ pages: response.pages.pages });

              // If we don't have an active page yet, use the first API page or the search page
              const { activePageKey } = get();
              if (
                !activePageKey &&
                response.pages.pages &&
                response.pages.pages.length > 0
              ) {
                await get().actions.setPage(
                  response.pages.pages[0].page_key,
                  "hydrus",
                );
              } else if (!activePageKey) {
                await get().actions.setPage(SEARCH_PAGE_KEY, "search");
              }
            } catch (error) {
              console.error("Failed to fetch pages:", error);
              set({ error: "Failed to fetch pages" });
            }
          },

          updatePageContents: async (
            pageKey: string,
            type: PageType,
            clearDuringLoad: boolean = true,
          ) => {
            const state = get();
            const requestId = state.lastRequestId + 1;

            // Only update if we're on the same page.
            if (get().activePageKey !== pageKey) return;

            set({ lastRequestId: requestId });

            try {
              // Get the source of files based on page type
              switch (type) {
                case "hydrus": {
                  const pageInfo = await client.getPageInfo(pageKey);
                  // Only update if we're on the same page
                  if (get().activePageKey !== pageKey) return;
                  set({
                    pageName: pageInfo.page_info.name,
                    clearDuringLoad,
                  });
                  const fileIds = pageInfo.page_info.media?.hash_ids || [];
                  await updateWithFileIds(fileIds, pageKey, requestId);
                  break;
                }

                case "search": {
                  set({ pageName: "Search" });
                  const fileIds = useSearchStore.getState().searchResults;
                  set({
                    isLoadingFiles:
                      useSearchStore.getState().searchStatus === "loading",
                    clearDuringLoad,
                  });
                  await updateWithFileIds(fileIds, pageKey, requestId);
                  break;
                }

                case "virtual": {
                  const virtualPage = state.virtualPages[pageKey];
                  if (!virtualPage) {
                    set({ error: "Virtual page not found" });
                    return;
                  }
                  set({
                    pageName: virtualPage.name,
                    clearDuringLoad,
                  });

                  if (virtualPage.fileIds) {
                    await updateWithFileIds(
                      virtualPage.fileIds,
                      pageKey,
                      requestId,
                    );
                  } else if (virtualPage.hashes) {
                    await updateWithHashes(
                      virtualPage.hashes,
                      pageKey,
                      requestId,
                    );
                  }
                  break;
                }
              }
            } catch (error) {
              console.error("Failed to update page contents:", error);
              // Only update error if we're on the same page.
              if (get().activePageKey === pageKey) {
                set({
                  error: "Failed to load page data",
                  isLoadingFiles: false,
                });
              }
            }
          },

          refreshPage: async (pageKey: string, type: PageType) => {
            switch (type) {
              case "hydrus": {
                set({
                  isLoadingFiles: true,
                  clearDuringLoad: false,
                });
                await client.refreshPage(pageKey);

                // Wait for page to be ready
                for (let i = 0; i < 30; i++) {
                  const pageInfo = await client.getPageInfo(pageKey);
                  if (pageInfo.page_info.page_state === 0) {
                    break;
                  }
                  await new Promise((resolve) =>
                    setTimeout(resolve, i < 5 ? 1000 : 5000),
                  );
                }
                break;
              }
            }

            await get().actions.updatePageContents(pageKey, type, false);
          },

          cancelCurrentPageLoad: () => {
            const state = get();
            if (state.currentAbortController) {
              state.currentAbortController.abort();
            }
            set({
              lastRequestId: state.lastRequestId + 1,
              isLoadingFiles: false,
              currentAbortController: null,
              loadedFileCount: 0,
              totalFileCount: 0,
              error: "Loading cancelled",
            });
          },

          addFilesToView: async (fileIds: number[]) => {
            const state = get();
            const currentFileIds = new Set(state.fileIds);

            // Filter out file IDs that are already in view
            const newFileIds = fileIds.filter((id) => !currentFileIds.has(id));
            if (newFileIds.length === 0) return;

            try {
              // Fetch metadata for new files
              const metadata = await client.getFileMetadata(newFileIds);

              set((state) => ({
                fileIds: [...state.fileIds, ...newFileIds],
                files: [...state.files, ...metadata.metadata],
                isLoadingFiles: false,
                loadedFileCount: state.loadedFileCount + newFileIds.length,
              }));
            } catch (error) {
              console.error("Failed to fetch metadata for new files:", error);
              set({
                error: "Failed to load new file metadata",
                isLoadingFiles: false,
              });
            }
          },

          removeFilesFromView: (fileIds: number[]) => {
            set((state) => ({
              fileIds: state.fileIds.filter((id) => !fileIds.includes(id)),
              files: state.files.filter(
                (file) => !fileIds.includes(file.file_id),
              ),
            }));
          },

          setPage: async (pageKey: string, type: PageType) => {
            // Validate virtual page exists if type is virtual
            if (type === "virtual" && !get().virtualPages[pageKey]) {
              set({ error: "Virtual page not found" });
              return;
            }

            set((state) => ({
              activePageKey: pageKey,
              pageType: type,
              isLoadingFiles: true,
              error: null,
              files: [], // Clear files immediately to prevent stale data display
              fileIds: [],
              selectedPageKeys: state.selectedPageKeys.includes(pageKey)
                ? state.selectedPageKeys
                : [pageKey],
            }));

            try {
              await get().actions.updatePageContents(pageKey, type, true);
              // Refresh pages to keep tab list up to date
              if (type !== "virtual") {
                await get().actions.fetchPages();
              }
            } catch (error) {
              console.error("Failed to load page:", error);
              set({
                error: "Failed to load page data",
                isLoadingFiles: false,
              });
            }
          },

          setSelectedPageKeys: (keys: string[]) => {
            set({ selectedPageKeys: keys });
          },

          addSelectedPageKey: (key: string) => {
            set((state) => ({
              selectedPageKeys: [...state.selectedPageKeys, key],
            }));
          },

          removeSelectedPageKey: (key: string) => {
            set((state) => ({
              selectedPageKeys: state.selectedPageKeys.filter((k) => k !== key),
            }));
          },

          setSelectedFiles: (pageKey: string, fileIds: number[]) => {
            set((state) => ({
              selectedFilesByPage: {
                ...state.selectedFilesByPage,
                [pageKey]: fileIds,
              },
            }));
          },

          addSelectedFiles: (pageKey: string, fileIds: number[]) => {
            set((state) => ({
              selectedFilesByPage: {
                ...state.selectedFilesByPage,
                [pageKey]: [
                  ...new Set([
                    ...(state.selectedFilesByPage[pageKey] || []),
                    ...fileIds,
                  ]),
                ],
              },
            }));
          },

          clearSelectedFiles: (pageKey: string) => {
            set((state) => {
              const newSelectedFiles = { ...state.selectedFilesByPage };
              delete newSelectedFiles[pageKey];
              return { selectedFilesByPage: newSelectedFiles };
            });
          },

          setActiveFileId: (pageKey: string, fileId: number | null) => {
            set((state) => ({
              activeFileByPage: {
                ...state.activeFileByPage,
                [pageKey]: fileId,
              },
            }));
          },

          addVirtualPage: (pageKey: string, page: VirtualPage) => {
            set((state) => ({
              virtualPages: {
                ...state.virtualPages,
                [pageKey]: page,
              },
              virtualPageKeys: [...state.virtualPageKeys, pageKey],
            }));
          },

          removeVirtualPage: (pageKey: string) => {
            set((state) => {
              const newVirtualPages = { ...state.virtualPages };
              delete newVirtualPages[pageKey];

              // If this was the active page, switch to search
              if (
                state.activePageKey === pageKey &&
                state.pageType === "virtual"
              ) {
                get().actions.setPage(SEARCH_PAGE_KEY, "search");
              }

              return {
                virtualPages: newVirtualPages,
                virtualPageKeys: state.virtualPageKeys.filter(
                  (key) => key !== pageKey,
                ),
              };
            });
          },

          updateVirtualPage: async (
            pageKey: string,
            updates: Partial<VirtualPage>,
          ) => {
            const state = get();
            const currentPage = state.virtualPages[pageKey];
            if (!currentPage) return;

            const updatedPage = {
              ...currentPage,
              ...updates,
            };

            set((state) => ({
              virtualPages: {
                ...state.virtualPages,
                [pageKey]: updatedPage,
              },
            }));
          },

          refreshFileMetadata: async (fileIds: number[]) => {
            try {
              const response = await client.getFileMetadata(fileIds);
              if (response.metadata.length > 0) {
                set((state) => ({
                  files: state.files.map((file) => {
                    const updatedFile = response.metadata.find(
                      (m) => m.file_id === file.file_id,
                    );
                    return updatedFile || file;
                  }),
                }));
              }
            } catch (error) {
              console.error("Failed to refresh file metadata:", error);
            }
          },

          markActiveFileAsBetter: async () => {
            const activePageKey = get().activePageKey;
            if (!activePageKey) return;
            const activeFileId = get().activeFileByPage[activePageKey];
            if (!activeFileId) return;
            const relationships: FileRelationshipPair[] = [];
            const activeFileHash = get().files.find(
              (file) => file.file_id === activeFileId,
            )?.hash;
            if (!activeFileHash) return;
            const selectedFileIds = get().selectedFilesByPage[activePageKey];
            if (!selectedFileIds) return;
            for (const selectedFileId of selectedFileIds) {
              const selectedFileHash = get().files.find(
                (file) => file.file_id === selectedFileId,
              )?.hash;
              if (!selectedFileHash) continue;
              if (selectedFileHash === activeFileHash) continue;
              relationships.push({
                hash_a: activeFileHash,
                hash_b: selectedFileHash,
                relationship: FileRelationship.A_BETTER,
                do_default_content_merge: true,
              });
            }
            await client.setFileRelationships({ relationships });
            await get().actions.refreshFileMetadata(selectedFileIds);
          },

          addFilesToPage: async (
            pageKey: string,
            pageType: PageType,
            fileIds: number[],
          ) => {
            switch (pageType) {
              case "search": {
                useSearchStore.setState({
                  searchResults: [
                    ...useSearchStore.getState().searchResults,
                    ...fileIds,
                  ],
                });
                await get().actions.updatePageContents(
                  SEARCH_PAGE_KEY,
                  "search",
                  false,
                );
                break;
              }
              case "hydrus": {
                await client.addFiles({
                  file_ids: fileIds,
                  page_key: pageKey,
                });
                await get().actions.updatePageContents(
                  pageKey,
                  "hydrus",
                  false,
                );
                break;
              }
              case "virtual": {
                set((state) => ({
                  virtualPages: {
                    ...state.virtualPages,
                    [pageKey]: {
                      ...state.virtualPages[pageKey],
                      fileIds: [
                        ...(state.virtualPages[pageKey].fileIds ?? []),
                        ...fileIds,
                      ],
                    },
                  },
                }));
                await get().actions.updatePageContents(
                  pageKey,
                  "virtual",
                  false,
                );
                break;
              }
            }
          },

          removeFilesFromPage: async (
            pageKey: string,
            pageType: PageType,
            fileIds: number[],
          ) => {
            switch (pageType) {
              case "search": {
                useSearchStore.setState({
                  searchResults: useSearchStore
                    .getState()
                    .searchResults.filter((id) => !fileIds.includes(id)),
                });
                await get().actions.updatePageContents(
                  SEARCH_PAGE_KEY,
                  "search",
                  false,
                );
                break;
              }
              case "hydrus": {
                // Can't be done yet
                break;
              }
              case "virtual": {
                const hashes = get()
                  .files.filter((file) => fileIds.includes(file.file_id))
                  .map((file) => file.hash);
                set((state) => ({
                  virtualPages: {
                    ...state.virtualPages,
                    [pageKey]: {
                      ...state.virtualPages[pageKey],
                      fileIds: state.virtualPages[pageKey].fileIds?.filter(
                        (id) => !fileIds.includes(id),
                      ),
                      hashes: state.virtualPages[pageKey].hashes?.filter(
                        (hash) => !hashes.includes(hash),
                      ),
                    },
                  },
                }));
                await get().actions.updatePageContents(
                  pageKey,
                  "virtual",
                  false,
                );
                break;
              }
            }
          },
        },
      };
    },
    {
      name: "hydrui-page-state",
      storage: jsonStorage,
      // Only persist specific keys
      partialize: (state) => ({
        pageName: state.pageName,
        selectedPageKeys: state.selectedPageKeys,
        virtualPages: state.virtualPages,
        virtualPageKeys: state.virtualPageKeys,
        pages: state.pages,
        activePageKey: state.activePageKey,
        pageType: state.pageType,
      }),
    },
  ),
);

// This is a workaround to ensure that page contents are loaded after the store is initialized.
const unsubscribe = useApiStore.subscribe((state) => {
  if (state.isAuthenticated) {
    const pageStore = usePageStore.getState();
    if (pageStore.activePageKey && pageStore.pageType) {
      pageStore.actions.updatePageContents(
        pageStore.activePageKey,
        pageStore.pageType,
        true,
      );
      unsubscribe();
    }
  }
});

useSearchStore.subscribe(() => {
  usePageStore
    .getState()
    .actions.updatePageContents(SEARCH_PAGE_KEY, "search", true);
});
