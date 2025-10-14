export const minimumRangeRequestSize = 1 << 20; // 1MB
export const maximumRequestSize = 1 << 22; // 4MB
export const defaultChunkSize = 1 << 17; // 128KB
export const maximumRequestChunks = 1 << 5; // 32 (1 << 22 / 1 << 17)

/**
 * A file-like object for I/O operations.
 */
export interface File {
  readonly fileSize: number;
  readonly position: number;

  /**
   * Sets the read cursor position.
   * @param offset The offset from the start, current position, or end of the file.
   * @param whence Determines how the offset is interpreted:
   *   - 'SEEK_SET': Offset is from the start of the file (default).
   *   - 'SEEK_CUR': Offset is from the current cursor position.
   *   - 'SEEK_END': Offset is from the end of the file.
   */
  seek(offset: number, whence?: "SEEK_SET" | "SEEK_CUR" | "SEEK_END"): void;

  /**
   * Reads a specified number of bytes at an offset, or the cursor position.
   * @param offset The offset from the file, or undefined for the cursor
   * position.
   * @param size The number of bytes to read. This will advance the cursor
   * position if offset is undefined.
   * @param readFn A function that will be provided with a DataView and the
   * byte offset it should read from.
   * @returns A Promise that is resolved when the read is complete, or rejected
   * if the read fails.
   */
  read<T>(
    offset: number | undefined,
    size: number,
    readFn: (view: DataView, offset: number) => T,
  ): Promise<T>;

  /**
   * Hints that the given range of bytes will be read soon.
   * @param offset The offset from the start of the file.
   * @param size The number of bytes to be read.
   */
  prefetch(offset: number, size: number): Promise<void>;
}

/**
 * Options for creating a RemoteFileStream.
 */
interface RemoteFileOptions {
  /**
   * The chunk size to use for fetching data. Defaults to 4096.
   */
  chunkSize?: number | undefined;

  /**
   * Whether or not to use multipart fetching.
   */
  multipart?: boolean | undefined;

  /**
   * Optional headers to include in HTTP requests.
   */
  headers?: Record<string, string> | undefined;

  /**
   * An abort signal.
   */
  signal?: AbortSignal | undefined;
}

/**
 * A base class for file-like objects that provides a cursor for reading data.
 */
class FileCursor {
  public readonly fileSize: number;
  private cursor = 0;

  constructor(fileSize: number) {
    this.fileSize = fileSize;
  }

  get position(): number {
    return this.cursor;
  }

  seek(
    offset: number,
    whence: "SEEK_SET" | "SEEK_CUR" | "SEEK_END" = "SEEK_SET",
  ): void {
    let newCursor: number;
    switch (whence) {
      case "SEEK_SET":
        newCursor = offset;
        break;
      case "SEEK_CUR":
        newCursor = this.cursor + offset;
        break;
      case "SEEK_END":
        newCursor = this.fileSize + offset;
        break;
      default:
        throw new Error("Invalid 'whence' value for seek.");
    }

    if (newCursor < 0 || newCursor > this.fileSize) {
      throw new Error(
        `Seek out of bounds: tried to seek to ${newCursor}, file size is ${this.fileSize}`,
      );
    }
    this.cursor = newCursor;
  }

  offsetForRead(offset: number | undefined, size: number): number {
    const readOffset = offset ?? this.position;
    if (readOffset < 0 || readOffset + size > this.fileSize) {
      throw new Error(
        `Read out of bounds: trying offset ${readOffset} + size ${size}, file size ${this.fileSize}`,
      );
    }
    return readOffset;
  }

  advanceForRead(offset: number | undefined, size: number): void {
    if (offset === undefined) {
      this.cursor += size;
    }
  }
}

/**
 * A file-like object for in-memory data.
 */
export class MemoryFile extends FileCursor implements File {
  private readonly dataView: DataView;

  constructor(data: ArrayBuffer) {
    super(data.byteLength);
    this.dataView = new DataView(data);
  }

