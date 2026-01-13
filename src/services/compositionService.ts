/**
 * Composition Storage Service
 * Handles serialization/deserialization of compositions to/from .hmlcc files
 */

import type { Composition } from '../models';
import { LocalFileProvider } from './fileStorage/LocalFileProvider';

export class CompositionStorageService {
  private fileProvider: LocalFileProvider;

  constructor() {
    this.fileProvider = new LocalFileProvider();
  }

  /**
   * Export a single composition to .hmlcc file
   */
  async exportComposition(composition: Composition): Promise<void> {
    const filename = this.generateFilename(composition);
    const content = this.serializeComposition(composition);

    await this.fileProvider.exportFile({
      filename,
      content,
      mimeType: 'application/x-hmlcc',
    });
  }

  /**
   * Export multiple compositions as separate .hmlcc files
   */
  async exportCompositions(compositions: Composition[]): Promise<void> {
    // For now, export them one by one
    // TODO: In the future, could create a ZIP file
    for (const composition of compositions) {
      await this.exportComposition(composition);
    }
  }

  /**
   * Import a single composition from .hmlcc file
   */
  async importComposition(): Promise<Composition> {
    const { content } = await this.fileProvider.importFile();
    return this.deserializeComposition(content);
  }

  /**
   * Import multiple compositions from .hmlcc files
   */
  async importCompositions(): Promise<Composition[]> {
    const imports = await this.fileProvider.importMultipleFiles();
    return imports.map(({ content }) => this.deserializeComposition(content));
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
