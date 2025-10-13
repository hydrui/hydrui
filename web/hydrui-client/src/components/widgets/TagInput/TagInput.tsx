import React, { useEffect, useRef, useState } from "react";

import TagLabel from "@/components/widgets/TagLabel/TagLabel";
import { client } from "@/store/apiStore";

import "./index.css";

interface TagSuggestion {
  value: string;
  count: number;
}

interface TagInputProps {
  serviceKey: string;
  value: string[];
  onChange: (tags: string[]) => void;
  disabled?: boolean;
  className?: string;
}

const TagInput: React.FC<TagInputProps> = ({
  serviceKey,
  value,
  onChange,
  disabled = false,
  className = "",
}) => {
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState<TagSuggestion[]>([]);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);
  const [showSuggestions, setShowSuggestions] = useState(false);
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
          serviceKey,
          abortController.current.signal,
        );
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
  }, [input, serviceKey]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedSuggestionIndex((prev) =>
        prev < suggestions.length - 1 ? prev + 1 : suggestions.length - 1,
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedSuggestionIndex((prev) => (prev > -1 ? prev - 1 : -1));
    } else if (e.key === "Tab" && suggestions.length > 0) {
      e.preventDefault();
      if (
        selectedSuggestionIndex >= 0 &&
        suggestions[selectedSuggestionIndex]
      ) {
        const selectedTag = suggestions[selectedSuggestionIndex].value;
        addTag(selectedTag);
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (
        suggestions.length > 0 &&
        showSuggestions &&
        selectedSuggestionIndex >= 0 &&
        suggestions[selectedSuggestionIndex]
      ) {
        const selectedTag = suggestions[selectedSuggestionIndex].value;
        addTag(selectedTag);
      } else if (input.trim() !== "") {
        addTag(input.trim());
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setShowSuggestions(false);
    }
  };

  // Add a tag and reset input
  const addTag = (tag: string) => {
    if (!value.includes(tag)) {
      onChange([...value, tag]);
    }
    setInput("");
    setShowSuggestions(false);
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
    <div className={`tag-input-container ${className}`}>
      {/* Tag input */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter tags..."
          className="tag-input-field"
          disabled={disabled}
        />

        {/* Suggestions dropdown */}
        {showSuggestions && (
          <div ref={suggestionsRef} className="tag-suggestions">
            {suggestions.map((suggestion, index) => (
              <div
                key={suggestion.value}
                className={`tag-suggestion-item ${index === selectedSuggestionIndex ? "selected" : ""}`}
                onClick={() => addTag(suggestion.value)}
                onMouseEnter={() => setSelectedSuggestionIndex(index)}
                tabIndex={0}
              >
                <TagLabel
                  tag={suggestion.value}
                  selected={index === selectedSuggestionIndex}
                />
                <span className="tag-suggestion-count">{suggestion.count}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TagInput;
