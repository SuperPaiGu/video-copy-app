export interface VideoJobData {
  taskId: string;
  videoPath: string;
}

export interface QueueConfig {
  redis: {
    host: string;
    port: number;
    password?: string;
  };
  retry: {
    maxAttempts: number;
    backoffDelay: number;
  };
  concurrency: {
    processing: number;
  };
  deadLetter: {
    enabled: boolean;
    queueName?: string;
  };
}
