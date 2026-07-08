/**
 * Reference-tone playback for the tuner. Plays a sustained sine tone at a
 * given frequency through the speakers so the player can tune a string to it
 * by ear. This does NOT use the microphone and records nothing.
 *
 * Frequencies come from the composition's tuning notes (e.g. "E2") via
 * @tonaljs/tonal's Note.freq(), which the app already depends on.
 */
import * as Tonal from '@tonaljs/tonal';

const Note = Tonal.Note;

// One shared AudioContext, created lazily on first play (a user gesture), so
// browsers don't block it from autoplaying.
let ctx: AudioContext | null = null;
// The currently-sounding tone, so a new play (or stop) can cancel it first.
let active: { osc: OscillatorNode; gain: GainNode } | null = null;

function getContext(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

/** Stop any tone that's currently sounding. Safe to call when nothing plays. */
export function stopTone(): void {
  if (!active) return;
  const { osc, gain } = active;
  active = null;
  const now = getContext().currentTime;
  // Quick release to avoid a click, then stop the oscillator.
  gain.gain.cancelScheduledValues(now);
  gain.gain.setValueAtTime(gain.gain.value, now);
  gain.gain.linearRampToValueAtTime(0, now + 0.03);
  try { osc.stop(now + 0.05); } catch { /* already stopped */ }
}

/**
 * Play a sine tone at `freqHz` for `durationSec`, replacing any tone already
 * sounding. A short attack/release envelope avoids clicks. Returns a stop()
 * for early cancellation.
 */
export function playTone(freqHz: number, durationSec = 2): () => void {
  stopTone();
  const context = getContext();
  // Resume in case the context started suspended (autoplay policy).
  void context.resume();

  const now = context.currentTime;
  const osc = context.createOscillator();
  const gain = context.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freqHz, now);

  // Attack → sustain → release envelope.
  const peak = 0.2;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(peak, now + 0.02);
  gain.gain.setValueAtTime(peak, now + durationSec - 0.08);
  gain.gain.linearRampToValueAtTime(0, now + durationSec);

  osc.connect(gain).connect(context.destination);
  osc.start(now);
  osc.stop(now + durationSec + 0.02);

  const entry = { osc, gain };
  active = entry;
  osc.onended = () => { if (active === entry) active = null; };

  return () => { if (active === entry) stopTone(); };
}

/**
 * Play the reference tone for a tuning note name (e.g. "E2"). Returns a stop()
 * or null if the note can't be resolved to a frequency.
 */
export function playNoteTone(noteName: string, durationSec = 2): (() => void) | null {
  const freq = Note.freq(noteName);
  if (freq == null) return null;
  return playTone(freq, durationSec);
}
