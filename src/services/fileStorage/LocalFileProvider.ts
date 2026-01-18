/**
 * Local File Storage Provider
 * Handles export/import of .hmlcc files using device file system
 */

import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import type { ExportOptions, ImportResult, StorageProvider, FileMetadata } from './types';

export class LocalFileProvider implements StorageProvider {
  /**
   * Export a composition to a .hmlcc file
   */
  async exportFile(options: ExportOptions): Promise<void> {
    const { filename, content, mimeType = 'application/x-hmlcc' } = options;

    // Ensure filename has .hmlcc extension
    const finalFilename = filename.endsWith('.hmlcc') ? filename : `${filename}.hmlcc`;

    try {
      if (Platform.OS === 'web') {
        // For web, use blob download
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = finalFilename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        // For mobile, use file system and sharing
        const fileUri = `${Paths.document.uri}/${finalFilename}`;

        // Write content to file
        await FileSystem.writeAsStringAsync(fileUri, content, {
          encoding: 'utf8' as any,
        });

        // Share/save the file
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(fileUri, {
            mimeType,
            dialogTitle: 'Save Composition',
            UTI: 'com.lyricchordcomposer.hmlcc',
          });
        } else {
          throw new Error('Sharing is not available on this device');
        }
      }
    } catch (error) {
      console.error('Export error:', error);
      throw new Error(`Failed to export file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Import a composition from a .hmlcc file
   */
  async importFile(): Promise<ImportResult> {
    try {
      if (Platform.OS === 'web') {
        return await this.importFileWeb();
      }

      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*', // Show all files, we validate .hmlcc extension after selection
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        throw new Error('File selection was cancelled');
      }

      const { uri, name } = result.assets[0];

      // Validate file extension
      if (!name.endsWith('.hmlcc')) {
        throw new Error('Invalid file type. Please select a .hmlcc file');
      }

      // Read file content
      const content = await FileSystem.readAsStringAsync(uri, {
        encoding: 'utf8' as any,
      });

      // Validate JSON content
      try {
        JSON.parse(content);
      } catch {
        throw new Error('Invalid file format. The file does not contain valid JSON');
      }

      return {
        filename: name,
        content,
      };
    } catch (error) {
      console.error('Import error:', error);
      throw new Error(`Failed to import file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Web-specific import using native file input with .hmlcc filter
   */
  private importFileWeb(): Promise<ImportResult> {
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

      input.oncancel = () => {
        reject(new Error('File selection was cancelled'));
      };

      input.click();
    });
  }

  /**
   * Import multiple files
   */
  async importMultipleFiles(): Promise<ImportResult[]> {
    try {
      if (Platform.OS === 'web') {
        return await this.importMultipleFilesWeb();
      }

      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*', // Show all files, we validate .hmlcc extension after selection
        copyToCacheDirectory: true,
        multiple: true,
      });

      if (result.canceled) {
        throw new Error('File selection was cancelled');
      }

      const imports: ImportResult[] = [];

      for (const asset of result.assets) {
        const { uri, name } = asset;

        // Skip non-.hmlcc files
        if (!name.endsWith('.hmlcc')) {
          console.warn(`Skipping ${name}: not a .hmlcc file`);
          continue;
        }

        // Read file content
        const content = await FileSystem.readAsStringAsync(uri, {
          encoding: 'utf8' as any,
        });

        // Validate JSON
        try {
          JSON.parse(content);
          imports.push({ filename: name, content });
        } catch {
          console.warn(`Skipping ${name}: invalid JSON content`);
        }
      }

      if (imports.length === 0) {
        throw new Error('No valid .hmlcc files were imported');
      }

      return imports;
    } catch (error) {
      console.error('Import multiple error:', error);
      throw new Error(`Failed to import files: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Web-specific multiple file import using native file input with .hmlcc filter
   */
  private importMultipleFilesWeb(): Promise<ImportResult[]> {
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
            JSON.parse(content); // Validate JSON
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

      input.oncancel = () => {
        reject(new Error('File selection was cancelled'));
      };

      input.click();
    });
  }

  // StorageProvider interface implementation
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
