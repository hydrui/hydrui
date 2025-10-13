// Basic parser for PSD files.
// https://www.adobe.com/devnet-apps/photoshop/fileformatashtml
import { File } from "hydrui-util/src/stream";

import {
  PSDChannelID,
  PSDColorMode,
  PSDCompressionMethod,
  PSDSectionType,
  PSD_SIGNATURE,
  PSD_VERSION,
  getColorModeName,
} from "./constants";
import { decompressRLERows } from "./packbits";
import { PSDDataStream } from "./stream";
import {
  PSDChannelInfo,
  PSDDocument,
  PSDLayer,
  PSDLayerMask,
} from "./structure";

export class PSDParser {
  private stream: PSDDataStream;
  private document: PSDDocument;

  constructor(file: File) {
    this.stream = new PSDDataStream(file);
    this.document = {
      header: {
        signature: "",
        version: 0,
        channels: 0,
        height: 0,
        width: 0,
        depth: 0,
        colorMode: PSDColorMode.RGB,
      },
      resources: [],
      layers: [],
      layerMaskSectionStart: 0,
    };
  }

  /**
   * Parse the entire PSD file and return the document structure
   */
  async parse(): Promise<PSDDocument> {
    await this.parseHeader();
    await this.parseColorModeData();
    await this.parseImageResources();
    await this.parseLayerAndMaskInfo();
    return this.document;
  }

  /**
   * Parse the PSD file header
   */
  private async parseHeader(): Promise<void> {
    const signature = await this.stream.readString(4);
    if (signature !== PSD_SIGNATURE) {
      throw new Error("Invalid PSD file signature");
    }

    const version = await this.stream.readU16BE();
    if (version !== PSD_VERSION) {
      throw new Error(`Unsupported PSD version: ${version}`);
    }

    // Skip the reserved section (6 bytes of zeros)
    this.stream.skip(6);

    const channels = await this.stream.readU16BE();
    const height = await this.stream.readU32BE();
    const width = await this.stream.readU32BE();
    const depth = await this.stream.readU16BE();
    const colorMode = await this.stream.readU16BE();

    this.document.header = {
      signature,
      version,
      channels,
      height,
      width,
      depth,
      colorMode: colorMode as PSDColorMode,
    };
  }

  /**
   * Parse the color mode data section
   */
  private async parseColorModeData(): Promise<void> {
    const length = await this.stream.readU32BE();

    if (length > 0) {
      // TODO: Implement color mode data parsing
      this.stream.skip(length);
    }
  }

  /**
   * Parse the image resources section
   */
  private async parseImageResources(): Promise<void> {
    const length = await this.stream.readU32BE();
    const endOffset = this.stream.file.position + length;

    while (this.stream.file.position < endOffset) {
      const signature = await this.stream.readString(4);
      if (signature !== "8BIM") {
        throw new Error("Invalid image resource signature");
      }

      const id = await this.stream.readU16BE();
      const name = await this.stream.readPascalString();
      const dataLength = await this.stream.readU32BE();
      const dataStartOffset = this.stream.file.position;
      const paddedLength = dataLength + (dataLength % 2);
      this.stream.skip(dataLength);
      const currentOffset = this.stream.file.position;
      const expectedOffset = dataStartOffset + paddedLength;
      if (currentOffset < expectedOffset) {
        this.stream.skip(expectedOffset - currentOffset);
      }

      this.document.resources.push({
        id,
        name,
        offset: dataStartOffset,
        length: dataLength,
      });
    }
  }

  /**
   * Parse the layer and mask information section
   */
  private async parseLayerAndMaskInfo(): Promise<void> {
    const length = await this.stream.readU32BE();
    if (length === 0) return;

    const endOffset = this.stream.file.position + length;
    this.document.layerMaskSectionStart = this.stream.file.position;
    await this.parseLayerInfo();
    if (this.stream.file.position < endOffset) {
      this.stream.setOffset(endOffset);
    }
  }

