import { FileMetadata } from "@/api/types";
import { HydrusFileType } from "@/constants/filetypes";

export interface ViewerProps {
  fileId: number;
  fileData: FileMetadata;
  autoPlay: boolean;
  loop: boolean;
  isPreview: boolean;

  navigateLeft?: (() => void) | undefined;
  navigateRight?: (() => void) | undefined;
}

export interface FileViewer {
  renderView(props: ViewerProps): React.ReactNode;
  canHandle(fileType: HydrusFileType): boolean;
}

export interface FileRenderer {
  rasterize(file: Blob | URL): Promise<ImageBitmap>;
}

export enum ViewerName {
  HydruiImageViewer = "Hydrui Image Viewer",
  HydruiVideoViewer = "Hydrui Video Viewer",
  HydruiPSDLayerViewer = "Hydrui PSD Layer Viewer",
  HydruiPSDMergedImageViewer = "Hydrui PSD Merged Image Viewer",
  PDFjs = "PDF.js",
  Ruffle = "Ruffle.rs SWF Player",
  HydrusRenderer = "Hydrus Renderer",
}

export enum RendererName {
  HydruiPSDMergedImageRenderer = "Hydrui PSD Merged Image Renderer",
}
