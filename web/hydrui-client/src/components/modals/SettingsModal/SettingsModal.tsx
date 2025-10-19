import { MinusIcon, XMarkIcon } from "@heroicons/react/24/solid";
import { CircleStackIcon } from "@heroicons/react/24/solid";
import { TrashIcon } from "@heroicons/react/24/solid";
import { ArrowDownTrayIcon } from "@heroicons/react/24/solid";
import { ArrowTopRightOnSquareIcon } from "@heroicons/react/24/solid";
import { PencilIcon } from "@heroicons/react/24/solid";
import { FocusTrap } from "focus-trap-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ErrorBoundary } from "react-error-boundary";

import EditColorModal from "@/components/modals/EditColorModal/EditColorModal";
import MimeInput from "@/components/widgets/MimeInput/MimeInput";
import PushButton from "@/components/widgets/PushButton/PushButton";
import { useShortcut } from "@/hooks/useShortcut";
import { useApiStore } from "@/store/apiStore";
import { useModelMetaStore } from "@/store/modelMetaStore";
import { usePreferencesStore } from "@/store/preferencesStore";
import { useToastActions } from "@/store/toastStore";
import { isServerMode } from "@/utils/modes";

import AddTagModelModal from "../AddTagModelModal/AddTagModelModal";
import SetViewerOverrideModal from "../SetViewerOverrideModal/SetViewerOverrideModal";
import "./index.css";

interface SettingsModalProps {
  onClose: () => void;
}

type TabType = "api" | "general" | "pageview" | "fileview" | "models";

function SettingsModal({ onClose }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>("general");
  const [editingColor, setEditingColor] = useState<string | boolean>();
  const [showAddTagsModelModal, setShowAddTagsModelModal] = useState(false);
  const [editingViewerOverrideMime, setEditingViewerOverrideMime] =
    useState<string>();
  const [editingPreviewerOverrideMime, setEditingPreviewerOverrideMime] =
    useState<string>();

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
                  onClick={() => setActiveTab("pageview")}
                  className={`settings-modal-tab ${
                    activeTab === "pageview"
                      ? "settings-modal-tab-active"
                      : "settings-modal-tab-inactive"
                  }`}
                >
                  Page View
                </button>
                <button
                  onClick={() => setActiveTab("fileview")}
                  className={`settings-modal-tab ${
                    activeTab === "fileview"
                      ? "settings-modal-tab-active"
                      : "settings-modal-tab-inactive"
                  }`}
                >
                  File View
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
                  <PrivacySettings />
                  <TagColorsEditor editColor={setEditingColor} />
                </>
              )}
              {activeTab === "pageview" && (
                <>
                  <PageViewSettings />
                </>
              )}
              {activeTab === "fileview" && (
                <>
                  <FileViewSettings
                    setEditingViewerOverrideMime={setEditingViewerOverrideMime}
                    setEditingPreviewerOverrideMime={
                      setEditingPreviewerOverrideMime
                    }
                  />
                </>
              )}
              {activeTab === "models" && (
                <ErrorBoundary
                  fallbackRender={({ error }) => (
                    <p>
                      An error occurred in the model manager: {String(error)}
                    </p>
                  )}
                >
                  <ModelsManager
                    setShowAddTagsModelModal={setShowAddTagsModelModal}
                  />
                </ErrorBoundary>
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

        {/* Set viewer override modal */}
        {editingViewerOverrideMime !== undefined && (
          <SetViewerOverrideModal
            mime={editingViewerOverrideMime}
            isPreview={false}
            onClose={() => setEditingViewerOverrideMime(undefined)}
          />
        )}

        {/* Set previewer override modal */}
        {editingPreviewerOverrideMime !== undefined && (
          <SetViewerOverrideModal
            mime={editingPreviewerOverrideMime}
            isPreview={true}
            onClose={() => setEditingPreviewerOverrideMime(undefined)}
          />
        )}
      </div>
    </FocusTrap>
  );
}

export default SettingsModal;

