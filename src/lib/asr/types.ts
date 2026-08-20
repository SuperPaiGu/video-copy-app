/**
 * ASR Provider Interface
 * Defines contract for speech-to-text transcription services
 */
export interface AsrProvider {
  /**
   * Transcribe audio file to text
   * @param audioPath - Path to audio file (AAC, MP3, WAV, etc.)
   * @returns Cleaned transcript text or null if audio is empty/silent
   */
  transcribe(audioPath: string): Promise<string | null>;
}

/**
 * ASR Configuration
 */
export interface AsrConfig {
  /** Maximum transcript length in characters (default: 2000) */
  maxLength?: number;
  /** Language code (e.g., 'zh', 'en') */
  language?: string;
}
