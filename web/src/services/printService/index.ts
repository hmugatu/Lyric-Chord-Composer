/**
 * Print Service (web)
 * Uses the browser's native print dialog. Save-as-PDF is available there too.
 */

import { Composition } from '../../models/Composition';
import { ChordData } from './chordSvgGenerator';
import { generatePrintHtml, PrintOptions } from './htmlTemplates';

export type { PrintOptions } from './htmlTemplates';
export type { ChordData } from './chordSvgGenerator';

export interface PrintResult {
  success: boolean;
  error?: string;
}

export class PrintService {
  async print(
    composition: Composition,
    chordsData: ChordData[],
    options: PrintOptions
  ): Promise<PrintResult> {
    try {
      const html = generatePrintHtml(composition, chordsData, options);
      this.printBrowser(html);
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error occurred';
      return { success: false, error: message };
    }
  }

  private printBrowser(html: string): void {
    const printWindow = window.open('', '', 'width=800,height=600');
    if (!printWindow) {
      throw new Error('Failed to open print window. Please allow pop-ups for this site.');
    }

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();

    // Trigger printing once the document is ready. We don't rely on `onload`
    // alone: after document.write the window may already be loaded, so the
    // handler would never fire. Fire on load if it's still pending, otherwise
    // fall back to a short timeout so SVG/layout has a frame to settle.
    const triggerPrint = () => {
      try {
        printWindow.focus();
        printWindow.print();
      } catch (e) {
        console.error('Print failed:', e);
      } finally {
        // Give the print dialog a moment before closing the window.
        setTimeout(() => printWindow.close(), 500);
      }
    };

    if (printWindow.document.readyState === 'complete') {
      setTimeout(triggerPrint, 250);
    } else {
      printWindow.onload = () => setTimeout(triggerPrint, 250);
      // Safety net in case onload never fires.
      setTimeout(triggerPrint, 800);
    }
  }
}

export const printService = new PrintService();
