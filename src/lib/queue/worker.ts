import { promises as fs } from "node:fs";
import path from "node:path";
import { Job, UnrecoverableError, Worker } from "bullmq";

import { transcribeAudio } from "@/lib/asr";
import type { AsrProvider } from "@/lib/asr";
import {
  resultRepository,
  taskRepository,
  transcriptRepository,
  type ResultVariant,
  type TaskStatus,
} from "@/lib/db";
import { GLMProvider, GLMProviderError, type FrameImageInput } from "@/lib/glm/provider";
import type { CopyGenerationResult } from "@/lib/glm/schema";
import { extractMediaAssets } from "@/lib/media/extractor";

import { QueueConfig, VideoJobData } from "./types";

const DEFAULT_CONFIG: QueueConfig = {
  redis: {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379", 10),
    password: process.env.REDIS_PASSWORD,
  },
  retry: {
    maxAttempts: parseInt(process.env.QUEUE_MAX_ATTEMPTS || "3", 10),
    backoffDelay: parseInt(process.env.QUEUE_BACKOFF_DELAY || "5000", 10),
  },
  concurrency: {
    processing: parseInt(process.env.QUEUE_CONCURRENCY || "2", 10),
  },
  deadLetter: {
    enabled: process.env.QUEUE_DEAD_LETTER_ENABLED === "true",
    queueName: process.env.QUEUE_DEAD_LETTER_NAME || "video-processing-failed",
  },
};

const DEFAULT_GENERATION_PROMPT = "输出 3 条可直接发布的抖音文案，突出关键信息与行动引导。";

interface WorkerLogger {
  info(message: string): void;
  error(message: string): void;
}

type TaskRepo = Pick<typeof taskRepository, "updateStatus">;
type TranscriptRepo = Pick<typeof transcriptRepository, "findByTaskId" | "create" | "update">;
type ResultRepo = Pick<typeof resultRepository, "findByTaskId" | "create" | "update">;

interface OrchestratorDeps {
  extractMediaAssetsFn?: typeof extractMediaAssets;
  transcribeAudioFn?: typeof transcribeAudio;
  glmProvider?: Pick<GLMProvider, "generate">;
  asrProvider?: AsrProvider;
  taskRepo?: TaskRepo;
  transcriptRepo?: TranscriptRepo;
  resultRepo?: ResultRepo;
  readFileFn?: typeof fs.readFile;
  logger?: WorkerLogger;
  generationPrompt?: string;
  createGlmProvider?: () => Pick<GLMProvider, "generate">;
}

export interface JobExecutionContext {
  attemptsMade: number;
  maxAttempts: number;
  jobId?: string | number | null;
}

export class VideoPipelineOrchestrator {
  private readonly extractMediaAssetsFn: typeof extractMediaAssets;
  private readonly transcribeAudioFn: typeof transcribeAudio;
  private glmProvider?: Pick<GLMProvider, "generate">;
  private readonly createGlmProvider: () => Pick<GLMProvider, "generate">;
  private readonly asrProvider?: AsrProvider;
  private readonly taskRepo: TaskRepo;
  private readonly transcriptRepo: TranscriptRepo;
  private readonly resultRepo: ResultRepo;
  private readonly readFileFn: typeof fs.readFile;
  private readonly logger: WorkerLogger;
  private readonly generationPrompt: string;

  constructor(deps: OrchestratorDeps = {}) {
    this.extractMediaAssetsFn = deps.extractMediaAssetsFn ?? extractMediaAssets;
    this.transcribeAudioFn = deps.transcribeAudioFn ?? transcribeAudio;
    this.glmProvider = deps.glmProvider;
    this.createGlmProvider = deps.createGlmProvider ?? (() => new GLMProvider());
    this.asrProvider = deps.asrProvider;
    this.taskRepo = deps.taskRepo ?? taskRepository;
    this.transcriptRepo = deps.transcriptRepo ?? transcriptRepository;
    this.resultRepo = deps.resultRepo ?? resultRepository;
    this.readFileFn = deps.readFileFn ?? fs.readFile;
    this.logger = deps.logger ?? console;
    this.generationPrompt = deps.generationPrompt ?? DEFAULT_GENERATION_PROMPT;
  }

  async process(data: VideoJobData, context: JobExecutionContext): Promise<void> {
    const taskId = parseTaskId(data.taskId);
    await this.taskRepo.updateStatus(taskId, "processing");

    try {
      await this.readFileFn(data.videoPath);

      const { frameOutputDir, audioOutputPath } = buildExtractionPaths(data.videoPath);
      const media = await this.extractMediaAssetsFn(
        data.videoPath,
        frameOutputDir,
        audioOutputPath,
      );

      const transcript = await this.transcribeAudioFn(media.audioPath, this.asrProvider);
      await this.upsertTranscript(taskId, transcript);

      const frames = await Promise.all(media.framePaths.map((framePath) => toFrameInput(framePath, this.readFileFn)));
      const glmProvider = this.getGlmProvider();
      const generated = await glmProvider.generate(
        frames,
        transcript ?? "",
        this.generationPrompt,
      );

      await this.persistResults(taskId, generated);
      await this.taskRepo.updateStatus(taskId, "done");
    } catch (error) {
      const errorMessage = toErrorMessage(error);
      const shouldRetry = isRetryableError(error);
      const finalState = shouldRetry && !isFinalAttempt(context) ? "queued" : "failed";
      await this.taskRepo.updateStatus(taskId, finalState, errorMessage);

      this.logger.error(
        `job=${String(context.jobId ?? data.taskId)} task=${data.taskId} status=${finalState} error=${errorMessage}`,
      );

      if (error instanceof Error) {
        throw error;
      }
      throw new Error(errorMessage);
    }
  }

