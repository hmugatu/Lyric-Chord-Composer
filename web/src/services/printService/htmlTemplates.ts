/**
 * HTML Templates for Print Output
 * Generates print-ready HTML with CSS for compositions
 */

import { Composition, PageData, CompositionPages } from '../../models/Composition';
import { ChordData, generateChordSvg, getUsedChords } from './chordSvgGenerator';
import { generateTablatureHtml } from './noteRenderer';
import { renderStaffToContainer } from '../../components/StaffNotes';
import { cellsPerBarFor, getMeasureLayout, getSubdivisionX } from '../../utils/rowGeometry';
import { shortChordName } from '../../utils/chordName';
// Bravura is the music-notation font VexFlow renders its glyphs (noteheads,
// clefs, rests) with. The print output lives in a separate document (popup /
// expo-print) that never loaded VexFlow's runtime @font-face, so we embed the
// font as a base64 @font-face in the print CSS — otherwise glyphs fall back to
// tofu boxes. Vite gives us an app URL; we fetch it once and cache the data URI.
import bravuraWoff2Url from '@vexflow-fonts/bravura/bravura.woff2?url';

let bravuraDataUriPromise: Promise<string> | null = null;
async function getBravuraDataUri(): Promise<string> {
  if (!bravuraDataUriPromise) {
    bravuraDataUriPromise = fetch(bravuraWoff2Url)
      .then((r) => r.blob())
      .then(
        (blob) =>
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          })
      )
      .catch((e) => {
        console.error('Failed to inline Bravura font for print:', e);
        return '';
      });
  }
  return bravuraDataUriPromise;
}

