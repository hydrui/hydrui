import {
  formatDuration,
  formatFileSize,
  formatTimestamp,
  formatTimestampFull,
} from "./format";

describe("formatFileSize", () => {
  test("handles undefined or zero bytes", () => {
    expect(formatFileSize(undefined)).toBe("0 B");
    expect(formatFileSize(0)).toBe("0 B");
  });

  test("formats bytes correctly", () => {
    expect(formatFileSize(500)).toBe("500.0 B");
    expect(formatFileSize(1023)).toBe("1023.0 B");
  });

  test("formats kilobytes correctly", () => {
    expect(formatFileSize(1024)).toBe("1.0 KB");
    expect(formatFileSize(1536)).toBe("1.5 KB");
    expect(formatFileSize(10240)).toBe("10.0 KB");
  });

  test("formats megabytes correctly", () => {
    expect(formatFileSize(1024 * 1024)).toBe("1.0 MB");
    expect(formatFileSize(1.5 * 1024 * 1024)).toBe("1.5 MB");
    expect(formatFileSize(10 * 1024 * 1024)).toBe("10.0 MB");
  });

  test("formats gigabytes correctly", () => {
    expect(formatFileSize(1024 * 1024 * 1024)).toBe("1.0 GB");
    expect(formatFileSize(1.5 * 1024 * 1024 * 1024)).toBe("1.5 GB");
    expect(formatFileSize(10 * 1024 * 1024 * 1024)).toBe("10.0 GB");
  });

  test("handles very large numbers", () => {
    // Should still show as GB even if larger
    expect(formatFileSize(1024 * 1024 * 1024 * 1024)).toBe("1024.0 GB");
  });
});

describe("formatDuration", () => {
  test("handles negative durations", () => {
    expect(formatDuration(-60)).toBe("0:00");
    expect(formatDuration(-3600)).toBe("0:00");
    expect(formatDuration(-1)).toBe("0:00");
  });

  test("formats seconds only", () => {
    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(7)).toBe("0:07");
    expect(formatDuration(45)).toBe("0:45");
  });

  test("formats minutes and seconds", () => {
    expect(formatDuration(60)).toBe("1:00");
    expect(formatDuration(90)).toBe("1:30");
    expect(formatDuration(750)).toBe("12:30");
  });

  test("formats hours, minutes, and seconds", () => {
    expect(formatDuration(3600)).toBe("1:00:00");
    expect(formatDuration(3661)).toBe("1:01:01");
    expect(formatDuration(7323)).toBe("2:02:03");
  });

  test("handles large durations", () => {
    expect(formatDuration(360000)).toBe("100:00:00");
  });

  test("handles decimal inputs", () => {
    expect(formatDuration(60.6)).toBe("1:00");
    expect(formatDuration(90.9)).toBe("1:30");
  });

  test("pads numbers correctly", () => {
    expect(formatDuration(61)).toBe("1:01");
    expect(formatDuration(3601)).toBe("1:00:01");
    expect(formatDuration(3661)).toBe("1:01:01");
  });
});

describe("formatTimestamp", () => {
  test("formats Unix timestamps in seconds including epoch 0 and pre-1970", () => {
    expect(formatTimestamp(1760758570)).toContain("2025");
    expect(formatTimestamp(-86400)).toContain("1969");
    expect(formatTimestamp(0).length).toBeGreaterThan(0);
  });

  test("returns empty string for non-finite or out-of-range timestamps", () => {
    expect(formatTimestamp(NaN)).toBe("");
    expect(formatTimestamp(Infinity)).toBe("");
    expect(formatTimestamp(-Infinity)).toBe("");
    expect(formatTimestamp(1e20)).toBe("");
    expect(formatTimestamp(-1e20)).toBe("");
  });
});

describe("formatTimestampFull", () => {
  test("formats Unix timestamps in seconds with fuller output than compact format", () => {
    const compact = formatTimestamp(1760758570);
    const full = formatTimestampFull(1760758570);
    expect(full).toContain("2025");
    expect(full).not.toBe(compact);
    expect(formatTimestampFull(-86400)).toContain("1969");
    expect(formatTimestampFull(0).length).toBeGreaterThan(0);
  });

  test("returns empty string for non-finite or out-of-range timestamps", () => {
    expect(formatTimestampFull(NaN)).toBe("");
    expect(formatTimestampFull(Infinity)).toBe("");
    expect(formatTimestampFull(-Infinity)).toBe("");
    expect(formatTimestampFull(1e20)).toBe("");
    expect(formatTimestampFull(-1e20)).toBe("");
  });
});
