/**
 * Print Service
 * Handles PDF generation and printing for compositions
 * Supports web (browser print API) and mobile (expo-print)
 */

import { Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Composition } from '../../models/Composition';
import { ChordData } from './chordSvgGenerator';
import { generatePrintHtml, PrintOptions } from './htmlTemplates';

export { PrintOptions } from './htmlTemplates';
export { ChordData } from './chordSvgGenerator';

export interface PrintResult {
  success: boolean;
  uri?: string;
  error?: string;
}

export class PrintService {
  /**
   * Print composition directly (opens native print dialog)
   */
  async print(
    composition: Composition,
    chordsData: ChordData[],
    options: PrintOptions
  ): Promise<PrintResult> {
    try {
      const html = generatePrintHtml(composition, chordsData, options);

      if (Platform.OS === 'web') {
        return this.printWeb(html);
      } else {
        // Mobile: Use expo-print
        await Print.printAsync({ html });
        return { success: true };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error occurred';
      return { success: false, error: message };
    }
  }

  /**
   * Export composition as PDF file
   */
  async exportPdf(
    composition: Composition,
    chordsData: ChordData[],
    options: PrintOptions
  ): Promise<PrintResult> {
    try {
      const html = generatePrintHtml(composition, chordsData, options);

      if (Platform.OS === 'web') {
        // Web: Use print dialog with "Save as PDF" option
        return this.printWeb(html);
      } else {
        // Mobile: Generate PDF file and share
        const { uri } = await Print.printToFileAsync({ html });

        // Share the PDF file
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, {
            mimeType: 'application/pdf',
            dialogTitle: `Save ${composition.title}.pdf`,
          });
        }

        return { success: true, uri };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error occurred';
      return { success: false, error: message };
    }
  }

  /**
   * Print via web browser
   */
  private printWeb(html: string): PrintResult {
    try {
      // Create a hidden iframe for printing
      const iframe = document.createElement('iframe');
      iframe.style.position = 'absolute';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = 'none';
      iframe.style.left = '-9999px';
      document.body.appendChild(iframe);

      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDoc) {
        document.body.removeChild(iframe);
        return { success: false, error: 'Failed to create print frame' };
      }

      iframeDoc.open();
      iframeDoc.write(html);
      iframeDoc.close();

      // Wait for content to load then print
      iframe.onload = () => {
        try {
          iframe.contentWindow?.print();
        } catch {
          // Print was cancelled or failed
        }
        // Clean up after a delay to allow print dialog to open
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 1000);
      };

      // Trigger load if content is already ready
      if (iframeDoc.readyState === 'complete') {
        iframe.contentWindow?.print();
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 1000);
      }

      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to print';
      return { success: false, error: message };
    }
  }
}

// Export singleton instance
export const printService = new PrintService();
