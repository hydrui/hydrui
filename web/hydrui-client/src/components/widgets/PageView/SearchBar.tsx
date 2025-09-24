import {
  BoltIcon,
  ExclamationCircleIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
} from "@heroicons/react/24/solid";
import React, { KeyboardEvent, useEffect, useRef, useState } from "react";

import TagLabel from "@/components/widgets/TagLabel/TagLabel";
import { client } from "@/store/apiStore";
import { useSearchStore } from "@/store/searchStore";

import "./index.css";

interface TagSuggestion {
  value: string;
  count: number;
}

export const SearchBar: React.FC = () => {
  const {
    searchTags,
    searchStatus,
    searchError,
    autoSearch,
    actions: { addSearchTag, removeSearchTag, performSearch, setAutoSearch },
  } = useSearchStore();
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState<TagSuggestion[]>([]);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [editingTagIndex, setEditingTagIndex] = useState<number | null>(null);
  const abortController = useRef<AbortController | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Fetch tag suggestions when input changes
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (input.trim() === "") {
        setSuggestions([]);
        return;
      }

      try {
        abortController.current?.abort();
        abortController.current = new AbortController();
        const response = await client.searchTags(
          input,
          undefined,
          abortController.current.signal,
        );
        setSuggestions(response.tags.slice(0, 100));
        setSelectedSuggestionIndex(0);
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
  }, [input]);

  // Handle keyboard navigation
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedSuggestionIndex((prev) =>
        prev < suggestions.length - 1 ? prev + 1 : prev,
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedSuggestionIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === "Tab" && suggestions.length > 0) {
      e.preventDefault();
      const selectedTag = suggestions[selectedSuggestionIndex].value;
      addTag(selectedTag);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (suggestions.length > 0 && showSuggestions) {
        const selectedTag = suggestions[selectedSuggestionIndex].value;
        addTag(selectedTag);
      } else if (input.trim() !== "") {
        addTag(input.trim());
      } else {
        // If input is empty, just perform the search
        performSearch();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setShowSuggestions(false);
    } else if (e.key === "Backspace") {
      if (input.length === 0 && searchTags.length > 0) {
        e.preventDefault();
        if (editingTagIndex !== null) {
          removeSearchTag(searchTags[editingTagIndex]);
          setEditingTagIndex(null);
        } else {
          const index = searchTags.length - 1;
          setEditingTagIndex(index);
          setInput(searchTags[index]);
          if (inputRef.current) {
            inputRef.current.focus();
          }
        }
      }
    }
  };

  // Add a tag and reset input
  const addTag = (tag: string) => {
    if (editingTagIndex !== null) {
      // Replace the tag at editingTagIndex
      const newTags = [...searchTags];
      newTags[editingTagIndex] = tag;

      removeSearchTag(searchTags[editingTagIndex]);
      addSearchTag(tag);

      setEditingTagIndex(null);
    } else {
      addSearchTag(tag);
    }

    setInput("");
    setShowSuggestions(false);
  };

  // Remove a tag
  const handleRemoveTag = (tag: string) => {
    removeSearchTag(tag);
  };

  // Edit a tag
  const handleEditTag = (index: number) => {
    setEditingTagIndex(index);
    setInput(searchTags[index]);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  // Execute the search
  const handleSearch = () => {
    if (input.trim() !== "") {
      addTag(input.trim());
    } else {
      performSearch();
    }
  };

  // Toggle auto-search
  const toggleAutoSearch = () => {
    setAutoSearch(!autoSearch);
  };

  // Handle clicks outside the suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        !inputRef.current?.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
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
            onFocus={() => input.trim() !== "" && setSuggestions(suggestions)}
            placeholder={searchTags.length > 0 ? "" : "Search tags..."}
            className="page-search-input"
          />

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
          {suggestions.map((suggestion, index) => (
            <div
              key={suggestion.value}
              className={`page-search-suggestion-item ${
                index === selectedSuggestionIndex
                  ? "page-search-suggestion-item-selected"
                  : ""
              }`}
              onClick={() => addTag(suggestion.value)}
              onMouseEnter={() => setSelectedSuggestionIndex(index)}
            >
              <TagLabel tag={suggestion.value} />
              <span className="page-search-suggestion-count">
                {suggestion.count}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
