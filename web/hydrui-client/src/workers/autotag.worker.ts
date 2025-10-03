import { type TagModelMeta } from "@/store/modelMetaStore";
import { type Results } from "@/utils/autotag/common";
import {
  type Session,
  loadModel,
  processImage,
} from "@/utils/autotag/inference";

type LoadModelRequest = {
  type: "loadModel";
  meta: TagModelMeta;
};

type ProcessImageRequest = {
  type: "processImage";
  threshold: number;
  image: ImageBitmap;
  serial: number;
};

export type WorkerRequest = LoadModelRequest | ProcessImageRequest;

type LoadModelResponse =
  | {
      type: "loadModel";
      error: string;
    }
  | {
      type: "loadModel";
      success: true;
    };

type ProcessImageResponse =
  | {
      type: "processImage";
      error: string;
      serial: number;
    }
  | {
      type: "processImage";
      results: Results;
      serial: number;
    };

export type WorkerResponse = LoadModelResponse | ProcessImageResponse;

function postMessage(response: WorkerResponse) {
  self.postMessage(response);
}

// State within the worker
let session: Session | null = null;

// Message handler
self.addEventListener("message", async (event: MessageEvent<WorkerRequest>) => {
  const data = event.data;
  switch (data.type) {
    case "loadModel":
      try {
        session = await loadModel(data.meta);
        postMessage({
          type: "loadModel",
          success: true,
        });
      } catch (error) {
        postMessage({
          type: "loadModel",
          error: String(error),
        });
      }
      break;

    case "processImage":
      try {
        if (!session) {
          throw new Error("No model loaded!");
        }
        const results = await processImage(session, data.threshold, data.image);
        postMessage({
          type: "processImage",
          results,
          serial: data.serial,
        });
      } catch (error) {
        postMessage({
          type: "processImage",
          error: String(error),
          serial: data.serial,
        });
      }
      break;
  }
});
