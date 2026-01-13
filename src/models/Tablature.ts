/**
 * Tablature data model for guitar tabs
 */

import { NoteDuration, TimeSignature, GuitarTuning } from './Note';

export type TabTechnique =
  | "hammer-on" | "pull-off" | "slide" | "bend"
  | "vibrato" | "palm-mute" | "harmonic";

export interface TabNote {
  string: number;      // 1-6
  fret: number;        // 0-24
  duration: NoteDuration;
  techniques?: TabTechnique[];
}

export interface TabMeasure {
  id: string;
  notes: TabNote[];
  timeSignature: TimeSignature;
  tempo?: number;
  chordName?: string;  // Associated chord
}

export interface Tablature {
  id: string;
  measures: TabMeasure[];
  tuning: GuitarTuning;
  capo?: number;
  metadata: {
    title?: string;
    artist?: string;
    difficulty?: "beginner" | "intermediate" | "advanced";
  };
}
