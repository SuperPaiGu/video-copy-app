/**
 * Clean transcript text by removing timestamps and excessive whitespace
 */
export function cleanTranscript(text: string): string {
  if (!text) return "";

  return (
    text
      // Remove timestamps like [00:00.000] or [00:00:00.000]
      .replace(/\[\d{2}:\d{2}(?::\d{2})?\.\d{3}\]/g, "")
      // Remove excessive whitespace
      .replace(/\s+/g, " ")
      .trim()
  );
}

/**
 * Truncate transcript to maximum length
 */
export function truncateTranscript(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) return text;

  // Truncate at word boundary if possible
  const truncated = text.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(" ");

  if (lastSpace > maxLength * 0.8) {
    return truncated.slice(0, lastSpace);
  }

  return truncated;
}
