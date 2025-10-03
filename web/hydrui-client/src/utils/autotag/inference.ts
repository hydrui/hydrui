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

async function preprocessImage(
  image: ImageBitmap,
  targetSize = 448,
  modelType: "wd" | "camie",
) {
  switch (modelType) {
    case "wd":
      return preprocessImageWD(image, targetSize);
    case "camie":
      return preprocessImageCamie(image, targetSize);
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
  const inputTensor = await preprocessImage(
    image,
    session.targetSize,
    session.modelType,
  );
  const feeds: InferenceSession.FeedsType = {
    [session.modelSession.inputNames[0]]: inputTensor,
  };
  const results = await session.modelSession.run(feeds);
  let confidences: Float32Array;
  if (
    session.modelType === "camie" &&
    session.modelSession.outputNames.length >= 2
  ) {
    // Camie Tagger v2 has refined predictions in the second tensor output
    const refinedOutput = results[session.modelSession.outputNames[1]];
    confidences = refinedOutput.data as Float32Array;
  } else {
    const output = results[session.modelSession.outputNames[0]];
    confidences = output.data as Float32Array;
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
