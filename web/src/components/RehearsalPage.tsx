import React from 'react';
import { Box } from '@mui/material';
import { LyricLine } from './LyricLine';
import { Tablature } from './Tablature';
import { StaffNotes } from './StaffNotes';
import { MiniChordDiagram, type ChordData } from './ChordDiagram';
import { shortChordName } from '../utils/chordName';
import { CLEF_RESERVE, getMeasureLayout, getSubdivisionX, cellsPerBarFor } from '../utils/rowGeometry';
import type { Composition } from '../models';
import type { PageData } from '../models/Composition';

const PAPER_COLOR = '#f4ecd8';
const BARS_PER_ROW = 4;

interface RehearsalPageProps {
  page: PageData;
  composition: Composition;
  chordsData: ChordData[];
  /** Number of bar-rows to show (matches the editor's rowsForStaff). */
  rows: number;
  /** Show the staff below each tab row. */
  showStaff: boolean;
  /** Content width for this page's notation; rows/geometry scale to it. */
  contentWidth: number;
  paperWidth: number;
  paperMargin: number;
  /** 1-based page number shown in the corner. */
  pageNumber: number;
}

/**
 * Read-only render of a single composition page — a parchment "sheet" showing
 * the same lyrics / chord names / tablature / staff as the editor, but with no
 * editing affordances. Geometry is derived from `contentWidth` so the same page
 * can render narrower for a side-by-side rehearsal spread. Mirrors the editor's
 * per-row render (EditorScreen row loop) and the print layout.
 */
export const RehearsalPage: React.FC<RehearsalPageProps> = ({
  page, composition, chordsData, rows, showStaff, contentWidth, paperWidth, paperMargin, pageNumber,
}) => {
  const settings = composition.globalSettings;
  const chordsPerBar = settings.chordsPerBar || 4;
  const tsBeats = settings.timeSignature.beats;
  const tsBeatValue = settings.timeSignature.beatValue;
  const cellsPerBar = cellsPerBarFor(tsBeats, tsBeatValue);
  const rowLayout = getMeasureLayout(contentWidth, BARS_PER_ROW);
  const paperHeight = Math.round((paperWidth * 11) / 8.5);

  const barLyrics = page.barLyrics || [];
  const barBeatChords = page.barBeatChords || [];
  const barTab = page.barTab || {};
  const emptyBar = Array(chordsPerBar).fill('');

  // Chords used on this page, for the reference strip at the top.
  const used = new Set<string>();
  barBeatChords.forEach((bar) => bar.forEach((c) => { if (c) used.add(c); }));
  const uniqueChords = Array.from(used)
    .map((name) => chordsData.find((c) => c.name === name))
    .filter((c): c is ChordData => c !== undefined);

  return (
    <Box
      sx={{
        width: paperWidth, minHeight: paperHeight, py: `${paperMargin}px`,
        bgcolor: PAPER_COLOR, boxShadow: 3, borderRadius: 1, position: 'relative', flexShrink: 0,
      }}
    >
      <Box sx={{ position: 'absolute', top: 8, right: 16, fontSize: 12, color: 'rgba(0,0,0,0.4)' }}>
        {pageNumber}
      </Box>

      {uniqueChords.length > 0 && (
        <Box
          sx={{
            width: contentWidth, mx: `${paperMargin}px`, pl: `${Math.max(0, contentWidth * 0.0125 - 5)}px`,
            pt: 1, pb: 0, display: 'flex', gap: 1.5, flexWrap: 'wrap',
          }}
        >
          {uniqueChords.map((chord, index) => (
            <MiniChordDiagram key={index} chord={chord} background={PAPER_COLOR} />
          ))}
        </Box>
      )}

      <Box sx={{ width: contentWidth, mx: `${paperMargin}px`, pt: 0, pb: '10px' }}>
        {Array.from({ length: rows }, (_, rowIndex) => {
          const rowBeatChords = [0, 1, 2, 3]
            .map((colIndex) => barBeatChords[rowIndex * 4 + colIndex] || emptyBar)
            .flat();

          return (
            <Box key={rowIndex} sx={{ mb: '12px' }}>
              <LyricLine
                value={barLyrics[rowIndex * 4] || ''}
                width={contentWidth}
                justify={settings.lyricSpacing !== 'left'}
                readOnly
                onChange={() => {}}
              />

              {/* Chord names — spans (not buttons); empty slots render nothing. */}
              <Box sx={{ position: 'relative', height: 24, mb: '5px' }}>
                {[0, 1, 2, 3].map((colIndex) => {
                  const barIndex = rowIndex * 4 + colIndex;
                  const barWidth = colIndex === 0 ? rowLayout.firstMeasureWidth : rowLayout.otherMeasureWidth;
                  const reserve = colIndex === 0 ? CLEF_RESERVE : 0;
                  const beatWidth = (barWidth - reserve) / chordsPerBar;
                  const barSlots = barBeatChords[barIndex] || emptyBar;
                  return Array.from({ length: chordsPerBar }, (_, beatIndex) => {
                    const chordName = barSlots[beatIndex] || '';
                    if (!chordName) return null;
                    const chord = chordsData.find((c) => c.name === chordName);
                    const label = shortChordName(chordName, chord?.startingFret);
                    const stampCell = Math.round((beatIndex / chordsPerBar) * cellsPerBar);
                    const x = getSubdivisionX(colIndex * cellsPerBar + stampCell, cellsPerBar, rowLayout);
                    return (
                      <span
                        key={`${colIndex}-${beatIndex}`}
                        style={{
                          position: 'absolute', left: x - beatWidth / 2, top: 0,
                          width: beatWidth, height: 24, display: 'flex',
                          justifyContent: 'center', alignItems: 'center',
                          fontSize: 14, fontWeight: 'bold', color: '#000',
                        }}
                      >
                        {label}
                      </span>
                    );
                  });
                })}
              </Box>

              <Box sx={{ py: '4px', bgcolor: PAPER_COLOR, position: 'relative', overflow: 'hidden' }}>
                <Tablature
                  beatChords={rowBeatChords}
                  chordsData={chordsData}
                  width={contentWidth}
                  height={65}
                  numMeasures={4}
                  beatsPerBar={chordsPerBar}
                  tsBeats={tsBeats}
                  tsBeatValue={tsBeatValue}
                  paperColor={PAPER_COLOR}
                  rowStartBar={rowIndex * 4}
                  barTab={barTab}
                  /* no onCellClick → read-only */
                />
              </Box>

              {showStaff && (
                <Box sx={{ pt: 0, pb: 0, mt: '-5px', bgcolor: PAPER_COLOR, height: 110, position: 'relative', overflow: 'hidden' }}>
                  <StaffNotes
                    beatChords={rowBeatChords}
                    width={contentWidth}
                    height={150}
                    numMeasures={4}
                    beatsPerBar={chordsPerBar}
                    tsBeats={tsBeats}
                    tsBeatValue={tsBeatValue}
                    tuning={settings.tuning.notes}
                    keySignature={settings.key}
                    barTab={barTab}
                    rowStartBar={rowIndex * 4}
                  />
                </Box>
              )}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};
