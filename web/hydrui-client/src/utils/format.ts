/**
 * Format a file size in bytes to a human-readable string
 */
export const formatFileSize = (bytes?: number): string => {
  if (!bytes) return "0 B";

  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
};

/**
 * Format duration in seconds to MM:SS or HH:MM:SS
 * Negative durations will be treated as 0:00
 */
export const formatDuration = (seconds: number): string => {
  // Handle negative durations
  if (seconds < 0) {
    return "0:00";
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
};

const timestampFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

const timestampFullFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "full",
  timeStyle: "medium",
});

const formatUnixTimestamp = (
  timestamp: number,
  formatter: Intl.DateTimeFormat,
): string => {
  if (!Number.isFinite(timestamp)) {
    return "";
  }
  const date = new Date(timestamp * 1000);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return formatter.format(date);
};

/**
 * Format a Unix timestamp in seconds to a compact local date and time string
 */
export const formatTimestamp = (timestamp: number): string =>
  formatUnixTimestamp(timestamp, timestampFormatter);

/**
 * Format a Unix timestamp in seconds to a full local date and time string for tooltips
 */
export const formatTimestampFull = (timestamp: number): string =>
  formatUnixTimestamp(timestamp, timestampFullFormatter);
