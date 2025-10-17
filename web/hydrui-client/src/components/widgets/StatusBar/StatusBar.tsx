import { XMarkIcon } from "@heroicons/react/24/solid";
import React from "react";

import { usePageStore } from "@/store/pageStore";
import { useSearchStore } from "@/store/searchStore";
import { formatFileSize } from "@/utils/format";

import "./index.css";

const StatusBar: React.FC = () => {
  const { searchTags, searchStatus } = useSearchStore();
  const {
    loadedFiles,
    isLoadingFiles,
    pageType,
    pageName,
    error,
    loadedFileCount,
    totalFileCount,
    actions: { cancelCurrentPageLoad },
  } = usePageStore();

  // Calculate file stats
  const fileStats = loadedFiles.reduce(
    (stats, file) => {
      const totalSize = stats.totalSize + (file.size || 0);
      const mime = file.mime || "";

      if (mime.startsWith("image/")) {
        return { ...stats, images: stats.images + 1, totalSize };
      } else if (mime.startsWith("video/")) {
        return { ...stats, videos: stats.videos + 1, totalSize };
      } else {
        return { ...stats, other: stats.other + 1, totalSize };
      }
    },
    { images: 0, videos: 0, other: 0, totalSize: 0 },
  );

  return (
    <div className="status-bar">
      <div className="status-bar-info">
        <div className="status-bar-section">
          {pageType === "search" ? (
            // Search mode status
            searchStatus === "loading" || isLoadingFiles ? (
              <span className="status-bar-info">
                <div className="status-bar-loading-spinner"></div>
                {isLoadingFiles && loadedFileCount < totalFileCount
                  ? `Loading files (${loadedFileCount} of ${totalFileCount})...`
                  : "Searching..."}
                <button
                  onClick={cancelCurrentPageLoad}
                  className="status-bar-cancel-button"
                  title="Cancel loading"
                >
                  <XMarkIcon className="status-bar-cancel-icon" />
                </button>
              </span>
            ) : searchStatus === "initial" ? (
              <span className="status-bar-text-muted">No search active</span>
            ) : loadedFiles.length > 0 ? (
              <span>
                {loadedFiles.length} file{loadedFiles.length !== 1 ? "s" : ""}
                {searchTags.length > 0 && (
                  <span className="status-bar-text-muted status-bar-text-indent">
                    for {searchTags.join(", ")}
                  </span>
                )}
              </span>
            ) : searchTags.length > 0 ? (
              <span className="status-bar-text-muted">
                No results for {searchTags.join(", ")}
              </span>
            ) : (
              <span className="status-bar-text-muted">No search active</span>
            )
          ) : (
            // Page mode status
            <span className="status-bar-info">
              {pageName && (
                <span className="status-bar-text-highlight">{pageName}:</span>
              )}
              {isLoadingFiles ? (
                <span className="status-bar-info">
                  <div className="status-bar-loading-spinner"></div>
                  {loadedFileCount < totalFileCount
                    ? `Loading files (${loadedFileCount} of ${totalFileCount})...`
                    : "Loading..."}
                  <button
                    onClick={cancelCurrentPageLoad}
                    className="status-bar-cancel-button"
                    title="Cancel loading"
                  >
                    <XMarkIcon className="status-bar-cancel-icon" />
                  </button>
                </span>
              ) : error ? (
                <span className="status-bar-text-error">{error}</span>
              ) : loadedFiles.length > 0 ? (
                `${loadedFiles.length} file${loadedFiles.length !== 1 ? "s" : ""}`
              ) : (
                "No files"
              )}
            </span>
          )}
        </div>

        {loadedFiles.length > 0 &&
          fileStats.images + fileStats.videos + fileStats.other > 0 && (
            <div className="status-bar-file-stats">
              {fileStats.images > 0 && (
                <span className="status-bar-file-stat">
                  {fileStats.images} images
                </span>
              )}
              {fileStats.videos > 0 && (
                <span className="status-bar-file-stat">
                  {fileStats.videos} videos
                </span>
              )}
              {fileStats.other > 0 && <span>{fileStats.other} other</span>}
            </div>
          )}
      </div>

      {fileStats.totalSize > 0 && (
        <div>Total size: {formatFileSize(fileStats.totalSize)}</div>
      )}
    </div>
  );
};

export default StatusBar;
