import "@ruffle-rs/ruffle";
import { useEffect, useRef, useState } from "react";

// Ruffle currently only ships the selfhosted version of the module, which does
// not have types. We should be able to clean this up substantially once
// ruffle-core is published to npm.
declare global {
  interface RuffleConfig {
    polyfills: boolean;
    autoplay: boolean;
    publicPath: string;
    showSwfDownload: boolean;
  }
  interface PlayerElement extends HTMLElement {
    ruffle(): {
      config?: Partial<RuffleConfig>;
      load(url: string): void;
      resume(): void;
      suspend(): void;
    };
    remove(): void;
    metadata: {
      width: number;
      height: number;
    };
  }
  interface Ruffle {
    createPlayer(): PlayerElement;
  }
  interface RuffleSelfHosted {
    config?: Partial<RuffleConfig>;
    newest(): Ruffle;
  }
  interface Window {
    RufflePlayer: RuffleSelfHosted;
  }
}

let ruffle: Ruffle | null = null;
if (typeof window !== "undefined") {
  window.RufflePlayer = window.RufflePlayer || {};
  window.RufflePlayer.config = {
    autoplay: false,
    publicPath: String(
      new URL("assets/ruffle", new URL(import.meta.env.BASE_URL, document.URL)),
    ),
    polyfills: false,
    showSwfDownload: true,
  };

  ruffle = window.RufflePlayer.newest();
}

export interface SWFViewerProps {
  fileUrl: string;
  autoPlay: boolean;
}

export default function SWFViewer({ fileUrl, autoPlay }: SWFViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current || !ruffle) {
      return;
    }
    const player = ruffle.createPlayer();
    containerRef.current.appendChild(player);
    player.ruffle().load(fileUrl);

    if (autoPlay) {
      player.ruffle().resume();
    }

    player.addEventListener("loadedmetadata", (event) => {
      if (event.currentTarget) {
        const player = event.currentTarget as PlayerElement;
        player.style.width = `${player.metadata.width}px`;
        player.style.height = `${player.metadata.height}px`;
        player.style.maxWidth = "100%";
        player.style.maxHeight = "100%";
      }
    });

    player.addEventListener("error", (event) => {
      setError(event.error.message);
    });

    return () => {
      player.style.display = "none";
      // Ruffle suffers from race conditions when the player is added and removed quickly.
      // A small delay makes it much less likely to happen, especially in strict mode,
      // since strict mode will mount the component multiple times.
      setTimeout(() => {
        player.ruffle().suspend();
        player.remove();
      }, 100);
    };
  }, [autoPlay, fileUrl]);

  return (
    <div className="file-viewer-container">
      {/* Ruffle Player */}
      <div ref={containerRef} className="file-viewer-content" />

      {/* Error Overlay */}
      {error && (
        <div className="viewer-overlay">
          <div className="viewer-error-message">Error playing SWF: {error}</div>
        </div>
      )}
    </div>
  );
}
