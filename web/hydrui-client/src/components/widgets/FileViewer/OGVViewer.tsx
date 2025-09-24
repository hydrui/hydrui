// @ts-expect-error No types for ogv :(
import { OGVLoader, OGVPlayer } from "ogv";
import { useEffect, useRef, useState } from "react";

import "./index.css";

OGVLoader.base = "/assets/ogv";

export interface OGVViewerProps {
  fileUrl: string;
  autoPlay?: boolean;
  loop?: boolean;
}

export default function OGVViewer({
  fileUrl,
  autoPlay = true,
  loop = true,
}: OGVViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (containerRef.current) {
      const video = new OGVPlayer(containerRef.current);
      containerRef.current.replaceChildren(video);
      video.src = fileUrl;
      video.muted = true;
      video.style.width = "100%";
      video.style.height = "100%";
      setIsPaused(!autoPlay);
      if (autoPlay) {
        video.play();
      }

      video.addEventListener("ended", () => {
        if (loop) {
          video.currentTime = 0;
          video.play();
          setIsPaused(false);
        }
      });

      video.addEventListener("error", (event: ErrorEvent) => {
        setError(event.error.message);
      });

      video.addEventListener("click", () => {
        if (video.error) {
          setError(video.error.message);
          video.stop();
          return;
        }

        if (video.paused) {
          video.play();
          setIsPaused(false);
        } else {
          video.pause();
          setIsPaused(true);
        }
      });

      video.addEventListener("dblclick", () => {
        if (video.fullscreen) {
          video.exitFullscreen();
        } else {
          video.requestFullscreen();
        }
      });

      video.addEventListener("pause", () => {
        setIsPaused(true);
      });

      video.addEventListener("play", () => {
        setIsPaused(false);
      });
    }
  }, [autoPlay, fileUrl, loop]);

  return (
    <div className="file-viewer-container">
      {/* OGV Player */}
      <div ref={containerRef} className="file-viewer-content" />

      {/* Error Overlay */}
      {error && (
        <div className="viewer-overlay">
          <div className="viewer-error-message">
            Error playing video: {error}
          </div>
        </div>
      )}

      {/* Pause overlay */}
      {isPaused && (
        <div className="pause-overlay">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="pause-icon"
          >
            <path
              fillRule="evenodd"
              d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      )}
    </div>
  );
}
