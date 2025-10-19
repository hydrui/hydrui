import React, { useEffect, useState } from "react";

import FileRating from "@/components/widgets/FileRating/FileRating";
import FileViewer from "@/components/widgets/FileViewer/FileViewer";
import { useFileRatings } from "@/hooks/useFileRatings";
import { client } from "@/store/apiStore";
import { usePageStore } from "@/store/pageStore";
import { useToastStore } from "@/store/toastStore";
import { formatDuration, formatFileSize } from "@/utils/format";

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
  const { ratings } = useFileRatings(fileData || null);
  const {
    actions: { addToast },
  } = useToastStore();

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
          autoPlay={false}
          loop={false}
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
          <span>
            {fileData.width} × {fileData.height}
          </span>
        </div>
        <div className="file-preview-metadata-row">
          <span className="file-preview-metadata-label">Size:</span>
          <span>{formatFileSize(fileData.size)}</span>
        </div>
        <div className="file-preview-metadata-row">
          <span className="file-preview-metadata-label">Type:</span>
          <span>{fileData.mime}</span>
        </div>
        {fileData.duration && (
          <div className="file-preview-metadata-row">
            <span className="file-preview-metadata-label">Duration:</span>
            <span>{formatDuration(fileData.duration)}</span>
          </div>
        )}

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
