import { FileTypes } from "@/constants/filetypes";
import { usePreferencesStore } from "@/store/preferencesStore";
import { isDemoMode } from "@/utils/modes";

import { ViewerName, ViewerProps } from "./types";
import { viewers } from "./viewers";

export function ViewDispatcher(props: ViewerProps) {
  const mimeTypeViewerOverride = usePreferencesStore(
    (state) => state.mimeTypeViewerOverride,
  );
  const mimeTypePreviewerOverride = usePreferencesStore(
    (state) => state.mimeTypePreviewerOverride,
  );
  let viewerName: ViewerName | undefined = undefined;
  const mime = props.fileData.mime ?? "";
  if (props.fileData.filetype_enum == FileTypes.AnimationUgoira) {
    viewerName = ViewerName.HydrusRenderer;
  } else if (mime.startsWith("application/pdf")) {
    viewerName = ViewerName.PDFjs;
  } else if (mime.startsWith("image/vnd.adobe.photoshop")) {
    viewerName = ViewerName.HydruiPSDLayerViewer;
  } else if (mime.startsWith("application/x-shockwave-flash")) {
    viewerName = ViewerName.Ruffle;
  } else if (mime.startsWith("video/")) {
    viewerName = ViewerName.HydruiVideoViewer;
  } else if (mime.startsWith("image/")) {
    viewerName = ViewerName.HydruiImageViewer;
  }
  // User overrides
  if (props.isPreview) {
    if (
      mime.match(/^image(\/.*|$)/) &&
      mimeTypePreviewerOverride.has("image")
    ) {
      viewerName = mimeTypePreviewerOverride.get("image") as ViewerName;
    }
    if (
      mime.match(/^video(\/.*|$)/) &&
      mimeTypePreviewerOverride.has("video")
    ) {
      viewerName = mimeTypePreviewerOverride.get("video") as ViewerName;
    }
    if (mimeTypePreviewerOverride.has(mime)) {
      viewerName = mimeTypePreviewerOverride.get(mime) as ViewerName;
    }
  } else {
    if (mime.match(/^image(\/.*|$)/) && mimeTypeViewerOverride.has("image")) {
      viewerName = mimeTypeViewerOverride.get("image") as ViewerName;
    }
    if (mime.match(/^video(\/.*|$)/) && mimeTypeViewerOverride.has("video")) {
      viewerName = mimeTypeViewerOverride.get("video") as ViewerName;
    }
    if (mimeTypeViewerOverride.has(mime)) {
      viewerName = mimeTypeViewerOverride.get(mime) as ViewerName;
    }
  }
  if (isDemoMode && viewerName == ViewerName.HydrusRenderer) {
    // Can't use Hydrus renderer without Hydrus, after all...
    viewerName = undefined;
  }
  if (!viewerName) {
    return <div>Unsupported file type</div>;
  }
  const viewer = viewers.get(viewerName);
  if (!viewer) {
    return <div>No such file viewer {viewerName}</div>;
  }
  return viewer.renderView(props);
}
