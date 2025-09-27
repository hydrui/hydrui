import { type Entry } from "@zip.js/zip.js";
import { type InferenceSession } from "onnxruntime-web";

import { TagModelInfo, TagModelMeta } from "@/store/modelMetaStore";

export interface Session {
  modelInfo: TagModelInfo;
  modelSession: InferenceSession;
  tagsData: Record<string, string>[];
}

export interface Results {
  ratings: Record<string, number>;
  tagResults: { name: string; confidence: number }[];
}

const KNOWN_KAOMOJI = new Set([
  "0_0",
  "(o)_(o)",
  "+_+",
  "+_-",
  "._.",
  "<o>_<o>",
  "<|>_<|>",
  "=_=",
  ">_<",
  "3_3",
  "6_9",
  ">_o",
  "@_@",
  "^_^",
  "o_o",
  "u_u",
  "x_x",
  "|_|",
  "||_||",
]);

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split("\n");
  const headers = lines[0].split(",");
  const data: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",");
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = values[index];
    });
    data.push(row);
  }
  return data;
}

function relativeUrl(urlString: URL | string, path: string): URL {
  return new URL(path, new URL(urlString, document.baseURI));
}

async function getCacheKey(name: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(name);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .substring(0, 16);
}

export async function fetchModelInfo(url: string): Promise<TagModelMeta> {
  const infoResponse = await fetch(url);
  const info = (await infoResponse.json()) as TagModelInfo;
  return {
    name: info.modelname,
    info,
    url,
  };
}

async function preprocessImage(image: HTMLImageElement, targetSize = 448) {
  const { Tensor } = await import("onnxruntime-web");
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Unable to get 2D Canvas context.");
  }
  canvas.width = image.width;
  canvas.height = image.height;
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0);
  let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const oldHeight = canvas.height;
  const oldWidth = canvas.width;
  const desiredSize = Math.max(oldWidth, oldHeight, targetSize);
  const deltaW = desiredSize - oldWidth;
  const deltaH = desiredSize - oldHeight;
  const top = Math.floor(deltaH / 2);
  const left = Math.floor(deltaW / 2);
  const squareCanvas = document.createElement("canvas");
  const squareCtx = squareCanvas.getContext("2d");
  if (!squareCtx) {
    throw new Error("Unable to get 2D Canvas context");
  }
  squareCanvas.width = desiredSize;
  squareCanvas.height = desiredSize;
  squareCtx.fillStyle = "white";
  squareCtx.fillRect(0, 0, desiredSize, desiredSize);
  squareCtx.drawImage(canvas, left, top);
  const finalCanvas = document.createElement("canvas");
  const finalCtx = finalCanvas.getContext("2d");
  if (!finalCtx) {
    throw new Error("Unable to get 2D Canvas context");
  }
  finalCanvas.width = targetSize;
  finalCanvas.height = targetSize;
  finalCtx.imageSmoothingEnabled = true;
  finalCtx.imageSmoothingQuality = "high";
  finalCtx.drawImage(squareCanvas, 0, 0, targetSize, targetSize);
  imageData = finalCtx.getImageData(0, 0, targetSize, targetSize);
  const data = imageData.data;
  const tensor = new Float32Array(1 * targetSize * targetSize * 3);
  for (let y = 0; y < targetSize; y++) {
    for (let x = 0; x < targetSize; x++) {
      const pixelIndex = (y * targetSize + x) * 4;
      const tensorBaseIndex = (y * targetSize + x) * 3;
      tensor[tensorBaseIndex] = data[pixelIndex + 2];
      tensor[tensorBaseIndex + 1] = data[pixelIndex + 1];
      tensor[tensorBaseIndex + 2] = data[pixelIndex];
    }
  }
  return new Tensor("float32", tensor, [1, targetSize, targetSize, 3]);
}

function getTagNamespace(tagData: Record<string, string>): string {
  switch (Number(tagData.category)) {
    case 9:
      return "rating";
    case 4:
      return "character";
    default:
      return "";
  }
}

function processTagName(tagData: Record<string, string>): string {
  const namespace = getTagNamespace(tagData);
  const name = KNOWN_KAOMOJI.has(tagData.name)
    ? tagData.name
    : tagData.name.replace(/_/g, " ");
  return namespace === "" && name.startsWith(":")
    ? `:${name}`
    : namespace !== ""
      ? `${namespace}:${name}`
      : name;
}

function processResults(
  session: Session,
  confidences: Float32Array,
  threshold: number,
): Results {
  const ratings: Record<string, number> = {};
  const tagResults: { name: string; confidence: number }[] = [];
  const numRatings = session.modelInfo.numberofratings;
  for (let i = 0; i < numRatings && i < session.tagsData.length; i++) {
    const tag = session.tagsData[i];
    ratings[tag.name] = confidences[i];
  }
  for (let i = numRatings; i < session.tagsData.length; i++) {
    const tag = session.tagsData[i];
    const confidence = confidences[i];
    if (confidence > threshold) {
      tagResults.push({
        name: processTagName(tag),
        confidence: confidence,
      });
    }
  }
  tagResults.sort((a, b) => b.confidence - a.confidence);
  return { ratings, tagResults };
}

export async function processImage(
  session: Session,
  threshold: number,
  image: HTMLImageElement,
): Promise<Results> {
  const inputTensor = preprocessImage(image);
  const feeds: InferenceSession.FeedsType = {
    [session.modelSession.inputNames[0]]: await inputTensor,
  };
  const results = await session.modelSession.run(feeds);
  const output = results[session.modelSession.outputNames[0]];
  const confidences = output.data;
  if (!(confidences instanceof Float32Array)) {
    throw new Error(`Expected Float32Array for tensor output!`);
  }
  return processResults(session, confidences, threshold);
}

