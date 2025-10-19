import { DataStream, SubFile } from "hydrui-util/src/stream";

export class PSDDataStream extends DataStream {
  newCursor(atOffset?: number): PSDDataStream {
    const stream = new PSDDataStream(
      new SubFile(this.file, 0, this.file.fileSize),
    );
    stream.setOffset(atOffset ?? this.getOffset());
    return stream;
  }

  async readFixedPoint32(offset?: number): Promise<number> {
    const value = await this.readI32BE(offset);
    return value / 65536;
  }

  async readString(length: number, offset?: number): Promise<string> {
    let result = "";
    for (let i = 0; i < length; i++) {
      result += String.fromCharCode(
        await this.readU8(offset ? offset + i : undefined),
      );
    }
    return result;
  }

  async readPascalString(padTo: number = 2, offset?: number): Promise<string> {
    const length = await this.readU8(offset);
    const str = await this.readString(length, offset);

    const paddingBytes = (padTo - ((length + 1) % padTo)) % padTo;
    if (offset === undefined) {
      this.skip(paddingBytes);
    }

    return str;
  }

  async readUnicodeString(offset?: number): Promise<string> {
    const length = await this.readU32BE(offset);
    let result = "";
    for (let i = 0; i < length; i++) {
      const charCode = await this.readU16BE(
        offset ? offset + i * 2 : undefined,
      );
      result += String.fromCharCode(charCode);
    }
    return result;
  }
}
