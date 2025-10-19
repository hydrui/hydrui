import { MemoryFile } from "hydrui-util/src/stream";

import { ContentUpdateAction } from "@/constants/contentUpdates";
import { ServiceType } from "@/constants/services";
import { PSDParser } from "@/file/psd/parser";

import { HttpHandler } from "./memoryHttpClient";
import {
  AddFilesRequest,
  AddNotesRequest,
  AddTagsRequest,
  AssociateUrlRequest,
  DeleteNotesRequest,
  FileMetadata,
  FilesParam,
  Page,
  PageInfoResponse,
  ServicesObject,
  SetRatingRequest,
} from "./types";

interface DemoFile {
  thumbnail: URL;
  file: URL;
}

type FullPage = Page & PageInfoResponse["page_info"];

const DEMO_API_VERSION = {
  version: 81,
  hydrus_version: 640,
};

function emptyResponse(status = 204): Response {
  return new Response(null, { status });
}

function jsonResponse(body: object, status = 200): Response {
  return new Response(
    new Blob([
      JSON.stringify({
        ...body,
        ...DEMO_API_VERSION,
      }),
    ]),
    { status, headers: new Headers({ "Content-Type": "application/json" }) },
  );
}

function errorResponse(
  error: string,
  exception_type: string,
  status_code: number,
): Response {
  return jsonResponse({ error, exception_type, status_code }, status_code);
}

function notFound(error: string): Response {
  return errorResponse(error, "NotFoundException", 404);
}

function badRequest(error: string): Response {
  return errorResponse(error, "BadRequestException", 400);
}

async function sniffMime(blob: Blob): Promise<string> {
  if (
    blob.type &&
    blob.type !== "" &&
    blob.type !== "application/octet-stream"
  ) {
    return blob.type;
  }
  const b = new Uint8Array(await blob.arrayBuffer());
  if (b.length >= 12) {
    if (b[0] == 0xff && b[1] == 0xd8) {
      return "image/jpeg";
    } else if (
      b[0] == 0x89 &&
      b[1] == 0x50 &&
      b[2] == 0x4e &&
      b[3] == 0x47 &&
      b[4] == 0x0d &&
      b[5] == 0x0a &&
      b[6] == 0x1a &&
      b[7] == 0x0a
    ) {
      return "image/png";
    } else if (
      b[0] == 0x47 &&
      b[1] == 0x49 &&
      b[2] == 0x46 &&
      b[3] == 0x38 &&
      (b[4] == 0x37 || b[4] == 0x39) &&
      b[5] == 0x61
    ) {
      return "image/gif";
    } else if (b[0] == 0x42 && b[1] == 0x4d) {
      return "image/bmp";
    } else if (b[0] == 0x38 && b[1] == 0x42 && b[2] == 0x50 && b[3] == 0x53) {
      return "image/vnd.adobe.photoshop";
    } else if (
      b[0] == 0x67 &&
      b[1] == 0x69 &&
      b[2] == 0x6d &&
      b[3] == 0x70 &&
      b[4] == 0x20 &&
      b[5] == 0x78 &&
      b[6] == 0x63 &&
      b[7] == 0x66
    ) {
      return "image/x-xcf";
    } else if (b[0] == 0x52 && b[1] == 0x49 && b[2] == 0x46 && b[3] == 0x46) {
      if (b[8] == 0x57 && b[9] == 0x45 && b[10] == 0x42 && b[11] == 0x50) {
        return "video/webm";
      } else if (
        b[8] == 0x41 &&
        b[9] == 0x56 &&
        b[10] == 0x49 &&
        b[11] == 0x20
      ) {
        return "video/avi";
      } else if (
        b[8] == 0x57 &&
        b[9] == 0x41 &&
        b[10] == 0x56 &&
        b[11] == 0x45
      ) {
        return "audio/wav";
      }
    } else if (b[4] == 0x66 && b[5] == 0x74 && b[6] == 0x79 && b[7] == 0x70) {
      return "video/mp4";
    } else if (b[0] == 0x1a && b[1] == 0x45 && b[2] == 0xdf && b[3] == 0xa3) {
      return "video/x-matroska";
    } else if (
      (b[0] == 0xff && (b[1]! & 0xe0) == 0xe0) ||
      (b[0] == 0x49 && b[1] == 0x44 && b[2] == 0x33)
    ) {
      return "audio/mpeg";
    } else if (b[0] == 0x4f && b[1] == 0x67 && b[2] == 0x67 && b[3] == 0x53) {
      return "audio/ogg";
    } else if (
      b[0] == 0x50 &&
      b[1] == 0x4b &&
      (b[2] == 0x03 || b[2] == 0x05 || b[2] == 0x07) &&
      (b[3] == 0x04 || b[3] == 0x06 || b[3] == 0x08)
    ) {
      return "application/zip";
    } else if (
      b[0] == 0x52 &&
      b[1] == 0x61 &&
      b[2] == 0x72 &&
      b[3] == 0x21 &&
      b[4] == 0x1a &&
      b[5] == 0x07
    ) {
      return "application/vnd.rar";
    } else if (
      b[0] == 0x37 &&
      b[1] == 0x7a &&
      b[2] == 0xbc &&
      b[3] == 0xaf &&
      b[4] == 0x27 &&
      b[5] == 0x1c
    ) {
      return "application/x-7z-compressed";
    }
  }
  return "";
}

