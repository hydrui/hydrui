import { Layer, LayerThumbnailOptions } from "../layerTree";
import { PSDParser } from "./parser";
import { PSDLayer } from "./structure";

/**
 * Convert PSD layers to generic layer tree structure
 */
export function convertPSDLayers(psdLayers: PSDLayer[]): Layer[] {
  const result: Layer[] = [];
  const groupStack: Layer[] = [];

  for (const [i, layer] of psdLayers.entries()) {
    if (layer.groupType === 1 || layer.groupType === 2) {
      const groupLayer: Layer = {
        id: layer.id ?? -i - 1,
        index: layer.index,
        name: layer.name,
        visible: layer.visible,
        isGroup: true,
        isOpen: layer.groupType === 1,
        children: [],
        sourceData: layer,
      };

      if (groupStack.length > 0) {
        groupStack[groupStack.length - 1]?.children?.push(groupLayer);
      } else {
        result.push(groupLayer);
      }
      groupStack.push(groupLayer);
    } else if (layer.groupType === 3) {
      if (groupStack.length > 0) {
        groupStack.pop();
      }
    } else {
      const genericLayer: Layer = {
        id: layer.id ?? layer.index,
        index: layer.index,
        name: layer.name,
        visible: layer.visible,
        isGroup: false,
        width: layer.width,
        height: layer.height,
        sourceData: layer,
      };

      if (groupStack.length > 0) {
        groupStack[groupStack.length - 1]?.children?.push(genericLayer);
      } else {
        result.push(genericLayer);
      }
    }
  }

  return result;
}

/**
 * Generate a thumbnail for a PSD layer
 */
export async function generatePSDLayerThumbnail(
  getCanvas: (w: number, h: number) => HTMLCanvasElement | OffscreenCanvas,
  parser: PSDParser,
  layer: PSDLayer,
  options: LayerThumbnailOptions,
): Promise<ImageBitmap | null> {
  const layerWithData = await parser.loadLayerImageData(layer.index);
  if (!layerWithData) return null;

  const pixelData = parser.extractLayerPixels(layerWithData);
  if (!pixelData) return null;

  const canvas = getCanvas(
    options.width || layerWithData.width,
    options.height || layerWithData.height,
  );

  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const tempCanvas = getCanvas(layerWithData.width, layerWithData.height);

  const tempCtx = tempCanvas.getContext("2d");
  if (!tempCtx) return null;

  const imageData = new ImageData(
    pixelData,
    layerWithData.width,
    layerWithData.height,
  );

  // This is just a workaround for TypeScript being unable to understand
  // that the calls are valid for either context type.
  (tempCtx as CanvasRenderingContext2D).putImageData(imageData, 0, 0);

  // Calculate scaled dimensions while preserving aspect ratio
  const scale = Math.min(
    canvas.width / layerWithData.width,
    canvas.height / layerWithData.height,
  );
  const scaledWidth = layerWithData.width * scale;
  const scaledHeight = layerWithData.height * scale;

  // Center the image
  const x = (canvas.width - scaledWidth) / 2;
  const y = (canvas.height - scaledHeight) / 2;

  (ctx as CanvasRenderingContext2D).drawImage(
    tempCanvas,
    0,
    0,
    layerWithData.width,
    layerWithData.height,
    x,
    y,
    scaledWidth,
    scaledHeight,
  );

  if (
    typeof OffscreenCanvas !== "undefined" &&
    canvas instanceof OffscreenCanvas
  ) {
    return canvas.transferToImageBitmap();
  } else {
    return createImageBitmap(canvas);
  }
}
