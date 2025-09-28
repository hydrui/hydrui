import { MinusIcon, PlusIcon, XMarkIcon } from "@heroicons/react/24/solid";
import { FocusTrap } from "focus-trap-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";

import { FileMetadata } from "@/api/types";
import { TagUpdates } from "@/api/types";
import ConfirmModal from "@/components/modals/ConfirmModal/ConfirmModal";
import PushButton from "@/components/widgets/PushButton/PushButton";
import TagInput from "@/components/widgets/TagInput/TagInput";
import TagLabel from "@/components/widgets/TagLabel/TagLabel";
import { ContentUpdateAction } from "@/constants/contentUpdates";
import { REAL_TAG_SERVICES } from "@/constants/services";
import { useShortcut } from "@/hooks/useShortcut";
import { client } from "@/store/apiStore";
import { useModelMetaStore } from "@/store/modelMetaStore";
import { usePageActions } from "@/store/pageStore";
import { useServices } from "@/store/servicesStore";
import { useToastActions } from "@/store/toastStore";
import { useUIStateStore } from "@/store/uiStateStore";
import { processImage } from "@/utils/modelManager";

import "./index.css";

interface EditTagsModalProps {
  files: FileMetadata[];
  onClose: () => void;
}

interface TagCount {
  value: string;
  count: number;
  total: number;
}

interface PendingChange {
  tag: string;
  action: ContentUpdateAction;
  serviceKey: string;
}

type TabType = "edit" | "autotag" | "summary";

type TagMap = Map<string, { count: number; total: number }>;

