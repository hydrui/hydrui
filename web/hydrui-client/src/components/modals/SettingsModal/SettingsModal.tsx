import { MinusIcon, XMarkIcon } from "@heroicons/react/24/solid";
import React, { useCallback, useRef, useState } from "react";

import EditColorModal from "@/components/modals/EditColorModal/EditColorModal";
import MimeInput from "@/components/widgets/MimeInput/MimeInput";
import PushButton from "@/components/widgets/PushButton/PushButton";
import { useApiStore } from "@/store/apiStore";
import { usePreferencesStore } from "@/store/preferencesStore";
import { isServerMode } from "@/utils/serverMode";

import "./index.css";

interface SettingsModalProps {
  onClose: () => void;
}

type TabType = "api" | "general" | "thumbnails";

const SettingsModal: React.FC<SettingsModalProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<TabType>("general");
  const [editingColor, setEditingColor] = useState<string | boolean>();

  const {
    actions: { setAuthenticated },
    baseUrl,
  } = useApiStore();

  const logout = useCallback(() => {
    setAuthenticated(false);
  }, [setAuthenticated]);

  return (
    <div className="settings-modal-container">
      <div className="settings-modal-wrapper">
        {/* Backdrop */}
        <div className="settings-modal-backdrop" onClick={onClose} />

        {/* Modal */}
        <div className="settings-modal-content">
          {/* Header */}
          <div className="settings-modal-header">
            <h2 className="settings-modal-title">Settings</h2>
            <button
              onClick={onClose}
              className="settings-modal-close-button"
              aria-label="Close"
            >
              <XMarkIcon className="settings-modal-close-icon" />
            </button>
          </div>

          {/* Tabs */}
          <div className="settings-modal-tabs">
            <div className="settings-modal-tabs-list">
              <button
                onClick={() => setActiveTab("api")}
                className={`settings-modal-tab ${
                  activeTab === "api"
                    ? "settings-modal-tab-active"
                    : "settings-modal-tab-inactive"
                }`}
              >
                {isServerMode ? "Authentication" : "API"}
              </button>
              <button
                onClick={() => setActiveTab("general")}
                className={`settings-modal-tab ${
                  activeTab === "general"
                    ? "settings-modal-tab-active"
                    : "settings-modal-tab-inactive"
                }`}
              >
                General
              </button>
              <button
                onClick={() => setActiveTab("thumbnails")}
                className={`settings-modal-tab ${
                  activeTab === "thumbnails"
                    ? "settings-modal-tab-active"
                    : "settings-modal-tab-inactive"
                }`}
              >
                Thumbnails
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="settings-modal-content-area">
            {activeTab === "api" && (
              <fieldset>
                <legend>Connection</legend>
                {isServerMode ? (
                  <>
                    <p>Connected to the Hydrui Server.</p>
                    <div>
                      <PushButton onClick={logout} variant="danger">
                        Log Out
                      </PushButton>
                    </div>
                  </>
                ) : (
                  <>
                    <p>Currently connnected to {baseUrl}.</p>
                    <div className="buttons">
                      <PushButton onClick={logout} variant="danger">
                        Log Out
                      </PushButton>
                    </div>
                  </>
                )}
              </fieldset>
            )}
            {activeTab === "general" && (
              <>
                <MimeTypesEditor />
                <TagColorsEditor editColor={setEditingColor} />
              </>
            )}
            {activeTab === "thumbnails" && (
              <>
                <ThumbnailSettings />
              </>
            )}
          </div>
          <div className="settings-modal-buttons">
            <PushButton onClick={onClose} variant="secondary">
              Close
            </PushButton>
          </div>
        </div>
      </div>

      {/* Edit color modal */}
      {editingColor !== undefined && (
        <EditColorModal
          namespace={editingColor}
          onClose={() => setEditingColor(undefined)}
        />
      )}
    </div>
  );
};

export default SettingsModal;

const MimeTypesEditor: React.FC = () => {
  const {
    autopreviewMimeTypes,
    actions: {
      addAutopreviewMimeType,
      removeAutopreviewMimeType,
      resetAutopreviewMimeTypes,
    },
  } = usePreferencesStore();

  return (
    <fieldset>
      <legend>File Types to Automatically Preview</legend>
      <MimeInput onAdd={addAutopreviewMimeType} />
      <ul className="settings-modal-mime-type-items">
        {Array.from(autopreviewMimeTypes)
          .sort()
          .map((mimeType) => (
            <li className="settings-modal-mime-type-item" key={mimeType}>
              {mimeType}
              <button
                onClick={() => removeAutopreviewMimeType(mimeType)}
                className="settings-modal-mime-type-remove-button"
                title="Disable auto-preview for mimetype"
              >
                <MinusIcon className="h-4 w-4" />
              </button>
            </li>
          ))}
      </ul>
      <div>
        <PushButton variant="danger" onClick={resetAutopreviewMimeTypes}>
          Reset to Default
        </PushButton>
      </div>
    </fieldset>
  );
};

