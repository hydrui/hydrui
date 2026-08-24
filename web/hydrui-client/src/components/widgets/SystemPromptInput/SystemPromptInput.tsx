import { ArrowPathIcon, ClockIcon } from "@heroicons/react/24/solid";
import React, { useState } from "react";

import { DEFAULT_TRANSCRIPTION_SYSTEM_PROMPT } from "@/llm";
import { useLLMStore } from "@/store/llmStore";

import "./index.css";

interface SystemPromptInputProps {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  rows?: number;
}

const SystemPromptInput: React.FC<SystemPromptInputProps> = ({
  value,
  onChange,
  id = "transcription-system-prompt",
  rows = 7,
}) => {
  const history = useLLMStore((state) => state.transcriptionPromptHistory);
  const [showHistory, setShowHistory] = useState(false);

  return (
    <div className="system-prompt-input">
      <div className="system-prompt-input-header">
        <label htmlFor={id}>System prompt</label>
        <div className="system-prompt-input-actions">
          <button
            type="button"
            className={showHistory ? "active" : ""}
            onClick={() => setShowHistory((show) => !show)}
            disabled={history.length === 0}
            aria-label="Prompt history"
            aria-expanded={showHistory}
            title="Prompt history"
          >
            <ClockIcon />
            {history.length > 0 && <span>{history.length}</span>}
          </button>
          <button
            type="button"
            onClick={() => onChange(DEFAULT_TRANSCRIPTION_SYSTEM_PROMPT)}
            disabled={value === DEFAULT_TRANSCRIPTION_SYSTEM_PROMPT}
            aria-label="Reset system prompt"
            title="Reset system prompt"
          >
            <ArrowPathIcon />
          </button>
        </div>
      </div>
      {showHistory && history.length > 0 && (
        <div className="system-prompt-input-history">
          {history.map((entry, index) => (
            <button
              type="button"
              key={`${entry.usedAt}-${index}`}
              title={entry.prompt}
              onClick={() => {
                onChange(entry.prompt);
                setShowHistory(false);
              }}
            >
              <span>{entry.prompt}</span>
              <time dateTime={new Date(entry.usedAt).toISOString()}>
                {new Date(entry.usedAt).toLocaleString()}
              </time>
            </button>
          ))}
        </div>
      )}
      <textarea
        id={id}
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    </div>
  );
};

export default SystemPromptInput;