  async read<T>(
    offset: number | undefined,
    size: number,
    readFn: (view: DataView, offset: number) => T,
  ): Promise<T> {
    const readOffset = this.offsetForRead(offset, size);
    const result = readFn(this.dataView, readOffset);
    this.advanceForRead(offset, size);
    return result;
  }

  async prefetch(): Promise<void> {
    // No-op for in-memory files.
  }
}

/**
 * Provides a file-like stream interface for reading remote files using HTTP
 * Range requests. Fetched data chunks are cached internally.
 */
export class RemoteFile extends FileCursor implements File {
  private readonly url: string;
  private readonly chunkSize: number;
  private readonly headers?: Record<string, string> | undefined;

  private dataBuffer: ArrayBuffer;
  private dataView: DataView;

  private currentRequest?: Promise<void> | undefined;
  private chunksFetched: Set<number> = new Set();
  private abortSignal?: AbortSignal | undefined;
  /**
   * Creates an instance of RemoteFileStream. Prefer using the static `create` method
   * unless the file size is already known.
   * @param url The URL of the remote file.
   * @param fileSize The total size of the file in bytes.
   * @param options Configuration options.
   */
  constructor(url: string, fileSize: number, options: RemoteFileOptions = {}) {
    super(fileSize);

    if (fileSize <= 0) {
      throw new Error("File size must be positive.");
    }
    this.url = url;
    this.chunkSize = options.chunkSize ?? defaultChunkSize;
    this.headers = options.headers;

    this.dataBuffer = new ArrayBuffer(this.fileSize);
    this.dataView = new DataView(this.dataBuffer);

    this.abortSignal = options.signal;
  }

  async read<T>(
    offset: number | undefined,
    size: number,
    readFn: (view: DataView, offset: number) => T,
  ): Promise<T> {
    if (this.abortSignal?.aborted) {
      throw new DOMException("The operation was aborted.", "AbortError");
    }
    const readOffset = this.offsetForRead(offset, size);
    await this.prefetch(readOffset, size);
    const result = readFn(this.dataView, readOffset);
    this.advanceForRead(offset, size);
    return result;
  }

  private blocksToFetch(offset: number, size: number): number[] {
    const blocksToFetch: number[] = [];
    const firstBlock: number = (offset / this.chunkSize) | 0;
    const lastBlock: number =
      ((offset + size + this.chunkSize - 1) / this.chunkSize) | 0;
    for (let i = firstBlock; i <= lastBlock; i++) {
      if (!this.chunksFetched.has(i)) {
        blocksToFetch.push(i);
      }
    }
    return blocksToFetch;
  }

  async prefetch(offset: number, size: number): Promise<void> {
    if (offset + size > this.fileSize) {
      throw new Error("End of file reached.");
    }

    while (this.currentRequest) {
      const blocksToFetch = this.blocksToFetch(offset, size);
      if (blocksToFetch.length === 0) {
        return;
      }
      await this.currentRequest;
    }

    const blocksToFetch = this.blocksToFetch(offset, size);
    if (blocksToFetch.length === 0 || blocksToFetch[0] === undefined) {
      return;
    }

    const contiguousRanges: { start: number; end: number }[] = [
      { start: blocksToFetch[0], end: blocksToFetch[0] },
    ];
    for (const block of blocksToFetch.slice(1)) {
      const lastRange = contiguousRanges[contiguousRanges.length - 1];
      if (
        lastRange &&
        lastRange.end + 1 === block &&
        block - lastRange.start < maximumRequestChunks
      ) {
        lastRange.end = block;
      } else {
        contiguousRanges.push({ start: block, end: block });
      }
    }

    await this.fetchRanges(contiguousRanges);
  }

