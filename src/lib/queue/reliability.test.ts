import { beforeEach, describe, expect, it, vi } from "vitest";

type MockJobData = {
  taskId: string;
  videoPath: string;
};

type MockJob<T> = {
  id: string;
  data: T;
  name: string;
  opts: {
    attempts?: number;
    backoff?: {
      type: "exponential";
      delay: number;
    };
  };
  attemptsMade: number;
  state: "waiting" | "active" | "completed" | "failed";
};

type QueueStore<T> = {
  jobs: Map<string, MockJob<T>>;
  waiting: Array<MockJob<T>>;
  workers: Set<MockWorker<T>>;
};

const testState = vi.hoisted(() => {
  const stores = new Map<string, QueueStore<unknown>>();

  function getStore<T>(name: string): QueueStore<T> {
    const existing = stores.get(name);
    if (existing) {
      return existing as QueueStore<T>;
    }

    const created: QueueStore<T> = {
      jobs: new Map(),
      waiting: [],
      workers: new Set(),
    };
    stores.set(name, created as QueueStore<unknown>);
    return created;
  }

  return {
    stores,
    getStore,
    reset() {
      stores.clear();
    },
  };
});

class MockUnrecoverableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnrecoverableError";
  }
}

class MockQueue<T> {
  private readonly name: string;
  private readonly defaultJobOptions: {
    attempts?: number;
    backoff?: {
      type: "exponential";
      delay: number;
    };
  };

  constructor(
    name: string,
    options?: {
      defaultJobOptions?: {
        attempts?: number;
        backoff?: {
          type: "exponential";
          delay: number;
        };
      };
    },
  ) {
    this.name = name;
    this.defaultJobOptions = options?.defaultJobOptions ?? {};
  }

  async add(name: string, data: T, options?: { jobId?: string }): Promise<MockJob<T>> {
    const store = testState.getStore<T>(this.name);
    const jobId = String(options?.jobId ?? `${Date.now()}-${Math.random()}`);
    if (store.jobs.has(jobId)) {
      throw new Error(`Job ${jobId} already exists`);
    }

    const job: MockJob<T> = {
      id: jobId,
      name,
      data,
      opts: {
        attempts: this.defaultJobOptions.attempts,
        backoff: this.defaultJobOptions.backoff,
      },
      attemptsMade: 0,
      state: "waiting",
    };

    store.jobs.set(jobId, job);
    store.waiting.push(job);
    for (const worker of store.workers) {
      worker.pump();
    }
    return job;
  }

  async getJob(jobId: string): Promise<MockJob<T> | undefined> {
    const store = testState.getStore<T>(this.name);
    return store.jobs.get(String(jobId));
  }

  async close(): Promise<void> {
    return;
  }
}

class MockWorker<T> {
  private readonly name: string;
  private readonly processor: (job: MockJob<T>) => Promise<void>;
  private readonly concurrency: number;
  private active = 0;
  private closed = false;
  private listeners = {
    completed: [] as Array<(job: MockJob<T>) => void>,
    failed: [] as Array<(job: MockJob<T>, err: Error) => void>,
    error: [] as Array<(err: Error) => void>,
  };

  constructor(
    name: string,
    processor: (job: MockJob<T>) => Promise<void>,
    options?: { concurrency?: number },
  ) {
    this.name = name;
    this.processor = processor;
    this.concurrency = Math.max(1, options?.concurrency ?? 1);
    const store = testState.getStore<T>(name);
    store.workers.add(this);
  }

  on(event: "completed", listener: (job: MockJob<T>) => void): this;
  on(event: "failed", listener: (job: MockJob<T>, err: Error) => void): this;
  on(event: "error", listener: (err: Error) => void): this;
  on(event: "completed" | "failed" | "error", listener: unknown): this {
    if (event === "completed") {
      this.listeners.completed.push(listener as (job: MockJob<T>) => void);
      return this;
    }
    if (event === "failed") {
      this.listeners.failed.push(listener as (job: MockJob<T>, err: Error) => void);
      return this;
    }
    this.listeners.error.push(listener as (err: Error) => void);
    return this;
  }

  pump(): void {
    if (this.closed) {
      return;
    }

    const store = testState.getStore<T>(this.name);
    while (this.active < this.concurrency && store.waiting.length > 0) {
      const job = store.waiting.shift();
      if (!job) {
        return;
      }

      this.active += 1;
      job.state = "active";

      void this.runJob(job).finally(() => {
        this.active -= 1;
        this.pump();
      });
    }
  }

