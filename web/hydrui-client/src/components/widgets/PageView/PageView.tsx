import {
  ArchiveBoxIcon,
  ArchiveBoxXMarkIcon,
  ArrowPathIcon,
  ArrowTopRightOnSquareIcon,
  ArrowUpTrayIcon,
  ArrowUturnDownIcon,
  DocumentIcon,
  ExclamationCircleIcon,
  LinkIcon,
  MagnifyingGlassIcon,
  MinusCircleIcon,
  PencilSquareIcon,
  PlusIcon,
  ShareIcon,
  TagIcon,
  TrashIcon,
  WrenchScrewdriverIcon,
} from "@heroicons/react/24/outline";
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ErrorBoundary } from "react-error-boundary";

import { FileMetadata } from "@/api/types";
import BatchAutoTagModal from "@/components/modals/BatchAutoTagModal/BatchAutoTagModal";
import ConfirmModal from "@/components/modals/ConfirmModal/ConfirmModal";
import EditNotesModal from "@/components/modals/EditNotesModal/EditNotesModal";
import EditTagsModal from "@/components/modals/EditTagsModal/EditTagsModal";
import EditUrlsModal from "@/components/modals/EditUrlsModal/EditUrlsModal";
import FileViewerModal from "@/components/modals/FileViewerModal/FileViewerModal";
import ImportUrlsModal from "@/components/modals/ImportUrlsModal/ImportUrlsModal";
import TokenPassingModal from "@/components/modals/TokenPassingModal/TokenPassingModal";
import Crash from "@/components/widgets/Crash/Crash";
import ScrollView from "@/components/widgets/ScrollView/ScrollView";
import { renderDispatch } from "@/file/renderers";
import { useContextMenu } from "@/hooks/useContextMenu";
import useLongPress from "@/hooks/useLongPress";
import { useShortcut } from "@/hooks/useShortcut";
import { client } from "@/store/apiStore";
import { MenuItem, useContextMenuStore } from "@/store/contextMenuStore";
import { usePageStore } from "@/store/pageStore";
import { usePreferencesStore } from "@/store/preferencesStore";
import { useSearchStore } from "@/store/searchStore";
import { useToastStore } from "@/store/toastStore";
import { isServerMode } from "@/utils/modes";

import { SearchBar } from "./SearchBar";
import { Thumbnail } from "./Thumbnail";
import "./index.css";

// Defines the amount of "scroll slack" used to compute item visibility for the
// render view. This combats scroll jank at the cost of making rendering more
// expensive.
const SCROLL_SLACK = 200;

// Referentially stable empty array.
const EMPTY_ARRAY: never[] = [];

interface PageViewProps {
  pageKey: string;
}

