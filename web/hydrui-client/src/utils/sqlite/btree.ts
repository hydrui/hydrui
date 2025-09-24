import { BTreeHeaderOffset, PageType } from "./constants";
import { SQLiteDataView } from "./dataview";
import { BTreeCell, BTreeHeader } from "./structure";

/**
 * Parse a B-tree page header
 * @param dataView The data view to read from
 * @returns The parsed B-tree header
 */
export function parseBTreeHeader(dataView: SQLiteDataView): BTreeHeader {
  const headerOffset = dataView.getPageNumber() === 1 ? 100 : 0;
  const pageType = dataView.readUint8(
    BTreeHeaderOffset.PAGE_TYPE + headerOffset,
  );
  const firstFreeblock = dataView.readUint16(
    BTreeHeaderOffset.FIRST_FREEBLOCK + headerOffset,
  );
  const cellCount = dataView.readUint16(
    BTreeHeaderOffset.CELL_COUNT + headerOffset,
  );
  const cellContentArea = dataView.readUint16(
    BTreeHeaderOffset.CELL_CONTENT_AREA + headerOffset,
  );
  const fragmentedFreeBytes = dataView.readUint8(
    BTreeHeaderOffset.FRAGMENTED_FREE_BYTES + headerOffset,
  );

  // Reset position to beginning
  dataView.setOffset(headerOffset);

  const header: BTreeHeader = {
    pageType,
    firstFreeblock,
    cellCount,
    cellContentArea,
    fragmentedFreeBytes,
  };

  // For interior pages, read right-most pointer
  if (
    pageType === PageType.TABLE_INTERIOR ||
    pageType === PageType.INDEX_INTERIOR
  ) {
    // Move past the header fields
    dataView.setOffset(8 + headerOffset);
    header.rightMostPointer = dataView.readUint32();
  }

  return header;
}

/**
 * Get cell offset within a page
 * @param dataView The data view to read from
 * @param cellIndex The index of the cell
 * @returns The offset of the cell within the page
 */
export function getCellOffset(
  dataView: SQLiteDataView,
  cellIndex: number,
): number {
  // Skip the page header - 8 bytes for leaf or 12 bytes for interior pages
  const headerOffset = dataView.getPageNumber() === 1 ? 100 : 0;
  const pageType = dataView.readUint8(0 + headerOffset);
  const headerSize =
    pageType === PageType.TABLE_LEAF || pageType === PageType.INDEX_LEAF
      ? 8
      : 12;

  // Cell pointer array starts right after the header
  const cellPointerOffset = headerSize + cellIndex * 2;

  // Read the pointer to get the offset
  return dataView.readUint16(cellPointerOffset + headerOffset);
}

/**
 * Parse a leaf table cell from a B-tree page
 * @param dataView The data view to read from
 * @param cellOffset The offset of the cell within the page
 * @returns The parsed cell
 */
export function parseTableLeafCell(
  dataView: SQLiteDataView,
  cellOffset: number,
): BTreeCell {
  dataView.setOffset(cellOffset);

  const payloadSize = dataView.readVarint();
  const rowId = dataView.readVarint();
  const headerSize = dataView.getOffset() - cellOffset;
  const localPayloadSize = Math.min(
    payloadSize,
    dataView.getSize() - cellOffset - headerSize,
  );
  const payload = dataView.readBuffer(localPayloadSize);

  const cell: BTreeCell = {
    header: {
      payloadSize,
      rowId,
    },
    payload,
  };

  // Check if there's an overflow page
  if (localPayloadSize < payloadSize) {
    cell.overflowPage = dataView.readUint32();
  }

  return cell;
}

/**
 * Parse a interior table cell from a B-tree page
 * @param dataView The data view to read from
 * @param cellOffset The offset of the cell within the page
 * @returns The parsed cell
 */
export function parseTableInteriorCell(
  dataView: SQLiteDataView,
  cellOffset: number,
): BTreeCell {
  dataView.setOffset(cellOffset);

  const leftChildPage = dataView.readUint32();
  const rowId = dataView.readVarint();

  return {
    header: {
      payloadSize: 0, // Interior cells don't have a payload
      leftChildPage,
      rowId,
    },
    payload: new Uint8Array(0), // Empty payload
  };
}

/**
 * Read cells from a B-tree page
 * @param dataView The data view to read from
 * @returns Array of cells from the page
 */
export function readBTreeCells(dataView: SQLiteDataView): BTreeCell[] {
  const header = parseBTreeHeader(dataView);
  const cells: BTreeCell[] = [];

  for (let i = 0; i < header.cellCount; i++) {
    const cellOffset = getCellOffset(dataView, i);

    if (header.pageType === PageType.TABLE_LEAF) {
      cells.push(parseTableLeafCell(dataView, cellOffset));
    } else if (header.pageType === PageType.TABLE_INTERIOR) {
      cells.push(parseTableInteriorCell(dataView, cellOffset));
    }
  }

  return cells;
}

/**
 * Read payload from a cell, potentially spanning multiple overflow pages
 * @param mainDataView The main database data view
 * @param cell The cell to read the payload from
 * @param pageSize The database page size
 * @returns The complete payload
 */
export function readCellPayload(
  mainDataView: SQLiteDataView,
  cell: BTreeCell,
  pageSize: number,
): Uint8Array {
  if (!cell.overflowPage) {
    return cell.payload;
  }

  const localSize = cell.payload.length;
  const totalSize = cell.header.payloadSize;

  const fullPayload = new Uint8Array(totalSize);
  fullPayload.set(cell.payload, 0);

  if (cell.overflowPage <= 0) {
    throw new Error(`Invalid overflow page: ${cell.overflowPage}`);
  }

  let currentOverflowPage = cell.overflowPage;
  let offset = localSize;

  while (currentOverflowPage !== 0 && offset < totalSize) {
    const pageView = mainDataView.getPageView(currentOverflowPage, pageSize);
    pageView.setOffset(mainDataView.getPageNumber() === 1 ? 100 : 0);
    const nextOverflowPage = pageView.readUint32();

    const availableBytes = pageSize - pageView.getOffset();
    const bytesNeeded = totalSize - offset;
    const bytesToRead = Math.min(bytesNeeded, availableBytes);

    if (bytesToRead > 0) {
      const overflowData = pageView.readBuffer(bytesToRead);
      fullPayload.set(overflowData, offset);
      offset += bytesToRead;
    }

    currentOverflowPage = nextOverflowPage;
  }

  return fullPayload;
}
