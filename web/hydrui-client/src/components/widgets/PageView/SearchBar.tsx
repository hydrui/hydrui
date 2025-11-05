import { BarsArrowDownIcon } from "@heroicons/react/24/outline";
import { BarsArrowUpIcon } from "@heroicons/react/24/outline";
import {
  BoltIcon,
  ExclamationCircleIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
} from "@heroicons/react/24/solid";
import React, {
  KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import TagLabel from "@/components/widgets/TagLabel/TagLabel";
import { SortFilesBy, sortFilesByEnumToString } from "@/constants/sort";
import { client } from "@/store/apiStore";
import { useSearchStore } from "@/store/searchStore";

import {
  FileTypeSystemTag,
  RatingServiceSystemTag,
  RatingSystemTag,
  SimpleSystemTag,
  TagAsNumberTag,
  TagSuggestionUIProps,
} from "./SystemTagUI";
import "./index.css";

type TagSuggestionUIRenderer = (props: TagSuggestionUIProps) => React.ReactNode;

interface TagSuggestion {
  value: string;
  count?: number;
  ui?: TagSuggestionUIRenderer;
}

function SimpleNumericTag(tag: string): TagSuggestion {
  return {
    value: `system:${tag}`,
    ui: (props) => <SimpleSystemTag tag={tag} type="numeric" {...props} />,
  };
}

function SimpleTextTag(tag: string): TagSuggestion {
  return {
    value: `system:${tag}`,
    ui: (props) => <SimpleSystemTag tag={tag} type="text" {...props} />,
  };
}

function RatingServiceTag(tag: string): TagSuggestion {
  return {
    value: `system:${tag}`,
    ui: (props) => <RatingServiceSystemTag tag={tag} {...props} />,
  };
}

function FileTypeTag(tag: string): TagSuggestion {
  return {
    value: `system:${tag}`,
    ui: (props) => <FileTypeSystemTag tag={tag} {...props} />,
  };
}

const SYSTEM_SUGGESTIONS: TagSuggestion[] = [
  { value: "system:everything" },
  { value: "system:inbox" },
  { value: "system:archive" },
  { value: "system:has duration" },
  { value: "system:no duration" },
  { value: "system:is the best quality file of its duplicate group" },
  { value: "system:is not the best quality file of its duplicate group" },
  { value: "system:has audio" },
  { value: "system:no audio" },
  { value: "system:has exif" },
  { value: "system:no exif" },
  { value: "system:has embedded metadata" },
  { value: "system:no embedded metadata" },
  { value: "system:has icc profile" },
  { value: "system:no icc profile" },
  { value: "system:has tags" },
  { value: "system:no tags" },
  { value: "system:untagged" },
  { value: "system:has notes" },
  { value: "system:no notes" },
  { value: "system:does not have notes" },
  SimpleNumericTag("number of tags"),
  SimpleNumericTag("height"),
  SimpleNumericTag("width"),
  SimpleNumericTag("limit"),
  SimpleNumericTag("views"),
  SimpleNumericTag("views in media"),
  SimpleNumericTag("views in preview"),
  SimpleNumericTag("num notes"),
  SimpleTextTag("has note with name"),
  SimpleTextTag("no note with name"),
  SimpleTextTag("has domain"),
  SimpleTextTag("does not have domain"),
  SimpleTextTag("has a url with class"),
  SimpleTextTag("does not have a url with url class"),
  { value: "system:rating", ui: (props) => <RatingSystemTag {...props} /> },
  RatingServiceTag("has a rating for"),
  RatingServiceTag("does not have a rating for"),
  {
    value: "system:tag as number",
    ui: (props) => <TagAsNumberTag {...props} />,
  },
  FileTypeTag("filetype"),
];

enum Prefix {
  Empty = "",
  Negate = "-",
}

export const SearchBar: React.FC = () => {
  const {
    searchTags,
    searchSort,
    searchAscending,
    searchStatus,
    searchError,
    autoSearch,
    actions: {
      addSearchTag,
      removeSearchTag,
      setSearchSort,
      setSearchAscending,
      performSearch,
      setAutoSearch,
    },
  } = useSearchStore();
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState<TagSuggestion[]>([]);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [editingTagIndex, setEditingTagIndex] = useState<number | null>(null);
  const [currentTagUI, setCurrentTagUI] = useState<{
    ui: TagSuggestionUIRenderer;
  } | null>(null);
  const abortController = useRef<AbortController | null>(null);

  const [hasFocus, setHasFocus] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  let trimmedInput = input.trim();
  const isNegated = trimmedInput.startsWith(Prefix.Negate);
  if (isNegated) {
    trimmedInput = trimmedInput.slice(1);
  }
  const prefix = isNegated ? Prefix.Negate : Prefix.Empty;

  // Fetch tag suggestions when input changes
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (currentTagUI !== null) {
        return;
      }
      if (!hasFocus) {
        setSuggestions([]);
        setShowSuggestions(false);
        return;
      }
      if (trimmedInput === "" || trimmedInput.startsWith("system:")) {
        setSuggestions([
          ...SYSTEM_SUGGESTIONS.filter(({ value }) =>
            value.startsWith(trimmedInput),
          ),
          ...SYSTEM_SUGGESTIONS.filter(
            ({ value }) => value.indexOf(trimmedInput.slice(7)) > 7,
          ),
        ]);
        setSelectedSuggestionIndex(-1);
        setShowSuggestions(true);
        return;
      }

      try {
        abortController.current?.abort();
        abortController.current = new AbortController();
        const response = await client.searchTags(
          trimmedInput,
          undefined,
          abortController.current.signal,
        );
        setCurrentTagUI(null);
        setSuggestions(response.tags.slice(0, 100));
        setSelectedSuggestionIndex(-1);
        setShowSuggestions(response.tags.length > 0);
      } catch (error) {
        if (!(error instanceof Error) || error.name !== "AbortError") {
          console.error("Failed to fetch tag suggestions:", error);
          setSuggestions([]);
        }
      }
    };

    const timeoutId = setTimeout(fetchSuggestions, 300);

    return () => {
      abortController.current?.abort();
      clearTimeout(timeoutId);
    };
  }, [hasFocus, trimmedInput, currentTagUI]);

  // Add a tag and reset input
  const addTag = useCallback(
    (tag: string | TagSuggestion) => {
      if (typeof tag !== "string") {
        if (tag.ui) {
          setCurrentTagUI({ ui: tag.ui });
          return;
        } else {
          tag = tag.value;
        }
      }
      if (prefix) {
        tag = prefix + tag;
      }
      if (editingTagIndex !== null) {
        // Replace the tag at editingTagIndex
        const newTags = [...searchTags];
        newTags[editingTagIndex] = tag;
        if (searchTags[editingTagIndex]) {
          removeSearchTag(searchTags[editingTagIndex]);
          addSearchTag(tag);
        }
        setEditingTagIndex(null);
      } else {
        addSearchTag(tag);
      }

      setInput("");
      setShowSuggestions(false);
    },
    [addSearchTag, editingTagIndex, removeSearchTag, searchTags, prefix],
  );

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      const selectedOrFirstSuggestionIndex = Math.max(
        0,
        selectedSuggestionIndex,
      );
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedSuggestionIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : prev,
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        // This tricky behavior is working as intended:
        // - When prev == 0, up arrow pushes to -1.
        // - When prev == -1, up arrow pushes to 0.
        // This makes it so that pressing up with nothing selected selects the top
        // suggestion, but pressing up again deselects it. A little tricky, but it
        // feels more ergonomic than having up do nothing at -1.
        setSelectedSuggestionIndex((prev) => (prev > -1 ? prev - 1 : 0));
      } else if (
        e.key === "Tab" &&
        suggestions.length > 0 &&
        suggestions[selectedOrFirstSuggestionIndex] &&
        // Do not override tab if there is no input, otherwise tabbing the Hydrui
        // UI becomes very annoying.
        trimmedInput !== ""
      ) {
        e.preventDefault();
        addTag(suggestions[selectedOrFirstSuggestionIndex]);
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (
          suggestions.length > 0 &&
          showSuggestions &&
          selectedSuggestionIndex > -1 &&
          suggestions[selectedSuggestionIndex]
        ) {
          addTag(suggestions[selectedSuggestionIndex]);
        } else if (trimmedInput !== "") {
          addTag(trimmedInput);
        } else {
          // If input is empty, just perform the search
          performSearch();
        }
      } else if (e.key === "Escape" && showSuggestions) {
        e.preventDefault();
        e.stopPropagation();
        if (currentTagUI) {
          setCurrentTagUI(null);
        } else {
          setShowSuggestions(false);
        }
      } else if (
        e.key === "Escape" &&
        editingTagIndex !== null &&
        searchTags[editingTagIndex]
      ) {
        e.preventDefault();
        e.stopPropagation();
        setEditingTagIndex(null);
        setInput("");
      } else if (e.key === "Backspace") {
        if (trimmedInput.length === 0 && searchTags.length > 0) {
          e.preventDefault();
          if (editingTagIndex !== null && searchTags[editingTagIndex]) {
            removeSearchTag(searchTags[editingTagIndex]);
            setEditingTagIndex(null);
          } else {
            const index = searchTags.length - 1;
            if (searchTags[index]) {
              setEditingTagIndex(index);
              setInput(searchTags[index]);
            }
            if (inputRef.current) {
              inputRef.current.focus();
            }
          }
        }
      }
    },
    [
      addTag,
      currentTagUI,
      editingTagIndex,
      trimmedInput,
      performSearch,
      removeSearchTag,
      searchTags,
      selectedSuggestionIndex,
      showSuggestions,
      suggestions,
    ],
  );

  // Remove a tag
  const handleRemoveTag = useCallback(
    (tag: string) => {
      removeSearchTag(tag);
    },
    [removeSearchTag],
  );

  // Edit a tag
  const handleEditTag = useCallback(
    (index: number) => {
      if (searchTags[index]) {
        setEditingTagIndex(index);
        setInput(searchTags[index]);
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }
    },
    [searchTags],
  );

  // Execute the search
  const handleSearch = useCallback(() => {
    if (input.trim() !== "") {
      addTag(input.trim());
    } else {
      performSearch();
    }
  }, [addTag, input, performSearch]);

  // Toggle auto-search
  const toggleAutoSearch = useCallback(() => {
    setAutoSearch(!autoSearch);
  }, [autoSearch, setAutoSearch]);

  const toggleSearchDirection = useCallback(() => {
    setSearchAscending(!searchAscending);
  }, [searchAscending, setSearchAscending]);

  // Handle clicks outside the suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        !suggestionsRef.current?.contains(event.target as Node) &&
        !inputRef.current?.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
        setCurrentTagUI(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div className="page-search-bar">
      <div
        className={`page-search-bar-input-container ${
          searchError ? "page-search-bar-input-error" : ""
        }`}
      >
        {/* Render icon to signify error */}
        {searchError && (
          <ExclamationCircleIcon className="page-search-bar-error-icon" />
        )}

        {/* Render tag pills */}
        {searchTags.map(
          (tag, index) =>
            editingTagIndex !== index && (
              <div
                key={tag}
                className={`page-search-tag ${
                  editingTagIndex === index ? "page-search-tag-editing" : ""
                }`}
                onClick={() => handleEditTag(index)}
              >
                <TagLabel tag={tag} />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveTag(tag);
                  }}
                  className="page-search-tag-remove"
                >
                  <XMarkIcon className="page-search-tag-remove-icon" />
                </button>
              </div>
            ),
        )}

        {/* Input field */}
        <div className="page-search-input-wrapper">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setHasFocus(true)}
            onBlur={() => setHasFocus(false)}
            placeholder={
              searchTags.length > 0 ? "Add tag..." : "Search tags..."
            }
            className="page-search-input"
          />

          <select
            value={searchSort}
            onChange={(e) =>
              setSearchSort(Number(e.target.value) as SortFilesBy)
            }
            className="page-sort-dropdown"
            title={`Sort by: ${sortFilesByEnumToString.get(searchSort)}`}
          >
            <option disabled={true}>Sort by...</option>
            {Array.from(sortFilesByEnumToString.entries()).map(
              ([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ),
            )}
          </select>

          <button
            onClick={toggleSearchDirection}
            className="page-sort-direction-button"
          >
            {searchAscending ? (
              <BarsArrowDownIcon className="page-sort-direction-icon" />
            ) : (
              <BarsArrowUpIcon className="page-sort-direction-icon" />
            )}
          </button>

          <button
            onClick={toggleAutoSearch}
            className={`page-auto-search-button ${
              autoSearch
                ? "page-auto-search-enabled"
                : "page-auto-search-disabled"
            }`}
            title={
              autoSearch
                ? "Auto-search enabled (click to disable)"
                : "Auto-search disabled (click to enable)"
            }
          >
            <BoltIcon className="page-auto-search-button-icon" />
          </button>

          <button
            onClick={handleSearch}
            disabled={searchStatus === "loading"}
            className={`page-search-button ${
              searchStatus === "loading" ? "page-search-button-loading" : ""
            }`}
          >
            <MagnifyingGlassIcon className="page-search-button-icon" />
          </button>
        </div>
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && (
        <div ref={suggestionsRef} className="page-search-suggestions">
          {currentTagUI !== null
            ? currentTagUI.ui({
                addTag,
                close: () => {
                  setCurrentTagUI(null);
                  setSuggestions([]);
                  setShowSuggestions(false);
                },
              })
            : suggestions.map((suggestion, index) => (
                <div
                  key={suggestion.value}
                  className={`page-search-suggestion-item ${
                    index === selectedSuggestionIndex
                      ? "page-search-suggestion-item-selected"
                      : ""
                  }`}
                  onClick={() => addTag(suggestion)}
                  onMouseEnter={() => setSelectedSuggestionIndex(index)}
                >
                  <TagLabel
                    tag={
                      input.trim().startsWith("-")
                        ? "-" + suggestion.value
                        : suggestion.value
                    }
                  />
                  {suggestion.count && (
                    <span className="page-search-suggestion-count">
                      {suggestion.count}
                    </span>
                  )}
                </div>
              ))}
        </div>
      )}
    </div>
  );
};
