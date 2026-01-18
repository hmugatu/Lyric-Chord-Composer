/**
 * HTML Templates for Print Output
 * Generates print-ready HTML with CSS for compositions
 */

import { Composition, PageData, CompositionPages } from '../../models/Composition';
import { ChordData, generateChordSvg, getUsedChords } from './chordSvgGenerator';
import { generateNotesHtml, generateTablatureHtml } from './noteRenderer';

export interface PrintOptions {
  includeChordDiagrams: boolean;
  includeTablature: boolean;
  includeNotation: boolean;
  pageSize: 'letter' | 'a4';
  orientation: 'portrait' | 'landscape';
}

/**
 * Generate complete HTML document for printing
 */
export function generatePrintHtml(
  composition: Composition,
  chordsData: ChordData[],
  options: PrintOptions
): string {
  // Parse pages from composition notes
  let pages: PageData[] = [];
  if (composition.notes) {
    try {
      const parsed = JSON.parse(composition.notes) as CompositionPages;
      pages = parsed.pages || [];
    } catch {
      pages = [];
    }
  }

  const usedChords = getUsedChords(pages, chordsData);
  const styles = generatePrintStyles(options);
  const header = generateHeaderHtml(composition);
  const chordReference = options.includeChordDiagrams
    ? generateChordReferenceHtml(usedChords)
    : '<div class="chord-reference-placeholder"></div>';
  const pagesHtml = pages.map((page, index) =>
    generatePageHtml(page, index + 1, pages.length, chordsData, options)
  ).join('\n');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(composition.title)}</title>
  <style>${styles}</style>
</head>
<body>
  ${header}
  ${chordReference}
  <div class="pages-container">
    ${pagesHtml}
  </div>
