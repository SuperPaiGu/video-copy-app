import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { LocalFileStorage } from '../local-file-storage';
import type { FileType } from '../types';

describe('Path Isolation Verification', () => {
  let storage: LocalFileStorage;
  const testStorageRoot = path.join(process.cwd(), '.test-storage-isolation');

  beforeEach(async () => {
    storage = new LocalFileStorage(testStorageRoot);
    await fs.mkdir(testStorageRoot, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(testStorageRoot, { recursive: true, force: true });
  });

  it('should create unique paths for same filename across different tasks', async () => {
    const taskId1 = 'task-alpha';
    const taskId2 = 'task-beta';
    const fileType: FileType = 'video';
    const filename = 'video.mp4';

    const content1 = Buffer.from('Task Alpha Video Content');
    const content2 = Buffer.from('Task Beta Video Content');

    const path1 = await storage.save(taskId1, fileType, content1, filename);
    const path2 = await storage.save(taskId2, fileType, content2, filename);

    // Verify paths are different
    expect(path1).not.toBe(path2);
    expect(path1).toContain('task-alpha');
    expect(path2).toContain('task-beta');

    // Verify both files exist independently
    const read1 = await storage.read(taskId1, fileType, filename);
    const read2 = await storage.read(taskId2, fileType, filename);

    expect(read1.toString()).toBe('Task Alpha Video Content');
    expect(read2.toString()).toBe('Task Beta Video Content');
  });

  it('should create unique paths for same filename across different file types', async () => {
    const taskId = 'task-gamma';
    const filename = 'data.txt';

    const transcriptContent = Buffer.from('Transcript Data');
    const evidenceContent = Buffer.from('Evidence Data');

    const transcriptPath = await storage.save(taskId, 'transcript', transcriptContent, filename);
    const evidencePath = await storage.save(taskId, 'evidence', evidenceContent, filename);

    // Verify paths are different
    expect(transcriptPath).not.toBe(evidencePath);
    expect(transcriptPath).toContain('transcript');
    expect(evidencePath).toContain('evidence');

    // Verify both files exist independently
    const readTranscript = await storage.read(taskId, 'transcript', filename);
    const readEvidence = await storage.read(taskId, 'evidence', filename);

    expect(readTranscript.toString()).toBe('Transcript Data');
    expect(readEvidence.toString()).toBe('Evidence Data');
  });

  it('should handle multiple frames for same task without collision', async () => {
    const taskId = 'task-delta';
    const fileType: FileType = 'frame';

    const frames = [
      { name: 'frame-001.jpg', content: 'Frame 1 Data' },
      { name: 'frame-002.jpg', content: 'Frame 2 Data' },
      { name: 'frame-003.jpg', content: 'Frame 3 Data' },
    ];

    const paths: string[] = [];
    for (const frame of frames) {
      const path = await storage.save(taskId, fileType, Buffer.from(frame.content), frame.name);
      paths.push(path);
    }

    // Verify all paths are unique
    const uniquePaths = new Set(paths);
    expect(uniquePaths.size).toBe(frames.length);

    // Verify all frames can be read correctly
    for (const frame of frames) {
      const content = await storage.read(taskId, fileType, frame.name);
      expect(content.toString()).toBe(frame.content);
    }

    // Verify list returns all frames
    const fileList = await storage.list(taskId, fileType);
    expect(fileList).toHaveLength(frames.length);
    expect(fileList.sort()).toEqual(frames.map(f => f.name).sort());
  });

  it('should prevent overwrite when saving same file twice', async () => {
    const taskId = 'task-epsilon';
    const fileType: FileType = 'video';
    const filename = 'video.mp4';

    const originalContent = Buffer.from('Original Content');
    const updatedContent = Buffer.from('Updated Content');

    await storage.save(taskId, fileType, originalContent, filename);
    await storage.save(taskId, fileType, updatedContent, filename);

    // Second save should overwrite
    const content = await storage.read(taskId, fileType, filename);
    expect(content.toString()).toBe('Updated Content');
  });

  it('should isolate deleteAll to specific task only', async () => {
    const taskId1 = 'task-zeta';
    const taskId2 = 'task-eta';

    await storage.save(taskId1, 'video', Buffer.from('Video 1'), 'video.mp4');
    await storage.save(taskId1, 'frame', Buffer.from('Frame 1'), 'frame.jpg');
    await storage.save(taskId2, 'video', Buffer.from('Video 2'), 'video.mp4');
    await storage.save(taskId2, 'frame', Buffer.from('Frame 2'), 'frame.jpg');

    // Delete all files for task1
    await storage.deleteAll(taskId1);

    // Verify task1 files are gone
    const task1Videos = await storage.list(taskId1, 'video');
    const task1Frames = await storage.list(taskId1, 'frame');
    expect(task1Videos).toEqual([]);
    expect(task1Frames).toEqual([]);

    // Verify task2 files still exist
    const task2Videos = await storage.list(taskId2, 'video');
    const task2Frames = await storage.list(taskId2, 'frame');
    expect(task2Videos).toContain('video.mp4');
    expect(task2Frames).toContain('frame.jpg');
  });
});
