import React, { Suspense, lazy, useCallback, useEffect, useState } from "react";
import { ErrorBoundary } from "react-error-boundary";

import { FileMetadata } from "@/api/types";
import { client } from "@/store/apiStore";
import { usePreferencesStore } from "@/store/preferencesStore";

import Crash from "../Crash/Crash";
import ImageViewer from "./ImageViewer";
import VideoViewer from "./VideoViewer";
import "./index.css";

const PDFViewer = lazy(() => import("./PDFViewer"));
const PSDViewer = lazy(() => import("./PSDViewer"));
const SWFViewer = lazy(() => import("./SWFViewer"));

interface FileViewerProps {
  fileId: number;
  fileData: FileMetadata;

  // Whether or not to automatically activate potentially heavy media players
  autoActivate?: boolean;

  // Whether or not to automatically play videos and animations
  autoPlay?: boolean;

  // Whether or not to loop videos and animations
  loop?: boolean;

  navigateLeft?: () => void;
  navigateRight?: () => void;
}

const FileViewerImpl: React.FC<FileViewerProps> = ({
  fileId,
  fileData,
  autoActivate = true,
  autoPlay = true,
  loop = true,
  navigateLeft,
  navigateRight,
}) => {
  const fileUrl = client.getFileUrl(fileId);
  const {
    autopreviewMimeTypes,
    actions: { addAutopreviewMimeType },
  } = usePreferencesStore();

  const shouldAutoActivate =
    autoActivate ||
    (fileData.mime ? autopreviewMimeTypes.has(fileData.mime) : false);

  let player: React.ReactNode;
  if (fileData.mime?.startsWith("application/pdf")) {
    player = (
      <Suspense fallback={<div>Loading PDF Viewer...</div>}>
        <PDFViewer fileUrl={fileUrl} />
      </Suspense>
    );
  } else if (fileData.mime?.startsWith("image/vnd.adobe.photoshop")) {
    player = (
      <Suspense fallback={<div>Loading PSD Viewer...</div>}>
        <PSDViewer fileUrl={fileUrl} />
      </Suspense>
    );
  } else if (fileData.mime?.startsWith("application/x-shockwave-flash")) {
    player = (
      <Suspense fallback={<div>Loading SWF Viewer...</div>}>
        <SWFViewer fileUrl={fileUrl} autoPlay={autoPlay} />
      </Suspense>
    );
  } else if (fileData.mime?.startsWith("video/")) {
    player = (
      <VideoViewer
        fileId={fileId}
        fileData={fileData}
        autoPlay={autoPlay}
        loop={loop}
      />
    );
  } else if (fileData.mime?.startsWith("image/")) {
    player = (
      <ImageViewer
        fileId={fileId}
        fileData={fileData}
        navigateLeft={navigateLeft}
        navigateRight={navigateRight}
      />
    );
  } else {
    player = <div>Unsupported file type</div>;
  }

  return (
    <MediaPlaceholder
      fileId={fileId}
      fileData={fileData}
      autoActivate={shouldAutoActivate}
      onAlwaysAutoActivate={addAutopreviewMimeType}
    >
      {player}
    </MediaPlaceholder>
  );
};

interface MediaPlaceholderProps {
  fileId: number;
  fileData: FileMetadata;
  children: React.ReactNode;
  onAlwaysAutoActivate?: (mime: string) => void;
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
    if (fileData.mime) {
      onAlwaysAutoActivate?.(fileData.mime);
    }
  }, [fileData.mime, onAlwaysAutoActivate]);

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

        {fileData.mime && (
          <button
            onClick={handleAutoActivate}
            className="media-placeholder-auto-preview-button"
          >
            Always auto-preview {fileData.mime} files
          </button>
        )}
      </div>
    </div>
  );
};

function FileViewer(props: React.PropsWithChildren<FileViewerProps>) {
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
