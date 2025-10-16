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

interface MetadataLoadController {
  reprioritize: (fileIds: number[]) => void;
  demandFetchMetadata: (fileIds: number[]) => Promise<FileMetadata[]>;
}

interface PageState extends PersistedState {
  fileIds: number[];
  fileIdToIndex: Map<number, number>;
  selectedFilesByPage: Record<string, number[]>;
  activeFileByPage: Record<string, number | null>;
  isLoadingFiles: boolean;
  loadedFiles: FileMetadata[];
  loadedFileCount: number;
  totalFileCount: number;
  error: string | null;
  lastRequestId: number;
  currentAbortController: AbortController | null;
  metadataLoadController: MetadataLoadController | null;
  // Actions
  actions: {
    setPage: (pageKey: string, type: PageType) => Promise<void>;
    updatePageContents: (pageKey: string, type: PageType) => Promise<void>;
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
      const getRealizedFile = async (fileId: number) => {
        const { loadedFiles, fileIdToIndex, metadataLoadController } = get();
        if (metadataLoadController) {
          return (
            await metadataLoadController.demandFetchMetadata([fileId])
          )[0];
        } else {
          const index = fileIdToIndex.get(fileId);
          if (!index) {
            return;
          }
          return loadedFiles[index];
        }
      };

      // Helper function to update state with file IDs
      const updateWithFileIds = async (
        fileIds: number[],
        pageKey: string,
        requestId: number,
      ) => {
        const state = get();
        const CHUNK_SIZE = 256;

        // Only update if we're on the same page.
        if (state.activePageKey !== pageKey) return;

        if (fileIds.length === 0) {
          set({
            isLoadingFiles: false,
            fileIds: [],
            fileIdToIndex: new Map(),
            loadedFiles: [],
            loadedFileCount: 0,
            totalFileCount: 0,
          });
          return;
        }

        const fileIdChunks: number[][] = [];
        const loadedFiles: FileMetadata[] = [];
        const fileIdToChunk = new Map<number, number[]>();
        const fileIdToIndex = new Map<number, number>();
        const chunkToPromise = new Map<
          number[],
          [Promise<void>, () => void, (reason: unknown) => void]
        >();
        for (let i = 0; i < fileIds.length; i += CHUNK_SIZE) {
          const chunk = fileIds.slice(i, i + CHUNK_SIZE);
          for (const [j, fileId] of chunk.entries()) {
            fileIdToChunk.set(fileId, chunk);
            fileIdToIndex.set(fileId, i + j);
          }
          let promiseFn: [() => void, (reason: unknown) => void];
          const promise = new Promise<void>((resolve, reject) => {
            promiseFn = [resolve, reject];
          });
          chunkToPromise.set(chunk, [promise, promiseFn![0], promiseFn![1]]);
          fileIdChunks.push(chunk);
          // In extremely huge pages, yield periodically.
          // The map will get pretty intense.
          if (fileIdChunks.length % 100 === 0) {
            await new Promise((resolve) => setTimeout(resolve, 1));
          }
          if (
            get().activePageKey !== pageKey ||
            get().lastRequestId !== requestId
          ) {
            return;
          }
        }
        const rejectUnfulfilledPromises = (reason: unknown) => {
          for (const [, [promise, , reject]] of chunkToPromise) {
            promise.catch(() => {});
            reject(reason);
          }
        };
        const reprioritizeChunks = (chunks: Set<number[]>) => {
          const chunkList = [...chunks].filter(
            // Only add chunks that are not already loaded!
            (chunk) => fileIdChunks.indexOf(chunk) !== -1,
          );
          fileIdChunks.splice(
            0,
            fileIdChunks.length,
            ...[
              ...chunkList,
              ...fileIdChunks.filter((chunk) => !chunks.has(chunk)),
            ],
          );
        };
        const getChunksForFileIDs = (fileIds: number[]) => {
          const chunks = new Set<number[]>();
          for (const fileId of fileIds) {
            const chunk = fileIdToChunk.get(fileId);
            if (chunk) {
              chunks.add(chunk);
            }
          }
          return chunks;
        };
        const waitForChunks = async (chunks: Set<number[]>) => {
          await Promise.all(
            [...chunks]
              .map((chunk) => chunkToPromise.get(chunk))
              .filter((n) => n !== undefined)
              .map(([promise]) => promise),
          );
          return;
        };
        const getRealizedFiles = (fileIds: number[]) => {
          return fileIds.map((fileId) => {
            const index = fileIdToIndex.get(fileId);
            if (index === undefined) {
              throw new Error(
                `File ID not in page: ${fileId}. This is likely a bug.`,
              );
            }
            const loadedFile = loadedFiles[index];
            if (!loadedFile) {
              throw new Error(
                `File ID unexpectedly unrealized: ${fileId}. This is likely a bug.`,
              );
            }
            return loadedFile;
          });
        };
        set({});

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
        let loadedFileCount = 0;
        set({
          error: null,
          fileIds,
          fileIdToIndex,
          isLoadingFiles: true,
          loadedFiles: [],
          loadedFileCount,
          totalFileCount: fileIds.length,
          currentAbortController: abortController,
          metadataLoadController: {
            reprioritize: (fileIds) => {
              const chunks = getChunksForFileIDs(fileIds);
              reprioritizeChunks(chunks);
            },
            demandFetchMetadata: async (fileIds) => {
              const chunks = getChunksForFileIDs(fileIds);
              reprioritizeChunks(chunks);
              await waitForChunks(chunks);
              return getRealizedFiles(fileIds);
            },
          },
        });

        try {
          // Process files in chunks
          for (
            let chunk = fileIdChunks.shift();
            chunk;
            chunk = fileIdChunks.shift()
          ) {
            const [, resolve] = chunkToPromise.get(chunk) ?? [];
            if (!resolve) {
              throw new Error(
                "Chunk promise has disappeared! Metadata refresh state is corrupted. This is a bug.",
              );
            }
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

            // Resolve promise
            resolve();
            chunkToPromise.delete(chunk);

            // Update progress
            loadedFileCount += response.metadata.length;
            for (const file of response.metadata) {
              const index = fileIdToIndex.get(file.file_id);
              if (index === undefined) {
                console.warn(
                  `Hydrus returned unexpected file ID ${file.file_id}`,
                );
                continue;
              }
              loadedFiles[index] = file;
            }
            set({
              isLoadingFiles: true,
              loadedFiles,
              loadedFileCount,
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
            loadedFiles: loadedFiles,
            loadedFileCount: fileIds.length,
            totalFileCount: fileIds.length,
            currentAbortController: null,
            metadataLoadController: null,
          });
        } catch (error: unknown) {
          // Only update error if it wasn't due to abort
          rejectUnfulfilledPromises(error);
          if (
            get().activePageKey !== pageKey ||
            get().lastRequestId !== requestId
          )
            return;
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
              metadataLoadController: null,
            });
          }
        } finally {
          rejectUnfulfilledPromises(new Error("Aborted"));
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

        // Only update if we're on the same page.
        if (state.activePageKey !== pageKey) return;

        if (hashes.length === 0) {
          set({
            fileIds: [],
            fileIdToIndex: new Map(),
            isLoadingFiles: false,
            loadedFiles: [],
            loadedFileCount: 0,
            totalFileCount: 0,
          });
          return;
        }

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
          fileIds: [],
          fileIdToIndex: new Map(),
          isLoadingFiles: true,
          loadedFiles: [],
          loadedFileCount: 0,
          totalFileCount: hashes.length,
          currentAbortController: abortController,
          metadataLoadController: null,
        });

        try {
          const loadedFiles: FileMetadata[] = [];

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
            loadedFiles.push(...response.metadata);
            if (get().activePageKey === pageKey) {
              set({ loadedFileCount: Math.min(i + CHUNK_SIZE, hashes.length) });
            }
          }

          // Only update if we're still on the same page and this is the most recent request
          if (
            get().activePageKey === pageKey &&
            get().lastRequestId === requestId
          ) {
            const fileIds = loadedFiles.map((m) => m.file_id);
            const fileIdToIndex = new Map<number, number>();
            for (const [i, fileId] of fileIds.entries()) {
              fileIdToIndex.set(fileId, i);
            }
            set({
              fileIds,
              fileIdToIndex,
              isLoadingFiles: false,
              loadedFiles,
              loadedFileCount: hashes.length,
              totalFileCount: hashes.length,
              currentAbortController: null,
              metadataLoadController: null,
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
                metadataLoadController: null,
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
        fileIdToIndex: new Map(),
        selectedFilesByPage: {},
        activeFileByPage: {},
        isLoadingFiles: false,
        loadedFiles: [],
        loadedFileCount: 0,
        totalFileCount: 0,
        error: null,
        lastRequestId: 0,
        currentAbortController: null,
        metadataLoadController: null,

        actions: {
          fetchPages: async () => {
            try {
              const response = await client.getPages();

              set({ pages: response.pages.pages ?? [] });

              // If we don't have an active page yet, use the first API page or the search page
              const { activePageKey } = get();
              if (
                !activePageKey &&
                response.pages.pages &&
                response.pages.pages.length > 0 &&
                response.pages.pages[0]
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

          updatePageContents: async (pageKey: string, type: PageType) => {
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

            await get().actions.updatePageContents(pageKey, type);
          },

          cancelCurrentPageLoad: () => {
            const state = get();
            if (state.currentAbortController) {
              state.currentAbortController.abort();
            }
            if (!state.isLoadingFiles) {
              return;
            }
            const loadedFiles = Object.values(state.loadedFiles);
            const fileIdToIndex = new Map<number, number>();
            for (const [i, file] of loadedFiles.entries()) {
              fileIdToIndex.set(file.file_id, i);
            }
            set({
              fileIds: loadedFiles.map((file) => file.file_id),
              fileIdToIndex,
              isLoadingFiles: false,
              loadedFiles,
              loadedFileCount: loadedFiles.length,
              totalFileCount: loadedFiles.length,
              lastRequestId: state.lastRequestId + 1,
              currentAbortController: null,
              metadataLoadController: null,
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

              const fileIdToIndex = new Map(state.fileIdToIndex);
              for (const [i, fileId] of newFileIds.entries()) {
                fileIdToIndex.set(fileId, i + state.fileIds.length);
              }

              set((state) => ({
                fileIds: [...state.fileIds, ...newFileIds],
                fileIdToIndex,
                isLoadingFiles: false,
                loadedFiles: [...state.loadedFiles, ...metadata.metadata],
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
            const fileIdToIndex = new Map(get().fileIdToIndex);
            for (const fileId of fileIds) {
              fileIdToIndex.delete(fileId);
            }
            set((state) => ({
              fileIds: state.fileIds.filter((id) => !fileIds.includes(id)),
              loadedFiles: state.loadedFiles.filter(
                (file) => !fileIds.includes(file.file_id),
              ),
              fileIdToIndex,
            }));
          },

          setPage: async (pageKey: string, type: PageType) => {
            // Validate virtual page exists if type is virtual
            if (type === "virtual" && !get().virtualPages[pageKey]) {
              set({ error: "Virtual page not found" });
              return;
            }

            set((state) => ({
              fileIds: [],
              fileIdToIndex: new Map(),
              activePageKey: pageKey,
              pageType: type,
              error: null,
              isLoadingFiles: true,
              loadedFiles: [],
              selectedPageKeys: state.selectedPageKeys.includes(pageKey)
                ? state.selectedPageKeys
                : [pageKey],
            }));

            try {
              await get().actions.updatePageContents(pageKey, type);
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
                  loadedFiles: state.loadedFiles.map((file) => {
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
            const activeFileHash = (await getRealizedFile(activeFileId))?.hash;
            if (!activeFileHash) return;
            const selectedFileIds = get().selectedFilesByPage[activePageKey];
            if (!selectedFileIds) return;
            for (const selectedFileId of selectedFileIds) {
              const selectedFileHash = (await getRealizedFile(selectedFileId))
                ?.hash;
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
                );
                break;
              }
              case "hydrus": {
                await client.addFiles({
                  file_ids: fileIds,
                  page_key: pageKey,
                });
                await get().actions.updatePageContents(pageKey, "hydrus");
                break;
              }
              case "virtual": {
                set((state) => {
                  if (!state.virtualPages[pageKey]) {
                    console.warn(
                      `Tried to add files to invalid page: ${pageKey}`,
                    );
                    return {};
                  }
                  return {
                    virtualPages: {
                      ...state.virtualPages,
                      [pageKey]: {
                        ...state.virtualPages[pageKey],
                        fileIds: [
                          ...(state.virtualPages[pageKey]?.fileIds ?? []),
                          ...fileIds,
                        ],
                      },
                    },
                  };
                });
                await get().actions.updatePageContents(pageKey, "virtual");
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
                );
                break;
              }
              case "hydrus": {
                // Can't be done yet
                break;
              }
              case "virtual": {
                const hashes = get()
                  .loadedFiles.filter((file) => fileIds.includes(file.file_id))
                  .map((file) => file.hash);
                set((state) => {
                  const setState: Partial<PageState> = {
                    virtualPages: { ...state.virtualPages },
                  };
                  const page = setState.virtualPages?.[pageKey];
                  if (!page) {
                    return {};
                  }
                  if (page.fileIds) {
                    page.fileIds = page.fileIds.filter(
                      (id) => !fileIds.includes(id),
                    );
                  }
                  if (page.hashes) {
                    page.hashes = page.hashes.filter(
                      (hash) => !hashes.includes(hash),
                    );
                  }
                  return setState;
                });
                await get().actions.updatePageContents(pageKey, "virtual");
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
      );
      unsubscribe();
    }
  }
});

useSearchStore.subscribe(() => {
  usePageStore.getState().actions.updatePageContents(SEARCH_PAGE_KEY, "search");
});
