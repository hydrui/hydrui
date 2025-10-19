import { useEffect, useState } from "react";

import ImageViewer from "@/file/image/ImageViewer";
import { ViewerProps } from "@/file/types";
import { client } from "@/store/apiStore";

import { renderMergedImage } from "./renderMerged";

// Just uses the merged image renderer with normal image viewer.
export function MergedPSDViewer({
  fileId,
  fileData,
  navigateLeft,
  navigateRight,
}: ViewerProps) {
  const fileUrl = client.getFileUrl(fileData.file_id);
  const [mergedUrl, setMergedUrl] = useState<string>();
  useEffect(() => {
    const render = async () => {
      const url = String(await renderMergedImage(String(fileUrl)));
      setMergedUrl(url);
      return url;
    };
    const promise = render();
    return () => {
      promise.then((url) => {
        // In React strict mode this will probably cause some spurious errors
        // This is because it will render once, unmount, then mount again.
        // This happens so quickly that it is likely to force the blob URL to
        // get revoked once before the DOM has a chance to update. But, it's
        // kind of okay, because it will get replaced with a working blob URL
        // anyways.
        URL.revokeObjectURL(url);
      });
    };
  }, [fileUrl]);
  if (!mergedUrl) {
    return <div>Loading PSD...</div>;
  }
  return (
    <ImageViewer
      fileId={fileId}
      fileData={fileData}
      fileUrl={mergedUrl}
      navigateLeft={navigateLeft}
      navigateRight={navigateRight}
    />
  );
}
