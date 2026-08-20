import { promises as fs } from 'fs';
import path from 'path';
import type { StorageAdapter, FileType } from './types';

/**
 * Local filesystem storage adapter
 * Organizes files by task ID and file type to prevent collisions
 * Path structure: {storageRoot}/{taskId}/{fileType}/{filename}
 */
export class LocalFileStorage implements StorageAdapter {
  constructor(private readonly storageRoot: string) {}

  /**
   * Build storage path for a file
   * @param taskId - Unique task identifier
   * @param fileType - Type of file
   * @param filename - Filename
   * @returns Full path to the file
   */
  private getFilePath(taskId: string, fileType: FileType, filename: string): string {
    return path.join(this.storageRoot, taskId, fileType, filename);
  }

  /**
   * Get directory path for a task and file type
   * @param taskId - Unique task identifier
   * @param fileType - Type of file
   * @returns Directory path
   */
  private getDirectoryPath(taskId: string, fileType: FileType): string {
    return path.join(this.storageRoot, taskId, fileType);
  }

  /**
   * Get task directory path
   * @param taskId - Unique task identifier
   * @returns Task directory path
   */
  private getTaskPath(taskId: string): string {
    return path.join(this.storageRoot, taskId);
  }

  async save(taskId: string, fileType: FileType, content: Buffer, filename: string): Promise<string> {
    const filePath = this.getFilePath(taskId, fileType, filename);
    const directory = path.dirname(filePath);

    // Ensure directory exists
    await fs.mkdir(directory, { recursive: true });

    // Write file
    await fs.writeFile(filePath, content);

    return filePath;
  }

  async read(taskId: string, fileType: FileType, filename: string): Promise<Buffer> {
    const filePath = this.getFilePath(taskId, fileType, filename);
    return await fs.readFile(filePath);
  }

  async delete(taskId: string, fileType: FileType, filename: string): Promise<void> {
    const filePath = this.getFilePath(taskId, fileType, filename);
    try {
      await fs.unlink(filePath);
    } catch (error) {
      // Ignore error if file doesn't exist
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  async list(taskId: string, fileType: FileType): Promise<string[]> {
    const directoryPath = this.getDirectoryPath(taskId, fileType);
    try {
      const files = await fs.readdir(directoryPath);
      return files;
    } catch (error) {
      // Return empty array if directory doesn't exist
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  async deleteAll(taskId: string): Promise<void> {
    const taskPath = this.getTaskPath(taskId);
    try {
      await fs.rm(taskPath, { recursive: true, force: true });
    } catch (error) {
      // Ignore error if directory doesn't exist
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }
}
