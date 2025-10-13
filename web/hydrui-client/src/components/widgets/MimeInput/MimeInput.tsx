import React, { useEffect, useRef, useState } from "react";

import TagLabel from "@/components/widgets/TagLabel/TagLabel";
import { knownMimetypes } from "@/constants/mimetypes";

import "./index.css";

interface MimeInputProps {
  onAdd: (mimetype: string) => void;
  disabled?: boolean;
  className?: string;
}

const MimeInput: React.FC<MimeInputProps> = ({
  onAdd,
  disabled = false,
  className = "",
}) => {
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Fetch mimetype suggestions when input changes
  useEffect(() => {
    const calculateSuggestions = () => {
      const trimmedInput = input.trim();
      if (trimmedInput === "") {
        setSuggestions([]);
        return;
      }
      const startsWith = knownMimetypes.filter((mime) =>
        mime.startsWith(trimmedInput),
      );
      const contains = knownMimetypes.filter(
        (mime) => mime.indexOf(trimmedInput) > 0,
      );
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
        addMimeType(suggestions[selectedSuggestionIndex]);
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (
        suggestions.length > 0 &&
        showSuggestions &&
        selectedSuggestionIndex >= 0 &&
        suggestions[selectedSuggestionIndex]
      ) {
        addMimeType(suggestions[selectedSuggestionIndex]);
      } else if (input.trim() !== "") {
        addMimeType(input.trim());
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setShowSuggestions(false);
    }
  };

  // Add a tag and reset input
  const addMimeType = (mimetype: string) => {
    onAdd(mimetype);
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
    <div className={`mime-input-container ${className}`}>
      {/* Mimetype input */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter mimetypes..."
          className="mime-input-field"
          disabled={disabled}
        />

        {/* Suggestions dropdown */}
        {showSuggestions && (
          <div ref={suggestionsRef} className="mime-suggestions">
            {suggestions.map((suggestion, index) => (
              <div
                key={suggestion}
                className={`mime-suggestion-item ${index === selectedSuggestionIndex ? "selected" : ""}`}
                onClick={() => addMimeType(suggestion)}
                onMouseEnter={() => setSelectedSuggestionIndex(index)}
                tabIndex={0}
              >
                <TagLabel
                  tag={suggestion}
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

export default MimeInput;
