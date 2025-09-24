import { MinusIcon, PlusIcon, XMarkIcon } from "@heroicons/react/24/solid";
import React, { useCallback, useEffect, useRef, useState } from "react";

import { FileMetadata } from "@/api/types";
import ConfirmModal from "@/components/modals/ConfirmModal/ConfirmModal";
import PushButton from "@/components/widgets/PushButton/PushButton";
import { useShortcut } from "@/hooks/useShortcut";
import { client } from "@/store/apiStore";
import { usePageActions } from "@/store/pageStore";

import "./index.css";

interface EditUrlsModalProps {
  files: FileMetadata[];
  onClose: () => void;
}

interface UrlCount {
  value: string;
  count: number;
  total: number;
}

type UrlMap = Map<string, UrlCount>;

type TabType = "edit" | "summary";

const EditUrlsModal: React.FC<EditUrlsModalProps> = ({ files, onClose }) => {
  const { refreshFileMetadata } = usePageActions();
  const [activeTab, setActiveTab] = useState<TabType>("edit");
  const [initialCounts, setInitialCounts] = useState<UrlMap>(new Map());
  const [urlCounts, setUrlCounts] = useState<UrlCount[]>([]);
  const [urlsToAdd, setUrlsToAdd] = useState<Set<string>>(new Set());
  const [urlsToRemove, setUrlsToRemove] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDiscardModal, setShowDiscardModal] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Calculate initial URL counts
  useEffect(() => {
    const urlCountMap: Map<string, UrlCount> = new Map();

    for (const file of files) {
      if (!file.known_urls) continue;

      for (const url of file.known_urls) {
        const current = urlCountMap.get(url) ?? {
          count: 0,
          total: files.length,
          value: url,
        };

        urlCountMap.set(url, {
          ...current,
          count: current.count + 1,
        });
      }
    }

    setInitialCounts(urlCountMap);
  }, [files]);

  useEffect(() => {
    // Make a deep copy of the initial counts
    const urlCountMap: UrlMap = new Map(initialCounts);

    for (const url of urlsToAdd) {
      urlCountMap.set(url, {
        count: files.length,
        total: files.length,
        value: url,
      });
    }

    for (const url of urlsToRemove) {
      urlCountMap.delete(url);
    }

    // Convert to sorted arrays
    const sortedCounts: UrlCount[] = Array.from(urlCountMap.values())
      .map(({ value, count, total }) => ({ value, count, total }))
      .sort((a, b) => b.count - a.count);

    setUrlCounts(sortedCounts);
  }, [initialCounts, urlsToAdd, urlsToRemove, files.length]);

  // Handle URL actions
  const handleAddUrl = useCallback(
    (url: string) => {
      if (url.trim() === "") return;

      const initialCount = initialCounts.get(url);
      if (urlsToRemove.has(url)) {
        setUrlsToRemove((prev) => {
          const newSet = new Set(prev);
          newSet.delete(url);
          return newSet;
        });
      } else if (
        !urlsToAdd.has(url) &&
        (initialCount === undefined || initialCount.count < files.length)
      ) {
        setUrlsToAdd((prev) => {
          const newSet = new Set(prev);
          newSet.add(url);
          return newSet;
        });
      }
    },
    [initialCounts, urlsToRemove, urlsToAdd, files.length],
  );

  const handleRemoveUrl = useCallback(
    (url: string) => {
      if (urlsToAdd.has(url)) {
        setUrlsToAdd((prev) => {
          const newSet = new Set(prev);
          newSet.delete(url);
          return newSet;
        });
      } else {
        setUrlsToRemove((prev) => {
          const newSet = new Set(prev);
          newSet.add(url);
          return newSet;
        });
      }
    },
    [setUrlsToRemove, setUrlsToAdd, urlsToAdd],
  );

  // Handle form submission
  const handleSubmit = useCallback(async () => {
    if (urlsToAdd.size === 0 && urlsToRemove.size === 0) {
      onClose();
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Apply all changes at once
      await client.associateUrl({
        file_ids: files.map((f) => f.file_id),
        urls_to_add: Array.from(urlsToAdd),
        urls_to_delete: Array.from(urlsToRemove),
        normalise_urls: true,
      });

      // Refresh metadata for all affected files
      await refreshFileMetadata(files.map((f) => f.file_id));

      onClose();
    } catch (error) {
      console.error("Failed to update URLs:", error);
      setError(
        error instanceof Error ? error.message : "Failed to update URLs",
      );
      setIsSubmitting(false);
    }
  }, [urlsToAdd, urlsToRemove, files, onClose, refreshFileMetadata]);

  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!inputRef.current) return;

      if (e.key === "Enter") {
        e.preventDefault();
        handleAddUrl(inputRef.current.value);
        inputRef.current.value = "";
      }
    },
    [handleAddUrl],
  );

  const handleClose = useCallback(() => {
    if (urlsToAdd.size > 0 || urlsToRemove.size > 0) {
      setShowDiscardModal(true);
    } else {
      onClose();
    }
  }, [onClose, urlsToAdd.size, urlsToRemove.size]);

  useShortcut({
    Escape: handleClose,
  });

  return (
    <div className="edit-urls-modal-container">
      <div className="edit-urls-modal-wrapper">
        <div className="edit-urls-modal-backdrop" onClick={handleClose} />

        <div className="edit-urls-modal-content">
          {/* Header */}
          <div className="edit-urls-modal-header">
            <h2 className="edit-urls-modal-title">
              Edit URLs ({files.length} file{files.length !== 1 ? "s" : ""})
            </h2>
            <button
              onClick={() => {
                if (urlsToAdd.size > 0 || urlsToRemove.size > 0) {
                  setShowDiscardModal(true);
                } else {
                  onClose();
                }
              }}
              className="edit-urls-modal-close-button"
            >
              <XMarkIcon className="edit-urls-modal-close-icon" />
            </button>
          </div>

          {/* Tabs */}
          <div className="edit-urls-modal-tabs">
            <div className="edit-urls-modal-tabs-list">
              <button
                onClick={() => setActiveTab("edit")}
                className={`edit-urls-modal-tab ${
                  activeTab === "edit"
                    ? "edit-urls-modal-tab-active"
                    : "edit-urls-modal-tab-inactive"
                }`}
              >
                Edit URLs
              </button>
              <button
                onClick={() => setActiveTab("summary")}
                className={`edit-urls-modal-tab ${
                  activeTab === "summary"
                    ? "edit-urls-modal-tab-active"
                    : "edit-urls-modal-tab-inactive"
                }`}
              >
                Summary
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="edit-urls-modal-content-area">
            {activeTab === "edit" ? (
              <>
                {/* URL input */}
                <div className="edit-urls-modal-url-input-container">
                  <input
                    ref={inputRef}
                    type="text"
                    placeholder="Enter a URL..."
                    className="edit-urls-modal-url-input"
                    disabled={isSubmitting}
                    onKeyDown={handleInputKeyDown}
                  />
                </div>
                {/* URL list */}
                <div className="edit-urls-modal-url-list">
                  {urlCounts.length === 0 ? (
                    <div className="edit-urls-modal-empty-message">No URLs</div>
                  ) : (
                    <div className="edit-urls-modal-url-items">
                      {urlCounts.map((url) => {
                        return (
                          <div
                            key={url.value}
                            className={`edit-urls-modal-url-item ${
                              urlsToAdd.has(url.value)
                                ? "edit-urls-modal-url-item-add"
                                : urlsToRemove.has(url.value)
                                  ? "edit-urls-modal-url-item-remove"
                                  : ""
                            }`}
                          >
                            <div className="edit-urls-modal-url-value">
                              <a
                                href={url.value}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="edit-urls-modal-url-link"
                              >
                                {url.value}
                              </a>
                            </div>
                            <div className="edit-urls-modal-url-item-right">
                              <span className="edit-urls-modal-url-count">
                                {url.count}/{url.total}
                              </span>
                              {url.count < url.total && (
                                <button
                                  onClick={() => handleAddUrl(url.value)}
                                  className="edit-urls-modal-url-add-button"
                                  title="Add to all files"
                                >
                                  <PlusIcon className="h-4 w-4" />
                                </button>
                              )}
                              {url.count > 0 && (
                                <button
                                  onClick={() => handleRemoveUrl(url.value)}
                                  className="edit-urls-modal-url-remove-button"
                                  title="Remove from all files"
                                >
                                  <MinusIcon className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            ) : (
              /* Summary tab */
              <div className="edit-urls-modal-summary">
                {urlsToAdd.size + urlsToRemove.size === 0 ? (
                  <div className="edit-urls-modal-empty-message">
                    No pending changes
                  </div>
                ) : (
                  <div className="edit-urls-modal-changes-group">
                    {urlsToAdd.size > 0 && (
                      <div className="edit-urls-modal-change-section">
                        <h4 className="edit-urls-modal-changes-title edit-urls-modal-changes-title-add">
                          Adding:
                        </h4>
                        <div className="edit-urls-modal-changes-list">
                          {Array.from(urlsToAdd).map((url) => (
                            <div
                              key={url}
                              className="edit-urls-modal-change-item-add"
                            >
                              <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="edit-urls-modal-url-link"
                              >
                                {url}
                              </a>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {urlsToRemove.size > 0 && (
                      <div className="edit-urls-modal-change-section">
                        <h4 className="edit-urls-modal-changes-title edit-urls-modal-changes-title-remove">
                          Removing:
                        </h4>
                        <div className="edit-urls-modal-changes-list">
                          {Array.from(urlsToRemove).map((url) => (
                            <div
                              key={url}
                              className="edit-urls-modal-change-item-remove"
                            >
                              <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="edit-urls-modal-url-link"
                              >
                                {url}
                              </a>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="edit-urls-modal-footer">
            <div className="edit-urls-modal-footer-content">
              {error ? (
                <div className="edit-urls-modal-error">{error}</div>
              ) : (
                <div className="edit-urls-modal-changes-count">
                  {urlsToAdd.size + urlsToRemove.size} pending change
                  {urlsToAdd.size + urlsToRemove.size !== 1 ? "s" : ""}
                </div>
              )}

              <div className="edit-urls-modal-footer-buttons">
                <PushButton
                  onClick={handleClose}
                  variant="secondary"
                  disabled={isSubmitting}
                >
                  Cancel
                </PushButton>
                <PushButton
                  onClick={handleSubmit}
                  disabled={
                    isSubmitting || urlsToAdd.size + urlsToRemove.size === 0
                  }
                  variant="primary"
                >
                  {isSubmitting ? (
                    <span className="edit-urls-modal-spinner-container">
                      <div className="edit-urls-modal-spinner" />
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
  );
};

export default EditUrlsModal;
