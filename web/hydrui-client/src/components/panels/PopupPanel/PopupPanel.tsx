import {
  ChevronDownIcon,
  ChevronUpIcon,
  ExclamationCircleIcon,
  WindowIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import React, { useEffect } from "react";

import { JobStatus } from "@/api/types";
import { client } from "@/store/apiStore";
import { usePageActions, usePageStore } from "@/store/pageStore";
import { usePopupStore } from "@/store/popupStore";

import "./index.css";

// Format relative time
const formatRelativeTime = (timestamp: number) => {
  const seconds = Math.floor(Date.now() / 1000 - timestamp);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
};

const PopupPanel: React.FC = () => {
  const {
    jobs,
    isCollapsed,
    hasUnread,
    error,
    actions: {
      setCollapsed,
      setHasUnread,
      dismissJob,
      fetchJobs,
      startPolling,
      stopPolling,
    },
  } = usePopupStore();

  const { addVirtualPage, updateVirtualPage, setPage } = usePageActions();
  const virtualPages = usePageStore((state) => state.virtualPages);

  // Initial fetch and polling setup
  useEffect(() => {
    // Initial fetch
    fetchJobs();

    // Start polling
    startPolling();

    // Cleanup on unmount
    return () => {
      stopPolling();
    };
  }, [fetchJobs, startPolling, stopPolling]);

  const handleExpand = () => {
    setCollapsed(false);
    setHasUnread(false);
  };

  const handleOpenInTab = async (job: JobStatus) => {
    if (!job.files?.hashes?.length) return;

    // Get file IDs for hashes
    const fileIds = (
      await client.getFileIdsByHashes(job.files.hashes)
    ).metadata.map((file) => file.file_id);

    // Create a unique key for the virtual page
    const pageKey = `job-${job.key}`;

    // Check if the page already exists
    if (virtualPages[pageKey]) {
      // Update existing page with new files
      await updateVirtualPage(pageKey, {
        fileIds,
      });
    } else {
      // Add new virtual page
      addVirtualPage(pageKey, {
        name: job.files.label || "Job Results",
        fileIds,
      });
    }
    await setPage(pageKey, "virtual");
  };

  if (isCollapsed) {
    return (
      <button
        onClick={handleExpand}
        className={`popup-collapsed-button ${
          error
            ? "popup-collapsed-button-error"
            : hasUnread
              ? "popup-collapsed-button-unread"
              : "popup-collapsed-button-normal"
        }`}
      >
        {error ? (
          <ExclamationCircleIcon className="popup-collapsed-icon" />
        ) : (
          <ChevronUpIcon className="popup-collapsed-icon" />
        )}
        <span>{error ? "Connection Error" : "Show Messages"}</span>
        {hasUnread && !error && (
          <span className="popup-notification-indicator" />
        )}
      </button>
    );
  }

  return (
    <div className="popup-panel">
      {/* Header */}
      <div className="popup-panel-header">
        <h3 className="popup-panel-title">
          {error ? (
            <span className="popup-panel-error-title">
              <ExclamationCircleIcon className="popup-collapsed-icon" />
              Connection Error
            </span>
          ) : (
            "Messages"
          )}
        </h3>
        <button
          onClick={() => setCollapsed(true)}
          className="popup-panel-close-button"
          title="Collapse"
        >
          <ChevronDownIcon className="popup-panel-close-icon" />
        </button>
      </div>

      {/* Content */}
      <div className="popup-panel-content">
        {error ? (
          <div className="popup-error-message">
            {error}
            <div className="popup-error-retry">
              Will retry in a few seconds...
            </div>
          </div>
        ) : jobs.length === 0 ? (
          <div className="popup-empty-message">No active jobs</div>
        ) : (
          jobs.map((job) => (
            <div
              key={job.key}
              className={`popup-job-item ${job.had_error ? "popup-job-item-error" : ""}`}
            >
              <div className="popup-job-header">
                <div className="popup-job-title-row">
                  <div className="popup-job-title">
                    {job.files?.label || "Job"}
                    {job.is_paused && " (Paused)"}
                    {job.is_cancelled && " (Cancelled)"}
                  </div>
                  <div className="popup-job-meta">
                    <span className="popup-job-time">
                      {formatRelativeTime(job.creation_time)}
                    </span>
                    {job.is_done && (
                      <>
                        {job.files && job.files.hashes && (
                          <button
                            onClick={() => handleOpenInTab(job)}
                            className="popup-job-action-button"
                            title="Open in new tab"
                          >
                            <WindowIcon className="popup-job-action-icon" />
                          </button>
                        )}
                        <button
                          onClick={() => dismissJob(job.key)}
                          className="popup-job-action-button"
                          title="Dismiss"
                        >
                          <XMarkIcon className="popup-job-action-icon" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <div className="popup-job-status">
                  {job.nice_string ||
                    (job.had_error
                      ? "Job failed"
                      : job.is_done
                        ? "Complete"
                        : "In progress...")}
                </div>
                {job.files && job.files.hashes && (
                  <div className="popup-job-file-count">
                    {job.files.hashes.length} file
                    {job.files.hashes.length !== 1 ? "s" : ""}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default PopupPanel;
