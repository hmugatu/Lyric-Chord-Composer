/**
 * Staff Notes Component (web)
 * Renders musical notes on a staff using VexFlow. Chord names are converted to
 * notes with tonal.js. Ported from the RN component (web branch only).
 */

import React, { useEffect, useRef } from 'react';
import * as Tonal from '@tonaljs/tonal';
import type { TabCell as TabCellT } from '../models/Tablature';
import { cellsPerBarFor, getMeasureLayout } from '../utils/rowGeometry';

interface StaffNotesProps {
  beatChords: string[];
  width: number;
  height: number;
  numMeasures?: number;
  beatsPerBar?: number;
  /** Time signature numerator (e.g. 3 in 3/4). */
  tsBeats?: number;
  /** Time signature denominator (e.g. 8 in 6/8). */
  tsBeatValue?: number;
  /** Open-string tuning notes low->high, e.g. ["E2","A2","D3","G3","B3","E4"]. */
  tuning?: string[];
  /** Sparse user tab frets keyed "bar:cell:string" (see PageData.barTab). */
  barTab?: Record<string, import('../models/Tablature').TabCell>;
  /** Absolute bar index this row starts at. */
  rowStartBar?: number;
  scale?: number;
  /** Composition key (e.g. "C", "G", "Am") for the staff key signature. */
  keySignature?: string;
}

// VexFlow tick constants (a whole note = 4096 ticks).
const WHOLE_TICKS = 4096;

// Map a tick count to the nearest clean VexFlow duration string. Falls back to
// the largest value that fits, so any measure/slot combo renders without error.
function ticksToDuration(ticks: number): { duration: string; ticks: number } {
  const table: { t: number; d: string }[] = [
    { t: WHOLE_TICKS, d: 'w' },        // whole
    { t: WHOLE_TICKS * 0.75, d: 'hd' }, // dotted half
    { t: WHOLE_TICKS / 2, d: 'h' },    // half
    { t: WHOLE_TICKS * 0.375, d: 'qd' }, // dotted quarter
    { t: WHOLE_TICKS / 4, d: 'q' },    // quarter
    { t: WHOLE_TICKS / 8, d: '8' },    // eighth
    { t: WHOLE_TICKS / 16, d: '16' },  // sixteenth
  ];
  for (const row of table) {
    if (ticks >= row.t) return { duration: row.d, ticks: row.t };
  }
  return { duration: '16', ticks: WHOLE_TICKS / 16 };
}

