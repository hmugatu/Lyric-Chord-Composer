/**
 * Compact chord label for tight display spots (above bars, reference strip).
 *
 * Strips parenthetical descriptors like "(A minor)", "(barre)", "(easy)",
 * "(alt)", "(half-dim)" and appends the fret position when the chord starts
 * above the nut. Examples:
 *   "Am (A minor)"                  -> "Am"
 *   "A7sus4 (barre)" @ fret 5       -> "A7sus4 5fr"
 *   "A"                             -> "A"
 */
export function shortChordName(name: string, startingFret = 0): string {
  const base = name.replace(/\s*\([^)]*\)/g, '').trim();
  return startingFret > 1 ? `${base} ${startingFret}fr` : base;
}