export async function loadModel(meta: TagModelMeta): Promise<Session> {
  if (!meta.modelPath || !meta.tagsPath || !meta.info) {
    throw new Error("Model data is not cached.");
  }
  const { InferenceSession } = await import("onnxruntime-web");
  const opfsRoot = await navigator.storage.getDirectory();
  const model = await opfsRoot.getFileHandle(meta.modelPath);
  console.log(meta.modelPath);
  const modelData = await model.getFile();
  const tags = await opfsRoot.getFileHandle(meta.tagsPath);
  const tagsData = parseCsv(await (await tags.getFile()).text());
  const modelSession = await InferenceSession.create(
    await modelData.arrayBuffer(),
  );
  return {
    modelInfo: meta.info,
    modelSession,
    tagsData,
  };
}

export async function fetchModelFiles(meta: TagModelMeta) {
  if (!meta.url) {
    throw new Error("Model entry does not have a URL!");
  }
  const opfsRoot = await navigator.storage.getDirectory();
  const infoResponse = await fetch(meta.url);
  const info = (await infoResponse.json()) as TagModelInfo;
  const tagsUrl = relativeUrl(meta.url, info.tagsfile);
  const modelUrl = relativeUrl(
    meta.url,
    info.modelfile.replace(".onnx", ".ort"),
  );
  const cacheKey = await getCacheKey(info.modelname);
  const cachedModelName = `tagModels-${cacheKey}-model.ort`;
  const cachedTagsName = `tagModels-${cacheKey}-tags.csv`;
  const tagsResponse = await fetch(tagsUrl);
  try {
    const fileHandle = await opfsRoot.getFileHandle(cachedModelName, {
      create: true,
    });
    const writable = await fileHandle.createWritable();
    await writable.write(await tagsResponse.blob());
    await writable.close();
  } catch (writeError) {
    throw new Error(
      `Failed to save model to ${cachedModelName}: ${writeError}`,
    );
  }
  const modelResponse = await fetch(modelUrl);
  try {
    const fileHandle = await opfsRoot.getFileHandle(cachedTagsName, {
      create: true,
    });
    const writable = await fileHandle.createWritable();
    await writable.write(await modelResponse.blob());
    await writable.close();
  } catch (writeError) {
    console.warn(`Failed to save tags to ${cachedTagsName}: ${writeError}`);
  }
  meta.tagsPath = cachedTagsName;
  meta.modelPath = cachedModelName;
  meta.info = info;
}

export async function deleteSavedFiles(meta: TagModelMeta) {
  const opfsRoot = await navigator.storage.getDirectory();
  if (meta.modelPath) {
    try {
      await opfsRoot.removeEntry(meta.modelPath);
    } catch (error) {
      console.warn(`Error deleting ${meta.modelPath}: ${error}`);
    }
  }
  if (meta.tagsPath) {
    try {
      await opfsRoot.removeEntry(meta.tagsPath);
    } catch (error) {
      console.warn(`Error deleting ${meta.tagsPath}: ${error}`);
    }
  }
}

export async function setupZippedTagModel(zip: Blob): Promise<TagModelMeta> {
  const { BlobReader, ZipReader } = await import("@zip.js/zip.js");
  const opfsRoot = await navigator.storage.getDirectory();
  const blobReader = new BlobReader(zip);
  const zipReader = new ZipReader(blobReader);
  const entries = await zipReader.getEntries();
  const fileMap: Map<string, Entry> = new Map();
  for (const entry of entries) {
    fileMap.set(entry.filename, entry);
  }
  const infoEntry = fileMap.get("info.json");
  if (!infoEntry || infoEntry.directory) {
    throw new Error("Could not find info.json in zipped model.");
  }
  const infoData = await infoEntry.arrayBuffer();
  const info = JSON.parse(new TextDecoder().decode(infoData)) as TagModelInfo;
  const cacheKey = await getCacheKey(info.modelname);
  const modelEntry =
    fileMap.get(info.modelfile) ||
    fileMap.get(info.modelfile.replace(".onnx", ".ort"));
  if (!modelEntry || modelEntry.directory) {
    throw new Error(
      `Could not find model file ${info.modelfile} in zipped model.`,
    );
  }
  const tagsEntry = fileMap.get(info.tagsfile);
  if (!tagsEntry || tagsEntry.directory) {
    throw new Error(
      `Could not find tags file ${info.tagsfile} in zipped model.`,
    );
  }
  const cachedModelName = `tagModels-${cacheKey}-model.ort`;
  const cachedTagsName = `tagModels-${cacheKey}-tags.csv`;
  try {
    const fileHandle = await opfsRoot.getFileHandle(cachedModelName, {
      create: true,
    });
    const writable = await fileHandle.createWritable();
    await writable.write(new Blob([await modelEntry.arrayBuffer()]));
    await writable.close();
  } catch (writeError) {
    throw new Error(
      `Failed to save model to ${cachedModelName}: ${writeError}`,
    );
  }
  try {
    const fileHandle = await opfsRoot.getFileHandle(cachedTagsName, {
      create: true,
    });
    const writable = await fileHandle.createWritable();
    await writable.write(new Blob([await tagsEntry.arrayBuffer()]));
    await writable.close();
  } catch (writeError) {
    console.warn(`Failed to save tags to ${cachedTagsName}: ${writeError}`);
  }
  return {
    name: info.modelname,
    info,
    modelPath: cachedModelName,
    tagsPath: cachedTagsName,
  };
}
