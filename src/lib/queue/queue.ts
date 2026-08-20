import { Queue, Job } from 'bullmq';
import { VideoJobData, QueueConfig } from './types';

const DEFAULT_CONFIG: QueueConfig = {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
  },
  retry: {
    maxAttempts: parseInt(process.env.QUEUE_MAX_ATTEMPTS || '3', 10),
    backoffDelay: parseInt(process.env.QUEUE_BACKOFF_DELAY || '5000', 10),
  },
  concurrency: {
    processing: parseInt(process.env.QUEUE_CONCURRENCY || '2', 10),
  },
  deadLetter: {
    enabled: process.env.QUEUE_DEAD_LETTER_ENABLED === 'true',
    queueName: process.env.QUEUE_DEAD_LETTER_NAME || 'video-processing-failed',
  },
};

export class VideoQueue {
  private queue: Queue<VideoJobData>;
  private config: QueueConfig;

  constructor(config?: Partial<QueueConfig>) {
    this.config = mergeConfig(config);
    
    this.queue = new Queue<VideoJobData>('video-processing', {
      connection: this.config.redis,
      defaultJobOptions: {
        attempts: this.config.retry.maxAttempts,
        backoff: {
          type: 'exponential',
          delay: this.config.retry.backoffDelay,
        },
        removeOnComplete: {
          age: 3600, // Keep completed jobs for 1 hour
          count: 100,
        },
        removeOnFail: false, // Keep failed jobs for debugging
      },
    });
  }

  async enqueue(data: VideoJobData): Promise<Job<VideoJobData>> {
    // Add prefix to avoid BullMQ "Custom Id cannot be integers" error
    const jobId = `task-${data.taskId}`;
    
    const existing = await this.queue.getJob(jobId);
    if (existing) {
      return existing;
    }

    return this.queue.add('process-video', data, {
      jobId,
    });
  }

  async getJob(jobId: string): Promise<Job<VideoJobData> | undefined> {
    // Add prefix if not already present
    const prefixedJobId = jobId.startsWith('task-') ? jobId : `task-${jobId}`;
    return this.queue.getJob(prefixedJobId);
  }

  async close(): Promise<void> {
    await this.queue.close();
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
