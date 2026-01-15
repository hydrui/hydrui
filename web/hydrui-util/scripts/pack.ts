import { readFile, readdir, stat, writeFile } from "fs/promises";
import { dirname, join, posix, relative, resolve } from "path";
import { fileURLToPath } from "url";
import { promisify } from "util";
import { brotliCompress, constants } from "zlib";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const compress = promisify(brotliCompress);

interface FileEntry {
  path: string;
  data: Buffer;
  compressed: boolean;
}

async function scanDirectory(dirPath: string): Promise<string[]> {
  const files: string[] = [];

  async function scan(currentPath: string): Promise<void> {
    const entries = await readdir(currentPath);

    for (const entry of entries) {
      const fullPath = join(currentPath, entry);
      const stats = await stat(fullPath);

      if (stats.isDirectory()) {
        await scan(fullPath);
      } else if (stats.isFile()) {
        files.push(fullPath);
      }
    }
  }

  await scan(dirPath);
  return files;
}

async function processFile(
  filePath: string,
  distPath: string,
): Promise<FileEntry> {
  const originalData = await readFile(filePath);
  const relativePath = posix.normalize(
    relative(distPath, filePath).replace(/\\/g, "/"),
  );

  try {
    const compressedData = await compress(originalData, {
      [constants.BROTLI_PARAM_QUALITY]: 11,
    });

    if (compressedData.length < originalData.length) {
      return {
        path: relativePath,
        data: compressedData,
        compressed: true,
      };
    }
  } catch (error) {
    console.warn(
      `Compression failed for ${filePath}: ${error}; using uncompressed data`,
    );
  }

  return {
    path: relativePath,
    data: originalData,
    compressed: false,
  };
}

function createArchive(files: FileEntry[]): Buffer {
  const buffers: Buffer[] = [];

  for (const file of files) {
    const pathBuffer = Buffer.from(file.path, "utf8");

    const sizeBuffer = Buffer.allocUnsafe(4);
    sizeBuffer.writeUInt32LE(file.data.length, 0);

    const flagsBuffer = Buffer.allocUnsafe(2);
    flagsBuffer.writeUInt16LE(file.compressed ? 1 : 0, 0);

    const pathLengthBuffer = Buffer.allocUnsafe(2);
    pathLengthBuffer.writeUInt16LE(pathBuffer.length, 0);

    buffers.push(
      sizeBuffer,
      flagsBuffer,
      pathLengthBuffer,
      pathBuffer,
      file.data,
    );
  }

  return Buffer.concat(buffers);
}

async function pack(dirPath: string, archivePath: string, exclude: string[]) {
  console.log("Scanning dist directory...");
  const filePaths = await scanDirectory(dirPath);
  filePaths.sort();
  console.log(`Found ${filePaths.length} files`);

  console.log("Processing files...");
  const jobs: Promise<FileEntry>[] = [];

  for (const filePath of filePaths) {
    const relaPath = relative(dirPath, filePath);
    if (exclude.some((p) => relaPath.startsWith(p))) {
      console.log(`Skipped ${relaPath}`);
      continue;
    }
    jobs.push(
      (async () => {
        const entry = await processFile(filePath, dirPath);
        console.log(
          `Processed ${entry.path} (${entry.compressed ? "compressed" : "original"}, ${entry.data.length} bytes)`,
        );
        return entry;
      })(),
    );
  }

  const files: FileEntry[] = await Promise.all(jobs);

  console.log("Creating archive...");
  const archive = createArchive(files);
  await writeFile(archivePath, archive);

  console.log(`Archive created: ${archivePath} (${archive.length} bytes)`);

  // Summary
  const compressedCount = files.filter((f) => f.compressed).length;
  console.log(
    `${compressedCount}/${files.length} files compressed with Brotli`,
  );
}

async function main() {
  const clientDistPath = resolve(__dirname, "../../hydrui-client/dist");
  const clientPackPath = resolve(
    __dirname,
    "../../../internal/webdata/client.pack",
  );

  try {
    await pack(clientDistPath, clientPackPath, ["demo/"]);
  } catch (error) {
    console.error("Error creating archives:", error);
    process.exit(1);
  }
}

main();
