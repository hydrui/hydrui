import { HydrusFileType, categoryFromFiletype } from "@/constants/filetypes";
import { usePreferencesStore } from "@/store/preferencesStore";
import { isDemoMode } from "@/utils/modes";

import { ViewerName, ViewerProps } from "./types";
import { viewers } from "./viewers";

export function ViewDispatcher(props: ViewerProps) {
  const fileTypeViewerOverride = usePreferencesStore(
    (state) => state.fileTypeViewerOverride,
  );
  const fileTypePreviewerOverride = usePreferencesStore(
    (state) => state.fileTypePreviewerOverride,
  );
  let viewerName: ViewerName | undefined = undefined;
  const fileType = props.fileData.filetype_enum;
  const category = categoryFromFiletype(fileType);
  if (fileType === HydrusFileType.ANIMATION_UGOIRA) {
    viewerName = ViewerName.HydrusRenderer;
  } else if (fileType === HydrusFileType.APPLICATION_PDF) {
    viewerName = ViewerName.PDFjs;
  } else if (fileType === HydrusFileType.APPLICATION_PSD) {
    viewerName = ViewerName.HydruiPSDLayerViewer;
  } else if (fileType === HydrusFileType.APPLICATION_FLASH) {
    viewerName = ViewerName.Ruffle;
  } else if (category === HydrusFileType.GENERAL_VIDEO) {
    viewerName = ViewerName.HydruiVideoViewer;
  } else if (category === HydrusFileType.GENERAL_AUDIO) {
    viewerName = ViewerName.HydruiVideoViewer;
  } else if (category === HydrusFileType.GENERAL_IMAGE) {
    viewerName = ViewerName.HydruiImageViewer;
  } else if (category === HydrusFileType.GENERAL_ANIMATION) {
    viewerName = ViewerName.HydruiImageViewer;
  }
  // User overrides
  if (props.isPreview) {
    if (category && fileTypePreviewerOverride.has(category)) {
      viewerName = fileTypePreviewerOverride.get(category) as ViewerName;
    }
    if (fileType && fileTypePreviewerOverride.has(fileType)) {
      viewerName = fileTypePreviewerOverride.get(fileType) as ViewerName;
    }
  } else {
    if (category && fileTypeViewerOverride.has(category)) {
      viewerName = fileTypeViewerOverride.get(category) as ViewerName;
    }
    if (fileType && fileTypeViewerOverride.has(fileType)) {
      viewerName = fileTypeViewerOverride.get(fileType) as ViewerName;
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