  /**
   * Parse the layer information section
   */
  private async parseLayerInfo(): Promise<void> {
    const layerInfoLength = await this.stream.readU32BE();
    if (layerInfoLength === 0) return;
    this.stream.prefetch(this.stream.file.position, layerInfoLength);

    const endOffset = this.stream.file.position + layerInfoLength;
    const layerCount = Math.abs(await this.stream.readI16BE());
    const layers: PSDLayer[] = [];

    // Read all layers
    for (let i = 0; i < layerCount; i++) {
      const top = await this.stream.readI32BE();
      const left = await this.stream.readI32BE();
      const bottom = await this.stream.readI32BE();
      const right = await this.stream.readI32BE();
      const width = right - left;
      const height = bottom - top;

      const channelCount = await this.stream.readU16BE();
      const channels: PSDChannelInfo[] = [];

      for (let j = 0; j < channelCount; j++) {
        const id = await this.stream.readI16BE();
        const length = await this.stream.readU32BE();
        channels.push({ id, length });
      }

      const signature = await this.stream.readString(4);
      if (signature !== "8BIM") {
        throw new Error("Invalid blend mode signature");
      }

      const blendMode = await this.stream.readString(4);
      const opacity = await this.stream.readU8();
      let fillOpacity = 255;
      const clipping = (await this.stream.readU8()) !== 0;
      const flags = await this.stream.readU8();
      const visible = (flags & 0x02) === 0;
      this.stream.skip(1);
      const extraDataLength = await this.stream.readU32BE();
      const extraDataEndOffset = this.stream.file.position + extraDataLength;

      let mask: PSDLayerMask | undefined = undefined;
      const maskLength = await this.stream.readU32BE();
      if (maskLength > 0) {
        mask = {
          top: await this.stream.readI32BE(),
          left: await this.stream.readI32BE(),
          bottom: await this.stream.readI32BE(),
          right: await this.stream.readI32BE(),
          defaultColor: await this.stream.readU8(),
          flags: await this.stream.readU8(),
        };

        // Parse mask flags
        mask.posRelativeToLayer = (mask.flags & 0x01) !== 0;
        mask.maskDisabled = (mask.flags & 0x02) !== 0;
        mask.invertMask = (mask.flags & 0x04) !== 0;
        mask.userMaskFromRender = (mask.flags & 0x08) !== 0;
        mask.parametersApplied = (mask.flags & 0x10) !== 0;

        const maskDataStart = this.stream.file.position;
        const remainingBytes = maskLength - 18;

        if (remainingBytes >= 18 && maskLength >= 36) {
          mask.realFlags = await this.stream.readU8();
          mask.realBackgroundColor = await this.stream.readU8();
          mask.realTop = await this.stream.readI32BE();
          mask.realLeft = await this.stream.readI32BE();
          mask.realBottom = await this.stream.readI32BE();
          mask.realRight = await this.stream.readI32BE();
        }

        if (mask.parametersApplied) {
          const paramFlags = await this.stream.readU8();
          if ((paramFlags & 0x01) !== 0) {
            mask.userMaskDensity = await this.stream.readU8();
          }
          if ((paramFlags & 0x02) !== 0) {
            mask.userMaskFeather = await this.stream.readF64BE();
          }
          if ((paramFlags & 0x04) !== 0) {
            mask.vectorMaskDensity = await this.stream.readU8();
          }
          if ((paramFlags & 0x08) !== 0) {
            mask.vectorMaskFeather = await this.stream.readF64BE();
          }
        }

        const bytesRead = this.stream.file.position - maskDataStart;

        if (remainingBytes > bytesRead) {
          this.stream.skip(remainingBytes - bytesRead);
        }
      }

      const blendingRangesLength = await this.stream.readU32BE();
      this.stream.skip(blendingRangesLength);

      let name = await this.stream.readPascalString(4);
      let id: number | undefined = undefined;
      let groupType = PSDSectionType.NORMAL;

      while (this.stream.file.position < extraDataEndOffset) {
        const signature = await this.stream.readString(4);
        if (signature !== "8BIM" && signature !== "8B64") {
          break;
        }

        const key = await this.stream.readString(4);
        const dataLength = await this.stream.readU32BE();
        const dataEnd = this.stream.file.position + dataLength;

        switch (key) {
          case "luni": {
            name = await this.stream.readUnicodeString();
            break;
          }
          case "lyid": {
            id = await this.stream.readU32BE();
            break;
          }
          case "lsct": {
            const sectionType = await this.stream.readU32BE();
            groupType = sectionType;
            break;
          }
          case "iOpa": {
            fillOpacity = await this.stream.readU8();
            break;
          }
          default:
            this.stream.skip(dataLength);
        }
        if (this.stream.file.position < dataEnd) {
          this.stream.setOffset(dataEnd);
        }
      }

      if (this.stream.file.position < extraDataEndOffset) {
        this.stream.setOffset(extraDataEndOffset);
      }

      layers.push({
        index: layerCount - i - 1,
        top,
        left,
        bottom,
        right,
        width,
        height,
        channels,
        blendMode,
        opacity,
        fillOpacity,
        visible,
        clipping,
        name,
        mask,
        id,
        groupType,
      });
    }

    if (this.stream.file.position < endOffset) {
      this.stream.setOffset(endOffset);
    }

    this.document.layers = layers.reverse();
  }

