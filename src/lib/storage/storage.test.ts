import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { LocalFileStorage } from './local-file-storage';
import type { StorageAdapter, FileType } from './types';

describe('StorageAdapter', () => {
  let storage: StorageAdapter;
  const testStorageRoot = path.join(process.cwd(), '.test-storage');

  beforeEach(async () => {
    storage = new LocalFileStorage(testStorageRoot);
    await fs.mkdir(testStorageRoot, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(testStorageRoot, { recursive: true, force: true });
  });

  describe('save', () => {
    it('should save video file by task ID', async () => {
      const taskId = 'task-001';
      const fileType: FileType = 'video';
      const content = Buffer.from('fake video content');

      const filePath = await storage.save(taskId, fileType, content, 'test.mp4');

      expect(filePath).toBeTruthy();
      const exists = await fs.access(filePath).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });

    it('should save frame image by task ID', async () => {
      const taskId = 'task-002';
      const fileType: FileType = 'frame';
      const content = Buffer.from('fake image content');

      const filePath = await storage.save(taskId, fileType, content, 'frame-001.jpg');

      expect(filePath).toBeTruthy();
      const savedContent = await fs.readFile(filePath);
      expect(savedContent.toString()).toBe('fake image content');
    });

    it('should save transcript text by task ID', async () => {
      const taskId = 'task-003';
      const fileType: FileType = 'transcript';
      const content = Buffer.from('This is a transcript');

      const filePath = await storage.save(taskId, fileType, content, 'transcript.txt');

      expect(filePath).toBeTruthy();
      const savedContent = await fs.readFile(filePath, 'utf-8');
      expect(savedContent).toBe('This is a transcript');
    });

    it('should save audio file by task ID', async () => {
      const taskId = 'task-004';
      const fileType: FileType = 'audio';
      const content = Buffer.from('fake audio content');

      const filePath = await storage.save(taskId, fileType, content, 'audio.mp3');

      expect(filePath).toBeTruthy();
      const exists = await fs.access(filePath).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });

    it('should save evidence file by task ID', async () => {
      const taskId = 'task-005';
      const fileType: FileType = 'evidence';
      const content = Buffer.from('test evidence data');

      const filePath = await storage.save(taskId, fileType, content, 'result.json');

      expect(filePath).toBeTruthy();
      const savedContent = await fs.readFile(filePath, 'utf-8');
      expect(savedContent).toBe('test evidence data');
    });
  });

  describe('read', () => {
    it('should read saved file by task ID and file type', async () => {
      const taskId = 'task-006';
      const fileType: FileType = 'video';
      const content = Buffer.from('video data to read');

      await storage.save(taskId, fileType, content, 'video.mp4');
      const readContent = await storage.read(taskId, fileType, 'video.mp4');

      expect(readContent.toString()).toBe('video data to read');
    });

    it('should throw error when reading non-existent file', async () => {
      const taskId = 'task-nonexistent';
      const fileType: FileType = 'video';

      await expect(storage.read(taskId, fileType, 'missing.mp4')).rejects.toThrow();
    });
  });

  describe('delete', () => {
    it('should delete file by task ID and file type', async () => {
      const taskId = 'task-007';
      const fileType: FileType = 'video';
      const content = Buffer.from('video to delete');

      const filePath = await storage.save(taskId, fileType, content, 'delete-me.mp4');
      await storage.delete(taskId, fileType, 'delete-me.mp4');

      const exists = await fs.access(filePath).then(() => true).catch(() => false);
      expect(exists).toBe(false);
    });

    it('should not throw when deleting non-existent file', async () => {
      const taskId = 'task-008';
      const fileType: FileType = 'video';

      await expect(storage.delete(taskId, fileType, 'nonexistent.mp4')).resolves.not.toThrow();
    });
  });

  describe('list', () => {
    it('should list all files for a task ID and file type', async () => {
      const taskId = 'task-009';
      const fileType: FileType = 'frame';

      await storage.save(taskId, fileType, Buffer.from('frame1'), 'frame-001.jpg');
      await storage.save(taskId, fileType, Buffer.from('frame2'), 'frame-002.jpg');
      await storage.save(taskId, fileType, Buffer.from('frame3'), 'frame-003.jpg');

      const files = await storage.list(taskId, fileType);

      expect(files).toHaveLength(3);
      expect(files).toContain('frame-001.jpg');
      expect(files).toContain('frame-002.jpg');
      expect(files).toContain('frame-003.jpg');
    });

    it('should return empty array when no files exist', async () => {
      const taskId = 'task-010';
      const fileType: FileType = 'frame';

      const files = await storage.list(taskId, fileType);

      expect(files).toEqual([]);
    });
  });

  describe('path isolation', () => {
    it('should prevent path collision between different task IDs', async () => {
      const taskId1 = 'task-011';
      const taskId2 = 'task-012';
      const fileType: FileType = 'video';
      const filename = 'same-name.mp4';

      const path1 = await storage.save(taskId1, fileType, Buffer.from('content1'), filename);
      const path2 = await storage.save(taskId2, fileType, Buffer.from('content2'), filename);

      expect(path1).not.toBe(path2);

      const content1 = await storage.read(taskId1, fileType, filename);
      const content2 = await storage.read(taskId2, fileType, filename);

      expect(content1.toString()).toBe('content1');
      expect(content2.toString()).toBe('content2');
    });

    it('should prevent path collision between different file types', async () => {
      const taskId = 'task-013';
      const filename = 'data.txt';

      const path1 = await storage.save(taskId, 'transcript', Buffer.from('transcript'), filename);
      const path2 = await storage.save(taskId, 'evidence', Buffer.from('evidence'), filename);

      expect(path1).not.toBe(path2);

      const content1 = await storage.read(taskId, 'transcript', filename);
      const content2 = await storage.read(taskId, 'evidence', filename);

      expect(content1.toString()).toBe('transcript');
      expect(content2.toString()).toBe('evidence');
    });
  });

  describe('deleteAll', () => {
    it('should delete all files for a task ID', async () => {
      const taskId = 'task-014';

      await storage.save(taskId, 'video', Buffer.from('video'), 'video.mp4');
      await storage.save(taskId, 'frame', Buffer.from('frame1'), 'frame-001.jpg');
      await storage.save(taskId, 'frame', Buffer.from('frame2'), 'frame-002.jpg');
      await storage.save(taskId, 'transcript', Buffer.from('text'), 'transcript.txt');

      await storage.deleteAll(taskId);

      const videoFiles = await storage.list(taskId, 'video');
      const frameFiles = await storage.list(taskId, 'frame');
      const transcriptFiles = await storage.list(taskId, 'transcript');

      expect(videoFiles).toEqual([]);
      expect(frameFiles).toEqual([]);
      expect(transcriptFiles).toEqual([]);
    });
  });
});
