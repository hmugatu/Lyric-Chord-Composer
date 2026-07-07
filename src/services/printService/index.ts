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
      const html = await generatePrintHtml(composition, chordsData, options);
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
    let printed = false;
    const triggerPrint = () => {
      if (printed) return;
      printed = true;
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

    // The Bravura music font (embedded @font-face) must finish loading in the
    // print document before we print, or VexFlow glyphs render as tofu boxes /
    // broken ledger lines. document.fonts.ready is NOT enough: it can resolve
    // before Bravura is ever requested (webfonts load lazily on first use, and
    // a freshly-written popup may not have triggered it yet). So explicitly
    // request the font by name and wait for THAT load to settle.
    const printWhenFontsReady = () => {
      const fonts = printWindow.document.fonts;
      if (fonts && typeof fonts.load === 'function') {
        // Force Bravura to load in the print document, then wait for the whole
        // font set to settle before printing.
        fonts
          .load('40px Bravura')
          .catch(() => undefined)
          .then(() => fonts.ready)
          .catch(() => undefined)
          .then(() => triggerPrint());
        // Safety net if a font promise stalls.
        setTimeout(triggerPrint, 3000);
      } else {
        setTimeout(triggerPrint, 500);
      }
    };

    if (printWindow.document.readyState === 'complete') {
      printWhenFontsReady();
    } else {
      printWindow.onload = printWhenFontsReady;
      // Safety net in case onload never fires.
      setTimeout(printWhenFontsReady, 800);
    }
  }
}

export const printService = new PrintService();
