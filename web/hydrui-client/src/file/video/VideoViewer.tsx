import React, { Suspense, lazy, useCallback, useEffect, useState } from "react";

import { FileMetadata } from "@/api/types";
import { client } from "@/store/apiStore";

import "./index.css";

const OGVViewer = lazy(() => import("./OGVViewer"));

interface VideoViewerProps {
  fileId: number;
  fileData: FileMetadata;
  autoPlay?: boolean;
  loop?: boolean;
}

const VideoViewer: React.FC<VideoViewerProps> = ({
  fileId,
  fileData,
  autoPlay = true,
  loop = true,
}) => {
  const fileUrl = client.getFileUrl(fileId);
  const [canPlay, setCanPlay] = useState(false);
  const [useOgv, setUseOgv] = useState(false);

  useEffect(() => {
    if (
      !fileData.mime ||
      (fileData.mime !== "video/ogg" && fileData.mime !== "video/webm")
    ) {
      setCanPlay(false);
      setUseOgv(false);
      return;
    }
    const video = document.createElement("video");
    if (video.canPlayType(fileData.mime) === "") {
      setCanPlay(false);
      setUseOgv(true);
    } else {
      setCanPlay(true);
      setUseOgv(false);
    }
  }, [fileData.mime]);

  const handleCanPlay = useCallback(() => {
    setCanPlay(true);
  }, []);

  const handleError = useCallback(
    (event: React.SyntheticEvent<HTMLVideoElement>) => {
      if (!canPlay) {
        setUseOgv(true);
      }
      if (
        event.currentTarget.error?.code ===
        MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED
      ) {
        setUseOgv(true);
      }
    },
    [canPlay],
  );

  // TODO: The ogv fallback doesn't happen when it sometimes should.
  // Need to debug this on Apple devices in particular, as they seem to throw up
  // on perfectly valid VP8 and VP9 WebM files.
  if (useOgv && fileData.size) {
    return (
      <Suspense fallback={<div>Loading OGV Viewer...</div>}>
        <OGVViewer
          fileUrl={fileUrl}
          fileSize={fileData.size}
          autoPlay={autoPlay}
          loop={loop}
        />
      </Suspense>
    );
  }
  return (
    <video
      src={fileUrl}
      controls
      className="video-viewer"
      autoPlay={autoPlay}
      loop={loop}
      preload="auto"
      onCanPlay={handleCanPlay}
      onError={handleError}
      crossOrigin="anonymous"
    />
  );
};

export default VideoViewer;