</body>
</html>`;
}

/**
 * Generate print-specific CSS styles
 *
 * Layout calculations for Letter size (8.5" x 11") with 0.5" margins:
 * - Printable area: 7.5" wide x 10" tall
 * - Header: ~0.8" (title, artist, settings)
 * - Chord reference: ~1.0" (when present, reserved space even if empty)
 * - Page indicator: ~0.2"
 * - Remaining for 4 bar rows: ~8.0" / 4 = 2.0" per row
 * - Each bar row contains: lyrics (0.25"), chords (0.25"), optional measure/tablature
 */
function generatePrintStyles(options: PrintOptions): string {
  const pageSize = options.pageSize === 'a4' ? 'A4' : 'letter';
  const orientation = options.orientation;

  // Calculate dimensions based on page size
  const isA4 = options.pageSize === 'a4';
  const isLandscape = options.orientation === 'landscape';

  // Base dimensions (in inches, converted to CSS)
  // Letter: 8.5 x 11, A4: 8.27 x 11.69
  const pageWidth = isA4 ? (isLandscape ? 11.69 : 8.27) : (isLandscape ? 11 : 8.5);
  const pageHeight = isA4 ? (isLandscape ? 8.27 : 11.69) : (isLandscape ? 8.5 : 11);

  // Printable area (subtract 0.5" margins on each side)
  const printableWidth = pageWidth - 1; // 7.5" for letter portrait
  const printableHeight = pageHeight - 1; // 10" for letter portrait

  // Fixed heights for layout components
  const headerHeight = 0.9; // inches - title, artist, settings with border
  const chordRefHeight = options.includeChordDiagrams ? 1.1 : 0.1; // inches - chord diagrams section (minimal if not included)
  const pageIndicatorHeight = 0.3; // inches

  // Calculate remaining height for bar rows
  const contentHeight = printableHeight - headerHeight - chordRefHeight - pageIndicatorHeight;
  const barRowHeight = contentHeight / 4; // 4 rows per page

  // Bar row component heights (adjust based on included elements)
  const lyricsHeight = 0.25; // inches - always included
  const chordRowHeight = 0.25; // inches - always included
  let tablatureHeight = 0; // inches
  let measureHeight = 0; // inches

  // Dynamically calculate heights based on what's included
  if (options.includeNotation && options.includeTablature) {
    // Both: split remaining space
    tablatureHeight = 0.4;
    measureHeight = barRowHeight - lyricsHeight - chordRowHeight - tablatureHeight - 0.1;
  } else if (options.includeNotation) {
    // Only notation
    tablatureHeight = 0;
    measureHeight = barRowHeight - lyricsHeight - chordRowHeight - 0.1;
  } else if (options.includeTablature) {
    // Only tablature
    tablatureHeight = barRowHeight - lyricsHeight - chordRowHeight - 0.1;
    measureHeight = 0;
  } else {
    // Neither notation nor tablature
    tablatureHeight = 0;
    measureHeight = 0;
  }

  return `
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    html, body {
      font-family: 'Georgia', 'Times New Roman', serif;
      color: #333;
      background: white;
      width: ${printableWidth}in;
      height: ${printableHeight}in;
    }

    body {
      padding: 0.5in;
    }

    @media print {
      @page {
        size: ${pageSize} ${orientation};
        margin: 0.5in;
      }

      html, body {
        width: 100%;
        height: auto;
        padding: 0;
      }

      .page-break {
        page-break-after: always;
      }

      .no-print {
        display: none;
      }
    }

    /* Header Styles - Fixed height: ${headerHeight}in */
    .header {
      height: ${headerHeight}in;
      text-align: center;
      padding-bottom: 0.1in;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }

    .title {
      font-size: 24pt;
      font-weight: bold;
      line-height: 1.2;
    }

    .artist {
      font-size: 14pt;
      font-style: italic;
      color: #666;
      margin-top: 0.05in;
    }

    .settings {
      display: flex;
      gap: 0.3in;
      justify-content: center;
      font-size: 10pt;
      color: #555;
      margin-top: 0.1in;
    }

    .settings span {
      padding: 2px 8px;
      background: #f0f0f0;
      border-radius: 3px;
    }

    /* Chord Reference Section - Fixed height: ${chordRefHeight}in */
    .chord-reference {
      height: ${chordRefHeight}in;
      padding: 0.1in;
      background: #fafafa;
      margin-top: 0.1in;
      overflow: hidden;
    }

    .chord-reference-title {
      font-size: 11pt;
      font-weight: bold;
      margin-bottom: 0.08in;
      color: #333;
    }

    .chord-diagrams {
      display: flex;
      flex-wrap: wrap;
      gap: 0.15in;
      justify-content: flex-start;
      align-items: flex-start;
    }

    .chord-diagram-item {
      display: inline-block;
    }

    /* Chord Reference Placeholder - maintains spacing when no chords */
    .chord-reference-placeholder {
      height: ${chordRefHeight}in;
      margin-top: 0.1in;
    }

    /* Pages Container */
    .pages-container {
      margin-top: 0.1in;
    }

    /* Sheet Music Page - contains 4 bar rows */
    .sheet-page {
      height: ${contentHeight + pageIndicatorHeight}in;
      display: flex;
      flex-direction: column;
    }

    .page-header {
      height: ${pageIndicatorHeight}in;
      font-size: 9pt;
      color: #888;
      text-align: right;
      line-height: ${pageIndicatorHeight}in;
    }

    /* Bar Row (4 bars per row) - Fixed height: ${barRowHeight.toFixed(3)}in */
    .bar-row {
      display: flex;
      height: ${barRowHeight}in;
      gap: 0.1in;
    }

    /* Individual Bar - equal width, fills row */
    .bar {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    /* Lyrics above bar - Fixed height: ${lyricsHeight}in */
    .bar-lyrics {
      height: ${lyricsHeight}in;
      font-size: 11pt;
      text-align: center;
      line-height: ${lyricsHeight}in;
      color: #333;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* Chord row within bar - Fixed height: ${chordRowHeight}in */
    .chord-row {
      height: ${chordRowHeight}in;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 2px;
    }

    .chord-box {
      flex: 1;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 10pt;
      font-weight: bold;
      color: #000;
      background: #fff;
    }

    .chord-box.empty {
      visibility: hidden;
    }

    /* Measure box (staff representation) - Fixed height: ${measureHeight.toFixed(3)}in */
    .measure {
      flex: 1;
      height: ${measureHeight}in;
      position: relative;
      background: #fff;
    }

    /* Staff lines inside measure */
    .staff-lines {
      position: absolute;
      top: 15%;
      left: 0;
      right: 0;
      bottom: 10%;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }

    .staff-line {
      height: 1px;
      background: #999;
    }

    /* Tablature section below staff */
    .tablature {
      height: ${tablatureHeight > 0 ? tablatureHeight + 'in' : 'auto'};
      position: relative;
      background: #fff;
      border-top: 1px solid #ddd;
      margin-top: 2px;
      ${tablatureHeight === 0 ? 'display: none;' : ''}
    }

    /* Measure box should expand if tablature is not shown */
    ${!options.includeTablature && options.includeNotation ? `.measure { height: ${barRowHeight - lyricsHeight - chordRowHeight - 0.1}in; }` : ''}

    /* Empty bar styling */
    .empty-bar .measure {
      background: #fcfcfc;
    }

    .empty-bar .tablature {
      background: #fcfcfc;
    }
  `;
}

/**
 * Generate header HTML with composition info
 */
function generateHeaderHtml(composition: Composition): string {
  const settings = composition.globalSettings;
  const timeSignature = settings.timeSignature
    ? `${settings.timeSignature.beats}/${settings.timeSignature.beatValue}`
    : '4/4';

  return `
    <div class="header">
      <div class="title">${escapeHtml(composition.title)}</div>
      ${composition.artist ? `<div class="artist">${escapeHtml(composition.artist)}</div>` : ''}
      <div class="settings">
        <span>Key: ${escapeHtml(settings.key || 'C')}</span>
        <span>Tempo: ${settings.tempo || 120} BPM</span>
        <span>Time: ${timeSignature}</span>
        ${settings.capo ? `<span>Capo: Fret ${settings.capo}</span>` : ''}
      </div>
    </div>
  `;
}

/**
 * Generate chord reference section with SVG diagrams
 */
function generateChordReferenceHtml(chords: ChordData[]): string {
  if (chords.length === 0) {
    return '';
  }

  const diagramsHtml = chords
    .map(chord => `<div class="chord-diagram-item">${generateChordSvg(chord, 'small')}</div>`)
    .join('\n');

  return `
    <div class="chord-reference">
      <div class="chord-reference-title">Chords Used</div>
      <div class="chord-diagrams">
        ${diagramsHtml}
      </div>
    </div>
  `;
}

/**
 * Generate HTML for a single page (16 bars)
 */
function generatePageHtml(
  page: PageData,
  pageNumber: number,
  totalPages: number,
  chordsData: ChordData[],
  options: PrintOptions
): string {
  const barsHtml: string[] = [];

  // 4 rows of 4 bars each
  for (let rowIndex = 0; rowIndex < 4; rowIndex++) {
    let rowHtml = '<div class="bar-row">';

    for (let colIndex = 0; colIndex < 4; colIndex++) {
      const barIndex = rowIndex * 4 + colIndex;
      const barNumber = barIndex + 1;
      const lyrics = page.barLyrics[barIndex] || '';
      const beatChords = page.barBeatChords[barIndex] || ['', '', '', ''];

      // Check if bar has any content
      const hasChords = beatChords.some(c => c && c.trim() !== '');
      const hasLyrics = lyrics.trim() !== '';
      const isEmpty = !hasChords && !hasLyrics;

      // Generate chord boxes - hide empty ones
      const chordBoxesHtml = beatChords
        .map(chord => {
          const isEmpty = !chord || chord.trim() === '';
          return `<div class="chord-box${isEmpty ? ' empty' : ''}">${isEmpty ? '-' : escapeHtml(chord)}</div>`;
        })
        .join('');

      // Generate notes SVG for the staff (based on chords) - only if notation is included
      const notesSvg = options.includeNotation && hasChords ? generateNotesHtml(beatChords, 150, 50) : '';

      // Generate tablature SVG (based on chords and fingering data) - only if tablature is included
      const tabSvg = options.includeTablature && hasChords ? generateTablatureHtml(beatChords, chordsData, 150, 35) : '';

      // Build measure content with optional notation
      let measureContent = '';
      if (options.includeNotation) {
        measureContent = `
          <div class="staff-lines">
            <div class="staff-line"></div>
            <div class="staff-line"></div>
            <div class="staff-line"></div>
            <div class="staff-line"></div>
            <div class="staff-line"></div>
          </div>
          ${notesSvg}
        `;
      }

      rowHtml += `
        <div class="bar${isEmpty ? ' empty-bar' : ''}">
          <div class="bar-lyrics">${escapeHtml(lyrics)}</div>
          <div class="chord-row">${chordBoxesHtml}</div>
          <div class="measure">
            ${measureContent}
          </div>
          ${options.includeTablature ? `<div class="tablature">${tabSvg}</div>` : ''}
        </div>
      `;
    }

    rowHtml += '</div>';
    barsHtml.push(rowHtml);
  }

  const pageBreak = pageNumber < totalPages ? ' page-break' : '';

  return `
    <div class="sheet-page${pageBreak}">
      <div class="page-header">Page ${pageNumber} of ${totalPages}</div>
      ${barsHtml.join('\n')}
    </div>
  `;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