  private async fetchRanges(
    contiguousRanges: { start: number; end: number }[],
  ) {
    let resolve: (value: void) => void = () => {};
    let reject: (reason?: unknown) => void = () => {};
    try {
      for (const range of contiguousRanges) {
        const firstByte = range.start * this.chunkSize;
        const lastByte = Math.min(
          (range.end + 1) * this.chunkSize - 1,
          this.fileSize - 1,
        );
        const lastResolve = resolve;
        this.currentRequest = new Promise((nextResolve, nextReject) => {
          resolve = nextResolve;
          reject = nextReject;
        });
        // This deference ensures that currentRequest is always the next promise
        // after the previous one is resolved, so that you can loop over the
        // currentRequest value repeatedly until all of them are resolved.
        lastResolve();
        const requestInit: RequestInit = {
          headers: { ...this.headers, Range: `bytes=${firstByte}-${lastByte}` },
        };
        if (this.abortSignal) {
          requestInit.signal = this.abortSignal;
        }
        const response = await fetch(this.url, requestInit);
        if (!response.ok) {
          throw new Error(
            `Failed to fetch block ${range.start}-${range.end} of ${this.url}: ${response.status} ${response.statusText}`,
          );
        }
        new Uint8Array(this.dataBuffer).set(
          new Uint8Array(await response.arrayBuffer()),
          firstByte,
        );
        for (let i = range.start; i <= range.end; i++) {
          this.chunksFetched.add(i);
        }
      }
      this.currentRequest = undefined;
      resolve();
    } catch (error) {
      this.currentRequest = undefined;
      reject(error);
      throw error;
    }
  }
}

/**
 * A file-like object that provides a view into a portion of another file.
 */
export class SubFile extends FileCursor implements File {
  private readonly parent: File;
  private readonly offset: number;

  constructor(parent: File, offset: number, size: number) {
    super(size);
    this.parent = parent;
    this.offset = offset;
  }

  async read<T>(
    offset: number | undefined,
    size: number,
    readFn: (view: DataView, offset: number) => T,
  ): Promise<T> {
    const readOffset = this.offset + this.offsetForRead(offset, size);
    const result = this.parent.read(readOffset, size, readFn);
    this.advanceForRead(offset, size);
    return result;
  }

  async prefetch(offset: number, size: number): Promise<void> {
    await this.parent.prefetch(offset + this.offset, size);
  }
}

/**
 * Creates a File for a given URL, using streaming if possible.
 * @param url The URL of the remote file.
 * @param options Configuration options.
 * @returns A promise that resolves to a File instance.
 */
