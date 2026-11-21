import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SortFilesBy } from "@/constants/sort";

import { client } from "./apiStore";
import { SEARCH_PAGE_KEY, usePageStore } from "./pageStore";
import { usePreferencesStore } from "./preferencesStore";
import { useSearchStore } from "./searchStore";

function metadataResponse(fileIds: number[]) {
  return {
    version: 1,
    hydrus_version: 1,
    metadata: fileIds.map((fileId) => ({
      file_id: fileId,
      hash: `hash-${fileId}`,
    })),
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function flushMicrotasks() {
  for (let i = 0; i < 6; i++) {
    await Promise.resolve();
  }
}

function resetPageStore() {
  usePageStore.setState({
    fileIds: [],
    fileIdToIndex: new Map(),
    loadedFiles: [],
    loadedFileCount: 0,
    totalFileCount: 0,
    isLoadingFiles: false,
    isLoadingPaused: false,
    isLoadingAwake: false,
    lastRequestId: 0,
    currentAbortController: null,
    metadataLoadController: null,
    error: null,
    activePageKey: null,
    pageType: "search",
    virtualPages: {},
    virtualPageKeys: [],
    eagerLoadPageKeys: [],
  });
}

describe("pageStore refreshPage", () => {
  beforeEach(() => {
    resetPageStore();
    usePreferencesStore.setState({ eagerLoadThreshold: 20000 });
    useSearchStore.setState({
      searchTags: ["inbox"],
      searchSort: SortFilesBy.IMPORT_TIME,
      searchAscending: false,
      searchResults: [],
      searchStatus: "initial",
      searchError: null,
      autoSearch: false,
      cancelSearch: null,
      serial: 0,
    });
  });

  afterEach(() => {
    usePageStore.getState().actions.cancelCurrentPageLoad();
    vi.restoreAllMocks();
  });

  it("reruns the current search and awaits metadata loading on refresh", async () => {
    const searchFiles = vi.spyOn(client, "searchFiles").mockResolvedValue({
      version: 1,
      hydrus_version: 1,
      file_ids: [101, 102],
    });
    const getFileMetadata = vi
      .spyOn(client, "getFileMetadata")
      .mockResolvedValue(metadataResponse([101, 102]));
    useSearchStore.setState({
      searchTags: ["character:test"],
      searchResults: [1],
      searchStatus: "loaded",
      autoSearch: false,
    });
    usePageStore.setState({
      activePageKey: SEARCH_PAGE_KEY,
      pageType: "search",
    });

    await usePageStore
      .getState()
      .actions.refreshPage(SEARCH_PAGE_KEY, "search");

    expect(searchFiles).toHaveBeenCalledTimes(1);
    expect(searchFiles).toHaveBeenCalledWith(
      {
        tags: ["character:test"],
        file_sort_type: SortFilesBy.IMPORT_TIME,
        file_sort_asc: false,
      },
      expect.anything(),
    );
    expect(getFileMetadata).toHaveBeenCalledWith([101, 102], expect.anything());
    expect(usePageStore.getState().fileIds).toEqual([101, 102]);
    expect(usePageStore.getState().loadedFileCount).toBe(2);
    expect(usePageStore.getState().isLoadingFiles).toBe(false);
  });

  it("preserves manually added files on the search page when searchTags is empty", async () => {
    const searchFiles = vi.spyOn(client, "searchFiles");
    const getFileMetadata = vi
      .spyOn(client, "getFileMetadata")
      .mockResolvedValue(metadataResponse([42, 43]));
    useSearchStore.setState({
      searchTags: [],
      searchResults: [42, 43],
      searchStatus: "initial",
    });
    usePageStore.setState({
      activePageKey: SEARCH_PAGE_KEY,
      pageType: "search",
    });

    await usePageStore
      .getState()
      .actions.refreshPage(SEARCH_PAGE_KEY, "search");

    expect(searchFiles).not.toHaveBeenCalled();
    expect(getFileMetadata).toHaveBeenCalledWith([42, 43], expect.anything());
    expect(usePageStore.getState().fileIds).toEqual([42, 43]);
    expect(useSearchStore.getState().searchResults).toEqual([42, 43]);
  });

  it("condenses sparse loadedFiles and clears paused state before searching on refresh", async () => {
    usePreferencesStore.setState({ eagerLoadThreshold: 300 });
    useSearchStore.setState({
      searchTags: ["inbox"],
      searchResults: Array.from({ length: 700 }, (_, i) => i + 1),
      searchStatus: "loaded",
    });
    vi.spyOn(client, "getFileMetadata").mockImplementation(async (fileIds) =>
      metadataResponse(fileIds),
    );
    usePageStore.setState({
      activePageKey: SEARCH_PAGE_KEY,
      pageType: "search",
    });
    const initialLoad = usePageStore
      .getState()
      .actions.updatePageContents(SEARCH_PAGE_KEY, "search");
    await vi.waitFor(() =>
      expect(usePageStore.getState().isLoadingPaused).toBe(true),
    );

    // Fetch a later chunk out of order so loadedFiles has sparse holes.
    await usePageStore
      .getState()
      .metadataLoadController!.demandFetchMetadata([700]);
    expect(usePageStore.getState().loadedFiles[300]).toBeUndefined();

    const searchDeferred = deferred<{
      version: number;
      hydrus_version: number;
      file_ids: number[];
    }>();
    vi.spyOn(client, "searchFiles").mockReturnValue(searchDeferred.promise);

    const refreshPromise = usePageStore
      .getState()
      .actions.refreshPage(SEARCH_PAGE_KEY, "search");
    await initialLoad;

    const midState = usePageStore.getState();
    expect(midState.isLoadingPaused).toBe(false);
    expect(midState.isLoadingFiles).toBe(false);
    expect(midState.metadataLoadController).toBeNull();
    expect(midState.loadedFiles.length).toBe(midState.loadedFileCount);
    expect(midState.fileIds.length).toBe(midState.loadedFileCount);
    expect(midState.totalFileCount).toBe(midState.loadedFileCount);
    for (const [index, file] of midState.loadedFiles.entries()) {
      expect(file).toBeDefined();
      expect(midState.fileIdToIndex.get(file.file_id)).toBe(index);
    }

    searchDeferred.resolve({
      version: 1,
      hydrus_version: 1,
      file_ids: [9, 10],
    });
    await refreshPromise;

    expect(usePageStore.getState().fileIds).toEqual([9, 10]);
    expect(usePageStore.getState().isLoadingFiles).toBe(false);
  });

  it("keeps dense counts intact when performSearch starts from an already-loaded search page", async () => {
    usePreferencesStore.setState({ eagerLoadThreshold: 300 });
    useSearchStore.setState({
      searchTags: ["inbox"],
      searchResults: [1, 2],
      searchStatus: "loaded",
    });
    vi.spyOn(client, "getFileMetadata").mockImplementation(async (fileIds) =>
      metadataResponse(fileIds),
    );
    usePageStore.setState({
      activePageKey: SEARCH_PAGE_KEY,
      pageType: "search",
    });
    await usePageStore
      .getState()
      .actions.updatePageContents(SEARCH_PAGE_KEY, "search");

    const searchDeferred = deferred<{
      version: number;
      hydrus_version: number;
      file_ids: number[];
    }>();
    vi.spyOn(client, "searchFiles").mockReturnValue(searchDeferred.promise);

    const searchPromise = useSearchStore.getState().actions.performSearch();

    // Dense counts stay in sync with retained loadedFiles while searching.
    expect(usePageStore.getState().loadedFileCount).toBe(2);
    expect(usePageStore.getState().totalFileCount).toBe(2);
    expect(usePageStore.getState().isLoadingFiles).toBe(false);
    expect(usePageStore.getState().isLoadingPaused).toBe(false);

    searchDeferred.resolve({
      version: 1,
      hydrus_version: 1,
      file_ids: [3],
    });
    await searchPromise;
    await vi.waitFor(() =>
      expect(usePageStore.getState().fileIds).toEqual([3]),
    );
  });

  it("stops a paused search load when a new search starts directly via performSearch", async () => {
    usePreferencesStore.setState({ eagerLoadThreshold: 300 });
    useSearchStore.setState({
      searchTags: ["inbox"],
      searchResults: Array.from({ length: 700 }, (_, i) => i + 1),
      searchStatus: "loaded",
    });
    vi.spyOn(client, "getFileMetadata").mockImplementation(async (fileIds) =>
      metadataResponse(fileIds),
    );
    usePageStore.setState({
      activePageKey: SEARCH_PAGE_KEY,
      pageType: "search",
    });
    const initialLoad = usePageStore
      .getState()
      .actions.updatePageContents(SEARCH_PAGE_KEY, "search");
    await vi.waitFor(() =>
      expect(usePageStore.getState().isLoadingPaused).toBe(true),
    );

    const searchDeferred = deferred<{
      version: number;
      hydrus_version: number;
      file_ids: number[];
    }>();
    vi.spyOn(client, "searchFiles").mockReturnValue(searchDeferred.promise);

    useSearchStore.getState().actions.setSearchTags(["rating:safe"]);
    const searchPromise = useSearchStore.getState().actions.performSearch();
    await initialLoad;

    expect(usePageStore.getState().isLoadingFiles).toBe(false);
    expect(usePageStore.getState().isLoadingPaused).toBe(false);
    expect(usePageStore.getState().metadataLoadController).toBeNull();

    searchDeferred.resolve({
      version: 1,
      hydrus_version: 1,
      file_ids: [5, 6],
    });
    await searchPromise;
    await vi.waitFor(() =>
      expect(usePageStore.getState().fileIds).toEqual([5, 6]),
    );
  });

  it("ignores search refresh when another page is active", async () => {
    const searchFiles = vi.spyOn(client, "searchFiles");
    usePageStore.setState({
      activePageKey: "page-1",
      pageType: "hydrus",
    });

    await usePageStore
      .getState()
      .actions.refreshPage(SEARCH_PAGE_KEY, "search");

    expect(searchFiles).not.toHaveBeenCalled();
  });

  it("refreshes a paused Hydrus page end-to-end, waking the previous load and reloading metadata", async () => {
    usePreferencesStore.setState({ eagerLoadThreshold: 300 });
    vi.spyOn(client, "getFileMetadata").mockImplementation(async (fileIds) =>
      metadataResponse(fileIds),
    );
    const getPageInfo = vi.spyOn(client, "getPageInfo").mockResolvedValueOnce({
      version: 1,
      hydrus_version: 1,
      page_info: {
        name: "Inbox",
        page_key: "page-1",
        page_state: 0,
        page_type: 0,
        is_media_page: true,
        media: {
          num_files: 700,
          hash_ids: Array.from({ length: 700 }, (_, i) => i + 1),
        },
      },
    });
    usePageStore.setState({
      activePageKey: "page-1",
      pageType: "hydrus",
    });

    const initialLoad = usePageStore
      .getState()
      .actions.updatePageContents("page-1", "hydrus");
    await vi.waitFor(() =>
      expect(usePageStore.getState().isLoadingPaused).toBe(true),
    );

    const refreshDeferred = deferred<void>();
    const refreshPage = vi
      .spyOn(client, "refreshPage")
      .mockReturnValue(refreshDeferred.promise);
    getPageInfo.mockResolvedValue({
      version: 1,
      hydrus_version: 1,
      page_info: {
        name: "Inbox",
        page_key: "page-1",
        page_state: 0,
        page_type: 0,
        is_media_page: true,
        media: { num_files: 2, hash_ids: [1, 2] },
      },
    });

    const refreshPromise = usePageStore
      .getState()
      .actions.refreshPage("page-1", "hydrus");
    await initialLoad;

    expect(usePageStore.getState().isLoadingPaused).toBe(false);
    expect(usePageStore.getState().isLoadingAwake).toBe(true);

    refreshDeferred.resolve();
    await refreshPromise;

    expect(refreshPage).toHaveBeenCalledWith("page-1");
    expect(usePageStore.getState().fileIds).toEqual([1, 2]);
    expect(usePageStore.getState().loadedFileCount).toBe(2);
    expect(usePageStore.getState().isLoadingFiles).toBe(false);
    expect(usePageStore.getState().isLoadingPaused).toBe(false);
  });

  it("refreshes virtual page metadata from its existing file IDs without searching", async () => {
    const searchFiles = vi.spyOn(client, "searchFiles");
    const getFileMetadata = vi
      .spyOn(client, "getFileMetadata")
      .mockResolvedValue(metadataResponse([7, 8]));
    usePageStore.setState({
      activePageKey: "virtual-1",
      pageType: "virtual",
      virtualPages: {
        "virtual-1": { name: "Manual", fileIds: [7, 8] },
      },
    });

    await usePageStore.getState().actions.refreshPage("virtual-1", "virtual");

    expect(searchFiles).not.toHaveBeenCalled();
    expect(getFileMetadata).toHaveBeenCalledWith([7, 8], expect.anything());
    expect(usePageStore.getState().fileIds).toEqual([7, 8]);
    expect(usePageStore.getState().virtualPages["virtual-1"]?.fileIds).toEqual([
      7, 8,
    ]);
  });
});

describe("pageStore eager metadata loading", () => {
  const FILE_COUNT = 700;
  const THRESHOLD = 300;

  beforeEach(() => {
    resetPageStore();
    usePreferencesStore.setState({ eagerLoadThreshold: THRESHOLD });
    useSearchStore.setState({
      searchTags: ["inbox"],
      searchResults: Array.from(
        { length: FILE_COUNT },
        (_, index) => index + 1,
      ),
      searchStatus: "loaded",
      autoSearch: false,
      cancelSearch: null,
      serial: 0,
    });
    vi.spyOn(client, "getFileMetadata").mockImplementation(async (fileIds) =>
      metadataResponse(fileIds),
    );
  });

  afterEach(() => {
    usePageStore.getState().actions.cancelCurrentPageLoad();
    vi.restoreAllMocks();
  });

  function startLoading(pageKey = SEARCH_PAGE_KEY) {
    usePageStore.setState({
      activePageKey: pageKey,
      pageType: pageKey === SEARCH_PAGE_KEY ? "search" : "virtual",
    });
    return usePageStore
      .getState()
      .actions.updatePageContents(
        pageKey,
        pageKey === SEARCH_PAGE_KEY ? "search" : "virtual",
      );
  }

  it("loads up to a non-chunk-aligned threshold, then pauses the rest", async () => {
    const loadPromise = startLoading();

    await vi.waitFor(() => {
      expect(usePageStore.getState().isLoadingPaused).toBe(true);
      expect(usePageStore.getState().isLoadingAwake).toBe(false);
    });
    expect(usePageStore.getState().loadedFileCount).toBe(THRESHOLD);

    await flushMicrotasks();
    expect(usePageStore.getState().loadedFileCount).toBe(THRESHOLD);

    usePageStore.getState().actions.cancelCurrentPageLoad();
    await loadPromise;
  });

  it("pauses immediately at 0 files when eagerLoadThreshold is 0 and supports on-demand fetch", async () => {
    usePreferencesStore.setState({ eagerLoadThreshold: 0 });
    const loadPromise = startLoading();

    await flushMicrotasks();
    expect(usePageStore.getState().isLoadingPaused).toBe(true);
    expect(usePageStore.getState().isLoadingAwake).toBe(false);
    expect(usePageStore.getState().loadedFileCount).toBe(0);
    expect(client.getFileMetadata).not.toHaveBeenCalled();

    const demanded = await usePageStore
      .getState()
      .metadataLoadController!.demandFetchMetadata([1]);
    expect(demanded).toHaveLength(1);
    expect(demanded[0]?.file_id).toBe(1);
    await vi.waitFor(() =>
      expect(usePageStore.getState().isLoadingAwake).toBe(false),
    );
    expect(usePageStore.getState().isLoadingPaused).toBe(true);
    expect(usePageStore.getState().loadedFileCount).toBeGreaterThan(0);
    expect(usePageStore.getState().loadedFileCount).toBeLessThan(FILE_COUNT);
    expect(usePageStore.getState().loadedFiles[0]?.file_id).toBe(1);

    usePageStore.getState().actions.cancelCurrentPageLoad();
    await loadPromise;
  });

  it("completes without pausing when file count equals eagerLoadThreshold", async () => {
    useSearchStore.setState({
      searchResults: Array.from({ length: THRESHOLD }, (_, index) => index + 1),
    });

    await startLoading();

    expect(usePageStore.getState().loadedFileCount).toBe(THRESHOLD);
    expect(usePageStore.getState().isLoadingFiles).toBe(false);
    expect(usePageStore.getState().isLoadingPaused).toBe(false);
    expect(usePageStore.getState().isLoadingAwake).toBe(false);
  });

  it("loads the rest and remembers the page when resumed", async () => {
    const loadPromise = startLoading();
    await vi.waitFor(() =>
      expect(usePageStore.getState().isLoadingPaused).toBe(true),
    );

    usePageStore.getState().actions.setIsLoadingPaused(false);
    await loadPromise;

    expect(usePageStore.getState().loadedFileCount).toBe(FILE_COUNT);
    expect(usePageStore.getState().isLoadingFiles).toBe(false);
    expect(usePageStore.getState().isLoadingPaused).toBe(false);
    expect(usePageStore.getState().eagerLoadPageKeys).toEqual([
      SEARCH_PAGE_KEY,
    ]);
  });

  it("does not pause a remembered page on the next load", async () => {
    usePageStore.setState({ eagerLoadPageKeys: [SEARCH_PAGE_KEY] });

    await startLoading();

    expect(usePageStore.getState().loadedFileCount).toBe(FILE_COUNT);
    expect(usePageStore.getState().isLoadingFiles).toBe(false);
    expect(usePageStore.getState().isLoadingPaused).toBe(false);
  });

  it("forgets SEARCH_PAGE_KEY when searchTags changes", () => {
    usePageStore.setState({ eagerLoadPageKeys: [SEARCH_PAGE_KEY, "page-1"] });

    useSearchStore.getState().actions.setSearchTags(["rating:safe"]);

    expect(usePageStore.getState().eagerLoadPageKeys).toEqual(["page-1"]);
  });

  it("manages remembered page keys on pause, small-page resume, virtual delete, clear, and cap", () => {
    usePageStore.setState({
      activePageKey: "small-page",
      totalFileCount: THRESHOLD,
      eagerLoadPageKeys: [],
    });
    usePageStore.getState().actions.setIsLoadingPaused(false);
    expect(usePageStore.getState().eagerLoadPageKeys).toEqual([]);

    for (let i = 1; i <= 55; i++) {
      usePageStore.setState({
        activePageKey: `page-${i}`,
        totalFileCount: THRESHOLD + 1,
      });
      usePageStore.getState().actions.setIsLoadingPaused(false);
    }

    const keys = usePageStore.getState().eagerLoadPageKeys;
    expect(keys.length).toBeGreaterThan(0);
    expect(keys.length).toBeLessThan(55);
    expect(keys).not.toContain("page-1");
    expect(keys[keys.length - 1]).toBe("page-55");

    usePageStore.setState({ activePageKey: "page-55", isLoadingFiles: false });
    usePageStore.getState().actions.setIsLoadingPaused(true);
    expect(usePageStore.getState().isLoadingPaused).toBe(false);
    expect(usePageStore.getState().eagerLoadPageKeys).not.toContain("page-55");

    usePageStore.setState({
      virtualPages: { "page-10": { name: "Temp", fileIds: [1] } },
      virtualPageKeys: ["page-10"],
    });
    usePageStore.getState().actions.removeVirtualPage("page-10");
    expect(usePageStore.getState().eagerLoadPageKeys).not.toContain("page-10");

    usePageStore.getState().actions.clearEagerLoadPageKeys();
    expect(usePageStore.getState().eagerLoadPageKeys).toEqual([]);
  });

  it("clears isLoadingPaused when remaining chunks drain via on-demand fetch", async () => {
    const loadPromise = startLoading();
    await vi.waitFor(() =>
      expect(usePageStore.getState().isLoadingPaused).toBe(true),
    );

    const remainingIds = Array.from(
      { length: FILE_COUNT - THRESHOLD },
      (_, i) => THRESHOLD + i + 1,
    );
    await usePageStore
      .getState()
      .metadataLoadController!.demandFetchMetadata(remainingIds);
    await loadPromise;

    expect(usePageStore.getState().loadedFileCount).toBe(FILE_COUNT);
    expect(usePageStore.getState().isLoadingFiles).toBe(false);
    expect(usePageStore.getState().isLoadingPaused).toBe(false);
    expect(usePageStore.getState().isLoadingAwake).toBe(false);
    expect(usePageStore.getState().metadataLoadController).toBeNull();
  });

  it("clears isLoadingPaused and condenses sparse loadedFiles when a metadata fetch fails after pausing", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const loadPromise = startLoading();
    await vi.waitFor(() =>
      expect(usePageStore.getState().isLoadingPaused).toBe(true),
    );

    // Load the tail chunk out of order so loadedFiles has sparse holes.
    await usePageStore
      .getState()
      .metadataLoadController!.demandFetchMetadata([FILE_COUNT]);
    expect(usePageStore.getState().loadedFiles[THRESHOLD]).toBeUndefined();

    vi.spyOn(client, "getFileMetadata").mockRejectedValueOnce(
      new Error("Network failure"),
    );

    const demandPromise = usePageStore
      .getState()
      .metadataLoadController!.demandFetchMetadata([THRESHOLD + 1]);
    await expect(demandPromise).rejects.toThrow("Network failure");
    await loadPromise;

    const state = usePageStore.getState();
    expect(state.error).toBe("Failed to load file data");
    expect(state.isLoadingFiles).toBe(false);
    expect(state.isLoadingPaused).toBe(false);
    expect(state.isLoadingAwake).toBe(false);
    expect(state.metadataLoadController).toBeNull();
    expect(state.loadedFiles.length).toBe(state.loadedFileCount);
    expect(state.fileIds.length).toBe(state.loadedFileCount);
    expect(state.totalFileCount).toBe(state.loadedFileCount);
    for (const file of state.loadedFiles) {
      expect(file).toBeDefined();
    }
    consoleError.mockRestore();
  });

  it("clears paused state and dead controllers when switching to a failing Hydrus page", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const loadPromise = startLoading();
    await vi.waitFor(() =>
      expect(usePageStore.getState().isLoadingPaused).toBe(true),
    );

    const pageInfoDeferred = deferred<never>();
    vi.spyOn(client, "getPageInfo").mockReturnValue(pageInfoDeferred.promise);

    const switchPromise = usePageStore
      .getState()
      .actions.setPage("hydrus-2", "hydrus");
    await loadPromise;

    // While getPageInfo is pending, stale paused state must already be cleared.
    expect(usePageStore.getState().isLoadingPaused).toBe(false);
    expect(usePageStore.getState().metadataLoadController).toBeNull();
    expect(usePageStore.getState().loadedFileCount).toBe(0);
    expect(usePageStore.getState().totalFileCount).toBe(0);

    pageInfoDeferred.reject(new Error("Hydrus unavailable"));
    await switchPromise;

    expect(usePageStore.getState().error).toBe("Failed to load page data");
    expect(usePageStore.getState().isLoadingFiles).toBe(false);
    expect(usePageStore.getState().isLoadingPaused).toBe(false);
    expect(usePageStore.getState().isLoadingAwake).toBe(false);
    expect(usePageStore.getState().metadataLoadController).toBeNull();
    consoleError.mockRestore();
  });

  it("cancels a paused load cleanly and rejects pending demandFetchMetadata promises", async () => {
    const loadPromise = startLoading();
    await vi.waitFor(() => {
      expect(usePageStore.getState().isLoadingPaused).toBe(true);
      expect(usePageStore.getState().isLoadingAwake).toBe(false);
    });

    const slowFetch = deferred<ReturnType<typeof metadataResponse>>();
    vi.spyOn(client, "getFileMetadata").mockReturnValueOnce(slowFetch.promise);
    const demandPromise = usePageStore
      .getState()
      .metadataLoadController!.demandFetchMetadata([THRESHOLD + 1]);
    await vi.waitFor(() =>
      expect(usePageStore.getState().isLoadingAwake).toBe(true),
    );
    const fetches = vi.mocked(client.getFileMetadata).mock.calls.length;

    usePageStore.getState().actions.cancelCurrentPageLoad();
    slowFetch.reject(
      Object.assign(new Error("Aborted"), { name: "AbortError" }),
    );
    await expect(demandPromise).rejects.toThrow("Aborted");
    await loadPromise;

    expect(usePageStore.getState().isLoadingFiles).toBe(false);
    expect(usePageStore.getState().isLoadingPaused).toBe(false);
    expect(usePageStore.getState().isLoadingAwake).toBe(false);
    expect(usePageStore.getState().eagerLoadPageKeys).toEqual([]);
    await flushMicrotasks();
    expect(vi.mocked(client.getFileMetadata).mock.calls.length).toBe(fetches);

    // Calling cancel again when idle keeps isLoadingAwake false.
    usePageStore.getState().actions.cancelCurrentPageLoad();
    expect(usePageStore.getState().isLoadingAwake).toBe(false);
  });

  it("wakes and settles a paused load when switching to an empty page", async () => {
    const loadPromise = startLoading();
    await vi.waitFor(() =>
      expect(usePageStore.getState().isLoadingPaused).toBe(true),
    );

    usePageStore.setState({
      virtualPages: { "empty-virtual": { name: "Empty", fileIds: [] } },
    });
    await usePageStore.getState().actions.setPage("empty-virtual", "virtual");
    await loadPromise;

    expect(usePageStore.getState().isLoadingFiles).toBe(false);
    expect(usePageStore.getState().isLoadingPaused).toBe(false);
    expect(usePageStore.getState().isLoadingAwake).toBe(false);
    expect(usePageStore.getState().metadataLoadController).toBeNull();
  });
});
