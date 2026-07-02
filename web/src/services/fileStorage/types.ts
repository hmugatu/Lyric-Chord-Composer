/**
 * File Storage Service Types
 * Handles .hmlcc file operations for composition storage
 */

export interface FileMetadata {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: Date;
  size: number;
  sourceProvider?: 'local' | 'google-drive' | 'dropbox' | 'onedrive';
  sourceUrl?: string;
  lastSyncedAt?: Date;
}

export interface StorageProvider {
  // Authentication (for cloud providers)
  authenticate?(): Promise<void>;
  logout?(): Promise<void>;
  isAuthenticated?(): boolean;
  getUserInfo?(): Promise<{ name: string; email: string }>;

  // File operations
  listFiles(): Promise<FileMetadata[]>;
  readFile(fileId: string): Promise<string>;
  writeFile(filename: string, content: string): Promise<FileMetadata>;
  deleteFile(fileId: string): Promise<void>;

  // Provider info
  getProviderName(): string;
}

export interface CloudProvider extends StorageProvider {
  // Cloud-specific operations
  refreshAccessToken?(): Promise<void>;
  revokeAccess?(): Promise<void>;
  syncFile?(fileId: string, content: string): Promise<FileMetadata>;
}

export type StorageProviderType = 'local' | 'google-drive' | 'dropbox' | 'onedrive';

export interface ExportOptions {
  filename: string;
  content: string;
  mimeType?: string;
}

export interface ImportResult {
  filename: string;
  content: string;
  metadata?: FileMetadata;
}

export interface CloudAuthConfig {
  clientId: string;
  redirectUrl: string;
  scopes: string[];
}

