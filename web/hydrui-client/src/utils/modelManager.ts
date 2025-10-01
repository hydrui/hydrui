import { type Entry, type FileEntry } from "@zip.js/zip.js";
import { type InferenceSession } from "onnxruntime-web";

import { TagModelInfo, TagModelMeta } from "@/store/modelMetaStore";

interface CamieMetadata {
  model_info: {
    architecture: string;
    backbone: string;
    img_size: number;
    total_parameters: number;
    backbone_parameters: number;
    embedding_dim: number;
    patch_size: number;
    feature_map_size: number;
    num_attention_heads: number;
    tag_context_size: number;
  };
  dataset_info: {
    total_tags: number;
    categories: string[];
    tag_mapping: {
      tag_to_idx: {
        [tag: string]: number;
      };
      idx_to_tag: {
        [index: string]: string;
      };
      tag_to_category: {
        [tag: string]: string;
      };
    };
  };
  input_spec: {
    format: string;
    shape: number[];
    dtype: string;
    normalization: string;
    value_range: string;
  };
  output_spec: {
    [output: string]: {
      shape: [string, number];
      dtype: string;
      description: string;
    };
  };
  usage: {
    threshold_recommendation: string;
    preprocessing: string;
    postprocessing: string;
  };
  export_info: {
    pytorch_version: string;
    safetensors_compatible: boolean;
    onnx_compatible: boolean;
  };
}

export interface Session {
  modelInfo: TagModelInfo;
  modelSession: InferenceSession;
  tagsData: Record<string, string>[];
  modelType: "wd-tagger" | "camie-tagger";
  metadata?: CamieMetadata;
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
  const info = await infoResponse.json();
  if (info?.model_info?.architecture) {
    // Camie Tagger v2 metadata.json
    const metadataName = url.substring(url.lastIndexOf("/") + 1);
    const modelfile = metadataName.endsWith("-metadata.json")
      ? metadataName.substring(
          0,
          metadataName.length - "-metadata.json".length,
        ) + ".onnx"
      : "model.onnx";
    const info: TagModelInfo = {
      modelname: "Camie Tagger v2",
      modelfile,
      tagsfile: "",
      numberofratings: 0,
      source: "",
      ratingsflag: 0,
    };
    const cacheKey = await getCacheKey(info.modelname);
    const metadataPath = `tagModels-${cacheKey}-metadata.json`;
    try {
      const opfsRoot = await navigator.storage.getDirectory();
      const fileHandle = await opfsRoot.getFileHandle(metadataPath, {
        create: true,
      });
      const writable = await fileHandle.createWritable();
      await writable.write(new Blob([JSON.stringify(info)]));
      await writable.close();
    } catch (writeError) {
      throw new Error(
        `Failed to save metadata to ${metadataPath}: ${writeError}`,
      );
    }
    return {
      name: info.modelname,
      info,
      url,
      metadataPath,
    };
  } else {
    // WD Tagger v2+ info.json
    return {
      name: info.modelname,
      info,
      url,
    };
  }
}

async function preprocessImageWD(image: HTMLImageElement, targetSize = 448) {
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

async function preprocessImageCamie(image: HTMLImageElement, targetSize = 512) {
  const { Tensor } = await import("onnxruntime-web");
  const padR = 124;
  const padG = 116;
  const padB = 104;
  const meanR = 0.485;
  const meanG = 0.456;
  const meanB = 0.406;
  const stdR = 0.229;
  const stdG = 0.224;
  const stdB = 0.225;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Unable to get 2D Canvas context.");
  }
  const aspectRatio = image.width / image.height;
  let newWidth: number;
  let newHeight: number;
  if (aspectRatio > 1) {
    newWidth = targetSize;
    newHeight = Math.floor(targetSize / aspectRatio);
  } else {
    newHeight = targetSize;
    newWidth = Math.floor(targetSize * aspectRatio);
  }
  canvas.width = targetSize;
  canvas.height = targetSize;
  ctx.fillStyle = `rgb(${padR}, ${padG}, ${padB})`;
  ctx.fillRect(0, 0, targetSize, targetSize);
  const newX = Math.floor((targetSize - newWidth) / 2);
  const newY = Math.floor((targetSize - newHeight) / 2);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, newX, newY, newWidth, newHeight);
  const imageData = ctx.getImageData(0, 0, targetSize, targetSize);
  const data = imageData.data;
  const tensor = new Float32Array(1 * 3 * targetSize * targetSize);
  for (let y = 0; y < targetSize; y++) {
    for (let x = 0; x < targetSize; x++) {
      const pixelIndex = (y * targetSize + x) * 4;
      const r = data[pixelIndex] / 255.0;
      const g = data[pixelIndex + 1] / 255.0;
      const b = data[pixelIndex + 2] / 255.0;
      const normalizedR = (r - meanR) / stdR;
      const normalizedG = (g - meanG) / stdG;
      const normalizedB = (b - meanB) / stdB;
      const tensorIdx = y * targetSize + x;
      tensor[0 * targetSize * targetSize + tensorIdx] = normalizedR;
      tensor[1 * targetSize * targetSize + tensorIdx] = normalizedG;
      tensor[2 * targetSize * targetSize + tensorIdx] = normalizedB;
    }
  }
  return new Tensor("float32", tensor, [1, 3, targetSize, targetSize]);
}

