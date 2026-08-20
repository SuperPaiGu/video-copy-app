import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";

// Database path configuration
const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), "video-app.db");

let dbInstance: Database.Database | null = null;

export type TaskStatus = "queued" | "processing" | "done" | "failed";

export interface Task {
  id: number;
  status: TaskStatus;
  video_path: string | null;
  filename: string;
  error_message: string | null;
  batch_id: string;
  created_at: string;
  updated_at: string;
}

export interface Transcript {
  id: number;
  task_id: number;
  text: string | null;
  created_at: string;
}

export interface ResultVariant {
  title: string;
  copy: string;
  hashtags: string[];
}

export interface Result {
  id: number;
  task_id: number;
  variants: ResultVariant[];
  created_at: string;
}

// Run migrations to create tables
export function runMigrations(db: Database.Database): void {
  // Create tasks table with status enum
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      status TEXT NOT NULL CHECK(status IN ('queued', 'processing', 'done', 'failed')),
      video_path TEXT,
      filename TEXT NOT NULL,
      error_message TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Create transcripts table
  db.exec(`
    CREATE TABLE IF NOT EXISTS transcripts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      text TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    )
  `);

  // Create results table with 3-variant JSON structure
  db.exec(`
    CREATE TABLE IF NOT EXISTS results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL UNIQUE,
      variants TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    )
  `);

  // Create indexes for performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_transcripts_task_id ON transcripts(task_id);
    CREATE INDEX IF NOT EXISTS idx_results_task_id ON results(task_id);
  `);

  // Migration: Add batch_id column if it doesn't exist
  const tableInfo = db.prepare("PRAGMA table_info(tasks)").all() as Array<{ name: string }>;
  const hasBatchId = tableInfo.some((col) => col.name === "batch_id");
  
  if (!hasBatchId) {
    db.exec(`
      ALTER TABLE tasks ADD COLUMN batch_id TEXT;
      UPDATE tasks SET batch_id = 'legacy' WHERE batch_id IS NULL;
      CREATE INDEX IF NOT EXISTS idx_tasks_batch_id ON tasks(batch_id);
    `);
  }
}

// Get or create database instance
export function getDatabase(): Database.Database {
  if (!dbInstance) {
    const dbDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    dbInstance = new Database(DB_PATH);
    runMigrations(dbInstance);
  }
  return dbInstance;
}

// Close database connection
export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

// Task repository functions
export const taskRepository = {
  create(filename: string, videoPath?: string, batchId?: string): Task {
    const db = getDatabase();
    const finalBatchId = batchId || randomUUID();
    const result = db
      .prepare(
        "INSERT INTO tasks (status, filename, video_path, batch_id) VALUES (?, ?, ?, ?)"
      )
      .run("queued", filename, videoPath || null, finalBatchId);
    return db
      .prepare("SELECT * FROM tasks WHERE id = ?")
      .get(result.lastInsertRowid) as Task;
  },

  findById(id: number): Task | undefined {
    const db = getDatabase();
    return db.prepare("SELECT * FROM tasks WHERE id = ?").get(id) as
      | Task
      | undefined;
  },

  findAll(): Task[] {
    const db = getDatabase();
    return db.prepare("SELECT * FROM tasks ORDER BY created_at DESC").all() as Task[];
  },

  findByStatus(status: TaskStatus): Task[] {
    const db = getDatabase();
    return db
      .prepare("SELECT * FROM tasks WHERE status = ? ORDER BY created_at DESC")
      .all(status) as Task[];
  },

  updateStatus(
    id: number,
    status: TaskStatus,
    errorMessage?: string
  ): Task | undefined {
    const db = getDatabase();
    db.prepare(
      "UPDATE tasks SET status = ?, error_message = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(status, errorMessage || null, id);
    return db.prepare("SELECT * FROM tasks WHERE id = ?").get(id) as
      | Task
      | undefined;
  },

  delete(id: number): boolean {
    const db = getDatabase();
    const result = db.prepare("DELETE FROM tasks WHERE id = ?").run(id);
    return result.changes > 0;
  },
};

// Transcript repository functions
export const transcriptRepository = {
  create(taskId: number, text: string | null): Transcript {
    const db = getDatabase();
    const result = db
      .prepare("INSERT INTO transcripts (task_id, text) VALUES (?, ?)")
      .run(taskId, text);
    return db
      .prepare("SELECT * FROM transcripts WHERE id = ?")
      .get(result.lastInsertRowid) as Transcript;
  },

  findByTaskId(taskId: number): Transcript | undefined {
    const db = getDatabase();
    return db
      .prepare("SELECT * FROM transcripts WHERE task_id = ?")
      .get(taskId) as Transcript | undefined;
  },

  update(taskId: number, text: string | null): Transcript | undefined {
    const db = getDatabase();
    db.prepare(
      "UPDATE transcripts SET text = ? WHERE task_id = ?"
    ).run(text, taskId);
    return db
      .prepare("SELECT * FROM transcripts WHERE task_id = ?")
      .get(taskId) as Transcript | undefined;
  },
};

// Result repository functions
export const resultRepository = {
  create(taskId: number, variants: ResultVariant[]): Result {
    const db = getDatabase();
    const result = db
      .prepare("INSERT INTO results (task_id, variants) VALUES (?, ?)")
      .run(taskId, JSON.stringify(variants));
    return db
      .prepare("SELECT * FROM results WHERE id = ?")
      .get(result.lastInsertRowid) as Result;
  },

  findByTaskId(taskId: number): Result | undefined {
    const db = getDatabase();
    const row = db.prepare("SELECT * FROM results WHERE task_id = ?").get(
      taskId
    ) as any;
    if (!row) return undefined;
    return {
      ...row,
      variants: JSON.parse(row.variants) as ResultVariant[],
    } as Result;
  },

  update(taskId: number, variants: ResultVariant[]): Result | undefined {
    const db = getDatabase();
    db.prepare("UPDATE results SET variants = ? WHERE task_id = ?").run(
      JSON.stringify(variants),
      taskId
    );
    const row = db.prepare("SELECT * FROM results WHERE task_id = ?").get(
      taskId
    ) as any;
    if (!row) return undefined;
    return {
      ...row,
      variants: JSON.parse(row.variants) as ResultVariant[],
    } as Result;
  },
};
