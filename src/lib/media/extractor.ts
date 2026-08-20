import { promises as fs } from "node:fs";
import path from "node:path";
import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import ffprobeStatic from "ffprobe-static";

const MAX_FRAME_WIDTH = 1280;
const MIN_FRAMES = 3;
const MAX_FRAMES = 8;
const DEFAULT_TOTAL_FRAMES = 5;

type FfprobeData = ffmpeg.FfprobeData;

if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic);
}

ffmpeg.setFfprobePath(ffprobeStatic.path);

interface ExtractFramesOptions {
  totalFrames?: number;
  maxWidth?: number;
}

export interface MediaExtractionResult {
  framePaths: string[];
  audioPath: string | null;
  no_audio: boolean;
}

function runCommand(command: ffmpeg.FfmpegCommand): Promise<void> {
  return new Promise((resolve, reject) => {
    command
      .once("end", () => resolve())
      .once("error", (error) => reject(error))
      .run();
  });
}

function probe(videoPath: string): Promise<FfprobeData> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (error, data) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(data);
    });
  });
}

function clampFrameCount(requested: number): number {
  return Math.min(MAX_FRAMES, Math.max(MIN_FRAMES, requested));
}

function buildTimestamps(durationSeconds: number, totalFrames: number): number[] {
  const safeDuration = Math.max(durationSeconds, 0.3);
  const endTimestamp = Math.max(0, safeDuration - 0.1);
  const base = [0, safeDuration / 2, endTimestamp];

  const uniformCount = Math.max(0, totalFrames - base.length);
  const uniforms: number[] = [];
  for (let i = 1; i <= uniformCount; i += 1) {
    uniforms.push((safeDuration * i) / (uniformCount + 1));
  }

  const merged = [...base, ...uniforms]
    .map((value) => Number(value.toFixed(2)))
    .filter((value, index, list) => list.indexOf(value) === index)
    .sort((a, b) => a - b);

  if (merged.length >= MIN_FRAMES) {
    return merged;
  }

  return [0, safeDuration * 0.5, endTimestamp].map((value) => Number(value.toFixed(2)));
}

async function extractFrameAtTimestamp(
  videoPath: string,
  outputPath: string,
  timestampSeconds: number,
  maxWidth: number,
): Promise<void> {
  const command = ffmpeg(videoPath)
    .inputOptions(["-ss", String(Math.max(0, timestampSeconds))])
    .outputOptions(["-frames:v", "1", "-q:v", "3"])
    .size(`${maxWidth}x?`)
    .format("image2")
    .output(outputPath);

  await runCommand(command);
}

export async function extractFrames(
  videoPath: string,
  outputDir: string,
  options?: ExtractFramesOptions,
): Promise<string[]> {
  await fs.mkdir(outputDir, { recursive: true });

  const metadata = await probe(videoPath);
  const duration = Number(metadata.format.duration ?? 0);
  const totalFrames = clampFrameCount(options?.totalFrames ?? DEFAULT_TOTAL_FRAMES);
  const maxWidth = options?.maxWidth ?? MAX_FRAME_WIDTH;
  const timestamps = buildTimestamps(duration, totalFrames);

  const framePaths: string[] = [];
  
  // 并行提取所有帧
  await Promise.all(
    timestamps.map(async (timestamp, index) => {
      const filename = `frame-${String(index + 1).padStart(3, "0")}.jpg`;
      const framePath = path.join(outputDir, filename);
      await extractFrameAtTimestamp(videoPath, framePath, timestamp, maxWidth);
      framePaths[index] = framePath;
    })
  );

  return framePaths;
}

export async function extractAudio(videoPath: string, outputPath: string): Promise<string | null> {
  const metadata = await probe(videoPath);
  const hasAudio = metadata.streams.some((stream) => stream.codec_type === "audio");

  if (!hasAudio) {
    return null;
  }

  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  const command = ffmpeg(videoPath)
    .noVideo()
    .audioCodec("aac")
    .outputOptions(["-b:a", "128k"])
    .output(outputPath);

  await runCommand(command);
  return outputPath;
}

export async function extractMediaAssets(
  videoPath: string,
  frameOutputDir: string,
  audioOutputPath: string,
  options?: ExtractFramesOptions,
): Promise<MediaExtractionResult> {
  // 并行提取帧和音频
  const [framePaths, audioPath] = await Promise.all([
    extractFrames(videoPath, frameOutputDir, options),
    extractAudio(videoPath, audioOutputPath),
  ]);

  return {
    framePaths,
    audioPath,
    no_audio: audioPath === null,
  };
}
