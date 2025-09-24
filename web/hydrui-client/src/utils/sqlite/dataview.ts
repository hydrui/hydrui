import { TextEncoding } from "./constants";

export class SQLiteDataView {
  private dataView: DataView;
  private textDecoder: TextDecoder;
  private offset: number;
  private pageNumber?: number;

  constructor(
    buffer: DataView,
    textEncoding: TextEncoding = TextEncoding.UTF8,
    pageNumber?: number,
  ) {
    this.dataView = buffer;
    this.offset = 0;
    this.pageNumber = pageNumber;

    // Choose the text decoder based on encoding
    switch (textEncoding) {
      case TextEncoding.UTF16LE:
        this.textDecoder = new TextDecoder("utf-16le");
        break;
      case TextEncoding.UTF16BE:
        this.textDecoder = new TextDecoder("utf-16be");
        break;
      case TextEncoding.UTF8:
      default:
        this.textDecoder = new TextDecoder("utf-8");
        break;
    }
  }

  getPageNumber(): number | undefined {
    return this.pageNumber;
  }

  /**
   * Get current offset
   */
  getOffset(): number {
    return this.offset;
  }

  /**
   * Set current offset
   */
  setOffset(offset: number): void {
    this.offset = offset;
  }

  /**
   * Skip forward by specified number of bytes
   */
  skip(bytes: number): void {
    this.offset += bytes;
  }

  /**
   * Get buffer size
   */
  getSize(): number {
    return this.dataView.byteLength;
  }

  /**
   * Read an unsigned 8-bit integer
   */
  readUint8(offset?: number): number {
    const value = this.dataView.getUint8(
      offset !== undefined ? offset : this.offset,
    );
    if (offset === undefined) this.offset += 1;
    return value;
  }

  /**
   * Read a signed 8-bit integer
   */
  readInt8(offset?: number): number {
    const value = this.dataView.getInt8(
      offset !== undefined ? offset : this.offset,
    );
    if (offset === undefined) this.offset += 1;
    return value;
  }

  /**
   * Read an unsigned 16-bit integer
   */
  readUint16(offset?: number): number {
    const value = this.dataView.getUint16(
      offset !== undefined ? offset : this.offset,
      false,
    );
    if (offset === undefined) this.offset += 2;
    return value;
  }

  /**
   * Read a signed 16-bit integer
   */
  readInt16(offset?: number): number {
    const value = this.dataView.getInt16(
      offset !== undefined ? offset : this.offset,
      false,
    );
    if (offset === undefined) this.offset += 2;
    return value;
  }

  /**
   * Read an unsigned 24-bit integer
   */
  readUint24(offset?: number): number {
    const actualOffset = offset !== undefined ? offset : this.offset;

    const value =
      (this.dataView.getUint8(actualOffset) << 16) |
      (this.dataView.getUint8(actualOffset + 1) << 8) |
      this.dataView.getUint8(actualOffset + 2);

    if (offset === undefined) this.offset += 3;
    return value;
  }

  /**
   * Read a signed 24-bit integer
   */
  readInt24(offset?: number): number {
    const actualOffset = offset !== undefined ? offset : this.offset;

    let value = this.readUint24(actualOffset);
    // Sign extend if the high bit is set
    if (value & 0x800000) {
      value |= 0xff000000;
    }

    if (offset === undefined) this.offset += 3;
    return value;
  }

  /**
   * Read an unsigned 32-bit integer
   */
  readUint32<T extends number = number>(offset?: number): T {
    const value = this.dataView.getUint32(
      offset !== undefined ? offset : this.offset,
      false,
    );
    if (offset === undefined) this.offset += 4;
    return value as T;
  }

  /**
   * Read a signed 32-bit integer
   */
  readInt32<T extends number = number>(offset?: number): T {
    const value = this.dataView.getInt32(
      offset !== undefined ? offset : this.offset,
      false,
    );
    if (offset === undefined) this.offset += 4;
    return value as T;
  }

  /**
   * Read an unsigned 48-bit integer (limited to safe integer range)
   */
  readUint48(offset?: number): number {
    const actualOffset = offset !== undefined ? offset : this.offset;

    const low = this.dataView.getUint32(actualOffset, false);
    const high = this.dataView.getUint16(actualOffset + 4, false);

    const value = high + low * 0x10000;

    if (offset === undefined) this.offset += 6;
    return value;
  }

  /**
   * Read an unsigned 64-bit integer as a BigInt
   */
  readUint64BigInt(offset?: number): bigint {
    const actualOffset = offset !== undefined ? offset : this.offset;

    const result = this.dataView.getBigUint64(actualOffset, false);

    if (offset === undefined) this.offset += 8;
    return result;
  }

  /**
   * Read a signed 64-bit integer as a BigInt
   */
  readInt64BigInt(offset?: number): bigint {
    const actualOffset = offset !== undefined ? offset : this.offset;

    const result = this.dataView.getBigInt64(actualOffset, false);

    if (offset === undefined) this.offset += 8;
    return result;
  }

  /**
   * Read a 64-bit IEEE floating point number
   */
  readFloat64(offset?: number): number {
    const value = this.dataView.getFloat64(
      offset !== undefined ? offset : this.offset,
      false,
    );
    if (offset === undefined) this.offset += 8;
    return value;
  }

  /**
   * Read a variable-length integer (1-9 bytes)
   * https://www.sqlite.org/fileformat.html#varint
   */
  readVarint(): number {
    let value = 0;
    let byte: number;

    for (let i = 0; i < 8; i++) {
      byte = this.readUint8();
      value = (value << 7) | (byte & 0x7f);

      if (byte < 0x80) return value;
    }

    byte = this.readUint8();
    value = (value << 8) | byte;

    return value;
  }

  /**
   * Read a string
   */
  readString(length: number, offset?: number): string {
    const actualOffset = offset !== undefined ? offset : this.offset;

    const bytes = new Uint8Array(
      this.dataView.buffer,
      this.dataView.byteOffset + actualOffset,
      length,
    );

    const result = this.textDecoder.decode(bytes);

    if (offset === undefined) this.offset += length;
    return result;
  }

  /**
   * Read a null-terminated string
   */
  readCString(offset?: number): string {
    const actualOffset = offset !== undefined ? offset : this.offset;
    let end = actualOffset;

    while (
      end < this.dataView.byteLength &&
      this.dataView.getUint8(end) !== 0
    ) {
      end++;
    }

    const length = end - actualOffset;
    const result = this.readString(length, actualOffset);

    if (offset === undefined) this.offset += length + 1;
    return result;
  }

  /**
   * Read a buffer of specified length
   */
  readBuffer(length: number, offset?: number): Uint8Array {
    const actualOffset = offset !== undefined ? offset : this.offset;

    const buffer = new Uint8Array(
      this.dataView.buffer,
      this.dataView.byteOffset + actualOffset,
      length,
    );

    if (offset === undefined) this.offset += length;
    return buffer;
  }

  /**
   * Create a new SQLiteDataView at a specific page
   */
  getPageView(pageNumber: number, pageSize: number): SQLiteDataView {
    const startOffset = (pageNumber - 1) * pageSize;
    return new SQLiteDataView(
      new DataView(
        this.dataView.buffer,
        this.dataView.byteOffset + startOffset,
        pageSize,
      ),
      TextEncoding.UTF8,
      pageNumber,
    );
  }
}
