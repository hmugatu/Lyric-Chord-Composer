/**
 * Print Service
 * Handles printing for compositions
 * Uses native print dialog on both web and mobile
 */

import { Platform } from 'react-native';
import * as Print from 'expo-print';
import { Composition } from '../../models/Composition';
import { ChordData } from './chordSvgGenerator';
import { generatePrintHtml, PrintOptions } from './htmlTemplates';

export { PrintOptions } from './htmlTemplates';
export { ChordData } from './chordSvgGenerator';

export interface PrintResult {
  success: boolean;
  error?: string;
}

export class PrintService {
  /**
   * Print composition using native print dialog
   * Works on both web (browser) and mobile (expo-print) platforms
   */
  async print(
    composition: Composition,
    chordsData: ChordData[],
    options: PrintOptions
  ): Promise<PrintResult> {
    try {
      const html = generatePrintHtml(composition, chordsData, options);

      if (Platform.OS === 'web') {
        // Web: Use browser's native print dialog
        this.printBrowser(html);
        return { success: true };
      } else {
        // Mobile: Use expo-print's native dialog
        await Print.printAsync({ html });
        return { success: true };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error occurred';
      return { success: false, error: message };
    }
  }

  /**
   * Print via browser window.print()
   * Simple and reliable - uses the native browser print dialog
   */
  private printBrowser(html: string): void {
    const printWindow = window.open('', '', 'width=800,height=600');
    if (!printWindow) {
      throw new Error('Failed to open print window');
    }

    printWindow.document.write(html);
    printWindow.document.close();

    // Wait for content to load then print
    printWindow.onload = () => {
      printWindow.print();
      printWindow.close();
    };
  }
}

// Export singleton instance
export const printService = new PrintService();