  private async runJob(job: MockJob<T>): Promise<void> {
    try {
      await this.processor(job);
      job.state = "completed";
      this.listeners.completed.forEach((listener) => listener(job));
      return;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      const maxAttempts = job.opts.attempts ?? 1;
      const shouldRetry = !(err instanceof MockUnrecoverableError) && job.attemptsMade + 1 < maxAttempts;

      if (shouldRetry) {
        job.attemptsMade += 1;
        job.state = "waiting";
        const delay = job.opts.backoff?.delay ?? 0;
        setTimeout(() => {
          const store = testState.getStore<T>(this.name);
          store.waiting.push(job);
          this.pump();
        }, delay);
        return;
      }

      job.state = "failed";
      this.listeners.failed.forEach((listener) => listener(job, err));
    }
  }

  async close(): Promise<void> {
    this.closed = true;
    const store = testState.getStore<T>(this.name);
    store.workers.delete(this);
  }
}

vi.mock("bullmq", () => ({
  Queue: MockQueue,
  Worker: MockWorker,
  UnrecoverableError: MockUnrecoverableError,
}));

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(fn: () => boolean | Promise<boolean>, timeoutMs = 3000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!(await fn())) {
    if (Date.now() > deadline) {
      throw new Error("Timed out waiting for condition");
    }
    await sleep(10);
  }
}

describe("Queue reliability", () => {
  beforeEach(() => {
    testState.reset();
    vi.clearAllMocks();
  });

  it("processes three jobs with max two concurrent workers", async () => {
    vi.resetModules();
    const { VideoQueue } = await import("@/lib/queue/queue");
    const { VideoWorker } = await import("@/lib/queue/worker");

    let active = 0;
    let maxActive = 0;
    let completed = 0;

    const worker = new VideoWorker(
      {
        concurrency: { processing: 2 },
      },
      {
        orchestrator: {
          process: vi.fn(async () => {
            active += 1;
            maxActive = Math.max(maxActive, active);
            await sleep(40);
            active -= 1;
            completed += 1;
          }),
        } as unknown as any,
      },
    );

    const queue = new VideoQueue({ retry: { maxAttempts: 3, backoffDelay: 1 } });
    await queue.enqueue({ taskId: "job-1", videoPath: "/tmp/1.mp4" });
    await queue.enqueue({ taskId: "job-2", videoPath: "/tmp/2.mp4" });
    await queue.enqueue({ taskId: "job-3", videoPath: "/tmp/3.mp4" });

    await waitFor(() => completed === 3);

    expect(maxActive).toBe(2);

    await queue.close();
    await worker.close();
  });

  it("isolates failures so one failed job does not block valid jobs", async () => {
    vi.resetModules();
    const { VideoQueue } = await import("@/lib/queue/queue");
    const { VideoWorker } = await import("@/lib/queue/worker");

    const worker = new VideoWorker(
      {
        concurrency: { processing: 2 },
        retry: { maxAttempts: 3, backoffDelay: 1 },
      },
      {
        orchestrator: {
          process: vi.fn(async (data: MockJobData) => {
            if (data.taskId === "bad-task") {
              throw new Error("Invalid video format");
            }
            await sleep(20);
          }),
        } as unknown as any,
      },
    );

    const queue = new VideoQueue({ retry: { maxAttempts: 3, backoffDelay: 1 } });
    await queue.enqueue({ taskId: "bad-task", videoPath: "/tmp/bad.mp4" });
    await queue.enqueue({ taskId: "good-task-1", videoPath: "/tmp/good-1.mp4" });
    await queue.enqueue({ taskId: "good-task-2", videoPath: "/tmp/good-2.mp4" });

    await waitFor(async () => {
      const bad = await queue.getJob("bad-task");
      const good1 = await queue.getJob("good-task-1");
      const good2 = await queue.getJob("good-task-2");
      return [bad, good1, good2].every((job) => job && ["completed", "failed"].includes(job.state));
    });

    const bad = await queue.getJob("bad-task");
    const good1 = await queue.getJob("good-task-1");
    const good2 = await queue.getJob("good-task-2");

    expect(bad?.state).toBe("failed");
    expect(bad?.attemptsMade).toBe(0);
    expect(good1?.state).toBe("completed");
    expect(good2?.state).toBe("completed");

    await queue.close();
    await worker.close();
  });

  it("uses taskId as idempotency key when enqueueing", async () => {
    vi.resetModules();
    const { VideoQueue } = await import("@/lib/queue/queue");

    const queue = new VideoQueue();
    const first = await queue.enqueue({ taskId: "same-task", videoPath: "/tmp/a.mp4" });
    const second = await queue.enqueue({ taskId: "same-task", videoPath: "/tmp/a.mp4" });

    expect(first.id).toBe("task-same-task");
    expect(second.id).toBe("task-same-task");

    await queue.close();
  });
});
