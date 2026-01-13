/**
 * Composition Storage Service
 * Handles serialization/deserialization of compositions to/from .hmlcc files
 * Supports local and cloud storage providers
 */

import type { Composition } from '../models';
import type { StorageProvider, FileMetadata } from './fileStorage/types';
import { LocalFileProvider } from './fileStorage/LocalFileProvider';
import { GoogleDriveProvider } from './fileStorage/GoogleDriveProvider';
import { OneDriveProvider } from './fileStorage/OneDriveProvider';

export class CompositionStorageService {
  private localProvider: LocalFileProvider;
  private cloudProviders: Map<string, StorageProvider>;
  private currentProvider: StorageProvider;

  constructor() {
    this.localProvider = new LocalFileProvider();
    this.currentProvider = this.localProvider;
    this.cloudProviders = new Map([
      ['google-drive', new GoogleDriveProvider() as any],
      ['onedrive', new OneDriveProvider() as any],
    ]);
  }

  /**
   * Set the active storage provider
   */
  async setProvider(providerName: string): Promise<void> {
    if (providerName === 'local') {
      this.currentProvider = this.localProvider;
      return;
    }

    const provider = this.cloudProviders.get(providerName);
    if (!provider) {
      throw new Error(`Unknown provider: ${providerName}`);
    }

    // Authenticate if needed
    if ('authenticate' in provider && !provider.isAuthenticated?.()) {
      await provider.authenticate?.();
    }

    this.currentProvider = provider;
  }

  /**
   * Get current provider
   */
  getCurrentProvider(): StorageProvider {
    return this.currentProvider;
  }

  /**
   * Get available cloud providers
   */
  getAvailableProviders(): string[] {
    return Array.from(this.cloudProviders.keys());
  }

  /**
   * Export a single composition to .hmlcc file
   */
  async exportComposition(composition: Composition): Promise<void> {
    const filename = this.generateFilename(composition);
    const content = this.serializeComposition(composition);

    if (this.currentProvider === this.localProvider) {
      await this.localProvider.exportFile({
        filename,
        content,
        mimeType: 'application/x-hmlcc',
      });
    } else {
      await this.currentProvider.writeFile(filename, content);
    }
  }

  /**
   * Export multiple compositions as separate .hmlcc files
   */
  async exportCompositions(compositions: Composition[]): Promise<void> {
    for (const composition of compositions) {
      await this.exportComposition(composition);
    }
  }

  /**
   * Import a single composition from .hmlcc file
   */
  async importComposition(): Promise<{ composition: Composition; metadata?: FileMetadata }> {
    if (this.currentProvider === this.localProvider) {
      const { content } = await this.localProvider.importFile();
      return { composition: this.deserializeComposition(content) };
    } else {
      // For cloud providers, list files and let user pick
      const files = await this.currentProvider.listFiles();
      if (files.length === 0) {
        throw new Error('No compositions found in cloud storage');
      }
      // Return first file for now, in real implementation would show UI for selection
      const file = files[0];
      const content = await this.currentProvider.readFile(file.id);
      return {
        composition: this.deserializeComposition(content),
        metadata: file,
      };
    }
  }

  /**
   * Import multiple compositions from .hmlcc files
   */
  async importCompositions(): Promise<{ composition: Composition; metadata?: FileMetadata }[]> {
    if (this.currentProvider === this.localProvider) {
      const imports = await this.localProvider.importMultipleFiles();
      return imports.map(({ content }) => ({
        composition: this.deserializeComposition(content),
      }));
    } else {
      // For cloud providers, get all files
      const files = await this.currentProvider.listFiles();
      const results: { composition: Composition; metadata?: FileMetadata }[] = [];

      for (const file of files) {
        const content = await this.currentProvider.readFile(file.id);
        results.push({
          composition: this.deserializeComposition(content),
          metadata: file,
        });
      }

      return results;
    }
  }

  /**
   * Sync a composition back to cloud storage
   */
  async syncComposition(composition: Composition, fileId?: string): Promise<FileMetadata | undefined> {
    if (this.currentProvider === this.localProvider) {
      // Local provider doesn't have sync
      return undefined;
    }

    const filename = this.generateFilename(composition);
    const content = this.serializeComposition(composition);

    if ('syncFile' in this.currentProvider && fileId) {
      return await (this.currentProvider as any).syncFile?.(fileId, content);
    } else {
      return await (this.currentProvider as any).writeFile(filename, content);
    }
  }

  /**
   * List files in current storage provider
   */
  async listStorageFiles(): Promise<FileMetadata[]> {
    return await this.currentProvider.listFiles();
  }

  /**
   * Serialize composition to JSON string
   */
  private serializeComposition(composition: Composition): string {
    return JSON.stringify(composition, null, 2);
  }

  /**
   * Deserialize JSON string to composition
   */
  private deserializeComposition(content: string): Composition {
    try {
      const data = JSON.parse(content);

      // Validate required fields
      if (!data.id || !data.title) {
        throw new Error('Invalid composition: missing required fields (id, title)');
      }

      // TODO: Add more robust validation
      // For now, just return the parsed data
      return data as Composition;
    } catch (error) {
      throw new Error(`Failed to parse composition: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate filename from composition title and ID
   */
  private generateFilename(composition: Composition): string {
    const sanitizedTitle = this.sanitizeFilename(composition.title);
    return `${sanitizedTitle}-${composition.id}.hmlcc`;
  }

  /**
   * Remove invalid filename characters
   */
  private sanitizeFilename(title: string): string {
    return title
      .replace(/[^a-z0-9-_\s]/gi, '') // Remove special chars
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .toLowerCase()
      .substring(0, 50); // Limit length
  }
}
