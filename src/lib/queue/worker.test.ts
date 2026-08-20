import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import ffmpegStatic from "ffmpeg-static";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ResultVariant } from "@/lib/db";

const execFileAsync = promisify(execFile);

async function runFfmpeg(args: string[]): Promise<void> {
  if (!ffmpegStatic) {
    throw new Error("ffmpeg-static binary is unavailable");
  }

  await execFileAsync(ffmpegStatic, args, { windowsHide: true });
}

async function createVideoFixture(videoPath: string, withAudio = true): Promise<void> {
  await fs.mkdir(path.dirname(videoPath), { recursive: true });

  const baseArgs = [
    "-y",
    "-f",
    "lavfi",
    "-i",
    "testsrc=size=1280x720:rate=24",
  ];

  const audioArgs = withAudio
    ? ["-f", "lavfi", "-i", "sine=frequency=440:sample_rate=44100"]
    : [];

  const outputArgs = withAudio
    ? [
        "-t",
        "2",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-shortest",
        videoPath,
      ]
    : ["-t", "2", "-c:v", "libx264", "-pix_fmt", "yuv420p", videoPath];

  await runFfmpeg([...baseArgs, ...audioArgs, ...outputArgs]);
}

describe("VideoPipelineOrchestrator", () => {
  let tempRoot: string;
  let originalDbPath: string | undefined;

  beforeEach(async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "worker-pipeline-"));
    originalDbPath = process.env.DB_PATH;
    process.env.DB_PATH = path.join(tempRoot, "test.db");
    vi.resetModules();
  });

  afterEach(async () => {
    const db = await import("@/lib/db");
    db.closeDatabase();
    if (originalDbPath === undefined) {
      delete process.env.DB_PATH;
    } else {
      process.env.DB_PATH = originalDbPath;
    }

    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  it("processes queued task to done and persists exactly 3 variants before done", async () => {
    const taskFolder = "2001";
    const videoPath = path.join(tempRoot, taskFolder, "video", "fixture.mp4");
    await createVideoFixture(videoPath, true);

    const db = await import("@/lib/db");
    const createdTask = db.taskRepository.create("fixture.mp4", videoPath);
    const taskId = String(createdTask.id);

    const variants: ResultVariant[] = [
      { title: "标题一", copy: "文案一", hashtags: ["#旅行", "#vlog"] },
      { title: "标题二", copy: "文案二", hashtags: ["#攻略", "#打卡"] },
      { title: "标题三", copy: "文案三", hashtags: ["#生活", "#记录"] },
    ];

    const timeline: string[] = [];

    const { VideoPipelineOrchestrator } = await import("@/lib/queue/worker");
    const orchestrator = new VideoPipelineOrchestrator({
      glmProvider: {
        generate: vi.fn().mockResolvedValue({ variants }),
      },
      taskRepo: {
        ...db.taskRepository,
        updateStatus: vi.fn((id, status, errorMessage) => {
          timeline.push(`status:${status}`);
          return db.taskRepository.updateStatus(id, status, errorMessage);
        }),
      },
      resultRepo: {
        ...db.resultRepository,
        create: vi.fn((id, nextVariants) => {
          timeline.push("result:create");
          return db.resultRepository.create(id, nextVariants);
        }),
      },
    });

    await orchestrator.process(
      { taskId, videoPath },
      {
        attemptsMade: 0,
        maxAttempts: 3,
        jobId: "job-success",
      },
    );

    const task = db.taskRepository.findById(Number(taskId));
    const transcript = db.transcriptRepository.findByTaskId(Number(taskId));
    const result = db.resultRepository.findByTaskId(Number(taskId));

    expect(task?.status).toBe("done");
    expect(task?.error_message).toBeNull();
    expect(transcript).toBeDefined();
    expect(result?.variants).toHaveLength(3);

    const resultCreateIndex = timeline.indexOf("result:create");
    const doneStatusIndex = timeline.indexOf("status:done");
    expect(resultCreateIndex).toBeGreaterThan(-1);
    expect(doneStatusIndex).toBeGreaterThan(resultCreateIndex);
  }, 60_000);

  it("marks task as queued with error on retryable failure", async () => {
    const taskFolder = "3001";
    const videoPath = path.join(tempRoot, taskFolder, "video", "fixture.mp4");
    await createVideoFixture(videoPath, true);

    const db = await import("@/lib/db");
    const createdTask = db.taskRepository.create("fixture.mp4", videoPath);
    const taskId = String(createdTask.id);

    const { VideoPipelineOrchestrator } = await import("@/lib/queue/worker");
    const orchestrator = new VideoPipelineOrchestrator({
      glmProvider: {
        generate: vi.fn().mockRejectedValue(new Error("GLM temporary failure")),
      },
    });

    await expect(
      orchestrator.process(
        { taskId, videoPath },
        {
          attemptsMade: 0,
          maxAttempts: 3,
          jobId: "job-retry",
        },
      ),
    ).rejects.toThrow("GLM temporary failure");

    const task = db.taskRepository.findById(Number(taskId));
    const result = db.resultRepository.findByTaskId(Number(taskId));

    expect(task?.status).toBe("queued");
    expect(task?.error_message).toContain("GLM temporary failure");
    expect(result).toBeUndefined();
  }, 60_000);

  it("marks task as failed with error message on final failure", async () => {
    const taskFolder = "4001";
    const videoPath = path.join(tempRoot, taskFolder, "video", "fixture.mp4");
    await createVideoFixture(videoPath, true);

    const db = await import("@/lib/db");
    const createdTask = db.taskRepository.create("fixture.mp4", videoPath);
    const taskId = String(createdTask.id);

    const { VideoPipelineOrchestrator } = await import("@/lib/queue/worker");
    const orchestrator = new VideoPipelineOrchestrator({
      glmProvider: {
        generate: vi.fn().mockRejectedValue(new Error("GLM provider hard failure")),
      },
    });

    await expect(
      orchestrator.process(
        { taskId, videoPath },
        {
          attemptsMade: 2,
          maxAttempts: 3,
          jobId: "job-failed",
        },
      ),
    ).rejects.toThrow("GLM provider hard failure");

    const task = db.taskRepository.findById(Number(taskId));

    expect(task?.status).toBe("failed");
    expect(task?.error_message).toContain("GLM provider hard failure");
  }, 60_000);
});
