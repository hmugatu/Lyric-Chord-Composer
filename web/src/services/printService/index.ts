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

    printWindow.document.write(html);
    printWindow.document.close();

    printWindow.onload = () => {
      printWindow.print();
      printWindow.close();
    };
  }
}

export const printService = new PrintService();
