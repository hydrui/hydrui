import React, { useCallback, useDeferredValue, useMemo, useState } from "react";

import { FileMetadata } from "@/api/types";
import TagLabel from "@/components/widgets/TagLabel/TagLabel";
import { ContentUpdateAction } from "@/constants/contentUpdates";
import { useContextMenu } from "@/hooks/useContextMenu";
import { client } from "@/store/apiStore";
import {
  SEARCH_PAGE_KEY,
  usePageActions,
  usePageStore,
} from "@/store/pageStore";
import { useSearchStore } from "@/store/searchStore";
import { useToastActions } from "@/store/toastStore";

import "./index.css";

function getTagCounts(files: FileMetadata[]) {
  const fileTagCounts = new Map<string, Set<number>>();

  for (const file of files) {
    if (file.tags) {
      for (const serviceObj of Object.values(file.tags)) {
        if (
          serviceObj.display_tags &&
          serviceObj.display_tags[ContentUpdateAction.ADD]
        ) {
          for (const tag of serviceObj.display_tags[ContentUpdateAction.ADD]) {
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

function getTagSummary(files: FileMetadata[]) {
  const fileTagCounts = getTagCounts(files);
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
  const activePageKey = usePageStore((state) => state.activePageKey);
  const files = usePageStore((state) => state.files);
  const isLoadingFiles = usePageStore((state) => state.isLoadingFiles);
  const pageType = usePageStore((state) => state.pageType);
  const { setPage, setSelectedFiles, addVirtualPage } = usePageActions();
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

  const tagSummary = useMemo(() => {
    return getTagSummary(selectedFiles);
  }, [selectedFiles]);

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
        tags,
        undefined,
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

  return (
    <div className="tag-list-container">
      <div className="tag-list-header">
        <h3 className="tag-list-title">Tags</h3>
      </div>

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
                  selectedTags={selectedTags}
                  handleTagClick={handleTagClick}
                  handleContextMenu={handleContextMenu}
                  handleAddTagToSearch={handleAddTagToSearch}
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
  selectedTags: string[];
  handleTagClick: (tag: string, event: React.MouseEvent) => void;
  handleContextMenu: (event: React.MouseEvent, tag: string) => void;
  handleAddTagToSearch: (tag: string) => void;
}

const TagListEntry: React.FC<TagListEntryProps> = React.memo(
  function TagListEntry({
    tag,
    count,
    selectedTags,
    handleTagClick,
    handleContextMenu,
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
        onClick={handleClick}
        onContextMenu={handleContextMenuClick}
        tabIndex={0}
      >
        <div className="tag-name">
          <TagLabel tag={tag} selected={selectedTags.includes(tag)} />
        </div>
        <span className="tag-count">{count}</span>
      </li>
    );
  },
);
export default TagList;
