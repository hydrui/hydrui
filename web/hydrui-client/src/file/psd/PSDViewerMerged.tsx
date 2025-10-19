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
      setMergedUrl(String(await renderMergedImage(String(fileUrl))));
    };
    render();
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