function getChordNotesVexFlow(chordName: string): string[] {
  if (!chordName || chordName.trim() === '' || chordName === '-') {
    return [];
  }

  try {
    const cleanName = chordName
      .replace(/\s*\(easy\)/gi, '')
      .replace(/\s*\(barre\)/gi, '')
      .replace(/\s*\(alt\)/gi, '')
      .trim();

    const rootMatch = cleanName.match(/^([A-G][#b]?)/i);
    const root = rootMatch ? rootMatch[1].toUpperCase() : null;

    const tonalName = cleanName
      .replace(/\s+major$/i, '')
      .replace(/\s+minor$/i, 'm')
      .replace(/\s+/g, '');

    let chord = Tonal.Chord.get(tonalName);

    if (!chord.notes || chord.notes.length === 0) {
      if (root && /^[A-G][#b]?5$/.test(tonalName)) {
        const rootNote = formatNoteForVexFlow(root, 3);
        const fifth = getFifth(root);
        return [rootNote, formatNoteForVexFlow(fifth, 3)];
      }
      if (root) {
        chord = Tonal.Chord.get(root);
      }
    }

    if (!chord.notes || chord.notes.length === 0) {
      if (root) {
        return [formatNoteForVexFlow(root, 4)];
      }
      return [];
    }

    return chord.notes.slice(0, 4).map((noteName) => formatNoteForVexFlow(noteName, 4));
  } catch (error) {
    console.warn('Failed to parse chord:', chordName, error);
    return [];
  }
}

function getFifth(root: string): string {
  const fifths: { [key: string]: string } = {
    C: 'G', 'C#': 'G#', Db: 'Ab',
    D: 'A', 'D#': 'A#', Eb: 'Bb',
    E: 'B', F: 'C', 'F#': 'C#',
    Gb: 'Db', G: 'D', 'G#': 'D#',
    Ab: 'Eb', A: 'E', 'A#': 'E#',
    Bb: 'F', B: 'F#',
  };
  return fifths[root] || 'E';
}

function formatNoteForVexFlow(noteName: string, octave: number): string {
  const note = noteName.toLowerCase().replace('♯', '#').replace('♭', 'b');
  return `${note}/${octave}`;
}

const STANDARD_OPEN = ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'];

// (string index 0-5 low->high, fret) -> VexFlow key like "c#/4", using the
// composition tuning (open-string note transposed up by `fret` semitones).
function fretToVexKey(stringIndex: number, fret: number, tuning: string[]): string | null {
  const open = tuning[stringIndex] || STANDARD_OPEN[stringIndex];
  if (!open) return null;
  try {
    const pitch = Tonal.Note.transpose(open, Tonal.Interval.fromSemitones(fret));
    const parsed = Tonal.Note.get(pitch);
    if (!parsed || parsed.empty || parsed.oct == null) return null;
    const acc = parsed.acc || '';
    return `${parsed.letter.toLowerCase()}${acc}/${parsed.oct}`;
  } catch {
    return null;
  }
}

// VexFlow key signatures it can draw (major keys + relative minors written
// as "Xm"). Composition keys outside this set (e.g. Cb, Gb, D#m) are enharmonic
// oddities we map to their playable equivalent or fall back to C (no signature).
const VEX_KEY_SIGNATURES = new Set([
  'C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#',
  'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb',
  'Am', 'Em', 'Bm', 'F#m', 'C#m', 'G#m', 'D#m', 'A#m',
  'Dm', 'Gm', 'Cm', 'Fm', 'Bbm', 'Ebm', 'Abm',
]);

/** Normalize a composition key to a VexFlow-drawable key signature, or 'C'. */
function toVexKeySignature(key?: string): string {
  if (!key) return 'C';
  const k = key.trim();
  return VEX_KEY_SIGNATURES.has(k) ? k : 'C';
}

// Map a NoteDuration model value to a VexFlow duration string.
const DURATION_TO_VF: Record<string, string> = {
  whole: 'w', half: 'h', quarter: 'q', eighth: '8', sixteenth: '16', 'thirty-second': '32',
};

export interface StaffRenderOptions {
  width: number;
  height: number;
  numMeasures: number;
  tsBeats: number;
  tsBeatValue: number;
  tuning: string[];
  barTab: Record<string, TabCellT>;
  rowStartBar: number;
  scale: number;
  /** Composition key (e.g. "C", "G", "Am", "Bb") for the staff key signature. */
  keySignature?: string;
}

/**
 * Render one row of staff notation (from the tab model) into `container` as a
 * VexFlow SVG. Shared by the on-screen StaffNotes component and the print
 * service so printed staves match the editor exactly.
 */
export async function renderStaffToContainer(
  container: HTMLElement,
  { width, height, numMeasures, tsBeats, tsBeatValue, tuning, barTab, rowStartBar, scale, keySignature }: StaffRenderOptions
): Promise<void> {
  const VexFlow = await import('vexflow');
  const vf: any = (VexFlow as any).default || VexFlow;
  const { Renderer, Stave, StaveNote, Voice, Formatter, Accidental, GhostNote } = vf;

  container.innerHTML = '';

  const renderer = new Renderer(container, Renderer.Backends.SVG);
  renderer.resize(width, height);
  const context = renderer.getContext();
  // Scale glyphs down for a cleaner look; geometry below is expressed in
  // real pixels and divided by `scale` so it lands at true pixel coords
  // after the context multiplies by `scale`. This keeps measure bar lines
  // aligned with the Tablature component, which uses identical pixel math.
  context.scale(scale, scale);
  context.setFont('Arial', 10);

  // Measure widths in REAL pixels — shared with Tablature/print tab geometry.
  const layout = getMeasureLayout(width, numMeasures);

  for (let m = 0; m < numMeasures; m++) {
    const xPos = layout.barLineXs[m];
    const measureWidth = m === 0 ? layout.firstMeasureWidth : layout.otherMeasureWidth;

    // Convert real-pixel geometry into draw space (context is scaled by `scale`).
    const stave = new Stave(xPos / scale, 0, measureWidth / scale);
    if (m === 0) {
      stave.addClef('treble');
      stave.addTimeSignature(`${tsBeats}/${tsBeatValue}`);
      const vfKey = toVexKeySignature(keySignature);
      // C major / A minor have no accidentals — skip drawing an empty signature.
      if (vfKey && vfKey !== 'C') {
        try {
          stave.addKeySignature(vfKey);
        } catch {
          /* Unknown key spelling — leave the staff without a signature. */
        }
      }
    }
    stave.setContext(context).draw();

    const notes: any[] = [];

    // Cells per bar on the 16th grid; each occupied cell becomes a staff
    // note (stacked = chord). Empty cells become ghost notes for timing.
    const cellsPerBar = cellsPerBarFor(tsBeats, tsBeatValue);
    const bar = rowStartBar + m;

    // Group this measure's tab cells by cell index -> { string: TabCell }.
    const byCell = new Map<number, { string: number; cell: TabCellT }[]>();
    for (const [key, cellData] of Object.entries(barTab || {})) {
      const [b, cIdx, s] = key.split(':').map(Number);
      if (b !== bar) continue;
      if (cellData.fret === 'x') continue; // muted string -> no staff pitch
      const list = byCell.get(cIdx) || [];
      list.push({ string: s, cell: cellData });
      byCell.set(cIdx, list);
    }

    // Default ghost-note duration = one 16th cell.
    const cellDur = DURATION_TO_VF['sixteenth'];
    // One 16th cell in VexFlow ticks, for coalescing empty runs into a single
    // ghost note. Emitting one ghost per 16th cell (up to 15 per bar) plus a
    // wide chord overflowed the measure and clipped the notes off the right;
    // coalescing keeps the tickable count low so notes stay inside the stave.
    const cellTicks = WHOLE_TICKS / 16;

    // Push a ghost note spanning `runCells` empty 16th cells, broken into clean
    // durations so VexFlow can render it (e.g. 8 empty cells -> one half rest).
    const pushEmptyRun = (runCells: number) => {
      let remaining = runCells * cellTicks;
      while (remaining > 0) {
        const { duration, ticks } = ticksToDuration(remaining);
        notes.push(new GhostNote({ duration }));
        remaining -= ticks;
      }
    };

    let emptyRun = 0;
    for (let c = 0; c < cellsPerBar; c++) {
      const group = byCell.get(c);
      const keys = group
        ? group.map((g) => fretToVexKey(g.string, g.cell.fret as number, tuning)).filter((k): k is string => !!k)
        : [];
      if (keys.length > 0) {
        if (emptyRun > 0) { pushEmptyRun(emptyRun); emptyRun = 0; }
        // Duration: use the longest chosen among stacked notes (they share a stem).
        const durModel = group!.find((g) => g.cell.duration)?.cell.duration || 'sixteenth';
        const duration = DURATION_TO_VF[durModel] || cellDur;
        const staveNote = new StaveNote({ keys, duration });
        keys.forEach((k, i) => {
          if (k.includes('#')) staveNote.addModifier(new Accidental('#'), i);
          else if (k.includes('b') && !k.startsWith('b')) staveNote.addModifier(new Accidental('b'), i);
        });
        notes.push(staveNote);
      } else {
        emptyRun += 1;
      }
    }
    if (emptyRun > 0) pushEmptyRun(emptyRun);

    // Non-strict: chords-per-bar and the time signature don't always divide
    // evenly (e.g. 8 slots in 3/4), so allow approximate tick sums rather
    // than throwing. Fine for a guitar-forward chart.
    const voice = new Voice({ numBeats: tsBeats, beatValue: tsBeatValue });
    voice.setStrict(false);
    voice.addTickables(notes);

    // formatWidth is in draw space (stave was placed in draw space above).
    const formatWidth = (m === 0 ? measureWidth - 80 : measureWidth - 20) / scale;
    new Formatter().joinVoices([voice]).format([voice], formatWidth);
    voice.draw(context, stave);
  }
}

export const StaffNotes: React.FC<StaffNotesProps> = ({
  width,
  height,
  numMeasures = 1,
  tsBeats = 4,
  tsBeatValue = 4,
  tuning = STANDARD_OPEN,
  barTab = {},
  rowStartBar = 0,
  scale = 0.75,
  keySignature,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    renderStaffToContainer(containerRef.current, {
      width, height, numMeasures, tsBeats, tsBeatValue, tuning, barTab, rowStartBar, scale, keySignature,
    }).catch((error) => {
      console.error('VexFlow render error:', error);
    });
  }, [barTab, tuning, rowStartBar, width, height, numMeasures, tsBeats, tsBeatValue, scale, keySignature]);

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      <div ref={containerRef} style={{ width: '100%', height }} />
    </div>
  );
};
