import React, { useEffect, useState } from "react";

import { client } from "@/store/apiStore";

import "./index.css";

interface ThumbnailProps {
  fileId: number;
  className?: string;
}

export const Thumbnail: React.FC<ThumbnailProps> = React.memo(
  ({ fileId, className }: ThumbnailProps) => {
    const thumbnailUrl = client.getThumbnailUrl(fileId);
    const [isLoading, setIsLoading] = useState(true);
    const [hasError, setHasError] = useState(false);

    useEffect(() => {
      setIsLoading(true);
      setHasError(false);
    }, [fileId]);

    return (
      <div className={className}>
        <div className="thumbnail-container">
          <img
            src={thumbnailUrl}
            alt={`Thumbnail ${fileId}`}
            className="thumbnail-image"
            loading="lazy"
            onLoad={() => setIsLoading(false)}
            onError={() => {
              setIsLoading(false);
              setHasError(true);
            }}
            ref={(img) => {
              if (img && img.complete) {
                setIsLoading(false);
              }
            }}
          />

          {/* Loading overlay */}
          {isLoading && (
            <div className="thumbnail-loading">
              <div className="page-loading-spinner"></div>
            </div>
          )}

          {/* Error overlay */}
          {hasError && (
            <div className="thumbnail-error">
              <div>Failed to load</div>
            </div>
          )}
        </div>
      </div>
    );
  },
);

Thumbnail.displayName = "Thumbnail";
