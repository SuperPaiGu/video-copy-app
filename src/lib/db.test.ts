import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

// Test database path
const TEST_DB_PATH = path.join(process.cwd(), "test-video-app.db");

// Import the migration and schema functions (will be created)
import { runMigrations, getDatabase } from "../lib/db";

describe("Database Schema", () => {
  let db: Database.Database;

  beforeEach(() => {
    // Clean up test database before each test
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
    // Initialize with test database
    db = new Database(TEST_DB_PATH);
    runMigrations(db);
  });

  afterEach(() => {
    if (db) {
      db.close();
    }
    // Clean up test database after each test
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  describe("Task Table", () => {
    it("should create tasks table with required columns", () => {
      const tableInfo = db.prepare("PRAGMA table_info(tasks)").all();
      const columns = tableInfo.map((col: any) => col.name);

      expect(columns).toContain("id");
      expect(columns).toContain("status");
      expect(columns).toContain("video_path");
      expect(columns).toContain("filename");
      expect(columns).toContain("error_message");
      expect(columns).toContain("created_at");
      expect(columns).toContain("updated_at");
    });

    it("should have status enum with valid values", () => {
      // Should accept valid statuses
      const validStatuses = ["queued", "processing", "done", "failed"];

      for (const status of validStatuses) {
        const result = db
          .prepare("INSERT INTO tasks (status, filename) VALUES (?, ?)")
          .run(status, "test-video.mp4");
        expect(result.changes).toBe(1);
      }
    });

    it("should reject invalid status value", () => {
      expect(() => {
        db.prepare("INSERT INTO tasks (status, filename) VALUES (?, ?)").run(
          "unknown",
          "test.mp4"
        );
      }).toThrow();
    });

    it("should auto-generate timestamps", () => {
      const beforeInsert = Date.now();
      const result = db
        .prepare("INSERT INTO tasks (status, filename) VALUES (?, ?)")
        .run("queued", "test.mp4");
      const taskId = result.lastInsertRowid;

      const task = db.prepare("SELECT * FROM tasks WHERE id = ?").get(taskId) as any;

      expect(task.created_at).toBeDefined();
      expect(task.updated_at).toBeDefined();
      // Timestamps should be valid date strings
      expect(new Date(task.created_at).getTime()).toBeGreaterThan(0);
      expect(new Date(task.updated_at).getTime()).toBeGreaterThan(0);
    });
  });

  describe("Transcript Table", () => {
    it("should create transcripts table with required columns", () => {
      const tableInfo = db.prepare("PRAGMA table_info(transcripts)").all();
      const columns = tableInfo.map((col: any) => col.name);

      expect(columns).toContain("id");
      expect(columns).toContain("task_id");
      expect(columns).toContain("text");
      expect(columns).toContain("created_at");
    });

    it("should have foreign key to tasks", () => {
      // Insert a task first
      const taskResult = db
        .prepare("INSERT INTO tasks (status, filename) VALUES (?, ?)")
        .run("queued", "test.mp4");
      const taskId = taskResult.lastInsertRowid;

      // Insert transcript linked to task
      const transcriptResult = db
        .prepare("INSERT INTO transcripts (task_id, text) VALUES (?, ?)")
        .run(taskId, "This is a test transcript");
      expect(transcriptResult.changes).toBe(1);
    });

    it("should allow null text for videos without audio", () => {
      const taskResult = db
        .prepare("INSERT INTO tasks (status, filename) VALUES (?, ?)")
        .run("queued", "silent-video.mp4");
      const taskId = taskResult.lastInsertRowid;

      const result = db
        .prepare("INSERT INTO transcripts (task_id, text) VALUES (?, ?)")
        .run(taskId, null);
      expect(result.changes).toBe(1);
    });
  });

  describe("Results Table", () => {
    it("should create results table with required columns", () => {
      const tableInfo = db.prepare("PRAGMA table_info(results)").all();
      const columns = tableInfo.map((col: any) => col.name);

      expect(columns).toContain("id");
      expect(columns).toContain("task_id");
      expect(columns).toContain("variants");
      expect(columns).toContain("created_at");
    });

    it("should store 3 variants of title/copy/hashtags", () => {
      // Insert a task first
      const taskResult = db
        .prepare("INSERT INTO tasks (status, filename) VALUES (?, ?)")
        .run("done", "test.mp4");
      const taskId = taskResult.lastInsertRowid;

      // Insert results with 3 variants
      const variants = JSON.stringify([
        {
          title: "Title 1",
          copy: "Copy 1",
          hashtags: ["#tag1", "#tag2"],
        },
        {
          title: "Title 2",
          copy: "Copy 2",
          hashtags: ["#tag3", "#tag4"],
        },
        {
          title: "Title 3",
          copy: "Copy 3",
          hashtags: ["#tag5", "#tag6"],
        },
      ]);

      const result = db
        .prepare("INSERT INTO results (task_id, variants) VALUES (?, ?)")
        .run(taskId, variants);
      expect(result.changes).toBe(1);

      // Verify the stored data
      const savedResult = db
        .prepare("SELECT * FROM results WHERE task_id = ?")
        .get(taskId) as any;
      const parsed = JSON.parse(savedResult.variants);

      expect(parsed).toHaveLength(3);
      expect(parsed[0]).toHaveProperty("title");
      expect(parsed[0]).toHaveProperty("copy");
      expect(parsed[0]).toHaveProperty("hashtags");
    });

    it("should have foreign key to tasks", () => {
      const taskResult = db
        .prepare("INSERT INTO tasks (status, filename) VALUES (?, ?)")
        .run("done", "test.mp4");
      const taskId = taskResult.lastInsertRowid;

      const result = db
        .prepare("INSERT INTO results (task_id, variants) VALUES (?, ?)")
        .run(taskId, JSON.stringify([]));
      expect(result.changes).toBe(1);
    });
  });
});

describe("Task Status Enum", () => {
  let db: Database.Database;

  beforeEach(() => {
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
    db = new Database(TEST_DB_PATH);
    runMigrations(db);
  });

  afterEach(() => {
    if (db) {
      db.close();
    }
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  const validStatuses = ["queued", "processing", "done", "failed"];

  validStatuses.forEach((status) => {
    it(`should accept status: ${status}`, () => {
      const result = db
        .prepare("INSERT INTO tasks (status, filename) VALUES (?, ?)")
        .run(status, "test.mp4");
      expect(result.changes).toBe(1);
    });
  });
});
