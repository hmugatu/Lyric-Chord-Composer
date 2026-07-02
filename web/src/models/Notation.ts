/**
 * Musical notation data model for staff notation
 */

import { MusicalNote, KeySignature, TimeSignature } from './Note';

export type Clef = "treble" | "bass" | "alto";

export interface NotationMeasure {
  id: string;
  notes: MusicalNote[];
  clef: Clef;
  keySignature: KeySignature;
  timeSignature: TimeSignature;
  chordSymbol?: string;
}

export interface Notation {
  id: string;
  measures: NotationMeasure[];
  metadata: {
    title?: string;
    composer?: string;
    tempo?: number;
  };
}
