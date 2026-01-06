import { BookmarkIcon } from "@heroicons/react/24/solid";
import { ClockIcon } from "@heroicons/react/24/solid";
import { TrashIcon } from "@heroicons/react/24/solid";
import React, { useCallback, useRef, useState } from "react";

import { Suggestions, getSuggestions } from "@/utils/script/infer";
import { Parser } from "@/utils/script/parse";
import { Resolver } from "@/utils/script/resolver";
import { Span } from "@/utils/script/span";

import PushButton from "../PushButton/PushButton";
import "./index.css";

interface ExprInputProps {
  onEnter: () => void;
  getPlaceholders: () => Resolver;
  expressionHistory: string[];
  savedExpressions: Record<string, string>;
  clearExpressionHistory: () => void;
  saveExpression: (name: string, expression: string) => void;
  deleteExpression: (name: string) => void;
  disabled?: boolean;
  ref?: React.RefObject<HTMLInputElement | null>;
}

function spliceString(str: string, span: Span, add: string) {
  return str.slice(0, span.start) + add + str.slice(span.end);
}

const ExprInput: React.FC<ExprInputProps> = ({
  onEnter,
  getPlaceholders,
  expressionHistory,
  savedExpressions,
  clearExpressionHistory,
  saveExpression,
  deleteExpression,
  disabled,
  ref,
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const measureRef = useRef<HTMLSpanElement | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestions>();
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [popupView, setPopupView] = useState<"history" | "bookmarks" | null>(
    null,
  );
  const [cursorXPosition, setCursorXPosition] = useState(0);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const bookmarkNameRef = useRef<HTMLInputElement>(null);
  const [currentBookmarkName, setCurrentBookmarkName] = useState("");

  const refreshSuggestions = useCallback(() => {
    if (!inputRef.current || !inputRef.current.selectionStart) {
      return;
    }
    try {
      const parsed = new Parser(inputRef.current.value, true).parseExpression();
      const suggestions = getSuggestions(
        getPlaceholders(),
        parsed,
        inputRef.current.selectionStart,
      );

      if (
        suggestions instanceof Suggestions &&
        suggestions.identifiers.length > 0
      ) {
        if (measureRef.current && inputRef.current) {
          const textBeforeCursor = inputRef.current.value.substring(
            0,
            suggestions.replaceSpan.start,
          );
          measureRef.current.textContent = textBeforeCursor;
          const textWidth = measureRef.current.offsetWidth;
          const scrollLeft = inputRef.current.scrollLeft;
          setCursorXPosition(textWidth - scrollLeft);
        }
        setSuggestions(suggestions);
        setShowSuggestions(true);
      } else {
        setSuggestions(undefined);
        setShowSuggestions(false);
      }
    } catch (e) {
      console.error(`Unexpected crash during speculative execution: ${e}`);
      throw e;
    }
  }, [getPlaceholders]);
  const acceptSuggestion = useCallback(
    (replaceSpan: Span, suggestion: string) => {
      if (!inputRef.current) {
        return;
      }
      inputRef.current.value = spliceString(
        inputRef.current.value,
        replaceSpan,
        suggestion,
      );
      const newPos = replaceSpan.start + suggestion.length;
      inputRef.current.setSelectionRange(newPos, newPos);
      setSuggestions(undefined);
      setShowSuggestions(false);
    },
    [],
  );
  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!inputRef.current) return;
      if (showSuggestions && suggestions) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSelectedSuggestionIndex((prev) =>
            prev < suggestions.identifiers.length - 1
              ? prev + 1
              : suggestions.identifiers.length - 1,
          );
          return;
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setSelectedSuggestionIndex((prev) => (prev > -1 ? prev - 1 : -1));
          return;
        } else if (e.key === "Tab" && suggestions.identifiers.length > 0) {
          if (
            selectedSuggestionIndex >= 0 &&
            suggestions.identifiers[selectedSuggestionIndex]
          ) {
            e.preventDefault();
            const selectedSuggestion =
              suggestions.identifiers[selectedSuggestionIndex];
            acceptSuggestion(suggestions.replaceSpan, selectedSuggestion);
            return;
          }
        } else if (e.key === "Enter") {
          e.preventDefault();
          if (
            selectedSuggestionIndex >= 0 &&
            suggestions.identifiers[selectedSuggestionIndex]
          ) {
            const selectedSuggestion =
              suggestions.identifiers[selectedSuggestionIndex];
            acceptSuggestion(suggestions.replaceSpan, selectedSuggestion);
            return;
          }
        } else if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          setShowSuggestions(false);
          return;
        }
      }
      if (e.key === "Enter") {
        e.preventDefault();
        onEnter();
      }
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        requestAnimationFrame(refreshSuggestions);
      }
    },
    [
      acceptSuggestion,
      refreshSuggestions,
      selectedSuggestionIndex,
      showSuggestions,
      suggestions,
      onEnter,
    ],
  );
  const saveBookmark = useCallback(() => {
    if (!inputRef.current || !bookmarkNameRef.current) {
      return;
    }
    const name = bookmarkNameRef.current.value;
    const expression = inputRef.current.value;
    saveExpression(name, expression);
    setCurrentBookmarkName(name);
    setPopupView(null);
  }, [saveExpression]);
  const removeBookmark = useCallback(
    (name: string) => {
      deleteExpression(name);
    },
    [deleteExpression],
  );
  const loadBookmark = useCallback((name: string, expression: string) => {
    if (!inputRef.current) {
      return;
    }
    setCurrentBookmarkName(name);
    inputRef.current.value = expression;
    setPopupView(null);
  }, []);
  const setRefs = useCallback(
    (element: HTMLInputElement | null) => {
      inputRef.current = element;
      if (ref) {
        ref.current = element;
      }
    },
    [ref],
  );
  return (
    <>
      <div className="expr-input-container">
        <input
          ref={setRefs}
          type="text"
          placeholder="Enter an expression..."
          className="expr-input"
          disabled={disabled}
          autoFocus={true}
          defaultValue={expressionHistory[0] ?? ""}
          onKeyDown={handleInputKeyDown}
          onChange={refreshSuggestions}
        />
        <button
          className={`expr-history-button ${popupView === "history" ? "active" : ""}`}
          title="History"
          onClick={() =>
            setPopupView(popupView === "history" ? null : "history")
          }
        >
          <ClockIcon className="expr-history-icon" />
        </button>
        <button
          className={`expr-save-button ${popupView === "bookmarks" ? "active" : ""}`}
          title="Bookmarks"
          onClick={() =>
            setPopupView(popupView === "bookmarks" ? null : "bookmarks")
          }
        >
          <BookmarkIcon className="expr-save-icon" />
        </button>
        <span
          ref={measureRef}
          style={{
            position: "absolute",
            visibility: "hidden",
            whiteSpace: "pre",
            fontFamily: "monospace",
            fontSize: "0.875rem",
            padding: "0.5rem",
          }}
        />
        {popupView && (
          <div className="expr-popup">
            {popupView === "history" && (
              <div className="expr-history">
                <div className="expr-history-list">
                  {expressionHistory.length > 0 ? (
                    expressionHistory.map((expression, index) => (
                      <button
                        className="expr-history-entry"
                        key={index}
                        title={expression}
                      >
                        {expression}
                      </button>
                    ))
                  ) : (
                    <>History is empty.</>
                  )}
                </div>
                <PushButton
                  variant="danger"
                  className="expr-popup-button"
                  onClick={clearExpressionHistory}
                >
                  Clear
                </PushButton>
              </div>
            )}
            {popupView === "bookmarks" && (
              <div className="expr-bookmarks">
                <div className="expr-bookmark-list">
                  {Object.entries(savedExpressions).length > 0 ? (
                    Object.entries(savedExpressions).map(
                      ([name, expression], index) => (
                        <div className="expr-bookmark-entry" key={index}>
                          <button
                            className="expr-bookmark-entry-item"
                            title={expression}
                            onClick={() => loadBookmark(name, expression)}
                          >
                            {name}
                          </button>
                          <button
                            className="expr-delete-button"
                            title="Remove bookmark"
                            onClick={() => removeBookmark(name)}
                          >
                            <TrashIcon className="expr-delete-icon" />
                          </button>
                        </div>
                      ),
                    )
                  ) : (
                    <>No bookmarks.</>
                  )}
                </div>
                <div className="expr-bookmark-save">
                  <input
                    className="expr-bookmark-name-input"
                    type="text"
                    defaultValue={currentBookmarkName}
                    ref={bookmarkNameRef}
                  ></input>
                  <PushButton
                    variant="primary"
                    className="expr-popup-button"
                    onClick={saveBookmark}
                  >
                    Save
                  </PushButton>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      {showSuggestions && suggestions && (
        <div
          ref={suggestionsRef}
          className="expr-suggestions"
          style={{ left: `${cursorXPosition}px` }}
        >
          {suggestions.identifiers.map((suggestion, index) => (
            <div
              key={suggestion}
              className={`expr-suggestion-item ${index === selectedSuggestionIndex ? "selected" : ""}`}
              onClick={() =>
                acceptSuggestion(suggestions.replaceSpan, suggestion)
              }
              onMouseEnter={() => setSelectedSuggestionIndex(index)}
              tabIndex={0}
            >
              {suggestion}
            </div>
          ))}
        </div>
      )}
    </>
  );
};

export default ExprInput;
