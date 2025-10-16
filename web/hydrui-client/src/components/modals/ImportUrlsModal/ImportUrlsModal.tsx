import { MinusIcon, XMarkIcon } from "@heroicons/react/24/solid";
import { FocusTrap } from "focus-trap-react";
import React, { useEffect, useMemo, useState } from "react";

import { AddUrlRequest } from "@/api/types";
import PushButton from "@/components/widgets/PushButton/PushButton";
import TagInput from "@/components/widgets/TagInput/TagInput";
import TagLabel from "@/components/widgets/TagLabel/TagLabel";
import { REAL_TAG_SERVICES } from "@/constants/services";
import { useShortcut } from "@/hooks/useShortcut";
import { client } from "@/store/apiStore";
import { PageType, usePageStore } from "@/store/pageStore";
import { useServicesStore } from "@/store/servicesStore";
import { useToastStore } from "@/store/toastStore";
import { useUIStateStore } from "@/store/uiStateStore";

import "./index.css";

interface ImportUrlModalProps {
  pageKey: string;
  pageType: PageType;
  onClose: () => void;
}

interface TagsByService {
  [serviceKey: string]: string[];
}

const ImportUrlsModal: React.FC<ImportUrlModalProps> = ({
  pageKey,
  pageType,
  onClose,
}) => {
  const { services } = useServicesStore();
  const {
    actions: { updatePageContents },
  } = usePageStore();
  const {
    actions: { addToast },
  } = useToastStore();

  // State for URLs and tags
  const [urls, setUrls] = useState<string[]>([]);
  const [tagsByService, setTagsByService] = useState<TagsByService>({});
  const [activeServiceKey, setActiveServiceKey] = useState<string | null>(null);
  const {
    lastActiveTagService,
    actions: { setLastActiveTagService },
  } = useUIStateStore();
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);

  // Get available tag services
  const tagServices = useMemo(
    () =>
      Object.entries(services)
        .filter(([, service]) => REAL_TAG_SERVICES.has(service.type))
        .map(([key, service]) => ({ key, ...service }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [services],
  );

  // Set initial active service to last used service or first available
  useEffect(() => {
    if (!activeServiceKey && tagServices.length > 0) {
      // Try to use last active service if it's still available
      const serviceToUse =
        lastActiveTagService &&
        tagServices.some((service) => service.key === lastActiveTagService)
          ? lastActiveTagService
          : tagServices[0]?.key;

      setActiveServiceKey(serviceToUse || null);
    }
  }, [tagServices, activeServiceKey, lastActiveTagService]);

  // Update last active service when it changes
  useEffect(() => {
    if (activeServiceKey) {
      setLastActiveTagService(activeServiceKey);
    }
  }, [activeServiceKey, setLastActiveTagService]);

  // Handle URL input
  const handleUrlInput = (text: string) => {
    // Split by newlines and filter out empty lines
    const newUrls = text
      .split("\n")
      .map((url) => url.trim())
      .filter((url) => url.length > 0);
    setUrls(newUrls);
  };

  // Handle tag input for a service
  const handleTagInput = (serviceKey: string, tags: string[]) => {
    setTagsByService((prev) => ({
      ...prev,
      [serviceKey]: tags,
    }));
  };

  const handleRemoveTag = (tag: string) => {
    if (activeServiceKey) {
      setTagsByService((prev) => {
        if (!prev[activeServiceKey]) {
          return prev;
        }
        return {
          ...prev,
          [activeServiceKey]: prev[activeServiceKey].filter((t) => t !== tag),
        };
      });
    }
  };

  // Import URLs with tags
  const handleImport = async () => {
    if (urls.length === 0) return;

    setIsImporting(true);
    setProgress({ completed: 0, total: urls.length });
    setError(null);

    let successCount = 0,
      failureCount = 0;
    try {
      await Promise.all(
        urls.map(async (url) => {
          try {
            const request: AddUrlRequest = {
              url,
              service_keys_to_additional_tags: tagsByService,
              show_destination_page: false,
            };
            if (pageType === "hydrus") {
              request.destination_page_key = pageKey;
            }
            await client.addUrl(request);
            successCount++;
            setProgress((prev) => ({
              ...prev,
              completed: prev.completed + 1,
            }));
          } catch (error) {
            addToast(`Error importing ${url}: ${error}`, "error");
            console.error(`Failed to import URL: ${url}`, error);
            failureCount++;
          }
        }),
      );
      onClose();

      addToast(
        `Import finished. ${successCount} URL(s) imported, ${failureCount} failed.`,
        "success",
      );

      if (pageType === "hydrus") {
        setTimeout(() => {
          updatePageContents(pageKey, pageType, false);
        }, 1000);
      }
    } catch (error) {
      console.error("Failed to import URLs:", error);
      setError("Failed to import URLs. Please try again.");
    } finally {
      setIsImporting(false);
    }
  };

  useShortcut({
    Escape: onClose,
  });

  return (
    <FocusTrap focusTrapOptions={{ allowOutsideClick: true }}>
      <div className="import-urls-modal-container">
        <div className="import-urls-modal-wrapper">
          <div className="import-urls-modal-backdrop" onClick={onClose} />

          <div className="import-urls-modal-content">
            {/* Header */}
            <div className="import-urls-modal-header">
              <h2 className="import-urls-modal-title">Import URLs</h2>
              <button
                onClick={onClose}
                className="import-urls-modal-close-button"
              >
                <XMarkIcon className="import-urls-modal-close-icon" />
              </button>
            </div>

            {/* Content */}
            <div>
              {/* URL input */}
              <div className="import-urls-modal-section import-urls-modal-space-y">
                <label className="import-urls-modal-label">
                  URLs (one per line)
                </label>
                <textarea
                  className="import-urls-modal-textarea"
                  placeholder="Enter URLs here..."
                  onChange={(e) => handleUrlInput(e.target.value)}
                  disabled={isImporting}
                />
              </div>

              {/* Tag services tabs */}
              <div className="import-urls-modal-service-tabs">
                <div className="import-urls-modal-tabs-list">
                  {tagServices.map(({ key, name }) => (
                    <button
                      key={key}
                      onClick={() => setActiveServiceKey(key)}
                      className={`import-urls-modal-tab ${
                        activeServiceKey === key
                          ? "import-urls-modal-tab-active"
                          : "import-urls-modal-tab-inactive"
                      }`}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="import-urls-modal-section import-urls-modal-space-y">
                {/* Tag input for active service */}
                {activeServiceKey && (
                  <TagInput
                    serviceKey={activeServiceKey}
                    value={tagsByService[activeServiceKey] || []}
                    onChange={(tags) => handleTagInput(activeServiceKey, tags)}
                    disabled={isImporting}
                  />
                )}
                {/* Tag list */}
                <div className="import-urls-modal-tag-list">
                  {!activeServiceKey ||
                  !tagsByService[activeServiceKey] ||
                  tagsByService[activeServiceKey].length === 0 ? (
                    <div className="import-urls-modal-empty-message">
                      No tags
                    </div>
                  ) : (
                    <div className="import-urls-modal-tag-items">
                      {tagsByService[activeServiceKey].map((tag) => {
                        return (
                          <div key={tag} className="import-urls-modal-tag-item">
                            <TagLabel tag={tag} />
                            <div className="import-urls-modal-tag-actions">
                              <div className="import-urls-modal-tag-action-buttons">
                                <button
                                  onClick={() => handleRemoveTag(tag)}
                                  className="import-urls-modal-remove-button"
                                  title="Remove from all files"
                                >
                                  <MinusIcon className="import-urls-modal-action-icon" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Error message */}
                {error && (
                  <div className="import-urls-modal-error">{error}</div>
                )}

                {/* Progress */}
                {isImporting && (
                  <div className="import-urls-modal-progress">
                    Importing URLs ({progress.completed} of {progress.total})...
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="import-urls-modal-footer">
              <PushButton
                onClick={onClose}
                variant="secondary"
                disabled={isImporting}
              >
                Cancel
              </PushButton>
              <PushButton
                onClick={handleImport}
                variant="primary"
                disabled={urls.length === 0 || isImporting}
              >
                {isImporting ? "Importing..." : "Import"}
              </PushButton>
            </div>
          </div>
        </div>
      </div>
    </FocusTrap>
  );
};

export default ImportUrlsModal;