async function processFile(blob: Blob) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not get canvas context");
  }
  const type = await sniffMime(blob);
  const newBlob = new Blob([blob], { type });
  const fileUrl = URL.createObjectURL(newBlob);
  let width: number | undefined = undefined;
  let height: number | undefined = undefined;
  let num_frames: number | undefined = undefined;
  let duration: number | null = null;
  let has_audio: boolean | undefined = undefined;
  let thumbnailUrl: URL;
  let thumbnail_width: number;
  let thumbnail_height: number;
  try {
    if (type === "image/vnd.adobe.photoshop") {
      const file = new MemoryFile(await newBlob.arrayBuffer());
      const stream = new PSDParser(file);
      await stream.parse();
      const bitmap = await stream.parseMerged();
      const scale = Math.min(200 / bitmap.width, 200 / bitmap.height);
      canvas.width = bitmap.width * scale;
      canvas.height = bitmap.height * scale;
      width = bitmap.width;
      height = bitmap.height;
      num_frames = 1;
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    } else if (type.startsWith("image/")) {
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = fileUrl;
      });
      const scale = Math.min(200 / img.width, 200 / img.height);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      width = img.width;
      height = img.height;
      num_frames = 1; // TODO: GIF
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    } else if (type.startsWith("video/")) {
      const video = document.createElement("video");
      video.muted = true;
      await new Promise((resolve, reject) => {
        video.onloadedmetadata = resolve;
        video.onerror = reject;
        video.src = fileUrl;
      });
      video.currentTime = Math.min(5, video.duration);
      num_frames = video.getVideoPlaybackQuality()?.totalVideoFrames;
      has_audio =
        Boolean((video as unknown as { mozHasAudio: boolean }).mozHasAudio) ||
        Boolean(
          (video as unknown as { webkitAudioDecodedByteCount: number })
            .webkitAudioDecodedByteCount,
        ) ||
        Boolean(
          (video as unknown as { audioTracks?: Array<unknown> }).audioTracks
            ?.length,
        );
      duration = (video.duration * 1000) | 0;
      await new Promise((resolve) => {
        video.onseeked = resolve;
      });
      const scale = Math.min(200 / video.videoWidth, 200 / video.videoHeight);
      width = video.videoWidth;
      height = video.videoHeight;
      canvas.width = video.videoWidth * scale;
      canvas.height = video.videoHeight * scale;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    } else {
      throw new Error(`Unsupported blob type ${blob.type}`);
    }
    thumbnail_width = canvas.width;
    thumbnail_height = canvas.height;
    thumbnailUrl = new URL(
      URL.createObjectURL(
        await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob(
            (thumbnailBlob) => {
              if (thumbnailBlob) {
                resolve(thumbnailBlob);
              } else {
                reject(new Error("Failed to create thumbnail blob"));
              }
            },
            "image/jpeg",
            0.85,
          );
        }),
      ),
    );
  } catch {
    thumbnailUrl = new URL(
      "demo/thumbnails/placeholder.png",
      new URL(import.meta.env.BASE_URL, document.URL),
    );
    thumbnail_width = 500;
    thumbnail_height = 500;
  }
  return {
    thumbnailUrl,
    fileUrl,
    mime: type,
    width,
    height,
    thumbnail_width,
    thumbnail_height,
    num_frames,
    duration,
    has_audio,
  };
}

export class DemoServer implements HttpHandler {
  //
  // Demo data
  //

  private nextFileID = 3;

  private demoFiles: Record<number, DemoFile> = {
    1: {
      thumbnail: DemoServer.getBuiltinDemoURL(1, "thumbnail", "jpg"),
      file: DemoServer.getBuiltinDemoURL(1, "file", "gif"),
    },
    2: {
      thumbnail: DemoServer.getBuiltinDemoURL(2, "thumbnail", "jpg"),
      file: DemoServer.getBuiltinDemoURL(2, "file", "webm"),
    },
  };

  private services: ServicesObject = {
    "646f776e6c6f616465722074616773": {
      name: "downloader tags",
      type: ServiceType.LOCAL_TAG,
      type_pretty: "local tag service",
    },
    "6c6f63616c2074616773": {
      name: "my tags",
      type: ServiceType.LOCAL_TAG,
      type_pretty: "local tag service",
    },
    "6c6f63616c2066696c6573": {
      name: "my files",
      type: ServiceType.LOCAL_FILE_DOMAIN,
      type_pretty: "local file domain",
    },
    "7265706f7369746f72792075706461746573": {
      name: "repository updates",
      type: ServiceType.LOCAL_FILE_UPDATE_DOMAIN,
      type_pretty: "local update file domain",
    },
    "616c6c206c6f63616c2066696c6573": {
      name: "all local files",
      type: ServiceType.COMBINED_LOCAL_FILE,
      type_pretty: "virtual combined local file service",
    },
    "616c6c206c6f63616c206d65646961": {
      name: "all my files",
      type: ServiceType.COMBINED_LOCAL_MEDIA,
      type_pretty: "virtual combined local media service",
    },
    "616c6c206b6e6f776e2066696c6573": {
      name: "all known files",
      type: ServiceType.COMBINED_FILE,
      type_pretty: "virtual combined file service",
    },
    "616c6c206b6e6f776e2074616773": {
      name: "all known tags",
      type: ServiceType.COMBINED_TAG,
      type_pretty: "virtual combined tag service",
    },
    "6661766f757269746573": {
      name: "favourites",
      type: ServiceType.LOCAL_RATING_LIKE,
      type_pretty: "local like/dislike rating service",
      star_shape: "fat star",
    },
    "7472617368": {
      name: "trash",
      type: ServiceType.LOCAL_FILE_TRASH_DOMAIN,
      type_pretty: "local trash file domain",
    },
  };

