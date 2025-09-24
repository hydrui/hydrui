import { parseBTreeHeader, readBTreeCells, readCellPayload } from "./btree";
import { PageType } from "./constants";
import { SQLiteDataView } from "./dataview";
import { parseRecord } from "./record";
import { Table, TableRow } from "./structure";

/**
 * Scan a B-tree page for rows
 * @param dataView The data view of the entire database
 * @param pageNumber The page number to scan
 * @param pageSize The database page size
 * @returns Array of table rows found in the page
 */
export function scanTablePage(
  dataView: SQLiteDataView,
  pageNumber: number,
  pageSize: number,
): TableRow[] {
  const pageView = dataView.getPageView(pageNumber, pageSize);
  const header = parseBTreeHeader(pageView);

  switch (header.pageType) {
    case PageType.INDEX_INTERIOR:
    case PageType.INDEX_LEAF:
      return [];
    case PageType.TABLE_INTERIOR:
      return scanInteriorTablePage(dataView, pageView, pageSize);
    case PageType.TABLE_LEAF:
      return scanLeafTablePage(dataView, pageView, pageSize);
    default:
      throw new Error(`Unknown page type: ${header.pageType}`);
  }
}

/**
 * Scan an interior table page (recursively visits all child pages)
 * @param dataView The data view of the entire database
 * @param pageView The data view for this specific page
 * @param pageSize The database page size
 * @returns Array of table rows found in the page and its children
 */
function scanInteriorTablePage(
  dataView: SQLiteDataView,
  pageView: SQLiteDataView,
  pageSize: number,
): TableRow[] {
  const header = parseBTreeHeader(pageView);
  const cells = readBTreeCells(pageView);
  const rows: TableRow[] = [];

  for (const cell of cells) {
    if (cell.header.leftChildPage) {
      const childRows = scanTablePage(
        dataView,
        cell.header.leftChildPage,
        pageSize,
      );
      rows.push(...childRows);
    }
  }

  if (header.rightMostPointer) {
    const rightChildRows = scanTablePage(
      dataView,
      header.rightMostPointer,
      pageSize,
    );
    rows.push(...rightChildRows);
  }

  return rows;
}

/**
 * Scan a leaf table page to extract rows
 * @param dataView The data view of the entire database
 * @param pageView The data view for this specific page
 * @param pageSize The database page size
 * @returns Array of table rows found in the page
 */
function scanLeafTablePage(
  dataView: SQLiteDataView,
  pageView: SQLiteDataView,
  pageSize: number,
): TableRow[] {
  const cells = readBTreeCells(pageView);
  const rows: TableRow[] = [];

  for (const cell of cells) {
    if (cell.header.rowId === undefined) continue;

    const fullPayload = readCellPayload(dataView, cell, pageSize);
    const payloadView = new SQLiteDataView(
      new DataView(
        fullPayload.buffer,
        fullPayload.byteOffset,
        fullPayload.byteLength,
      ),
    );
    const values = parseRecord(payloadView);

    rows.push({
      rowId: cell.header.rowId,
      values,
    });
  }

  return rows;
}

/**
 * Read a table from the database
 * @param dataView The data view of the entire database
 * @param rootPage The root page number of the table
 * @param pageSize The database page size
 * @param name The table name
 * @returns Table object with rows
 */
export function readTable(
  dataView: SQLiteDataView,
  rootPage: number,
  pageSize: number,
  name: string,
): Table {
  const rows = scanTablePage(dataView, rootPage, pageSize);

  return {
    name,
    rootPage,
    rows,
  };
}

/**
 * Find the schema table in a SQLite database
 * The schema table is always stored in the table on page 1 (after the header)
 * @param dataView The data view of the entire database
 * @param pageSize The database page size
 * @returns Map of table names to their root page numbers
 */
export function findSchemaTables(
  dataView: SQLiteDataView,
  pageSize: number,
): Map<string, number> {
  // The schema is stored in the sqlite_master table on page 1
  const schemaRows = scanTablePage(dataView, 1, pageSize);
  const tables = new Map<string, number>();

  for (const row of schemaRows) {
    // Schema table format:
    // 0: type (table, index, view, trigger)
    // 1: name (table name)
    // 2: tbl_name (table name this refers to)
    // 3: rootpage (page number for the root of this object)
    // 4: sql (SQL statement that created the object)

    if (row.values.length < 5) continue;

    const type = row.values[0].value;
    const name = row.values[1].value;
    const rootpage = row.values[3].value;

    if (
      type === "table" &&
      typeof name === "string" &&
      typeof rootpage === "number"
    ) {
      tables.set(name, rootpage);
    }
  }

  return tables;
}