async function preprocessImage(
  image: HTMLImageElement,
  targetSize = 448,
  modelType: "wd-tagger" | "camie-tagger",
) {
  switch (modelType) {
    case "wd-tagger":
      return preprocessImageWD(image, targetSize);
    case "camie-tagger":
      return preprocessImageCamie(image, targetSize);
  }
}

function getWDTaggerTagNamespace(tagData: Record<string, string>): string {
  switch (Number(tagData.category)) {
    case 1:
      return "creator";
    case 3:
      return "series";
    case 4:
      return "character";
    case 5:
      return "species";
    case 7:
      return "meta";
    case 9:
      return "rating";
    default:
      return "";
  }
}

function rewriteUnderscoreTags(name: string): string {
  return KNOWN_KAOMOJI.has(name) ? name : name.replace(/_/g, " ");
}

function joinTagNamespace(name: string, namespace: string): string {
  return namespace === "" && name.startsWith(":")
    ? `:${name}`
    : namespace !== ""
      ? `${namespace}:${name}`
      : name;
}

function processWDTagName(tagData: Record<string, string>): string {
  const namespace = getWDTaggerTagNamespace(tagData);
  const name = rewriteUnderscoreTags(tagData.name);
  return joinTagNamespace(name, namespace);
}

function sigmoid(x: number): number {
  return 1.0 / (1.0 + Math.exp(-x));
}

function processResultsWD(
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
        name: processWDTagName(tag),
        confidence: confidence,
      });
    }
  }
  tagResults.sort((a, b) => b.confidence - a.confidence);
  return { ratings, tagResults };
}

function getCamieTagNamespace(category: string): string {
  switch (category) {
    case "general":
      return "";
    case "artist":
      return "creator";
    case "copyright":
      return "series";
    default:
      return category;
  }
}

function processResultsCamie(
  session: Session,
  logits: Float32Array,
  threshold: number,
): Results {
  const tagResults: { name: string; confidence: number }[] = [];
  const ratings: Record<string, number> = {};
  if (!session.metadata) {
    throw new Error("Camie Tagger metadata not found");
  }
  const { idx_to_tag, tag_to_category } =
    session.metadata.dataset_info.tag_mapping;
  const probabilities = new Float32Array(logits.length);
  for (let i = 0; i < logits.length; i++) {
    probabilities[i] = sigmoid(logits[i]);
  }
  for (let i = 0; i < probabilities.length; i++) {
    const confidence = probabilities[i];
    if (confidence > threshold) {
      const tagName = idx_to_tag[i.toString()];
      if (!tagName) {
        continue;
      }
      const category = tag_to_category[tagName] || "general";
      const namespace = getCamieTagNamespace(category);
      const name = joinTagNamespace(rewriteUnderscoreTags(tagName), namespace);
      if (category === "rating") {
        ratings[tagName] = confidence;
      } else {
        tagResults.push({ name, confidence });
      }
    }
  }
  tagResults.sort((a, b) => b.confidence - a.confidence);
  return { ratings, tagResults };
}

