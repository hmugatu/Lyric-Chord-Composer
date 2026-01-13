/**
 * Musical note models and types
 */

export type NoteDuration =
  | "whole" | "half" | "quarter" | "eighth"
  | "sixteenth" | "thirty-second";

export type Accidental = "sharp" | "flat" | "natural";

export interface MusicalNote {
  pitch: string;       // "C4", "D#5", etc.
  duration: NoteDuration;
  accidental?: Accidental;
  tied?: boolean;
  dotted?: boolean;
}

export interface KeySignature {
  key: string;         // "C", "G", "Dm", etc.
  sharps: number;      // -7 to 7 (negative = flats)
}

export interface TimeSignature {
  beats: number;       // e.g., 4
  beatValue: number;   // e.g., 4 (for 4/4 time)
}

export interface GuitarTuning {
  name: string;        // e.g., "Standard", "Drop D"
  notes: string[];     // ["E2", "A2", "D3", "G3", "B3", "E4"]
}

// Standard guitar tuning
export const STANDARD_TUNING: GuitarTuning = {
  name: "Standard",
  notes: ["E2", "A2", "D3", "G3", "B3", "E4"]
};

// Common alternate tunings
export const ALTERNATE_TUNINGS: GuitarTuning[] = [
  STANDARD_TUNING,
  {
    name: "Drop D",
    notes: ["D2", "A2", "D3", "G3", "B3", "E4"]
  },
  {
    name: "Open G",
    notes: ["D2", "G2", "D3", "G3", "B3", "D4"]
  },
  {
    name: "DADGAD",
    notes: ["D2", "A2", "D3", "G3", "A3", "D4"]
  }
];
