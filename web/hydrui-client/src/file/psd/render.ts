import { File } from "hydrui-util/src/stream";

import { PSDBlendMode, PSDSectionType } from "@/file/psd/constants";
import {
  convertPSDLayers,
  generatePSDLayerThumbnail,
} from "@/file/psd/layerUtils";
import { PSDParser } from "@/file/psd/parser";
import { PSDDocument, PSDLayerMask } from "@/file/psd/structure";
import { Layer } from "@/utils/layerTree";

interface LayerRenderData {
  id: string | number;
  index: number;
  imageData: ImageData | null;
  width: number;
  height: number;
  top: number;
  left: number;
  visible: boolean;
  clipping: boolean;
  blendMode: PSDBlendMode;
  opacity: number;
  fillOpacity: number;
  groupType: PSDSectionType;
  mask?: PSDLayerMask | undefined;
}

function getContext2D(
  canvas: OffscreenCanvas | HTMLCanvasElement,
): OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null {
  return canvas.getContext("2d") as
    | OffscreenCanvasRenderingContext2D
    | CanvasRenderingContext2D
    | null;
}

export class PSDRenderer {
  private parser: PSDParser;
  private layerData: LayerRenderData[] = [];
  private layerTree: Layer[] = [];
  private canvas: OffscreenCanvas | HTMLCanvasElement;
  private document: PSDDocument;
  private documentWidth = 0;
  private documentHeight = 0;

  private constructor(
    parser: PSDParser,
    document: PSDDocument,
    canvas: OffscreenCanvas | HTMLCanvasElement,
    private getCanvas: (
      w: number,
      h: number,
    ) => OffscreenCanvas | HTMLCanvasElement,
  ) {
    this.parser = parser;
    this.document = document;
    this.canvas = canvas;
    this.documentWidth = document.header.width;
    this.documentHeight = document.header.height;
    this.layerTree = convertPSDLayers(this.document.layers);
  }

  static async create(
    file: File,
    getCanvas: (w: number, h: number) => OffscreenCanvas | HTMLCanvasElement,
  ) {
    const parser = new PSDParser(file);
    const document = await parser.parse();
    const documentWidth = document.header.width;
    const documentHeight = document.header.height;
    const canvas = getCanvas(documentWidth, documentHeight);
    canvas.width = documentWidth;
    canvas.height = documentHeight;

    return new PSDRenderer(parser, document, canvas, getCanvas);
  }

  getLayerTree(): Layer[] {
    return this.layerTree;
  }

  getDocumentWidth(): number {
    return this.documentWidth;
  }

  getDocumentHeight(): number {
    return this.documentHeight;
  }

