import { MinusIcon, XMarkIcon } from "@heroicons/react/24/solid";
import { CircleStackIcon } from "@heroicons/react/24/solid";
import { TrashIcon } from "@heroicons/react/24/solid";
import { ArrowDownTrayIcon } from "@heroicons/react/24/solid";
import { FocusTrap } from "focus-trap-react";
import React, { useCallback, useEffect, useRef, useState } from "react";

import EditColorModal from "@/components/modals/EditColorModal/EditColorModal";
import MimeInput from "@/components/widgets/MimeInput/MimeInput";
import PushButton from "@/components/widgets/PushButton/PushButton";
import { useShortcut } from "@/hooks/useShortcut";
import { useApiStore } from "@/store/apiStore";
import { useModelMetaStore } from "@/store/modelMetaStore";
import { usePreferencesStore } from "@/store/preferencesStore";
import { useToastActions } from "@/store/toastStore";
import { isServerMode } from "@/utils/serverMode";

import AddTagModelModal from "../AddTagModelModal/AddTagModelModal";
import "./index.css";

interface SettingsModalProps {
  onClose: () => void;
}

type TabType = "api" | "general" | "thumbnails" | "models";

const SettingsModal: React.FC<SettingsModalProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<TabType>("general");
  const [editingColor, setEditingColor] = useState<string | boolean>();
  const [showAddTagsModelModal, setShowAddTagsModelModal] = useState(false);

  const {
    actions: { setAuthenticated },
    baseUrl,
  } = useApiStore();

  const logout = useCallback(() => {
    setAuthenticated(false);
  }, [setAuthenticated]);

  useShortcut({
    Escape: onClose,
  });

  return (
    <FocusTrap focusTrapOptions={{ allowOutsideClick: true }}>
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
                <button
                  onClick={() => setActiveTab("models")}
                  className={`settings-modal-tab ${
                    activeTab === "models"
                      ? "settings-modal-tab-active"
                      : "settings-modal-tab-inactive"
                  }`}
                >
                  Models
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
              {activeTab === "models" && (
                <>
                  <ModelsManager
                    setShowAddTagsModelModal={setShowAddTagsModelModal}
                  />
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

        {/* Add tag model modal */}
        {showAddTagsModelModal ? (
          <AddTagModelModal onClose={() => setShowAddTagsModelModal(false)} />
        ) : undefined}
      </div>
    </FocusTrap>
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
    useVirtualViewport,
    actions: { setThumbnailSize: setThumbnailSizeState, setVirtualViewport },
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
      <fieldset className="settings-form">
        <legend>Page Rendering</legend>
        <div>
          <label>
            <input
              type="checkbox"
              checked={useVirtualViewport}
              onChange={(e) => setVirtualViewport(e.currentTarget.checked)}
            />{" "}
            Use Virtual Viewport
          </label>
          <p>
            Virtual viewport greatly improves performance in large pages, but
            can lead to increased scroll jank.
          </p>
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

interface ModelsManagerProps {
  setShowAddTagsModelModal: (show: boolean) => void;
}

const ModelsManager: React.FC<ModelsManagerProps> = ({
  setShowAddTagsModelModal,
}) => {
  const {
    tagModels,
    tagModelNames,
    actions: {
      installTagModelFromBlob,
      clearInstalledFiles,
      downloadTagModel,
      uninstallTagModel,
      resetTagModels,
    },
  } = useModelMetaStore();
  const { addToast, removeToast } = useToastActions();

  const [isLoading, setIsLoading] = useState(false);

  const [usage, setUsage] = useState<StorageEstimate | null>(null);
  useEffect(() => {
    if (navigator.storage && navigator.storage.estimate) {
      navigator.storage.estimate().then((usage) => setUsage(usage));
    }
  }, [isLoading]);

  const zipInput = useRef<HTMLInputElement | null>(null);

  const [dropActive, setDropActive] = useState(false);

  const handleBlob = useCallback(
    async (blob: Blob) => {
      const toast = addToast("Attempting to install tag model...", "info");
      setIsLoading(true);
      try {
        await installTagModelFromBlob(blob);
      } catch (e) {
        addToast(`Error installing model: ${e}`, "error", 10000);
      } finally {
        setIsLoading(false);
        removeToast(toast);
      }
      addToast("Tag model successfully installed.", "success", 5000);
    },
    [addToast, installTagModelFromBlob, removeToast],
  );

  const clearFiles = useCallback(
    async (name: string) => {
      setIsLoading(true);
      try {
        await clearInstalledFiles(name);
      } catch (e) {
        addToast(`Error clearing tag model files: ${e}`, "error", 10000);
      } finally {
        setIsLoading(false);
      }
    },
    [addToast, clearInstalledFiles],
  );

  const download = useCallback(
    async (name: string) => {
      const toast = addToast("Downloading tag model...", "info");
      setIsLoading(true);
      try {
        await downloadTagModel(name);
      } catch (e) {
        addToast(`Error downloading tag model: ${e}`, "error", 10000);
      } finally {
        setIsLoading(false);
        removeToast(toast);
      }
      addToast("Tag model successfully downloaded.", "success", 5000);
    },
    [addToast, downloadTagModel, removeToast],
  );

  const reset = useCallback(async () => {
    setIsLoading(true);
    try {
      await resetTagModels();
    } catch (e) {
      addToast(`Error resetting all models: ${e}`, "error", 10000);
    } finally {
      setIsLoading(false);
    }
  }, [addToast, resetTagModels]);

  const uninstall = useCallback(
    async (name: string) => {
      setIsLoading(true);
      try {
        await uninstallTagModel(name);
      } catch (e) {
        addToast(`Error uninstalling tag model: ${e}`, "error", 10000);
      } finally {
        setIsLoading(false);
      }
    },
    [addToast, uninstallTagModel],
  );

  return (
    <>
      <fieldset className="settings-form">
        <legend>Info</legend>
        <p>
          Hydrui has optional support for some features that use machine
          learning.
        </p>
        <p>
          These features run locally in your web browser. Please note that
          neural network weights are generally large, so using these features
          will use some bandwidth and disk space.
        </p>
        {isServerMode ? (
          <p>
            <b>
              Since Hydrui is running in server mode, it will not be able to
              fetch models on its own. You can still upload models.
            </b>
          </p>
        ) : undefined}
        {usage && usage.usage && usage.quota ? (
          <p>
            You are currently using about{" "}
            {(usage.usage / 1024 / 1024).toFixed(2)} MiB (
            {((usage.usage / usage.quota) * 100).toFixed(2)}
            %) of your storage quota ({(usage.quota / 1024 / 1024).toFixed(
              2,
            )}{" "}
            MiB).
          </p>
        ) : undefined}
      </fieldset>
      <fieldset className="settings-form">
        <legend>Tagging Models</legend>
        <div
          className={`settings-model-dropzone ${dropActive ? "dropping" : ""}`}
          onDragOver={(e) => {
            if (isLoading) {
              return;
            }
            e.preventDefault();
            setDropActive(true);
          }}
          onDragLeave={() => {
            if (isLoading) {
              return;
            }
            setDropActive(false);
          }}
          onDrop={(e) => {
            if (isLoading) {
              return;
            }
            e.preventDefault();
            e.stopPropagation();
            setDropActive(false);
            const file = e.dataTransfer?.files?.[0];
            if (file) {
              handleBlob(file);
            }
          }}
        >
          <div className="settings-model-dropzone-overlay">
            <div className="settings-model-dropzone-text">
              Drop zipped models here to install.
            </div>
          </div>
          <div className="settings-model-rows">
            {tagModelNames.map((name) => (
              <div className="settings-model-row" key={name}>
                <div className="settings-model-row-name">
                  <CircleStackIcon width="24" height="24"></CircleStackIcon>
                  {name}
                  {tagModels[name].url
                    ? tagModels[name].modelPath
                      ? " (cached)"
                      : " (not cached)"
                    : " (local)"}
                </div>
                <div className="settings-model-row-right">
                  {tagModels[name].url ? (
                    tagModels[name].modelPath ? (
                      <button
                        onClick={() => clearFiles(name)}
                        className="settings-model-row-clear-button"
                        title="Clear all cached files"
                        disabled={isLoading}
                      >
                        <TrashIcon />
                      </button>
                    ) : (
                      <button
                        onClick={() => download(name)}
                        className="settings-model-row-download-button"
                        title="Download model into cache"
                        disabled={isLoading}
                      >
                        <ArrowDownTrayIcon />
                      </button>
                    )
                  ) : undefined}

                  <button
                    onClick={() => uninstall(name)}
                    className="settings-model-row-remove-button"
                    title="Remove model"
                    disabled={isLoading}
                  >
                    <MinusIcon />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="settings-model-actions">
          <PushButton
            onClick={() => setShowAddTagsModelModal(true)}
            disabled={isLoading}
          >
            Add by URL...
          </PushButton>
          <PushButton
            onClick={() => {
              zipInput.current?.click();
            }}
            disabled={isLoading}
          >
            Install Zipped Model...
          </PushButton>
          <PushButton
            variant="danger"
            onClick={() => reset()}
            disabled={isLoading}
          >
            Reset All
          </PushButton>
          <input
            type="file"
            style={{ display: "none" }}
            accept="application/zip"
            ref={zipInput}
            onChange={(e) => {
              const file = e.currentTarget.files?.[0];
              if (file) {
                handleBlob(file);
              }
            }}
          />
        </div>
      </fieldset>
    </>
  );
};
