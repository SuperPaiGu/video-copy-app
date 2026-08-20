# Queue System

## Overview

This directory contains the BullMQ-based queue system for video processing tasks.

## Components

- `queue.ts` - Queue management for creating and tracking jobs
- `worker.ts` - Worker process that consumes and processes jobs
- `types.ts` - TypeScript interfaces for job data and configuration

## Configuration

The queue system supports the following configuration options:

### Retry Configuration
- `maxAttempts` (default: 3) - Maximum number of retry attempts for failed jobs
- `backoffDelay` (default: 5000ms) - Exponential backoff delay between retries

### Concurrency Configuration
- `processing` (default: 2) - Number of concurrent jobs the worker can process

### Dead Letter Queue
- `enabled` (default: false) - Enable dead letter queue for permanently failed jobs
- `queueName` (default: 'video-processing-failed') - Name of the dead letter queue

## Environment Variables

```bash
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

QUEUE_MAX_ATTEMPTS=3
QUEUE_BACKOFF_DELAY=5000
QUEUE_CONCURRENCY=2
QUEUE_DEAD_LETTER_ENABLED=false
QUEUE_DEAD_LETTER_NAME=video-processing-failed
```

## Dependencies

### Redis

The queue system requires Redis to be running. Install and start Redis:

**Windows:**
```bash
# Using Chocolatey
choco install redis-64

# Or download from https://github.com/microsoftarchive/redis/releases
# Start Redis
redis-server
```

**macOS:**
```bash
brew install redis
brew services start redis
```

**Linux:**
```bash
sudo apt-get install redis-server
sudo systemctl start redis
```

## Testing

Unit tests for configuration are included and run without Redis.

Integration tests that require Redis are skipped by default. To run them:

1. Start Redis locally
2. Run tests with the integration flag:
```bash
npm test -- --run src/lib/queue/queue.test.ts
```

## Usage

### Creating a Queue

```typescript
import { VideoQueue } from './queue';

const queue = new VideoQueue();

// Or with custom config
const queue = new VideoQueue({
  retry: { maxAttempts: 5, backoffDelay: 10000 },
  concurrency: { processing: 4 }
});
```

### Enqueuing Jobs

```typescript
const job = await queue.enqueue({
  taskId: 'task-123',
  videoPath: '/path/to/video.mp4'
});
```

### Starting a Worker

```typescript
import { VideoWorker } from './worker';

const worker = new VideoWorker();
// Worker automatically starts consuming jobs
```

## Architecture Notes

- Queue and Worker are separate classes to support distributed deployment
- Worker includes skeleton processing logic (to be connected in Task 11)
- Retry logic uses exponential backoff
- Failed jobs are logged and can be moved to dead letter queue
- Concurrency limits prevent resource exhaustion
