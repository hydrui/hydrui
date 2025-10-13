import { type Entry, type FileEntry } from "@zip.js/zip.js";

import { CamieTaggerModelMeta, TagModelMeta } from "@/store/modelMetaStore";

import {
  Results,
  SessionCommon,
  createCanvas,
  getCacheKey,
  getCanvasContext2D,
  joinTagNamespace,
  rewriteUnderscoreTags,
} from "./common";

const CAMIE_TARGET_SIZE = 512;

export interface CamieMetadata {
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

export interface CamieTaggerSession extends SessionCommon {
  modelType: "camie";
  metadata: CamieMetadata;
}

export async function parseModelInfoCamie(
  url: string,
  info: CamieMetadata,
): Promise<TagModelMeta> {
  // Camie Tagger v2 metadata.json
  const modelName = "Camie Tagger v2"; // TODO
  const cacheKey = await getCacheKey(modelName);
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
  return { name: "Camie Tagger v2", type: "camie", url, metadataPath };
}

export async function preprocessImageCamie(
  session: CamieTaggerSession,
  image: ImageBitmap,
) {
  const { Tensor } = await import("onnxruntime-web");
  const targetSize = session.targetSize;
  const padR = 124;
  const padG = 116;
  const padB = 104;
  const meanR = 0.485;
  const meanG = 0.456;
  const meanB = 0.406;
  const stdR = 0.229;
  const stdG = 0.224;
  const stdB = 0.225;
  const canvas = createCanvas(targetSize, targetSize);
  const ctx = getCanvasContext2D(canvas);
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
      const r = data[pixelIndex]! / 255.0;
      const g = data[pixelIndex + 1]! / 255.0;
      const b = data[pixelIndex + 2]! / 255.0;
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

function sigmoid(x: number): number {
  return 1.0 / (1.0 + Math.exp(-x));
}

function getTagNamespaceForCategory(category: string): string {
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

export function processResultsCamie(
  session: CamieTaggerSession,
  logits: Float32Array,
  threshold: number,
): Results {
  const tagResults: { name: string; confidence: number }[] = [];
  let rating: { name: string; confidence: number } | undefined;
  if (!session.metadata) {
    throw new Error("Camie Tagger metadata not found");
  }
  const { idx_to_tag, tag_to_category } =
    session.metadata.dataset_info.tag_mapping;
  const probabilities = new Float32Array(logits.length);
  for (const [i, logit] of logits.entries()) {
    probabilities[i] = sigmoid(logit);
  }
  for (const [i, confidence] of probabilities.entries()) {
    if (confidence > threshold) {
      const tagName = idx_to_tag[i.toString()];
      if (!tagName) {
        continue;
      }
      const category = tag_to_category[tagName] || "general";
      const namespace = getTagNamespaceForCategory(category);
      if (category === "rating") {
        const name = joinTagNamespace(
          rewriteUnderscoreTags(tagName.replace(/^rating_/, "")),
          namespace,
        );
        if (!rating || confidence > rating.confidence) {
          console.log(tagName, name, namespace);
          rating = { name, confidence };
        }
      } else {
        const name = joinTagNamespace(
          rewriteUnderscoreTags(tagName),
          namespace,
        );
        tagResults.push({ name, confidence });
      }
    }
  }
  if (rating) {
    tagResults.push(rating);
  }
  tagResults.sort((a, b) => b.confidence - a.confidence);
  return { tagResults };
}

export async function loadModelCamie(
  meta: CamieTaggerModelMeta,
): Promise<CamieTaggerSession> {
  if (!meta.modelPath || !meta.metadataPath) {
    throw new Error("Model data is not cached.");
  }
  const { InferenceSession } = await import("onnxruntime-web");
  const opfsRoot = await navigator.storage.getDirectory();
  const model = await opfsRoot.getFileHandle(meta.modelPath);
  const modelData = await model.getFile();
  const metadataFile = await opfsRoot.getFileHandle(meta.metadataPath);
  const metadataText = await (await metadataFile.getFile()).text();
  const metadata: CamieMetadata = JSON.parse(metadataText);
  const modelSession = await InferenceSession.create(
    await modelData.arrayBuffer(),
  );
  return {
    targetSize: CAMIE_TARGET_SIZE,
    modelSession,
    modelType: "camie",
    metadata,
  };
}

export async function fetchModelFilesCamie(
  meta: CamieTaggerModelMeta,
): Promise<string> {
  if (!meta.url) {
    throw new Error("Model entry does not have a URL!");
  }
  const metadataName = meta.url.substring(meta.url.lastIndexOf("/") + 1);
  return metadataName.endsWith("-metadata.json")
    ? metadataName.substring(0, metadataName.length - "-metadata.json".length) +
        ".onnx"
    : "model.onnx";
}

export async function deleteSavedCamieFiles(meta: CamieTaggerModelMeta) {
  const opfsRoot = await navigator.storage.getDirectory();
  if (meta.metadataPath) {
    try {
      await opfsRoot.removeEntry(meta.metadataPath);
    } catch (error) {
      console.warn(`Error deleting ${meta.metadataPath}: ${error}`);
    }
  }
}

export async function loadCamieModelFromZip(
  entries: Entry[],
  fileMap: Map<string, Entry>,
): Promise<CamieTaggerModelMeta | null> {
  const opfsRoot = await navigator.storage.getDirectory();
  let camieMetadataEntry: FileEntry | undefined;
  for (const entry of entries) {
    if (entry.filename.endsWith("metadata.json") && !entry.directory) {
      camieMetadataEntry = entry;
    }
  }
  if (!camieMetadataEntry) {
    return null;
  }
  const metadataData = await camieMetadataEntry.arrayBuffer();
  const metadataName = camieMetadataEntry.filename;
  const modelName = "Camie Tagger v2"; // TODO
  const modelFile = metadataName.endsWith("-metadata.json")
    ? metadataName.substring(0, metadataName.length - "-metadata.json".length) +
      ".onnx"
    : "model.onnx";
  const cacheKey = await getCacheKey(modelName);
  const modelEntry =
    fileMap.get(modelFile) || fileMap.get(modelFile.replace(".onnx", ".ort"));
  if (!modelEntry || modelEntry.directory) {
    throw new Error("Could not find model file in zipped Camie Tagger model.");
  }
  const cachedModelName = `tagModels-${cacheKey}-model.ort`;
  const cachedMetadataName = `tagModels-${cacheKey}-metadata.json`;
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
    name: modelName,
    type: "camie",
    modelPath: cachedModelName,
    metadataPath: cachedMetadataName,
  };
}
