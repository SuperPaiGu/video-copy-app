import { describe, it, expect } from 'vitest';
import { VideoQueue } from './queue';
import { VideoWorker } from './worker';
import type { QueueConfig } from './types';

describe('Queue Configuration', () => {
  it('should have default retry configuration', () => {
    const queue = new VideoQueue();
    const config = queue.getConfig();
    
    expect(config.retry.maxAttempts).toBe(3);
    expect(config.retry.backoffDelay).toBe(5000);
  });

  it('should have default concurrency configuration', () => {
    const queue = new VideoQueue();
    const config = queue.getConfig();
    
    expect(config.concurrency.processing).toBe(2);
  });

  it('should have dead letter queue configuration', () => {
    const queue = new VideoQueue();
    const config = queue.getConfig();
    
    expect(config.deadLetter).toBeDefined();
    expect(config.deadLetter.queueName).toBe('video-processing-failed');
  });

  it('should allow custom configuration', () => {
    const customConfig: Partial<QueueConfig> = {
      retry: {
        maxAttempts: 5,
        backoffDelay: 10000,
      },
      concurrency: {
        processing: 4,
      },
    };

    const queue = new VideoQueue(customConfig);
    const config = queue.getConfig();
    
    expect(config.retry.maxAttempts).toBe(5);
    expect(config.retry.backoffDelay).toBe(10000);
    expect(config.concurrency.processing).toBe(4);
  });
});

describe('Worker Configuration', () => {
  it('should have default configuration', () => {
    const worker = new VideoWorker();
    const config = worker.getConfig();
    
    expect(config.retry.maxAttempts).toBe(3);
    expect(config.concurrency.processing).toBe(2);
  });

  it('should allow custom configuration', () => {
    const customConfig: Partial<QueueConfig> = {
      concurrency: {
        processing: 1,
      },
    };

    const worker = new VideoWorker(customConfig);
    const config = worker.getConfig();
    
    expect(config.concurrency.processing).toBe(1);
  });
});

// Integration tests require Redis to be running
// These tests are skipped by default and should be run manually
// when Redis is available
describe.skip('Queue Integration (requires Redis)', () => {
  it('should create and enqueue a job', async () => {
    const queue = new VideoQueue();
    const taskId = 'test-task-1';
    const videoPath = '/path/to/video.mp4';

    const job = await queue.enqueue({ taskId, videoPath });

    expect(job).toBeDefined();
    expect(job.id).toBeDefined();
    expect(job.data.taskId).toBe(taskId);
    expect(job.data.videoPath).toBe(videoPath);

    await queue.close();
  });

  it('should retrieve job by id', async () => {
    const queue = new VideoQueue();
    const taskId = 'test-task-2';
    const job = await queue.enqueue({ taskId, videoPath: '/test.mp4' });

    const retrieved = await queue.getJob(job.id!);
    expect(retrieved).toBeDefined();
    expect(retrieved?.data.taskId).toBe(taskId);

    await queue.close();
  });
});