  /**
   * Load the image data for a specific layer
   * @param layerIndex Index of the layer to load
   * @returns Layer with loaded image data in the channels
   */
  async loadLayerImageData(layerIndex: number): Promise<PSDLayer | null> {
    if (!this.document.header) return null;

    if (layerIndex < 0 || layerIndex >= this.document.layers.length) {
      return null;
    }

    const layer = this.document.layers[layerIndex];

    if (layer.width <= 0 || layer.height <= 0) {
      return layer;
    }

    try {
      const stream = await this.seekToLayerChannelData(layerIndex);

      for (let i = 0; i < layer.channels.length; i++) {
        const channel = layer.channels[i];
        const compressionMethod = await stream.readU16BE();
        const dataSizeWithoutHeader = channel.length - 2;

        if (compressionMethod === PSDCompressionMethod.RAW) {
          channel.data = await stream.readBuffer(dataSizeWithoutHeader);
        } else if (compressionMethod === PSDCompressionMethod.RLE) {
          const rowLengths: number[] = [];
          let height = layer.height;
          if (channel.id === PSDChannelID.MASK && layer.mask) {
            height = layer.mask.bottom - layer.mask.top;
          } else if (
            channel.id === PSDChannelID.REAL_MASK &&
            layer.mask &&
            layer.mask.realBottom !== undefined &&
            layer.mask.realTop !== undefined
          ) {
            height = layer.mask.realBottom - layer.mask.realTop;
          }

          stream.prefetch(0, height * 2);
          for (let j = 0; j < height; j++) {
            rowLengths.push(await stream.readU16BE());
          }

          const compressedData = await stream.readBuffer(
            dataSizeWithoutHeader - height * 2,
          );

          let width = layer.width;
          if (channel.id === PSDChannelID.MASK && layer.mask) {
            width = layer.mask.right - layer.mask.left;
          } else if (
            channel.id === PSDChannelID.REAL_MASK &&
            layer.mask &&
            layer.mask.realRight !== undefined &&
            layer.mask.realLeft !== undefined
          ) {
            width = layer.mask.realRight - layer.mask.realLeft;
          }

          channel.data = decompressRLERows(compressedData, rowLengths, width);

          // If this is a mask channel, store the data in the mask property
          if (channel.id === PSDChannelID.MASK && layer.mask) {
            layer.mask.maskData = channel.data;
          }
        } else if (
          compressionMethod === PSDCompressionMethod.ZIP ||
          compressionMethod === PSDCompressionMethod.ZIP_PRED
        ) {
          throw new Error("PSD ZIP compression not implemented.");
        }
      }

      return layer;
    } catch (error) {
      throw new Error(`Error loading layer image data: ${error}`);
    }
  }

  /**
   * Locate the channel data for a specific layer
   * @param layerIndex Index of the layer to locate
   */
  private async seekToLayerChannelData(
    layerIndex: number,
  ): Promise<PSDDataStream> {
    if (!this.document.layerMaskSectionStart) {
      throw new Error("Layer mask section offset not found");
    }

    const stream = this.stream.newCursor(this.document.layerMaskSectionStart);

    const layerInfoSize = await stream.readU32BE();
    if (layerInfoSize === 0) {
      throw new Error("No layer info found");
    }

    const layerCount = Math.abs(await stream.readI16BE());
    if (layerIndex >= layerCount) {
      throw new Error(
        `Layer index ${layerIndex} out of bounds (max: ${layerCount - 1})`,
      );
    }
    const targetLayer = this.document.layers.length - 1 - layerIndex;

    for (let i = 0; i < layerCount; i++) {
      stream.skip(16);
      const numChannels = await stream.readU16BE();
      stream.skip(numChannels * 6 + 12);
      const extraDataLength = await stream.readU32BE();
      stream.skip(extraDataLength);
    }

    for (let i = 0; i < layerCount; i++) {
      if (i === targetLayer) {
        break;
      }

      const layer = this.document.layers[this.document.layers.length - 1 - i];
      for (const channel of layer.channels) {
        stream.skip(channel.length);
      }
    }

    return stream;
  }