  async loadLayerData(onLayerLoad?: (progress: number) => void): Promise<void> {
    this.layerData = [];

    for (let i = this.document.layers.length - 1; i >= 0; i--) {
      const layer = this.document.layers[i]!;
      const layerInfo = await this.parser.loadLayerImageData(layer.index);

      if (layerInfo) {
        const pixelData = this.parser.extractLayerPixels(layerInfo);

        let imageData: ImageData | null = null;
        if (pixelData) {
          imageData = new ImageData(
            pixelData,
            layerInfo.width,
            layerInfo.height,
          );
        }
        this.layerData.push({
          id: layer.id ?? layer.index,
          index: layer.index,
          imageData,
          width: layerInfo.width,
          height: layerInfo.height,
          top: layerInfo.top,
          left: layerInfo.left,
          visible: layerInfo.visible,
          clipping: layerInfo.clipping,
          blendMode: layerInfo.blendMode as PSDBlendMode,
          opacity: layerInfo.opacity,
          fillOpacity: layerInfo.fillOpacity,
          groupType: layer.groupType,
          mask: layerInfo.mask,
        });
      }

      if (onLayerLoad) {
        onLayerLoad(
          (this.document.layers.length - layer.index) /
            this.document.layers.length,
        );
      }

      // Unblock the thread every so often.
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    this.layerData.reverse();
  }

  /**
   * Set the visibility of a layer.
   */
  setLayerVisibility(layerIndex: number, visible: boolean) {
    for (const layer of this.layerData) {
      if (layer.index === layerIndex) {
        layer.visible = visible;
      }
    }
  }

  /**
   * Render the document with compositing to the provided canvas.
   */
  async render(
    onLayerRender?: (progress: number) => void,
  ): Promise<ImageBitmap | null> {
    if (this.layerData.length === 0) return null;

    // Create a stack of canvases for group compositing
    const canvasStack: {
      canvas: OffscreenCanvas | HTMLCanvasElement;
      ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;
      clippingCanvas?: OffscreenCanvas | HTMLCanvasElement;
    }[] = [];

    // Initialize with the main canvas
    const mainCtx = getContext2D(this.canvas);
    if (!mainCtx) return null;
    mainCtx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    canvasStack.push({
      canvas: this.canvas,
      ctx: mainCtx,
    });

    for (let i = this.layerData.length - 1; i >= 0; i--) {
      const layer = this.layerData[i]!;

      onLayerRender?.((this.layerData.length - i - 1) / this.layerData.length);

      if (
        layer.groupType === PSDSectionType.OPEN_FOLDER ||
        layer.groupType === PSDSectionType.CLOSED_FOLDER
      ) {
        if (canvasStack.length > 1) {
          const groupCanvas = canvasStack.pop();
          const targetCanvas = canvasStack[canvasStack.length - 1];
          if (!groupCanvas || !targetCanvas) {
            throw new Error("Canvas stack underflow!");
          }

          if (layer.visible) {
            targetCanvas.ctx.globalAlpha = layer.opacity / 255;
            targetCanvas.ctx.drawImage(groupCanvas.canvas, 0, 0);
            targetCanvas.ctx.globalAlpha = 1.0;
            targetCanvas.clippingCanvas = groupCanvas.canvas;
          } else {
            delete targetCanvas.clippingCanvas;
          }
        }

        continue;
      }

      // Start of a group - create a new canvas for the group
      if (layer.groupType === PSDSectionType.DIVIDER) {
        const groupCanvas = this.getCanvas(
          this.documentWidth,
          this.documentHeight,
        );
        const groupCtx = getContext2D(groupCanvas);

        if (groupCtx) {
          groupCtx.clearRect(0, 0, groupCanvas.width, groupCanvas.height);
          canvasStack.push({
            canvas: groupCanvas,
            ctx: groupCtx,
          });
        }

        continue;
      }

      const currentTarget = canvasStack[canvasStack.length - 1];
      if (!currentTarget) {
        throw new Error("Canvas stack underflow!");
      }
      if (!layer.visible) {
        delete currentTarget.clippingCanvas;
        continue;
      }

      if (!layer.imageData) {
        continue;
      }

      const ctx = currentTarget.ctx;

      const layerCanvas = this.getCanvas(
        this.documentWidth,
        this.documentHeight,
      );
      const layerCtx = getContext2D(layerCanvas);
      if (!layerCtx) continue;

      (layerCtx as CanvasRenderingContext2D).putImageData(
        layer.imageData,
        layer.left,
        layer.top,
      );

      // Raster masks
      if (layer.mask && !layer.mask.maskDisabled) {
        const maskWidth = layer.mask.right - layer.mask.left;
        const maskHeight = layer.mask.bottom - layer.mask.top;

        if (maskWidth > 0 && maskHeight > 0) {
          const maskPixelData = this.parser.extractLayerMask(layer.mask);

          if (maskPixelData) {
            const maskCanvas = this.getCanvas(
              this.documentWidth,
              this.documentHeight,
            );
            const maskCtx = getContext2D(maskCanvas);

            if (maskCtx) {
              const maskImageData = new ImageData(
                maskPixelData,
                maskWidth,
                maskHeight,
              );
              const maskOffsetX = layer.mask.posRelativeToLayer
                ? layer.mask.left + layer.left
                : layer.mask.left;
              const maskOffsetY = layer.mask.posRelativeToLayer
                ? layer.mask.top + layer.top
                : layer.mask.top;
              maskCtx.fillStyle = `rgba(255, 255, 255, ${layer.mask.defaultColor})`;
              maskCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
              maskCtx.putImageData(maskImageData, maskOffsetX, maskOffsetY);
              layerCtx.globalCompositeOperation = "destination-in";
              layerCtx.drawImage(maskCanvas, 0, 0);
            }
          }
        }
      }

      // Clipping layers
      if (layer.clipping) {
        if (!currentTarget.clippingCanvas) {
          continue;
        }

        const clipCanvas = this.getCanvas(
          this.documentWidth,
          this.documentHeight,
        );
        const clipCtx = getContext2D(clipCanvas);
        if (!clipCtx) continue;

        clipCtx.drawImage(layerCanvas, 0, 0);
        clipCtx.globalCompositeOperation = "destination-in";
        clipCtx.drawImage(currentTarget.clippingCanvas, 0, 0);

        layerCtx.globalCompositeOperation = "source-over";
        layerCtx.clearRect(0, 0, layerCanvas.width, layerCanvas.height);
        layerCtx.drawImage(clipCanvas, 0, 0);
      }

      // Compositing
      compositeLayer(
        ctx,
        layerCanvas,
        layerCtx,
        layer.blendMode,
        (layer.opacity / 255) * (layer.fillOpacity / 255),
      );

      // Store the layer canvas for clipping
      if (!layer.clipping) {
        currentTarget.clippingCanvas = layerCanvas;
      }

      // Reset global settings
      ctx.globalAlpha = 1.0;
      ctx.globalCompositeOperation = "source-over";
    }

    onLayerRender?.(1);

    // At this point, we should have just one canvas in the stack
    if (canvasStack.length !== 1) {
      console.warn(
        `Unexpected canvas stack size: ${canvasStack.length}. Some groups may not be properly closed.`,
      );
    }

    if (
      typeof OffscreenCanvas !== "undefined" &&
      this.canvas instanceof OffscreenCanvas
    ) {
      return this.canvas.transferToImageBitmap();
    } else {
      return createImageBitmap(this.canvas);
    }
  }

  async generateLayerThumbnail(
    layerIndex: number,
    width: number,
    height: number,
  ): Promise<ImageBitmap | null> {
    const layer = this.document.layers[layerIndex];
    if (!layer) {
      return null;
    }
    return generatePSDLayerThumbnail(this.getCanvas, this.parser, layer, {
      width,
      height,
    });
  }
}

function applyNonNativeBlendMode(
  destData: ImageData,
  sourceData: ImageData,
  blendMode: PSDBlendMode,
  opacity: number,
): ImageData {
  const result = new ImageData(
    new Uint8ClampedArray(destData.data),
    destData.width,
    destData.height,
  );

  for (let i = 0; i < destData.data.length; i += 4) {
    const dR = destData.data[i]! / 255;
    const dG = destData.data[i + 1]! / 255;
    const dB = destData.data[i + 2]! / 255;
    const dA = destData.data[i + 3]! / 255;

    const sR = sourceData.data[i]! / 255;
    const sG = sourceData.data[i + 1]! / 255;
    const sB = sourceData.data[i + 2]! / 255;
    const sA = sourceData.data[i + 3]! / 255;

    if (sA === 0) continue;

    let r = 0,
      g = 0,
      b = 0;
    switch (blendMode) {
      case PSDBlendMode.LINEAR_BURN:
        r = Math.max(0, dR + sR - 1);
        g = Math.max(0, dG + sG - 1);
        b = Math.max(0, dB + sB - 1);
        break;

      case PSDBlendMode.LINEAR_DODGE:
        r = Math.min(1, dR + sR);
        g = Math.min(1, dG + sG);
        b = Math.min(1, dB + sB);
        break;

      case PSDBlendMode.VIVID_LIGHT:
        r =
          sR <= 0.5
            ? 1 - Math.min(1, (1 - dR) / (2 * sR + 0.000001))
            : Math.min(1, dR / (2 * (1 - sR) + 0.000001));
        g =
          sG <= 0.5
            ? 1 - Math.min(1, (1 - dG) / (2 * sG + 0.000001))
            : Math.min(1, dG / (2 * (1 - sG) + 0.000001));
        b =
          sB <= 0.5
            ? 1 - Math.min(1, (1 - dB) / (2 * sB + 0.000001))
            : Math.min(1, dB / (2 * (1 - sB) + 0.000001));
        break;

      case PSDBlendMode.LINEAR_LIGHT:
        r =
          sR <= 0.5
            ? Math.max(0, dR + 2 * sR - 1)
            : Math.min(1, dR + 2 * sR - 1);
        g =
          sG <= 0.5
            ? Math.max(0, dG + 2 * sG - 1)
            : Math.min(1, dG + 2 * sG - 1);
        b =
          sB <= 0.5
            ? Math.max(0, dB + 2 * sB - 1)
            : Math.min(1, dB + 2 * sB - 1);
        break;

      case PSDBlendMode.PIN_LIGHT:
        r = sR <= 0.5 ? Math.min(dR, 2 * sR) : Math.max(dR, 2 * sR - 1);
        g = sG <= 0.5 ? Math.min(dG, 2 * sG) : Math.max(dG, 2 * sG - 1);
        b = sB <= 0.5 ? Math.min(dB, 2 * sB) : Math.max(dB, 2 * sB - 1);
        break;

      case PSDBlendMode.HARD_MIX:
        r = dR + sR >= 1 ? 1 : 0;
        g = dG + sG >= 1 ? 1 : 0;
        b = dB + sB >= 1 ? 1 : 0;
        break;

      case PSDBlendMode.SUBTRACT:
        r = Math.max(0, dR - sR);
        g = Math.max(0, dG - sG);
        b = Math.max(0, dB - sB);
        break;

      case PSDBlendMode.DIVIDE:
        r = Math.min(1, dR / (sR + 0.000001));
        g = Math.min(1, dG / (sG + 0.000001));
        b = Math.min(1, dB / (sB + 0.000001));
        break;

      case PSDBlendMode.DARKER_COLOR: {
        const dLum = 0.3 * dR + 0.59 * dG + 0.11 * dB;
        const sLum = 0.3 * sR + 0.59 * sG + 0.11 * sB;
        if (sLum < dLum) {
          r = sR;
          g = sG;
          b = sB;
        } else {
          r = dR;
          g = dG;
          b = dB;
        }
        break;
      }

      case PSDBlendMode.LIGHTER_COLOR: {
        const dLum = 0.3 * dR + 0.59 * dG + 0.11 * dB;
        const sLum = 0.3 * sR + 0.59 * sG + 0.11 * sB;
        if (sLum > dLum) {
          r = sR;
          g = sG;
          b = sB;
        } else {
          r = dR;
          g = dG;
          b = dB;
        }
        break;
      }

      case PSDBlendMode.DISSOLVE: {
        if (Math.random() < opacity) {
          r = sR;
          g = sG;
          b = sB;
        } else {
          r = dR;
          g = dG;
          b = dB;
        }
        break;
      }

      case PSDBlendMode.PASS_THROUGH:
      default:
        r = sR;
        g = sG;
        b = sB;
        break;
    }

    // Apply opacity and alpha compositing
    const finalAlpha = sA * opacity + dA * (1 - sA * opacity);
    if (finalAlpha > 0) {
      result.data[i] = Math.round(
        ((r * sA * opacity + dR * dA * (1 - sA * opacity)) / finalAlpha) * 255,
      );
      result.data[i + 1] = Math.round(
        ((g * sA * opacity + dG * dA * (1 - sA * opacity)) / finalAlpha) * 255,
      );
      result.data[i + 2] = Math.round(
        ((b * sA * opacity + dB * dA * (1 - sA * opacity)) / finalAlpha) * 255,
      );
      result.data[i + 3] = Math.round(finalAlpha * 255);
    }
  }

  return result;
}

function compositeNonNativeBlendMode(
  targetCtx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D,
  sourceCtx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D,
  blendMode: PSDBlendMode,
  opacity: number,
) {
  const destData = targetCtx.getImageData(
    0,
    0,
    targetCtx.canvas.width,
    targetCtx.canvas.height,
  );
  const sourceData = sourceCtx.getImageData(
    0,
    0,
    sourceCtx.canvas.width,
    sourceCtx.canvas.height,
  );
  const resultData = applyNonNativeBlendMode(
    destData,
    sourceData,
    blendMode,
    opacity,
  );
  targetCtx.putImageData(resultData, 0, 0);
}

function getCompositeOperationForBlendMode(
  blendMode: PSDBlendMode,
): GlobalCompositeOperation {
  switch (blendMode) {
    case PSDBlendMode.NORMAL:
      return "source-over";
    case PSDBlendMode.MULTIPLY:
      return "multiply";
    case PSDBlendMode.SCREEN:
      return "screen";
    case PSDBlendMode.OVERLAY:
      return "overlay";
    case PSDBlendMode.DARKEN:
      return "darken";
    case PSDBlendMode.LIGHTEN:
      return "lighten";
    case PSDBlendMode.COLOR_DODGE:
      return "color-dodge";
    case PSDBlendMode.COLOR_BURN:
      return "color-burn";
    case PSDBlendMode.HARD_LIGHT:
      return "hard-light";
    case PSDBlendMode.SOFT_LIGHT:
      return "soft-light";
    case PSDBlendMode.DIFFERENCE:
      return "difference";
    case PSDBlendMode.EXCLUSION:
      return "exclusion";
    case PSDBlendMode.HUE:
      return "hue";
    case PSDBlendMode.SATURATION:
      return "saturation";
    case PSDBlendMode.COLOR:
      return "color";
    case PSDBlendMode.LUMINOSITY:
      return "luminosity";
    default:
      return "source-over";
  }
}

function compositeNativeBlendMode(
  targetCtx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D,
  source: OffscreenCanvas | HTMLCanvasElement,
  blendMode: PSDBlendMode,
  opacity: number,
) {
  const compositeOperation = getCompositeOperationForBlendMode(blendMode);
  targetCtx.globalCompositeOperation = compositeOperation;
  targetCtx.globalAlpha = opacity;
  targetCtx.drawImage(source, 0, 0);
}

function compositeLayer(
  targetCtx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D,
  source: OffscreenCanvas | HTMLCanvasElement,
  sourceCtx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D,
  blendMode: PSDBlendMode,
  opacity: number,
) {
  switch (blendMode) {
    case PSDBlendMode.NORMAL:
    case PSDBlendMode.MULTIPLY:
    case PSDBlendMode.SCREEN:
    case PSDBlendMode.OVERLAY:
    case PSDBlendMode.DARKEN:
    case PSDBlendMode.LIGHTEN:
    case PSDBlendMode.COLOR_DODGE:
    case PSDBlendMode.COLOR_BURN:
    case PSDBlendMode.HARD_LIGHT:
    case PSDBlendMode.SOFT_LIGHT:
    case PSDBlendMode.DIFFERENCE:
    case PSDBlendMode.EXCLUSION:
    case PSDBlendMode.HUE:
    case PSDBlendMode.SATURATION:
    case PSDBlendMode.COLOR:
    case PSDBlendMode.LUMINOSITY:
      compositeNativeBlendMode(targetCtx, source, blendMode, opacity);
      break;
    case PSDBlendMode.LINEAR_BURN:
    case PSDBlendMode.LINEAR_DODGE:
    case PSDBlendMode.VIVID_LIGHT:
    case PSDBlendMode.LINEAR_LIGHT:
    case PSDBlendMode.PIN_LIGHT:
    case PSDBlendMode.HARD_MIX:
    case PSDBlendMode.SUBTRACT:
    case PSDBlendMode.DIVIDE:
    case PSDBlendMode.DARKER_COLOR:
    case PSDBlendMode.LIGHTER_COLOR:
    case PSDBlendMode.DISSOLVE:
    case PSDBlendMode.PASS_THROUGH:
      compositeNonNativeBlendMode(targetCtx, sourceCtx, blendMode, opacity);
      break;
    default:
      console.warn(`Unsupported blend mode: ${blendMode}`);
      break;
  }
}
