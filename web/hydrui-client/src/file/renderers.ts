import { MemoryFile, createRemoteFile } from "hydrui-util/src/stream";

import { FileRenderer, RendererName } from "./types";

export const renderers = new Map<RendererName, FileRenderer>();

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
