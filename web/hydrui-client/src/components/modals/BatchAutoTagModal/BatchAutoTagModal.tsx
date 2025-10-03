import { XMarkIcon } from "@heroicons/react/24/solid";
import { FocusTrap } from "focus-trap-react";
import React, { useEffect, useMemo, useState } from "react";

import { FileMetadata } from "@/api/types";
import PushButton from "@/components/widgets/PushButton/PushButton";
import { ContentUpdateAction } from "@/constants/contentUpdates";
import { REAL_TAG_SERVICES } from "@/constants/services";
import { useShortcut } from "@/hooks/useShortcut";
import { client } from "@/store/apiStore";
import { useModelMetaStore } from "@/store/modelMetaStore";
import { usePageActions } from "@/store/pageStore";
import { useServices } from "@/store/servicesStore";
import { useToastActions } from "@/store/toastStore";
import { useUIStateStore } from "@/store/uiStateStore";
import { type AutotagWorker } from "@/utils/autotag/worker";
import { isServerMode } from "@/utils/serverMode";

import "./index.css";

interface BatchAutoTagModalProps {
  files: FileMetadata[];
  onClose: () => void;
}

const BatchAutoTagModal: React.FC<BatchAutoTagModalProps> = ({
  files,
  onClose,
}) => {
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
  const { addToast, removeToast, updateToastProgress } = useToastActions();
  const [activeServiceKey, setActiveServiceKey] = useState<string | null>(null);

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

  useShortcut({
    Escape: onClose,
  });

  const processAutotag = async () => {
    if (!activeServiceKey) {
      addToast("No service key set for batch autotag.", "error", 10000);
      return;
    }
    let cancelled = false;
    let abortController: AbortController | null = null;
    if (typeof AbortController !== "undefined") {
      abortController = new AbortController();
    }
    const toast = addToast(
      `Processing batch autotag...`,
      "info",
      undefined,
      () => {
        cancelled = true;
        abortController?.abort();
      },
    );
    let worker: AutotagWorker;
    try {
      worker = await loadTagModel(autotagModel);
    } catch (e) {
      removeToast(toast);
      addToast(`Error loading autotag model: ${e}.`, "error", 10000);
      return;
    }
    onClose();
    try {
      let added = 0;
      let existing = 0;
      let i = 0;
      for (const file of files) {
        if (cancelled) {
          break;
        }
        updateToastProgress(toast, (i++ * 100) / files.length);
        const imageData = await (
          await fetch(client.getFileUrl(file.file_id), {
            signal: abortController?.signal,
          })
        ).blob();
        const result = await worker.processImage(
          autotagThreshold,
          await createImageBitmap(imageData),
        );
        const existingTags = new Set<string>();
        let hasRating = false;
        const serviceTags =
          file.tags?.[activeServiceKey]?.storage_tags?.[
            ContentUpdateAction.ADD
          ];
        if (activeServiceKey && serviceTags) {
          for (const tag of serviceTags) {
            if (tag.startsWith("rating:")) {
              hasRating = true;
            }
            existingTags.add(tag);
          }
        }
        const tagsToAdd: string[] = [];
        for (const tag of result.tagResults) {
          if (tag.name.startsWith("rating:") && hasRating) {
            continue;
          }
          if (!existingTags.has(tag.name)) {
            tagsToAdd.push(tag.name);
            added++;
          } else {
            existing++;
          }
        }
        if (cancelled) {
          break;
        }
        if (tagsToAdd.length > 0) {
          await client.editTags([file.file_id], {
            [activeServiceKey]: {
              [ContentUpdateAction.ADD]: tagsToAdd,
            },
          });
          refreshFileMetadata([file.file_id]);
        }
      }
      addToast(
        `Batch autotag finished: ${added} tags added (${existing} already set).`,
        "success",
        10000,
      );
    } catch (e) {
      addToast(`Error processing autotag request: ${e}`, "error", 10000);
    } finally {
      removeToast(toast);
      // Ensure resources get released.
      worker.release();
    }
  };

  return (
    <FocusTrap focusTrapOptions={{ allowOutsideClick: true }}>
      <div className="batch-autotag-modal-container">
        <div className="batch-autotag-modal-wrapper">
          <div className="batch-autotag-modal-backdrop" onClick={onClose} />

          <div className="batch-autotag-modal-content">
            {/* Header */}
            <div className="batch-autotag-modal-header">
              <h2 className="batch-autotag-modal-title">
                Batch Autotag ({files.length} file
                {files.length !== 1 ? "s" : ""})
              </h2>
              <button
                onClick={onClose}
                className="batch-autotag-modal-close-button"
              >
                <XMarkIcon className="batch-autotag-modal-close-icon" />
              </button>
            </div>

            {/* Content */}
            <div className="batch-autotag-modal-content-area">
              <div className="batch-autotag-modal-form">
                <div className="batch-autotag-modal-form-row">
                  <p>
                    <b>Note:</b> Autotagging is experimental.
                  </p>
                </div>
                {isServerMode ? (
                  <div className="batch-autotag-modal-form-row">
                    <p>
                      <b>
                        Hydrui is in server mode and is not allowed to download
                        models. Please install models in Hydrui → Settings
                        before using Autotag.
                      </b>
                    </p>
                  </div>
                ) : undefined}
                <div className="batch-autotag-modal-form-row">
                  <label>Tag Service</label>
                  <div className="batch-autotag-modal-form-control">
                    <select
                      className="batch-autotag-modal-model-select"
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
                <div className="batch-autotag-modal-form-row">
                  <label>Model</label>
                  <div className="batch-autotag-modal-form-control">
                    <select
                      className="batch-autotag-modal-model-select"
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
                <div className="batch-autotag-modal-form-row">
                  <label>Threshold</label>
                  <div className="batch-autotag-modal-form-control">
                    <input
                      className="batch-autotag-modal-number-input"
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
                      className="batch-autotag-modal-range-input"
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
              </div>
            </div>

            {/* Footer */}
            <div className="batch-autotag-modal-footer">
              <div className="batch-autotag-modal-footer-content">
                <div className="batch-autotag-modal-footer-buttons">
                  <PushButton onClick={onClose} variant="secondary">
                    Cancel
                  </PushButton>
                  <PushButton onClick={processAutotag} variant="primary">
                    Process
                  </PushButton>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </FocusTrap>
  );
};

export default BatchAutoTagModal;