  private filesPage: FullPage = {
    name: "files",
    page_key:
      "683726b58fd4361b6c8e616f43e276bedd1f04374a0fab808b97542f0d7f242c",
    page_state: 0,
    page_type: 6,
    is_media_page: true,
    selected: true,
    management: {},
    media: { num_files: 2, hash_ids: [1, 2] },
  };

  private rootPage: FullPage = {
    name: "top page notebook",
    page_key:
      "bb175cdd365af36713e03c67cdf20d6726db0128314eddd18018494d5ca4817c",
    page_state: 0,
    page_type: 10,
    is_media_page: false,
    selected: true,
    pages: [this.filesPage],
  };

  private pagesMap: Record<string, FullPage> = {
    bb175cdd365af36713e03c67cdf20d6726db0128314eddd18018494d5ca4817c:
      this.rootPage,
    "683726b58fd4361b6c8e616f43e276bedd1f04374a0fab808b97542f0d7f242c":
      this.filesPage,
  };

  private fileTagsById: Record<number, Record<string, string[]>> = {
    1: {
      "6c6f63616c2074616773": [
        "1girl",
        "ahoge",
        "blue eyes",
        "character:me-tan",
        "creator:john",
        "green hair",
        "pixel art",
        "rating:general",
        "series:os-tan",
        "series:windows me",
        "solo",
      ],
    },
    2: {
      "6c6f63616c2074616773": ["meta:animated", "meta:animated webm"],
    },
  };

  private knownTags: [string, number][] = [];

  private filesByHash: Record<string, FileMetadata> = {
    "9df84a3cff6f8a3f7d912c85d6d993f55085a4e29965b9f6f2a87336d972bd79": {
      file_id: 1,
      hash: "9df84a3cff6f8a3f7d912c85d6d993f55085a4e29965b9f6f2a87336d972bd79",
      size: 19777,
      mime: "image/gif",
      filetype_human: "static gif",
      filetype_enum: 68,
      ext: ".gif",
      width: 640,
      height: 480,
      duration: null,
      num_frames: null,
      num_words: null,
      has_audio: false,
      blurhash: "UFEW%V~9DeyDB;wh#ZOq;pnox%s$Q.oyTIs7",
      pixel_hash:
        "5ec5f07f9f075ea49e488e3b6bc14271af4ca8455e1b8e9409e421e23ca49eda",
      filetype_forced: false,
      thumbnail_width: 200,
      thumbnail_height: 150,
      notes: {},
      file_services: {
        current: {
          "6c6f63616c2066696c6573": this.services["6c6f63616c2066696c6573"],
          "616c6c206c6f63616c2066696c6573":
            this.services["616c6c206c6f63616c2066696c6573"],
          "616c6c206c6f63616c206d65646961":
            this.services["616c6c206c6f63616c206d65646961"],
        },
        deleted: {},
      },
      time_modified: 1760758570,
      time_modified_details: { local: 1760758570 },
      is_inbox: true,
      is_local: true,
      is_trashed: false,
      is_deleted: false,
      has_transparency: false,
      has_exif: false,
      has_human_readable_embedded_metadata: true,
      has_icc_profile: false,
      known_urls: [],
      ipfs_multihashes: {},
      ratings: { "6661766f757269746573": null },
      file_viewing_statistics: [],
    },
    f1f9478cbf233ff17fc25359246e2303b3ab7c673baeccde328acdcc0d08a6c5: {
      file_id: 2,
      hash: "f1f9478cbf233ff17fc25359246e2303b3ab7c673baeccde328acdcc0d08a6c5",
      size: 5423066,
      mime: "video/webm",
      filetype_human: "webm",
      filetype_enum: 21,
      ext: ".webm",
      width: 1280,
      height: 720,
      duration: 23270,
      num_frames: 555,
      num_words: null,
      has_audio: true,
      blurhash: "M;LXVg?HRjWVo0~DrxRjofoLoxNFW.t7WC",
      pixel_hash: null,
      filetype_forced: false,
      thumbnail_width: 200,
      thumbnail_height: 112,
      notes: {
        license: `This file is licensed under the Creative Commons Attribution 3.0 Unported license.
Attribution: (c) copyright Blender Foundation | www.bigbuckbunny.org
    You are free:
     -  to share – to copy, distribute and transmit the work
     -  to remix – to adapt the work
    Under the following conditions:
     -  attribution – You must give appropriate credit, provide a link to the license, and indicate if changes were made. You may do so in any reasonable manner, but not in any way that suggests the licensor endorses you or your use.`,
      },
      file_services: {
        current: {
          "6c6f63616c2066696c6573": this.services["6c6f63616c2066696c6573"],
          "616c6c206c6f63616c2066696c6573":
            this.services["616c6c206c6f63616c2066696c6573"],
          "616c6c206c6f63616c206d65646961":
            this.services["616c6c206c6f63616c206d65646961"],
        },
        deleted: {},
      },
      time_modified: 1760765640,
      time_modified_details: {
        local: 1760765640,
      },
      is_inbox: true,
      is_local: true,
      is_trashed: false,
      is_deleted: false,
      has_transparency: false,
      has_exif: false,
      has_human_readable_embedded_metadata: false,
      has_icc_profile: false,
      known_urls: [],
      ipfs_multihashes: {},
      ratings: { "6661766f757269746573": null },
      file_viewing_statistics: [],
    },
  };

