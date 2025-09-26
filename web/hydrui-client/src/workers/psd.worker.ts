import { createRemoteFile } from "hydrui-util/src/stream";

import { Layer } from "@/utils/layerTree";
import { PSDRenderer } from "@/utils/psd/render";

type WorkerInitRequest = {
  type: "load";
  url: string;
};

type LayerVisibilityRequest = {
  type: "setLayerVisibility";
  layerIndex: number;
  visible: boolean;
};

type LayerThumbnailRequest = {
  type: "getLayerThumbnail";
  serial: number;
  layerIndex: number;
  width: number;
  height: number;
};

type AbortRequest = {
  type: "abort";
};

export type WorkerRequest =
  | WorkerInitRequest
  | LayerVisibilityRequest
  | LayerThumbnailRequest
  | AbortRequest;

type WorkerLoadResponse = {
  type: "load";
  layerTree: Layer[];
  documentWidth: number;
  documentHeight: number;
};

type LayerLoadResponse = {
  type: "layerLoad";
  progress: number;
};

type LayerRenderResponse = {
  type: "layerRender";
  progress: number;
};

type LayerThumbnailResponse =
  | {
      type: "layerThumbnail";
      serial: number;
      imageBitmap: ImageBitmap;
      error: null;
    }
  | {
      type: "layerThumbnail";
      serial: number;
      error: string;
    };

type RenderResponse = {
  type: "render";
  imageBitmap: ImageBitmap;
};

export type WorkerResponse =
  | WorkerLoadResponse
  | LayerLoadResponse
  | LayerRenderResponse
  | LayerThumbnailResponse
  | RenderResponse;

function postMessage(response: WorkerResponse) {
  self.postMessage(response);
}

// State within the worker
let renderer: PSDRenderer | null = null;

const abortController = new AbortController();

// Message handler
self.addEventListener("message", async (event: MessageEvent<WorkerRequest>) => {
  const data = event.data;
  switch (data.type) {
    case "load":
      renderer = await PSDRenderer.create(
        await createRemoteFile(data.url, { signal: abortController.signal }),
        (w: number, h: number) => new OffscreenCanvas(w, h),
      );

      postMessage({
        type: "load",
        layerTree: renderer.getLayerTree(),
        documentWidth: renderer.getDocumentWidth(),
        documentHeight: renderer.getDocumentHeight(),
      });

      await renderer.loadLayerData((progress) => {
        postMessage({
          type: "layerLoad",
          progress,
        });
      });
      {
        const imageBitmap = await renderer.render((progress) => {
          postMessage({
            type: "layerRender",
            progress,
          });
        });
        if (imageBitmap) {
          postMessage({
            type: "render",
            imageBitmap,
          });
        }
      }
      break;

    case "setLayerVisibility":
      if (renderer) {
        renderer.setLayerVisibility(data.layerIndex, data.visible);
        const imageBitmap = await renderer.render((progress) => {
          postMessage({
            type: "layerRender",
            progress,
          });
        });
        if (imageBitmap) {
          postMessage({
            type: "render",
            imageBitmap,
          });
        }
      }
      break;

    case "getLayerThumbnail":
      if (renderer) {
        const imageBitmap = await renderer.generateLayerThumbnail(
          data.layerIndex,
          data.width,
          data.height,
        );
        if (imageBitmap) {
          postMessage({
            type: "layerThumbnail",
            serial: data.serial,
            imageBitmap,
            error: null,
          });
        } else {
          postMessage({
            type: "layerThumbnail",
            serial: data.serial,
            error: "Layer not found",
          });
        }
      }
      break;

    case "abort":
      abortController.abort();
      break;
  }
});
