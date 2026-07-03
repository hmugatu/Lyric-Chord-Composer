/**
 * Staff Notes Component (web)
 * Renders musical notes on a staff using VexFlow. Chord names are converted to
 * notes with tonal.js. Ported from the RN component (web branch only).
 */

import React, { useEffect, useRef } from 'react';
import * as Tonal from '@tonaljs/tonal';

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
  scale?: number;
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

export const StaffNotes: React.FC<StaffNotesProps> = ({
  beatChords,
  width,
  height,
  numMeasures = 1,
  beatsPerBar = 4,
  tsBeats = 4,
  tsBeatValue = 4,
  scale = 0.75,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const renderStaff = async () => {
      try {
        const VexFlow = await import('vexflow');
        const vf: any = (VexFlow as any).default || VexFlow;
        const { Renderer, Stave, StaveNote, Voice, Formatter, Accidental, GhostNote } = vf;

        containerRef.current!.innerHTML = '';

        const renderer = new Renderer(containerRef.current!, Renderer.Backends.SVG);
        renderer.resize(width, height);
        const context = renderer.getContext();
        // Scale glyphs down for a cleaner look; geometry below is expressed in
        // real pixels and divided by `scale` so it lands at true pixel coords
        // after the context multiplies by `scale`. This keeps measure bar lines
        // aligned with the Tablature component, which uses identical pixel math.
        context.scale(scale, scale);
        context.setFont('Arial', 10);

        // Measure widths in REAL pixels — must match Tablature.tsx exactly.
        const totalWidth = width - 20;
        const firstMeasureWidth = totalWidth / numMeasures + 40;
        const otherMeasureWidth = (totalWidth - firstMeasureWidth) / (numMeasures - 1);

        for (let m = 0; m < numMeasures; m++) {
          let xPos: number, measureWidth: number;
          if (m === 0) {
            xPos = 10;
            measureWidth = firstMeasureWidth;
          } else {
            xPos = 10 + firstMeasureWidth + (m - 1) * otherMeasureWidth;
            measureWidth = otherMeasureWidth;
          }

          // Convert real-pixel geometry into draw space (context is scaled by `scale`).
          const stave = new Stave(xPos / scale, 0, measureWidth / scale);
          if (m === 0) {
            stave.addClef('treble');
            stave.addTimeSignature(`${tsBeats}/${tsBeatValue}`);
          }
          stave.setContext(context).draw();

          const notes: any[] = [];
          const startBeat = m * beatsPerBar;

          // Ticks in one full measure of this time signature, split across slots.
          const measureTicks = (WHOLE_TICKS * tsBeats) / tsBeatValue;
          const slotTicks = measureTicks / beatsPerBar;
          const baseNote = ticksToDuration(slotTicks);

          const processedBeats = new Set<number>();

          for (let b = 0; b < beatsPerBar; b++) {
            if (processedBeats.has(b)) continue;

            const chord = beatChords[startBeat + b] || '';
            const chordNotes = getChordNotesVexFlow(chord);

            // Count consecutive empty slots after this one (how long the chord rings).
            let span = 1;
            for (let c = b + 1; c < beatsPerBar; c++) {
              const nextChord = beatChords[startBeat + c] || '';
              if (!nextChord || nextChord.trim() === '' || nextChord === '-') {
                span++;
              } else {
                break;
              }
            }

            if (chordNotes.length > 0) {
              // Render the chord at the largest clean duration that fits its span,
              // then pad the leftover span with ghost notes so the bar still sums.
              const spanTicks = slotTicks * span;
              const noteVal = ticksToDuration(spanTicks);
              const staveNote = new StaveNote({ keys: chordNotes, duration: noteVal.duration });

              chordNotes.forEach((noteStr, i) => {
                if (noteStr.includes('#')) {
                  staveNote.addModifier(new Accidental('#'), i);
                } else if (noteStr.includes('b') && !noteStr.startsWith('b')) {
                  staveNote.addModifier(new Accidental('b'), i);
                }
              });

              notes.push(staveNote);

              // Fill any remainder of the span with ghost notes (one per leftover slot).
              const usedSlots = Math.max(1, Math.round(noteVal.ticks / slotTicks));
              for (let f = 1; f < usedSlots && b + f < beatsPerBar; f++) {
                // covered by the note itself
              }
              const filledSlots = Math.min(span, Math.max(1, usedSlots));
              for (let p = b; p < b + filledSlots; p++) processedBeats.add(p);
              for (let p = b + filledSlots; p < b + span; p++) {
                notes.push(new GhostNote({ duration: baseNote.duration }));
                processedBeats.add(p);
              }
            } else {
              notes.push(new GhostNote({ duration: baseNote.duration }));
              processedBeats.add(b);
            }
          }

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
      } catch (error) {
        console.error('VexFlow render error:', error);
      }
    };

    renderStaff();
  }, [beatChords, width, height, numMeasures, scale]);

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      <div ref={containerRef} style={{ width: '100%', height }} />
    </div>
  );
};
