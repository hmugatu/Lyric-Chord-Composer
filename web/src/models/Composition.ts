/**
 * Complete composition data model
 */

import { ChordProgression } from './Chord';
import { TimeSignature, GuitarTuning } from './Note';
import { NotationMeasure } from './Notation';
import { TabMeasure, TabCell } from './Tablature';
import type { SectionType } from './Lyrics';
import { LyricSection } from './Lyrics';

/** Optional per-section performance controls (overrides for a single section). */
export interface SectionFlowControl {
  /** If set, overrides GlobalSettings.tempo for this section. */
  tempo?: number;
  /** Free-form note for the composer (e.g. "build here", "tempo shift"). */
  sectionNotes?: string;
}

export interface Section {
  id: string;
  type: SectionType;
  label?: string;
  order: number; // Section ordering

  // Core content
  lyrics?: LyricSection;
  chordProgression?: ChordProgression;

  // Visual / musical content (optional; can contain any combination)
  notation?: NotationMeasure[];
  tablature?: TabMeasure[];

  // Optional performance controls specific to this section
  flowControl?: SectionFlowControl;
}

export interface GlobalSettings {
  key: string;
  tempo: number; // Base tempo for the whole song
  timeSignature: TimeSignature;
  capo?: number;
  tuning: GuitarTuning;
  /** Chord/tab slots per bar: 2, 4 (default), or 8. Must divide 4/4 cleanly. */
  chordsPerBar?: number;
  /** Lyric line spacing: 'stretch' justifies edge-to-edge, 'left' left-aligns. */
  lyricSpacing?: 'stretch' | 'left';
}

export interface PageData {
  barLyrics: string[];
  barBeatChords: string[][];
  /**
   * User-entered tab frets, stored sparsely keyed by "bar:cell:string"
   * (bar 0-15, cell = 16th-note index in bar, string 0-5 low->high).
   * Absent cells fall back to the chord-derived fret. Optional for back-compat.
   */
  barTab?: Record<string, TabCell>;
}

export interface CompositionPages {
  pages: PageData[];
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
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  notes?: string; // Stores JSON with pages structure { pages: PageData[] }
}
