# 视频文案生成器（Video Copy App）

上传视频，自动生成抖音爆款文案。基于 **Next.js 16 全栈 + GLM 多模态大模型** 构建，把「视频理解 → 文案创作」全流程自动化：上传视频后自动抽取关键帧与音频，完成语音转写，再结合画面与文字稿一次生成 **3 个不同风格的抖音文案变体**（标题 + 正文 + 话题标签）。

## ✨ 功能特性

- 📹 **批量上传**：支持 MP4 / MOV / WEBM，单文件最大 1GB，一次最多 10 个视频自动排队处理
- 🎞️ **视频理解**：ffmpeg 按时间轴抽取 3-8 张关键帧（1280px 宽）并提取 AAC 音频，全程并行处理
- 🗣️ **语音转写**：ASR 模块对音频进行语音识别，输出文字稿
- 🤖 **多模态文案生成**：GLM 视觉大模型（glm-4.1v-thinking-flash）结合「关键帧画面 + 文字稿 + 业务指令」生成文案
- 🎯 **3 变体输出**：每个视频生成 3 套「标题 + 正文 + 话题标签」，zod 严格校验结构化输出，失败自动重试
- 📊 **任务队列**：BullMQ + Redis 异步队列，任务状态实时流转（排队中 → 处理中 → 已完成 / 失败），支持并发与指数退避重试
- 💾 **本地持久化**：better-sqlite3 存储任务与批次，视频/帧/音频落盘本地存储，重启不丢数据
- 🖥️ **任务看板**：当前任务卡片 + 按批次分组的历史记录，点击展开查看文案，一键复制

## 🛠️ 技术栈

| 领域 | 技术 |
|---|---|
| 前端 | React 19、Next.js 16 (App Router)、TypeScript、Tailwind CSS、Radix UI |
| 后端 | Next.js API Routes、独立 Worker 进程（tsx/Node）、BullMQ、ioredis |
| 媒体处理 | fluent-ffmpeg、ffmpeg-static、ffprobe-static |
| AI | GLM-4.1V 多模态 API、ASR 语音识别 |
| 存储 | better-sqlite3（SQLite）、Redis（Docker Compose）、本地文件存储 |
| 工程化 | Vitest 单元测试、zod 校验、环境变量分层配置（dev/prod） |

## 📁 项目结构

```
├── src/
│   ├── app/                    # Next.js App Router 页面与 API
│   │   ├── api/upload/         # 视频上传接口（校验、落盘、入队）
│   │   ├── api/tasks/          # 任务查询接口
│   │   └── api/batches/        # 批次查询/删除接口
│   ├── components/             # UI 组件（上传区、任务卡片、文案变体…）
│   └── lib/
│       ├── media/              # ffmpeg 抽帧 + 音频提取
│       ├── asr/                # 语音转写（Whisper provider）
│       ├── glm/                # GLM 多模态文案生成 + zod 结构化输出
│       ├── queue/              # BullMQ 队列与 Worker（重试、可靠性）
│       ├── storage/            # 本地文件存储
│       └── db.ts               # better-sqlite3 持久化
├── scripts/                    # Worker 启动脚本、模型验证脚本
├── docker-compose.yml          # Redis 服务编排
└── 使用文档.md                  # 面向普通用户的完整使用指南
```

## 🚀 快速开始

### 环境要求

- Node.js ≥ 18.17（< 22）
- Docker Desktop（提供 Redis）
- GLM API Key（[智谱开放平台](https://open.bigmodel.cn/)）

### 启动

```bash
# 1. 启动 Redis
docker compose up -d

# 2. 配置环境变量
cp .env.example .env.local
# 填入 GLM_API_KEY

# 3. 安装依赖并启动
npm install
npm run dev          # 前端 + API（http://localhost:3000）

# 4. 另开终端启动任务 Worker
npm run worker
```

### 测试

```bash
npm test             # Vitest 单元测试（上传、DB、校验、队列可靠性、Provider 契约）
```

## 📄 使用指南

面向非技术用户的完整图文操作说明见 [使用文档.md](./使用文档.md)（安装 Node.js / Docker、一键启动、常见问题排查）。

## License

MIT
