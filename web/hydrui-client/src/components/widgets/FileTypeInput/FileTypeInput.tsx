import React, { useEffect, useRef, useState } from "react";

import TagLabel from "@/components/widgets/TagLabel/TagLabel";
import { HydrusFileType, filetypeEnumToString } from "@/constants/filetypes";

import "./index.css";

interface FileTypeInputProps {
  onAdd: (filetype: HydrusFileType) => void;
  disabled?: boolean;
  className?: string;
}

const FileTypeInput: React.FC<FileTypeInputProps> = ({
  onAdd,
  disabled = false,
  className = "",
}) => {
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState<[HydrusFileType, string][]>(
    [],
  );
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Calculate filetype suggestions when input changes
  useEffect(() => {
    const calculateSuggestions = () => {
      const trimmedInput = input.trim();
      if (trimmedInput === "") {
        setSuggestions([]);
        return;
      }
      const startsWith: [HydrusFileType, string][] = [];
      const contains: [HydrusFileType, string][] = [];
      for (const [filetype, name] of filetypeEnumToString.entries()) {
        if (name.startsWith(trimmedInput)) {
          startsWith.push([filetype, name]);
        } else if (name.indexOf(trimmedInput) > 0) {
          contains.push([filetype, name]);
        }
      }
      setSuggestions([...startsWith, ...contains]);
      setShowSuggestions(true);
    };

    const timeoutId = setTimeout(calculateSuggestions, 50);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [input]);

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
        addFileType(suggestions[selectedSuggestionIndex][0]);
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (
        suggestions.length > 0 &&
        showSuggestions &&
        selectedSuggestionIndex >= 0 &&
        suggestions[selectedSuggestionIndex]
      ) {
        addFileType(suggestions[selectedSuggestionIndex][0]);
      }
    } else if (e.key === "Escape" && showSuggestions) {
      e.preventDefault();
      e.stopPropagation();
      setShowSuggestions(false);
    }
  };

  // Add a tag and reset input
  const addFileType = (filetype: HydrusFileType) => {
    onAdd(filetype);
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
    <div className={`file-type-input-container ${className}`}>
      {/* Filetype input */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter filetypes..."
          className="file-type-input-field"
          disabled={disabled}
        />

        {/* Suggestions dropdown */}
        {showSuggestions && (
          <div ref={suggestionsRef} className="file-type-suggestions">
            {suggestions.map((suggestion, index) => (
              <div
                key={suggestion[0]}
                className={`file-type-suggestion-item ${index === selectedSuggestionIndex ? "selected" : ""}`}
                onClick={() => addFileType(suggestion[0])}
                onMouseEnter={() => setSelectedSuggestionIndex(index)}
                tabIndex={0}
              >
                <TagLabel
                  tag={suggestion[1]}
                  selected={index === selectedSuggestionIndex}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default FileTypeInput;
