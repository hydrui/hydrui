import React, { useCallback, useEffect, useState } from "react";
import { ErrorBoundary } from "react-error-boundary";

import { FileMetadata } from "@/api/types";
import {
  HydrusFileType,
  categoryFromFiletype,
  filetypeEnumToString,
} from "@/constants/filetypes";
import { ViewDispatcher } from "@/file/dispatch";
import { client } from "@/store/apiStore";
import { usePreferencesStore } from "@/store/preferencesStore";

import Crash from "../Crash/Crash";
import "./index.css";

export interface FileViewerProps {
  fileId: number;
  fileData?: FileMetadata | undefined;

  // Whether or not to automatically activate potentially heavy media players
  autoActivate?: boolean;

  // Whether or not to automatically play videos and animations
  autoPlay?: boolean;

  // Whether or not to loop videos and animations
  loop?: boolean;

  // Whether or not the file is in preview mode
  isPreview?: boolean;

  navigateLeft?: (() => void) | undefined;
  navigateRight?: (() => void) | undefined;
}

const FileViewerImpl: React.FC<FileViewerProps> = ({
  fileId,
  fileData,
  autoActivate = true,
  autoPlay = true,
  loop = true,
  isPreview = false,
  navigateLeft,
  navigateRight,
}) => {
  const {
    autopreviewFileTypes,
    actions: { addAutopreviewFileType },
  } = usePreferencesStore();
  if (!fileData) {
    return <div className="image-viewer-container"></div>;
  }
  const category = categoryFromFiletype(fileData.filetype_enum);
  const shouldAutoActivate =
    autoActivate ||
    (fileData.filetype_enum
      ? autopreviewFileTypes.has(fileData.filetype_enum)
      : false) ||
    (category ? autopreviewFileTypes.has(category) : false);
  return (
    <MediaPlaceholder
      fileId={fileId}
      fileData={fileData}
      autoActivate={shouldAutoActivate}
      onAlwaysAutoActivate={addAutopreviewFileType}
    >
      <ViewDispatcher
        fileId={fileId}
        fileData={fileData}
        autoPlay={autoPlay}
        loop={loop}
        isPreview={isPreview}
        navigateLeft={navigateLeft}
        navigateRight={navigateRight}
      />
    </MediaPlaceholder>
  );
};

interface MediaPlaceholderProps {
  fileId: number;
  fileData: FileMetadata;
  children: React.ReactNode;
  onAlwaysAutoActivate?: (filetype: HydrusFileType) => void;
  autoActivate?: boolean;
}

const MediaPlaceholder: React.FC<MediaPlaceholderProps> = ({
  fileId,
  fileData,
  children,
  onAlwaysAutoActivate,
  autoActivate = true,
}) => {
  const thumbnailUrl = client.getThumbnailUrl(fileId);
  const [isActive, setIsActive] = useState(autoActivate);

  useEffect(() => {
    setIsActive(autoActivate);
  }, [fileId, autoActivate]);

  const handleActivate = useCallback(() => {
    setIsActive(true);
  }, []);

  const handleAutoActivate = useCallback(() => {
    if (fileData.filetype_enum) {
      onAlwaysAutoActivate?.(fileData.filetype_enum);
    }
  }, [fileData.filetype_enum, onAlwaysAutoActivate]);

  if (isActive) {
    return children;
  }

  return (
    <div className="file-viewer-container">
      {/* Blurred thumbnail for background */}
      <div className="media-placeholder-thumbnail">
        <img src={thumbnailUrl} alt="" />
      </div>

      {/* Overlay for activating the media viewer */}
      <div className="media-placeholder-overlay">
        <button
          onClick={handleActivate}
          className="media-placeholder-play-button"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="media-placeholder-play-icon"
          >
            <path
              fillRule="evenodd"
              d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z"
              clipRule="evenodd"
            />
          </svg>
        </button>

        {fileData.filetype_enum && (
          <button
            onClick={handleAutoActivate}
            className="media-placeholder-auto-preview-button"
          >
            Always auto-preview{" "}
            {filetypeEnumToString.get(fileData.filetype_enum)} files
          </button>
        )}
      </div>
    </div>
  );
};

function FileViewer(props: FileViewerProps) {
  const [errorInfo, setErrorInfo] = useState<React.ErrorInfo>();
  return (
    <ErrorBoundary
      fallbackRender={(props) => (
        <Crash componentName="FileViewer" errorInfo={errorInfo} {...props} />
      )}
      onError={(_, errorInfo) => setErrorInfo(errorInfo)}
    >
      <FileViewerImpl {...props} />
    </ErrorBoundary>
  );
}

export default FileViewer;
