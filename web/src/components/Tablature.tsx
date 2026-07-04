/**
 * Tablature Component (web)
 * Renders 6-string guitar tab with absolutely-positioned divs.
 * Measure-width math matches StaffNotes so tab and staff stay aligned.
 *
 * Two subdivisions share the same per-measure geometry:
 *  - beatsPerBar: chord slots, used to draw the FAINT chord-derived frets.
 *  - cellsPerBar: 16th-note grid (tsBeats*16/tsBeatValue), used for the SOLID
 *    user-entered frets and the invisible interactive click grid.
 */

import React from 'react';
import type { TabCell } from '../models/Tablature';
import { formatFretWithTechniques } from '../utils/tabTechnique';
import { CLEF_RESERVE, cellsPerBarFor, getMeasureLayout, getSubdivisionX } from '../utils/rowGeometry';

interface ChordData {
  name: string;
  startingFret: number;
  fingering: string[];
  openStrings: number[];
  mutedStrings: number[];
}

interface TablatureProps {
  beatChords: string[];
  chordsData: ChordData[];
  width: number;
  height?: number;
  numMeasures?: number;
  beatsPerBar?: number;
  tsBeats?: number;
  tsBeatValue?: number;
  paperColor?: string;
  /** Absolute bar index this row starts at (rowIndex * 4), for keying barTab. */
  rowStartBar?: number;
  /** Sparse user frets, keyed "bar:cell:string" (see PageData.barTab). */
  barTab?: Record<string, TabCell>;
  /** Called when an interactive cell is clicked, with an anchor rect for a popover. */
  onCellClick?: (bar: number, cell: number, string: number, anchor: DOMRect) => void;
}

// String display order top->bottom is [e B G D A E] (high string on top).
// Model string index is low->high (0=E .. 5=e), so display row r maps to
// model string (5 - r).
const NUM_STRINGS = 6;

export const Tablature: React.FC<TablatureProps> = ({
  beatChords,
  chordsData,
  width,
  height = 60,
  numMeasures = 4,
  beatsPerBar = 4,
  tsBeats = 4,
  tsBeatValue = 4,
  paperColor = '#fff',
  rowStartBar = 0,
  barTab,
  onCellClick,
}) => {
  // Shared geometry (also used by the print service) keeps tab, staff, and
  // print output aligned.
  const layout = getMeasureLayout(width, numMeasures);
  const { firstMeasureWidth, otherMeasureWidth } = layout;

  // 16th-note cells per bar, driven by the time signature.
  const cellsPerBar = cellsPerBarFor(tsBeats, tsBeatValue);

  const stringHeight = height / 6;

  const totalCells = cellsPerBar * numMeasures;

  return (
    <div style={{ display: 'flex', flexDirection: 'row', backgroundColor: paperColor, marginTop: 4, width, height }}>
      <div style={{ flex: 1, position: 'relative' }}>
        {/* Horizontal string lines */}
        {[0, 1, 2, 3, 4, 5].map((stringIndex) => (
          <div
            key={`string-${stringIndex}`}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              height: 1,
              backgroundColor: '#888',
              top: stringHeight * stringIndex + stringHeight / 2,
            }}
          />
        ))}

        {/* Vertical bar lines */}
        {layout.barLineXs.map((xPos, index) => (
          <div
            key={`bar-${index}`}
            style={{ position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: '#333', left: xPos }}
          />
        ))}

        {/* Tab frets (stamped from chords or hand-entered), at 16th-cell positions */}
        {barTab &&
          Object.entries(barTab).map(([key, cellData]) => {
            const [bar, cell, modelString] = key.split(':').map(Number);
            // Only render cells that belong to the measures shown in this row.
            const localBar = bar - rowStartBar;
            if (localBar < 0 || localBar >= numMeasures) return null;
            const globalCell = localBar * cellsPerBar + cell;
            const x = getSubdivisionX(globalCell, cellsPerBar, layout);
            const row = NUM_STRINGS - 1 - modelString; // display row
            const yPos = stringHeight * row + stringHeight / 2;
            const displayValue = formatFretWithTechniques(cellData.fret, cellData.techniques);
            return (
              <div
                key={`tab-${key}`}
                style={{
                  position: 'absolute', left: x, top: yPos - 7, height: 14, transform: 'translateX(-50%)',
                  display: 'flex', justifyContent: 'center', alignItems: 'center', pointerEvents: 'none',
                  whiteSpace: 'nowrap',
                }}
              >
                <span
                  style={{
                    fontSize: 11, fontWeight: 700, color: '#000',
                    fontFamily: 'monospace', backgroundColor: paperColor, padding: '0 1px', lineHeight: 1,
                  }}
                >
                  {displayValue}
                </span>
              </div>
            );
          })}

        {/* INVISIBLE interactive 16th-note grid: one hit target per (cell, string) */}
        {onCellClick &&
          Array.from({ length: totalCells }, (_, globalCell) => {
            const x = getSubdivisionX(globalCell, cellsPerBar, layout);
            const measureIndex = Math.floor(globalCell / cellsPerBar);
            const measureWidth = measureIndex === 0 ? firstMeasureWidth : otherMeasureWidth;
            const cellW = Math.max(6, (measureWidth - (measureIndex === 0 ? CLEF_RESERVE : 0)) / cellsPerBar);
            const bar = rowStartBar + measureIndex;
            const cell = globalCell % cellsPerBar;
            return [0, 1, 2, 3, 4, 5].map((row) => {
              const modelString = NUM_STRINGS - 1 - row;
              const yPos = stringHeight * row + stringHeight / 2;
              return (
                <button
                  key={`hit-${globalCell}-${row}`}
                  onClick={(e) => onCellClick(bar, cell, modelString, (e.currentTarget as HTMLElement).getBoundingClientRect())}
                  title=""
                  style={{
                    position: 'absolute',
                    left: x - cellW / 2,
                    top: yPos - stringHeight / 2,
                    width: cellW,
                    height: stringHeight,
                    background: 'transparent',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                  }}
                />
              );
            });
          })}
      </div>
    </div>
  );
};
