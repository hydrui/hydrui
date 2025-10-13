import { type Entry } from "@zip.js/zip.js";

import {
  type TagModelMeta,
  type WDTaggerModelMeta,
} from "@/store/modelMetaStore";

import {
  Results,
  SessionCommon,
  createCanvas,
  getCanvasContext2D,
  joinTagNamespace,
  relativeUrl,
  rewriteUnderscoreTags,
} from "./common";

const WD_TARGET_SIZE = 448;

export interface WDTaggerModelInfo {
  modelname: string;
  source: string;
  modelfile: string;
  tagsfile: string;
  ratingsflag: number;
  numberofratings: number;
}

export interface WDTaggerSession extends SessionCommon {
  modelType: "wd";
  modelInfo: WDTaggerModelInfo;
  tagsData: Record<string, string>[];
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split("\n");
  const data: Record<string, string>[] = [];

  function parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    let i = 0;
    while (i < line.length) {
      const char = line[i];
      if (inQuotes) {
        if (char === '"') {
          if (i + 1 < line.length && line[i + 1] === '"') {
            current += '"';
            i += 2;
          } else {
            inQuotes = false;
            i++;
          }
        } else {
          current += char;
          i++;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
          i++;
        } else if (char === ",") {
          result.push(current);
          current = "";
          i++;
        } else {
          current += char;
          i++;
        }
      }
    }
    result.push(current);
    return result;
  }

  const headers = parseCsvLine(lines[0]);
  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || "";
    });
    data.push(row);
  }

  return data;
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

export async function parseModelInfoWD(
  url: string,
  info: WDTaggerModelInfo,
): Promise<TagModelMeta> {
  // WD Tagger v2+ info.json
  return { name: info.modelname, type: "wd", info, url };
}

