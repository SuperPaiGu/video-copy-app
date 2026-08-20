/**
 * Video file validation module.
 * Validates file format, size, duration, and batch count against configured limits.
 */

import {
  SUPPORTED_FORMATS,
  SUPPORTED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
  MAX_DURATION_SECONDS,
  MAX_BATCH_COUNT,
  MAX_FILE_SIZE_MB,
  MAX_DURATION_MIN,
} from "./config";

// Re-export constants for convenience
export {
  SUPPORTED_FORMATS,
  MAX_FILE_SIZE_BYTES,
  MAX_DURATION_SECONDS,
  MAX_BATCH_COUNT,
} from "./config";

// Validation error codes
export const ValidationErrorCode = {
  UNSUPPORTED_FORMAT: "UNSUPPORTED_FORMAT",
  FILE_TOO_LARGE: "FILE_TOO_LARGE",
  DURATION_TOO_LONG: "DURATION_TOO_LONG",
  BATCH_TOO_LARGE: "BATCH_TOO_LARGE",
  EMPTY_FILENAME: "EMPTY_FILENAME",
} as const;

// Validation result types
export interface ValidationSuccess {
  success: true;
}

export interface ValidationError {
  success: false;
  error: {
    code: (typeof ValidationErrorCode)[keyof typeof ValidationErrorCode];
    message: string;
  };
}

export type ValidationResult = ValidationSuccess | ValidationError;

// File input for validation
export interface FileInput {
  filename: string;
  mimeType: string;
  size: number;
  duration?: number;
}

/**
 * Get file extension from filename
 */
function getFileExtension(filename: string): string {
  const parts = filename.split(".");
  return parts.length > 1 ? parts.pop()!.toLowerCase() : "";
}

/**
 * Check if mime type is a supported video format
 */
function isSupportedMimeType(mimeType: string): boolean {
  return Object.values(SUPPORTED_MIME_TYPES).includes(mimeType);
}

/**
 * Validate a single video file
 */
export function validateFile(input: FileInput): ValidationResult {
  // Check for empty filename
  if (!input.filename || input.filename.trim() === "") {
    return {
      success: false,
      error: {
        code: ValidationErrorCode.EMPTY_FILENAME,
        message: "Filename cannot be empty",
      },
    };
  }

  // Validate format (by extension or mime type)
  const ext = getFileExtension(input.filename);
  const isSupportedFormat =
    ext !== "" && SUPPORTED_FORMATS.includes(ext as (typeof SUPPORTED_FORMATS)[number]);
  const isSupportedVideoMime = isSupportedMimeType(input.mimeType);

  // Reject if neither extension nor mime type indicates a supported video format
  if (!isSupportedFormat && !isSupportedVideoMime) {
    return {
      success: false,
      error: {
        code: ValidationErrorCode.UNSUPPORTED_FORMAT,
        message: `Unsupported format. Supported formats: ${SUPPORTED_FORMATS.join(", ")}`,
      },
    };
  }

  // Validate file size
  if (input.size > MAX_FILE_SIZE_BYTES) {
    return {
      success: false,
      error: {
        code: ValidationErrorCode.FILE_TOO_LARGE,
        message: `File size exceeds ${MAX_FILE_SIZE_MB}MB limit. Maximum allowed size is ${MAX_FILE_SIZE_MB}MB.`,
      },
    };
  }

  // Validate duration if provided
  if (input.duration !== undefined && input.duration > MAX_DURATION_SECONDS) {
    return {
      success: false,
      error: {
        code: ValidationErrorCode.DURATION_TOO_LONG,
        message: `Video duration exceeds ${MAX_DURATION_MIN} minute limit. Maximum allowed duration is ${MAX_DURATION_MIN} minutes.`,
      },
    };
  }

  // All validations passed
  return { success: true };
}

/**
 * Validate a batch of files
 */
export function validateBatch(files: FileInput[]): ValidationResult {
  // Check batch size
  if (files.length > MAX_BATCH_COUNT) {
    return {
      success: false,
      error: {
        code: ValidationErrorCode.BATCH_TOO_LARGE,
        message: `Batch size exceeds limit of ${MAX_BATCH_COUNT} files. Maximum allowed files per upload is ${MAX_BATCH_COUNT}.`,
      },
    };
  }

  // Validate each file in the batch
  for (const file of files) {
    const result = validateFile(file);
    if (!result.success) {
      return result;
    }
  }

  return { success: true };
}
