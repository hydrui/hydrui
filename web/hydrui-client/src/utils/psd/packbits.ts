/**
 * Utilities for handling PackBits/RLE compression as used in PSD files
 */

/**
 * Decompress RLE (PackBits) data in rows, as used in PSD files
 * @param input Compressed data
 * @param rowLengths Array of compressed lengths for each row
 * @param rowWidth Width of each row in pixels
 * @returns Decompressed data
 */
export function decompressRLERows(
  input: Uint8Array,
  rowLengths: number[],
  rowWidth: number,
): Uint8Array {
  const height = rowLengths.length;
  const output = new Uint8Array(rowWidth * height);
  let inputOffset = 0;
  let outputOffset = 0;

  // Process each row
  for (let row = 0; row < height; row++) {
    const rowLength = rowLengths[row];
    const rowData = input.subarray(inputOffset, inputOffset + rowLength);

    // Decompress this row
    const decompressedRow = decompressRLE(rowData, rowWidth);

    // Copy to output
    output.set(decompressedRow, outputOffset);

    // Update offsets
    inputOffset += rowLength;
    outputOffset += rowWidth;
  }

  return output;
}

/**
 * Decompress RLE (PackBits) data for a single chunk
 * @param input Compressed data
 * @param outputLength Expected length of output data
 * @returns Decompressed data
 */
export function decompressRLE(
  input: Uint8Array,
  outputLength: number,
): Uint8Array {
  const output = new Uint8Array(outputLength);
  let inputIndex = 0;
  let outputIndex = 0;

  while (outputIndex < outputLength) {
    const header = input[inputIndex++];

    if (header === undefined) {
      // Some PSD files have the lengths all wrong.
      // Unfortunately, we can't really tell if the file is corrupt or not.
      return output;
    }

    if (header > 128) {
      // Repeat next byte (-header + 1) times
      const repeatCount = 257 - header;
      const value = input[inputIndex++];

      for (let i = 0; i < repeatCount; i++) {
        output[outputIndex++] = value;
      }
    } else if (header < 128) {
      // Copy the next (header + 1) bytes literally
      const copyCount = header + 1;

      for (let i = 0; i < copyCount; i++) {
        output[outputIndex++] = input[inputIndex++];
      }
    }
  }

  return output;
}
