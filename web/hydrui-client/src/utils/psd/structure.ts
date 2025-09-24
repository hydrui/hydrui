import { PSDColorMode, PSDSectionType } from "./constants";

export interface PSDHeader {
  // '8BPS'
  signature: string;
  // Always 1 for PSD (2 for PSB)
  version: number;
  // Number of channels (1-56)
  channels: number;
  // Height of the image in pixels (1-30000)
  height: number;
  // Width of the image in pixels (1-30000)
  width: number;
  // Bits per channel (1, 8, 16, 32)
  depth: number;
  // Color mode
  colorMode: PSDColorMode;
}

export interface PSDChannelInfo {
  // Channel ID
  id: number;
  // Length of channel data
  length: number;
  // Channel image data (optional, loaded on demand)
  data?: Uint8Array;
}

export interface PSDLayer {
  // Layer index
  index: number;
  // Layer top position
  top: number;
  // Layer left position
  left: number;
  // Layer bottom position
  bottom: number;
  // Layer right position
  right: number;
  // Layer width (derived)
  width: number;
  // Layer height (derived)
  height: number;
  // Layer name
  name: string;
  // Layer opacity (0-255)
  opacity: number;
  // Layer fill opacity (0-255)
  fillOpacity: number;
  // Layer visibility
  visible: boolean;
  // Clipping flag
  clipping: boolean;
  // Blend mode key
  blendMode: string;
  // Layer channels
  channels: PSDChannelInfo[];
  // Layer mask (optional)
  mask?: PSDLayerMask;
  // Layer ID (optional)
  id?: number;
  // Group type
  groupType: PSDSectionType;
}

export interface PSDLayerMask {
  // Mask top position
  top: number;
  // Mask left position
  left: number;
  // Mask bottom position
  bottom: number;
  // Mask right position
  right: number;
  // Default background color
  defaultColor: number;
  // Mask flags
  flags: number;
  // Whether the mask is relative to the layer
  posRelativeToLayer?: boolean;
  // Whether the mask is disabled
  maskDisabled?: boolean;
  // Whether the mask is inverted
  invertMask?: boolean;
  // Whether the mask is from the render
  userMaskFromRender?: boolean;
  // Whether the mask parameters are applied
  parametersApplied?: boolean;
  // Real mask flags
  realFlags?: number;
  // Real mask background color
  realBackgroundColor?: number;
  // Real mask top position
  realTop?: number;
  // Real mask left position
  realLeft?: number;
  // Real mask bottom position
  realBottom?: number;
  // Real mask right position
  realRight?: number;
  // User mask density
  userMaskDensity?: number;
  // User mask feather
  userMaskFeather?: number;
  // Vector mask density
  vectorMaskDensity?: number;
  // Vector mask feather
  vectorMaskFeather?: number;
  // Mask data
  maskData?: Uint8Array;
}

export interface PSDImageResource {
  // Resource ID
  id: number;
  // Resource name
  name: string;
  // Resource data offset
  offset: number;
  // Resource data length
  length: number;
}

export interface PSDDocument {
  header: PSDHeader;
  // Image resources
  resources: PSDImageResource[];
  // Layers
  layers: PSDLayer[];
  // Offset in the file where the layer mask section starts
  layerMaskSectionStart: number;
}

export interface PSDResolutionInfo {
  // Horizontal resolution in pixels per inch
  hRes: number;
  // Horizontal resolution unit
  hResUnit: number;
  // Width unit
  widthUnit: number;
  // Vertical resolution in pixels per inch
  vRes: number;
  // Vertical resolution unit
  vResUnit: number;
  // Height unit
  heightUnit: number;
}

export interface PSDThumbnailResource {
  // Format (usually 1 for JPEG)
  format: number;
  // Thumbnail width
  width: number;
  // Thumbnail height
  height: number;
  // JPEG data for the thumbnail
  jpegData: Uint8Array;
  // Bits per pixel (usually 24)
  bitsPerPixel: number;
}

export interface PSDICCProfileResource {
  // ICC profile data
  iccProfile: Uint8Array;
}
