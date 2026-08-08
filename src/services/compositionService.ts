/**
 * Composition Storage Service (web, local-only)
 * Serializes/deserializes compositions to/from .hmlcc files via LocalFileProvider.
 */

import type { Composition } from '../models';
import type { FileMetadata } from './fileStorage/types';
import { LocalFileProvider } from './fileStorage/LocalFileProvider';
import {
  deserializeComposition,
  generateFilename,
  serializeComposition,
} from './compositionSerialization';

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
    return serializeComposition(composition);
  }

  private deserializeComposition(content: string): Composition {
    return deserializeComposition(content);
  }

  private generateFilename(composition: Composition): string {
    return generateFilename(composition);
  }
}
