/**
 * File types supported by the storage system
 */
export type FileType = 'video' | 'frame' | 'audio' | 'transcript' | 'evidence';

/**
 * Storage adapter interface for saving, reading, and deleting files
 * organized by task ID and file type
 */
export interface StorageAdapter {
  /**
   * Save a file for a specific task and file type
   * @param taskId - Unique task identifier
   * @param fileType - Type of file being saved
   * @param content - File content as Buffer
   * @param filename - Original filename
   * @returns Full path to the saved file
   */
  save(taskId: string, fileType: FileType, content: Buffer, filename: string): Promise<string>;

  /**
   * Read a file for a specific task and file type
   * @param taskId - Unique task identifier
   * @param fileType - Type of file to read
   * @param filename - Filename to read
   * @returns File content as Buffer
   * @throws Error if file does not exist
   */
  read(taskId: string, fileType: FileType, filename: string): Promise<Buffer>;

  /**
   * Delete a file for a specific task and file type
   * @param taskId - Unique task identifier
   * @param fileType - Type of file to delete
   * @param filename - Filename to delete
   */
  delete(taskId: string, fileType: FileType, filename: string): Promise<void>;

  /**
   * List all files for a specific task and file type
   * @param taskId - Unique task identifier
   * @param fileType - Type of files to list
   * @returns Array of filenames
   */
  list(taskId: string, fileType: FileType): Promise<string[]>;

  /**
   * Delete all files for a specific task
   * @param taskId - Unique task identifier
   */
  deleteAll(taskId: string): Promise<void>;
}

/**
 * Configuration for cloud storage adapters (S3, R2, etc.)
 * Reserved for future implementation
 */
export interface CloudStorageConfig {
  endpoint?: string;
  region?: string;
  bucket: string;
  accessKeyId?: string;
  secretAccessKey?: string;
}

/**
 * Cloud storage adapter interface
 * Reserved for future implementation - DO NOT implement yet
 */
export interface CloudStorageAdapter extends StorageAdapter {
  /**
   * Initialize cloud storage connection
   */
  connect(): Promise<void>;

  /**
   * Get a signed URL for temporary file access
   * @param taskId - Unique task identifier
   * @param fileType - Type of file
   * @param filename - Filename
   * @param expiresIn - URL expiration time in seconds
   * @returns Signed URL
   */
  getSignedUrl(taskId: string, fileType: FileType, filename: string, expiresIn: number): Promise<string>;
}
