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
import FileTypeInput from "@/components/widgets/FileTypeInput/FileTypeInput";
import ModelInput from "@/components/widgets/ModelInput/ModelInput";
import PushButton from "@/components/widgets/PushButton/PushButton";
import { HydrusFileType, filetypeEnumToString } from "@/constants/filetypes";
import { useShortcut } from "@/hooks/useShortcut";
import { ProviderConfig, createProvider, serverLLMProvider } from "@/llm";
import { useApiStore } from "@/store/apiStore";
import { useLLMStore } from "@/store/llmStore";
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
  const [editingViewerOverrideFileType, setEditingViewerOverrideFileType] =
    useState<HydrusFileType>();
  const [
    editingPreviewerOverrideFileType,
    setEditingPreviewerOverrideFileType,
  ] = useState<HydrusFileType>();

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
                    setEditingViewerOverrideFileType={
                      setEditingViewerOverrideFileType
                    }
                    setEditingPreviewerOverrideFileType={
                      setEditingPreviewerOverrideFileType
                    }
                  />
                </>
              )}
              {activeTab === "models" && (
                <>
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
                  <ErrorBoundary
                    fallbackRender={({ error }) => (
                      <p>
                        An error occurred in the model provider settings:{" "}
                        {String(error)}
                      </p>
                    )}
                  >
                    <LanguageModelProviderSettings />
                  </ErrorBoundary>
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

        {/* Set viewer override modal */}
        {editingViewerOverrideFileType !== undefined && (
          <SetViewerOverrideModal
            fileType={editingViewerOverrideFileType}
            isPreview={false}
            onClose={() => setEditingViewerOverrideFileType(undefined)}
          />
        )}

        {/* Set previewer override modal */}
        {editingPreviewerOverrideFileType !== undefined && (
          <SetViewerOverrideModal
            fileType={editingPreviewerOverrideFileType}
            isPreview={true}
            onClose={() => setEditingPreviewerOverrideFileType(undefined)}
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
  setEditingViewerOverrideFileType,
  setEditingPreviewerOverrideFileType,
}: {
  setEditingViewerOverrideFileType: (fileType: HydrusFileType) => void;
  setEditingPreviewerOverrideFileType: (fileType: HydrusFileType) => void;
}) {
  return (
    <>
      <FileTypesEditor />
      <ViewerOverride edit={setEditingViewerOverrideFileType} />
      <PreviewerOverride edit={setEditingPreviewerOverrideFileType} />
    </>
  );
}

function FileTypesEditor() {
  const {
    autopreviewFileTypes,
    actions: {
      addAutopreviewFileType,
      removeAutopreviewFileType,
      resetAutopreviewFileTypes,
    },
  } = usePreferencesStore();

  return (
    <fieldset>
      <legend>File Types to Automatically Preview</legend>
      <FileTypeInput onAdd={addAutopreviewFileType} />
      <ul className="settings-modal-file-type-items">
        {Array.from(autopreviewFileTypes)
          .sort()
          .map((fileType) => (
            <li className="settings-modal-file-type-item" key={fileType}>
              {filetypeEnumToString.get(fileType)}
              <button
                onClick={() => removeAutopreviewFileType(fileType)}
                className="settings-modal-file-type-remove-button"
                title="Disable auto-preview for mimetype"
              >
                <MinusIcon className="h-4 w-4" />
              </button>
            </li>
          ))}
      </ul>
      <div>
        <PushButton variant="danger" onClick={resetAutopreviewFileTypes}>
          Reset to Default
        </PushButton>
      </div>
    </fieldset>
  );
}

function FileTypeOverrideList({
  edit,
  remove,
  overrides,
}: {
  edit: (fileType: HydrusFileType) => void;
  remove: (fileType: HydrusFileType) => void;
  overrides: Map<HydrusFileType, string>;
}) {
  return (
    <>
      <FileTypeInput onAdd={edit} />
      <ul className="settings-modal-file-type-items">
        {Array.from(overrides.entries())
          .sort()
          .map(([fileType, viewer]) => (
            <li className="settings-modal-file-type-item" key={fileType}>
              <span>
                <b>{filetypeEnumToString.get(fileType)}:</b> Use {viewer}
              </span>
              <button
                onClick={() => edit(fileType)}
                className="settings-modal-file-type-edit-button"
                title="Edit override for mimetype"
              >
                <PencilIcon />
              </button>
              <button
                onClick={() => remove(fileType)}
                className="settings-modal-file-type-remove-button"
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

function ViewerOverride({
  edit,
}: {
  edit: (fileType: HydrusFileType) => void;
}) {
  const {
    fileTypeViewerOverride,
    actions: { deleteFileTypeViewerOverride, clearFileTypeViewerOverrides },
  } = usePreferencesStore();

  return (
    <fieldset>
      <legend>Override File Viewer for File Types</legend>
      <FileTypeOverrideList
        edit={edit}
        remove={deleteFileTypeViewerOverride}
        overrides={fileTypeViewerOverride}
      />
      <div>
        <PushButton variant="danger" onClick={clearFileTypeViewerOverrides}>
          Clear
        </PushButton>
      </div>
    </fieldset>
  );
}

function PreviewerOverride({
  edit,
}: {
  edit: (fileType: HydrusFileType) => void;
}) {
  const {
    fileTypePreviewerOverride,
    actions: {
      deleteFileTypePreviewerOverride,
      clearFileTypePreviewerOverrides,
    },
  } = usePreferencesStore();

  return (
    <fieldset>
      <legend>Override File Previewer for File Types</legend>
      <FileTypeOverrideList
        edit={edit}
        remove={deleteFileTypePreviewerOverride}
        overrides={fileTypePreviewerOverride}
      />
      <div>
        <PushButton variant="danger" onClick={clearFileTypePreviewerOverrides}>
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
        <legend>Tagging Models</legend>
        <p>
          Hydrui can suggest tags for images using tagging models that run
          locally in your web browser. Please note that model weights are
          generally large, so using this feature will use some bandwidth and
          disk space.
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

function LanguageModelProviderSettings() {
  const providers = useLLMStore((s) => s.providers);
  const selectedId = useLLMStore((s) => s.selectedProviderId);
  const { addProvider, updateProvider, removeProvider, selectProvider } =
    useLLMStore((s) => s.actions);
  const { addToast } = useToastActions();

  const handleAdd = () => {
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `p-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    addProvider({
      id,
      name: "New Provider",
      kind: "openai",
      baseUrl: "http://127.0.0.1:8080",
      apiKey: "",
      model: "",
    });
  };

  const fetchModels = async (config: ProviderConfig) => {
    try {
      const provider = createProvider(config);
      const models = await provider.listModels(new AbortController().signal);
      if (models.length === 0) {
        addToast("No models returned.", "warning");
        return;
      }
      addToast(`Found ${models.length} model(s).`, "success");
      if (!config.model && models[0]) {
        updateProvider(config.id, { model: models[0] });
      }
    } catch (e) {
      addToast(`Failed to list models: ${e}`, "error");
    }
  };

  if (isServerMode) {
    const provider = serverLLMProvider;
    return (
      <fieldset className="settings-form">
        <legend>Language Model Provider</legend>
        <p>
          In server mode, language model connection settings and credentials are
          managed by Hydrui Server. Browser requests always use the same-origin
          server proxy.
        </p>
        {provider ? (
          <fieldset className="settings-llm-provider">
            <legend>{provider.name}</legend>
            <div className="settings-row">
              <label>Model</label>
              <span>{provider.model}</span>
              <PushButton onClick={() => fetchModels(provider)} variant="muted">
                Test
              </PushButton>
            </div>
          </fieldset>
        ) : (
          <p>
            <em>No language model provider is configured on the server.</em>
          </p>
        )}
      </fieldset>
    );
  }

  return (
    <>
      <fieldset className="settings-form">
        <legend>Language Model Providers</legend>
        <p>
          Some features, such as image transcription, can use models that are
          too large to run in your web browser. To use them, configure a model
          provider here. Currently only OpenAI-compatible APIs (e.g. llama.cpp,
          Ollama, OpenAI) are supported.
        </p>
        {providers.length === 0 ? (
          <p>
            <em>No providers configured.</em>
          </p>
        ) : (
          <div className="settings-llm-providers">
            {providers.map((p) => (
              <fieldset key={p.id} className="settings-llm-provider">
                <legend>
                  <label>
                    <input
                      type="radio"
                      name="llm-selected"
                      checked={selectedId === p.id}
                      onChange={() => selectProvider(p.id)}
                    />{" "}
                    {p.name || "Unnamed"}
                  </label>
                </legend>
                <div className="settings-row">
                  <label>Name</label>
                  <input
                    type="text"
                    value={p.name}
                    onChange={(e) =>
                      updateProvider(p.id, { name: e.target.value })
                    }
                  />
                </div>
                <div className="settings-row">
                  <label>Base URL</label>
                  <input
                    type="text"
                    value={p.baseUrl}
                    onChange={(e) =>
                      updateProvider(p.id, { baseUrl: e.target.value })
                    }
                  />
                </div>
                <div className="settings-row">
                  <label>API Key</label>
                  <input
                    type="password"
                    value={p.apiKey}
                    onChange={(e) =>
                      updateProvider(p.id, { apiKey: e.target.value })
                    }
                  />
                </div>
                <div className="settings-row">
                  <label>Model</label>
                  <ModelInput
                    config={p}
                    value={p.model}
                    onChange={(model) => updateProvider(p.id, { model })}
                  />
                  <PushButton onClick={() => fetchModels(p)} variant="muted">
                    Test
                  </PushButton>
                </div>
                <div className="settings-llm-actions">
                  <PushButton
                    onClick={() => removeProvider(p.id)}
                    variant="danger"
                  >
                    Remove
                  </PushButton>
                </div>
              </fieldset>
            ))}
          </div>
        )}
        <div className="settings-llm-actions">
          <PushButton onClick={handleAdd}>Add Provider</PushButton>
        </div>
      </fieldset>
    </>
  );
}