  private async upsertTranscript(taskId: number, transcript: string | null): Promise<void> {
    const existing = this.transcriptRepo.findByTaskId(taskId);
    if (existing) {
      this.transcriptRepo.update(taskId, transcript);
      return;
    }

    this.transcriptRepo.create(taskId, transcript);
  }

  private getGlmProvider(): Pick<GLMProvider, "generate"> {
    if (!this.glmProvider) {
      this.glmProvider = this.createGlmProvider();
    }
    return this.glmProvider;
  }

  private async persistResults(taskId: number, generated: CopyGenerationResult): Promise<void> {
    const existing = this.resultRepo.findByTaskId(taskId);
    if (existing) {
      this.resultRepo.update(taskId, generated.variants as ResultVariant[]);
      return;
    }

    this.resultRepo.create(taskId, generated.variants as ResultVariant[]);
  }
}

interface VideoWorkerOptions {
  orchestrator?: VideoPipelineOrchestrator;
  logger?: WorkerLogger;
  autoStart?: boolean;
}

export class VideoWorker {
  private worker?: Worker<VideoJobData>;
  private config: QueueConfig;
  private orchestrator: VideoPipelineOrchestrator;
  private logger: WorkerLogger;

  constructor(config?: Partial<QueueConfig>, options: VideoWorkerOptions = {}) {
    this.config = mergeConfig(config);
    this.logger = options.logger ?? console;
    this.orchestrator =
      options.orchestrator ??
      new VideoPipelineOrchestrator({
        logger: this.logger,
      });

    if (options.autoStart === false) {
      return;
    }

    this.worker = new Worker<VideoJobData>(
      "video-processing",
      async (job: Job<VideoJobData>) => {
        return this.processJob(job);
      },
      {
        connection: this.config.redis,
        concurrency: this.config.concurrency.processing,
      }
    );

    this.worker.on("completed", (job) => {
      this.logger.info(`job=${String(job.id)} completed`);
    });

    this.worker.on("failed", (job, err) => {
      this.logger.error(`job=${String(job?.id)} failed: ${err.message}`);

      // Handle dead letter queue if enabled
      if (this.config.deadLetter.enabled && job?.attemptsMade === this.config.retry.maxAttempts) {
        this.handleDeadLetter(job);
      }
    });

    this.worker.on("error", (err) => {
      this.logger.error(`worker error: ${toErrorMessage(err)}`);
    });
  }

  private async processJob(job: Job<VideoJobData>): Promise<void> {
    try {
      await this.orchestrator.process(job.data, {
        attemptsMade: job.attemptsMade,
        maxAttempts: job.opts.attempts ?? this.config.retry.maxAttempts,
        jobId: job.id,
      });
    } catch (error) {
      if (!isRetryableError(error)) {
        throw new UnrecoverableError(toErrorMessage(error));
      }
      throw error;
    }
  }

  private async handleDeadLetter(job: Job<VideoJobData>): Promise<void> {
    this.logger.info(`job=${String(job.id)} moved to dead letter queue=${this.config.deadLetter.queueName}`);
    // TODO: Implement dead letter queue logic when needed
  }

  async close(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
    }
  }

  getConfig(): QueueConfig {
    return this.config;
  }
}

function mergeConfig(config?: Partial<QueueConfig>): QueueConfig {
  return {
    ...DEFAULT_CONFIG,
    ...config,
    redis: {
      ...DEFAULT_CONFIG.redis,
      ...config?.redis,
    },
    retry: {
      ...DEFAULT_CONFIG.retry,
      ...config?.retry,
    },
    concurrency: {
      ...DEFAULT_CONFIG.concurrency,
      ...config?.concurrency,
    },
    deadLetter: {
      ...DEFAULT_CONFIG.deadLetter,
      ...config?.deadLetter,
    },
  };
}

function parseTaskId(taskId: string): number {
  const parsed = Number(taskId);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid task id: ${taskId}`);
  }
  return parsed;
}

function buildExtractionPaths(videoPath: string): { frameOutputDir: string; audioOutputPath: string } {
  const videoDir = path.dirname(videoPath);
  const taskDir = path.dirname(videoDir);

  return {
    frameOutputDir: path.join(taskDir, "frames"),
    audioOutputPath: path.join(taskDir, "audio", "extracted.m4a"),
  };
}

async function toFrameInput(
  framePath: string,
  readFileFn: typeof fs.readFile,
): Promise<FrameImageInput> {
  const frameData = await readFileFn(framePath);
  return {
    mimeType: detectImageMimeType(framePath),
    data: frameData,
  };
}

function detectImageMimeType(framePath: string): string {
  const ext = path.extname(framePath).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") {
    return "image/jpeg";
  }
  if (ext === ".png") {
    return "image/png";
  }
  if (ext === ".webp") {
    return "image/webp";
  }
  return "application/octet-stream";
}

function isFinalAttempt(context: JobExecutionContext): boolean {
  return context.attemptsMade + 1 >= context.maxAttempts;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "Unknown worker pipeline error";
}

function isRetryableError(error: unknown): boolean {
  const message = toErrorMessage(error).toLowerCase();

  if (
    message.includes("econnreset") ||
    message.includes("econnrefused") ||
    message.includes("etimedout") ||
    message.includes("network") ||
    message.includes("fetch failed") ||
    message.includes("temporary") ||
    message.includes("too many requests")
  ) {
    return true;
  }

  if (error instanceof GLMProviderError) {
    const statusMatch = message.match(/status\s+(\d{3})/i);
    if (!statusMatch) {
      return false;
    }

    const statusCode = Number(statusMatch[1]);
    if (statusCode === 429) {
      return true;
    }

    return statusCode >= 500;
  }

  return false;
}