  private filesById: Record<number, FileMetadata> = {
    1: this.filesByHash[
      "9df84a3cff6f8a3f7d912c85d6d993f55085a4e29965b9f6f2a87336d972bd79"
    ]!,
    2: this.filesByHash[
      "f1f9478cbf233ff17fc25359246e2303b3ab7c673baeccde328acdcc0d08a6c5"
    ]!,
  };

  //
  // Demo helpers
  //

  constructor() {
    this.recalculateKnownTags();
  }

  getDemoFile(id: number, type: "file" | "thumbnail"): URL {
    if (!this.demoFiles[id]) {
      throw new Error("File not found");
    }
    return this.demoFiles[id][type];
  }

  private servicesFor(serviceType: ServiceType) {
    return Object.entries(this.services)
      .filter(([, value]) => value.type === serviceType)
      .map(([service_key, value]) => ({ service_key, ...value }));
  }

  private static getBuiltinDemoURL(
    fileId: number,
    type: "file" | "thumbnail",
    ext: string,
  ) {
    return new URL(
      `demo/${type}s/${fileId}.${ext}`,
      new URL(import.meta.env.BASE_URL, document.URL),
    );
  }

  private recalculateKnownTags() {
    this.knownTags = [
      ...Object.values(this.fileTagsById).reduce((n, m) => {
        const fileTags = Object.values(m).reduce(
          (n, m) => new Set([...n, ...m]),
          new Set<string>(),
        );
        for (const tag of fileTags) {
          n.set(tag, (n.get(tag) ?? 0) + 1);
        }
        return n;
      }, new Map<string, number>()),
    ];
  }

  private static removeSubPageDetails(root: Page): Page {
    if (!root.pages) {
      return root;
    }
    return {
      ...root,
      pages: root.pages
        .map(
          ({
            name,
            page_key,
            page_state,
            page_type,
            is_media_page,
            selected,
            pages,
          }) => ({
            name,
            page_key,
            page_state,
            page_type,
            is_media_page,
            selected,
            pages,
          }),
        )
        .map(DemoServer.removeSubPageDetails),
    };
  }

  private getFileTags(file: FileMetadata) {
    return Object.values(this.fileTagsById[file.file_id] ?? {}).reduce(
      (n, m) => new Set([...n, ...m]),
      new Set<string>(),
    );
  }

  private getTagAsNumber(file: FileMetadata, prefix: string): number[] {
    const tagNumbers = [];
    for (const fileTag of this.getFileTags(file)) {
      if (fileTag.startsWith(prefix + ":")) {
        const numPart = fileTag.substring(prefix.length + 1);
        const num = parseInt(numPart);
        if (!isNaN(num)) {
          tagNumbers.push(num);
        }
      }
    }
    return tagNumbers;
  }

  private getFiles(files: Array<{ hash: string }>): FileMetadata[] {
    return files.map(({ hash }) => {
      const file = this.filesByHash[hash];
      if (!file) {
        return {
          file_id: null,
          hash,
        } as unknown as FileMetadata;
      }
      const tags: FileMetadata["tags"] = {};
      const tagsForFile = this.fileTagsById[file.file_id] ?? {};
      for (const [key, service] of Object.entries(this.services)) {
        if (service.type === ServiceType.LOCAL_TAG) {
          const tagsForService = tagsForFile[key];
          const tagObj: Record<string, string[]> = {};
          if (tagsForService && tagsForService.length > 0)
            tagObj[ContentUpdateAction.ADD] = tagsForService;
          tags[key] = {
            ...this.services[key],
            storage_tags: tagObj,
            display_tags: tagObj,
          };
        }
        if (service.type === ServiceType.COMBINED_TAG) {
          const tagsForAllServices = [
            ...Object.values(tagsForFile).reduce(
              (n, m) => new Set([...n, ...m]),
              new Set<string>(),
            ),
          ];
          const tagObj: Record<string, string[]> = {};
          if (tagsForAllServices.length > 0)
            tagObj[ContentUpdateAction.ADD] = tagsForAllServices;
          tags[key] = {
            ...this.services[key],
            storage_tags: tagObj,
            display_tags: tagObj,
          };
        }
      }
      return { ...file, tags };
    });
  }

  jsonParam(params: URLSearchParams, key: string): unknown | null {
    const param = params.get(key);
    if (param === null) {
      return null;
    }
    try {
      return JSON.parse(param);
    } catch {
      throw badRequest(
        `I was expecting to parse '${key}' as a json-encoded string, but it failed.`,
      );
    }
  }

  jsonArrayParam(params: URLSearchParams, key: string): unknown[] | null {
    const param = this.jsonParam(params, key);
    if (Array.isArray(param) || param === null) {
      return param;
    }
    throw badRequest(
      `The parameter "${key}", with value "${params.get(key)}", was not the expected type: list!`,
    );
  }

  intParam(params: URLSearchParams, key: string): number | null {
    const param = params.get(key);
    if (param === null) {
      return null;
    }
    const value = parseInt(param);
    if (isNaN(value)) {
      throw badRequest(
        `I was expecting to parse '${key}' as an integer, but it failed.`,
      );
    }
    return value;
  }

