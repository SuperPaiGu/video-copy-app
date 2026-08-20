/**
 * Shared configuration constants for video upload constraints.
 * Used across the application for validation and API responses.
 */

// Supported video formats
export const SUPPORTED_FORMATS = ["mp4", "mov", "webm"] as const;

// MIME types mapping for supported formats
export const SUPPORTED_MIME_TYPES: Record<string, string> = {
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
};

// Maximum file size: 1GB
export const MAX_FILE_SIZE_BYTES = 1 * 1024 * 1024 * 1024;

// Maximum video duration: 5 minutes
export const MAX_DURATION_SECONDS = 5 * 60;

// Maximum number of files in a single batch upload
export const MAX_BATCH_COUNT = 10;

// Display-friendly constants for error messages
export const MAX_FILE_SIZE_MB = 1024;
export const MAX_DURATION_MIN = 5;