export async function createRemoteFile(
  url: string,
  options: RemoteFileOptions = {},
): Promise<File> {
  const headRequestInit: RequestInit = {
    method: "HEAD",
    headers: options.headers ?? {},
  };
  const rangeRequestInit: RequestInit = {
    method: "HEAD",
    headers: { ...(options.headers ?? {}), Range: "bytes=0-0" },
  };
  if (options.signal) {
    headRequestInit.signal = options.signal;
    rangeRequestInit.signal = options.signal;
  }
  const [response, rangeResponse] = await Promise.all([
    fetch(url, headRequestInit),
    fetch(url, rangeRequestInit),
  ]);

  if (!response.ok) {
    throw new Error(
      `Failed to fetch file metadata: ${response.status} ${response.statusText}`,
    );
  }

  // We can't use the accept-ranges header because CORS may prevent us from
  // observing it. Also, the Hydrus server doesn't respond with the header
  // unless the request contains a Range header, which requires us to make two
  // requests if we want to be able to detect Range support.
  let useRangeRequests =
    rangeResponse.ok && rangeResponse.headers.get("content-length") === "1";
  if (!useRangeRequests) {
    console.warn(
      `Server for ${url} does not seem to support range requests. `,
      `Fetching the entire file.`,
    );
  }

  const contentLength = response.headers.get("content-length");
  if (!contentLength) {
    throw new Error(
      "Could not determine file size from Content-Length header.",
    );
  }

  const fileSize = parseInt(contentLength, 10);
  if (isNaN(fileSize)) {
    throw new Error(`Invalid Content-Length header: ${contentLength}`);
  }
  if (fileSize < minimumRangeRequestSize) {
    useRangeRequests = false;
  }
  if (!useRangeRequests) {
    const requestInit: RequestInit = {
      method: "GET",
    };
    if (options.headers) {
      requestInit.headers = options.headers;
    }
    const response = await fetch(url, requestInit);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch file: ${response.status} ${response.statusText}`,
      );
    }
    return new MemoryFile(await response.arrayBuffer());
  }

  return new RemoteFile(url, fileSize, options);
}

export class DataStream {
  public readonly file: File;

  constructor(file: File) {
    this.file = file;
  }

  setOffset(offset: number): void {
    this.file.seek(offset, "SEEK_SET");
  }

  getOffset(): number {
    return this.file.position;
  }

  skip(bytes: number): void {
    this.file.seek(bytes, "SEEK_CUR");
  }

  async prefetch(offset: number, size: number): Promise<void> {
    await this.file.prefetch(offset, size);
  }

  async readU8(offset?: number): Promise<number> {
    return this.file.read(offset, 1, (view, offset) => view.getUint8(offset));
  }
  async readI8(offset?: number): Promise<number> {
    return this.file.read(offset, 1, (view, offset) => view.getInt8(offset));
  }

  async readU16LE(offset?: number): Promise<number> {
    return this.file.read(offset, 2, (view, offset) =>
      view.getUint16(offset, true),
    );
  }
  async readU16BE(offset?: number): Promise<number> {
    return this.file.read(offset, 2, (view, offset) =>
      view.getUint16(offset, false),
    );
  }
  async readI16LE(offset?: number): Promise<number> {
    return this.file.read(offset, 2, (view, offset) =>
      view.getInt16(offset, true),
    );
  }
  async readI16BE(offset?: number): Promise<number> {
    return this.file.read(offset, 2, (view, offset) =>
      view.getInt16(offset, false),
    );
  }

  async readU32LE(offset?: number): Promise<number> {
    return this.file.read(offset, 4, (view, offset) =>
      view.getUint32(offset, true),
    );
  }
  async readU32BE(offset?: number): Promise<number> {
    return this.file.read(offset, 4, (view, offset) =>
      view.getUint32(offset, false),
    );
  }
  async readI32LE(offset?: number): Promise<number> {
    return this.file.read(offset, 4, (view, offset) =>
      view.getInt32(offset, true),
    );
  }
  async readI32BE(offset?: number): Promise<number> {
    return this.file.read(offset, 4, (view, offset) =>
      view.getInt32(offset, false),
    );
  }

  async readU64LE(offset?: number): Promise<bigint> {
    return this.file.read(offset, 8, (view, offset) =>
      view.getBigUint64(offset, true),
    );
  }
  async readU64BE(offset?: number): Promise<bigint> {
    return this.file.read(offset, 8, (view, offset) =>
      view.getBigUint64(offset, false),
    );
  }
  async readI64LE(offset?: number): Promise<bigint> {
    return this.file.read(offset, 8, (view, offset) =>
      view.getBigInt64(offset, true),
    );
  }
  async readI64BE(offset?: number): Promise<bigint> {
    return this.file.read(offset, 8, (view, offset) =>
      view.getBigInt64(offset, false),
    );
  }

  async readF32LE(offset?: number): Promise<number> {
    return this.file.read(offset, 4, (view, offset) =>
      view.getFloat32(offset, true),
    );
  }
  async readF32BE(offset?: number): Promise<number> {
    return this.file.read(offset, 4, (view, offset) =>
      view.getFloat32(offset, false),
    );
  }
  async readF64LE(offset?: number): Promise<number> {
    return this.file.read(offset, 8, (view, offset) =>
      view.getFloat64(offset, true),
    );
  }
  async readF64BE(offset?: number): Promise<number> {
    return this.file.read(offset, 8, (view, offset) =>
      view.getFloat64(offset, false),
    );
  }

  async readBuffer(length: number, offset?: number): Promise<Uint8Array> {
    return this.file.read(offset, length, (view, offset) => {
      return new Uint8Array(view.buffer, offset, length);
    });
  }
}
