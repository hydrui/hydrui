import { PlusIcon } from "@heroicons/react/24/solid";
import { MinusIcon } from "@heroicons/react/24/solid";
import React, {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";

import { FileMetadata } from "@/api/types";
import TagLabel from "@/components/widgets/TagLabel/TagLabel";
import { ContentUpdateAction } from "@/constants/contentUpdates";
import { REAL_TAG_SERVICES } from "@/constants/services";
import { useContextMenu } from "@/hooks/useContextMenu";
import { client } from "@/store/apiStore";
import {
  SEARCH_PAGE_KEY,
  usePageActions,
  usePageStore,
} from "@/store/pageStore";
import { useSearchStore } from "@/store/searchStore";
import { useServices } from "@/store/servicesStore";
import { useToastActions } from "@/store/toastStore";
import { useUIStateActions, useUIStateStore } from "@/store/uiStateStore";

import TagInput from "../TagInput/TagInput";
import "./index.css";

function getTagCounts(files: FileMetadata[], useDisplay: boolean) {
  const fileTagCounts = new Map<string, Set<number>>();

  for (const file of files) {
    if (file.tags) {
      for (const serviceObj of Object.values(file.tags)) {
        const tags = useDisplay
          ? serviceObj.display_tags
          : serviceObj.storage_tags;
        if (tags && tags[ContentUpdateAction.ADD]) {
          for (const tag of tags[ContentUpdateAction.ADD]) {
            if (!fileTagCounts.has(tag)) {
              fileTagCounts.set(tag, new Set());
            }
            fileTagCounts.get(tag)?.add(file.file_id);
          }
        }
      }
    }
  }

  return fileTagCounts;
}

function getTagSummary(files: FileMetadata[], useDisplay: boolean) {
  const fileTagCounts = getTagCounts(files, useDisplay);
  return Array.from(fileTagCounts.entries())
    .map(([value, fileIds]) => ({
      value,
      count: fileIds.size,
    }))
    .sort((a, b) => b.count - a.count);
}

// TagList component to display tags of selected files or current view
const TagList: React.FC = () => {
  const { showContextMenu } = useContextMenu();
  const selectedFilesByPage = usePageStore(
    (state) => state.selectedFilesByPage,
  );
  const services = useServices();
  const { setLastActiveTagService } = useUIStateActions();
  const [activeServiceKey, setActiveServiceKey] = useState<string | null>();
  const activePageKey = usePageStore((state) => state.activePageKey);
  const files = usePageStore((state) => state.files);
  const isLoadingFiles = usePageStore((state) => state.isLoadingFiles);
  const pageType = usePageStore((state) => state.pageType);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { setPage, setSelectedFiles, addVirtualPage, refreshFileMetadata } =
    usePageActions();
  const { addToast, removeToast } = useToastActions();
  const {
    actions: { addSearchTag },
    searchTags,
  } = useSearchStore();
  const selectedFiles =
    activePageKey && selectedFilesByPage[activePageKey]?.length > 0
      ? files.filter((f) =>
          selectedFilesByPage[activePageKey].includes(f.file_id),
        )
      : files;

  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [quickEdit, setQuickEdit] = useState<boolean>(false);
  const useDisplayTags = !quickEdit;

  const tagSummary = useMemo(() => {
    return getTagSummary(selectedFiles, useDisplayTags);
  }, [selectedFiles, useDisplayTags]);

  const tagServices = useMemo(
    () =>
      Object.entries(services)
        .filter(([, service]) => REAL_TAG_SERVICES.has(service.type))
        .map(([key, service]) => ({ key, ...service }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [services],
  );

  const deferredIsLoadingFiles = useDeferredValue(isLoadingFiles);
  const deferredTagSummary = useDeferredValue(tagSummary);

  const handleTagClick = useCallback(
    (tag: string, event: React.MouseEvent) => {
      // Handle multi-select with Shift or Ctrl/Cmd
      if (event.shiftKey) {
        // Select range of tags
        const tagIndex = deferredTagSummary.findIndex((t) => t.value === tag);
        const lastSelectedTagIndex = deferredTagSummary.findIndex(
          (t) => t.value === selectedTags[selectedTags.length - 1],
        );

        if (lastSelectedTagIndex !== -1) {
          const start = Math.min(tagIndex, lastSelectedTagIndex);
          const end = Math.max(tagIndex, lastSelectedTagIndex);

          const tagsInRange = deferredTagSummary
            .slice(start, end + 1)
            .map((t) => t.value);

          setSelectedTags([...new Set([...selectedTags, ...tagsInRange])]);
        } else {
          setSelectedTags([tag]);
        }
      } else if (event.ctrlKey || event.metaKey) {
        // Toggle tag selection
        if (selectedTags.includes(tag)) {
          setSelectedTags(selectedTags.filter((t) => t !== tag));
        } else {
          setSelectedTags([...selectedTags, tag]);
        }
      } else {
        // Single selection
        setSelectedTags([tag]);
      }
    },
    [deferredTagSummary, selectedTags, setSelectedTags],
  );

  // Add tag to search
  const handleAddTagToSearch = useCallback(
    (tag: string) => {
      if (!searchTags.includes(tag)) {
        addSearchTag(tag);
      }
    },
    [searchTags, addSearchTag],
  );

  // Add selected tags to search
  const handleAddSelectedToSearch = useCallback(() => {
    for (const tag of selectedTags) {
      if (!searchTags.includes(tag)) {
        addSearchTag(tag);
      }
    }
    // Clear selection after adding
    setSelectedTags([]);
    setPage(SEARCH_PAGE_KEY, "search");
  }, [searchTags, addSearchTag, selectedTags, setSelectedTags, setPage]);

  const handleOpenTagsInNewPage = useCallback(
    async (tags: string[]) => {
      let abortController: AbortController | null = null;
      if (typeof AbortController !== "undefined") {
        abortController = new AbortController();
      }
      const toast = addToast(
        "Searching for files with tags...",
        "info",
        undefined,
        () => {
          abortController?.abort();
          removeToast(toast);
        },
      );
      const results = await client.searchFiles(
        { tags },
        abortController?.signal,
      );
      removeToast(toast);
      if (abortController?.signal.aborted) {
        return;
      }
      // Open a new virtual page with the results
      const pageKey = tags.join(" ");
      addVirtualPage(pageKey, {
        name: "files (" + results.file_ids.length + ")",
        fileIds: results.file_ids,
      });
      setPage(pageKey, "virtual");
    },
    [setPage, addVirtualPage, addToast, removeToast],
  );

  const handleSelectFilesWithTag = useCallback(
    (tag: string) => {
      if (!activePageKey) {
        return;
      }
      setSelectedFiles(
        activePageKey,
        files
          .filter((f) => {
            if (!f.tags) {
              return false;
            }
            for (const serviceObj of Object.values(f.tags)) {
              if (
                serviceObj.display_tags?.[ContentUpdateAction.ADD]?.includes(
                  tag,
                )
              ) {
                return true;
              }
              if (
                serviceObj.storage_tags?.[ContentUpdateAction.ADD]?.includes(
                  tag,
                )
              ) {
                return true;
              }
            }
            return false;
          })
          .map((f) => f.file_id),
      );
    },
    [setSelectedFiles, activePageKey, files],
  );

  const handleContextMenu = useCallback(
    (event: React.MouseEvent, tag: string) => {
      // Prevent the default context menu
      event.preventDefault();

      // If the tag isn't selected, select it.
      if (!selectedTags.includes(tag)) {
        setSelectedTags([tag]);
      }

      showContextMenu(event, [
        ...(selectedTags.length > 1
          ? [
              {
                id: "add-tags-to-search",
                label: "Add tags to search",
                onClick: () => handleAddSelectedToSearch(),
              },
            ]
          : []),
        {
          id: "add-tag-to-search",
          label: `Add tag ${tag} to search`,
          onClick: () => handleAddTagToSearch(tag),
        },
        {
          id: "open-tags-in-new-tab",
          label: `Open ${selectedTags.length > 1 ? "tags" : `tag ${tag}`} in new tab`,
          onClick: () =>
            handleOpenTagsInNewPage(
              selectedTags.length > 1 ? selectedTags : [tag],
            ),
        },
        {
          id: "divider",
          divider: true,
          label: "",
        },
        {
          id: "select-files-with-tag",
          label: `Select files with tag ${tag}`,
          onClick: () => handleSelectFilesWithTag(tag),
        },
      ]);
    },
    [
      handleAddSelectedToSearch,
      handleAddTagToSearch,
      handleOpenTagsInNewPage,
      handleSelectFilesWithTag,
      selectedTags,
      showContextMenu,
    ],
  );

  const handleAddTag = useCallback(
    async (tag: string) => {
      try {
        setIsSubmitting(true);
        if (!activeServiceKey) return;
        if (tag.trim() === "") return;
        await client.editTags(
          selectedFiles.map((f) => f.file_id),
          {
            [activeServiceKey]: {
              [ContentUpdateAction.ADD]: [tag],
            },
          },
        );
        await refreshFileMetadata(selectedFiles.map((f) => f.file_id));
      } finally {
        setIsSubmitting(false);
      }
    },
    [selectedFiles, activeServiceKey, refreshFileMetadata],
  );

  const handleRemoveTag = useCallback(
    async (tag: string) => {
      try {
        setIsSubmitting(true);
        if (!activeServiceKey) return;
        if (tag.trim() === "") return;
        await client.editTags(
          selectedFiles.map((f) => f.file_id),
          {
            [activeServiceKey]: {
              [ContentUpdateAction.DELETE]: [tag],
            },
          },
        );
        await refreshFileMetadata(selectedFiles.map((f) => f.file_id));
      } finally {
        setIsSubmitting(false);
      }
    },
    [selectedFiles, activeServiceKey, refreshFileMetadata],
  );

  const handleTagInput = useCallback(
    (tags: string[]) => {
      const newTag = tags[tags.length - 1];
      if (newTag) {
        handleAddTag(newTag);
      }
    },
    [handleAddTag],
  );

  useEffect(() => {
    if (quickEdit) {
      const lastActiveTagService =
        useUIStateStore.getState().lastActiveTagService;
      const serviceToUse =
        lastActiveTagService &&
        tagServices.some((service) => service.key === lastActiveTagService)
          ? lastActiveTagService
          : tagServices[0].key;
      setActiveServiceKey(serviceToUse);
    } else {
      if (activeServiceKey) {
        setLastActiveTagService(activeServiceKey);
        setActiveServiceKey(null);
      }
    }
  }, [quickEdit, tagServices, activeServiceKey, setLastActiveTagService]);

  return (
    <div className="tag-list-container">
      <div className="tag-list-header">
        <h3 className="tag-list-title">Tags</h3>
        <label>
          <input
            type="checkbox"
            checked={quickEdit}
            onChange={(e) => setQuickEdit(e.currentTarget.checked)}
          />
          Quick Edit
        </label>
      </div>
      {quickEdit && activeServiceKey ? (
        <div className="tag-list-quick-input">
          <TagInput
            serviceKey={activeServiceKey}
            value={[]}
            onChange={handleTagInput}
            disabled={isSubmitting}
          />
        </div>
      ) : undefined}

      {deferredIsLoadingFiles ? (
        <div className="tag-list-loading">
          <div className="tag-list-spinner"></div>
        </div>
      ) : (
        <div className="tag-list-content">
          {deferredTagSummary.length === 0 ? (
            <div className="tag-list-empty">
              {pageType === "search" && searchTags.length === 0
                ? "Enter tags to search"
                : "No tags found"}
            </div>
          ) : (
            <ul className="tag-list">
              {deferredTagSummary.map((tag) => (
                <TagListEntry
                  key={tag.value}
                  tag={tag.value}
                  count={tag.count}
                  totalCount={selectedFiles.length}
                  selectedTags={selectedTags}
                  handleTagClick={handleTagClick}
                  handleContextMenu={handleContextMenu}
                  handleAddTag={handleAddTag}
                  handleRemoveTag={handleRemoveTag}
                  quickEdit={quickEdit}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

interface TagListEntryProps {
  tag: string;
  count: number;
  totalCount: number;
  selectedTags: string[];
  handleTagClick: (tag: string, event: React.MouseEvent) => void;
  handleContextMenu: (event: React.MouseEvent, tag: string) => void;
  handleAddTag: (tag: string) => void;
  handleRemoveTag: (tag: string) => void;
  quickEdit: boolean;
}

const TagListEntry: React.FC<TagListEntryProps> = React.memo(
  function TagListEntry({
    tag,
    count,
    totalCount,
    selectedTags,
    handleTagClick,
    handleContextMenu,
    handleAddTag,
    handleRemoveTag,
    quickEdit,
  }: TagListEntryProps) {
    const handleClick = useCallback(
      (e: React.MouseEvent) => {
        handleTagClick(tag, e);
        e.stopPropagation();
        e.preventDefault();
      },
      [handleTagClick, tag],
    );

    const handleContextMenuClick = useCallback(
      (e: React.MouseEvent) => {
        handleContextMenu(e, tag);
        e.stopPropagation();
        e.preventDefault();
      },
      [handleContextMenu, tag],
    );

    return (
      <li
        className={`tag-list-entry ${selectedTags.includes(tag) ? "selected" : ""}`}
        onContextMenu={handleContextMenuClick}
        tabIndex={0}
      >
        <div className="tag-name" onClick={handleClick}>
          <TagLabel tag={tag} selected={selectedTags.includes(tag)} />
        </div>
        <span className="tag-count">{count}</span>
        {quickEdit ? (
          <>
            <button
              className="tag-button"
              disabled={count === totalCount}
              onClick={() => handleAddTag(tag)}
            >
              <PlusIcon></PlusIcon>
            </button>
            <button className="tag-button" onClick={() => handleRemoveTag(tag)}>
              <MinusIcon></MinusIcon>
            </button>
          </>
        ) : undefined}
      </li>
    );
  },
);
export default TagList;
