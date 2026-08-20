import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockValidateFile,
  mockValidateBatch,
  mockTaskCreate,
  mockTaskUpdateStatus,
  mockSave,
  mockEnqueue,
  mockQueueClose,
} = vi.hoisted(() => ({
  mockValidateFile: vi.fn(),
  mockValidateBatch: vi.fn(),
  mockTaskCreate: vi.fn(),
  mockTaskUpdateStatus: vi.fn(),
  mockSave: vi.fn(),
  mockEnqueue: vi.fn(),
  mockQueueClose: vi.fn(),
}));

vi.mock("@/lib/validator", () => ({
  validateFile: mockValidateFile,
  validateBatch: mockValidateBatch,
}));

vi.mock("@/lib/db", () => ({
  taskRepository: {
    create: mockTaskCreate,
    updateStatus: mockTaskUpdateStatus,
  },
}));

vi.mock("@/lib/storage", () => ({
  LocalFileStorage: vi.fn().mockImplementation(function LocalFileStorageMock() {
    return {
      save: mockSave,
    };
  }),
}));

vi.mock("@/lib/queue", () => ({
  VideoQueue: vi.fn().mockImplementation(function VideoQueueMock() {
    return {
      enqueue: mockEnqueue,
      close: mockQueueClose,
    };
  }),
}));

import { POST } from "@/app/api/upload/route";

function createVideoFile(name: string, type = "video/mp4", content = "video-data") {
  return new File([content], name, { type });
}

describe("POST /api/upload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateFile.mockReturnValue({ success: true });
    mockValidateBatch.mockReturnValue({ success: true });
    mockSave.mockResolvedValue("/tmp/saved-file.mp4");
    mockEnqueue.mockResolvedValue(undefined);
    mockTaskUpdateStatus.mockReturnValue(undefined);
    mockQueueClose.mockResolvedValue(undefined);
  });

  it("returns 400 when content-type is not multipart/form-data", async () => {
    const request = new Request("http://localhost:3000/api/upload", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ hello: "world" }),
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toMatch(/multipart\/form-data/i);
    expect(mockTaskCreate).not.toHaveBeenCalled();
    expect(mockEnqueue).not.toHaveBeenCalled();
  });

  it("returns 400 when no video files are provided", async () => {
    const formData = new FormData();
    const request = new Request("http://localhost:3000/api/upload", {
      method: "POST",
      body: formData,
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toMatch(/no files|at least one/i);
    expect(mockTaskCreate).not.toHaveBeenCalled();
    expect(mockEnqueue).not.toHaveBeenCalled();
  });

  it("returns 400 and creates no task when any file is invalid", async () => {
    const formData = new FormData();
    formData.append("videos", createVideoFile("good.mp4"));
    formData.append("videos", createVideoFile("bad.txt", "text/plain"));

    mockValidateFile
      .mockReturnValueOnce({ success: true })
      .mockReturnValueOnce({
        success: false,
        error: {
          code: "UNSUPPORTED_FORMAT",
          message: "Unsupported format",
        },
      });

    const request = new Request("http://localhost:3000/api/upload", {
      method: "POST",
      body: formData,
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe("Unsupported format");
    expect(mockTaskCreate).not.toHaveBeenCalled();
    expect(mockSave).not.toHaveBeenCalled();
    expect(mockEnqueue).not.toHaveBeenCalled();
  });

  it("returns 400 and creates no task when batch exceeds max size", async () => {
    const formData = new FormData();
    for (let i = 0; i < 11; i += 1) {
      formData.append("videos", createVideoFile(`${i}.mp4`));
    }

    mockValidateBatch.mockReturnValueOnce({
      success: false,
      error: {
        code: "BATCH_TOO_LARGE",
        message: "Batch size exceeds limit of 10 files.",
      },
    });

    const request = new Request("http://localhost:3000/api/upload", {
      method: "POST",
      body: formData,
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toMatch(/batch size exceeds limit/i);
    expect(mockTaskCreate).not.toHaveBeenCalled();
    expect(mockEnqueue).not.toHaveBeenCalled();
  });

  it("returns 500 when storage fails", async () => {
    const formData = new FormData();
    formData.append("videos", createVideoFile("single.mp4"));
    mockTaskCreate.mockReturnValue({ id: 1, status: "queued" });
    mockSave.mockRejectedValue(new Error("disk write failed"));

    const request = new Request("http://localhost:3000/api/upload", {
      method: "POST",
      body: formData,
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.error).toMatch(/upload failed/i);
    expect(mockEnqueue).not.toHaveBeenCalled();
  });

  it("creates independent queued tasks for multiple videos", async () => {
    const formData = new FormData();
    formData.append("videos", createVideoFile("a.mp4"));
    formData.append("videos", createVideoFile("b.mov", "video/quicktime"));

    mockTaskCreate
      .mockReturnValueOnce({ id: 101, status: "queued" })
      .mockReturnValueOnce({ id: 102, status: "queued" });
    mockSave
      .mockResolvedValueOnce("/tmp/101/video/a.mp4")
      .mockResolvedValueOnce("/tmp/102/video/b.mov");

    const request = new Request("http://localhost:3000/api/upload", {
      method: "POST",
      body: formData,
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload).toEqual([
      { taskId: "101", status: "queued" },
      { taskId: "102", status: "queued" },
    ]);

    expect(mockTaskCreate).toHaveBeenCalledTimes(2);
    expect(mockEnqueue).toHaveBeenCalledTimes(2);
    expect(mockEnqueue).toHaveBeenNthCalledWith(1, {
      taskId: "101",
      videoPath: "/tmp/101/video/a.mp4",
    });
    expect(mockEnqueue).toHaveBeenNthCalledWith(2, {
      taskId: "102",
      videoPath: "/tmp/102/video/b.mov",
    });
  });

  it("creates one queued task when one video is uploaded", async () => {
    const formData = new FormData();
    formData.append("videos", createVideoFile("single.mp4"));

    mockTaskCreate.mockReturnValueOnce({ id: 301, status: "queued" });
    mockSave.mockResolvedValueOnce("/tmp/301/video/single.mp4");

    const request = new Request("http://localhost:3000/api/upload", {
      method: "POST",
      body: formData,
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload).toEqual([{ taskId: "301", status: "queued" }]);
    expect(mockTaskCreate).toHaveBeenCalledTimes(1);
    expect(mockEnqueue).toHaveBeenCalledTimes(1);
  });

  it("marks task failed when enqueue is unavailable but still returns created task", async () => {
    const formData = new FormData();
    formData.append("videos", createVideoFile("single.mp4"));

    mockTaskCreate.mockReturnValueOnce({ id: 401, status: "queued" });
    mockSave.mockResolvedValueOnce("/tmp/401/video/single.mp4");
    mockEnqueue.mockRejectedValueOnce(new Error("connect ECONNREFUSED"));

    const request = new Request("http://localhost:3000/api/upload", {
      method: "POST",
      body: formData,
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload).toEqual([{ taskId: "401", status: "failed" }]);
    expect(mockTaskUpdateStatus).toHaveBeenCalledWith(401, "failed", expect.stringMatching(/queue unavailable/i));
  });
});
