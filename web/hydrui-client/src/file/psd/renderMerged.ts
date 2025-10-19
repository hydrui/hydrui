import { createRemoteFile } from "hydrui-util/src/stream";

export async function renderMergedImage(fileUrl: string): Promise<URL> {
  const { PSDParser } = await import("./PSDViewer");
  const stream = new PSDParser(await createRemoteFile(fileUrl));
  await stream.parse();
  const bitmap = await stream.parseMerged();
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Unable to get 2D drawing context.");
  }
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new URL(
    URL.createObjectURL(
      await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((mergedBlob) => {
          if (mergedBlob) {
            resolve(mergedBlob);
          } else {
            reject(new Error("Failed to create thumbnail blob"));
          }
        }, "image/png");
      }),
    ),
  );
}
