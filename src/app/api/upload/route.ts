import path from "path";
import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

import { taskRepository } from "@/lib/db";
import { VideoQueue } from "@/lib/queue";
import { LocalFileStorage } from "@/lib/storage";
import { validateBatch, validateFile } from "@/lib/validator";

const STORAGE_ROOT = process.env.STORAGE_ROOT || path.join(process.cwd(), ".storage");

export async function POST(request: Request) {
  const batchId = randomUUID();
  
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("multipart/form-data")) {
    return NextResponse.json(
      { error: "Content-Type must be multipart/form-data" },
      { status: 400 }
    );
  }

  const formData = await request.formData();
  const files = Array.from(formData.values()).filter(
    (value): value is File =>
      typeof value !== "string" && typeof value.arrayBuffer === "function"
  );

  if (files.length === 0) {
    return NextResponse.json(
      { error: "At least one video file is required" },
      { status: 400 }
    );
  }

  const batchValidation = validateBatch(
    files.map((file) => ({
      filename: file.name,
      mimeType: file.type,
      size: file.size,
    })),
  );
  if (!batchValidation.success) {
    return NextResponse.json({ error: batchValidation.error.message }, { status: 400 });
  }

  for (const file of files) {
    const validation = validateFile({
      filename: file.name,
      mimeType: file.type,
      size: file.size,
    });

    if (!validation.success) {
      return NextResponse.json({ error: validation.error.message }, { status: 400 });
    }
  }

  const storage = new LocalFileStorage(STORAGE_ROOT);
  const queue = new VideoQueue();

  try {
    const tasks: Array<{ taskId: string; status: "queued" | "failed" }> = [];

    for (const file of files) {
      const task = taskRepository.create(file.name, undefined, batchId);
      const taskId = String(task.id);

      const buffer = Buffer.from(await file.arrayBuffer());
      const savedPath = await storage.save(taskId, "video", buffer, file.name);

      try {
        await withTimeout(
          queue.enqueue({
            taskId,
            videoPath: savedPath,
          }),
          1000,
          "Queue enqueue timeout",
        );

        tasks.push({ taskId, status: "queued" });
      } catch (error) {
        taskRepository.updateStatus(task.id, "failed", `Queue unavailable: ${toErrorMessage(error)}`);
        tasks.push({ taskId, status: "failed" });
      }
    }

    return NextResponse.json(tasks, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  } finally {
    try {
      await withTimeout(queue.close(), 1000, "Queue close timeout");
    } catch {
      // Ignore close errors to preserve request result.
    }
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeoutHandle: NodeJS.Timeout | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutHandle = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "unknown queue error";
}