function processResults(
  session: Session,
  confidences: Float32Array,
  threshold: number,
): Results {
  switch (session.modelType) {
    case "wd-tagger":
      return processResultsWD(session, confidences, threshold);
    case "camie-tagger":
      return processResultsCamie(session, confidences, threshold);
  }
}

export async function processImage(
  session: Session,
  threshold: number,
  image: HTMLImageElement,
): Promise<Results> {
  // Determine model type and target size
  const targetSize = session.modelType === "camie-tagger" ? 512 : 448;
  const inputTensor = await preprocessImage(
    image,
    targetSize,
    session.modelType,
  );
  const feeds: InferenceSession.FeedsType = {
    [session.modelSession.inputNames[0]]: inputTensor,
  };
  const results = await session.modelSession.run(feeds);
  let confidences: Float32Array;
  if (
    session.modelType === "camie-tagger" &&
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
  if (!meta.modelPath || (!meta.tagsPath && !meta.metadataPath) || !meta.info) {
    throw new Error("Model data is not cached.");
  }
  if (!navigator.storage || !navigator.storage.getDirectory) {
    throw new Error("Origin Private File System is not available!");
  }
  const { InferenceSession } = await import("onnxruntime-web");
  const opfsRoot = await navigator.storage.getDirectory();
  const model = await opfsRoot.getFileHandle(meta.modelPath);
  const modelData = await model.getFile();
  let modelType: "wd-tagger" | "camie-tagger";
  let tagsData: Record<string, string>[] = [];
  let metadata: CamieMetadata | undefined = undefined;
  if (meta.metadataPath) {
    modelType = "camie-tagger";
    const metadataFile = await opfsRoot.getFileHandle(meta.metadataPath);
    const metadataText = await (await metadataFile.getFile()).text();
    metadata = JSON.parse(metadataText);
  } else if (meta.tagsPath) {
    modelType = "wd-tagger";
    const tags = await opfsRoot.getFileHandle(meta.tagsPath);
    tagsData = parseCsv(await (await tags.getFile()).text());
  } else {
    throw new Error("Inconsistent state");
  }
  const modelSession = await InferenceSession.create(
    await modelData.arrayBuffer(),
  );
  return {
    modelInfo: meta.info,
    modelSession,
    tagsData,
    modelType,
    metadata,
  };
}

export async function fetchModelFiles(meta: TagModelMeta) {
  if (!meta.url) {
    throw new Error("Model entry does not have a URL!");
  }
  if (!navigator.storage || !navigator.storage.getDirectory) {
    throw new Error("Origin Private File System is not available!");
  }
  const opfsRoot = await navigator.storage.getDirectory();
  const fetchedMeta = await fetchModelInfo(meta.url);
  if (!fetchedMeta.info) {
    throw new Error("Inconsistent state");
  }
  const info = fetchedMeta.info;
  const cacheKey = await getCacheKey(info.modelname);

  if (!fetchedMeta.metadataPath) {
    // Only need to grab the tags CSV file for WD Tagger; metadata.json contains
    // the tag info for Camie Tagger.
    const cachedTagsName = `tagModels-${cacheKey}-tags.csv`;
    const tagsUrl = relativeUrl(meta.url, info.tagsfile);
    const tagsResponse = await fetch(tagsUrl);
    try {
      const fileHandle = await opfsRoot.getFileHandle(cachedTagsName, {
        create: true,
      });
      const writable = await fileHandle.createWritable();
      await writable.write(await tagsResponse.blob());
      await writable.close();
    } catch (writeError) {
      throw new Error(
        `Failed to save tags to ${cachedTagsName}: ${writeError}`,
      );
    }
    meta.tagsPath = cachedTagsName;
  } else {
    meta.metadataPath = fetchedMeta.metadataPath;
  }

  const cachedModelName = `tagModels-${cacheKey}-model.ort`;
  const modelUrl = relativeUrl(
    meta.url,
    info.modelfile.replace(".onnx", ".ort"),
  );
  const modelResponse = await fetch(modelUrl);
  try {
    const fileHandle = await opfsRoot.getFileHandle(cachedModelName, {
      create: true,
    });
    const writable = await fileHandle.createWritable();
    await writable.write(await modelResponse.blob());
    await writable.close();
  } catch (writeError) {
    console.warn(`Failed to save model to ${cachedModelName}: ${writeError}`);
  }
  meta.modelPath = cachedModelName;
  meta.info = info;
}

export async function deleteSavedFiles(meta: TagModelMeta) {
  if (!navigator.storage || !navigator.storage.getDirectory) {
    throw new Error("Origin Private File System is not available!");
  }
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
  if (meta.metadataPath) {
    try {
      await opfsRoot.removeEntry(meta.metadataPath);
    } catch (error) {
      console.warn(`Error deleting ${meta.metadataPath}: ${error}`);
    }
  }
}

export async function setupZippedTagModel(zip: Blob): Promise<TagModelMeta> {
  if (!navigator.storage || !navigator.storage.getDirectory) {
    throw new Error("Origin Private File System is not available!");
  }
  const { BlobReader, ZipReader } = await import("./zipjs");
  const opfsRoot = await navigator.storage.getDirectory();
  const blobReader = new BlobReader(zip);
  const zipReader = new ZipReader(blobReader);
  const entries = await zipReader.getEntries();
  const fileMap: Map<string, Entry> = new Map();
  let camieMetadataEntry: FileEntry | undefined;
  for (const entry of entries) {
    if (entry.filename.endsWith("metadata.json") && !entry.directory) {
      camieMetadataEntry = entry;
    }
    fileMap.set(entry.filename, entry);
  }

  let info: TagModelInfo;
  let cacheKey: string;
  let modelEntry: Entry | undefined;
  let tagsEntry: Entry | undefined;
  let cachedModelName: string;
  let cachedTagsName: string | undefined;
  let cachedMetadataName: string | undefined;

  if (camieMetadataEntry) {
    const metadataData = await camieMetadataEntry.arrayBuffer();
    const metadataName = camieMetadataEntry.filename;
    const modelfile = metadataName.endsWith("-metadata.json")
      ? metadataName.substring(
          0,
          metadataName.length - "-metadata.json".length,
        ) + ".onnx"
      : "model.onnx";
    info = {
      modelname: "Camie Tagger v2",
      modelfile,
      tagsfile: "",
      numberofratings: 0,
      source: "",
      ratingsflag: 0,
    };
    cacheKey = await getCacheKey(info.modelname);
    modelEntry =
      fileMap.get(info.modelfile) ||
      fileMap.get(info.modelfile.replace(".onnx", ".ort"));
    if (!modelEntry || modelEntry.directory) {
      throw new Error(
        "Could not find model file in zipped Camie Tagger model.",
      );
    }
    cachedModelName = `tagModels-${cacheKey}-model.ort`;
    cachedMetadataName = `tagModels-${cacheKey}-metadata.json`;
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
      const fileHandle = await opfsRoot.getFileHandle(cachedMetadataName, {
        create: true,
      });
      const writable = await fileHandle.createWritable();
      await writable.write(new Blob([metadataData]));
      await writable.close();
    } catch (writeError) {
      throw new Error(
        `Failed to save metadata to ${cachedMetadataName}: ${writeError}`,
      );
    }
    return {
      name: info.modelname,
      info,
      modelPath: cachedModelName,
      metadataPath: cachedMetadataName,
    };
  } else {
    const infoEntry = fileMap.get("info.json");
    if (!infoEntry || infoEntry.directory) {
      throw new Error("Could not find info.json in zipped model.");
    }
    const infoData = await infoEntry.arrayBuffer();
    info = JSON.parse(new TextDecoder().decode(infoData)) as TagModelInfo;
    cacheKey = await getCacheKey(info.modelname);
    modelEntry =
      fileMap.get(info.modelfile) ||
      fileMap.get(info.modelfile.replace(".onnx", ".ort"));
    if (!modelEntry || modelEntry.directory) {
      throw new Error(
        `Could not find model file ${info.modelfile} in zipped model.`,
      );
    }
    tagsEntry = fileMap.get(info.tagsfile);
    if (!tagsEntry || tagsEntry.directory) {
      throw new Error(
        `Could not find tags file ${info.tagsfile} in zipped model.`,
      );
    }
    cachedModelName = `tagModels-${cacheKey}-model.ort`;
    cachedTagsName = `tagModels-${cacheKey}-tags.csv`;
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
}
