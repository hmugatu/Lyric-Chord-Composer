/**
 * Local File Storage Provider (web)
 * Export via Blob download, import via a hidden <input type="file">.
 */

import type { ExportOptions, ImportResult, StorageProvider, FileMetadata } from './types';

export class LocalFileProvider implements StorageProvider {
  async exportFile(options: ExportOptions): Promise<void> {
    const { filename, content, mimeType = 'application/x-hmlcc' } = options;
    const finalFilename = filename.endsWith('.hmlcc') ? filename : `${filename}.hmlcc`;

    try {
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = finalFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export error:', error);
      throw new Error(`Failed to export file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  importFile(): Promise<ImportResult> {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.hmlcc';

      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) {
          reject(new Error('File selection was cancelled'));
          return;
        }
        if (!file.name.endsWith('.hmlcc')) {
          reject(new Error('Invalid file type. Please select a .hmlcc file'));
          return;
        }
        try {
          const content = await file.text();
          JSON.parse(content); // Validate JSON
          resolve({ filename: file.name, content });
        } catch {
          reject(new Error('Invalid file format. The file does not contain valid JSON'));
        }
      };

      input.oncancel = () => reject(new Error('File selection was cancelled'));
      input.click();
    });
  }

  importMultipleFiles(): Promise<ImportResult[]> {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.hmlcc';
      input.multiple = true;

      input.onchange = async (e) => {
        const files = (e.target as HTMLInputElement).files;
        if (!files || files.length === 0) {
          reject(new Error('File selection was cancelled'));
          return;
        }

        const imports: ImportResult[] = [];
        for (const file of Array.from(files)) {
          if (!file.name.endsWith('.hmlcc')) {
            console.warn(`Skipping ${file.name}: not a .hmlcc file`);
            continue;
          }
          try {
            const content = await file.text();
            JSON.parse(content);
            imports.push({ filename: file.name, content });
          } catch {
            console.warn(`Skipping ${file.name}: invalid JSON content`);
          }
        }

        if (imports.length === 0) {
          reject(new Error('No valid .hmlcc files were imported'));
          return;
        }
        resolve(imports);
      };

      input.oncancel = () => reject(new Error('File selection was cancelled'));
      input.click();
    });
  }

  async listFiles(): Promise<FileMetadata[]> {
    return [];
  }

  async readFile(): Promise<string> {
    throw new Error('Not applicable for local provider');
  }

  async writeFile(): Promise<FileMetadata> {
    throw new Error('Not applicable for local provider');
  }

  async deleteFile(): Promise<void> {
    throw new Error('Not applicable for local provider');
  }

  getProviderName(): string {
    return 'Local';
  }
}
