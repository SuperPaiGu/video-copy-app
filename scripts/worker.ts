/**
 * Worker 启动脚本
 * 
 * 使用方式: npm run worker
 * 
 * 功能:
 * - 初始化 Redis 连接
 * - 启动 Worker 监听视频处理队列
 * - 处理优雅关闭 (SIGTERM/SIGINT)
 * - 错误日志记录
 */

import { config as loadEnv } from "dotenv";
import { VideoWorker, VideoPipelineOrchestrator } from "@/lib/queue";

// 加载 .env.local 文件（优先级高于 .env）
loadEnv({ path: ".env.local" });

const logger = {
  info: (message: string) => console.log(`[Worker] ${new Date().toISOString()} INFO: ${message}`),
  error: (message: string) => console.error(`[Worker] ${new Date().toISOString()} ERROR: ${message}`),
};

async function main(): Promise<void> {
  logger.info("Starting Video Worker...");
  
  // 验证环境变量
  if (!process.env.GLM_API_KEY) {
    logger.error("FATAL: GLM_API_KEY not found in environment!");
    logger.error("Please ensure .env file exists with GLM_API_KEY=your-key");
    process.exit(1);
  }

  // 从环境变量读取配置
  const config = {
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
  };

  logger.info(`Redis: ${config.redis.host}:${config.redis.port}`);
  logger.info(`Concurrency: ${config.concurrency.processing}`);

  // 创建 Worker 实例
  const worker = new VideoWorker(config, {
    logger,
    orchestrator: new VideoPipelineOrchestrator({ logger }),
  });

  logger.info("Worker initialized, waiting for jobs...");

  // 优雅关闭处理
  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`Received ${signal}, shutting down gracefully...`);
    
    try {
      await worker.close();
      logger.info("Worker closed successfully");
      process.exit(0);
    } catch (error) {
      logger.error(`Error during shutdown: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  // 未捕获的异常处理
  process.on("uncaughtException", (error) => {
    logger.error(`Uncaught exception: ${error.message}`);
    process.exit(1);
  });

  process.on("unhandledRejection", (reason) => {
    logger.error(`Unhandled rejection: ${reason}`);
    process.exit(1);
  });
}

main().catch((error) => {
  logger.error(`Failed to start worker: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
