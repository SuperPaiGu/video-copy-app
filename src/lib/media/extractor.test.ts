import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import ffmpegStatic from "ffmpeg-static";
import ffprobeStatic from "ffprobe-static";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  extractAudio,
  extractFrames,
  extractMediaAssets,
} from "@/lib/media/extractor";

const execFileAsync = promisify(execFile);

async function runFfmpeg(args: string[]): Promise<void> {
  if (!ffmpegStatic) {
    throw new Error("ffmpeg-static binary is unavailable");
  }

  await execFileAsync(ffmpegStatic, args, { windowsHide: true });
}

async function runFfprobe(args: string[]): Promise<string> {
  const { stdout } = await execFileAsync(ffprobeStatic.path, args, { windowsHide: true });
  return stdout.trim();
}

async function createVideoFixture(videoPath: string, withAudio: boolean): Promise<void> {
  const baseArgs = [
    "-y",
    "-f",
    "lavfi",
    "-i",
    "testsrc=size=1920x1080:rate=30",
  ];

  const audioArgs = withAudio
    ? ["-f", "lavfi", "-i", "sine=frequency=440:sample_rate=44100"]
    : [];

  const outputArgs = withAudio
    ? [
        "-t",
        "4",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-shortest",
        videoPath,
      ]
    : ["-t", "4", "-c:v", "libx264", "-pix_fmt", "yuv420p", videoPath];

  await runFfmpeg([...baseArgs, ...audioArgs, ...outputArgs]);
}

describe("media extractor", () => {
  const fixtureRoot = path.join(os.tmpdir(), `video-copy-app-media-${Date.now()}`);
  const withAudioVideo = path.join(fixtureRoot, "fixture-with-audio.mp4");
  const silentVideo = path.join(fixtureRoot, "fixture-silent.mp4");
  const outputRoot = path.join(fixtureRoot, "outputs");

  beforeAll(async () => {
    await fs.mkdir(outputRoot, { recursive: true });

    try {
      await runFfmpeg(["-version"]);
      await runFfprobe(["-version"]);
    } catch {
      throw new Error("ffmpeg/ffprobe is required for media extraction tests");
    }

    await createVideoFixture(withAudioVideo, true);
    await createVideoFixture(silentVideo, false);
  }, 60_000);

  afterAll(async () => {
    await fs.rm(fixtureRoot, { recursive: true, force: true });
  });

  it("extracts key + sampled frames as jpg and resizes to width <= 1280", async () => {
    const frameDir = path.join(outputRoot, "frames-audio");
    const framePaths = await extractFrames(withAudioVideo, frameDir);

    expect(framePaths.length).toBeGreaterThanOrEqual(3);
    expect(framePaths.length).toBeLessThanOrEqual(8);

    for (const framePath of framePaths) {
      expect(framePath.endsWith(".jpg")).toBe(true);
      await expect(fs.access(framePath)).resolves.toBeUndefined();

      const probe = await runFfprobe([
        "-v",
        "error",
        "-select_streams",
        "v:0",
        "-show_entries",
        "stream=width,height",
        "-of",
        "csv=s=x:p=0",
        framePath,
      ]);

      const width = Number(probe.split("x")[0]);
      expect(width).toBeLessThanOrEqual(1280);
    }
  }, 60_000);

  it("extracts audio track when input video has audio", async () => {
    const audioPath = path.join(outputRoot, "with-audio.m4a");
    const extracted = await extractAudio(withAudioVideo, audioPath);

    expect(extracted).toBe(audioPath);
    await expect(fs.access(audioPath)).resolves.toBeUndefined();
  }, 60_000);

  it("handles silent video without crash and marks no_audio", async () => {
    const frameDir = path.join(outputRoot, "frames-silent");
    const audioPath = path.join(outputRoot, "silent-audio.m4a");

    const result = await extractMediaAssets(silentVideo, frameDir, audioPath);

    expect(result.framePaths.length).toBeGreaterThanOrEqual(3);
    expect(result.audioPath).toBeNull();
    expect(result.no_audio).toBe(true);
  }, 60_000);
});
