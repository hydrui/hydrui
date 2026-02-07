// @ts-expect-error No types for ogv :(
import { OGVLoader, OGVPlayer } from "ogv";
import { useEffect, useState } from "react";

import { PlayerChrome } from "./PlayerChrome";
import { StreamFile } from "./StreamFile";

OGVLoader.base = "/assets/ogv";

export interface OGVViewerProps {
  fileUrl: string;
  fileSize: number;
  autoPlay?: boolean;
  loop?: boolean;
}

export default function OGVViewer({
  fileUrl,
  fileSize,
  autoPlay = true,
  loop = true,
}: OGVViewerProps) {
  const [player, setPlayer] = useState<OGVPlayer>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stream = new StreamFile(fileUrl, fileSize);
    const video = new OGVPlayer({
      stream,
    });
    video.src = fileUrl;
    video.muted = false;
    video.style.width = "100%";
    video.style.height = "100%";
    if (autoPlay) {
      video.play();
    }
    video.addEventListener("ended", () => {
      if (loop) {
        video.currentTime = 0;
        video.play();
      }
    });
    video.addEventListener("error", (event: ErrorEvent) => {
      setError(event.error.message);
    });
    setPlayer(video);
    return () => {
      stream.abort();
      video.stop();
    };
  }, [autoPlay, fileSize, fileUrl, loop]);

  return (
    <div className="file-viewer-container">
      {/* OGV Player */}
      {player && <PlayerChrome player={player} />}

      {/* Error Overlay */}
      {error && (
        <div className="viewer-overlay">
          <div className="viewer-error-message">
            Error playing video: {error}
          </div>
        </div>
      )}
    </div>
  );
}
