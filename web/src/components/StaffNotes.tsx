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
  scale?: number;
}

// Base note duration for a single chord filling one slot, by slots-per-bar.
// 2 -> half, 4 -> quarter, 8 -> eighth (all divide 4/4 cleanly).
const BASE_DURATION: { [slots: number]: string } = { 2: 'h', 4: 'q', 8: '8' };

// Duration for a chord that spans `span` consecutive slots, per slots-per-bar.
// Keys are (span - 1). Only combinations that map to a single notatable value.
const SPAN_DURATION: { [slots: number]: { [k: number]: string } } = {
  2: { 0: 'h', 1: 'w' }, // half, then whole
  4: { 0: 'q', 1: 'h', 2: 'hd', 3: 'w' }, // quarter, half, dotted-half, whole
  8: { 0: '8', 1: 'q', 3: 'h', 7: 'w' }, // eighth, quarter, half, whole (clean divisions)
};

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
            stave.addTimeSignature('4/4');
          }
          stave.setContext(context).draw();

          const notes: any[] = [];
          const startBeat = m * beatsPerBar;

          const baseDuration = BASE_DURATION[beatsPerBar] || 'q';
          const spanMap = SPAN_DURATION[beatsPerBar] || SPAN_DURATION[4];

          const processedBeats = new Set<number>();

          for (let b = 0; b < beatsPerBar; b++) {
            if (processedBeats.has(b)) continue;

            const beatIndex = startBeat + b;
            const chord = beatChords[beatIndex] || '';
            const chordNotes = getChordNotesVexFlow(chord);

            // Count consecutive empty slots after this one (how long the chord rings).
            let emptyCount = 0;
            for (let c = b + 1; c < beatsPerBar; c++) {
              const nextChord = beatChords[startBeat + c] || '';
              if (!nextChord || nextChord.trim() === '' || nextChord === '-') {
                emptyCount++;
              } else {
                break;
              }
            }

            if (chordNotes.length > 0) {
              // Use a spanning duration when the run maps to a clean note value;
              // otherwise emit one base-duration note and let the trailing empty
              // slots become ghost notes so the measure still sums correctly.
              const spanDuration = spanMap[emptyCount];
              const duration = spanDuration || baseDuration;
              const staveNote = new StaveNote({ keys: chordNotes, duration });

              chordNotes.forEach((noteStr, i) => {
                if (noteStr.includes('#')) {
                  staveNote.addModifier(new Accidental('#'), i);
                } else if (noteStr.includes('b') && !noteStr.startsWith('b')) {
                  staveNote.addModifier(new Accidental('b'), i);
                }
              });

              notes.push(staveNote);
              const consumed = spanDuration ? emptyCount : 0;
              for (let p = b; p <= b + consumed; p++) {
                processedBeats.add(p);
              }
            } else {
              notes.push(new GhostNote({ duration: baseDuration }));
              processedBeats.add(b);
            }
          }

          const voice = new Voice({ numBeats: 4, beatValue: 4 });
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
