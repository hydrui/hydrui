import {
  HeaderOffset as HO,
  SQLITE_HEADER_STRING,
  TextEncoding as TE,
} from "./constants";
import { SQLiteDataView } from "./dataview";
import { SQLiteDatabase, SQLiteHeader, Table } from "./structure";
import { findSchemaTables, readTable } from "./table";

/**
 * Parser for SQLite database files
 */
export class SQLiteParser {
  private dataView: SQLiteDataView;
  private database: SQLiteDatabase;

  /**
   * Create a new SQLite parser
   * @param data Uint8Array containing the SQLite database file
   */
  constructor(data: Uint8Array) {
    this.dataView = new SQLiteDataView(
      new DataView(data.buffer, data.byteOffset, data.byteLength),
    );

    this.database = {
      header: null,
      tables: new Map<string, Table>(),
      pages: new Map<number, Uint8Array>(),
    };
  }

  /**
   * Parse the SQLite database
   * @returns SQLite database object with parsed data
   */
  parse(): SQLiteDatabase {
    this.database.header = this.parseHeader();

    // Find all tables in the database schema
    const tables = findSchemaTables(
      this.dataView,
      this.database.header.pageSize,
    );

    // Process each table
    for (const [tableName, rootPage] of tables.entries()) {
      const table = readTable(
        this.dataView,
        rootPage,
        this.database.header.pageSize,
        tableName,
      );

      this.database.tables.set(tableName, table);
    }

    return this.database;
  }

  /**
   * Parse the SQLite database header
   */
  private parseHeader(): SQLiteHeader {
    const { dataView } = this;

    const magicString = dataView.readString(16, HO.MAGIC_STRING);
    if (magicString !== SQLITE_HEADER_STRING) {
      throw new Error("Invalid SQLite database file - wrong header signature");
    }

    // Parse page size - stored as big-endian 2-byte integer
    // "The database page size in bytes. Must be a power of two between 512 and
    // 32768 inclusive, or the value 1 representing a page size of 65536."
    let pageSize = dataView.readUint16(HO.PAGE_SIZE);
    if (pageSize === 1) {
      pageSize = 65536;
    }

    const fileFormatWriteVersion = dataView.readUint8(HO.FILE_FORMAT_WRITE);
    const fileFormatReadVersion = dataView.readUint8(HO.FILE_FORMAT_READ);
    const reservedBytes = dataView.readUint8(HO.RESERVED_BYTES);
    const maxEmbedPayloadFraction = dataView.readUint8(HO.MAX_EMBED_PAYLOAD);
    const minEmbedPayloadFraction = dataView.readUint8(HO.MIN_EMBED_PAYLOAD);
    const leafPayloadFraction = dataView.readUint8(HO.LEAF_PAYLOAD_FRAC);
    const fileChangeCounter = dataView.readUint32(HO.FILE_CHANGE_COUNTER);
    const databaseSizeInPages = dataView.readUint32(HO.DATABASE_SIZE);
    const firstFreelistTrunkPage = dataView.readUint32(HO.FIRST_FREELIST_PAGE);
    const freelistPages = dataView.readUint32(HO.FREELIST_PAGES);
    const schemaCookie = dataView.readUint32(HO.SCHEMA_COOKIE);
    const schemaFormatNumber = dataView.readUint32(HO.SCHEMA_FORMAT);
    const defaultPageCacheSize = dataView.readUint32(HO.DEFAULT_CACHE_SIZE);
    const largestRootBTreePage = dataView.readUint32(HO.LARGEST_ROOT_BTREE);
    const databaseTextEncoding = dataView.readUint32<TE>(HO.TEXT_ENCODING);
    const userVersion = dataView.readUint32(HO.USER_VERSION);
    const incrementalVacuum = dataView.readUint32(HO.INCREMENTAL_VACUUM) !== 0;
    const applicationId = dataView.readUint32(HO.APPLICATION_ID);
    const versionValidForNumber = dataView.readUint32(HO.VERSION_VALID_FOR);
    const sqliteVersionNumber = dataView.readUint32(HO.SQLITE_VERSION);

    return {
      magicString,
      pageSize,
      fileFormatWriteVersion,
      fileFormatReadVersion,
      reservedBytes,
      maxEmbedPayloadFraction,
      minEmbedPayloadFraction,
      leafPayloadFraction,
      fileChangeCounter,
      databaseSizeInPages,
      firstFreelistTrunkPage,
      freelistPages,
      schemaCookie,
      schemaFormatNumber,
      defaultPageCacheSize,
      largestRootBTreePage,
      databaseTextEncoding,
      userVersion,
      incrementalVacuum,
      applicationId,
      versionValidForNumber,
      sqliteVersionNumber,
    };
  }

  /**
   * Get a table by name
   * @param tableName Name of the table to get
   * @returns Table object or undefined if table doesn't exist
   */
  getTable(tableName: string): Table | undefined {
    return this.database.tables.get(tableName);
  }

  /**
   * Get all table names in the database
   * @returns Array of table names
   */
  getTableNames(): string[] {
    return Array.from(this.database.tables.keys());
  }

  /**
   * Get header information
   * @returns SQLite database header
   */
  getHeader(): SQLiteHeader | null {
    return this.database.header;
  }
}

/**
 * Utility function to parse an SQLite database from a Uint8Array
 * @param data SQLite database file as a Uint8Array
 * @returns The parsed SQLite database
 */
export function parseSQLite(data: Uint8Array): SQLiteDatabase {
  const parser = new SQLiteParser(data);
  return parser.parse();
}
