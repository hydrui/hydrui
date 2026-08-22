import React, { useCallback, useEffect, useRef, useState } from "react";

import { ProviderConfig, createProvider } from "@/llm";

import "./index.css";

interface ModelInputProps {
  config: ProviderConfig;
  value: string;
  onChange: (model: string) => void;
  disabled?: boolean;
  className?: string;
}

const ModelInput: React.FC<ModelInputProps> = ({
  config,
  value,
  onChange,
  disabled = false,
  className = "",
}) => {
  const [models, setModels] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const fetchedKey = useRef<string | null>(null);
  const failedKey = useRef<string | null>(null);
  const abortController = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const fetchKey = `${config.kind}\n${config.baseUrl}\n${config.apiKey}`;

  const ensureModels = useCallback(
    async (retryFailed: boolean) => {
      if (fetchedKey.current === fetchKey) return;
      if (!retryFailed && failedKey.current === fetchKey) return;
      fetchedKey.current = fetchKey;
      abortController.current?.abort();
      const controller = new AbortController();
      abortController.current = controller;
      setLoading(true);
      setModels([]);
      try {
        const list = await createProvider(config).listModels(controller.signal);
        setModels(Array.from(new Set(list)));
        failedKey.current = null;
      } catch (error) {
        if (!(error instanceof Error) || error.name !== "AbortError") {
          fetchedKey.current = null;
          failedKey.current = fetchKey;
        }
      } finally {
        if (abortController.current === controller) {
          setLoading(false);
        }
      }
    },
    [config, fetchKey],
  );

  useEffect(() => {
    return () => {
      abortController.current?.abort();
    };
  }, []);

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

  const trimmed = value.trim().toLowerCase();
  const filtered = trimmed
    ? models.filter((m) => m.toLowerCase().includes(trimmed))
    : models;

  const select = (model: string) => {
    onChange(model);
    setShowSuggestions(false);
    setSelectedIndex(-1);
  };

  const open = (retryFailed: boolean) => {
    setShowSuggestions(true);
    void ensureModels(retryFailed);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!showSuggestions) {
        open(true);
        return;
      }
      setSelectedIndex((prev) => Math.min(prev + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > -1 ? prev - 1 : -1));
    } else if (
      (e.key === "Enter" || e.key === "Tab") &&
      showSuggestions &&
      selectedIndex >= 0 &&
      filtered[selectedIndex]
    ) {
      e.preventDefault();
      select(filtered[selectedIndex]);
    } else if (e.key === "Enter") {
      e.preventDefault();
      setShowSuggestions(false);
    } else if (e.key === "Tab") {
      setShowSuggestions(false);
    } else if (e.key === "Escape" && showSuggestions) {
      e.preventDefault();
      e.stopPropagation();
      setShowSuggestions(false);
    }
  };

  return (
    <div className={`model-input-container ${className}`}>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setSelectedIndex(-1);
          open(false);
        }}
        onKeyDown={handleKeyDown}
        onFocus={() => open(true)}
        placeholder="Model name..."
        className="model-input-field"
        disabled={disabled}
      />

      {showSuggestions && (loading || filtered.length > 0) && (
        <div ref={suggestionsRef} className="model-input-suggestions">
          {loading ? (
            <div className="model-input-suggestion-note">Loading models...</div>
          ) : (
            filtered.map((model, index) => (
              <div
                key={model}
                className={`model-input-suggestion-item ${
                  index === selectedIndex ? "selected" : ""
                }`}
                onClick={() => select(model)}
                onMouseEnter={() => setSelectedIndex(index)}
                tabIndex={0}
              >
                {model}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default ModelInput;
