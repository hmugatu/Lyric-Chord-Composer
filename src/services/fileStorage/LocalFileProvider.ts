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
      // Create file in document directory
      const fileUri = `${Paths.document.uri}/${finalFilename}`;

      // Write content to file
      await FileSystem.writeAsStringAsync(fileUri, content, {
        encoding: 'utf8' as any,
      });

      // Share/save the file
      if (Platform.OS === 'android' || Platform.OS === 'ios') {
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
      } else {
        // For web, trigger download
        await Sharing.shareAsync(fileUri);
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
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/x-hmlcc', 'text/plain', '*/*'], // Accept .hmlcc or any text file
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
   * Import multiple files
   */
  async importMultipleFiles(): Promise<ImportResult[]> {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/x-hmlcc', 'text/plain', '*/*'],
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
