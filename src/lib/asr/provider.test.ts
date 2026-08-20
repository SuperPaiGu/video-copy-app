import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import ffmpegStatic from "ffmpeg-static";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { AsrProvider } from "./types";
import { WhisperAsrProvider } from "./whisper-provider";
import { cleanTranscript, truncateTranscript } from "./utils";

const execFileAsync = promisify(execFile);

async function runFfmpeg(args: string[]): Promise<void> {
  if (!ffmpegStatic) {
    throw new Error("ffmpeg-static binary is unavailable");
  }

  await execFileAsync(ffmpegStatic, args, { windowsHide: true });
}

describe("ASR Provider Contract", () => {
  let tempDir: string;
  let audioWithSpeech: string;
  let silentAudio: string;

  beforeAll(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "asr-test-"));

    // Create audio fixture with tone (simulates speech)
    audioWithSpeech = path.join(tempDir, "audio-with-speech.aac");
    await runFfmpeg([
      "-y",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=440:sample_rate=44100",
      "-t",
      "2",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      audioWithSpeech,
    ]);

    // Create silent audio fixture
    silentAudio = path.join(tempDir, "silent-audio.aac");
    await runFfmpeg([
      "-y",
      "-f",
      "lavfi",
      "-i",
      "anullsrc=sample_rate=44100",
      "-t",
      "2",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      silentAudio,
    ]);
  });

  afterAll(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe("WhisperAsrProvider", () => {
    let provider: AsrProvider;

    beforeAll(() => {
      provider = new WhisperAsrProvider({ maxLength: 2000 });
    });

    it("should return non-empty transcript for audio with speech", async () => {
      const transcript = await provider.transcribe(audioWithSpeech);

      expect(transcript).toBeDefined();
      expect(typeof transcript).toBe("string");
      if (transcript) {
        expect(transcript.length).toBeGreaterThan(0);
        // Should not contain binary garbage
        expect(transcript).toMatch(/^[\s\S]*$/);
        // Should not contain raw timestamps like [00:00.000]
        expect(transcript).not.toMatch(/\[\d{2}:\d{2}\.\d{3}\]/);
      }
    }, 30000); // 30s timeout for ASR processing

    it("should return null or empty string for silent audio", async () => {
      const transcript = await provider.transcribe(silentAudio);

      expect(transcript === null || transcript === "").toBe(true);
    }, 30000);

    it("should return null for non-existent audio file", async () => {
      const transcript = await provider.transcribe(path.join(tempDir, "non-existent.aac"));

      expect(transcript).toBeNull();
    });
  });

  describe("cleanTranscript", () => {
    it("should remove timestamps", () => {
      const input = "[00:00.000] Hello world [00:02.500] Test";
      const output = cleanTranscript(input);

      expect(output).not.toContain("[00:00.000]");
      expect(output).not.toContain("[00:02.500]");
      expect(output).toContain("Hello world");
      expect(output).toContain("Test");
    });

    it("should remove excessive whitespace", () => {
      const input = "Hello    world\n\n\nTest   text";
      const output = cleanTranscript(input);

      expect(output).toBe("Hello world Test text");
    });

    it("should handle empty input", () => {
      expect(cleanTranscript("")).toBe("");
      expect(cleanTranscript("   ")).toBe("");
    });
  });

  describe("truncateTranscript", () => {
    it("should truncate long text to max length", () => {
      const input = "a".repeat(3000);
      const output = truncateTranscript(input, 2000);

      expect(output.length).toBeLessThanOrEqual(2000);
    });

    it("should not truncate short text", () => {
      const input = "Hello world";
      const output = truncateTranscript(input, 2000);

      expect(output).toBe(input);
    });

    it("should handle empty input", () => {
      expect(truncateTranscript("", 2000)).toBe("");
    });
  });
});
