import React, { useEffect, useMemo, useState } from "react";

import FileRating from "@/components/widgets/FileRating/FileRating";
import FileViewer from "@/components/widgets/FileViewer/FileViewer";
import { ServiceType } from "@/constants/services";
import { useFileRatings } from "@/hooks/useFileRatings";
import { client } from "@/store/apiStore";
import { usePageStore } from "@/store/pageStore";
import { useServices } from "@/store/servicesStore";
import { useToastStore } from "@/store/toastStore";
import {
  formatDuration,
  formatFileSize,
  formatTimestamp,
  formatTimestampFull,
} from "@/utils/format";

import { getFileDomains, getFileTimeImported } from "./fileMetadata";
import "./index.css";

const FilePreview: React.FC = () => {
  const {
    activePageKey,
    activeFileByPage,
    loadedFiles,
    fileIdToIndex,
    isLoadingFiles,
    actions: { refreshFileMetadata },
  } = usePageStore();
  const [hasError, setHasError] = useState(false);
  const [updatingServices, setUpdatingServices] = useState<Set<string>>(
    new Set(),
  );
  const activeFileId = activePageKey
    ? activeFileByPage[activePageKey]
    : undefined;
  const activeFileIndex = activeFileId
    ? (fileIdToIndex.get(activeFileId) ?? -1)
    : -1;
  const fileData = loadedFiles[activeFileIndex];
  const services = useServices();
  const { ratings } = useFileRatings(fileData || null);
  const {
    actions: { addToast },
  } = useToastStore();

  const { domains, timeImported } = useMemo(() => {
    if (!fileData) {
      return {
        domains: [],
        timeImported: undefined,
      };
    }
    return {
      domains: getFileDomains(fileData, services),
      timeImported: getFileTimeImported(fileData, services),
    };
  }, [fileData, services]);

  // Reset loading state when file changes
  useEffect(() => {
    setHasError(false);
  }, [activeFileId]);

  const handleRatingChange = async (
    serviceKey: string,
    rating: boolean | number | null,
  ) => {
    if (!activeFileId || activeFileIndex === -1) return;

    setUpdatingServices((prev) => new Set([...prev, serviceKey]));
    try {
      await client.setRating(activeFileId, serviceKey, rating);
      // Refresh file metadata to get updated ratings
      for (let i = 0; i < 10; i++) {
        await refreshFileMetadata([activeFileId]);
        if (
          usePageStore.getState().loadedFiles[activeFileIndex]?.ratings?.[
            serviceKey
          ] === rating
        ) {
          break;
        }
        await new Promise((resolve) =>
          setTimeout(resolve, i < 5 ? 1000 : 5000),
        );
      }
    } catch (error) {
      console.error("Failed to update rating:", error);
      addToast("Failed to update rating", "error");
    } finally {
      setUpdatingServices((prev) => {
        const next = new Set(prev);
        next.delete(serviceKey);
        return next;
      });
    }
  };

  if (!activeFileId) {
    return <div className="file-preview-empty-message">No file selected</div>;
  }

  if (isLoadingFiles && !fileData) {
    return (
      <div className="file-preview-loading">
        <div className="file-preview-spinner"></div>
      </div>
    );
  }

  if (!fileData) {
    return <div className="file-preview-empty-message">File not found</div>;
  }

  return (
    <div className="file-preview-container">
      <div className="file-preview-viewer">
        <FileViewer
          fileId={activeFileId}
          fileData={fileData}
          autoActivate={false}
          isPreview={true}
        />

        {/* Error overlay */}
        {hasError && (
          <div className="file-preview-error-overlay">
            <div className="file-preview-error-message">
              Failed to load file
            </div>
          </div>
        )}
      </div>

      <div className="file-preview-metadata">
        <div className="file-preview-metadata-row">
          <span className="file-preview-metadata-label">Dimensions:</span>
          <span className="file-preview-metadata-value">
            {fileData.width} × {fileData.height}
          </span>
        </div>
        <div className="file-preview-metadata-row">
          <span className="file-preview-metadata-label">Size:</span>
          <span className="file-preview-metadata-value">
            {formatFileSize(fileData.size)}
          </span>
        </div>
        <div className="file-preview-metadata-row">
          <span className="file-preview-metadata-label">Type:</span>
          <span className="file-preview-metadata-value">{fileData.mime}</span>
        </div>
        {fileData.duration && (
          <div className="file-preview-metadata-row">
            <span className="file-preview-metadata-label">Duration:</span>
            <span className="file-preview-metadata-value">
              {formatDuration(Math.ceil(fileData.duration / 1000))}
            </span>
          </div>
        )}
        <div className="file-preview-metadata-row">
          <span className="file-preview-metadata-label">Status:</span>
          <span className="file-preview-metadata-value">
            {fileData.is_deleted
              ? "Deleted"
              : fileData.is_trashed
                ? "Trashed"
                : fileData.is_inbox
                  ? "Inbox"
                  : "Archived"}
          </span>
        </div>
        {domains.length > 0 && (
          <div className="file-preview-metadata-row">
            <span className="file-preview-metadata-label">Domains:</span>
            <span className="file-preview-metadata-value">
              {domains.map((domain, index) => {
                const formattedTime =
                  domain.timeImported !== undefined
                    ? formatTimestampFull(domain.timeImported)
                    : "";
                const timeLabel =
                  domain.type === ServiceType.LOCAL_FILE_TRASH_DOMAIN
                    ? "Trashed"
                    : "Imported";
                return (
                  <React.Fragment key={domain.serviceKey}>
                    {index > 0 && ", "}
                    <span
                      title={
                        formattedTime
                          ? `${timeLabel}: ${formattedTime}`
                          : undefined
                      }
                    >
                      {domain.name}
                    </span>
                  </React.Fragment>
                );
              })}
            </span>
          </div>
        )}
        {(
          [
            ["Imported", timeImported],
            ["Modified", fileData.time_modified],
            ["Archived", fileData.time_archived],
          ] as const
        ).map(([label, timestamp]) => {
          if (timestamp == null) {
            return null;
          }
          const formatted = formatTimestamp(timestamp);
          if (!formatted) {
            return null;
          }
          return (
            <div className="file-preview-metadata-row" key={label}>
              <span className="file-preview-metadata-label">{label}:</span>
              <span
                className="file-preview-metadata-value"
                title={formatTimestampFull(timestamp) || undefined}
              >
                {formatted}
              </span>
            </div>
          );
        })}

        {/* Ratings section */}
        {ratings.length > 0 && (
          <>
            <div className="file-preview-ratings-divider"></div>
            <h3 className="file-preview-ratings-title">Ratings</h3>
            <div className="file-preview-ratings-list">
              {ratings.map((rating) => (
                <div
                  className="file-preview-rating-item"
                  key={rating.serviceKey}
                >
                  <span className="file-preview-rating-label">
                    Rating for {rating.serviceName}:
                  </span>

                  <FileRating
                    rating={rating}
                    readOnly={updatingServices.has(rating.serviceKey)}
                    isLoading={updatingServices.has(rating.serviceKey)}
                    onChange={(value) =>
                      handleRatingChange(rating.serviceKey, value)
                    }
                  />
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default FilePreview;
