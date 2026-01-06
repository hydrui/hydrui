import { FileMetadata } from "@/api/types";
import { ContentUpdateAction } from "@/constants/contentUpdates";
import { client } from "@/store/apiStore";

import { TypeMismatchError } from "./errors";
import {
  BaseListValue,
  BaseValue,
  BooleanValue,
  NullValue,
  NumberValue,
  StringListValue,
  StringValue,
  Value,
} from "./value";

enum FileAttributes {
  ID = "id",
  Hash = "hash",
  Size = "size",
  Width = "width",
  Height = "height",
  Duration = "duration",
  URLs = "urls",
  Tags = "tags",
  NumericRating = "numericRating",
  HasLike = "hasLike",
  HasDislike = "hasDislike",
}

export class FileListValue extends BaseListValue<FileMetadata> {
  override itemValue(v: FileMetadata): Value {
    return new FileValue(v);
  }
}

class TagsList extends StringListValue {
  override name = "TagsList";

  constructor(file: FileMetadata) {
    const tags = Object.values(file.tags || {});
    super(
      Array.from(
        new Set(
          tags.map((s) => s.display_tags[ContentUpdateAction.ADD] ?? []).flat(),
        ),
      ),
    );
  }
}

export class FileValue extends BaseValue<FileMetadata> {
  name = "File";

  static placeholder(): FileValue {
    return new FileValue({
      file_id: 0,
      hash: "",
      size: 0,
      mime: "",
      filetype_enum: 0,
      width: 0,
      height: 0,
      duration: 0,
      num_frames: 0,
      has_audio: false,
      thumbnail_width: 0,
      thumbnail_height: 0,
      is_inbox: false,
      is_local: false,
      is_trashed: false,
      is_deleted: false,
      time_modified: 0,
      known_urls: [""],
      tags: {
        "": {
          storage_tags: { [ContentUpdateAction.ADD]: [""] },
          display_tags: { [ContentUpdateAction.ADD]: [""] },
        },
      },
      ratings: { "": 1 },
      notes: { "": "" },
    });
  }

  static from(n: Value): FileValue {
    if (n instanceof FileValue) {
      return n;
    } else {
      throw new TypeMismatchError(this.name, n.name);
    }
  }

  override equal(rhs: Value): Value {
    return new BooleanValue(this.value.hash === FileValue.from(rhs).value.hash);
  }
  override notEqual(rhs: Value): Value {
    return new BooleanValue(this.value.hash !== FileValue.from(rhs).value.hash);
  }
  override dot(ident: string): Value {
    switch (ident as FileAttributes) {
      case FileAttributes.ID:
        return new NumberValue(this.value.file_id);
      case FileAttributes.Hash:
        return new StringValue(this.value.hash);
      case FileAttributes.Size:
        return new NumberValue(this.value.size ?? 0);
      case FileAttributes.Width:
        return new NumberValue(this.value.width ?? 0);
      case FileAttributes.Height:
        return new NumberValue(this.value.height ?? 0);
      case FileAttributes.Duration:
        return new NumberValue((this.value.duration ?? 0) / 1000);
      case FileAttributes.URLs:
        return new StringListValue(this.value.known_urls ?? []);
      case FileAttributes.Tags:
        return new TagsList(this.value);
      case FileAttributes.NumericRating:
        for (const rating of Object.values(this.value.ratings ?? {})) {
          if (typeof rating === "number") {
            return new NumberValue(rating);
          }
        }
        return new NullValue(null);
      case FileAttributes.HasLike:
        for (const rating of Object.values(this.value.ratings ?? {})) {
          if (rating === true) {
            return new BooleanValue(true);
          }
        }
        return new BooleanValue(false);
      case FileAttributes.HasDislike:
        for (const rating of Object.values(this.value.ratings ?? {})) {
          if (rating === false) {
            return new BooleanValue(true);
          }
        }
        return new BooleanValue(false);
    }
    return super.dot(ident);
  }
  override dotSuggest(): string[] {
    return [
      ...super.dotSuggest(),
      FileAttributes.ID,
      FileAttributes.Hash,
      FileAttributes.Size,
      FileAttributes.Width,
      FileAttributes.Height,
      FileAttributes.Duration,
      FileAttributes.URLs,
      FileAttributes.Tags,
      FileAttributes.NumericRating,
      FileAttributes.HasLike,
      FileAttributes.HasDislike,
    ];
  }
}

export class FileTypeValue extends BaseValue<void> {
  name = "File";
  override async call(args: Value[]): Promise<Value> {
    if (!args[0]) {
      throw new Error("Missing argument in Number() call");
    }
    if (args[0] instanceof NumberValue) {
      const response = await client.getFileMetadata([args[0].value]);
      if (!response.metadata[0]) {
        throw new Error(`File ID ${args[0].value} not found`);
      }
      return new FileValue(response.metadata[0]);
    } else if (args[0] instanceof StringValue) {
      const response = await client.getFileMetadataByHashes([args[0].value]);
      if (!response.metadata[0]) {
        throw new Error(`File hash ${args[0].value} not found`);
      }
      return new FileValue(response.metadata[0]);
    } else {
      throw new Error(
        `Unexpected argument type ${args[0].name} to File constructor`,
      );
    }
  }
}
