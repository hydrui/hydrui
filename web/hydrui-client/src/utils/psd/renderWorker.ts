import { File, MemoryFile, createRemoteFile } from "hydrui-util/src/stream";

import { Layer } from "@/utils/layerTree";
import type { WorkerRequest, WorkerResponse } from "@/workers/psd.worker";

import { PSDRenderer } from "./render";

interface PSDCallbacks {
  onLoad(
    layerTree: Layer[],
    documentWidth: number,
    documentHeight: number,
  ): void;
  onLayerLoad(progress: number): void;
  onLayerRender(progress: number): void;
  onError(error: Error): void;
  onRender(iamgeBitmap: ImageBitmap): void;
}

export interface PSDRenderWorker {
  generateLayerThumbnail(
    layerIndex: number,
    width: number,
    height: number,
  ): Promise<ImageBitmap | null>;
  setLayerVisibility(layerIndex: number, visible: boolean): Promise<void>;
  terminate(): void;
}

class PSDBackgroundRenderWorker implements PSDRenderWorker {
  private worker: Worker;
  private serial = 0;
  private pendingThumbnailPromises: Map<
    number,
    [(imageBitmap: ImageBitmap | null) => void, (error: Error) => void]
  > = new Map();

  constructor(
    url: string,
    private callbacks: PSDCallbacks,
    signal?: AbortSignal,
  ) {
    const worker = new Worker(
      new URL("@/workers/psd.worker.ts", import.meta.url),
      {
        type: "module",
      },
    );
    this.worker = worker;
    worker.addEventListener("message", this.handleWorkerMessage);
    if (url.startsWith("blob:")) {
      fetch(url)
        .then((r) => r.arrayBuffer())
        .then((buffer) => {
          this.postMessage({
            type: "load",
            buffer,
          });
        });
    } else {
      this.postMessage({
        type: "load",
        url,
      });
    }
    if (signal) {
      signal.addEventListener("abort", () => {
        this.postMessage({
          type: "abort",
        });
        this.worker.terminate();
      });
    }
  }

  async generateLayerThumbnail(
    layerIndex: number,
    width: number,
    height: number,
  ): Promise<ImageBitmap | null> {
    return new Promise((resolve, reject) => {
      const serial = this.serial++;
      this.pendingThumbnailPromises.set(serial, [resolve, reject]);
      try {
        this.postMessage({
          type: "getLayerThumbnail",
          layerIndex,
          width,
          height,
          serial,
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  async setLayerVisibility(
    layerIndex: number,
    visible: boolean,
  ): Promise<void> {
    this.postMessage({
      type: "setLayerVisibility",
      layerIndex,
      visible,
    });
  }

  terminate(): void {
    this.worker.terminate();
  }

  private postMessage(message: WorkerRequest): void {
    this.worker.postMessage(message);
  }

  private handleWorkerMessage = (event: MessageEvent): void => {
    const response = event.data as WorkerResponse;

    switch (response.type) {
      case "load":
        this.callbacks.onLoad(
          response.layerTree,
          response.documentWidth,
          response.documentHeight,
        );
        break;
      case "layerThumbnail": {
        const callbacks = this.pendingThumbnailPromises.get(response.serial);
        if (!callbacks) {
          return;
        }
        const [resolve, reject] = callbacks;
        if (response.error !== null) {
          reject(new Error(response.error));
        } else {
          resolve(response.imageBitmap);
        }
        this.pendingThumbnailPromises.delete(response.serial);
        break;
      }
      case "render":
        this.callbacks.onRender(response.imageBitmap);
        break;
      case "layerLoad":
        this.callbacks.onLayerLoad(response.progress);
        break;
      case "layerRender":
        this.callbacks.onLayerRender(response.progress);
        break;
    }
  };
}

class PSDMainThreadRenderWorker implements PSDRenderWorker {
  private renderer: PSDRenderer;
  private callbacks: PSDCallbacks;

  private constructor(renderer: PSDRenderer, callbacks: PSDCallbacks) {
    this.renderer = renderer;
    this.callbacks = callbacks;
    this.callbacks.onLoad(
      this.renderer.getLayerTree(),
      this.renderer.getDocumentWidth(),
      this.renderer.getDocumentHeight(),
    );
    this.renderer.loadLayerData(this.callbacks.onLayerLoad).then(() => {
      this.renderer
        .render(this.callbacks.onLayerRender)
        .then((imageBitmap) => {
          if (imageBitmap) {
            this.callbacks.onRender(imageBitmap);
          }
        })
        .catch((error) => {
          if (error instanceof DOMException && error.name === "AbortError") {
            return;
          }
          this.callbacks.onError(error);
        });
    });
  }

  static async create(
    url: string,
    callbacks: PSDCallbacks,
    signal?: AbortSignal,
  ) {
    let file: File;
    if (url.startsWith("blob:")) {
      // Remote file isn't compatible with blobs yet, for some reason.
      const blob = await fetch(url);
      const arrayBuffer = await blob.arrayBuffer();
      file = new MemoryFile(arrayBuffer);
    } else {
      file = await createRemoteFile(url, { signal });
    }
    const renderer = await PSDRenderer.create(file, (w, h) => {
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      return canvas;
    });
    return new PSDMainThreadRenderWorker(renderer, callbacks);
  }

  generateLayerThumbnail(
    layerIndex: number,
    width: number,
    height: number,
  ): Promise<ImageBitmap | null> {
    return this.renderer.generateLayerThumbnail(layerIndex, width, height);
  }

  async setLayerVisibility(
    layerIndex: number,
    visible: boolean,
  ): Promise<void> {
    this.renderer.setLayerVisibility(layerIndex, visible);
    this.renderer
      .render(this.callbacks.onLayerRender)
      .then((imageBitmap) => {
        if (imageBitmap) {
          this.callbacks.onRender(imageBitmap);
        }
      })
      .catch((error) => {
        this.callbacks.onError(error);
      });
  }

  terminate(): void {
    // Do nothing.
    return;
  }
}

export async function createPSDRenderWorker(
  url: string,
  callbacks: PSDCallbacks,
  signal?: AbortSignal,
): Promise<PSDRenderWorker> {
  const isWebWorkerSupported = typeof Worker !== "undefined";
  const isOffscreenCanvasSupported = typeof OffscreenCanvas !== "undefined";
  let isOffscreenCanvasReallySupportedOrIsLadybirdTellingFibs = false;
  try {
    if (
      new OffscreenCanvas(1, 1)
        .getContext("2d")!
        .getImageData(0, 0, 1, 1) instanceof ImageData
    ) {
      isOffscreenCanvasReallySupportedOrIsLadybirdTellingFibs = true;
    }
  } catch {
    // Do nothing.
  }
  if (
    isWebWorkerSupported &&
    isOffscreenCanvasSupported &&
    isOffscreenCanvasReallySupportedOrIsLadybirdTellingFibs
  ) {
    try {
      const worker = new PSDBackgroundRenderWorker(url, callbacks, signal);
      return worker;
    } catch (error) {
      console.error(
        `Failed to create web worker for PSD rendering: ${error}; falling back to main thread.`,
      );
    }
  }
  const worker = await PSDMainThreadRenderWorker.create(url, callbacks, signal);
  return worker;
}
