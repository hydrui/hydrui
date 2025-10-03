import { type TagModelMeta } from "@/store/modelMetaStore";
import {
  type WorkerRequest,
  type WorkerResponse,
} from "@/workers/autotag.worker";

import { type Results } from "./common";
import { type Session, loadModel, processImage } from "./inference";

export interface AutotagWorker {
  loadModel(meta: TagModelMeta): Promise<void>;
  processImage(threshold: number, image: ImageBitmap): Promise<Results>;
  release(): void;
}

class BackgroundAutotagWorker implements AutotagWorker {
  private worker: Worker;
  private serial = 0;
  private loadPromise?: [() => void, (error: Error) => void];
  private pendingPromises: Map<
    number,
    [(results: Results) => void, (error: Error) => void]
  > = new Map();

  constructor() {
    const worker = new Worker(
      new URL("@/workers/autotag.worker.ts", import.meta.url),
      {
        type: "module",
      },
    );
    this.worker = worker;
    worker.addEventListener("message", this.handleWorkerMessage);
  }

  loadModel(meta: TagModelMeta): Promise<void> {
    return new Promise((resolve, reject) => {
      this.loadPromise = [resolve, reject];
      try {
        this.postMessage({ type: "loadModel", meta });
      } catch (error) {
        reject(error);
      }
    });
  }

  processImage(threshold: number, image: ImageBitmap): Promise<Results> {
    return new Promise((resolve, reject) => {
      const serial = this.serial++;
      this.pendingPromises.set(serial, [resolve, reject]);
      try {
        this.postMessage({
          type: "processImage",
          threshold,
          image,
          serial,
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  release(): void {
    this.worker.terminate();
  }

  private postMessage(message: WorkerRequest): void {
    this.worker.postMessage(message);
  }

  private handleWorkerMessage = (event: MessageEvent): void => {
    const response = event.data as WorkerResponse;

    switch (response.type) {
      case "loadModel": {
        if (!this.loadPromise) {
          return;
        }
        const [resolve, reject] = this.loadPromise;
        if ("error" in response) {
          reject(new Error(response.error));
        } else {
          resolve();
        }
        delete this.loadPromise;
        break;
      }
      case "processImage": {
        const callbacks = this.pendingPromises.get(response.serial);
        if (!callbacks) {
          return;
        }
        const [resolve, reject] = callbacks;
        if ("error" in response) {
          reject(new Error(response.error));
        } else {
          resolve(response.results);
        }
        this.pendingPromises.delete(response.serial);
        break;
      }
    }
  };
}

class MainThreadAutotagWorker implements AutotagWorker {
  private session?: Session;

  async loadModel(meta: TagModelMeta): Promise<void> {
    this.session = await loadModel(meta);
  }

  async processImage(threshold: number, image: ImageBitmap): Promise<Results> {
    if (!this.session) {
      throw new Error("No model loaded!");
    }
    return processImage(this.session, threshold, image);
  }

  release(): void {
    this.session?.modelSession.release();
  }
}

export async function createAutotagWorker(): Promise<AutotagWorker> {
  const isWebWorkerSupported = typeof Worker !== "undefined";
  const isOffscreenCanvasSupported = typeof OffscreenCanvas !== "undefined";
  if (isWebWorkerSupported && isOffscreenCanvasSupported) {
    try {
      return new BackgroundAutotagWorker();
    } catch (error) {
      console.error(
        `Failed to create web worker for autotag inference: ${error}; falling back to main thread.`,
      );
    }
  }
  return new MainThreadAutotagWorker();
}