// Row geometry for print output. Same relative proportions as the editor
// (content starts at x=10, first measure wider by the clef reserve); the SVGs
// scale to the printed page width via their viewBox.
const ROW_WIDTH = 800;
const TAB_HEIGHT = 65;
// Taller than the 5-line stave so ledger-line notes below the staff
// (low frets on the E/A strings) aren't clipped by the SVG viewport.
const STAFF_HEIGHT = 120;
const STAFF_SCALE = 0.75;
// Fixed vertical crop window (in the 120px render space) applied to every
// printed staff so all rows share one compact height and 16 bars fit a page.
// At ROW_WIDTH=800 -> printed width ~750px, this renders ~140px tall.
const STAFF_WINDOW = 120;

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
export async function generatePrintHtml(
  composition: Composition,
  chordsData: ChordData[],
  options: PrintOptions
): Promise<string> {
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
  // Even a brand-new composition prints a full page of empty structure.
  if (pages.length === 0) {
    pages = [{ barLyrics: [], barBeatChords: [] }];
  }

  const beatsPerBar = composition.globalSettings.chordsPerBar || 4;
  const usedChords = getUsedChords(pages, chordsData);
  const bravuraDataUri = await getBravuraDataUri();
  const styles = generatePrintStyles(options, bravuraDataUri);
  const header = generateHeaderHtml(composition);
  const chordReference = options.includeChordDiagrams
    ? generateChordReferenceHtml(usedChords)
    : '<div class="chord-reference-placeholder"></div>';
  const pageHtmlParts: string[] = [];
  for (let index = 0; index < pages.length; index++) {
    pageHtmlParts.push(
      await generatePageHtml(pages[index], index + 1, pages.length, options, beatsPerBar, composition, chordsData)
    );
  }
  const pagesHtml = pageHtmlParts.join('\n');

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
function generatePrintStyles(options: PrintOptions, bravuraDataUri: string): string {
  return `
    ${bravuraDataUri ? `@font-face {
      font-family: 'Bravura';
      src: url('${bravuraDataUri}') format('woff2');
      font-display: block;
    }` : ''}

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

    /* Header — single row: title on the left, all settings inline on the
       right, matching the on-screen editor header. */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 0.3in;
      margin-bottom: 0.15in;
      padding-bottom: 0.1in;
      border-bottom: 1px solid #ddd;
    }

    .title {
      font-size: 20pt;
      font-weight: bold;
      line-height: 1.3;
      white-space: nowrap;
    }

    .artist {
      font-size: 12pt;
      font-style: italic;
      color: #666;
      margin-left: 8pt;
    }

    .settings {
      display: flex;
      flex-direction: row;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 12pt;
      font-size: 9pt;
      color: #555;
      text-align: right;
      white-space: nowrap;
    }

    .settings b {
      color: #333;
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
      margin-bottom: 0;
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
      margin-top: 4pt;
    }

    /* Sheet Page - Natural flow, no fixed height.
       Do NOT avoid page-break-inside here: forcing the whole page block to stay
       together pushes all content off page 1, leaving it blank. Let rows flow. */
    .sheet-page {
      margin-bottom: 0.3in;
    }

    .page-header {
      font-size: 8pt;
      color: #999;
      text-align: right;
      margin-bottom: 0.1in;
    }

    /* Bar Row - 4 bars across; tight vertical rhythm so all 16 bars fit on
       one page. Only ~2px between a row's staff and the next row's lyrics. */
    .bar-row {
      display: flex;
      flex-direction: column;
      gap: 0;
      margin-bottom: 2px;
      page-break-inside: avoid;
    }

    /* Lyrics — one line spanning the whole row, wraps instead of clipping. */
    .row-lyrics {
      font-size: 11pt;
      text-align: left;
      margin-bottom: 1pt;
      line-height: 1.15;
      white-space: normal;
      overflow-wrap: break-word;
      word-break: break-word;
    }

    /* Chord names — SVG row sharing the tab's measure geometry so each name
       sits exactly over the tab column its frets were stamped to. */
    .chord-names-row {
      width: 100%;
      margin-bottom: 0;
    }

    .chord-names-row svg {
      display: block;
      width: 100%;
      height: auto;
    }

    /* Row-spanning Containers — no min-height / no padding; the SVGs are
       already viewBox-cropped to their real content, so height comes from the
       content itself, not reserved whitespace. */
    /* Fixed heights keep all 16 bars on one page: the SVGs keep full width for
       horizontal alignment but letterbox to these heights (xMidYMid meet), so a
       note-heavy staff can't balloon the row. Tuned so 4 rows fit a Letter page. */
    .row-tablature {
      width: 100%;
      background: #fff;
      border: none;
      line-height: 0;
      page-break-inside: avoid;
      margin: 0;
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
      line-height: 0;
      page-break-inside: avoid;
      /* Pull the staff up ~5px so its top sits closer to the tablature. */
      margin: -5pt 0 0 0;
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
      <div class="title">
        ${escapeHtml(composition.title)}${composition.artist ? `<span class="artist">${escapeHtml(composition.artist)}</span>` : ''}
      </div>
      <div class="settings">
        <span><b>Key:</b> ${escapeHtml(settings.key || 'C')}</span>
        <span><b>Tempo:</b> ${settings.tempo || 120} BPM</span>
        <span><b>Time:</b> ${timeSignature}</span>
        <span><b>Capo:</b> ${settings.capo ? `Fret ${settings.capo}` : 'None'}</span>
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
 * Render one row's staff (VexFlow, from the tab model) off-screen in the main
 * document and return it as an SVG string that scales to the printed width.
 * This is the same renderer the editor uses, so print matches the screen.
 */
async function generateStaffSvg(
  barTab: Record<string, import('../../models/Tablature').TabCell>,
  rowStartBar: number,
  composition: Composition
): Promise<string> {
  const ts = composition.globalSettings.timeSignature;
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-10000px';
  container.style.top = '0';
  document.body.appendChild(container);

  try {
    await renderStaffToContainer(container, {
      width: ROW_WIDTH,
      height: STAFF_HEIGHT,
      numMeasures: 4,
      tsBeats: ts?.beats || 4,
      tsBeatValue: ts?.beatValue || 4,
      tuning: composition.globalSettings.tuning?.notes || ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'],
      barTab,
      rowStartBar,
      scale: STAFF_SCALE,
    });

    const svg = container.querySelector('svg') as SVGSVGElement | null;
    if (!svg) return '';
    // Crop to a FIXED-height window anchored on the staff so every row prints
    // the same compact height (letting all 16 bars fit one page) instead of
    // note-heavy rows ballooning. The window is tall enough for the 5-line
    // stave plus a few ledger positions each way; notes further out clip
    // slightly rather than stretch the whole page. Centered on the content's
    // vertical midpoint so notes above and below the staff share the room.
    let vbY = 0, vbH = STAFF_WINDOW;
    try {
      const bbox = svg.getBBox();
      const mid = bbox.y + bbox.height / 2;
      vbY = mid - STAFF_WINDOW / 2;
    } catch {
      // getBBox can throw if not measurable; fall back to top of canvas.
    }
    svg.setAttribute('viewBox', `0 ${vbY} ${ROW_WIDTH} ${vbH}`);
    svg.setAttribute('width', '100%');
    svg.removeAttribute('height');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.removeAttribute('style');
    return svg.outerHTML;
  } catch (error) {
    console.error('Print staff render failed:', error);
    return '';
  } finally {
    container.remove();
  }
}

/**
 * Generate HTML for a single page (always the full 4 rows x 4 bars = 16 bars,
 * so empty bars still print as usable staff/tab structure).
 */
async function generatePageHtml(
  page: PageData,
  pageNumber: number,
  totalPages: number,
  options: PrintOptions,
  beatsPerBar: number,
  composition: Composition,
  chordsData: ChordData[]
): Promise<string> {
  const barsHtml: string[] = [];
  const barTab = page.barTab || {};
  const ts = composition.globalSettings.timeSignature;
  const cellsPerBar = cellsPerBarFor(ts?.beats || 4, ts?.beatValue || 4);
  const layout = getMeasureLayout(ROW_WIDTH, 4);

  // 4 rows of 4 bars each — always rendered, content or not.
  for (let rowIndex = 0; rowIndex < 4; rowIndex++) {
    const rowStartBar = rowIndex * 4;

    const tabSvg = options.includeTablature
      ? generateTablatureHtml(barTab, ROW_WIDTH, TAB_HEIGHT, cellsPerBar, rowStartBar, 4)
      : '';
    const staffSvg = options.includeNotation
      ? await generateStaffSvg(barTab, rowStartBar, composition)
      : '';

    // Lyrics are authored as one line spanning the whole row (stored at the
    // first bar of the row), so render them once, full-width, above the bars.
    const rowLyrics = page.barLyrics[rowStartBar] || '';

    // Chord names as an SVG row using the same geometry as the tab. Each label
    // sits at the 16th cell its frets were stamped to (see stampChordToTab),
    // so chords line up exactly with their tab columns and staff notes.
    const chordTexts: string[] = [];
    for (let colIndex = 0; colIndex < 4; colIndex++) {
      const barIndex = rowStartBar + colIndex;
      const beatChords = page.barBeatChords[barIndex] || [];
      beatChords.forEach((chordName, beatIndex) => {
        if (!chordName || chordName.trim() === '') return;
        const stampCell = Math.round((beatIndex / beatsPerBar) * cellsPerBar);
        const x = getSubdivisionX(colIndex * cellsPerBar + stampCell, cellsPerBar, layout);
        const chord = chordsData.find((c) => c.name === chordName);
        const label = shortChordName(chordName, chord?.startingFret || 0);
        chordTexts.push(
          `<text x="${x}" y="12" font-size="10" font-family="Arial, sans-serif" font-weight="bold" fill="#000" text-anchor="middle">${escapeHtml(label)}</text>`
        );
      });
    }
    const chordRowSvg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="100%" viewBox="0 0 ${ROW_WIDTH} 16" preserveAspectRatio="xMidYMid meet" style="display: block;">
        ${chordTexts.join('')}
      </svg>
    `;

    barsHtml.push(`
      <div class="bar-row">
        ${rowLyrics.trim() !== '' ? `<div class="row-lyrics">${escapeHtml(rowLyrics)}</div>` : ''}
        <div class="chord-names-row">${chordRowSvg}</div>
        ${options.includeTablature ? `<div class="row-tablature">${tabSvg}</div>` : ''}
        ${options.includeNotation ? `<div class="row-staff">${staffSvg}</div>` : ''}
      </div>
    `);
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
