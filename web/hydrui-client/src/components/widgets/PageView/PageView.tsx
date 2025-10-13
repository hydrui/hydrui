import {
  ArrowPathIcon,
  ArrowTopRightOnSquareIcon,
  ArrowUpTrayIcon,
  ExclamationCircleIcon,
  LinkIcon,
  MinusCircleIcon,
  PencilSquareIcon,
  PlusIcon,
  TagIcon,
  WrenchScrewdriverIcon,
} from "@heroicons/react/24/outline";
import { MagnifyingGlassIcon } from "@heroicons/react/24/solid";
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
import EditNotesModal from "@/components/modals/EditNotesModal/EditNotesModal";
import EditTagsModal from "@/components/modals/EditTagsModal/EditTagsModal";
import EditUrlsModal from "@/components/modals/EditUrlsModal/EditUrlsModal";
import FileViewerModal from "@/components/modals/FileViewerModal/FileViewerModal";
import ImportUrlsModal from "@/components/modals/ImportUrlsModal/ImportUrlsModal";
import TokenPassingModal from "@/components/modals/TokenPassingModal/TokenPassingModal";
import Crash from "@/components/widgets/Crash/Crash";
import ScrollView from "@/components/widgets/ScrollView/ScrollView";
import { useContextMenu } from "@/hooks/useContextMenu";
import useLongPress from "@/hooks/useLongPress";
import { useShortcut } from "@/hooks/useShortcut";
import { client } from "@/store/apiStore";
import { MenuItem, useContextMenuStore } from "@/store/contextMenuStore";
import { usePageStore } from "@/store/pageStore";
import { usePreferencesStore } from "@/store/preferencesStore";
import { useSearchStore } from "@/store/searchStore";
import { useToastStore } from "@/store/toastStore";
import { isServerMode } from "@/utils/serverMode";

