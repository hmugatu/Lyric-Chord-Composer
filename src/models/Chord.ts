/**
 * Chord data model for representing guitar chords
 */

export interface ChordFingering {
  string: number;      // 1-6 (1 = high E, 6 = low E)
  fret: number;        // 0-24 (0 = open string)
  finger?: number;     // 0-4 (0 = muted/open, 1-4 = fingers)
}

export type ChordQuality =
  | "major" | "minor" | "diminished" | "augmented"
  | "7th" | "maj7" | "min7" | "dim7" | "aug7"
  | "sus2" | "sus4" | "add9" | "6th" | "9th" | "11th" | "13th";

export interface ChordDiagram {
  fretCount: number;             // Number of frets to display
  startFret: number;             // Starting fret position
  muted?: number[];              // Muted string indices
}

export interface Chord {
  id: string;
  name: string;                    // e.g., "Am7"
  root: string;                    // e.g., "A"
  quality: ChordQuality;           // "major", "minor", "7th", etc.
  notes: string[];                 // ["A", "C", "E", "G"]
  fingerings: ChordFingering[];    // Array of finger positions
  baseFret?: number;               // Starting fret for barre chords
  customName?: string;             // User-defined name
  diagram?: ChordDiagram;
}

export interface ChordProgression {
  id: string;
  name?: string;
  chords: Chord[];
  pattern?: string;  // e.g., "I-V-vi-IV"
  measures: number;
}