  requiredParam(params: URLSearchParams, key: string): string {
    const param = params.get(key);
    if (param === null) {
      throw badRequest(`The required parameter "${key}" was missing!`);
    }
    return param;
  }

  filesRequest(
    files: FilesParam,
  ): Array<{ file_id: number | null; hash: string }> {
    const { file_id, file_ids, hash, hashes } = files;
    if (file_id) {
      const file = this.filesById[file_id];
      if (!file) {
        throw badRequest(
          `It seems you gave a file_id that does not exist! Was asked about these novel hash_ids: [${file_id}]`,
        );
      }
      const { hash } = file;
      return [{ file_id, hash }];
    }
    if (file_ids) {
      return file_ids.map((file_id) => {
        const file = this.filesById[file_id];
        if (!file) {
          throw badRequest(
            `It seems you gave a file_id that does not exist! Was asked about these novel hash_ids: [${file_id}]`,
          );
        }
        const { hash } = file;
        return { file_id, hash };
      });
    }
    if (hash) {
      return [
        {
          file_id: this.filesByHash[hash]?.file_id ?? null,
          hash,
        },
      ];
    }
    if (hashes) {
      return (hashes as string[]).map((hash) => ({
        file_id: this.filesByHash[hash]?.file_id ?? null,
        hash,
      }));
    }
    throw badRequest(
      "Please include some files in your request--file_id or hash based!",
    );
  }

  filesParam(
    params: URLSearchParams,
  ): Array<{ file_id: number | null; hash: string }> {
    const file_id = this.intParam(params, "file_id") ?? undefined;
    const file_ids = this.jsonArrayParam(params, "file_ids")?.map(Number);
    const hash = params.get("hash") ?? undefined;
    const hashes = this.jsonArrayParam(params, "hashes")?.map(String);
    return this.filesRequest({ file_id, file_ids, hash, hashes });
  }

  //
  // Demo handlers
  //

  private async verifyAccessKey(): Promise<Response> {
    return jsonResponse({
      name: "hydrui-demo",
      permits_everything: true,
      basic_permissions: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
      human_description: "API Permissions (hydrui-demo): can do anything",
    });
  }

  private async getServices(): Promise<Response> {
    return jsonResponse({
      local_tags: this.servicesFor(ServiceType.LOCAL_TAG),
      tag_repositories: this.servicesFor(ServiceType.TAG_REPOSITORY),
      local_files: this.servicesFor(ServiceType.LOCAL_FILE_DOMAIN),
      local_updates: this.servicesFor(ServiceType.LOCAL_FILE_UPDATE_DOMAIN),
      file_repositories: this.servicesFor(ServiceType.FILE_REPOSITORY),
      all_local_files: this.servicesFor(ServiceType.COMBINED_LOCAL_FILE),
      all_local_media: this.servicesFor(ServiceType.COMBINED_LOCAL_MEDIA),
      all_known_files: this.servicesFor(ServiceType.COMBINED_FILE),
      all_known_tags: this.servicesFor(ServiceType.COMBINED_TAG),
      trash: this.servicesFor(ServiceType.LOCAL_FILE_TRASH_DOMAIN),
      services: this.services,
    });
  }

  private async getPopups(): Promise<Response> {
    return jsonResponse({ job_statuses: [] });
  }

  private async getPages(): Promise<Response> {
    return jsonResponse({
      pages: DemoServer.removeSubPageDetails(this.rootPage),
    });
  }

  private async getPageInfo(params: URLSearchParams) {
    const pageKey = this.requiredParam(params, "page_key");
    const page_info = this.pagesMap[pageKey];
    if (!page_info) {
      return notFound(`Did not find a page for "${pageKey}"!`);
    }
    return jsonResponse({ page_info });
  }

  private async addFiles(body: Blob) {
    const request: AddFilesRequest = JSON.parse(await body.text());
    const page_info = this.pagesMap[request.page_key];
    if (!page_info) {
      return notFound(`Did not find a page for "${request.page_key}"!`);
    }
    const files = this.filesRequest(request).map(({ file_id, hash }) => {
      if (!file_id) {
        // TODO: not sure what the hydrus error is for this case
        throw notFound(`Hash not found: ${hash}`);
      }
      return file_id;
    });
    page_info.media?.hash_ids?.splice(
      0,
      page_info.media.hash_ids.length,
      ...new Set([...page_info.media.hash_ids, ...files]),
    );
    return emptyResponse();
  }

  private async getFileMetadata(params: URLSearchParams) {
    return jsonResponse({
      metadata: this.getFiles(this.filesParam(params)),
    });
  }

