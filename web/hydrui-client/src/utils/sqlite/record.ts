import { SQLiteDataType } from "./constants";
import { SQLiteDataView } from "./dataview";
import { ColumnValue, RecordHeader } from "./structure";

/**
 * Parse the record header to get the serial types for each column
 * @param dataView The data view to read from
 * @returns Record header with parsed information
 */
export function parseRecordHeader(dataView: SQLiteDataView): RecordHeader {
  const headerSize = dataView.readVarint();
  const startOffset = dataView.getOffset();
  const serialTypes: number[] = [];

  while (dataView.getOffset() - startOffset + 1 < headerSize) {
    serialTypes.push(dataView.readVarint());
  }

  return {
    headerSize,
    serialTypes,
  };
}

/**
 * Parse the record data using the header information
 * @param dataView The data view to read from
 * @param recordHeader The parsed record header
 * @returns Array of column values
 */
export function parseRecordData(
  dataView: SQLiteDataView,
  recordHeader: RecordHeader,
): ColumnValue[] {
  const values: ColumnValue[] = [];

  for (const serialType of recordHeader.serialTypes) {
    values.push(parseColumnValue(dataView, serialType));
  }

  return values;
}

/**
 * Parse a column value based on its serial type
 * @param dataView The data view to read from
 * @param serialType The serial type value
 * @returns The parsed column value
 */
export function parseColumnValue(
  dataView: SQLiteDataView,
  serialType: number,
): ColumnValue {
  // https://www.sqlite.org/fileformat.html#record_format
  switch (serialType) {
    case SQLiteDataType.NULL:
      return { type: "NULL", value: null };

    case SQLiteDataType.INTEGER_0:
      return { type: "INTEGER", value: 0 };

    case SQLiteDataType.INTEGER_1:
      return { type: "INTEGER", value: 1 };

    case SQLiteDataType.INTEGER_8BIT:
      return { type: "INTEGER", value: dataView.readInt8() };

    case SQLiteDataType.INTEGER_16BIT:
      return { type: "INTEGER", value: dataView.readInt16() };

    case SQLiteDataType.INTEGER_24BIT:
      return { type: "INTEGER", value: dataView.readInt24() };

    case SQLiteDataType.INTEGER_32BIT:
      return { type: "INTEGER", value: dataView.readInt32() };

    case SQLiteDataType.INTEGER_48BIT:
      return { type: "INTEGER", value: dataView.readUint48() };

    case SQLiteDataType.INTEGER_64BIT:
      return { type: "INTEGER", value: dataView.readUint64BigInt() };

    case SQLiteDataType.FLOAT_64BIT:
      return { type: "FLOAT", value: dataView.readFloat64() };

    default:
      // Handle variable-length types
      if (serialType >= 12 && serialType % 2 === 0) {
        const length = (serialType - 12) / 2;
        return {
          type: "BLOB",
          value: dataView.readBuffer(length),
        };
      }

      if (serialType >= 13 && serialType % 2 === 1) {
        const length = (serialType - 13) / 2;
        return {
          type: "TEXT",
          value: dataView.readString(length),
        };
      }

      // Unknown type - shouldn't happen in a valid SQLite file
      throw new Error(`Unknown SQLite serial type: ${serialType}`);
  }
}

/**
 * Parse a complete record from the data view
 * @param dataView The data view to read from
 * @returns An array of column values
 */
export function parseRecord(dataView: SQLiteDataView): ColumnValue[] {
  const recordHeader = parseRecordHeader(dataView);
  return parseRecordData(dataView, recordHeader);
}