export async function preprocessImageWD(
  session: WDTaggerSession,
  image: ImageBitmap,
) {
  const { Tensor } = await import("onnxruntime-web");
  const targetSize = session.targetSize;
  const canvas = createCanvas(image.width, image.height);
  const ctx = getCanvasContext2D(canvas);
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
  const squareCanvas = createCanvas(desiredSize, desiredSize);
  const squareCtx = getCanvasContext2D(squareCanvas);
  squareCtx.fillStyle = "white";
  squareCtx.fillRect(0, 0, desiredSize, desiredSize);
  squareCtx.drawImage(canvas, left, top);
  const finalCanvas = createCanvas(targetSize, targetSize);
  const finalCtx = getCanvasContext2D(finalCanvas);
  finalCtx.imageSmoothingEnabled = true;
  finalCtx.imageSmoothingQuality = "high";
  finalCtx.drawImage(squareCanvas, 0, 0, targetSize, targetSize);
  imageData = finalCtx.getImageData(0, 0, targetSize, targetSize);
  const data = imageData.data;
  if (
    session.modelSession.inputMetadata[0].isTensor &&
    session.modelSession.inputMetadata[0].shape[1] === 3
  ) {
    // Some of the ONNX models using this architecture seem to lack nodes that
    // preprocess the inputs, and the telltale sign is the tensor shape being
    // [3, 448, 448] instead of [448, 448, 3].
    const tensor = new Float32Array(1 * targetSize * targetSize * 3);
    // cl_tagger wants RGB, PixAI wants BGR. This is ugly, but let's just try
    // to detect the cl_tagger model specifically.
    const clTaggerFlipBGR = session.modelSession.inputNames[0] === "input0";
    for (let y = 0; y < targetSize; y++) {
      for (let x = 0; x < targetSize; x++) {
        const pixelIndex = (y * targetSize + x) * 4;
        const tensorBaseIndex = y * targetSize + x;
        if (clTaggerFlipBGR) {
          tensor[0 * targetSize * targetSize + tensorBaseIndex] =
            (data[pixelIndex + 2] - 127.5) / 127.5;
          tensor[1 * targetSize * targetSize + tensorBaseIndex] =
            (data[pixelIndex + 1] - 127.5) / 127.5;
          tensor[2 * targetSize * targetSize + tensorBaseIndex] =
            (data[pixelIndex] - 127.5) / 127.5;
        } else {
          tensor[0 * targetSize * targetSize + tensorBaseIndex] =
            (data[pixelIndex] - 127.5) / 127.5;
          tensor[1 * targetSize * targetSize + tensorBaseIndex] =
            (data[pixelIndex + 1] - 127.5) / 127.5;
          tensor[2 * targetSize * targetSize + tensorBaseIndex] =
            (data[pixelIndex + 2] - 127.5) / 127.5;
        }
      }
    }
    return new Tensor("float32", tensor, [1, 3, targetSize, targetSize]);
  } else {
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
}

function getWDTaggerTagNamespace(tagData: Record<string, string>): string {
  switch (Number(tagData["category"])) {
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

function processWDTagName(tagData: Record<string, string>): string {
  const namespace = getWDTaggerTagNamespace(tagData);
  const name = rewriteUnderscoreTags(tagData["name"]);
  return joinTagNamespace(name, namespace);
}

function processWDTagData(tagData: Record<string, string>): string[] {
  const tags = [];
  tags.push(processWDTagName(tagData));
  if (tagData["ips"]) {
    const ips: unknown = JSON.parse(tagData["ips"]);
    if (!Array.isArray(ips)) {
      return tags;
    }
    for (const ip of ips) {
      tags.push(joinTagNamespace(rewriteUnderscoreTags(String(ip)), "series"));
    }
  }
  return tags;
}

export function processResultsWD(
  session: WDTaggerSession,
  confidences: Float32Array,
  threshold: number,
): Results {
  const tagResults: { name: string; confidence: number }[] = [];
  const numRatings = session.modelInfo.numberofratings;
  let rating: { name: string; confidence: number } | undefined;
  for (let i = 0; i < numRatings && i < session.tagsData.length; i++) {
    const name = processWDTagName(session.tagsData[i]);
    const confidence = confidences[i];
    if (confidence > threshold && (!rating || rating.confidence < confidence)) {
      rating = { name, confidence };
    }
  }
  if (rating) {
    tagResults.push(rating);
  }
  for (let i = numRatings; i < session.tagsData.length; i++) {
    const tags = processWDTagData(session.tagsData[i]);
    const confidence = confidences[i];
    if (confidence > threshold) {
      for (const name of tags) {
        tagResults.push({ name, confidence });
      }
    }
  }
  tagResults.sort((a, b) => b.confidence - a.confidence);
  return { tagResults };
}

export async function loadModelWD(
  meta: WDTaggerModelMeta,
): Promise<WDTaggerSession> {
  if (!meta.modelPath || !meta.tagsPath || !meta.info) {
    throw new Error("Model data is not cached.");
  }
  const { InferenceSession } = await import("onnxruntime-web");
  const opfsRoot = await navigator.storage.getDirectory();
  const model = await opfsRoot.getFileHandle(meta.modelPath);
  const modelData = await model.getFile();
  let tagsData: Record<string, string>[] = [];
  const tags = await opfsRoot.getFileHandle(meta.tagsPath);
  tagsData = parseCsv(await (await tags.getFile()).text());
  const modelSession = await InferenceSession.create(
    await modelData.arrayBuffer(),
  );
  return {
    targetSize: WD_TARGET_SIZE,
    modelInfo: meta.info,
    modelSession,
    tagsData,
    modelType: "wd",
  };
}

export async function fetchModelFilesWD(
  meta: WDTaggerModelMeta,
): Promise<string> {
  if (!meta.url) {
    throw new Error("Model entry does not have a URL!");
  }
  const cacheKey = await getCacheKey(meta.name);
  const opfsRoot = await navigator.storage.getDirectory();
  if (!meta.info) {
    throw new Error("Inconsistent state: info.json missing in fetched model");
  }
  // Fetch selected_tags.csv for WD Tagger v2+ models.
  const cachedTagsName = `tagModels-${cacheKey}-tags.csv`;
  const tagsUrl = relativeUrl(meta.url, meta.info.tagsfile);
  const tagsResponse = await fetch(tagsUrl);
  try {
    const fileHandle = await opfsRoot.getFileHandle(cachedTagsName, {
      create: true,
    });
    const writable = await fileHandle.createWritable();
    await writable.write(await tagsResponse.blob());
    await writable.close();
  } catch (writeError) {
    throw new Error(`Failed to save tags to ${cachedTagsName}: ${writeError}`);
  }
  meta.tagsPath = cachedTagsName;
  return meta.info.modelfile;
}

export async function deleteSavedWDFiles(meta: WDTaggerModelMeta) {
  const opfsRoot = await navigator.storage.getDirectory();
  if (meta.tagsPath) {
    try {
      await opfsRoot.removeEntry(meta.tagsPath);
    } catch (error) {
      console.warn(`Error deleting ${meta.tagsPath}: ${error}`);
    }
  }
}

export async function loadWDModelFromZip(
  fileMap: Map<string, Entry>,
): Promise<WDTaggerModelMeta | null> {
  const opfsRoot = await navigator.storage.getDirectory();
  const infoEntry = fileMap.get("info.json");
  if (!infoEntry || infoEntry.directory) {
    return null;
  }
  const infoData = await infoEntry.arrayBuffer();
  const info = JSON.parse(
    new TextDecoder().decode(infoData),
  ) as WDTaggerModelInfo;
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
    type: "wd",
    info,
    modelPath: cachedModelName,
    tagsPath: cachedTagsName,
  };
}
