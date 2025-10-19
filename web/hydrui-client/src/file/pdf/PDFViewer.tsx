import React, { useCallback, useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/esm/Page/AnnotationLayer.css";
import "react-pdf/dist/esm/Page/TextLayer.css";
import type {
  DocumentCallback,
  OnLoadProgressArgs,
} from "react-pdf/dist/esm/shared/types.d.ts";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url),
  import.meta.url,
).href;

interface PDFViewerProps {
  fileUrl: string;
}

export default function PDFViewer({ fileUrl }: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number>();
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const [scale, setScale] = useState(1);
  const [fitToWidth, setFitToWidth] = useState(true);
  const [isEditingScale, setIsEditingScale] = useState(false);
  const [scaleInput, setScaleInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<Error | null>(null);

  const handleDocumentLoadSuccess = useCallback(
    ({ numPages: nextNumPages }: DocumentCallback): void => {
      setNumPages(nextNumPages);
      setLoading(false);
    },
    [],
  );

  const handleDocumentLoadError = useCallback((error: Error): void => {
    setError(error);
    setLoading(false);
  }, []);

  const handleDocumentLoadProgress = useCallback(
    ({ loaded, total }: OnLoadProgressArgs): void => {
      setProgress(Math.round((loaded / total) * 100));
    },
    [],
  );

  useEffect(() => {
    if (containerRef.current) {
      setContainerWidth(containerRef.current.clientWidth);
    }

    const handleResize = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth);
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [containerRef]);

  const zoomIn = () => {
    if (scale < 200) {
      setScale((prev) => prev + 0.25);
    } else if (scale < 1000) {
      setScale((prev) => prev + 0.5);
    } else if (scale < 10000) {
      setScale((prev) => prev + 1);
    } else if (scale < 100000) {
      setScale((prev) => prev + 5);
    }
    setFitToWidth(false);
  };

  const zoomOut = () => {
    setScale((prev) => Math.max(0.25, prev - 0.25));
    setFitToWidth(false);
  };

  const fitWidth = () => {
    setFitToWidth((fitToWidth) => !fitToWidth);
  };

  const handleScaleClick = () => {
    if (!fitToWidth) {
      setScaleInput(Math.round(scale * 100).toString());
      setIsEditingScale(true);
    }
  };

  const handleScaleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setScaleInput(e.target.value);
  };

  const handleScaleInputBlur = () => {
    const newScale = parseInt(scaleInput, 10);
    if (!isNaN(newScale) && newScale > 1 && newScale <= 100000) {
      setScale(newScale / 100);
    }
    setIsEditingScale(false);
  };

  const handleScaleInputKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (e.key === "Enter") {
      e.currentTarget.blur();
    } else if (e.key === "Escape" && isEditingScale) {
      e.preventDefault();
      e.stopPropagation();
      setIsEditingScale(false);
    }
  };

  return (
    <div className="file-viewer-container">
      {/* Controls */}
      <div className="pdf-controls">
        {!fitToWidth && (
          <div className="pdf-control-button" onClick={handleScaleClick}>
            {isEditingScale ? (
              <input
                type="text"
                value={scaleInput}
                onChange={handleScaleInputChange}
                onBlur={handleScaleInputBlur}
                onKeyDown={handleScaleInputKeyDown}
                className="pdf-scale-input"
                autoFocus
              />
            ) : (
              `${Math.round(scale * 100)}%`
            )}
          </div>
        )}
        <button onClick={zoomOut} className="pdf-control-button">
          -
        </button>
        <button
          onClick={fitWidth}
          className={`pdf-control-button ${fitToWidth ? "active" : ""}`}
        >
          Fit
        </button>
        <button onClick={zoomIn} className="pdf-control-button">
          +
        </button>
      </div>

      {/* Document */}
      <div
        className={`file-viewer-content pdf-viewer-content ${loading ? "hidden" : ""}`}
        ref={containerRef}
      >
        <Document
          file={fileUrl}
          onLoadSuccess={handleDocumentLoadSuccess}
          onLoadError={handleDocumentLoadError}
          onLoadProgress={handleDocumentLoadProgress}
        >
          {Array.from(new Array(numPages), (_el, index) => (
            <Page
              key={`page_${index + 1}`}
              pageNumber={index + 1}
              scale={fitToWidth ? 1 : scale}
              {...(fitToWidth ? { width: containerWidth } : {})}
            />
          ))}
        </Document>
      </div>

      {/* Loading Overlay */}
      {loading && (
        <div className="viewer-overlay">
          <div className="viewer-loading-spinner-container">
            <div className="viewer-loading-spinner"></div>
            <div className="viewer-loading-progress-bar">
              <div
                className="viewer-loading-progress-bar-fill"
                style={{ width: `${progress || 0}%` }}
              ></div>
            </div>
            <div className="viewer-loading-progress-text">
              Loading PDF: {Math.round(progress || 0)}%
            </div>
          </div>
        </div>
      )}

      {/* Error Overlay */}
      {error && (
        <div className="viewer-overlay">
          <div className="viewer-error-message">
            Error loading PDF: {error.message}
          </div>
        </div>
      )}
    </div>
  );
}