function PrivacySettings() {
  const {
    allowTokenPassing,
    actions: { setAllowTokenPassing },
  } = usePreferencesStore();

  return (
    <fieldset>
      <legend>Privacy and Security</legend>
      <p>
        Some actions (e.g. the &ldquo;Open in Photopea&rdquo; action) may need
        to pass information containing your hydrus network token to external web
        applications, which is not secure.
        {isServerMode ? (
          <>
            {" "}
            Since you are currently using server mode, these actions will use
            one-time bridging instead, so this option is not used.
          </>
        ) : undefined}
      </p>
      <div>
        <label>
          <input
            type="checkbox"
            checked={allowTokenPassing}
            onChange={(e) => setAllowTokenPassing(e.currentTarget.checked)}
          />{" "}
          Allow actions that will pass my hydrus network token to external
          webapps.
        </label>
      </div>
    </fieldset>
  );
}

function PageViewSettings() {
  const {
    thumbnailSize,
    useVirtualViewport,
    eagerLoadThreshold,
    actions: {
      setThumbnailSize: setThumbnailSizeState,
      setVirtualViewport,
      setEagerLoadThreshold: setEagerLoadThresholdState,
    },
  } = usePreferencesStore();

  const [thumbnailSizeInput, setThumbnailSizeInput] = useState(thumbnailSize);

  const setThumbnailSize = (size: number) => {
    setThumbnailSizeState(size);
    setThumbnailSizeInput(size);
  };

  const [eagerLoadThresholdInput, setEagerLoadThresholdInput] =
    useState(eagerLoadThreshold);

  const setEagerLoadThreshold = (size: number) => {
    setEagerLoadThresholdState(size);
    setEagerLoadThresholdInput(size);
  };

  return (
    <>
      <fieldset className="settings-form">
        <legend>Display</legend>
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
      <fieldset className="settings-form">
        <legend>Processing</legend>
        <div className="settings-row">
          <label>Eager Load Threshold</label>
          <input
            className="settings-text-input"
            name="eager-load-threshold"
            type="text"
            value={eagerLoadThresholdInput}
            onChange={(e) =>
              setEagerLoadThresholdInput(parseInt(e.target.value) || 0)
            }
            onBlur={() => setEagerLoadThreshold(eagerLoadThresholdInput)}
          ></input>
        </div>
        <div>
          <p>
            When there are greater than {eagerLoadThreshold} files on a page,
            Hydrui will only load metadata as-needed rather than loading all of
            it.
          </p>
        </div>
      </fieldset>
    </>
  );
}

function FileViewSettings({
  setEditingViewerOverrideMime,
  setEditingPreviewerOverrideMime,
}: {
  setEditingViewerOverrideMime: (mime: string) => void;
  setEditingPreviewerOverrideMime: (mime: string) => void;
}) {
  return (
    <>
      <MimeTypesEditor />
      <ViewerOverride edit={setEditingViewerOverrideMime} />
      <PreviewerOverride edit={setEditingPreviewerOverrideMime} />
    </>
  );
}

function MimeTypesEditor() {
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
}

function MimeOverrideList({
  edit,
  remove,
  overrides,
}: {
  edit: (mime: string) => void;
  remove: (mime: string) => void;
  overrides: Map<string, string>;
}) {
  return (
    <>
      <MimeInput onAdd={edit} />
      <ul className="settings-modal-mime-type-items">
        {Array.from(overrides.entries())
          .sort()
          .map((override) => (
            <li className="settings-modal-mime-type-item" key={override[0]}>
              <span>
                <b>{override[0]}:</b> Use {override[1]}
              </span>
              <button
                onClick={() => edit(override[0])}
                className="settings-modal-mime-type-edit-button"
                title="Edit override for mimetype"
              >
                <PencilIcon />
              </button>
              <button
                onClick={() => remove(override[0])}
                className="settings-modal-mime-type-remove-button"
                title="Remove override for mimetype"
              >
                <MinusIcon />
              </button>
            </li>
          ))}
      </ul>
    </>
  );
}

