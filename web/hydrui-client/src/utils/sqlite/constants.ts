// Magic header string that identifies a SQLite database
export const SQLITE_HEADER_STRING = "SQLite format 3\0";

// Database page types
export const enum PageType {
  INDEX_INTERIOR = 2,
  TABLE_INTERIOR = 5,
  INDEX_LEAF = 10,
  TABLE_LEAF = 13,
}

// Record/field type constants
export const enum SQLiteDataType {
  // NULL value
  NULL = 0,
  // 8-bit signed integer
  INTEGER_8BIT = 1,
  // 16-bit signed integer
  INTEGER_16BIT = 2,
  // 24-bit signed integer
  INTEGER_24BIT = 3,
  // 32-bit signed integer
  INTEGER_32BIT = 4,
  // 48-bit signed integer
  INTEGER_48BIT = 5,
  // 64-bit signed integer
  INTEGER_64BIT = 6,
  // 64-bit IEEE floating point number
  FLOAT_64BIT = 7,
  // Integer constant 0
  INTEGER_0 = 8,
  // Integer constant 1
  INTEGER_1 = 9,
  // BLOB value
  BLOB = 12,
  // Text string value
  TEXT = 13,
}

// SQLite header offsets (in bytes)
export const enum HeaderOffset {
  // Magic header string
  MAGIC_STRING = 0,
  // Database page size in bytes
  PAGE_SIZE = 16,
  // File format write version
  FILE_FORMAT_WRITE = 18,
  // File format read version
  FILE_FORMAT_READ = 19,
  // Bytes of unused "reserved" space at the end of each page
  RESERVED_BYTES = 20,
  // Maximum embedded payload fraction (must be 64)
  MAX_EMBED_PAYLOAD = 21,
  // Minimum embedded payload fraction (must be 32)
  MIN_EMBED_PAYLOAD = 22,
  // Leaf payload fraction (must be 32)
  LEAF_PAYLOAD_FRAC = 23,
  // File change counter
  FILE_CHANGE_COUNTER = 24,
  // Size of the database in pages
  DATABASE_SIZE = 28,
  // Page number of the first freelist trunk page
  FIRST_FREELIST_PAGE = 32,
  // Total number of freelist pages
  FREELIST_PAGES = 36,
  // Schema cookie
  SCHEMA_COOKIE = 40,
  // Schema format number
  SCHEMA_FORMAT = 44,
  // Default page cache size
  DEFAULT_CACHE_SIZE = 48,
  // The page number of the largest root b-tree
  LARGEST_ROOT_BTREE = 52,
  // Database text encoding (1=UTF-8, 2=UTF-16le, 3=UTF-16be)
  TEXT_ENCODING = 56,
  // User version
  USER_VERSION = 60,
  // True (non-zero) for incremental-vacuum mode
  INCREMENTAL_VACUUM = 64,
  // Application ID
  APPLICATION_ID = 68,
  // The version-valid-for number
  VERSION_VALID_FOR = 92,
  // SQLITE_VERSION_NUMBER
  SQLITE_VERSION = 96,
}

// Schema encoding types
export const enum TextEncoding {
  UTF8 = 1,
  UTF16LE = 2,
  UTF16BE = 3,
}

// B-tree page header offsets
export const enum BTreeHeaderOffset {
  // Page type
  PAGE_TYPE = 0,
  // Offset to the first freeblock
  FIRST_FREEBLOCK = 1,
  // Number of cells on this page
  CELL_COUNT = 3,
  // Offset to the cell content area
  CELL_CONTENT_AREA = 5,
  // Number of fragmented free bytes
  FRAGMENTED_FREE_BYTES = 7,
}

// Journal mode
export const enum JournalMode {
  DELETE = 0,
  PERSIST = 1,
  OFF = 2,
  TRUNCATE = 3,
  MEMORY = 4,
  WAL = 5,
}
