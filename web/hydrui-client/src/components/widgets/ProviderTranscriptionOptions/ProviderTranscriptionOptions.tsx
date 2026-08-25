import React, { useMemo } from "react";

import ModelInput from "@/components/widgets/ModelInput/ModelInput";
import {
  BOUNDING_BOX_FORMATS,
  ProviderConfig,
  ProviderTranscriptionDefaults,
  parseAdditionalParameters,
} from "@/llm";

import "./index.css";

interface ProviderTranscriptionOptionsProps {
  provider: ProviderConfig;
  value: ProviderTranscriptionDefaults;
  onChange: (patch: Partial<ProviderTranscriptionDefaults>) => void;
  allowModelOverride?: boolean;
}

const ProviderTranscriptionOptions: React.FC<
  ProviderTranscriptionOptionsProps
> = ({ provider, value, onChange, allowModelOverride = true }) => {
  const parametersValid = useMemo(() => {
    if (!value.includeAdditionalParameters) return true;
    try {
      parseAdditionalParameters(value.additionalParameters);
      return true;
    } catch {
      return false;
    }
  }, [value.additionalParameters, value.includeAdditionalParameters]);

  const displayedModel = value.overrideModel
    ? value.model || provider.model
    : provider.model;

  return (
    <div className="provider-transcription-options">
      <div className="provider-transcription-options-row">
        <label>Bounding boxes</label>
        <select
          value={value.boundingBoxFormat}
          onChange={(event) =>
            onChange({
              boundingBoxFormat: event.currentTarget
                .value as ProviderTranscriptionDefaults["boundingBoxFormat"],
            })
          }
        >
          {BOUNDING_BOX_FORMATS.map((format) => (
            <option key={format.id} value={format.id}>
              {format.label}
            </option>
          ))}
        </select>
      </div>

      {allowModelOverride && (
        <div className="provider-transcription-options-row">
          <label className="provider-transcription-options-toggle">
            <input
              type="checkbox"
              checked={value.overrideModel}
              onChange={(event) =>
                onChange({ overrideModel: event.currentTarget.checked })
              }
            />
            Model
          </label>
          <ModelInput
            config={provider}
            value={displayedModel}
            onChange={(model) => onChange({ model })}
            disabled={!value.overrideModel}
          />
        </div>
      )}

      <div className="provider-transcription-options-row">
        <label className="provider-transcription-options-toggle">
          <input
            type="checkbox"
            checked={value.overrideReasoningEffort}
            onChange={(event) =>
              onChange({
                overrideReasoningEffort: event.currentTarget.checked,
              })
            }
          />
          Reasoning effort
        </label>
        <input
          type="text"
          value={value.reasoningEffort}
          onChange={(event) =>
            onChange({ reasoningEffort: event.currentTarget.value })
          }
          disabled={!value.overrideReasoningEffort}
          placeholder="Provider value"
        />
      </div>

      <div className="provider-transcription-options-row provider-transcription-options-parameters">
        <label className="provider-transcription-options-toggle">
          <input
            type="checkbox"
            checked={value.includeAdditionalParameters}
            onChange={(event) =>
              onChange({
                includeAdditionalParameters: event.currentTarget.checked,
              })
            }
          />
          Additional parameters
        </label>
        <div>
          <textarea
            rows={4}
            value={value.additionalParameters}
            onChange={(event) =>
              onChange({ additionalParameters: event.currentTarget.value })
            }
            disabled={!value.includeAdditionalParameters}
            aria-invalid={!parametersValid}
            spellCheck={false}
          />
          {!parametersValid && (
            <span className="provider-transcription-options-error">
              Enter a JSON object.
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProviderTranscriptionOptions;
