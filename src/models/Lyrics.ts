/**
 * Lyrics data model with chord positioning
 */

import { Chord } from './Chord';

export interface ChordPosition {
  chordId: string;
  characterIndex: number;  // Position in lyric text
  chord: Chord;
}

export interface LyricLine {
  id: string;
  text: string;
  chordPositions: ChordPosition[];
  measureIndex?: number;  // Link to measure in notation
}

export type SectionType = "verse" | "chorus" | "bridge" | "intro" | "outro" | "custom";

export interface LyricSection {
  id: string;
  type: SectionType;
  label?: string;          // "Verse 1", "Chorus", etc.
  lines: LyricLine[];
}

export interface Lyrics {
  id: string;
  sections: LyricSection[];
  metadata: {
    title?: string;
    artist?: string;
  };
}
