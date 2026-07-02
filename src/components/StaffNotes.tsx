/**
 * Staff Notes Component
 * Renders musical notes on grand staff using VexFlow
 */

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import * as Tonal from '@tonaljs/tonal';

interface StaffNotesProps {
  beatChords: string[];
  width: number;
  height: number;
  numMeasures?: number; // Number of measures to display (default 1)
  scale?: number; // Scale factor for rendering (0.5-1.0, default 0.75)
}

/**
 * Get notes from a chord name using tonal.js
 * Returns notes in VexFlow format (e.g., "c/4", "e/4", "g/4")
 */
function getChordNotesVexFlow(chordName: string): string[] {
  if (!chordName || chordName.trim() === '' || chordName === '-') {
    return [];
  }

  try {
    // Clean up chord name - remove parenthetical suffixes
    let cleanName = chordName
      .replace(/\s*\(easy\)/gi, '')
      .replace(/\s*\(barre\)/gi, '')
      .replace(/\s*\(alt\)/gi, '')
      .trim();

    // Extract root note for fallback
    const rootMatch = cleanName.match(/^([A-G][#b]?)/i);
    const root = rootMatch ? rootMatch[1].toUpperCase() : null;

    // Normalize chord quality names for tonal.js
    // "A major" -> "A", "A minor" -> "Am", "A5" -> "A5"
    let tonalName = cleanName
      .replace(/\s+major$/i, '')
      .replace(/\s+minor$/i, 'm')
      .replace(/\s+/g, ''); // Remove any remaining spaces

    let chord = Tonal.Chord.get(tonalName);

    // If no notes, try common variations
    if (!chord.notes || chord.notes.length === 0) {
      // Try without numbers for power chords (A5 -> just use A and E)
      if (root && /^[A-G][#b]?5$/.test(tonalName)) {
        // Power chord: return root and fifth
        const rootNote = formatNoteForVexFlow(root, 3);
        const fifth = getFifth(root);
        return [rootNote, formatNoteForVexFlow(fifth, 3)];
      }

      // Try just the root as major chord
      if (root) {
        chord = Tonal.Chord.get(root);
      }
    }

    // Still no notes? Return just root
    if (!chord.notes || chord.notes.length === 0) {
      if (root) {
        return [formatNoteForVexFlow(root, 4)];
      }
      return [];
    }

    // Return notes in VexFlow format (use octave 4 for standard voicing)
    const result = chord.notes.slice(0, 4).map(noteName => formatNoteForVexFlow(noteName, 4));
    console.log('Chord parsed:', chordName, '→', result);
    return result;
  } catch (error) {
    console.warn('Failed to parse chord:', chordName, error);
    return [];
  }
}

/**
 * Get the perfect fifth above a root note
 */
function getFifth(root: string): string {
  const fifths: { [key: string]: string } = {
    'C': 'G', 'C#': 'G#', 'Db': 'Ab',
    'D': 'A', 'D#': 'A#', 'Eb': 'Bb',
    'E': 'B', 'F': 'C', 'F#': 'C#',
    'Gb': 'Db', 'G': 'D', 'G#': 'D#',
    'Ab': 'Eb', 'A': 'E', 'A#': 'E#',
    'Bb': 'F', 'B': 'F#'
  };
  return fifths[root] || 'E';
}

/**
 * Format a note name for VexFlow (e.g., "C#" -> "c#/4")
 */
function formatNoteForVexFlow(noteName: string, octave: number): string {
  // VexFlow format: "c/4", "c#/4", "bb/4"
  const note = noteName.toLowerCase().replace('♯', '#').replace('♭', 'b');
  return `${note}/${octave}`;
}

export const StaffNotes: React.FC<StaffNotesProps> = ({ beatChords, width, height, numMeasures = 1, scale = 0.75 }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    console.log('StaffNotes useEffect triggered, beatChords:', JSON.stringify(beatChords));

    if (Platform.OS !== 'web') {
      console.log('Not web platform, skipping');
      return;
    }

    if (!containerRef.current) {
      console.log('containerRef.current is null, skipping');
      return;
    }

    console.log('Starting VexFlow render...');

    // Dynamic import VexFlow only on web
    const renderStaff = async () => {
      try {
        console.log('Importing VexFlow...');
        const VexFlow = await import('vexflow');
        console.log('VexFlow imported successfully');
        const vf = VexFlow.default || VexFlow;
        console.log('VexFlow module keys:', Object.keys(vf));
        const { Renderer, Stave, StaveNote, Voice, Formatter, Accidental, GhostNote } = vf;
        console.log('VexFlow classes extracted:', { Renderer: !!Renderer, Stave: !!Stave, StaveNote: !!StaveNote, GhostNote: !!GhostNote });

        // Clear previous render
        containerRef.current!.innerHTML = '';

        // Create renderer with scaling
        const renderer = new Renderer(containerRef.current!, Renderer.Backends.SVG);
        // Scale up the canvas size to accommodate the scaled content
        const scaledWidth = width / scale;
        const scaledHeight = height / scale;
        renderer.resize(scaledWidth, scaledHeight);
        const context = renderer.getContext();
        context.scale(scale, scale);
        context.setFont('Arial', 10);

        // Calculate measure widths - first measure wider for clef/time signature
        // Use scaled dimensions for VexFlow internal calculations
        const totalWidth = scaledWidth - 20;
        const firstMeasureWidth = totalWidth / numMeasures + 40; // Extra space for clef/time
        const otherMeasureWidth = (totalWidth - firstMeasureWidth) / (numMeasures - 1);
        
        // Create staves for each measure
        const staves: any[] = [];
        const voices: any[] = [];
        
        for (let m = 0; m < numMeasures; m++) {
          let xPos, measureWidth;
          if (m === 0) {
            xPos = 10;
            measureWidth = firstMeasureWidth;
          } else {
            xPos = 10 + firstMeasureWidth + ((m - 1) * otherMeasureWidth);
            measureWidth = otherMeasureWidth;
          }
          
          const stave = new Stave(xPos, 0, measureWidth);
          
          // Only add clef and time signature to first measure
          if (m === 0) {
            stave.addClef('treble');
            stave.addTimeSignature('4/4');
          }
          
          stave.setContext(context).draw();
          staves.push(stave);
          
          // Create notes for this measure (4 beats)
          const notes: any[] = [];
          const startBeat = m * 4;
          
          // Map note durations: number of empty positions after chord -> VexFlow duration
          const noteDurations: { [key: number]: string } = {
            0: 'q',   // quarter note (1 beat)
            1: 'h',   // half note (2 beats)
            2: 'hd',  // dotted half note (3 beats)
            3: 'w',   // whole note (4 beats)
          };

          // Map rest durations
          const restDurations: { [key: number]: string } = {
            0: 'qr',  // quarter rest
            1: 'hr',  // half rest
            2: 'hdr', // dotted half rest
            3: 'wr',  // whole rest
          };

          const processedBeats = new Set<number>();

          for (let b = 0; b < 4; b++) {
            // Skip if this beat was already processed as part of an extended note
            if (processedBeats.has(b)) {
              continue;
            }

            const beatIndex = startBeat + b;
            const chord = beatChords[beatIndex] || '';
            const chordNotes = getChordNotesVexFlow(chord);

            console.log(`Measure ${m}, Beat ${b}: beatIndex=${beatIndex}, chord="${chord}", notes=`, chordNotes);

            // Count consecutive empty positions after this one
            let emptyCount = 0;
            for (let c = b + 1; c < 4; c++) {
              const nextBeatIndex = startBeat + c;
              const nextChord = beatChords[nextBeatIndex] || '';
              if (!nextChord || nextChord.trim() === '' || nextChord === '-') {
                emptyCount++;
              } else {
                break; // Stop counting when we hit another chord
              }
            }

            // Clamp emptyCount to maximum of 3 (whole note)
            emptyCount = Math.min(emptyCount, 3);

            if (chordNotes.length > 0) {
              // Create a chord with calculated duration
              const duration = noteDurations[emptyCount];
              const staveNote = new StaveNote({
                keys: chordNotes,
                duration: duration,
              });

              // Add accidentals
              chordNotes.forEach((noteStr, i) => {
                if (noteStr.includes('#')) {
                  staveNote.addModifier(new Accidental('#'), i);
                } else if (noteStr.includes('b') && !noteStr.startsWith('b')) {
                  staveNote.addModifier(new Accidental('b'), i);
                }
              });

              notes.push(staveNote);
              // Mark beats as processed
              for (let p = b; p <= b + emptyCount; p++) {
                processedBeats.add(p);
              }
            } else {
              // Empty beat - use invisible ghost note to maintain timing
              notes.push(new GhostNote({ duration: 'q' }));
              processedBeats.add(b);
            }
          }
          
          // Create voice for this measure
          const voice = new Voice({ numBeats: 4, beatValue: 4 });
          voice.addTickables(notes);
          voices.push(voice);
          
          // Format and draw this measure - adjust formatting width based on measure
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

  // For web, use a div that VexFlow will render into
  if (Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        <div
          ref={containerRef}
          style={{ width: '100%', height: height }}
        />
      </View>
    );
  }

  // For native, we'll need a different approach (WebView or native SVG)
  // For now, return a placeholder
  return (
    <View style={[styles.container, { height }]}>
      {/* Native rendering would go here */}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
});
