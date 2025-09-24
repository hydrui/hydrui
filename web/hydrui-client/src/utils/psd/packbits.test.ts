import { decompressRLE, decompressRLERows } from "./packbits";

describe("PackBits/RLE decompression", () => {
  test("decompressRLE handles basic test case correctly", () => {
    const input = new Uint8Array([
      0xfe, 0xaa, 0x02, 0x80, 0x00, 0x2a, 0xfd, 0xaa, 0x80, 0x03, 0x80, 0x00,
      0x2a, 0x22, 0xf7, 0xaa,
    ]);

    const expected = new Uint8Array([
      0xaa, 0xaa, 0xaa, 0x80, 0x00, 0x2a, 0xaa, 0xaa, 0xaa, 0xaa, 0x80, 0x00,
      0x2a, 0x22, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa,
    ]);

    // Decompress and verify
    const result = decompressRLE(input, expected.length);
    expect(result).toEqual(expected);
  });

  test("decompressRLERows handles multiple rows correctly", () => {
    // Simple test with two rows
    const input = new Uint8Array([
      0xfe,
      0xaa, // Row 1: Repeat 0xAA 3 times
      0xfd,
      0xbb, // Row 2: Repeat 0xBB 4 times
    ]);

    const rowLengths = [2, 2]; // Each row is 2 bytes of compressed data
    const rowWidth = 3; // First row is 3 bytes wide

    const expected = new Uint8Array([
      0xaa,
      0xaa,
      0xaa, // Row 1: 3 bytes of 0xAA
      0xbb,
      0xbb,
      0xbb,
      0xbb, // Row 2: But we only use first 3 due to rowWidth
    ]);

    // The decompressed result will truncate the last row to fit the rowWidth
    const result = decompressRLERows(input, rowLengths, rowWidth);
    expect(result.slice(0, 6)).toEqual(expected.slice(0, 6));
    expect(result.length).toBe(rowWidth * rowLengths.length);
  });
});