  private async searchFiles(params: URLSearchParams) {
    const re = {
      duration:
        /^system:duration\s*([<>~=]+|\sis\s)\s*(\d+(?:\.\d+)?)\s*([a-z]+)$/,
      numTags: /^system:number of tags\s*([<>~=]+|\sis\s)\s*(\d+)$/,
      width: /^system:width\s*([<>~=]+|\sis\s)\s*(\d+)$/,
      height: /^system:height\s*([<>~=]+|\sis\s)\s*(\d+)$/,
      filesize:
        /^system:filesize\s*([<>~=]+|\sis\s)\s*(\d+(?:\.\d+)?)\s*((?:kilo|mega|giga|peta)bytes?|[kmgpKMGP]i?[bB])$/,
      filetype: /^system:filetype\s*(?:=|\sis\s)\s*([a-zA-Z0-9/]+)/,
      hash: /^system:hash\s*(?:=|\sis\s)\s*([a-zA-Z0-9/]+)/,
      modTime: /^system:modified date\s*([<>~=]+|\sis\s)\s*(.+)$/,
      ratio: /^system:ratio\s+(is|is wider than|taller than)\s+(\d+):(\d+)$/,
      tagAsNum: /^system:tag as number\s+(.+?)\s*([<>~=]+)\s*(\d+)$/,
      numNotes: /^system:num notes\s*([<>~=]+|\sis\s)\s*(\d+)$/,
      limit: /^system:limit\s*(?:=|\sis\s)\s*(\d+)$/,
    };
    const tags = new Set(this.jsonArrayParam(params, "tags")?.map(String));
    if (!tags) {
      throw badRequest('The required parameter "search" was missing!');
    }
    let limit: number | undefined = undefined;
    let match: RegExpMatchArray | null = null;
    const filter: Array<(f: FileMetadata) => boolean> = [];
    for (const tag of new Set(tags)) {
      if (tag === "system:everything") {
        // Do nothing
      } else if (tag === "system:has audio") {
        filter.push((f) => Boolean(f.has_audio));
      } else if (tag === "system:no audio") {
        filter.push((f) => Boolean(!f.has_audio));
      } else if (tag === "system:has duration") {
        filter.push((f) => Boolean(f.duration));
      } else if (tag === "system:no duration") {
        filter.push((f) => Boolean(!f.duration));
      } else if (tag === "system:has tags") {
        filter.push((f) => this.getFileTags(f).size !== 0);
      } else if (tag === "system:no tags" || tag === "system:untagged") {
        filter.push((f) => this.getFileTags(f).size === 0);
      } else if (tag === "system:has notes") {
        filter.push((f) => Object.keys(f.notes ?? {}).length > 0);
      } else if (
        tag === "system:no notes" ||
        tag === "system:does not have notes"
      ) {
        filter.push((f) => Object.keys(f.notes ?? {}).length === 0);
      } else if (tag.startsWith("system:has url matching regex ")) {
        const regex = new RegExp(tag.substring(30));
        filter.push((f) => !!f.known_urls?.some((u) => regex.test(u)));
      } else if (tag.startsWith("system:does not have a url matching regex ")) {
        const regex = new RegExp(tag.substring(42));
        filter.push((f) => !f.known_urls?.some((u) => regex.test(u)));
      } else if (tag.startsWith("system:has url ")) {
        const url = tag.substring(15);
        filter.push((f) => !!f.known_urls?.includes(url));
      } else if (tag.startsWith("system:does not have url ")) {
        const url = tag.substring(25);
        filter.push((f) => !f.known_urls?.includes(url));
      } else if (tag.startsWith("system:has domain ")) {
        const domain = tag.substring(18);
        filter.push((f) => !!f.known_urls?.some((url) => url.includes(domain)));
      } else if (tag.startsWith("system:does not have domain ")) {
        const domain = tag.substring(28);
        filter.push((f) => !f.known_urls?.some((url) => url.includes(domain)));
      } else if (tag.startsWith("system:has note with name ")) {
        const noteName = tag.substring(26);
        filter.push((f) => !!Object.keys(f.notes ?? {}).includes(noteName));
      } else if (
        tag.startsWith("system:no note with name ") ||
        tag.startsWith("system:does not have note with name ")
      ) {
        const noteName = tag.startsWith("system:no note with name ")
          ? tag.substring(25)
          : tag.substring(36);
        filter.push((f) => !Object.keys(f.notes ?? {}).includes(noteName));
      } else if ((match = tag.match(re.duration))) {
        const [, op, valueStr, unit] = match;
        let value = parseFloat(String(valueStr));
        if (unit!.match(/m(illi)?s(ec(ond)?s?)?/)) value *= 1;
        else if (unit!.match(/s(ec(ond)?s?)?/)) value *= 1000;
        else if (unit!.match(/m(in(ute)?s?)?/)) value *= 60000;
        else if (unit!.match(/h(ours?)?/)) value *= 3600000;
        else throw badRequest(`invalid duration unit ${unit}`);
        filter.push((f) => this.cmpOp(f.duration ?? 0, op!, value));
      } else if ((match = tag.match(re.numTags))) {
        const [, op, valueStr] = match;
        const value = parseInt(String(valueStr));
        filter.push((f) => this.cmpOp(this.getFileTags(f).size, op!, value));
      } else if ((match = tag.match(re.width))) {
        const [, op, valueStr] = match;
        const value = parseInt(String(valueStr));
        filter.push((f) => !!f.width && this.cmpOp(f.width, op!, value));
      } else if ((match = tag.match(re.height))) {
        const [, op, valueStr] = match;
        const value = parseInt(String(valueStr));
        filter.push((f) => !!f.height && this.cmpOp(f.height, op!, value));
      } else if ((match = tag.match(re.filesize))) {
        const [, op, valueStr, unit] = match;
        let value = parseFloat(String(valueStr));
        if (unit![0] == "k" || unit![0] == "K") value *= 0x400;
        else if (unit![0] == "m" || unit![0] == "M") value *= 0x100000;
        else if (unit![0] == "g" || unit![0] == "G") value *= 0x40000000;
        filter.push((f) => !!f.size && this.cmpOp(f.size, op!, value));
      } else if ((match = tag.match(re.filetype))) {
        const [, value] = match;
        const lowerValue = value?.toLowerCase();
        filter.push((f) => !!f.mime && f.mime.toLowerCase() === lowerValue);
      } else if ((match = tag.match(re.hash))) {
        const [, value] = match;
        const lowerValue = value?.toLowerCase();
        filter.push((f) => !!f.hash && f.hash.toLowerCase() === lowerValue);
      } else if ((match = tag.match(re.modTime))) {
        const [, op, dateStr] = match;
        const value = new Date(String(dateStr)).getTime() / 1000;
        filter.push(
          (f) => !!f.time_modified && this.cmpOp(f.time_modified, op!, value),
        );
      } else if ((match = tag.match(re.ratio))) {
        const [, comparison, width, height] = match;
        const r = parseInt(String(width)) / parseInt(String(height));
        if (comparison === "is") {
          filter.push(
            (f) =>
              !!(
                f.width &&
                f.height &&
                Math.abs(f.width / f.height - r) <= 0.01
              ),
          );
        } else if (comparison === "is wider than") {
          filter.push((f) => !!(f.width && f.height && f.width / f.height > r));
        } else if (comparison === "taller than") {
          filter.push((f) => !!(f.width && f.height && f.width / f.height < r));
        }
      } else if ((match = tag.match(re.tagAsNum))) {
        const [, tagPrefix, op, valueStr] = match;
        const value = parseInt(String(valueStr));
        filter.push((f) =>
          this.getTagAsNumber(f, tagPrefix!).some((num) =>
            this.cmpOp(num, op!, value),
          ),
        );
      } else if ((match = tag.match(re.numNotes))) {
        const [, op, valueStr] = match;
        const value = parseInt(String(valueStr));
        filter.push((f) =>
          this.cmpOp(Object.keys(f.notes ?? {}).length, op!, value),
        );
      } else if ((match = tag.match(re.limit))) {
        limit = Number(match[1]);
      } else {
        if (tag.startsWith("system:")) {
          throw badRequest(`Unsupported system tag or invalid syntax: ${tag}`);
        }
        continue;
      }
      tags.delete(tag);
    }
    const file_ids: number[] = [];
    const matchTags = [...tags];
    for (const file of Object.values(this.filesById).filter((file) =>
      filter.every((fn) => fn(file)),
    )) {
      if (limit && file_ids.length >= limit) {
        break;
      }
      const fileTags = this.getFileTags(file);
      if (matchTags.every(fileTags.has.bind(fileTags))) {
        file_ids.push(file.file_id);
      }
    }
    return jsonResponse({ file_ids });
  }

