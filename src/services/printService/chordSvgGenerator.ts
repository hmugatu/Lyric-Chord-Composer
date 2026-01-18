/**
 * SVG Chord Diagram Generator for Print Output
 * Creates inline SVG chord diagrams from chord data
 */

export interface ChordData {
  name: string;
  startingFret: number;
  fingering: string[];
  openStrings: number[];
  mutedStrings: number[];
  commonFingeringNotes: string;
}

export type ChordSize = 'small' | 'medium' | 'large';

interface SvgDimensions {
  width: number;
  height: number;
  fretHeight: number;
  stringSpacing: number;
  topPadding: number;
  sidePadding: number;
  dotRadius: number;
  fontSize: number;
  indicatorSize: number;
}

const DIMENSIONS: Record<ChordSize, SvgDimensions> = {
  small: {
    width: 70,
    height: 90,
    fretHeight: 10,
    stringSpacing: 8,
    topPadding: 24,
    sidePadding: 10,
    dotRadius: 3,
    fontSize: 9,
    indicatorSize: 5,
  },
  medium: {
    width: 90,
    height: 120,
    fretHeight: 16,
    stringSpacing: 12,
    topPadding: 24,
    sidePadding: 15,
    dotRadius: 5,
    fontSize: 12,
    indicatorSize: 7,
  },
  large: {
    width: 140,
    height: 180,
    fretHeight: 24,
    stringSpacing: 18,
    topPadding: 32,
    sidePadding: 22,
    dotRadius: 7,
    fontSize: 16,
    indicatorSize: 10,
  },
};

const NUM_STRINGS = 6;
const NUM_FRETS = 5;

/**
 * Generate an SVG chord diagram as a string
 */
export function generateChordSvg(chord: ChordData, size: ChordSize = 'medium'): string {
  const dim = DIMENSIONS[size];
  const fingeringNums = chord.fingering.map(f => f === 'x' ? null : parseInt(f, 10));

  const gridWidth = dim.stringSpacing * (NUM_STRINGS - 1);
  const gridHeight = dim.fretHeight * NUM_FRETS;
  const gridStartX = dim.sidePadding;
  const gridStartY = dim.topPadding;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${dim.width}" height="${dim.height}" viewBox="0 0 ${dim.width} ${dim.height}">`;

  // Background
  svg += `<rect width="${dim.width}" height="${dim.height}" fill="white"/>`;

  // Chord name
  const nameText = chord.name + (chord.startingFret > 1 ? ` ${chord.startingFret}fr` : '');
  svg += `<text x="${dim.width / 2}" y="${dim.fontSize}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${dim.fontSize}" font-weight="bold" fill="#333">${escapeXml(nameText)}</text>`;

  // Open/Muted string indicators (above the nut)
  for (let stringIdx = 0; stringIdx < NUM_STRINGS; stringIdx++) {
    const x = gridStartX + (stringIdx * dim.stringSpacing);
    const y = gridStartY - dim.indicatorSize - 2;

    if (chord.mutedStrings.includes(stringIdx)) {
      // X for muted
      const offset = dim.indicatorSize / 2;
      svg += `<line x1="${x - offset}" y1="${y - offset}" x2="${x + offset}" y2="${y + offset}" stroke="#333" stroke-width="1.5"/>`;
      svg += `<line x1="${x + offset}" y1="${y - offset}" x2="${x - offset}" y2="${y + offset}" stroke="#333" stroke-width="1.5"/>`;
    } else if (chord.openStrings.includes(stringIdx)) {
      // O for open
      svg += `<circle cx="${x}" cy="${y}" r="${dim.indicatorSize / 2}" fill="none" stroke="#333" stroke-width="1.5"/>`;
    }
  }

  // Nut (thick line at top if starting from fret 0 or 1)
  if (chord.startingFret <= 1) {
    svg += `<rect x="${gridStartX - 1}" y="${gridStartY}" width="${gridWidth + 2}" height="3" fill="#333"/>`;
  }

  // Fret lines
  for (let fret = 0; fret <= NUM_FRETS; fret++) {
    const y = gridStartY + (fret * dim.fretHeight);
    svg += `<line x1="${gridStartX}" y1="${y}" x2="${gridStartX + gridWidth}" y2="${y}" stroke="#333" stroke-width="1"/>`;
  }

  // String lines (vertical)
  for (let stringIdx = 0; stringIdx < NUM_STRINGS; stringIdx++) {
    const x = gridStartX + (stringIdx * dim.stringSpacing);
    svg += `<line x1="${x}" y1="${gridStartY}" x2="${x}" y2="${gridStartY + gridHeight}" stroke="#333" stroke-width="1"/>`;
  }

  // Finger dots
  for (let stringIdx = 0; stringIdx < NUM_STRINGS; stringIdx++) {
    const fretNum = fingeringNums[stringIdx];
    if (fretNum !== null && fretNum > 0) {
      const displayFret = chord.startingFret > 1 ? fretNum - chord.startingFret + 1 : fretNum;
      if (displayFret >= 1 && displayFret <= NUM_FRETS) {
        const x = gridStartX + (stringIdx * dim.stringSpacing);
        const y = gridStartY + ((displayFret - 0.5) * dim.fretHeight);
        svg += `<circle cx="${x}" cy="${y}" r="${dim.dotRadius}" fill="#333"/>`;
      }
    }
  }

  svg += '</svg>';
  return svg;
}

/**
 * Escape special XML characters
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Get all unique chords used in pages, filtering out empty strings
 */
export function getUsedChords(
  pages: { barBeatChords: string[][] }[],
  chordsData: ChordData[]
): ChordData[] {
  const usedChordNames = new Set<string>();

  for (const page of pages) {
    for (const bar of page.barBeatChords) {
      for (const chord of bar) {
        if (chord && chord.trim() !== '') {
          usedChordNames.add(chord);
        }
      }
    }
  }

  return Array.from(usedChordNames)
    .map(name => chordsData.find(c => c.name === name))
    .filter((chord): chord is ChordData => chord !== undefined);
}