import { SearchBar } from "./SearchBar";
import { Thumbnail } from "./Thumbnail";
import "./index.css";

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
    },
    selectedFilesByPage,
    activeFileByPage,
    files,
    isLoadingFiles,
    clearDuringLoad,
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
  const [tagEditFiles, setTagEditFiles] = useState<FileMetadata[]>([]);
  const [urlEditFiles, setUrlEditFiles] = useState<FileMetadata[]>([]);
  const [batchAutotagFiles, setBatchAutotagFiles] = useState<FileMetadata[]>(
    [],
  );
  const [editNotesFile, setEditNotesFile] = useState<FileMetadata | null>(null);
  const inModal =
    modalIndex !== -1 ||
    showEditTagsModal ||
    showEditUrlsModal ||
    showEditNotesModal ||
    showImportUrlsModal ||
    showTokenPassingModal ||
    showBatchAutotagModal;
  const [renderView, setRenderView] = useState({
    firstIndex: 0,
    lastIndex: files.length,
    topRows: 0,
    bottomRows: 0,
    viewHeight: 0,
  });

  const selectAllFiles = useCallback(() => {
    const { files } = usePageStore.getState();
    setSelectedFiles(
      pageKey,
      files.map((f) => f.file_id),
    );
  }, [pageKey, setSelectedFiles]);

  const findSimilarFiles = async (distance: number) => {
    const selectedFiles = selectedFilesByPage[pageKey] || [];
    const selectedFileHashes = files
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
    const toast = addToast(
      "Searching for similar files...",
      "info",
      undefined,
      () => {
        abortController?.abort();
        removeToast(toast);
      },
    );
    const results = await client.searchFiles(
      [query],
      undefined,
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
            },
      [inModal, selectAllFiles],
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
            (gridRef.current.scrollTop - GAP_SIZE - actualItemHeight) /
              (actualItemHeight + GAP_SIZE),
          ),
        ),
      );
      const lastRow = Math.min(
        maxRow,
        Math.max(
          0,
          Math.floor(
            (gridRef.current.scrollTop +
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
      const rows = Math.ceil(files.length / cols);
      setGridDimensions({ cols, rows });
      handleRecalculateRenderView(files.length, { cols, rows }, thumbnailSize);
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
  }, [files.length, handleRecalculateRenderView, thumbnailSize]);

  // Handle drag and drop
  useEffect(() => {
    const handleDrop = async (event: DragEvent) => {
      event.preventDefault();
      for (const file of event.dataTransfer!.files) {
        let abortController: AbortController | null = null;
        if (typeof AbortController !== "undefined") {
          abortController = new AbortController();
        }
        const toastId = addToast(
          `Uploading ${file.name}...`,
          "info",
          undefined,
          () => {
            abortController?.abort();
            removeToast(toastId);
          },
        );
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
            5000,
          );
          if (pageType === "hydrus") {
            await client.addFiles({
              hashes: [response.hash],
              page_key: pageKey,
            });
            await updatePageContents(pageKey, pageType, false);
          } else {
            const identifiers = await client.getFileIdsByHashes([
              response.hash,
            ]);
            await addFilesToPage(pageKey, pageType, [
              identifiers.metadata[0].file_id,
            ]);
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
      const currentIndex = files.findIndex((f) => f.file_id === fileId);
      const activeIndex = files.findIndex((f) => f.file_id === activeFileId);

      if (currentIndex !== -1 && activeIndex !== -1) {
        const start = Math.min(currentIndex, activeIndex);
        const end = Math.max(currentIndex, activeIndex);
        const rangeIds = files.slice(start, end + 1).map((f) => f.file_id);

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
    const fileIndex = files.findIndex((f) => f.file_id === fileId);
    if (fileIndex !== -1) {
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
    const selectedFileMetadata = files.filter((f) =>
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
            name: "files (" + selectedFileMetadata.length + ")",
            fileIds: selectedFileMetadata.map((f) => f.file_id),
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
            onClick: () => {
              addVirtualPage(Math.random().toString(36).substring(2), {
                name: `best files (${selectedFiles.length})`,
                hashes: selectedFileMetadata.map((f) => f.hash),
              });
              setPage(pageKey, "virtual");
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
      {
        id: "divider2",
        divider: true,
        label: "",
      },
      {
        id: "edit-tags",
        label: "Edit Tags",
        icon: <TagIcon />,
        onClick: () => {
          setTagEditFiles(selectedFileMetadata);
          setShowEditTagsModal(true);
        },
      },
      {
        id: "edit-urls",
        label: "Edit URLs",
        icon: <LinkIcon />,
        onClick: () => {
          setUrlEditFiles(selectedFileMetadata);
          setShowEditUrlsModal(true);
        },
      },
      {
        id: "edit-notes",
        label: "Edit Notes",
        icon: <PencilSquareIcon />,
        onClick: () => {
          const currentIndex = files.findIndex(
            (f) => f.file_id === activeFileId,
          );
          if (currentIndex === -1) return;
          setEditNotesFile(files[currentIndex]);
          setShowEditNotesModal(true);
        },
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
              const toast = addToast("Preparing Sauce Nao request...", "info");
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
                addToast("Dispatched Sauce Nao request.", "success", 10000);
              } catch (e) {
                addToast(
                  `Error creating Sauce Nao request: ${e}`,
                  "error",
                  10000,
                );
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

  const selectedFiles = selectedFilesByPage[pageKey] || [];
  const activeFileId = activeFileByPage[pageKey];

  // Modal navigation handlers
  const handleModalClose = () => {
    setModalIndex(-1);
  };

  const modalHasPrevious = modalIndex > 0;
  const modalHasNext = modalIndex < files.length - 1;

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
    const currentIndex = files.findIndex((f) => f.file_id === fileId);
    if (currentIndex === -1) return;

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
        if (currentIndex % cols < cols - 1 && currentIndex < files.length - 1) {
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
        if (currentIndex + cols < files.length) {
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
          const activeIndex = files.findIndex(
            (f) => f.file_id === activeFileId,
          );
          if (activeIndex !== -1) {
            const start = Math.min(currentIndex, activeIndex);
            const end = Math.max(currentIndex, activeIndex);
            const rangeIds = files.slice(start, end + 1).map((f) => f.file_id);
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

    if (nextIndex !== null && nextIndex >= 0 && nextIndex < files.length) {
      const nextFileId = files[nextIndex].file_id;
      setFocusedFileId(nextFileId);
      document
        .querySelector<HTMLElement>(`[data-file-id="${nextFileId}"]`)
        ?.focus();
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

      const selectedFiles: FileMetadata[] = [];
      const { cols } = gridDimensions;
      const maxRow = Math.max(0, Math.ceil(files.length / cols) - 1);
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
      const lastFileIndex = Math.min((lastRow + 1) * cols, files.length);
      for (let i = firstFileIndex; i < lastFileIndex; i++) {
        const file = files[i];
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
          selectedFiles.push(file);
        }
      }

      // Update selection
      let fileIds = [];
      if (inverseSelection.current) {
        const selectedFileSet = new Set(selectedFiles.map((f) => f.file_id));
        fileIds = dragStartSelectionRef.current.filter(
          (id) => !selectedFileSet.has(id),
        );
      } else {
        fileIds = [
          ...new Set([
            ...dragStartSelectionRef.current,
            ...selectedFiles.map((f) => f.file_id),
          ]),
        ];
      }

      if (
        fileIds.length !== 0 ||
        (selectedFilesByPage[pageKey] &&
          selectedFilesByPage[pageKey].length !== 0)
      ) {
        setSelectedFiles(pageKey, fileIds);
      }

      // Update active file
      if (fileIds.length > 0) {
        if (
          !activeFileByPage[pageKey] ||
          !fileIds.includes(activeFileByPage[pageKey])
        ) {
          setActiveFileId(pageKey, fileIds[0]);
        }
      } else if (fileIds.length === 0 && activeFileByPage[pageKey]) {
        if (activeFileByPage[pageKey]) {
          setActiveFileId(pageKey, null);
        }
      }
    },
    [
      isDragging,
      dragStart,
      files,
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
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const isLoading =
    isLoadingFiles || (pageType === "search" && searchStatus === "loading");

  let renderFiles: FileMetadata[];
  if (useVirtualViewport) {
    renderFiles = files.slice(renderView.firstIndex, renderView.lastIndex);
  } else {
    renderFiles = files;
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
            files.length,
            gridDimensions,
            thumbnailSize,
          )
        }
        loaded={!(isLoading && clearDuringLoad) && renderView.lastIndex !== 0}
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

        {isLoading && (clearDuringLoad || files.length === 0) ? (
          // Loading state
          <div className="files-grid-loading">
            <div className="page-loading-spinner"></div>
          </div>
        ) : error ? (
          // Error state
          <div className="files-grid-error">
            <div>{error}</div>
          </div>
        ) : files.length === 0 ? (
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
          renderFiles.map((file, i) => (
            <div
              key={file.file_id}
              data-file-item
              data-file-id={file.file_id}
              className={`file-item ${
                selectedFiles.includes(file.file_id)
                  ? activeFileId === file.file_id
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
              onClick={(e) => handleFileClick(file.file_id, e)}
              onDoubleClick={() => handleFileDoubleClick(file.file_id)}
              onKeyDown={(e) => handleFileKeyDown(file.file_id, e)}
              onMouseUp={(e) => {
                if (e.button === 1) {
                  e.preventDefault();
                  window.open(client.getFileUrl(file.file_id), "_blank");
                }
              }}
              onContextMenu={(e) => handleFileContextMenu(e, file.file_id)}
              tabIndex={0}
              role="button"
              aria-selected={selectedFiles.includes(file.file_id)}
              aria-label={`File ${file.file_id}`}
              {...longPressHandlers}
            >
              <Thumbnail fileId={file.file_id} className="thumbnail-wrapper" />
            </div>
          ))
        )}
      </ScrollView>

      {modalIndex !== -1 && (
        <FileViewerModal
          fileId={files[modalIndex].file_id}
          fileData={files[modalIndex]}
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
