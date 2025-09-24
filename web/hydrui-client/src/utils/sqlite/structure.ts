import { PageType, TextEncoding } from "./constants";

/**
 * SQLite database header
 */
export interface SQLiteHeader {
  // Magic header string - should be "SQLite format 3\0"
  magicString: string;
  // Page size in bytes
  pageSize: number;
  // File format write version
  fileFormatWriteVersion: number;
  // File format read version
  fileFormatReadVersion: number;
  // Bytes of unused "reserved" space at the end of each page
  reservedBytes: number;
  // Maximum embedded payload fraction (should be 64)
  maxEmbedPayloadFraction: number;
  // Minimum embedded payload fraction (should be 32)
  minEmbedPayloadFraction: number;
  // Leaf payload fraction (should be 32)
  leafPayloadFraction: number;
  // File change counter
  fileChangeCounter: number;
  // Size of the database in pages
  databaseSizeInPages: number;
  // First freelist trunk page
  firstFreelistTrunkPage: number;
  // Total number of freelist pages
  freelistPages: number;
  // Schema cookie
  schemaCookie: number;
  // Schema format number
  schemaFormatNumber: number;
  // Default page cache size
  defaultPageCacheSize: number;
  // Largest root b-tree page number
  largestRootBTreePage: number;
  // Database text encoding
  databaseTextEncoding: TextEncoding;
  // User version
  userVersion: number;
  // Incremental vacuum mode flag
  incrementalVacuum: boolean;
  // Application ID
  applicationId: number;
  // Version valid for number
  versionValidForNumber: number;
  // SQLite version number
  sqliteVersionNumber: number;
}

/**
 * B-tree page header
 */
export interface BTreeHeader {
  // Page type
  pageType: PageType;
  // Offset to the first freeblock
  firstFreeblock: number;
  // Number of cells on the page
  cellCount: number;
  // Offset to the cell content area
  cellContentArea: number;
  // Number of fragmented free bytes
  fragmentedFreeBytes: number;
  // Right-most pointer (interior pages only)
  rightMostPointer?: number;
}

/**
 * Cell in a B-tree page
 */
export interface BTreeCell {
  // Cell header
  header: {
    // Payload size in bytes
    payloadSize: number;
    // Row ID (for table leaf cells only)
    rowId?: number;
    // Left child page number (for interior cells only)
    leftChildPage?: number;
  };
  // Cell content
  payload: Uint8Array;
  // Overflow page number (if payload doesn't fit in the page)
  overflowPage?: number;
}

/**
 * SQLite record header
 */
export interface RecordHeader {
  // Record header size in bytes
  headerSize: number;
  // Serial type for each column
  serialTypes: number[];
}

/**
 * Column value in a record
 */
export interface ColumnValue {
  type: "NULL" | "INTEGER" | "FLOAT" | "BLOB" | "TEXT";
  value: null | number | bigint | string | Uint8Array;
}

/**
 * Table row
 */
export interface TableRow {
  rowId: number;
  values: ColumnValue[];
}

/**
 * SQLite table representation
 */
export interface Table {
  // Table name
  name: string;
  // Root page number
  rootPage: number;
  // Rows in the table
  rows: TableRow[];
}

/**
 * SQLite database representation
 */
export interface SQLiteDatabase {
  // Database header
  header: SQLiteHeader | null;
  // Tables in the database
  tables: Map<string, Table>;
  // Raw pages data
  pages: Map<number, Uint8Array>;
}
