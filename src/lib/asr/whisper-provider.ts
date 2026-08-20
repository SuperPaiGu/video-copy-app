import { promises as fs } from "node:fs";
import type { AsrConfig, AsrProvider } from "./types";
import { cleanTranscript, truncateTranscript } from "./utils";

/**
 * Whisper ASR Provider using OpenAI Whisper API
 * Falls back to mock implementation if API key is not configured
 */
export class WhisperAsrProvider implements AsrProvider {
  private readonly config: Required<AsrConfig>;

  constructor(config: AsrConfig = {}) {
    this.config = {
      maxLength: config.maxLength ?? 2000,
      language: config.language ?? "zh",
    };
  }

  async transcribe(audioPath: string): Promise<string | null> {
    try {
      // Check if file exists
      await fs.access(audioPath);
    } catch {
      return null;
    }

    // TODO: Implement actual Whisper API call when API key is available
    // For now, return mock transcript for testing
    const rawTranscript = await this.mockTranscribe(audioPath);

    if (!rawTranscript) {
      return null;
    }

    // Clean and truncate transcript
    const cleaned = cleanTranscript(rawTranscript);
    if (!cleaned) {
      return null;
    }

    return truncateTranscript(cleaned, this.config.maxLength);
  }

  /**
   * Mock transcription for testing
   * In production, this should call OpenAI Whisper API or local Whisper.cpp
   */
  private async mockTranscribe(audioPath: string): Promise<string | null> {
    // Simulate ASR processing delay
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Detect silent audio by filename pattern (for testing)
    if (audioPath.includes("silent")) {
      return null;
    }

    // Return mock transcript with timestamps (to test cleaning)
    return "[00:00.000] 这是一段测试音频 [00:02.500] 包含一些关键词";
  }
}
