import { type InferenceSession } from "onnxruntime-web";

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

export interface SessionCommon {
  modelSession: InferenceSession;
  targetSize: number;
}

export interface Results {
  tagResults: { name: string; confidence: number }[];
}

export function relativeUrl(urlString: URL | string, path: string): URL {
  return new URL(path, new URL(urlString, document.baseURI));
}

export function rewriteUnderscoreTags(name: string): string {
  return KNOWN_KAOMOJI.has(name) ? name : name.replace(/_/g, " ");
}

export function joinTagNamespace(name: string, namespace: string): string {
  return namespace === "" && name.startsWith(":")
    ? `:${name}`
    : namespace !== ""
      ? `${namespace}:${name}`
      : name;
}

export async function getCacheKey(name: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(name);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .substring(0, 16);
}

export function createCanvas(
  width: number,
  height: number,
): OffscreenCanvas | HTMLCanvasElement {
  if (typeof OffscreenCanvas !== "undefined") {
    return new OffscreenCanvas(width, height);
  } else {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }
}
export function getCanvasContext2D(
  canvas: OffscreenCanvas | HTMLCanvasElement,
): OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D {
  let context:
    | OffscreenCanvasRenderingContext2D
    | CanvasRenderingContext2D
    | null;
  if (
    typeof OffscreenCanvas !== "undefined" &&
    canvas instanceof OffscreenCanvas
  ) {
    context = canvas.getContext("2d");
  } else if (
    typeof HTMLCanvasElement !== "undefined" &&
    canvas instanceof HTMLCanvasElement
  ) {
    context = canvas.getContext("2d");
  } else {
    throw new Error("Unable to determine type of canvas");
  }
  if (!context) {
    throw new Error("Unable to get 2D Canvas context");
  }
  return context;
}