const ThumbnailSettings: React.FC = () => {
  const {
    thumbnailSize,
    actions: { setThumbnailSize: setThumbnailSizeState },
  } = usePreferencesStore();

  const [thumbnailSizeInput, setThumbnailSizeInput] = useState(thumbnailSize);

  const setThumbnailSize = (size: number) => {
    setThumbnailSizeState(size);
    setThumbnailSizeInput(size);
  };

  return (
    <>
      <fieldset className="settings-form">
        <legend>Thumbnail Size</legend>
        <div className="settings-row">
          <label>Thumbnail Size</label>
          <input
            className="settings-text-input"
            name="thumbnail-size"
            type="text"
            value={thumbnailSizeInput}
            onChange={(e) =>
              setThumbnailSizeInput(parseInt(e.target.value) || 0)
            }
            onBlur={() => setThumbnailSize(thumbnailSizeInput)}
          ></input>
          <input
            type="range"
            min={10}
            max={1000}
            step={10}
            value={thumbnailSize}
            onChange={(e) => setThumbnailSize(parseInt(e.target.value) || 0)}
          ></input>
        </div>
      </fieldset>
    </>
  );
};

const TagColorsEditor: React.FC<{
  editColor: (namespace: string | boolean | undefined) => void;
}> = ({ editColor }) => {
  const {
    tagColors: {
      namespaceColors,
      defaultNamespacedColor,
      defaultUnnamespacedColor,
    },
    actions: { setNamespaceColor, clearNamespaceColor, resetNamespaceColors },
  } = usePreferencesStore();
  const namespaceInputRef = useRef<HTMLInputElement>(null);

  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!namespaceInputRef.current) return;

      if (e.key === "Enter") {
        e.preventDefault();
        const namespaceToAdd = namespaceInputRef.current.value;
        namespaceInputRef.current.value = "";
        setNamespaceColor(namespaceToAdd, defaultNamespacedColor);
        editColor(namespaceToAdd);
      }
    },
    [defaultNamespacedColor, editColor, setNamespaceColor],
  );

  return (
    <fieldset>
      <div className="settings-modal-namespace-input-container">
        <input
          ref={namespaceInputRef}
          type="text"
          className="settings-modal-namespace-input"
          placeholder="Namespace to add..."
          onKeyDown={handleInputKeyDown}
        />
      </div>
      <legend>Tag Namespace Colors</legend>
      <ul className="settings-modal-namespace-colors">
        <li className="settings-modal-namespace-colors-item">
          <ColorSwatch
            color={defaultNamespacedColor}
            onClick={() => editColor(true)}
          />
          <div className="settings-modal-namespace-colors-namespace">
            <em>default (namespace)</em>
          </div>
        </li>
        <li className="settings-modal-namespace-colors-item">
          <ColorSwatch
            color={defaultUnnamespacedColor}
            onClick={() => editColor(false)}
          />
          <div className="settings-modal-namespace-colors-namespace">
            <em>default (no namespace)</em>
          </div>
        </li>
        {Object.keys(namespaceColors)
          .sort()
          .map((namespace) => (
            <li
              className="settings-modal-namespace-colors-item"
              key={namespace}
            >
              <ColorSwatch
                color={namespaceColors[namespace]}
                onClick={() => editColor(namespace)}
              />
              <div className="settings-modal-namespace-colors-namespace">
                {namespace}
              </div>
              <button
                onClick={() => clearNamespaceColor(namespace)}
                className="settings-modal-namespace-colors-remove-button"
                title="Remove color from tag namespace"
              >
                <MinusIcon className="h-4 w-4" />
              </button>
            </li>
          ))}
      </ul>
      <div>
        <PushButton variant="danger" onClick={resetNamespaceColors}>
          Reset to Default
        </PushButton>
      </div>
    </fieldset>
  );
};

const ColorSwatch: React.FC<{ color: string; onClick: () => void }> = ({
  color,
  onClick,
}) => {
  return (
    <button
      className="settings-modal-namespace-colors-colorswatch"
      style={{ backgroundColor: color }}
      tabIndex={0}
      onClick={onClick}
    ></button>
  );
};
