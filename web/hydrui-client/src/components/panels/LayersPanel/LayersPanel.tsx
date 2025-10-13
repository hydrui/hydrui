import {
  ChevronDownIcon,
  ChevronRightIcon,
  EyeIcon,
  EyeSlashIcon,
  FolderIcon,
  FolderOpenIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import React, { useCallback, useEffect, useRef, useState } from "react";

import {
  Layer,
  LayerSelectionCallback,
  LayerThumbnailOptions,
  LayerVisibilityChangeCallback,
  ThumbnailGenerator,
} from "@/utils/layerTree";

import "./index.css";

interface LayersPanelProps {
  layers: Layer[];
  thumbnailGenerator?: ThumbnailGenerator;
  onVisibilityChange?: LayerVisibilityChangeCallback;
  onLayerSelect?: LayerSelectionCallback;
  collapsed?: boolean;
  onToggleCollapse?: (collapsed: boolean) => void;
  thumbnailSize?: number;
}

/**
 * A panel that displays a tree of layers with thumbnails
 */
const LayersPanel: React.FC<LayersPanelProps> = ({
  layers,
  thumbnailGenerator,
  onVisibilityChange,
  onLayerSelect,
  collapsed = false,
  onToggleCollapse,
  thumbnailSize = 48,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(collapsed);

  // Handle controlled/uncontrolled collapse state
  useEffect(() => {
    setIsCollapsed(collapsed);
  }, [collapsed]);

  // Toggle the collapse state
  const handleToggleCollapse = useCallback(() => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    onToggleCollapse?.(newState);
  }, [isCollapsed, onToggleCollapse]);

  return (
    <div
      className={`layers-panel ${isCollapsed ? "layers-panel-collapsed" : "layers-panel-expanded"}`}
    >
      {/* Header */}
      <div className="layers-panel-header">
        {!isCollapsed && <h3 className="layers-panel-title">Layers</h3>}
        <button
          onClick={handleToggleCollapse}
          className="layers-panel-toggle-button"
          title={isCollapsed ? "Expand" : "Collapse"}
        >
          {isCollapsed ? (
            <ChevronRightIcon className="layers-panel-toggle-icon" />
          ) : (
            <XMarkIcon className="layers-panel-toggle-icon" />
          )}
        </button>
      </div>

      {/* Content - only show when expanded */}
      {!isCollapsed && (
        <div className="layers-panel-content">
          <LayerTree
            layers={layers}
            thumbnailGenerator={thumbnailGenerator}
            thumbnailSize={thumbnailSize}
            onVisibilityChange={onVisibilityChange}
            onLayerSelect={onLayerSelect}
          />
        </div>
      )}
    </div>
  );
};

interface LayerTreeProps {
  layers: Layer[];
  thumbnailGenerator?: ThumbnailGenerator | undefined;
  thumbnailSize?: number;
  onVisibilityChange?: LayerVisibilityChangeCallback | undefined;
  onLayerSelect?: LayerSelectionCallback | undefined;
  level?: number;
}

/**
 * Recursive component for rendering a layer tree
 */
const LayerTree: React.FC<LayerTreeProps> = ({
  layers,
  thumbnailGenerator,
  onVisibilityChange,
  onLayerSelect,
  level = 0,
  thumbnailSize = 48,
}) => {
  if (!layers.length) {
    return <div className="layers-empty-message">No layers available</div>;
  }

  return (
    <div className="layers-tree">
      {layers.map((layer) => (
        <LayerItem
          key={layer.id}
          layer={layer}
          thumbnailGenerator={thumbnailGenerator}
          thumbnailSize={thumbnailSize}
          onVisibilityChange={onVisibilityChange}
          onLayerSelect={onLayerSelect}
          level={level}
        />
      ))}
    </div>
  );
};

interface LayerItemProps {
  layer: Layer;
  thumbnailGenerator?: ThumbnailGenerator | undefined;
  thumbnailSize: number;
  onVisibilityChange?: LayerVisibilityChangeCallback | undefined;
  onLayerSelect?: LayerSelectionCallback | undefined;
  level: number;
}

/**
 * Component for rendering a single layer item
 */
const LayerItem: React.FC<LayerItemProps> = ({
  layer,
  thumbnailGenerator,
  thumbnailSize,
  onVisibilityChange,
  onLayerSelect,
  level,
}) => {
  const [isOpen, setIsOpen] = useState(layer.isOpen ?? false);
  const [thumbnail, setThumbnail] = useState<ImageBitmap | null>(null);
  const [isVisible, setIsVisible] = useState(layer.visible);
  const [isInView, setIsInView] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const itemRef = useRef<HTMLDivElement>(null);

  // TODO: Layer visibility falls out of sync when collapsing/expanding panel.

  useEffect(() => {
    if (!canvasRef.current || !thumbnail) return;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(thumbnail, 0, 0);
  }, [thumbnail]);

  useEffect(() => {
    setIsOpen(layer.isOpen ?? false);
    setIsVisible(layer.visible);
  }, [layer.isOpen, layer.visible]);

  const handleToggleExpand = useCallback(() => {
    setIsOpen(!isOpen);
  }, [isOpen]);

  const handleToggleVisibility = useCallback(() => {
    const newVisibility = !isVisible;
    setIsVisible(newVisibility);
    onVisibilityChange?.(layer, newVisibility);
  }, [isVisible, layer, onVisibilityChange]);

  const handleSelect = useCallback(() => {
    onLayerSelect?.(layer);
  }, [layer, onLayerSelect]);

  useEffect(() => {
    if (!thumbnailGenerator || !itemRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.disconnect();
          }
        }
      },
      { threshold: 0.1 },
    );

    observer.observe(itemRef.current);

    return () => {
      observer.disconnect();
    };
  }, [thumbnailGenerator]);

  useEffect(() => {
    if (!isInView || !thumbnailGenerator || thumbnail) return;

    const loadThumbnail = async () => {
      try {
        const options: LayerThumbnailOptions = {
          width: thumbnailSize,
          height: thumbnailSize,
        };

        const thumbnail = await thumbnailGenerator(layer, options);
        setThumbnail(thumbnail);
      } catch (err) {
        console.error("Error generating thumbnail:", err);
      }
    };

    loadThumbnail();
  }, [isInView, layer, thumbnail, thumbnailGenerator, thumbnailSize]);

  return (
    <div>
      <div
        ref={itemRef}
        className="layers-item"
        style={{ paddingLeft: `${level * 16 + 4}px` }}
        onClick={handleSelect}
      >
        {/* Expand/collapse button for groups */}
        <div className="layers-expand-collapse">
          {layer.isGroup && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleToggleExpand();
              }}
              className="layers-expand-collapse-button"
            >
              {isOpen ? (
                <ChevronDownIcon className="layers-expand-collapse-icon" />
              ) : (
                <ChevronRightIcon className="layers-expand-collapse-icon" />
              )}
            </button>
          )}
        </div>

        {/* Visibility toggle */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleToggleVisibility();
          }}
          className={`layers-visibility-toggle ${!isVisible ? "layers-visibility-toggle-hidden" : ""}`}
        >
          {isVisible ? (
            <EyeIcon className="layers-visibility-icon" />
          ) : (
            <EyeSlashIcon className="layers-visibility-icon" />
          )}
        </button>

        {/* Thumbnail */}
        {!layer.isGroup && thumbnailGenerator ? (
          <div
            className="layers-thumbnail"
            style={{
              width: `${thumbnailSize}px`,
              height: `${thumbnailSize}px`,
            }}
          >
            {thumbnail ? (
              <canvas
                ref={canvasRef}
                className="layers-thumbnail-canvas"
                width={thumbnailSize}
                height={thumbnailSize}
              />
            ) : (
              <div className="layers-thumbnail-loading">
                <div className="layers-thumbnail-loading-spinner"></div>
              </div>
            )}
          </div>
        ) : isOpen ? (
          <FolderOpenIcon className="layers-group-icon" />
        ) : (
          <FolderIcon className="layers-group-icon" />
        )}

        {/* Layer name */}
        <div className="layers-item-name">{layer.name}</div>
      </div>

      {/* Render children if group is open */}
      {layer.isGroup &&
        isOpen &&
        layer.children &&
        layer.children.length > 0 && (
          <LayerTree
            layers={layer.children}
            thumbnailGenerator={thumbnailGenerator}
            thumbnailSize={thumbnailSize}
            onVisibilityChange={onVisibilityChange}
            onLayerSelect={onLayerSelect}
            level={level + 1}
          />
        )}
    </div>
  );
};

export default LayersPanel;
