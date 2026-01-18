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
 * Uses flexible, natural layout that matches the on-screen paper view
 */
function generatePrintStyles(options: PrintOptions): string {
  return `
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    html, body {
      font-family: Georgia, 'Times New Roman', serif;
      color: #333;
      background: white;
    }

    body {
      padding: 0.5in;
      font-size: 11pt;
      line-height: 1.5;
    }

    @media print {
      @page {
        size: ${options.pageSize === 'a4' ? 'A4' : 'letter'} ${options.orientation};
        margin: 0.5in;
      }

      .page-break {
        page-break-after: always;
        margin-top: 0;
      }

      .no-print {
        display: none;
      }
    }

    /* Header Styles */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 0.3in;
      border-bottom: none;
      padding-bottom: 0.15in;
    }

    .title {
      font-size: 20pt;
      font-weight: bold;
      line-height: 1.3;
    }

    .artist {
      font-size: 12pt;
      font-style: italic;
      color: #666;
      margin-top: 0.05in;
    }

    .settings {
      display: flex;
      flex-direction: column;
      gap: 4pt;
      font-size: 8pt;
      color: #555;
      text-align: right;
    }

    .settings span {
      padding: 0;
      background: transparent;
      border: none;
    }

    /* Chord Reference Section */
    .chord-reference {
      margin: 10pt 0 0 0;
      padding: 0;
      background: transparent;
      border: none;
      page-break-inside: avoid;
      page-break-after: avoid;
    }

    .chord-reference-title {
      display: none;
    }

    .chord-diagrams {
      display: flex;
      flex-wrap: wrap;
      gap: 0.15in;
      justify-content: flex-start;
      align-items: flex-start;
      margin-bottom: 10pt;
    }

    .chord-diagram-item {
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .chord-diagram-item svg {
      display: block;
      width: 60px;
      height: auto;
    }

    .chord-reference-placeholder {
      display: none;
    }

    /* Pages Container */
    .pages-container {
      margin-top: 0.2in;
    }

    /* Sheet Page - Natural flow, no fixed height */
    .sheet-page {
      margin-bottom: 0.3in;
      page-break-inside: avoid;
    }

    .page-header {
      font-size: 8pt;
      color: #999;
      text-align: right;
      margin-bottom: 0.1in;
    }

    /* Bar Row - 4 bars across, natural height */
    .bar-row {
      display: flex;
      gap: 4pt;
      margin-bottom: 6pt;
      page-break-inside: avoid;
    }

    /* Individual Bar */
    .bar {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    /* Lyrics */
    .bar-lyrics {
      font-size: 11pt;
      text-align: center;
      margin-bottom: 2pt;
      min-height: 12pt;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      line-height: 1;
    }

    /* Chord Row */
    .chord-row {
      display: flex;
      gap: 1pt;
      margin-bottom: 3pt;
      justify-content: space-between;
      min-height: 16pt;
    }

    /* Chord Box */
    .chord-box {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 8pt;
      font-weight: bold;
      color: #000;
      background: transparent;
      border: none;
      padding: 2pt;
      line-height: 1;
    }

    .chord-box.empty {
      visibility: hidden;
    }

    /* Measure (Staff) */
    .measure {
      flex: 1;
      position: relative;
      background: #fff;
      border: none;
      min-height: 45pt;
      margin-bottom: 2pt;
      page-break-inside: avoid;
    }

    /* Staff Lines */
    .staff-lines {
      position: absolute;
      top: 20%;
      left: 0;
      right: 0;
      height: 60%;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }

    .staff-line {
      height: 0.5pt;
      background: #333;
    }

    /* Tablature */
    .tablature {
      position: relative;
      background: #fff;
      border: none;
      min-height: 18pt;
      padding: 1pt 2pt;
      font-family: 'Courier New', monospace;
      font-size: 7pt;
      line-height: 1.1;
      page-break-inside: avoid;
    }

    /* Empty Bar Styling */
    .empty-bar .measure {
      background: #fff;
    }

    .empty-bar .tablature {
      background: #fff;
    }

    /* Row-spanning Containers */
    .bars-container {
      display: flex;
      gap: 4pt;
      flex: 1;
    }

    .row-tablature {
      width: 100%;
      background: #fff;
      border: none;
      min-height: 65pt;
      padding: 2pt;
      font-family: 'Courier New', monospace;
      font-size: 7pt;
      line-height: 1.1;
      page-break-inside: avoid;
      margin-bottom: 4pt;
    }

    .row-tablature svg {
      display: block;
      width: 100%;
      height: auto;
    }

    .row-staff {
      width: 100%;
      background: #fff;
      border: none;
      min-height: 85pt;
      padding: 2pt;
      position: relative;
      page-break-inside: avoid;
      margin-top: 4pt;
    }

    .row-staff svg {
      display: block;
      width: 100%;
      height: auto;
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
      <div>
        <div class="title">${escapeHtml(composition.title)}</div>
        ${composition.artist ? `<div class="artist">${escapeHtml(composition.artist)}</div>` : ''}
      </div>
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
    // Collect all bar data for this row
    const rowBarsData = [];
    const rowBeatChords = [];
    let rowHasContent = false;

    for (let colIndex = 0; colIndex < 4; colIndex++) {
      const barIndex = rowIndex * 4 + colIndex;
      const lyrics = page.barLyrics[barIndex] || '';
      const beatChords = page.barBeatChords[barIndex] || ['', '', '', ''];
      
      const hasChords = beatChords.some(c => c && c.trim() !== '');
      const hasLyrics = lyrics.trim() !== '';
      const isEmpty = !hasChords && !hasLyrics;

      rowBarsData.push({ lyrics, beatChords, hasChords, hasLyrics, isEmpty });
      rowBeatChords.push(...beatChords);
      
      if (!isEmpty) rowHasContent = true;
    }

    // Generate row-spanning staff notation (once per row)
    const notesSvg = options.includeNotation && rowHasContent ? generateNotesHtml(rowBeatChords, 800, 85) : '';

    // Generate row-spanning tablature (once per row)
    const tabSvg = options.includeTablature && rowHasContent ? generateTablatureHtml(rowBeatChords, chordsData, 800, 65) : '';

    let rowHtml = `
      <div class="bar-row">
        ${options.includeTablature ? `<div class="row-tablature">${tabSvg}</div>` : ''}
        <div class="bars-container">
    `;

    // Generate individual bars for this row
    for (let colIndex = 0; colIndex < 4; colIndex++) {
      const barData = rowBarsData[colIndex];
      const barIndex = rowIndex * 4 + colIndex;

      // Generate chord boxes - empty ones invisible, no borders
      const chordBoxesHtml = barData.beatChords
        .map(chord => {
          const isEmpty = !chord || chord.trim() === '';
          return `<div class="chord-box${isEmpty ? ' empty' : ''}">${isEmpty ? '' : escapeHtml(chord)}</div>`;
        })
        .join('');

      rowHtml += `
        <div class="bar${barData.isEmpty ? ' empty-bar' : ''}">
          <div class="bar-lyrics">${escapeHtml(barData.lyrics)}</div>
          <div class="chord-row">${chordBoxesHtml}</div>
        </div>
      `;
    }

    rowHtml += `
        </div>
        ${options.includeNotation ? `<div class="row-staff">${notesSvg}</div>` : ''}
      </div>
    `;
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
