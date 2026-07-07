/**
 * Offline monophonic pitch detection for the mic-capture feature.
 *
 * Uses autocorrelation over a time-domain buffer — reliable for a single
 * played/sung note. No external library; frequency → note naming leans on
 * @tonaljs/note, which the app already depends on.
 */
import * as Tonal from '@tonaljs/tonal';

const Note = Tonal.Note;

// Guitar-ish frequency window: below low-E (~82 Hz) and above a high fret on
// the top string (~1320 Hz) we treat detections as noise.
const MIN_FREQ = 70;
const MAX_FREQ = 1400;
// Below this RMS the frame is considered silence.
const RMS_SILENCE = 0.01;

/**
 * Estimate the fundamental frequency of `buffer` (time-domain samples in
 * [-1, 1]). Returns the frequency in Hz, or -1 if no clear pitch was found.
 */
export function autoCorrelate(buffer: Float32Array, sampleRate: number): number {
  const size = buffer.length;

  let rms = 0;
  for (let i = 0; i < size; i++) rms += buffer[i] * buffer[i];
  rms = Math.sqrt(rms / size);
  if (rms < RMS_SILENCE) return -1;

  // Trim leading/trailing near-silence to sharpen the correlation.
  const threshold = 0.2;
  let start = 0;
  let end = size - 1;
  while (start < size / 2 && Math.abs(buffer[start]) < threshold) start++;
  while (end > size / 2 && Math.abs(buffer[end]) < threshold) end--;
  const trimmed = buffer.subarray(start, end);
  const n = trimmed.length;
  if (n < 8) return -1;

  const c = new Float32Array(n);
  for (let lag = 0; lag < n; lag++) {
    let sum = 0;
    for (let i = 0; i < n - lag; i++) sum += trimmed[i] * trimmed[i + lag];
    c[lag] = sum;
  }

  // Find the first dip, then the highest peak after it.
  let d = 0;
  while (d < n - 1 && c[d] > c[d + 1]) d++;
  let maxPos = -1;
  let maxVal = -Infinity;
  for (let i = d; i < n; i++) {
    if (c[i] > maxVal) { maxVal = c[i]; maxPos = i; }
  }
  if (maxPos <= 0) return -1;

  // Parabolic interpolation around the peak for sub-sample accuracy.
  let period = maxPos;
  const x1 = c[maxPos - 1];
  const x2 = c[maxPos];
  const x3 = c[maxPos + 1] ?? x2;
  const a = (x1 + x3 - 2 * x2) / 2;
  const b = (x3 - x1) / 2;
  if (a) period = maxPos - b / (2 * a);

  const freq = sampleRate / period;
  if (freq < MIN_FREQ || freq > MAX_FREQ) return -1;
  return freq;
}

/** Nearest note name (with octave), e.g. 329.6 → "E4". Empty string if invalid. */
export function freqToNoteName(freq: number): string {
  if (freq <= 0) return '';
  // Note.fromFreq snaps to the nearest equal-tempered pitch.
  return Note.fromFreq(freq) || '';
}

const MAX_FRET = 15;

/**
 * Map a note name to a playable tab position for the given tuning
 * (string notes low→high, e.g. ["E2","A2",...]). Picks the highest string
 * (lowest index toward the treble) whose open pitch is at or below the note
 * and within MAX_FRET, so notes land in a natural fingering position.
 * Returns null when the note is out of range for the tuning.
 */
export function noteToTabPosition(
  noteName: string,
  tuningNotes: string[],
): { stringIndex: number; fret: number } | null {
  const target = Note.midi(noteName);
  if (target == null) return null;

  let best: { stringIndex: number; fret: number } | null = null;
  // Iterate high strings first (end of array) so we prefer lower frets there.
  for (let s = tuningNotes.length - 1; s >= 0; s--) {
    const open = Note.midi(tuningNotes[s]);
    if (open == null) continue;
    const fret = target - open;
    if (fret >= 0 && fret <= MAX_FRET) {
      // Prefer the position with the smallest fret; ties favor higher strings.
      if (!best || fret < best.fret) best = { stringIndex: s, fret };
    }
  }
  return best;
}