  /**
   * Extract RGBA pixel data from a layer after loading its channel data
   * @param layer The layer with loaded channel data
   * @returns RGBA pixel data as Uint8ClampedArray or null if data couldn't be extracted
   */
  extractLayerPixels(layer: PSDLayer): Uint8ClampedArray | null {
    if (!this.document.header) return null;
    if (layer.width <= 0 || layer.height <= 0) return null;

    const { width, height } = layer;
    const { colorMode } = this.document.header;
    const pixelData = new Uint8ClampedArray(width * height * 4);
    const channels: Record<string, PSDChannelInfo | undefined> = {};

    for (const channel of layer.channels) {
      if (!channel.data) continue;

      switch (channel.id) {
        case PSDChannelID.RED:
          channels["red"] = channel;
          break;
        case PSDChannelID.GREEN:
          channels["green"] = channel;
          break;
        case PSDChannelID.BLUE:
          channels["blue"] = channel;
          break;
        case PSDChannelID.ALPHA:
          channels["alpha"] = channel;
          break;
        case PSDChannelID.MASK:
          if (layer.mask) {
            layer.mask.maskData = channel.data;
          }
          break;
        case PSDChannelID.REAL_MASK:
          break;
        case 0:
          // For grayscale, use the first channel
          channels["gray"] = channel;
          break;
      }
    }

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const pos = y * width + x;
        const pixelPos = pos * 4;

        pixelData[pixelPos] = 255;
        pixelData[pixelPos + 1] = 255;
        pixelData[pixelPos + 2] = 255;
        pixelData[pixelPos + 3] = 255;

        switch (colorMode) {
          case PSDColorMode.RGB: {
            if (channels["red"]?.data) {
              pixelData[pixelPos] = channels["red"].data[pos];
            }
            if (channels["green"]?.data) {
              pixelData[pixelPos + 1] = channels["green"].data[pos];
            }
            if (channels["blue"]?.data) {
              pixelData[pixelPos + 2] = channels["blue"].data[pos];
            }
            if (channels["alpha"]?.data) {
              pixelData[pixelPos + 3] = channels["alpha"].data[pos];
            }
            break;
          }

          case PSDColorMode.GRAYSCALE: {
            if (channels["gray"]?.data) {
              const grayValue = channels["gray"].data[pos];
              pixelData[pixelPos] = grayValue;
              pixelData[pixelPos + 1] = grayValue;
              pixelData[pixelPos + 2] = grayValue;
              if (channels["alpha"]?.data) {
                pixelData[pixelPos + 3] = channels["alpha"].data[pos];
              }
            }
            break;
          }

          default:
            throw new Error(
              `Conversion from ${getColorModeName(colorMode)} to RGBA not implemented`,
            );
        }
      }
    }

    return pixelData;
  }

  /**
   * Extract mask pixel data from a layer after loading its channel data
   * @param layer The layer with loaded channel data
   * @returns Mask pixel data (RGBA) as Uint8ClampedArray, or null if no mask exists
   */
  extractLayerMask(mask: PSDLayerMask): Uint8ClampedArray | null {
    if (!mask.maskData) return null;

    const maskWidth = mask.right - mask.left;
    const maskHeight = mask.bottom - mask.top;

    if (maskWidth <= 0 || maskHeight <= 0) return null;

    const maskPixelData = new Uint8ClampedArray(maskWidth * maskHeight * 4);

    for (let y = 0; y < maskHeight; y++) {
      for (let x = 0; x < maskWidth; x++) {
        const pos = y * maskWidth + x;
        const pixelPos = pos * 4;

        const maskValue = mask.invertMask
          ? 255 - mask.maskData[pos]
          : mask.maskData[pos];

        maskPixelData[pixelPos] = 255;
        maskPixelData[pixelPos + 1] = 255;
        maskPixelData[pixelPos + 2] = 255;
        maskPixelData[pixelPos + 3] = maskValue;
      }
    }

    return maskPixelData;
  }
}