  private cmpOp(
    fileValue: number,
    operator: string,
    targetValue: number,
  ): boolean {
    if (operator === "~=") {
      const tolerance = targetValue * 0.15;
      return Math.abs(fileValue - targetValue) <= tolerance;
    } else if (operator === "=" || operator === " is ") {
      return fileValue === targetValue;
    } else if (operator === ">") {
      return fileValue > targetValue;
    } else if (operator === "<") {
      return fileValue < targetValue;
    } else if (operator === ">=") {
      return fileValue >= targetValue;
    } else if (operator === "<=") {
      return fileValue <= targetValue;
    }
    return false;
  }

  private async searchTags(params: URLSearchParams) {
    const search = this.requiredParam(params, "search");
    const tags = [
      ...this.knownTags.filter(([value]) => value.indexOf(search) !== -1),
    ].map(([value, count]) => ({ value, count }));
    return jsonResponse({ tags });
  }

  private async addTags(body: Blob) {
    const request: AddTagsRequest = JSON.parse(await body.text());
    const files = this.filesRequest(request);
    const fileTags = files.map(({ file_id, hash }) => {
      if (!file_id) {
        // TODO: not sure what the hydrus error is for this case
        throw notFound(`Hash not found: ${hash}`);
      }
      return this.fileTagsById[file_id] ?? (this.fileTagsById[file_id] = {});
    });
    for (const [service_key, actions_to_tags] of Object.entries(
      request.service_keys_to_actions_to_tags,
    )) {
      const addAction = actions_to_tags[ContentUpdateAction.ADD];
      const removeAction = actions_to_tags[ContentUpdateAction.DELETE];
      if (addAction) {
        for (const tagsToEdit of fileTags) {
          tagsToEdit[service_key] = [
            ...new Set([...(tagsToEdit[service_key] ?? []), ...addAction]),
          ];
        }
      }
      if (removeAction) {
        const setToRemove = new Set(removeAction);
        for (const tagsToEdit of fileTags) {
          const newTags = (tagsToEdit[service_key] ?? []).filter(
            (tag) => !setToRemove.has(tag),
          );
          if (newTags.length > 0) {
            tagsToEdit[service_key] = newTags;
          } else {
            delete tagsToEdit[service_key];
          }
        }
      }
    }
    this.recalculateKnownTags();
    return emptyResponse();
  }

  private async associateUrl(body: Blob) {
    const request: AssociateUrlRequest = JSON.parse(await body.text());
    const files = this.filesRequest(request).map(({ file_id, hash }) => {
      if (!file_id || !this.filesById[file_id]) {
        // TODO: not sure what the hydrus error is for this case
        throw notFound(`Hash not found: ${hash}`);
      }
      return this.filesById[file_id];
    });
    const deleteSet = new Set(request.urls_to_delete);
    for (const file of files) {
      file.known_urls = [
        ...new Set([...(file.known_urls ?? []), ...request.urls_to_add]),
      ].filter((url) => !deleteSet.has(url));
    }
    return emptyResponse();
  }

