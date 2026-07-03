/**
 * Composition Storage Service (web, local-only)
 * Serializes/deserializes compositions to/from .hmlcc files via LocalFileProvider.
 */

import type { Composition } from '../models';
import type { FileMetadata } from './fileStorage/types';
import { LocalFileProvider } from './fileStorage/LocalFileProvider';

export class CompositionStorageService {
  private localProvider: LocalFileProvider;

  constructor() {
    this.localProvider = new LocalFileProvider();
  }

  /**
   * Kept for API compatibility with callers that pass a provider name.
   * Only 'local' is supported on the web build.
   */
  async setProvider(providerName: string): Promise<void> {
    if (providerName !== 'local') {
      throw new Error(`Provider not available on web: ${providerName}`);
    }
  }

  /** Returns true if a file was written, false if the user cancelled the Save dialog. */
  async exportComposition(composition: Composition): Promise<boolean> {
    const filename = this.generateFilename(composition);
    const content = this.serializeComposition(composition);
    return this.localProvider.exportFile({
      filename,
      content,
      mimeType: 'application/x-hmlcc',
    });
  }

  async exportCompositions(compositions: Composition[]): Promise<void> {
    for (const composition of compositions) {
      await this.exportComposition(composition);
    }
  }

  async importComposition(): Promise<{ composition: Composition; metadata?: FileMetadata }> {
    const { content } = await this.localProvider.importFile();
    return { composition: this.deserializeComposition(content) };
  }

  async importCompositions(): Promise<{ composition: Composition; metadata?: FileMetadata }[]> {
    const imports = await this.localProvider.importMultipleFiles();
    return imports.map(({ content }) => ({
      composition: this.deserializeComposition(content),
    }));
  }

  private serializeComposition(composition: Composition): string {
    return JSON.stringify(composition, null, 2);
  }

  private deserializeComposition(content: string): Composition {
    try {
      const data = JSON.parse(content);
      if (!data.id || !data.title) {
        throw new Error('Invalid composition: missing required fields (id, title)');
      }
      return data as Composition;
    } catch (error) {
      throw new Error(`Failed to parse composition: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private generateFilename(composition: Composition): string {
    const sanitizedTitle = this.sanitizeFilename(composition.title);
    return `${sanitizedTitle}-${composition.id}.hmlcc`;
  }

  private sanitizeFilename(title: string): string {
    return title
      .replace(/[^a-z0-9-_\s]/gi, '')
      .replace(/\s+/g, '-')
      .toLowerCase()
      .substring(0, 50);
  }
}
