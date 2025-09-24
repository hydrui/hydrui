import { useCallback, useEffect, useRef, useState } from "react";

import LayersPanel from "@/components/panels/LayersPanel/LayersPanel";
import {
  Layer,
  LayerThumbnailOptions,
  LayerVisibilityChangeCallback,
} from "@/utils/layerTree";
import {
  PSDRenderWorker,
  createPSDRenderWorker,
} from "@/utils/psd/renderWorker";

import "./index.css";

export interface PSDViewerProps {
  fileUrl: string;
}

export default function PSDViewer({ fileUrl }: PSDViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const renderWorkerRef = useRef<PSDRenderWorker | null>(null);
  const ongoingXHR = useRef<XMLHttpRequest | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [loading, setLoading] = useState(true);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [layerTree, setLayerTree] = useState<Layer[]>([]);
  const [isLayersPanelCollapsed, setIsLayersPanelCollapsed] = useState(false);
  const [documentWidth, setDocumentWidth] = useState(0);
  const [documentHeight, setDocumentHeight] = useState(0);
  const [loadProgress, setLoadProgress] = useState<number | null>(null);
  const [renderProgress, setRenderProgress] = useState<number | null>(null);

  // Handle layer visibility toggle
  const handleLayerVisibilityChange: LayerVisibilityChangeCallback = (
    layer,
    visible,
  ) => {
    if (!renderWorkerRef.current) return;
    renderWorkerRef.current.setLayerVisibility(layer.index, visible);
    setRendering(true);
  };

  useEffect(() => {
    const abortController = new AbortController();

    setLoading(true);

    const loadPSD = async () => {
      setLoadProgress(null);
      setRenderProgress(null);

      if (ongoingXHR.current) {
        ongoingXHR.current.abort();
      }

      if (renderWorkerRef.current) {
        renderWorkerRef.current.terminate();
      }

      // Use XMLHttpRequest so we can monitor progress
      renderWorkerRef.current = await createPSDRenderWorker(
        fileUrl,
        {
          onRender: (imageBitmap: ImageBitmap) => {
            setRendering(false);
            setLoading(false);
            setRenderProgress(100);
            if (!canvasRef.current) return;
            const ctx = canvasRef.current.getContext("2d");
            if (!ctx) return;
            ctx.clearRect(
              0,
              0,
              canvasRef.current.width,
              canvasRef.current.height,
            );
            ctx.drawImage(imageBitmap, 0, 0);
          },
          onLoad: (layerTree, documentWidth, documentHeight) => {
            setLayerTree(layerTree);
            setRenderProgress(0);
            setDocumentWidth(documentWidth);
            setDocumentHeight(documentHeight);
          },
          onError: (error) => {
            setError(error.message);
          },
          onLayerLoad: (progress) => {
            setLoadProgress(progress * 100);
          },
          onLayerRender: (progress) => {
            setRenderProgress(progress * 100);
          },
        },
        abortController.signal,
      );
    };

    loadPSD().catch((error) => {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      setError(error.message);
    });

    return () => {
      abortController.abort();
    };
  }, [fileUrl]);

  const thumbnailGenerator = useCallback(
    async (layer: Layer, options: LayerThumbnailOptions) => {
      if (!renderWorkerRef.current) return null;
      return renderWorkerRef.current.generateLayerThumbnail(
        layer.index,
        options.width,
        options.height,
      );
    },
    [],
  );

  return (
    <div ref={containerRef} className="file-viewer-container">
      <div className="file-viewer-content">
        <canvas
          ref={canvasRef}
          className="image-viewer-img"
          width={documentWidth}
          height={documentHeight}
        />
      </div>

      {/* Layers Panel */}
      {!loading && layerTree.length > 0 && (
        <LayersPanel
          layers={layerTree}
          thumbnailGenerator={thumbnailGenerator}
          onVisibilityChange={handleLayerVisibilityChange}
          collapsed={isLayersPanelCollapsed}
          onToggleCollapse={setIsLayersPanelCollapsed}
          thumbnailSize={48}
        />
      )}

      {/* Loading Overlay */}
      {loading && (
        <div className="viewer-overlay">
          <div className="viewer-loading-spinner-container">
            <div className="viewer-loading-spinner"></div>
            <div className="viewer-loading-progress-bar">
              <div
                className="viewer-loading-progress-bar-fill"
                style={{ width: `${loadProgress || 0}%` }}
              ></div>
            </div>
            <div className="viewer-loading-progress-text">
              Loading layers: {Math.round(loadProgress || 0)}%
            </div>
            <div className="viewer-loading-progress-bar">
              <div
                className="viewer-loading-progress-bar-fill"
                style={{ width: `${renderProgress || 0}%` }}
              ></div>
            </div>
            <div className="viewer-loading-progress-text">
              Rendering: {Math.round(renderProgress || 0)}%
            </div>
          </div>
        </div>
      )}

      {/* Rendering Overlay */}
      {rendering && (
        <div className="viewer-overlay">
          {renderProgress !== null && (
            <>
              <div className="viewer-loading-progress-bar">
                <div
                  className="viewer-loading-progress-bar-fill"
                  style={{ width: `${renderProgress}%` }}
                ></div>
              </div>
              <div className="viewer-loading-progress-text">
                Re-rendering: {Math.round(renderProgress)}%
              </div>
            </>
          )}
        </div>
      )}

      {/* Error Overlay */}
      {error && (
        <div className="viewer-overlay">
          <div className="viewer-error-message">Error loading PSD: {error}</div>
        </div>
      )}
    </div>
  );
}
