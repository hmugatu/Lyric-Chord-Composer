/**
 * Complete composition data model
 */

import { ChordProgression } from './Chord';
import { TimeSignature, GuitarTuning } from './Note';
import { NotationMeasure } from './Notation';
import { TabMeasure } from './Tablature';
import { LyricSection } from './Lyrics';

export type SectionType = "verse" | "chorus" | "bridge" | "intro" | "outro" | "instrumental";

export interface Section {
  id: string;
  type: SectionType;
  label?: string;

  // Can contain any combination
  notation?: NotationMeasure[];
  tablature?: TabMeasure[];
  lyrics?: LyricSection;
  chordProgression?: ChordProgression;

  order: number;  // Section ordering
}

export interface GlobalSettings {
  key: string;
  tempo: number;
  timeSignature: TimeSignature;
  capo?: number;
  tuning: GuitarTuning;
}

export interface Composition {
  id: string;
  title: string;
  artist?: string;
  createdAt: Date;
  updatedAt: Date;

  // Content
  sections: Section[];
  globalSettings: GlobalSettings;

  // Metadata
  tags?: string[];
  difficulty?: "beginner" | "intermediate" | "advanced";
  notes?: string;
}