const PageViewImpl: React.FC<PageViewProps> = ({ pageKey }) => {
  const {
    actions: {
      addVirtualPage,
      setPage,
      setSelectedFiles,
      addSelectedFiles,
      clearSelectedFiles,
      updatePageContents,
      refreshPage,
      setActiveFileId,
      markActiveFileAsBetter,
      addFilesToPage,
      removeFilesFromPage,
      archiveFiles,
      unarchiveFiles,
      deleteFiles,
      undeleteFiles,
    },
    selectedFilesByPage,
    activeFileByPage,
    fileIds,
    fileIdToIndex,
    loadedFiles,
    metadataLoadController,
    isLoadingFiles,
    error,
    pageType,
  } = usePageStore();

  const { thumbnailSize, useVirtualViewport, allowTokenPassing } =
    usePreferencesStore();

  const {
    actions: { addToast, removeToast, updateToastProgress },
  } = useToastStore();
  const { searchStatus, searchTags, searchError } = useSearchStore();
  const { showContextMenu } = useContextMenu();

  const gridRef = useRef<HTMLDivElement>(null);
  const [, setFocusedFileId] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const inverseSelection = useRef(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [dragEnd, setDragEnd] = useState<{ x: number; y: number } | null>(null);
  const dragStartSelectionRef = useRef<number[]>([]);

  // Modal state
  const [modalIndex, setModalIndex] = useState<number>(-1);
  const [showEditTagsModal, setShowEditTagsModal] = useState(false);
  const [showEditUrlsModal, setShowEditUrlsModal] = useState(false);
  const [showEditNotesModal, setShowEditNotesModal] = useState(false);
  const [showImportUrlsModal, setShowImportUrlsModal] = useState(false);
  const [showTokenPassingModal, setShowTokenPassingModal] = useState(false);
  const [showBatchAutotagModal, setShowBatchAutotagModal] = useState(false);
  const [showConfirmDeleteModal, setShowConfirmDeleteModal] = useState(false);
  const [tagEditFiles, setTagEditFiles] = useState<FileMetadata[]>([]);
  const [urlEditFiles, setUrlEditFiles] = useState<FileMetadata[]>([]);
  const [batchAutotagFiles, setBatchAutotagFiles] = useState<FileMetadata[]>(
    [],
  );
  const [editNotesFile, setEditNotesFile] = useState<FileMetadata | null>(null);
  const [deleteFileIds, setDeleteFileIds] = useState<number[]>([]);
  const inModal =
    modalIndex !== -1 ||
    showEditTagsModal ||
    showEditUrlsModal ||
    showEditNotesModal ||
    showImportUrlsModal ||
    showTokenPassingModal ||
    showBatchAutotagModal ||
    showConfirmDeleteModal;
  const [renderView, setRenderView] = useState({
    firstIndex: 0,
    lastIndex: fileIds.length,
    topRows: 0,
    bottomRows: 0,
    viewHeight: 0,
  });

  const selectedFiles = selectedFilesByPage[pageKey] || EMPTY_ARRAY;
  const activeFileId = activeFileByPage[pageKey];

  const archiveFilesById = useCallback(
    async (files: number[]) => {
      try {
        await archiveFiles(files);
      } catch (e) {
        addToast(`Error archiving files: ${e}`, "error");
      }
    },
    [addToast, archiveFiles],
  );

  const unarchiveFilesById = useCallback(
    async (files: number[]) => {
      try {
        await unarchiveFiles(files);
      } catch (e) {
        addToast(`Error unarchiving files: ${e}`, "error");
      }
    },
    [addToast, unarchiveFiles],
  );

  const deleteFilesById = useCallback((files: number[]) => {
    setDeleteFileIds(files);
    setShowConfirmDeleteModal(true);
  }, []);

  const performDelete = useCallback(async () => {
    setShowConfirmDeleteModal(false);
    try {
      await deleteFiles(deleteFileIds);
    } catch (e) {
      addToast(`Error deleting files: ${e}`, "error");
    }
  }, [addToast, deleteFileIds, deleteFiles]);

  const undeleteFilesById = useCallback(
    async (files: number[]) => {
      try {
        await undeleteFiles(files);
      } catch (e) {
        addToast(`Error undeleting files: ${e}`, "error");
      }
    },
    [addToast, undeleteFiles],
  );

  const selectAllFiles = useCallback(() => {
    const { fileIds } = usePageStore.getState();
    setSelectedFiles(pageKey, [...fileIds]);
  }, [pageKey, setSelectedFiles]);

  const findSimilarFiles = async (distance: number) => {
    const selectedFiles = selectedFilesByPage[pageKey] || [];
    const selectedFileHashes = metadataLoadController
      ? (await metadataLoadController.demandFetchMetadata(selectedFiles)).map(
          (f) => f.hash,
        )
      : loadedFiles
          .filter((f) => selectedFiles.includes(f.file_id))
          .map((f) => f.hash);
    const query =
      "system:similar to " +
      selectedFileHashes.join(", ") +
      " with distance of " +
      distance;
    let abortController: AbortController | null = null;
    if (typeof AbortController !== "undefined") {
      abortController = new AbortController();
    }
    const toast = addToast("Searching for similar files...", "info", {
      duration: false,
      actions: [
        {
          variant: "danger",
          label: "Cancel",
          callback: () => {
            abortController?.abort();
            removeToast(toast);
          },
        },
      ],
    });
    const results = await client.searchFiles(
      { tags: [query] },
      abortController?.signal,
    );
    removeToast(toast);
    if (abortController?.signal.aborted) {
      return;
    }
    // Open a new virtual page with the results
    addVirtualPage(query, {
      name: "files (" + results.file_ids.length + ")",
      fileIds: results.file_ids,
    });
    setPage(query, "virtual");
  };

  useShortcut(
    useMemo(
      () =>
        inModal
          ? {}
          : {
              "Control+a": selectAllFiles,
              Delete: () => deleteFilesById(selectedFiles),
              F7: () => archiveFilesById(selectedFiles),
            },
      [
        inModal,
        selectAllFiles,
        deleteFilesById,
        archiveFilesById,
        selectedFiles,
      ],
    ),
  );

  const viewMenuItems: MenuItem[] = [
    {
      id: "select-all",
      label: "Select All",
      onClick: selectAllFiles,
    },
    {
      id: "divider5",
      divider: true,
      label: "",
    },
    {
      id: "import-url",
      label: "Import URL",
      icon: <ArrowUpTrayIcon />,
      onClick: () => {
        setShowImportUrlsModal(true);
      },
    },
    {
      id: "refresh",
      label: "Refresh",
      icon: <ArrowPathIcon />,
      onClick: () => {
        refreshPage(pageKey, pageType);
      },
    },
  ];

  const GAP_SIZE = 16;

  // Calculate grid dimensions based on container width
  const [gridDimensions, setGridDimensions] = useState({ cols: 4, rows: 1 });

  const handleRecalculateRenderView = useCallback(
    (
      filesLength: number,
      gridDimensions: { rows: number; cols: number },
      thumbnailSize: number,
    ) => {
      if (!useVirtualViewport) return;
      if (!gridRef.current) return;
      const { rows, cols } = gridDimensions;
      const actualItemHeight = thumbnailSize;
      const maxRow = Math.max(0, rows - 1);
      const firstRow = Math.min(
        maxRow,
        Math.max(
          0,
          Math.ceil(
            (-SCROLL_SLACK +
              gridRef.current.scrollTop -
              GAP_SIZE -
              actualItemHeight) /
              (actualItemHeight + GAP_SIZE),
          ),
        ),
      );
      const lastRow = Math.min(
        maxRow,
        Math.max(
          0,
          Math.floor(
            (SCROLL_SLACK +
              gridRef.current.scrollTop +
              gridRef.current.parentElement!.clientHeight -
              GAP_SIZE) /
              (actualItemHeight + GAP_SIZE),
          ),
        ),
      );
      const topRows = firstRow;
      const bottomRows = maxRow - lastRow;
      const firstIndex = firstRow * cols;
      const lastIndex = Math.min((lastRow + 1) * cols, filesLength);
      const viewHeight = rows * (thumbnailSize + GAP_SIZE) + GAP_SIZE;
      setRenderView({
        firstIndex,
        lastIndex,
        topRows,
        bottomRows,
        viewHeight,
      });
    },
    [useVirtualViewport],
  );

  useLayoutEffect(() => {
    const calculateDimensions = () => {
      if (!gridRef.current) return;
      const width = gridRef.current.clientWidth - 32; // Account for container padding
      const cols = Math.floor(width / (thumbnailSize + GAP_SIZE));
      const rows = Math.ceil(fileIds.length / cols);
      setGridDimensions({ cols, rows });
      handleRecalculateRenderView(
        fileIds.length,
        { cols, rows },
        thumbnailSize,
      );
    };

    calculateDimensions();

    // ResizeObserver isn't supported in Servo yet, so let's have a fallback for now.
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(calculateDimensions);
      if (gridRef.current) {
        resizeObserver.observe(gridRef.current);
      }
    } else {
      window.addEventListener("resize", calculateDimensions);
    }

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      } else {
        window.removeEventListener("resize", calculateDimensions);
      }
    };
  }, [fileIds.length, handleRecalculateRenderView, thumbnailSize]);

  // Reprioritize metadata loading when scrolling w/ debounce
  useEffect(() => {
    function reprioritizeRenderView() {
      if (!metadataLoadController) {
        return;
      }
      metadataLoadController.reprioritize(
        fileIds.slice(renderView.firstIndex, renderView.lastIndex),
      );
    }
    if (!metadataLoadController) {
      return;
    }
    const timeout = setTimeout(reprioritizeRenderView, 1000);
    return () => {
      clearTimeout(timeout);
    };
  }, [
    fileIds,
    metadataLoadController,
    renderView.firstIndex,
    renderView.lastIndex,
  ]);

  // Reprioritize metadata loading when trying to load a file modal
  useEffect(() => {
    if (!metadataLoadController) {
      return;
    }
    if (modalIndex === -1 || fileIds[modalIndex] === undefined) {
      return;
    }
    metadataLoadController.reprioritize([fileIds[modalIndex]]);
  }, [metadataLoadController, modalIndex, fileIds]);

  // Handle drag and drop
  useEffect(() => {
    const handleDrop = async (event: DragEvent) => {
      event.preventDefault();
      for (const file of event.dataTransfer!.files) {
        let abortController: AbortController | null = null;
        if (typeof AbortController !== "undefined") {
          abortController = new AbortController();
        }
        const toastId = addToast(`Uploading ${file.name}...`, "info", {
          duration: false,
          actions: [
            {
              variant: "danger",
              label: "Cancel",
              callback: () => {
                abortController?.abort();
                removeToast(toastId);
              },
            },
          ],
        });
        try {
          const response = await client.uploadFile(
            file,
            (progress) => {
              updateToastProgress(toastId, progress);
            },
            abortController?.signal,
          );
          addToast(
            `Uploaded ${file.name}${response.note ? `: ${response.note}` : ""}`,
            "success",
          );
          if (pageType === "hydrus") {
            await client.addFiles({
              hashes: [response.hash],
              page_key: pageKey,
            });
            await updatePageContents(pageKey, pageType);
          } else {
            const identifiers = await client.getFileIdsByHashes([
              response.hash,
            ]);
            if (identifiers.metadata[0] && identifiers.metadata[0].file_id) {
              await addFilesToPage(pageKey, pageType, [
                identifiers.metadata[0].file_id,
              ]);
            } else {
              console.warn(
                `Hydrus API did not return file id for hash ${response.hash}`,
              );
            }
          }
        } finally {
          removeToast(toastId);
        }
      }
    };

    const handleDragOver = (event: DragEvent) => {
      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = "copy";
        event.dataTransfer.effectAllowed = "copy";
      }
    };

    const handleDragEnter = (event: DragEvent) => {
      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = "copy";
        event.dataTransfer.effectAllowed = "copy";
      }
    };

    window.addEventListener("drop", handleDrop);
    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("dragenter", handleDragEnter);
    return () => {
      window.removeEventListener("drop", handleDrop);
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("dragenter", handleDragEnter);
    };
  }, [
    pageKey,
    setSelectedFiles,
    addToast,
    removeToast,
    updateToastProgress,
    pageType,
    updatePageContents,
    addFilesToPage,
  ]);

  // Handle click outside of file items
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (gridRef.current && event.target instanceof Element) {
        // Check if the click was on the grid but not on a file item
        if (
          gridRef.current.contains(event.target) &&
          !event.target.closest("[data-file-item]") &&
          !event.shiftKey &&
          !event.ctrlKey
        ) {
          // Ignore clicks on the scrollbar
          const gridRect = gridRef.current.getBoundingClientRect();
          if (
            event.pageX - gridRect.left + gridRef.current.scrollLeft >
            gridRef.current.clientWidth
          ) {
            return;
          }
          clearSelectedFiles(pageKey);
          setActiveFileId(pageKey, null);
        }
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [pageKey, clearSelectedFiles, setActiveFileId]);

  const handleFileClick = (fileId: number, event: React.MouseEvent) => {
    if (event.detail > 1) {
      return;
    }

    const selectedFiles = selectedFilesByPage[pageKey] || [];
    const activeFileId = activeFileByPage[pageKey];

    if (event.ctrlKey || event.metaKey) {
      // Toggle selection with Ctrl/Cmd
      if (selectedFiles.includes(fileId)) {
        setSelectedFiles(
          pageKey,
          selectedFiles.filter((id) => id !== fileId),
        );
        if (activeFileId === fileId) {
          setActiveFileId(pageKey, null);
        }
      } else {
        addSelectedFiles(pageKey, [fileId]);
        if (!activeFileId) {
          setActiveFileId(pageKey, fileId);
        }
      }
    } else if (event.shiftKey && selectedFiles.length > 0 && activeFileId) {
      // Select range with Shift
      const currentIndex = fileIdToIndex.get(fileId);
      const activeIndex = fileIdToIndex.get(activeFileId);

      if (currentIndex !== undefined && activeIndex !== undefined) {
        const start = Math.min(currentIndex, activeIndex);
        const end = Math.max(currentIndex, activeIndex);
        const rangeIds = fileIds.slice(start, end + 1);

        setSelectedFiles(pageKey, rangeIds);
      }
    } else {
      // Regular click - select only this file
      setSelectedFiles(pageKey, [fileId]);
      setActiveFileId(pageKey, fileId);
    }
  };

  const handleFileDoubleClick = (fileId: number) => {
    // Double click - open modal
    const fileIndex = fileIdToIndex.get(fileId);
    if (fileIndex !== undefined) {
      setModalIndex(fileIndex);
    }
    return;
  };

  const handleViewContextMenu = (event: React.MouseEvent) => {
    event.preventDefault();
    showContextMenu(event, viewMenuItems);
  };

  const handleFileContextMenu = (event: React.MouseEvent, fileId: number) => {
    event.preventDefault();
    event.stopPropagation();

    let selectedFiles = selectedFilesByPage[pageKey] || [];

    // If the file isn't in the current selection, select only it
    if (!selectedFiles.includes(fileId)) {
      setSelectedFiles(pageKey, [fileId]);
      selectedFiles = [fileId];
    }
    // Always make this file active
    setActiveFileId(pageKey, fileId);

    // Get the selected files' metadata
    const selectedFileMetadata = loadedFiles.filter((f) =>
      selectedFiles.includes(f.file_id),
    );

    // Show context menu
    showContextMenu(event, [
      {
        id: "open-new-tab",
        label: "Open in New Tab",
        icon: <ArrowTopRightOnSquareIcon />,
        onClick: () => {
          window.open(client.getFileUrl(fileId), "_blank");
        },
      },
      {
        id: "open-new-page",
        label: "Open in New Page",
        icon: <PlusIcon />,
        onClick: () => {
          const newPageKey = Math.random().toString(36).substring(2);
          addVirtualPage(newPageKey, {
            name: "files (" + selectedFiles.length + ")",
            fileIds: [...selectedFiles],
          });
          setPage(newPageKey, "virtual");
        },
      },
      {
        id: "find-similar",
        label: "Find Similar",
        icon: <MagnifyingGlassIcon />,
        items: [
          {
            id: "similar-0",
            label: "Exact match",
            onClick: () => findSimilarFiles(0),
          },
          {
            id: "similar-2",
            label: "Very similar",
            onClick: () => findSimilarFiles(2),
          },
          {
            id: "similar-4",
            label: "Similar",
            onClick: () => findSimilarFiles(4),
          },
          {
            id: "similar-8",
            label: "Speculative",
            onClick: () => findSimilarFiles(8),
          },
        ],
      },
      {
        id: "relationship-menu",
        label: "Relationships",
        icon: <LinkIcon />,
        items: [
          {
            id: "open-best",
            label: "Open best files in new page",
            icon: <LinkIcon />,
            onClick: async () => {
              const hashes = metadataLoadController
                ? (
                    await metadataLoadController.demandFetchMetadata(
                      selectedFiles,
                    )
                  ).map((f) => f.hash)
                : loadedFiles
                    .filter((f) => selectedFiles.includes(f.file_id))
                    .map((f) => f.hash);
              const relationships = await client.getFileRelationships({
                hashes,
              });
              const kingHashes = new Set(
                Object.values(relationships.file_relationships).map(
                  (file) => file.king,
                ),
              );
              const files = await client.getFileIdsByHashes([...kingHashes]);
              const fileIds = files.metadata.map((file) => file.file_id);
              const newPageKey = Math.random().toString(36).substring(2);
              addVirtualPage(newPageKey, {
                name: `best files (${fileIds.length})`,
                fileIds,
              });
              setPage(newPageKey, "virtual");
            },
          },
          {
            id: "set-relationship",
            label: "Set Relationship",
            icon: <LinkIcon />,
            disabled: selectedFiles.length < 2,
            items: [
              {
                id: "relationship-better",
                label: "This file is better than all selected files",
                onClick: () => {
                  markActiveFileAsBetter();
                },
              },
            ],
          },
        ],
      },
      {
        id: "remove-files",
        label: "Remove files",
        icon: <MinusCircleIcon />,
        disabled: pageType === "hydrus",
        onClick: () => {
          removeFilesFromPage(pageKey, pageType, selectedFiles);
        },
      },
      {
        id: "divider1",
        divider: true,
        label: "",
      },
      {
        id: "share",
        label: "Share",
        icon: <ShareIcon />,
        items: [
          {
            id: "copy-image",
            label: `Copy Image`,
            icon: <ArrowUpTrayIcon />,
            onClick: async () => {
              const toast = addToast(
                "Copying image to clipboard (Fetching and rendering...)",
                "info",
                {
                  duration: false,
                },
              );
              let blob: Blob;
              try {
                const currentIndex = fileIdToIndex.get(fileId);
                if (currentIndex === undefined) return;
                const fileData = metadataLoadController
                  ? (
                      await metadataLoadController.demandFetchMetadata([fileId])
                    )[0]
                  : loadedFiles[currentIndex];
                if (!fileData) return;
                const renderer = renderDispatch(fileData);
                const bitmap = await renderer.rasterize(
                  new URL(client.getFileUrl(fileId), document.URL),
                  { ...fileData },
                );
                const canvas = document.createElement("canvas");
                canvas.width = bitmap.width;
                canvas.height = bitmap.height;
                const ctx = canvas.getContext("2d");
                if (!ctx) {
                  throw new Error("Failed to get 2D rendering context");
                }
                ctx.drawImage(bitmap, 0, 0, bitmap.width, bitmap.height);
                blob = await new Promise<Blob>((resolve, reject) => {
                  canvas.toBlob((blob) => {
                    if (blob) {
                      resolve(blob);
                    } else {
                      reject(new Error("Rendering canvas to blob failed"));
                    }
                  });
                });
              } catch (e) {
                addToast(`Error copying image to clipboard: ${e}`, "error");
                return;
              } finally {
                removeToast(toast);
              }
              const copyToClipboard = async () => {
                try {
                  await navigator.clipboard.write([
                    new ClipboardItem({ [blob.type]: blob }),
                  ]);
                  addToast("Image copied to clipboard.", "success");
                } catch (e) {
                  const toast = addToast(
                    `Error copying image to clipboard: ${e}. Try again?`,
                    "error",
                    {
                      duration: false,
                      actions: [
                        {
                          label: "Retry",
                          variant: "primary",
                          callback: async () => {
                            removeToast(toast);
                            await copyToClipboard();
                          },
                        },
                      ],
                    },
                  );
                }
              };
              await copyToClipboard();
            },
          },
          {
            id: "copy-hashes",
            label: `Copy Hash${selectedFileMetadata.length > 1 ? "es" : ""}`,
            icon: <LinkIcon />,
            onClick: () => {
              navigator.clipboard.writeText(
                selectedFileMetadata.map((f) => f.hash).join("\n"),
              );
            },
          },
          {
            id: "copy-file-ids",
            label: `Copy ID${selectedFileMetadata.length > 1 ? "s" : ` (${fileId})`}`,
            icon: <LinkIcon />,
            onClick: () => {
              navigator.clipboard.writeText(
                selectedFileMetadata.map((f) => f.file_id).join("\n"),
              );
            },
          },
          {
            id: "copy-urls",
            label: `Copy URL${selectedFileMetadata.length > 1 ? "s" : ""}`,
            icon: <LinkIcon />,
            onClick: () => {
              navigator.clipboard.writeText(
                selectedFileMetadata
                  .map((f) => client.getFileUrl(f.file_id))
                  .join("\n"),
              );
            },
          },
        ],
      },
      {
        id: "divider2",
        divider: true,
        label: "",
      },
      {
        id: "edit-tags",
        label: "Edit Tags",
        icon: <TagIcon />,
        onClick: async () => {
          setTagEditFiles(
            metadataLoadController
              ? await metadataLoadController.demandFetchMetadata(selectedFiles)
              : selectedFileMetadata,
          );
          setShowEditTagsModal(true);
        },
      },
      {
        id: "edit-urls",
        label: "Edit URLs",
        icon: <LinkIcon />,
        onClick: async () => {
          setUrlEditFiles(
            metadataLoadController
              ? await metadataLoadController.demandFetchMetadata(selectedFiles)
              : selectedFileMetadata,
          );
          setShowEditUrlsModal(true);
        },
      },
      {
        id: "edit-notes",
        label: "Edit Notes",
        icon: <PencilSquareIcon />,
        onClick: async () => {
          const currentIndex = fileIdToIndex.get(fileId);
          if (currentIndex === undefined) return;
          const file = metadataLoadController
            ? (await metadataLoadController.demandFetchMetadata([fileId]))[0]
            : loadedFiles[currentIndex];
          if (!file) {
            return;
          }
          setEditNotesFile(file);
          setShowEditNotesModal(true);
        },
      },
      {
        id: "manage",
        label: "Manage",
        icon: <DocumentIcon />,
        items: [
          {
            id: "archive",
            label: "Archive",
            icon: <ArchiveBoxIcon />,
            onClick: () => archiveFilesById(selectedFiles),
          },
          {
            id: "unarchive",
            label: "Re-inbox",
            icon: <ArchiveBoxXMarkIcon />,
            onClick: () => unarchiveFilesById(selectedFiles),
          },
          {
            id: "delete",
            label: "Delete",
            icon: <TrashIcon />,
            onClick: () => deleteFilesById(selectedFiles),
          },
          {
            id: "undelete",
            label: "Undelete",
            icon: <ArrowUturnDownIcon />,
            onClick: () => undeleteFilesById(selectedFiles),
          },
        ],
      },
      {
        id: "divider3",
        divider: true,
        label: "",
      },
      {
        id: "utilities",
        label: "Utilities",
        icon: <WrenchScrewdriverIcon />,
        items: [
          {
            id: "sauce-nao",
            label: "Sauce Nao Lookup",
            onClick: async () => {
              const toast = addToast("Preparing Sauce Nao request...", "info", {
                duration: false,
              });
              try {
                const thumbnail = await (
                  await fetch(client.getThumbnailUrl(fileId))
                ).blob();
                const dataTransfer = new DataTransfer();
                const file = new File([thumbnail], "image.jpg");
                dataTransfer.items.add(file);
                const form = document.createElement("form");
                const fileInput = document.createElement("input");
                const urlInput = document.createElement("input");
                const submitInput = document.createElement("input");
                form.target = "_blank";
                form.enctype = "multipart/form-data";
                form.method = "post";
                form.action = "https://saucenao.com/search.php";
                form.style.display = "none";
                fileInput.type = "file";
                fileInput.name = "file";
                fileInput.files = dataTransfer.files;
                urlInput.type = "text";
                urlInput.name = "url";
                urlInput.value = "Paste Image URL";
                submitInput.type = "submit";
                submitInput.value = "SEARCH";
                form.appendChild(fileInput);
                form.appendChild(urlInput);
                form.appendChild(submitInput);
                document.body.appendChild(form);
                submitInput.click();
                document.body.removeChild(form);
                addToast("Dispatched Sauce Nao request.", "success");
              } catch (e) {
                addToast(`Error creating Sauce Nao request: ${e}`, "error");
              } finally {
                removeToast(toast);
              }
            },
          },
          {
            id: "photopea",
            label: "Open in Photopea",
            onClick: async () => {
              // Paranoid as it may be, users should be aware of the risks.
              if (!isServerMode && !allowTokenPassing) {
                setShowTokenPassingModal(true);
                return;
              }
              const filesToOpen = await Promise.all(
                selectedFileMetadata.map(async (meta) => {
                  const url = await client.getBridgeUrl(meta.file_id);
                  return {
                    url,
                    meta,
                  };
                }),
              );
              window.open(
                `https://www.photopea.com#${encodeURIComponent(
                  JSON.stringify({
                    files: filesToOpen.map((file) => file.url),
                    script: `${filesToOpen
                      .map(
                        (file, i) =>
                          `if(app.activeDocument==app.documents[${i}])app.activeDocument.name="file_${file.meta.file_id}"`,
                      )
                      .join(";")}`,
                  }),
                )}`,
              );
            },
          },
          {
            id: "batch-autotag",
            label: "Batch Autotag...",
            onClick: () => {
              setBatchAutotagFiles(selectedFileMetadata);
              setShowBatchAutotagModal(true);
            },
          },
        ],
      },
      {
        id: "divider4",
        divider: true,
        label: "",
      },
      ...viewMenuItems,
    ]);
  };

  const longPressHandlers = useLongPress((event) => {
    if (
      !useContextMenuStore.getState().isOpen &&
      event.target &&
      event.target instanceof Element
    ) {
      let target: Element | null = event.target;
      while (target) {
        if (target.hasAttribute("data-file-id")) {
          break;
        }
        target = target.parentElement;
      }
      if (!target) {
        return;
      }
      const fileId = target.getAttribute("data-file-id");
      if (!fileId) {
        return;
      }
      handleFileContextMenu(event, Number(fileId));
    }
  });

  // Modal navigation handlers
  const handleModalClose = () => {
    setModalIndex(-1);
  };

  const modalHasPrevious = modalIndex > 0;
  const modalHasNext = modalIndex < fileIds.length - 1;

  const handleModalPrevious = () => {
    if (modalHasPrevious) {
      setModalIndex(modalIndex - 1);
    }
  };

  const handleModalNext = () => {
    if (modalHasNext) {
      setModalIndex(modalIndex + 1);
    }
  };

  // Handle keyboard navigation
  const handleFileKeyDown = (fileId: number, event: React.KeyboardEvent) => {
    const currentIndex = fileIdToIndex.get(fileId);
    if (currentIndex === undefined) return;

    let nextIndex: number | null = null;
    const { cols } = gridDimensions;

    switch (event.key) {
      case "ArrowLeft":
        event.preventDefault();
        if (currentIndex % cols > 0) {
          nextIndex = currentIndex - 1;
        }
        break;

      case "ArrowRight":
        event.preventDefault();
        if (
          currentIndex % cols < cols - 1 &&
          currentIndex < fileIds.length - 1
        ) {
          nextIndex = currentIndex + 1;
        }
        break;

      case "ArrowUp":
        event.preventDefault();
        if (currentIndex >= cols) {
          nextIndex = currentIndex - cols;
        }
        break;

      case "ArrowDown":
        event.preventDefault();
        if (currentIndex + cols < fileIds.length) {
          nextIndex = currentIndex + cols;
        }
        break;

      case "Enter":
      case " ":
        event.preventDefault();
        if (event.ctrlKey || event.metaKey) {
          // Toggle selection with Ctrl/Cmd
          if (selectedFiles.includes(fileId)) {
            setSelectedFiles(
              pageKey,
              selectedFiles.filter((id) => id !== fileId),
            );
            if (activeFileId === fileId) {
              setActiveFileId(pageKey, null);
            }
          } else {
            addSelectedFiles(pageKey, [fileId]);
            if (!activeFileId) {
              setActiveFileId(pageKey, fileId);
            }
          }
        } else if (event.shiftKey && selectedFiles.length > 0 && activeFileId) {
          // Select range with Shift
          const activeIndex = fileIdToIndex.get(activeFileId);
          if (activeIndex !== undefined) {
            const start = Math.min(currentIndex, activeIndex);
            const end = Math.max(currentIndex, activeIndex);
            const rangeIds = fileIds.slice(start, end + 1);
            setSelectedFiles(pageKey, rangeIds);
          }
        } else {
          // Regular activation
          setSelectedFiles(pageKey, [fileId]);
          setActiveFileId(pageKey, fileId);
          if (event.key === "Enter") {
            // Open modal on Enter
            setModalIndex(currentIndex);
          }
        }
        break;
    }

    if (nextIndex !== null && nextIndex >= 0 && nextIndex < fileIds.length) {
      const nextFileId = fileIds[nextIndex];
      if (nextFileId) {
        setFocusedFileId(nextFileId);
        document
          .querySelector<HTMLElement>(`[data-file-id="${nextFileId}"]`)
          ?.focus();
      }
    }
  };

  // Handle mouse down to start drag
  const handleMouseDown = (event: React.MouseEvent) => {
    // Only start drag on left click and if clicking the grid background
    if (event.button !== 0 || event.target !== gridRef.current) return;

    const grid = gridRef.current;
    if (!grid) return;
    // Ignore clicks on the scrollbar
    const gridRect = grid.getBoundingClientRect();
    if (event.pageX - gridRect.left + grid.scrollLeft > grid.clientWidth) {
      return;
    }

    event.preventDefault();
    setIsDragging(true);

    const { pageX, pageY } = event;
    const mouseX = pageX - gridRect.left + grid.scrollLeft;
    const mouseY = pageY - gridRect.top + grid.scrollTop;
    setDragStart({ x: mouseX, y: mouseY });
    setDragEnd({ x: mouseX, y: mouseY });

    // Store current selection to support Shift+drag
    dragStartSelectionRef.current =
      event.shiftKey || event.ctrlKey ? selectedFilesByPage[pageKey] || [] : [];

    inverseSelection.current = event.ctrlKey;

    // Clear selection if not holding Shift or Ctrl
    if (!event.shiftKey && !event.ctrlKey) {
      clearSelectedFiles(pageKey);
      setActiveFileId(pageKey, null);
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    }
  };

  // Handle mouse move during drag
  const handleMouseMove = useCallback(
    (event: MouseEvent) => {
      if (!isDragging || !dragStart || !gridRef.current) return;

      const { pageX, pageY } = event;
      const grid = gridRef.current;
      const gridRect = grid.getBoundingClientRect();
      const mouseX = pageX - gridRect.left + grid.scrollLeft;
      let mouseY = pageY - gridRect.top + grid.scrollTop;
      const scrollSpeed = 50;

      // Scroll up if mouse is near top edge and the scroll position is not already at the top
      if (event.pageY - gridRect.top < 50 && grid.scrollTop > 0) {
        grid.scrollTop = Math.max(0, grid.scrollTop - scrollSpeed);
        mouseY -= scrollSpeed;
      }

      // Scroll down if mouse is near bottom edge
      if (event.pageY - gridRect.top > grid.clientHeight - 50) {
        grid.scrollTop = Math.min(
          grid.scrollHeight - grid.clientHeight,
          grid.scrollTop + scrollSpeed,
        );
        mouseY += scrollSpeed;
      }

      setDragEnd({
        x: mouseX,
        y: mouseY,
      });

      const selectionRect = {
        left: Math.min(dragStart.x, mouseX),
        top: Math.min(dragStart.y, mouseY),
        width: Math.abs(mouseX - dragStart.x),
        height: Math.abs(mouseY - dragStart.y),
      };

      const selectedFiles: number[] = [];
      const { cols } = gridDimensions;
      const maxRow = Math.max(0, Math.ceil(fileIds.length / cols) - 1);
      const firstRow = Math.min(
        maxRow,
        Math.max(
          0,
          Math.ceil(
            (selectionRect.top - GAP_SIZE - thumbnailSize) /
              (thumbnailSize + GAP_SIZE),
          ),
        ),
      );
      const lastRow = Math.min(
        maxRow,
        Math.max(
          0,
          Math.floor(
            (selectionRect.top + selectionRect.height - GAP_SIZE) /
              (thumbnailSize + GAP_SIZE),
          ),
        ),
      );
      const gridWidth = grid.clientWidth - GAP_SIZE * 2;
      const extraWidth =
        gridWidth - cols * thumbnailSize - (cols - 1) * GAP_SIZE;
      const horizontalGutter = extraWidth / cols / 2;
      const firstFileIndex = firstRow * cols;
      const lastFileIndex = Math.min((lastRow + 1) * cols, fileIds.length);
      for (let i = firstFileIndex; i < lastFileIndex; i++) {
        const fileId = fileIds[i];
        if (!fileId) {
          console.warn(`Invalid file index: ${i} - This is probably a bug.`);
          continue;
        }
        const row = Math.floor(i / cols);
        const col = i % cols;
        const fileLeft =
          GAP_SIZE +
          horizontalGutter +
          col *
            (thumbnailSize + horizontalGutter + GAP_SIZE + horizontalGutter);
        const fileTop = GAP_SIZE + row * (thumbnailSize + GAP_SIZE);
        const fileRight = fileLeft + thumbnailSize;
        const fileBottom = fileTop + thumbnailSize;
        const intersects = !(
          fileRight < selectionRect.left ||
          fileLeft > selectionRect.left + selectionRect.width ||
          fileBottom < selectionRect.top ||
          fileTop > selectionRect.top + selectionRect.height
        );
        if (intersects) {
          selectedFiles.push(fileId);
        }
      }

      // Update selection
      let fileIdsToSelect = [];
      if (inverseSelection.current) {
        const selectedFileSet = new Set(selectedFiles);
        fileIdsToSelect = dragStartSelectionRef.current.filter(
          (id) => !selectedFileSet.has(id),
        );
      } else {
        fileIdsToSelect = [
          ...new Set([...dragStartSelectionRef.current, ...selectedFiles]),
        ];
      }

      if (
        fileIdsToSelect.length !== 0 ||
        (selectedFilesByPage[pageKey] &&
          selectedFilesByPage[pageKey].length !== 0)
      ) {
        setSelectedFiles(pageKey, fileIdsToSelect);
      }

      // Update active file
      if (fileIdsToSelect.length > 0 && fileIdsToSelect[0]) {
        if (
          !activeFileByPage[pageKey] ||
          !fileIdsToSelect.includes(activeFileByPage[pageKey])
        ) {
          setActiveFileId(pageKey, fileIdsToSelect[0]);
        }
      } else if (fileIdsToSelect.length === 0 && activeFileByPage[pageKey]) {
        if (activeFileByPage[pageKey]) {
          setActiveFileId(pageKey, null);
        }
      }
    },
    [
      isDragging,
      dragStart,
      fileIds,
      pageKey,
      setSelectedFiles,
      setActiveFileId,
      activeFileByPage,
      selectedFilesByPage,
      gridDimensions,
      thumbnailSize,
    ],
  );

  // Handle mouse up to end drag
  const handleMouseUp = useCallback(() => {
    if (!isDragging) return;

    setIsDragging(false);
    setDragStart(null);
    setDragEnd(null);
    dragStartSelectionRef.current = [];
  }, [isDragging]);

  useEffect(() => {
    if (!isDragging) {
      return;
    }
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const isLoading =
    isLoadingFiles || (pageType === "search" && searchStatus === "loading");

  let renderFiles: number[];
  if (useVirtualViewport) {
    renderFiles = fileIds.slice(renderView.firstIndex, renderView.lastIndex);
  } else {
    renderFiles = fileIds;
  }

  return (
    <div className="page-view-container">
      {/* Render SearchBar only in search mode */}
      {pageType === "search" && (
        <div className="page-search-bar-container">
          <SearchBar />
        </div>
      )}
      <ScrollView
        ref={gridRef}
        className="files-grid"
        style={{
          gridTemplateColumns: `repeat(${gridDimensions.cols}, minmax(${thumbnailSize}px, 1fr))`,
          gap: `${GAP_SIZE}px`,
          cursor: isDragging ? "crosshair" : undefined,
        }}
        onMouseDown={handleMouseDown}
        onContextMenu={handleViewContextMenu}
        onScroll={() =>
          handleRecalculateRenderView(
            fileIds.length,
            gridDimensions,
            thumbnailSize,
          )
        }
        loaded={fileIds.length !== 0 && renderView.lastIndex !== 0}
      >
        {/* Selection rectangle */}
        {isDragging && dragStart && dragEnd && (
          <div
            className="page-selection-rectangle"
            style={{
              left: Math.min(dragStart.x, dragEnd.x),
              top: Math.min(dragStart.y, dragEnd.y),
              width: Math.abs(dragEnd.x - dragStart.x),
              height: Math.abs(dragEnd.y - dragStart.y),
            }}
          />
        )}

        {isLoading && fileIds.length === 0 ? (
          // Loading state
          <div className="files-grid-loading">
            <div className="page-loading-spinner"></div>
          </div>
        ) : error ? (
          // Error state
          <div className="files-grid-error">
            <div>{error}</div>
          </div>
        ) : fileIds.length === 0 ? (
          // Empty state
          <div className="files-grid-empty">
            {pageType === "search" ? (
              !searchTags.length ? (
                <>
                  <MagnifyingGlassIcon className="files-grid-empty-icon" />
                  <div>Start your search</div>
                  <div className="files-grid-empty-text">
                    Add tags above to find files
                  </div>
                </>
              ) : searchStatus === "initial" ? (
                <>
                  <MagnifyingGlassIcon className="files-grid-empty-icon" />
                  <div>
                    Edit the search query or press the search button to start
                  </div>
                  <div className="files-grid-empty-text">
                    Your previous search query was restored.
                  </div>
                </>
              ) : searchError ? (
                <>
                  <ExclamationCircleIcon className="files-grid-error-icon" />
                  <div>Error loading search results</div>
                  <div className="files-grid-empty-text">
                    Error: {searchError}
                  </div>
                </>
              ) : (
                <>
                  <MagnifyingGlassIcon className="files-grid-empty-icon" />
                  <div>No search results</div>
                  <div className="files-grid-empty-text">
                    Try different tags
                  </div>
                </>
              )
            ) : (
              <>
                <div>No files in this page</div>
              </>
            )}
          </div>
        ) : (
          // Files grid
          renderFiles.map((fileId, i) => (
            <div
              key={fileId}
              data-file-item
              data-file-id={fileId}
              className={`file-item ${
                selectedFiles.includes(fileId)
                  ? activeFileId === fileId
                    ? "file-item-active"
                    : "file-item-selected"
                  : ""
              }`}
              style={{
                width: `${thumbnailSize}px`,
                height: `${thumbnailSize}px`,
                marginTop:
                  useVirtualViewport && i < gridDimensions.cols
                    ? renderView.topRows * (thumbnailSize + GAP_SIZE)
                    : 0,
                marginBottom:
                  useVirtualViewport && i === renderFiles.length - 1
                    ? renderView.bottomRows * (thumbnailSize + GAP_SIZE)
                    : 0,
              }}
              onClick={(e) => handleFileClick(fileId, e)}
              onDoubleClick={() => handleFileDoubleClick(fileId)}
              onKeyDown={(e) => handleFileKeyDown(fileId, e)}
              onMouseUp={(e) => {
                if (e.button === 1) {
                  e.preventDefault();
                  window.open(client.getFileUrl(fileId), "_blank");
                }
              }}
              onContextMenu={(e) => handleFileContextMenu(e, fileId)}
              tabIndex={0}
              role="button"
              aria-selected={selectedFiles.includes(fileId)}
              aria-label={`File ${fileId}`}
              {...longPressHandlers}
            >
              <Thumbnail fileId={fileId} className="thumbnail-wrapper" />
            </div>
          ))
        )}
      </ScrollView>

      {modalIndex !== -1 && fileIds[modalIndex] && (
        <FileViewerModal
          fileId={fileIds[modalIndex]}
          fileData={loadedFiles[modalIndex]}
          onClose={handleModalClose}
          onPrevious={handleModalPrevious}
          onNext={handleModalNext}
          hasPrevious={modalHasPrevious}
          hasNext={modalHasNext}
        />
      )}

      {showEditTagsModal && (
        <EditTagsModal
          files={tagEditFiles}
          onClose={() => setShowEditTagsModal(false)}
        />
      )}

      {showImportUrlsModal && (
        <ImportUrlsModal
          pageKey={pageKey}
          pageType={pageType}
          onClose={() => setShowImportUrlsModal(false)}
        />
      )}

      {showEditUrlsModal && (
        <EditUrlsModal
          files={urlEditFiles}
          onClose={() => setShowEditUrlsModal(false)}
        />
      )}

      {showEditNotesModal && editNotesFile && (
        <EditNotesModal
          file={editNotesFile}
          onClose={() => setShowEditNotesModal(false)}
        />
      )}

      {showTokenPassingModal && (
        <TokenPassingModal
          onClose={() => setShowTokenPassingModal(false)}
        ></TokenPassingModal>
      )}

      {showBatchAutotagModal && (
        <BatchAutoTagModal
          files={batchAutotagFiles}
          onClose={() => setShowBatchAutotagModal(false)}
        ></BatchAutoTagModal>
      )}

      {showConfirmDeleteModal && (
        <ConfirmModal
          title="Delete files"
          message={`Are you sure you want to send ${deleteFileIds.length} file(s) to trash?`}
          confirmLabel="Delete"
          cancelLabel="Cancel"
          onCancel={() => setShowConfirmDeleteModal(false)}
          onConfirm={() => performDelete()}
        />
      )}
    </div>
  );
};

function PageView(props: PageViewProps) {
  const [errorInfo, setErrorInfo] = useState<React.ErrorInfo>();
  return (
    <ErrorBoundary
      fallbackRender={(props) => (
        <Crash componentName="PageView" errorInfo={errorInfo} {...props} />
      )}
      onError={(_, errorInfo) => setErrorInfo(errorInfo)}
    >
      <PageViewImpl {...props} />
    </ErrorBoundary>
  );
}

export default PageView;