const EditTagsModal: React.FC<EditTagsModalProps> = ({ files, onClose }) => {
  const services = useServices();
  const { refreshFileMetadata } = usePageActions();
  const {
    autotagModel,
    autotagThreshold,
    actions: { setLastActiveTagService, setAutotagModel, setAutotagThreshold },
  } = useUIStateStore();
  const {
    tagModels,
    tagModelNames,
    actions: { loadTagModel },
  } = useModelMetaStore();
  const { addToast, removeToast } = useToastActions();
  const [activeServiceKey, setActiveServiceKey] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("edit");
  const [initialCountsByService, setInitialCountsByService] = useState<
    Record<string, TagMap>
  >({});
  const [tagCountsByService, setTagCountsByService] = useState<
    Record<string, TagCount[]>
  >({});
  const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDiscardModal, setShowDiscardModal] = useState(false);

  const tagServices = useMemo(
    () =>
      Object.entries(services)
        .filter(([, service]) => REAL_TAG_SERVICES.has(service.type))
        .map(([key, service]) => ({ key, ...service }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [services],
  );

  useEffect(() => {
    // If the autotag model is not set or set to something invalid, try to set it to something valid.
    if (!autotagModel || !tagModels[autotagModel]) {
      setAutotagModel(tagModelNames[0] ?? "");
    }
    // Set initial active service to last used service or first available
    if (!activeServiceKey && tagServices.length > 0) {
      // Try to use last active service if it's still available
      const { lastActiveTagService } = useUIStateStore.getState();
      const serviceToUse =
        lastActiveTagService &&
        tagServices.some((service) => service.key === lastActiveTagService)
          ? lastActiveTagService
          : tagServices[0].key;

      setActiveServiceKey(serviceToUse);
    }
  }, [
    tagServices,
    activeServiceKey,
    autotagModel,
    tagModels,
    setAutotagModel,
    tagModelNames,
  ]);

  // Update last active service when it changes
  useEffect(() => {
    if (activeServiceKey) {
      setLastActiveTagService(activeServiceKey);
    }
  }, [activeServiceKey, setLastActiveTagService]);

  // Calculate initial tag counts for each service
  useEffect(() => {
    const countsByService: Record<
      string,
      Map<string, { count: number; total: number }>
    > = {};

    for (const file of files) {
      if (!file.tags) continue;

      for (const [serviceKey, serviceObj] of Object.entries(file.tags)) {
        if (
          !serviceObj.storage_tags ||
          !serviceObj.storage_tags[ContentUpdateAction.ADD]
        )
          continue;

        // Initialize service counts if needed
        if (!countsByService[serviceKey]) {
          countsByService[serviceKey] = new Map();
        }

        for (const tag of serviceObj.storage_tags[ContentUpdateAction.ADD]) {
          const current = countsByService[serviceKey].get(tag) || {
            count: 0,
            total: files.length,
          };
          countsByService[serviceKey].set(tag, {
            ...current,
            count: current.count + 1,
          });
        }
      }
    }

    setInitialCountsByService(countsByService);
  }, [files]);

  useEffect(() => {
    // Make a deep copy of the initial counts
    const countsByService: Record<
      string,
      Map<string, { count: number; total: number }>
    > = {};
    for (const [serviceKey, counts] of Object.entries(initialCountsByService)) {
      countsByService[serviceKey] = new Map(counts);
    }

    // Update tag counts for pending changes
    for (const change of pendingChanges) {
      if (!countsByService[change.serviceKey]) {
        countsByService[change.serviceKey] = new Map();
      }

      const currentCount = countsByService[change.serviceKey].get(
        change.tag,
      ) || {
        count: 0,
        total: files.length,
      };

      countsByService[change.serviceKey].set(change.tag, {
        ...currentCount,
        count: change.action === ContentUpdateAction.ADD ? files.length : 0,
      });
    }

    // Convert to sorted arrays
    const sortedCounts: Record<string, TagCount[]> = {};
    for (const [serviceKey, counts] of Object.entries(countsByService)) {
      sortedCounts[serviceKey] = Array.from(counts.entries())
        .map(([value, { count, total }]) => ({ value, count, total }))
        .sort((a, b) => b.count - a.count);
    }

    setTagCountsByService(sortedCounts);
  }, [initialCountsByService, pendingChanges, files.length]);

  // Handle tag actions
  const handleAddTag = useCallback(
    (tag: string) => {
      if (!activeServiceKey) return;
      if (tag.trim() === "") return;
      setPendingChanges((prev) => {
        // If already pending, do nothing
        if (
          prev.find(
            (change) =>
              change.tag === tag &&
              change.serviceKey === activeServiceKey &&
              change.action === ContentUpdateAction.ADD,
          )
        ) {
          return prev;
        }

        // If already pending to remove, just remove that change
        const existingRemoveIndex = prev.findIndex(
          (change) =>
            change.tag === tag &&
            change.serviceKey === activeServiceKey &&
            change.action === ContentUpdateAction.DELETE,
        );

        if (existingRemoveIndex >= 0) {
          return prev.filter((_, i) => i !== existingRemoveIndex);
        }

        // Otherwise, add new tag
        return [
          ...prev,
          {
            tag,
            action: ContentUpdateAction.ADD,
            serviceKey: activeServiceKey,
          },
        ];
      });
    },
    [activeServiceKey],
  );

  const handleRemoveTag = useCallback(
    (tag: string) => {
      if (!activeServiceKey) return;
      setPendingChanges((prev) => {
        // If already pending to remove, do nothing
        if (
          prev.find(
            (change) =>
              change.tag === tag &&
              change.serviceKey === activeServiceKey &&
              change.action === ContentUpdateAction.DELETE,
          )
        ) {
          return prev;
        }

        // If already pending to add, just remove that change
        const existingAddIndex = prev.findIndex(
          (change) =>
            change.tag === tag &&
            change.serviceKey === activeServiceKey &&
            change.action === ContentUpdateAction.ADD,
        );

        if (existingAddIndex >= 0) {
          return prev.filter((_, i) => i !== existingAddIndex);
        }

        // Otherwise, add new remove change
        return [
          ...prev,
          {
            tag,
            action: ContentUpdateAction.DELETE,
            serviceKey: activeServiceKey,
          },
        ];
      });
    },
    [activeServiceKey],
  );

  // Handle tag input changes
  const handleTagInput = useCallback(
    (tags: string[]) => {
      const newTag = tags[tags.length - 1];
      if (newTag) {
        handleAddTag(newTag);
      }
    },
    [handleAddTag],
  );

  const handleClose = useCallback(() => {
    if (pendingChanges.length > 0) {
      setShowDiscardModal(true);
    } else {
      onClose();
    }
  }, [onClose, pendingChanges.length]);

  useShortcut({
    Escape: handleClose,
  });

  // Get changes summary by service
  const changesByService = useMemo(() => {
    const summary: Record<string, { adds: string[]; removes: string[] }> = {};

    for (const change of pendingChanges) {
      if (!summary[change.serviceKey]) {
        summary[change.serviceKey] = { adds: [], removes: [] };
      }

      if (change.action === ContentUpdateAction.ADD) {
        summary[change.serviceKey].adds.push(change.tag);
      } else if (change.action === ContentUpdateAction.DELETE) {
        summary[change.serviceKey].removes.push(change.tag);
      }
    }

    return summary;
  }, [pendingChanges]);

  // Handle form submission
  const handleSubmit = async () => {
    if (pendingChanges.length === 0) {
      onClose();
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Group changes by service
      const updates: TagUpdates = {};
      for (const change of pendingChanges) {
        if (!updates[change.serviceKey]) {
          updates[change.serviceKey] = {};
        }

        const serviceUpdates = updates[change.serviceKey];
        const actionUpdates = serviceUpdates[change.action] || [];
        serviceUpdates[change.action] = [...actionUpdates, change.tag];
      }

      // Apply all changes at once
      await client.editTags(
        files.map((f) => f.file_id),
        updates,
      );

      // Refresh metadata for all affected files
      await refreshFileMetadata(files.map((f) => f.file_id));

      onClose();
    } catch (error) {
      console.error("Failed to update tags:", error);
      setError(
        error instanceof Error ? error.message : "Failed to update tags",
      );
      setIsSubmitting(false);
    }
  };

  const processAutotag = async () => {
    // TODO: handle multiple images?
    const file = files[0];
    if (!file) {
      return;
    }
    const toast = addToast(`Processing autotag request...`, "info");
    try {
      const imageData = await (
        await fetch(client.getFileUrl(file.file_id))
      ).blob();
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.addEventListener("load", () => {
          resolve(image);
        });
        image.addEventListener("error", (e) => {
          reject(e.error);
        });
        image.src = URL.createObjectURL(imageData);
      });
      const session = await loadTagModel(autotagModel);
      const result = await processImage(session, autotagThreshold, image);
      const existingTags = new Set<string>();
      for (const tag of tagCountsByService[activeServiceKey ?? ""]) {
        if (tag.count === tag.total) {
          existingTags.add(tag.value);
        }
      }
      let existing = 0;
      for (const tag of result.tagResults) {
        if (!existingTags.has(tag.name)) {
          handleAddTag(tag.name);
        } else {
          existing++;
        }
      }
      addToast(
        `Autotag request succeeded: ${result.tagResults.length} tags found (${existing} already set).`,
        "success",
        10000,
      );
    } catch (e) {
      addToast(`Error processing autotag request: ${e}`, "error", 10000);
    } finally {
      removeToast(toast);
    }
  };

  // Check if a tag has pending changes
  const getTagStatus = (tag: TagCount, serviceKey: string) => {
    const lastChange = [...pendingChanges]
      .reverse()
      .find((c) => c.tag === tag.value && c.serviceKey === serviceKey);

    if (!lastChange) return null;
    return lastChange.action;
  };

  return (
    <FocusTrap>
      <div className="edit-tags-modal-container">
        <div className="edit-tags-modal-wrapper">
          <div className="edit-tags-modal-backdrop" onClick={handleClose} />

          <div className="edit-tags-modal-content">
            {/* Header */}
            <div className="edit-tags-modal-header">
              <h2 className="edit-tags-modal-title">
                Edit Tags ({files.length} file{files.length !== 1 ? "s" : ""})
              </h2>
              <button
                onClick={handleClose}
                className="edit-tags-modal-close-button"
              >
                <XMarkIcon className="edit-tags-modal-close-icon" />
              </button>
            </div>

            {/* Tabs */}
            <div className="edit-tags-modal-tabs">
              <div className="edit-tags-modal-tabs-list">
                <button
                  onClick={() => setActiveTab("edit")}
                  className={`edit-tags-modal-tab ${
                    activeTab === "edit"
                      ? "edit-tags-modal-tab-active"
                      : "edit-tags-modal-tab-inactive"
                  }`}
                >
                  Edit Tags
                </button>
                <button
                  onClick={() => setActiveTab("autotag")}
                  className={`edit-tags-modal-tab ${
                    activeTab === "autotag"
                      ? "edit-tags-modal-tab-active"
                      : "edit-tags-modal-tab-inactive"
                  }`}
                >
                  Autotag
                </button>
                <button
                  onClick={() => setActiveTab("summary")}
                  className={`edit-tags-modal-tab ${
                    activeTab === "summary"
                      ? "edit-tags-modal-tab-active"
                      : "edit-tags-modal-tab-inactive"
                  }`}
                >
                  Summary
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="edit-tags-modal-content-area">
              {/* Edit tab */}
              {activeTab === "edit" && (
                <>
                  {/* Service tabs */}
                  <div className="edit-tags-modal-service-tabs">
                    <div className="edit-tags-modal-service-tabs-list">
                      {tagServices.map((service) => (
                        <button
                          key={service.key}
                          onClick={() => setActiveServiceKey(service.key)}
                          className={`edit-tags-modal-service-tab ${
                            service.key === activeServiceKey
                              ? "edit-tags-modal-service-tab-active"
                              : "edit-tags-modal-service-tab-inactive"
                          }`}
                        >
                          {service.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {activeServiceKey ? (
                    <>
                      {/* Tag input */}
                      <TagInput
                        serviceKey={activeServiceKey}
                        value={[]}
                        onChange={handleTagInput}
                        disabled={isSubmitting}
                      />

                      {/* Tag list */}
                      <div className="edit-tags-modal-tag-list">
                        {!tagCountsByService[activeServiceKey] ||
                        tagCountsByService[activeServiceKey].length === 0 ? (
                          <div className="edit-tags-modal-empty-message">
                            No tags
                          </div>
                        ) : (
                          <div className="edit-tags-modal-tag-items">
                            {tagCountsByService[activeServiceKey].map((tag) => {
                              const status = getTagStatus(
                                tag,
                                activeServiceKey,
                              );
                              return (
                                <div
                                  key={tag.value}
                                  className={`edit-tags-modal-tag-item ${
                                    status === ContentUpdateAction.ADD
                                      ? "edit-tags-modal-tag-item-add"
                                      : status === ContentUpdateAction.DELETE
                                        ? "edit-tags-modal-tag-item-remove"
                                        : ""
                                  }`}
                                >
                                  <TagLabel tag={tag.value} />
                                  <div className="edit-tags-modal-tag-item-right">
                                    <span className="edit-tags-modal-tag-count">
                                      {tag.count}/{tag.total}
                                    </span>
                                    <div className="edit-tags-modal-tag-actions">
                                      {tag.count < tag.total && (
                                        <button
                                          onClick={() =>
                                            handleAddTag(tag.value)
                                          }
                                          className="edit-tags-modal-add-button"
                                          title="Add to all files"
                                        >
                                          <PlusIcon className="edit-tags-modal-action-icon" />
                                        </button>
                                      )}
                                      {tag.count > 0 && (
                                        <button
                                          onClick={() =>
                                            handleRemoveTag(tag.value)
                                          }
                                          className="edit-tags-modal-remove-button"
                                          title="Remove from all files"
                                        >
                                          <MinusIcon className="edit-tags-modal-action-icon" />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="edit-tags-modal-empty-message">
                      No tag services available
                    </div>
                  )}
                </>
              )}
              {/* Autotag tab */}
              {activeTab === "autotag" && (
                <div className="edit-tags-modal-autotag-form">
                  <div className="edit-tags-modal-autotag-form-row">
                    <p>
                      <b>Note:</b> Autotagging is experimental. If multiple
                      files are selected, only one of them will be used for
                      detection.
                    </p>
                  </div>
                  <div className="edit-tags-modal-autotag-form-row">
                    <label>Tag Service</label>
                    <div className="edit-tags-modal-autotag-form-control">
                      <select
                        className="edit-tags-modal-autotag-model-select"
                        value={activeServiceKey ?? ""}
                        onChange={(e) =>
                          setActiveServiceKey(e.currentTarget.value)
                        }
                      >
                        {tagServices.map((service) => (
                          <option key={service.key} value={service.key}>
                            {service.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="edit-tags-modal-autotag-form-row">
                    <label>Model</label>
                    <div className="edit-tags-modal-autotag-form-control">
                      <select
                        className="edit-tags-modal-autotag-model-select"
                        value={autotagModel}
                        onChange={(e) => setAutotagModel(e.currentTarget.value)}
                      >
                        {tagModelNames.map((name) => (
                          <option value={name} key={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                      <p>
                        You can configure available tagging models in Settings.
                      </p>
                    </div>
                  </div>
                  <div className="edit-tags-modal-autotag-form-row">
                    <label>Threshold</label>
                    <div className="edit-tags-modal-autotag-form-control">
                      <input
                        className="edit-tags-modal-autotag-number-input"
                        type="number"
                        min="0"
                        max="1"
                        step="0.01"
                        value={autotagThreshold}
                        onChange={(e) =>
                          setAutotagThreshold(Number(e.currentTarget.value))
                        }
                      />
                      <input
                        className="edit-tags-modal-autotag-range-input"
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={autotagThreshold}
                        onChange={(e) =>
                          setAutotagThreshold(Number(e.currentTarget.value))
                        }
                      />
                    </div>
                  </div>
                  <div className="edit-tags-modal-autotag-form-row">
                    <PushButton onClick={processAutotag}>Process</PushButton>
                  </div>
                </div>
              )}
              {/* Summary tab */}
              {activeTab === "summary" && (
                <div className="edit-tags-modal-summary">
                  {Object.entries(changesByService).length === 0 ? (
                    <div className="edit-tags-modal-empty-message">
                      No pending changes
                    </div>
                  ) : (
                    <div className="edit-tags-modal-changes-group">
                      {Object.entries(changesByService).map(
                        ([serviceKey, changes]) => (
                          <div
                            key={serviceKey}
                            className="edit-tags-modal-service-summary"
                          >
                            <h3 className="edit-tags-modal-service-name">
                              {services[serviceKey]?.name}
                            </h3>
                            {changes.adds.length > 0 && (
                              <div className="edit-tags-modal-changes-group">
                                <h4 className="edit-tags-modal-changes-title edit-tags-modal-changes-title-add">
                                  Adding:
                                </h4>
                                <div className="edit-tags-modal-changes-list">
                                  {changes.adds.map((tag) => (
                                    <div
                                      key={tag}
                                      className="edit-tags-modal-change-item-add"
                                    >
                                      <TagLabel tag={tag} />
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            {changes.removes.length > 0 && (
                              <div className="edit-tags-modal-changes-group">
                                <h4 className="edit-tags-modal-changes-title edit-tags-modal-changes-title-remove">
                                  Removing:
                                </h4>
                                <div className="edit-tags-modal-changes-list">
                                  {changes.removes.map((tag) => (
                                    <div
                                      key={tag}
                                      className="edit-tags-modal-change-item-remove"
                                    >
                                      <TagLabel tag={tag} />
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ),
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="edit-tags-modal-footer">
              <div className="edit-tags-modal-footer-content">
                {error ? (
                  <div className="edit-tags-modal-error">{error}</div>
                ) : (
                  <div className="edit-tags-modal-changes-count">
                    {pendingChanges.length} pending change
                    {pendingChanges.length !== 1 ? "s" : ""}
                  </div>
                )}

                <div className="edit-tags-modal-footer-buttons">
                  <PushButton
                    onClick={() => {
                      if (pendingChanges.length > 0) {
                        setShowDiscardModal(true);
                      } else {
                        onClose();
                      }
                    }}
                    variant="secondary"
                    disabled={isSubmitting}
                  >
                    Cancel
                  </PushButton>
                  <PushButton
                    onClick={handleSubmit}
                    variant="primary"
                    disabled={isSubmitting || pendingChanges.length === 0}
                  >
                    {isSubmitting ? (
                      <span className="edit-tags-modal-spinner-container">
                        <div className="edit-tags-modal-spinner" />
                        Saving...
                      </span>
                    ) : (
                      "Save Changes"
                    )}
                  </PushButton>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Discard changes modal */}
        {showDiscardModal && (
          <ConfirmModal
            title="Discard Changes"
            message="You have unsaved changes. Are you sure you want to discard them?"
            confirmLabel="Discard"
            cancelLabel="Keep Editing"
            onConfirm={onClose}
            onCancel={() => setShowDiscardModal(false)}
          />
        )}
      </div>
    </FocusTrap>
  );
};

export default EditTagsModal;
