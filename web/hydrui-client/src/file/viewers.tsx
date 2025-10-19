import { Suspense, lazy } from "react";

import { client } from "@/store/apiStore";

import ImageViewer from "./image/ImageViewer";
import { MergedPSDViewer } from "./psd/PSDViewerMerged";
import { FileViewer, ViewerName } from "./types";
import VideoViewer from "./video/VideoViewer";

const PSDViewer = lazy(() => import("./psd/PSDViewer"));
const PDFViewer = lazy(() => import("./pdf/PDFViewer"));
const SWFViewer = lazy(() => import("./swf/SWFViewer"));

export const viewers = new Map<ViewerName, FileViewer>();

viewers.set(ViewerName.HydruiImageViewer, {
  renderView({ fileId, fileData, navigateLeft, navigateRight }) {
    const fileUrl = client.getFileUrl(fileData.file_id);
    return (
      <ImageViewer
        fileId={fileId}
        fileData={fileData}
        fileUrl={fileUrl}
        navigateLeft={navigateLeft}
        navigateRight={navigateRight}
      />
    );
  },
  canHandle(mime) {
    if (mime === "image/vnd.adobe.photoshop") {
      return false;
    }
    return Boolean(mime.match(/^image(\/.*|$)/));
  },
});

viewers.set(ViewerName.HydruiVideoViewer, {
  renderView({ fileId, fileData, autoPlay, loop }) {
    return (
      <VideoViewer
        fileId={fileId}
        fileData={fileData}
        autoPlay={autoPlay}
        loop={loop}
      />
    );
  },
  canHandle(mime) {
    return Boolean(mime.match(/^video(\/.*|$)/));
  },
});

viewers.set(ViewerName.HydruiPSDLayerViewer, {
  renderView({ fileData }) {
    const fileUrl = client.getFileUrl(fileData.file_id);
    return (
      <Suspense fallback={<div>Loading PSD Viewer...</div>}>
        <PSDViewer fileUrl={fileUrl} />
      </Suspense>
    );
  },
  canHandle(mime) {
    return mime === "image/vnd.adobe.photoshop";
  },
});

viewers.set(ViewerName.HydruiPSDMergedImageViewer, {
  renderView(props) {
    return (
      <Suspense fallback={<div>Loading PSD...</div>}>
        <MergedPSDViewer {...props} />
      </Suspense>
    );
  },
  canHandle(mime) {
    return mime === "image/vnd.adobe.photoshop";
  },
});

viewers.set(ViewerName.PDFjs, {
  renderView({ fileData }) {
    const fileUrl = client.getFileUrl(fileData.file_id);
    return (
      <Suspense fallback={<div>Loading PDF Viewer...</div>}>
        <PDFViewer fileUrl={fileUrl} />
      </Suspense>
    );
  },
  canHandle(mime) {
    return mime === "application/pdf";
  },
});

viewers.set(ViewerName.Ruffle, {
  renderView({ fileData, autoPlay }) {
    const fileUrl = client.getFileUrl(fileData.file_id);
    return (
      <Suspense fallback={<div>Loading SWF Viewer...</div>}>
        <SWFViewer fileUrl={fileUrl} autoPlay={autoPlay} />
      </Suspense>
    );
  },
  canHandle(mime) {
    return mime === "application/x-shockwave-flash";
  },
});

viewers.set(ViewerName.HydrusRenderer, {
  renderView({ fileId, fileData, navigateLeft, navigateRight }) {
    const renderUrl = client.getFileRenderUrl(fileData.file_id);
    return (
      <ImageViewer
        fileId={fileId}
        fileData={fileData}
        fileUrl={renderUrl}
        navigateLeft={navigateLeft}
        navigateRight={navigateRight}
      />
    );
  },
  canHandle() {
    return true;
  },
});