  private async deleteNotes(body: Blob) {
    const request: DeleteNotesRequest = JSON.parse(await body.text());
    const files = this.filesRequest(request).map(({ file_id, hash }) => {
      if (!file_id || !this.filesById[file_id]) {
        // TODO: not sure what the hydrus error is for this case
        throw notFound(`Hash not found: ${hash}`);
      }
      return this.filesById[file_id];
    });
    for (const file of files) {
      if (file.notes) {
        for (const name of request.note_names) {
          delete file.notes[name];
        }
      }
    }
    return emptyResponse();
  }

  private async addNotes(body: Blob) {
    const request: AddNotesRequest = JSON.parse(await body.text());
    const files = this.filesRequest(request).map(({ file_id, hash }) => {
      if (!file_id || !this.filesById[file_id]) {
        // TODO: not sure what the hydrus error is for this case
        throw notFound(`Hash not found: ${hash}`);
      }
      return this.filesById[file_id];
    });
    for (const file of files) {
      file.notes = Object.assign(file.notes ?? {}, request.notes);
    }
    return jsonResponse({ notes: request.notes });
  }

  private async addFile(body: Blob) {
    const hashBuffer = await window.crypto.subtle.digest(
      "SHA-256",
      await body.arrayBuffer(),
    );
    const hash = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    if (this.filesByHash[hash]) {
      return jsonResponse({
        status: 2,
        hash,
        note: "File was previously imported",
      });
    }
    const {
      thumbnailUrl,
      fileUrl,
      mime,
      width,
      height,
      thumbnail_width,
      thumbnail_height,
      duration,
      num_frames,
      has_audio,
    } = await processFile(body);
    const time = Date.now();
    const fileUrls: DemoFile = {
      file: new URL(fileUrl),
      thumbnail: new URL(thumbnailUrl),
    };
    const file: FileMetadata = {
      file_id: this.nextFileID++,
      hash,
      size: body.size,
      mime,
      width,
      height,
      thumbnail_width,
      thumbnail_height,
      duration,
      num_frames,
      has_audio,

      blurhash: "",
      pixel_hash: null,
      filetype_forced: false,
      notes: {},
      file_services: {
        current: {
          "6c6f63616c2066696c6573": this.services["6c6f63616c2066696c6573"],
          "616c6c206c6f63616c2066696c6573":
            this.services["616c6c206c6f63616c2066696c6573"],
          "616c6c206c6f63616c206d65646961":
            this.services["616c6c206c6f63616c206d65646961"],
        },
        deleted: {},
      },
      time_modified: time,
      time_modified_details: {
        local: time,
      },
      is_inbox: true,
      is_local: true,
      is_trashed: false,
      is_deleted: false,
      has_transparency: false,
      has_exif: false,
      has_human_readable_embedded_metadata: false,
      has_icc_profile: false,
      known_urls: [],
      ipfs_multihashes: {},
      ratings: { "6661766f757269746573": null },
      file_viewing_statistics: [],
    };
    this.demoFiles[file.file_id] = fileUrls;
    this.filesById[file.file_id] = file;
    this.filesByHash[file.hash] = file;
    return jsonResponse({ status: 1, hash, note: "" });
  }

  private async setRating(body: Blob) {
    const request: SetRatingRequest = JSON.parse(await body.text());
    const files = this.filesRequest(request);
    for (const { file_id, hash } of files) {
      if (!file_id || !this.filesById[file_id]) {
        // TODO: not sure what the hydrus error is for this case
        throw notFound(`Hash not found: ${hash}`);
      }
      if (!this.filesById[file_id].ratings) {
        this.filesById[file_id].ratings = {};
      }
      this.filesById[file_id].ratings[request.rating_service_key] =
        request.rating;
    }
    return emptyResponse();
  }

  //
  // Demo router
  //

  async handle(request: Request, body: Blob): Promise<Response> {
    const url = new URL(request.url);
    switch (url.pathname) {
      case "/verify_access_key":
        return this.verifyAccessKey();
      case "/get_services":
        return this.getServices();
      case "/manage_popups/get_popups":
        return this.getPopups();
      case "/manage_pages/get_pages":
        return this.getPages();
      case "/manage_pages/get_page_info":
        return this.getPageInfo(url.searchParams);
      case "/manage_pages/add_files":
        return this.addFiles(body);
      case "/get_files/file_metadata":
        return this.getFileMetadata(url.searchParams);
      case "/get_files/search_files":
        return this.searchFiles(url.searchParams);
      case "/add_tags/search_tags":
        return this.searchTags(url.searchParams);
      case "/add_tags/add_tags":
        return this.addTags(body);
      case "/add_urls/associate_url":
        return this.associateUrl(body);
      case "/add_notes/delete_notes":
        return this.deleteNotes(body);
      case "/add_notes/set_notes":
        return this.addNotes(body);
      case "/add_files/add_file":
        return this.addFile(body);
      case "/edit_ratings/set_rating":
        return this.setRating(body);
      case "/manage_pages/refresh_page":
        return emptyResponse();
      default:
        console.log(`unhandled API path: ${url.pathname}`);
        return new Response("page not found", { status: 404 });
    }
  }
}
