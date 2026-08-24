import { XMarkIcon } from "@heroicons/react/24/solid";
import { FocusTrap } from "focus-trap-react";
import React from "react";
import { createPortal } from "react-dom";

import ProviderTranscriptionOptions from "@/components/widgets/ProviderTranscriptionOptions/ProviderTranscriptionOptions";
import PushButton from "@/components/widgets/PushButton/PushButton";
import SystemPromptInput from "@/components/widgets/SystemPromptInput/SystemPromptInput";
import { useShortcut } from "@/hooks/useShortcut";
import {
  ProviderConfig,
  TranscriptionRequestSettings,
  parseAdditionalParameters,
  resolveProviderTranscriptionDefaults,
} from "@/llm";
import { useAvailableLLMProviders, useLLMStore } from "@/store/llmStore";
import { isServerMode } from "@/utils/modes";

import "./index.css";

interface TranscribeAnnotationsModalProps {
  onClose: () => void;
  onStart: (
    provider: ProviderConfig,
    settings: TranscriptionRequestSettings,
  ) => void;
}

const stopPropagation = (event: React.SyntheticEvent) => {
  event.stopPropagation();
};

const TranscribeAnnotationsModal: React.FC<TranscribeAnnotationsModalProps> = ({
  onClose,
  onStart,
}) => {
  const providers = useAvailableLLMProviders();
  const selectedBrowserProviderId = useLLMStore(
    (state) => state.selectedProviderId,
  );
  const systemPrompt = useLLMStore((state) => state.transcriptionSystemPrompt);
  const defaultsByProvider = useLLMStore(
    (state) => state.providerTranscriptionDefaults,
  );
  const {
    recordTranscriptionSystemPrompt,
    selectProvider,
    setTranscriptionSystemPrompt,
    updateProviderTranscriptionDefaults,
  } = useLLMStore((state) => state.actions);

  const selectedProviderId = isServerMode
    ? (providers[0]?.id ?? "")
    : providers.some((provider) => provider.id === selectedBrowserProviderId)
      ? (selectedBrowserProviderId ?? "")
      : (providers[0]?.id ?? "");
  const provider = providers.find(
    (candidate) => candidate.id === selectedProviderId,
  );
  const defaults = resolveProviderTranscriptionDefaults(
    provider ? defaultsByProvider[provider.id] : undefined,
  );

  let additionalParameters: Record<string, unknown> | undefined;
  let additionalParametersValid = true;
  if (defaults.includeAdditionalParameters) {
    try {
      additionalParameters = parseAdditionalParameters(
        defaults.additionalParameters,
      );
    } catch {
      additionalParametersValid = false;
    }
  }

  const overrideModel = !isServerMode && defaults.overrideModel;
  const model = overrideModel
    ? defaults.model.trim() || provider?.model.trim() || ""
    : provider?.model.trim() || "";
  const canStart = Boolean(
    provider &&
      model &&
      systemPrompt.trim() &&
      (!defaults.overrideReasoningEffort || defaults.reasoningEffort.trim()) &&
      additionalParametersValid,
  );

  useShortcut({ Escape: onClose });

  const start = () => {
    if (!provider || !canStart) return;
    const settings: TranscriptionRequestSettings = {
      systemPrompt,
      boundingBoxFormat: defaults.boundingBoxFormat,
    };
    if (overrideModel) settings.model = model;
    if (defaults.overrideReasoningEffort) {
      settings.reasoningEffort = defaults.reasoningEffort.trim();
    }
    if (additionalParameters) {
      settings.additionalParameters = additionalParameters;
    }
    if (!isServerMode) selectProvider(provider.id);
    recordTranscriptionSystemPrompt(systemPrompt);
    onStart(provider, settings);
  };

  return createPortal(
    <FocusTrap focusTrapOptions={{ allowOutsideClick: true }}>
      <div
        className="transcribe-annotations-modal-container"
        onClick={stopPropagation}
        onMouseDown={stopPropagation}
        onPointerDown={stopPropagation}
        onTouchStart={stopPropagation}
        onTouchMove={stopPropagation}
        onTouchEnd={stopPropagation}
        onWheel={stopPropagation}
      >
        <div className="transcribe-annotations-modal-wrapper">
          <div
            className="transcribe-annotations-modal-backdrop"
            onClick={onClose}
          />
          <div
            className="transcribe-annotations-modal-content"
            role="dialog"
            aria-modal="true"
            aria-labelledby="transcribe-annotations-title"
          >
            <div className="transcribe-annotations-modal-header">
              <h2 id="transcribe-annotations-title">Transcribe image</h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                title="Close"
              >
                <XMarkIcon />
              </button>
            </div>

            <div className="transcribe-annotations-modal-body">
              <div className="transcribe-annotations-modal-provider">
                <label htmlFor="transcription-provider">Provider</label>
                <select
                  id="transcription-provider"
                  value={selectedProviderId}
                  onChange={(event) =>
                    selectProvider(event.currentTarget.value)
                  }
                  disabled={isServerMode || providers.length === 0}
                  autoFocus
                >
                  {providers.length === 0 && (
                    <option value="">No providers configured</option>
                  )}
                  {providers.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.name || "Unnamed"}
                      {candidate.model ? ` - ${candidate.model}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {provider && (
                <div className="transcribe-annotations-modal-scopes">
                  <section className="transcribe-annotations-modal-section">
                    <div className="transcribe-annotations-modal-section-title">
                      <h3>Instructions</h3>
                    </div>
                    <SystemPromptInput
                      id="transcribe-annotations-system-prompt"
                      value={systemPrompt}
                      onChange={setTranscriptionSystemPrompt}
                    />
                  </section>

                  <section className="transcribe-annotations-modal-section">
                    <div className="transcribe-annotations-modal-section-title">
                      <h3>Overrides</h3>
                    </div>
                    <ProviderTranscriptionOptions
                      provider={provider}
                      value={defaults}
                      onChange={(patch) =>
                        updateProviderTranscriptionDefaults(provider.id, patch)
                      }
                      allowModelOverride={!isServerMode}
                    />
                  </section>
                </div>
              )}
            </div>

            <div className="transcribe-annotations-modal-footer">
              {provider && !model && <span>Provider model is not set.</span>}
              <div>
                <PushButton onClick={onClose} variant="secondary">
                  Cancel
                </PushButton>
                <PushButton onClick={start} disabled={!canStart}>
                  Transcribe
                </PushButton>
              </div>
            </div>
          </div>
        </div>
      </div>
    </FocusTrap>,
    document.body,
  );
};

export default TranscribeAnnotationsModal;
