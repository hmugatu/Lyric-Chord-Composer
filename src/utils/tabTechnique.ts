/**
 * Inline tab-notation symbols for techniques, shared by the on-screen and
 * print renderers so they stay identical.
 *
 * Convention (standard guitar tab):
 *   hammer-on  -> h   pull-off -> p   slide -> /   bend -> b (with up feel)
 *   vibrato    -> ~   palm-mute -> PM  harmonic -> wrapped in < >
 *
 * Harmonic wraps the fret (e.g. <7>); the others are suffixes after the fret.
 */
import type { TabTechnique } from '../models/Tablature';

const SUFFIX: Partial<Record<TabTechnique, string>> = {
  'hammer-on': 'h',
  'pull-off': 'p',
  'slide': '/',
  'bend': 'b',
  'vibrato': '~',
  'palm-mute': 'PM',
};

/**
 * Format a fret value with its techniques into a display string, e.g.
 *   fret 7 + ['bend'] -> "7b"
 *   fret 7 + ['harmonic'] -> "<7>"
 *   fret 7 + ['hammer-on','vibrato'] -> "7h~"
 */
export function formatFretWithTechniques(
  fret: number | 'x' | string,
  techniques?: TabTechnique[]
): string {
  const base = String(fret);
  if (!techniques || techniques.length === 0) return base;

  const harmonic = techniques.includes('harmonic');
  const suffixes = techniques
    .map((t) => SUFFIX[t])
    .filter((s): s is string => Boolean(s))
    .join('');

  const core = harmonic ? `<${base}>` : base;
  return `${core}${suffixes}`;
}
