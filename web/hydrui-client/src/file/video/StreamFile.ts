import { RemoteFile } from "hydrui-util/src/stream";

// This is an implementation of the interface provided by StreamFile in the npm
// "stream-file" library used by ogv.js. It only supports asynchronous I/O, so
// the synchronous functions always returns as if no data is available.
export class StreamFile {
  private _abortController =
    typeof AbortController !== "undefined" ? new AbortController() : null;
  private _remoteFile: RemoteFile;
  private _abort = false;
  public loaded = false;
  public loading = false;
  public waiting = false;
  public readonly seekable = true;
  public buffering = false;
  public seeking = false;
  public progressive = true;
  public totalPrefetched = 0;
  public readonly headers = {};
  public onBufferChanged: ((buffered: number) => void) | undefined = undefined;

  constructor(
    public readonly url: string,
    public readonly length: number,
    readonly chunkSize: number = 1 * 1024 * 1024,
  ) {
    this._remoteFile = new RemoteFile(url, length, {
      chunkSize,
      signal: this._abortController?.signal,
    });
    Object.defineProperties(this, {
      offset: {
        get: () => {
          return this._remoteFile.position;
        },
      },
      eof: {
        get: () => {
          return this._remoteFile.position >= this._remoteFile.fileSize;
        },
      },
    });
  }

  load(): Promise<void> {
    if (this.loading) {
      throw new Error("cannot load when loading");
    }
    if (this.loaded) {
      throw new Error("cannot load when loaded");
    }
    this.loading = true;
    this._prefetchAll()
      .then(() => {
        this.loaded = true;
        this.loading = false;
      })
      .catch(() => {
        this.loaded = false;
        this.loading = false;
      });
    return Promise.resolve();
  }

  async _prefetchAll(): Promise<void> {
    for (let i = 0; i < this.length; i += this.chunkSize) {
      if (this._abort) {
        throw new Error("prefetch aborted");
      }
      const length = Math.min(this.chunkSize, this.length - i);
      await this._remoteFile.prefetch(i, length);
      if (i + length > this.totalPrefetched) {
        this.totalPrefetched = i + length;
      }
      this.onBufferChanged?.(this.getBuffered());
    }
  }

  abort() {
    this._abort = true;
    this._abortController?.abort();
  }

  async seek(offset: number): Promise<void> {
    this._remoteFile.seek(offset, "SEEK_SET");
  }

  async read(nbytes: number): Promise<ArrayBuffer> {
    const length = Math.min(nbytes, this.length - this._remoteFile.position);
    if (length === 0) {
      return Promise.resolve(new ArrayBuffer());
    }
    this.waiting = true;
    try {
      return await this._remoteFile.read(
        undefined,
        length,
        (dataview, offset_1) =>
          dataview.buffer.slice(offset_1, offset_1 + length),
      );
    } finally {
      this.waiting = false;
    }
  }

  getBuffered(): number {
    return this.totalPrefetched / this.length;
  }

  readSync() {
    return new ArrayBuffer();
  }

  readBytes() {
    return 0;
  }

  buffer(nbytes: number) {
    return this._remoteFile.prefetch(
      this._remoteFile.offsetForRead(undefined, nbytes),
      nbytes,
    );
  }

  bytesAvailable() {
    return 0;
  }

  getBufferedRanges() {
    return [];
  }
}
