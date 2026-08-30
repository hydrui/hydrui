export interface SelectionOverflow {
  above: number;
  below: number;
}

export interface SelectionIndex {
  readonly length: number;
  at(position: number): number;
}

interface SelectionGeometry {
  selectionIndex: SelectionIndex;
  columns: number;
  itemSize: number;
  gapSize: number;
}

interface SelectionViewport extends SelectionGeometry {
  scrollTop: number;
  viewportHeight: number;
}

const EMPTY_SELECTION_INDEX: SelectionIndex = {
  length: 0,
  at: () => -1,
};

const fromSortedIndices = (indices: readonly number[]): SelectionIndex => ({
  length: indices.length,
  at: (position) => indices[position]!,
});

export function createSelectionIndex(
  selectedFileIds: readonly number[],
  fileIdToIndex: ReadonlyMap<number, number>,
  knownToBeInPageOrder = false,
): SelectionIndex {
  if (selectedFileIds.length === 0) return EMPTY_SELECTION_INDEX;

  if (knownToBeInPageOrder) {
    return {
      length: selectedFileIds.length,
      at: (position) => fileIdToIndex.get(selectedFileIds[position]!)!,
    };
  }

  let mappedLength = 0;
  let previousIndex = -1;
  let isOrdered = true;
  let everyFileIsMapped = true;

  for (const fileId of selectedFileIds) {
    const index = fileIdToIndex.get(fileId);
    if (index === undefined) {
      everyFileIsMapped = false;
      continue;
    }
    if (index < previousIndex) isOrdered = false;
    previousIndex = index;
    mappedLength += 1;
  }

  if (mappedLength === 0) return EMPTY_SELECTION_INDEX;

  if (everyFileIsMapped && isOrdered) {
    return {
      length: selectedFileIds.length,
      at: (position) => fileIdToIndex.get(selectedFileIds[position]!)!,
    };
  }

  const indices = new Array<number>(mappedLength);
  let position = 0;
  for (const fileId of selectedFileIds) {
    const index = fileIdToIndex.get(fileId);
    if (index !== undefined) {
      indices[position] = index;
      position += 1;
    }
  }
  if (!isOrdered) indices.sort((a, b) => a - b);

  return fromSortedIndices(indices);
}

const lowerBound = (selectionIndex: SelectionIndex, target: number) => {
  let low = 0;
  let high = selectionIndex.length;
  while (low < high) {
    const middle = low + Math.floor((high - low) / 2);
    if (selectionIndex.at(middle) < target) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }
  return low;
};

export function selectionIncludesIndex(
  selectionIndex: SelectionIndex,
  index: number,
): boolean {
  const position = lowerBound(selectionIndex, index);
  return (
    position < selectionIndex.length && selectionIndex.at(position) === index
  );
}

const getItemBounds = (
  index: number,
  columns: number,
  itemSize: number,
  gapSize: number,
) => {
  const row = Math.floor(index / Math.max(1, columns));
  const top = gapSize + row * (itemSize + gapSize);
  return { top, bottom: top + itemSize };
};

export function getSelectionOverflow({
  selectionIndex,
  columns,
  itemSize,
  gapSize,
  scrollTop,
  viewportHeight,
}: SelectionViewport): SelectionOverflow {
  const safeColumns = Math.max(1, columns);
  const rowSize = itemSize + gapSize;
  const viewportBottom = scrollTop + viewportHeight;

  const firstRowNotAbove =
    Math.floor((scrollTop - gapSize - itemSize) / rowSize) + 1;
  const firstRowBelow = Math.ceil((viewportBottom - gapSize) / rowSize);
  const above = lowerBound(
    selectionIndex,
    Math.max(0, firstRowNotAbove) * safeColumns,
  );
  const firstBelow = lowerBound(
    selectionIndex,
    Math.max(0, firstRowBelow) * safeColumns,
  );

  return { above, below: selectionIndex.length - firstBelow };
}

export function getSelectionScrollTarget(
  edge: "top" | "bottom",
  geometry: SelectionGeometry,
  viewportHeight: number,
): number | null {
  if (geometry.selectionIndex.length === 0) return null;

  const index = geometry.selectionIndex.at(
    edge === "top" ? 0 : geometry.selectionIndex.length - 1,
  );
  const bounds = getItemBounds(
    index,
    geometry.columns,
    geometry.itemSize,
    geometry.gapSize,
  );

  return Math.max(
    0,
    edge === "top"
      ? bounds.top - geometry.gapSize
      : bounds.bottom + geometry.gapSize - viewportHeight,
  );
}

export function getViewerExitSelection(
  currentSelection: readonly number[],
  lastViewedFileId: number | null,
): number[] | null {
  return currentSelection.length === 1 && lastViewedFileId !== null
    ? [lastViewedFileId]
    : null;
}
