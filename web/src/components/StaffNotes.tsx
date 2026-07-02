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
  scale?: number;
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
        const scaledWidth = width / scale;
        const scaledHeight = height / scale;
        renderer.resize(scaledWidth, scaledHeight);
        const context = renderer.getContext();
        context.scale(scale, scale);
        context.setFont('Arial', 10);

        const totalWidth = scaledWidth - 20;
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

          const stave = new Stave(xPos, 0, measureWidth);
          if (m === 0) {
            stave.addClef('treble');
            stave.addTimeSignature('4/4');
          }
          stave.setContext(context).draw();

          const notes: any[] = [];
          const startBeat = m * 4;

          const noteDurations: { [key: number]: string } = { 0: 'q', 1: 'h', 2: 'hd', 3: 'w' };

          const processedBeats = new Set<number>();

          for (let b = 0; b < 4; b++) {
            if (processedBeats.has(b)) continue;

            const beatIndex = startBeat + b;
            const chord = beatChords[beatIndex] || '';
            const chordNotes = getChordNotesVexFlow(chord);

            let emptyCount = 0;
            for (let c = b + 1; c < 4; c++) {
              const nextBeatIndex = startBeat + c;
              const nextChord = beatChords[nextBeatIndex] || '';
              if (!nextChord || nextChord.trim() === '' || nextChord === '-') {
                emptyCount++;
              } else {
                break;
              }
            }
            emptyCount = Math.min(emptyCount, 3);

            if (chordNotes.length > 0) {
              const duration = noteDurations[emptyCount];
              const staveNote = new StaveNote({ keys: chordNotes, duration });

              chordNotes.forEach((noteStr, i) => {
                if (noteStr.includes('#')) {
                  staveNote.addModifier(new Accidental('#'), i);
                } else if (noteStr.includes('b') && !noteStr.startsWith('b')) {
                  staveNote.addModifier(new Accidental('b'), i);
                }
              });

              notes.push(staveNote);
              for (let p = b; p <= b + emptyCount; p++) {
                processedBeats.add(p);
              }
            } else {
              notes.push(new GhostNote({ duration: 'q' }));
              processedBeats.add(b);
            }
          }

          const voice = new Voice({ numBeats: 4, beatValue: 4 });
          voice.addTickables(notes);

          const formatWidth = m === 0 ? measureWidth - 80 : measureWidth - 20;
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
