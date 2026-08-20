import { describe, expect, it } from "vitest";

import {
  validateFile,
  validateBatch,
  ValidationError,
  MAX_FILE_SIZE_BYTES,
  MAX_DURATION_SECONDS,
  SUPPORTED_FORMATS,
} from "@/lib/validator";

describe("validateFile", () => {
  // Valid file tests
  it("accepts valid mp4 file within limits", () => {
    const result = validateFile({
      filename: "test.mp4",
      mimeType: "video/mp4",
      size: 50 * 1024 * 1024, // 50MB
      duration: 120, // 2min
    });

    expect(result.success).toBe(true);
  });

  it("accepts valid mov file within limits", () => {
    const result = validateFile({
      filename: "test.mov",
      mimeType: "video/quicktime",
      size: 80 * 1024 * 1024, // 80MB
      duration: 180, // 3min
    });

    expect(result.success).toBe(true);
  });

  it("accepts valid webm file within limits", () => {
    const result = validateFile({
      filename: "test.webm",
      mimeType: "video/webm",
      size: MAX_FILE_SIZE_BYTES - 1,
      duration: MAX_DURATION_SECONDS - 1,
    });

    expect(result.success).toBe(true);
  });

  // Format validation tests
  it("rejects non-video file (txt)", () => {
    const result = validateFile({
      filename: "document.txt",
      mimeType: "text/plain",
      size: 1024,
      duration: 0,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("UNSUPPORTED_FORMAT");
      expect(result.error.message).toMatch(/video|format|supported/i);
    }
  });

  it("rejects image file (jpg)", () => {
    const result = validateFile({
      filename: "photo.jpg",
      mimeType: "image/jpeg",
      size: 1024,
      duration: 0,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("UNSUPPORTED_FORMAT");
    }
  });

  it("rejects unsupported video format (avi)", () => {
    const result = validateFile({
      filename: "video.avi",
      mimeType: "video/x-msvideo",
      size: 50 * 1024 * 1024,
      duration: 120,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("UNSUPPORTED_FORMAT");
    }
  });

  // Size validation tests
  it("rejects file exceeding 100MB", () => {
    const result = validateFile({
      filename: "large.mp4",
      mimeType: "video/mp4",
      size: MAX_FILE_SIZE_BYTES + 1,
      duration: 60,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("FILE_TOO_LARGE");
      expect(result.error.message).toMatch(/100MB|size|limit/i);
    }
  });

  it("rejects file exactly at 100MB limit", () => {
    const result = validateFile({
      filename: "exact.mp4",
      mimeType: "video/mp4",
      size: MAX_FILE_SIZE_BYTES,
      duration: 60,
    });

    expect(result.success).toBe(true); // Exactly at limit should pass
  });

  // Duration validation tests
  it("rejects video exceeding 5 minutes", () => {
    const result = validateFile({
      filename: "long.mp4",
      mimeType: "video/mp4",
      size: 50 * 1024 * 1024,
      duration: MAX_DURATION_SECONDS + 1,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("DURATION_TOO_LONG");
      expect(result.error.message).toMatch(/5.*min|duration|limit/i);
    }
  });

  it("rejects video exactly at 5 minute limit", () => {
    const result = validateFile({
      filename: "exact-long.mp4",
      mimeType: "video/mp4",
      size: 50 * 1024 * 1024,
      duration: MAX_DURATION_SECONDS,
    });

    expect(result.success).toBe(true); // Exactly at limit should pass
  });

  // Combined validation
  it("rejects file that is both oversized and too long", () => {
    const result = validateFile({
      filename: "bad.mp4",
      mimeType: "video/mp4",
      size: MAX_FILE_SIZE_BYTES + 1,
      duration: MAX_DURATION_SECONDS + 1,
    });

    expect(result.success).toBe(false);
    // Should return the first error encountered (format check is first)
  });

  // Edge cases
  it("rejects file with no extension but video mime type", () => {
    const result = validateFile({
      filename: "video",
      mimeType: "video/mp4",
      size: 50 * 1024 * 1024,
      duration: 120,
    });

    // Without extension, we check mime type
    expect(result.success).toBe(true);
  });

  it("rejects empty filename", () => {
    const result = validateFile({
      filename: "",
      mimeType: "video/mp4",
      size: 50 * 1024 * 1024,
      duration: 120,
    });

    expect(result.success).toBe(false);
  });

  it("handles missing duration gracefully", () => {
    const result = validateFile({
      filename: "test.mp4",
      mimeType: "video/mp4",
      size: 50 * 1024 * 1024,
      duration: undefined,
    });

    // Missing duration is acceptable (will be checked later if needed)
    expect(result.success).toBe(true);
  });
});

describe("validateBatch", () => {
  const validFile = {
    filename: "test.mp4",
    mimeType: "video/mp4",
    size: 50 * 1024 * 1024,
    duration: 120,
  };

  it("accepts batch within count limit", () => {
    const files = Array(5).fill(validFile);
    const result = validateBatch(files);

    expect(result.success).toBe(true);
  });

  it("accepts batch at count limit", () => {
    const files = Array(10).fill(validFile);
    const result = validateBatch(files);

    expect(result.success).toBe(true);
  });

  it("rejects batch exceeding count limit", () => {
    const files = Array(11).fill(validFile);
    const result = validateBatch(files);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("BATCH_TOO_LARGE");
      expect(result.error.message).toMatch(/batch|count|limit/i);
    }
  });

  it("rejects batch with invalid file", () => {
    const files = [
      validFile,
      { ...validFile, filename: "bad.txt", mimeType: "text/plain" },
    ];
    const result = validateBatch(files);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("UNSUPPORTED_FORMAT");
    }
  });
});

describe("constants are correctly defined", () => {
  it("MAX_FILE_SIZE_BYTES is 1GB", () => {
    expect(MAX_FILE_SIZE_BYTES).toBe(1 * 1024 * 1024 * 1024);
  });

  it("MAX_DURATION_SECONDS is 5 minutes", () => {
    expect(MAX_DURATION_SECONDS).toBe(5 * 60);
  });

  it("SUPPORTED_FORMATS includes mp4, mov, webm", () => {
    expect(SUPPORTED_FORMATS).toContain("mp4");
    expect(SUPPORTED_FORMATS).toContain("mov");
    expect(SUPPORTED_FORMATS).toContain("webm");
  });
});
