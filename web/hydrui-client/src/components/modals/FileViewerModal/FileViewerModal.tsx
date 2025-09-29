import {
  ArrowDownTrayIcon,
  ArrowTopRightOnSquareIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { FocusTrap } from "focus-trap-react";
import React, { useEffect, useRef, useState } from "react";

import { FileMetadata } from "@/api/types";
import BrokenImageModal from "@/components/modals/BrokenImageModal/BrokenImageModal";
import FileViewer from "@/components/widgets/FileViewer/FileViewer";
import PushButton from "@/components/widgets/PushButton/PushButton";
import { ContentUpdateAction } from "@/constants/contentUpdates";
import { useShortcut } from "@/hooks/useShortcut";
import { client } from "@/store/apiStore";
import { formatDuration, formatFileSize } from "@/utils/format";

import "./index.css";

interface FileViewerModalProps {
  fileId: number;
  fileData: FileMetadata;
  onClose: () => void;
  onPrevious: () => void;
  onNext: () => void;
  hasPrevious: boolean;
  hasNext: boolean;
}

function generateFileName(file: FileMetadata): string {
  let fileName = file.file_id.toString();

  const tagsByNamespace: Record<string, string[]> = {
    creator: [],
    character: [],
    series: [],
    "": [],
  };

  if (file.tags) {
    for (const serviceObj of Object.values(file.tags)) {
      if (
        serviceObj.display_tags &&
        serviceObj.display_tags[ContentUpdateAction.ADD]
      ) {
        for (const tag of serviceObj.display_tags[ContentUpdateAction.ADD]) {
          if (tag.startsWith("::")) {
            tagsByNamespace[""].push(tag.slice(1));
          } else if (tag.startsWith("creator:")) {
            tagsByNamespace["creator"].push(tag.slice(8));
          } else if (tag.startsWith("character:")) {
            tagsByNamespace["character"].push(tag.slice(10));
          } else if (tag.startsWith("series:")) {
            tagsByNamespace["series"].push(tag.slice(7));
          } else {
            if (tag.indexOf(":") > -1) {
              const [, value] = tag.split(":");
              tagsByNamespace[""].push(value);
            } else {
              tagsByNamespace[""].push(tag);
            }
          }
        }
      }
    }
  }

  const orderedTags = [
    ...tagsByNamespace["creator"],
    ...tagsByNamespace["character"],
    ...tagsByNamespace["series"],
    ...tagsByNamespace[""],
  ];

  if (orderedTags.length > 0) {
    fileName += " - " + orderedTags.join(" ");
  }

  // Add extension based on mime type
  if (file.mime) {
    switch (file.mime) {
      case "image/jpeg":
        fileName += ".jpg";
        break;
      case "image/png":
        fileName += ".png";
        break;
      case "image/gif":
        fileName += ".gif";
        break;
      case "image/webp":
        fileName += ".webp";
        break;
      case "image/avif":
        fileName += ".avif";
        break;
      case "audio/ogg":
        fileName += ".ogg";
        break;
      case "audio/mpeg":
        fileName += ".mp3";
        break;
      case "audio/x-wav":
        fileName += ".wav";
        break;
      case "audio/midi":
      case "audio/x-midi":
        fileName += ".midi";
        break;
      case "video/ogg":
        fileName += ".ogv";
        break;
      case "video/mp4":
        fileName += ".mp4";
        break;
      case "video/webm":
        fileName += ".webm";
        break;
      case "video/x-matroska":
        fileName += ".mkv";
        break;
      case "video/x-msvideo":
        fileName += ".avi";
        break;
      case "application/pdf":
        fileName += ".pdf";
        break;
      case "image/vnd.adobe.photoshop":
        fileName += ".psd";
        break;
      case "application/x-shockwave-flash":
        fileName += ".swf";
        break;
    }
  }
  return fileName;
}

const FileViewerModal: React.FC<FileViewerModalProps> = ({
  fileId,
  fileData,
  onClose,
  onPrevious,
  onNext,
  hasPrevious,
  hasNext,
}) => {
  const [isBrokenImageModalOpen, setIsBrokenImageModalOpen] = useState(false);

  // Handle keyboard navigation
  useShortcut({
    Escape: onClose,
    ArrowLeft: onPrevious,
    ArrowRight: onNext,
  });

  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (previewRef.current) {
      previewRef.current.addEventListener("click", (event: MouseEvent) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      });
    }
  }, [onClose, previewRef]);

  const showBrokenImageReport = fileData.mime === "image/vnd.adobe.photoshop";

  return (
    <FocusTrap focusTrapOptions={{ allowOutsideClick: true }}>
      <div className="file-viewer-modal-container">
        {/* Header */}
        <div className="file-viewer-modal-header">
          <div className="file-viewer-modal-file-info">
            {fileData.width &&
              fileData.height &&
              `${fileData.width} × ${fileData.height} • `}
            {fileData.duration && `${formatDuration(fileData.duration)} • `}
            {`${formatFileSize(fileData.size)} • `}
            {`${fileData.mime}`}
          </div>
          <div className="file-viewer-modal-actions">
            {showBrokenImageReport && (
              <PushButton
                variant="muted"
                onClick={() => setIsBrokenImageModalOpen(true)}
              >
                Broken image?
              </PushButton>
            )}
            <a
              href={client.getFileUrl(fileId)}
              target="_blank"
              rel="noopener noreferrer"
              className="file-viewer-modal-action-button"
            >
              <ArrowTopRightOnSquareIcon className="file-viewer-modal-small-icon" />
            </a>
            <a
              href={`${client.getFileUrl(fileId)}&download=true`}
              download={generateFileName(fileData)}
              className="file-viewer-modal-action-button"
            >
              <ArrowDownTrayIcon className="file-viewer-modal-small-icon" />
            </a>
            <button
              onClick={onClose}
              className="file-viewer-modal-action-button"
            >
              <XMarkIcon className="file-viewer-modal-medium-icon" />
            </button>
          </div>
        </div>

        {/* Main content */}
        <div className="file-viewer-modal-content">
          {/* Navigation buttons */}
          <button
            onClick={onPrevious}
            className="file-viewer-modal-nav-button file-viewer-modal-prev-button"
          >
            <ChevronLeftIcon className="file-viewer-modal-large-icon" />
          </button>

          <button
            onClick={onNext}
            className="file-viewer-modal-nav-button file-viewer-modal-next-button"
          >
            <ChevronRightIcon className="file-viewer-modal-large-icon" />
          </button>

          {/* File content */}
          <div className="file-viewer-modal-viewer-container" ref={previewRef}>
            <FileViewer
              fileId={fileId}
              fileData={fileData}
              autoActivate={true}
              navigateLeft={hasPrevious ? onPrevious : undefined}
              navigateRight={hasNext ? onNext : undefined}
            />
          </div>
        </div>

        {isBrokenImageModalOpen && (
          <BrokenImageModal
            onClose={() => setIsBrokenImageModalOpen(false)}
            url={client.getFileUrl(fileId)}
          />
        )}
      </div>
    </FocusTrap>
  );
};

export default FileViewerModal;
