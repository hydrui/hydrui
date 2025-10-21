import { MemoryFile, createRemoteFile } from "hydrui-util/src/stream";

import { FileMetadata } from "@/api/types";
import { HydrusFileType, categoryFromFiletype } from "@/constants/filetypes";
import { client } from "@/store/apiStore";
import { usePreferencesStore } from "@/store/preferencesStore";
import { isDemoMode } from "@/utils/modes";

import { FileRenderer, RendererName } from "./types";

export const renderers = new Map<RendererName, FileRenderer>();

renderers.set(RendererName.HydruiImageRenderer, {
  async rasterize(file, fileData) {
    const blob =
      file instanceof URL ? await fetch(file).then((r) => r.blob()) : file;
    const bitmap = await createImageBitmap(blob);
    fileData.width = bitmap.width;
    fileData.height = bitmap.height;
    return bitmap;
  },
});

renderers.set(RendererName.HydruiVideoStillRenderer, {
  async rasterize(file, fileData) {
    const fileUrl =
      file instanceof URL ? String(file) : URL.createObjectURL(file);
    try {
      const video = document.createElement("video");
      video.muted = true;
      video.crossOrigin = "anonymous";
      await new Promise((resolve, reject) => {
        video.onloadedmetadata = resolve;
        video.onerror = reject;
        video.src = fileUrl;
      });
      video.currentTime = Math.min(5, video.duration);
      fileData.num_frames = video.getVideoPlaybackQuality()?.totalVideoFrames;
      fileData.has_audio =
        Boolean((video as unknown as { mozHasAudio?: boolean }).mozHasAudio) ||
        Boolean(
          (video as unknown as { webkitAudioDecodedByteCount: number })
            .webkitAudioDecodedByteCount,
        ) ||
        Boolean(
          (video as unknown as { audioTracks?: Array<unknown> }).audioTracks
            ?.length,
        );
      fileData.duration = (video.duration * 1000) | 0;
      await new Promise((resolve) => {
        video.onseeked = resolve;
      });
      fileData.width = video.videoWidth;
      fileData.height = video.videoHeight;
      return window.createImageBitmap(video);
    } finally {
      if (!(file instanceof URL)) {
        URL.revokeObjectURL(fileUrl);
      }
    }
  },
});

renderers.set(RendererName.HydruiPSDMergedImageRenderer, {
  async rasterize(file) {
    const { PSDParser } = await import("./psd/PSDViewer");
    const stream = new PSDParser(
      file instanceof URL
        ? await createRemoteFile(String(file))
        : new MemoryFile(await file.arrayBuffer()),
    );
    await stream.parse();
    return await stream.parseMerged();
  },
});

renderers.set(RendererName.HydrusRenderer, {
  async rasterize(_file, fileData) {
    const renderUrl = client.getFileRenderUrl(fileData.file_id);
    const blob = await fetch(renderUrl).then((r) => r.blob());
    const bitmap = await createImageBitmap(blob);
    fileData.width = bitmap.width;
    fileData.height = bitmap.height;
    return bitmap;
  },
});

export function renderDispatch(fileData: FileMetadata): FileRenderer {
  const { fileTypeRendererOverride } = usePreferencesStore.getState();
  let rendererName: RendererName | undefined = undefined;
  const fileType = fileData.filetype_enum;
  const category = categoryFromFiletype(fileType);
  if (fileType === HydrusFileType.ANIMATION_UGOIRA) {
    rendererName = RendererName.HydrusRenderer;
  } else if (fileType === HydrusFileType.APPLICATION_PSD) {
    rendererName = RendererName.HydruiPSDMergedImageRenderer;
  } else if (category === HydrusFileType.GENERAL_IMAGE) {
    rendererName = RendererName.HydruiImageRenderer;
  } else if (category === HydrusFileType.GENERAL_ANIMATION) {
    rendererName = RendererName.HydruiImageRenderer;
  } else if (category === HydrusFileType.GENERAL_VIDEO) {
    rendererName = RendererName.HydruiVideoStillRenderer;
  }
  // User overrides
  if (category && fileTypeRendererOverride.has(category)) {
    rendererName = fileTypeRendererOverride.get(category) as RendererName;
  }
  if (fileType && fileTypeRendererOverride.has(fileType)) {
    rendererName = fileTypeRendererOverride.get(fileType) as RendererName;
  }
  if (isDemoMode && rendererName == RendererName.HydrusRenderer) {
    // Can't use Hydrus renderer without Hydrus, after all...
    rendererName = undefined;
  }
  if (!rendererName) {
    throw new Error("Unsupported file type");
  }
  const renderer = renderers.get(rendererName);
  if (!renderer) {
    throw new Error(`No such file renderer ${rendererName}`);
  }
  return renderer;
}
