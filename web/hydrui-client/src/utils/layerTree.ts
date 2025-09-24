// Generic layer tree interface for representing layers in different file formats
// This is designed to be format-agnostic so it can be used with PSD, AI, etc.

/**
 * Generic layer interface
 */
export interface Layer {
  id: string | number;
  index: number;
  name: string;
  visible: boolean;
  isGroup: boolean;
  isOpen?: boolean;
  width?: number;
  height?: number;
  children?: Layer[];
  sourceData?: unknown;
}

/**
 * Interface for layer thumbnail generation
 */
export interface LayerThumbnailOptions {
  width: number;
  height: number;
}

/**
 * Type for the thumbnail generator callback
 * This is passed to the LayersPanel to generate thumbnails for each layer
 */
export type ThumbnailGenerator = (
  layer: Layer,
  options: LayerThumbnailOptions,
) => Promise<ImageBitmap | null>;

/**
 * Layer visibility change callback type
 */
export type LayerVisibilityChangeCallback = (
  layer: Layer,
  visible: boolean,
) => void;

/**
 * Layer selection callback type
 */
export type LayerSelectionCallback = (layer: Layer) => void;