function ViewerOverride({ edit }: { edit: (mime: string) => void }) {
  const {
    mimeTypeViewerOverride,
    actions: { deleteMimeTypeViewerOverride, clearMimeTypeViewerOverrides },
  } = usePreferencesStore();

  return (
    <fieldset>
      <legend>Override File Viewer for File Types</legend>
      <MimeOverrideList
        edit={edit}
        remove={deleteMimeTypeViewerOverride}
        overrides={mimeTypeViewerOverride}
      />
      <div>
        <PushButton variant="danger" onClick={clearMimeTypeViewerOverrides}>
          Clear
        </PushButton>
      </div>
    </fieldset>
  );
}

function PreviewerOverride({ edit }: { edit: (mime: string) => void }) {
  const {
    mimeTypePreviewerOverride,
    actions: {
      deleteMimeTypePreviewerOverride,
      clearMimeTypePreviewerOverrides,
    },
  } = usePreferencesStore();

  return (
    <fieldset>
      <legend>Override File Previewer for File Types</legend>
      <MimeOverrideList
        edit={edit}
        remove={deleteMimeTypePreviewerOverride}
        overrides={mimeTypePreviewerOverride}
      />
      <div>
        <PushButton variant="danger" onClick={clearMimeTypePreviewerOverrides}>
          Clear
        </PushButton>
      </div>
    </fieldset>
  );
}

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
                color={namespaceColors[namespace] ?? ""}
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

function ColorSwatch({
  color,
  onClick,
}: {
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      className="settings-modal-namespace-colors-colorswatch"
      style={{ backgroundColor: color }}
      tabIndex={0}
      onClick={onClick}
    ></button>
  );
}

interface ModelsManagerProps {
  setShowAddTagsModelModal: (show: boolean) => void;
}

function ModelsManager({ setShowAddTagsModelModal }: ModelsManagerProps) {
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
      const toast = addToast("Attempting to install tag model...", "info", {
        duration: false,
      });
      setIsLoading(true);
      try {
        await installTagModelFromBlob(blob);
        addToast("Tag model successfully installed.", "success");
      } catch (e) {
        addToast(`Error installing model: ${e}`, "error");
      } finally {
        setIsLoading(false);
        removeToast(toast);
      }
    },
    [addToast, installTagModelFromBlob, removeToast],
  );

  const clearFiles = useCallback(
    async (name: string) => {
      setIsLoading(true);
      try {
        await clearInstalledFiles(name);
      } catch (e) {
        addToast(`Error clearing tag model files: ${e}`, "error");
      } finally {
        setIsLoading(false);
      }
    },
    [addToast, clearInstalledFiles],
  );

  const download = useCallback(
    async (name: string) => {
      const toast = addToast("Downloading tag model...", "info", {
        duration: false,
      });
      setIsLoading(true);
      try {
        await downloadTagModel(name);
        addToast("Tag model successfully downloaded.", "success");
      } catch (e) {
        addToast(`Error downloading tag model: ${e}`, "error");
      } finally {
        setIsLoading(false);
        removeToast(toast);
      }
    },
    [addToast, downloadTagModel, removeToast],
  );

  const reset = useCallback(async () => {
    setIsLoading(true);
    try {
      await resetTagModels();
    } catch (e) {
      addToast(`Error resetting all models: ${e}`, "error");
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
        addToast(`Error uninstalling tag model: ${e}`, "error");
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
              fetch models on its own, as all external requests are blocked. You
              can still upload models here by dragging them in.
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
                  {tagModels[name]?.url
                    ? tagModels[name].modelPath
                      ? " (cached)"
                      : " (not cached)"
                    : " (local)"}
                </div>
                <div className="settings-model-row-right">
                  {tagModels[name]?.url ? (
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
                        disabled={isLoading || isServerMode}
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
          {isServerMode ? undefined : (
            <PushButton
              onClick={() => setShowAddTagsModelModal(true)}
              disabled={isLoading}
            >
              Add by URL...
            </PushButton>
          )}
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
          <a
            className="push-button primary"
            style={{ marginLeft: "auto" }}
            href="https://github.com/hydrui/hydrui/releases/tag/models"
            target="_blank"
            rel="noreferrer"
          >
            <div style={{ display: "flex", gap: "8px" }}>
              Model Downloads
              <ArrowTopRightOnSquareIcon
                width="20"
                height="20"
              ></ArrowTopRightOnSquareIcon>
            </div>
          </a>
        </div>
      </fieldset>
    </>
  );
}
