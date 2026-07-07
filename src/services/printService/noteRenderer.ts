/**
 * Print tablature renderer.
 * Draws one row of tab (numMeasures bars) as an inline SVG from the unified
 * tab model (PageData.barTab) using the same shared geometry as the on-screen
 * Tablature component, so printed frets land exactly where the editor shows
 * them. Staff notation for print is produced by renderStaffToContainer in
 * components/StaffNotes.tsx (VexFlow), not here.
 */

import type { TabTechnique } from '../../models/Tablature';
import { formatFretWithTechniques } from '../../utils/tabTechnique';
import { getMeasureLayout, getSubdivisionX } from '../../utils/rowGeometry';

/** A user-entered tab cell for print (mirror of models/Tablature TabCell). */
export interface UserTabCell {
  fret: number | 'x';
  techniques?: TabTechnique[];
  duration?: string;
}

const NUM_STRINGS = 6;

/**
 * Generate inline SVG for one row of tablature in HTML print output.
 * Always emits the full structure (string lines + bar lines), even when the
 * row has no tab entries, so empty bars still print as a usable grid.
 */
export function generateTablatureHtml(
  barTab: Record<string, UserTabCell>,
  width: number,
  tabHeight: number,
  cellsPerBar: number,
  rowStartBar: number,
  numMeasures = 4
): string {
  const layout = getMeasureLayout(width, numMeasures);
  const stringHeight = tabHeight / NUM_STRINGS;

  // Horizontal string lines (top row = high e), full content width.
  const stringLines = Array.from({ length: NUM_STRINGS }, (_, row) => {
    const y = stringHeight * row + stringHeight / 2;
    return `<line x1="0" y1="${y}" x2="${width}" y2="${y}" stroke="#888" stroke-width="0.75" />`;
  }).join('');

  // Vertical bar lines at the shared measure boundaries.
  const barLines = layout.barLineXs
    .map((x) => `<line x1="${x}" y1="${stringHeight / 2}" x2="${x}" y2="${tabHeight - stringHeight / 2}" stroke="#333" stroke-width="1" />`)
    .join('');

  // Solid frets from the tab model at their 16th-cell positions.
  const frets = Object.entries(barTab || {})
    .map(([key, cellData]) => {
      const [bar, cell, modelString] = key.split(':').map(Number);
      const localBar = bar - rowStartBar;
      if (localBar < 0 || localBar >= numMeasures) return '';
      const globalCell = localBar * cellsPerBar + cell;
      const x = getSubdivisionX(globalCell, cellsPerBar, layout);
      const row = NUM_STRINGS - 1 - modelString; // display row (top = high e)
      const y = stringHeight * row + stringHeight / 2;
      const displayValue = formatFretWithTechniques(cellData.fret, cellData.techniques as TabTechnique[] | undefined);
      // White backing rect so the fret number reads over the string line,
      // mirroring the editor's paper-colored span background.
      const textWidth = displayValue.length * 6.5;
      return `
        <rect x="${x - textWidth / 2}" y="${y - 5.5}" width="${textWidth}" height="11" fill="#fff" />
        <text x="${x}" y="${y + 3.5}" font-size="10" font-family="monospace" font-weight="700" fill="#000" text-anchor="middle">${escapeXmlText(displayValue)}</text>`;
    })
    .join('');

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="100%" viewBox="0 0 ${width} ${tabHeight}" preserveAspectRatio="xMidYMid meet" style="display: block;">
      ${stringLines}
      ${barLines}
      ${frets}
    </svg>
  `;
}

// Escape text for inclusion in an SVG <text> node (harmonics use < >).
function escapeXmlText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
