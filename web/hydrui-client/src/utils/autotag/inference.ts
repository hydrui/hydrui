import { type InferenceSession } from "onnxruntime-web";

import { type TagModelMeta } from "@/store/modelMetaStore";

import {
  type CamieTaggerSession,
  loadModelCamie,
  preprocessImageCamie,
  processResultsCamie,
} from "./camie";
import { type Results } from "./common";
import {
  type WDTaggerSession,
  loadModelWD,
  preprocessImageWD,
  processResultsWD,
} from "./wd";

export type Session = WDTaggerSession | CamieTaggerSession;

async function preprocessImage(session: Session, image: ImageBitmap) {
  switch (session.modelType) {
    case "wd":
      return preprocessImageWD(session, image);
    case "camie":
      return preprocessImageCamie(session, image);
  }
}

function processResults(
  session: Session,
  confidences: Float32Array,
  threshold: number,
): Results {
  switch (session.modelType) {
    case "wd":
      return processResultsWD(session, confidences, threshold);
    case "camie":
      return processResultsCamie(session, confidences, threshold);
  }
}

export async function processImage(
  session: Session,
  threshold: number,
  image: ImageBitmap,
): Promise<Results> {
  const inputTensor = await preprocessImage(session, image);
  const feeds: InferenceSession.FeedsType = {
    [session.modelSession.inputNames[0]]: inputTensor,
  };
  const results = await session.modelSession.run(feeds);
  let confidences: Float32Array | undefined;
  // Look for output by name
  for (const output of session.modelSession.outputMetadata) {
    switch (output.name) {
      case "refined_predictions": // Camie v2
      case "predictions_sigmoid": // SmilingWolf
      case "prediction": // PixAI
        confidences = results[output.name].data as Float32Array;
        break;
    }
  }
  if (!confidences) {
    // Failing that, look for output by type
    // Choose the last float32 output.
    for (const output of session.modelSession.outputMetadata) {
      if (!output.isTensor) continue;
      if (output.type != "float32") {
        continue;
      }
      confidences = results[output.name].data as Float32Array;
    }
  }
  if (!(confidences instanceof Float32Array)) {
    throw new Error(`Expected Float32Array for tensor output!`);
  }
  return processResults(session, confidences, threshold);
}

export async function loadModel(meta: TagModelMeta): Promise<Session> {
  if (!navigator.storage || !navigator.storage.getDirectory) {
    throw new Error("Origin Private File System is not available!");
  }
  switch (meta.type) {
    case "wd":
      return loadModelWD(meta);
    case "camie":
      return loadModelCamie(meta);
  }
}

export async function releaseResources(session: Session): Promise<void> {
  session.modelSession.release();
}
