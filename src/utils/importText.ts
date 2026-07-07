/**
 * Import a pasted song (chords-over-lyrics text) into the editor's bar/beat grid.
 *
 * The primary real-world format is a chord line directly above a lyric line:
 *
 *     C                   Am
 *     Lover, I know you're weary
 *
 * Brackets are section labels ([Chorus], [Verse 2], [Bridge]) — not chords.
 *
 * Mapping rule (chosen with the user): one pasted line = one 4-bar row (the
 * editor renders lyrics once per 4-bar row). The line's lyric fills the row's
 * full-width lyric input; its chords spread across the row's 4 bars. Each placed
 * chord also stamps its fingering into the tab grid (barTab), which is what the
 * staff notes are drawn from — so imported chords arrive with tab + notation,
 * exactly like manually placing a chord in the editor.
 *
 * Produces the { pages: PageData[] } shape the editor stores in
 * Composition.notes. Pure module — no React, no DOM.
 */
import { shortChordName } from './chordName';
import type { TabCell } from '../models/Tablature';
import type { NoteDuration } from '../models/Note';

/**
 * Note value for a chord that occupies one of `chordsPerBar` slots: fewer chords
 * per bar means each rings longer. 1 => whole, 2 => half, 4 => quarter,
 * 8 => eighth (fallbacks for other values pick the nearest sensible duration).
 */
function durationForSlots(chordsPerBar: number): NoteDuration {
  if (chordsPerBar <= 1) return 'whole';
  if (chordsPerBar === 2) return 'half';
  if (chordsPerBar <= 4) return 'quarter';
  return 'eighth';
}

export interface ChordFingering {
  name: string;
  fingering?: string[]; // low->high [E A D G B e]; entries "0".."24" | "x" | ""
}

export interface ImportedPage {
  barLyrics: string[];
  barBeatChords: string[][];
  barTab: Record<string, TabCell>;
}

export interface ImportResult {
  pages: ImportedPage[];
  /** How many 4-bar rows received content (for the "Imported N lines" snackbar). */
  filledRows: number;
  /** Distinct raw chord tokens we could not map cleanly (still rendered via a
   *  best-effort fallback, but surfaced so the user knows). */
  unmappedChords: string[];
}

const BARS_PER_ROW = 4;
// Max page size for allocation (7 rows = 28 bars). Actual pagination boundary
// is passed in (16 with the staff shown, 28 without).
const MAX_ROWS_PER_PAGE = 7;
const BARS_PER_PAGE = MAX_ROWS_PER_PAGE * BARS_PER_ROW; // 28

// A chord token: root, optional accidental, optional quality/extension, optional
// slash bass. Deliberately permissive — anything matching is treated as a chord.
const CHORD_RE =
  /^[A-G](#|b)?(m|maj|min|dim|aug|sus|add|M)?[0-9]*(b5|#5)?(sus[24]|add[0-9]+)?(\/[A-G](#|b)?)?$/;

// A whole line that is only a bracketed label, e.g. "[Chorus]" or "[Verse 2]".
const SECTION_RE = /^\[[^\]]*\]$/;

const emptyPage = (slots: number): ImportedPage => ({
  barLyrics: Array(BARS_PER_PAGE).fill(''),
  barBeatChords: Array(BARS_PER_PAGE)
    .fill(null)
    .map(() => Array(slots).fill('')),
  barTab: {},
});

/**
 * Normalize varied encodings into clean plain-text lines.
 * Handles BOM, pasted Google-Docs HTML entities, and Markdown escapes so the
 * same paste works whether it came from a .txt, .md, or copied Docs content.
 */
export function cleanInput(text: string): string[] {
  let t = text.replace(/^﻿/, ''); // UTF-8 BOM
  t = t
    .replace(/&nbsp;/g, ' ')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<');
  t = t.replace(/\\([[\]!()])/g, '$1'); // Markdown escapes \[ \] \! -> [ ] !
  return t.split(/\r?\n/).map((line) => line.replace(/\s+$/, ''));
}

const tokens = (line: string): string[] => line.trim().split(/\s+/).filter(Boolean);

/** True when every whitespace-separated token on the line is a chord token. */
export function isChordLine(line: string): boolean {
  const toks = tokens(line);
  return toks.length > 0 && toks.every((tok) => CHORD_RE.test(tok));
}

export function isSectionLine(line: string): boolean {
  return SECTION_RE.test(line.trim());
}

/**
 * Build a lookup from base chord name (parentheticals stripped, e.g. "Am") to
 * the exact catalog entry so a stamped chord renders (and we get its fingering).
 */
function buildCatalogIndex(catalog: ChordFingering[]): Map<string, ChordFingering> {
  const index = new Map<string, ChordFingering>();
  for (const entry of catalog) {
    const base = shortChordName(entry.name); // strips "(A minor)", "(barre)", etc.
    if (!index.has(base)) index.set(base, entry);
  }
  return index;
}

/**
 * Map a raw chord token to a catalog entry. Lossy by design (the catalog is
 * small): reduce extensions and slash basses toward the nearest triad.
 * `mapped` is false when we had to fall back beyond a simple reduction.
 */
export function normalizeChord(
  raw: string,
  index: Map<string, ChordFingering>,
): { entry: ChordFingering | null; mapped: boolean } {
  const tok = raw.trim();
  if (!tok) return { entry: null, mapped: true };

  const get = (base: string) => index.get(base) ?? null;

  let hit = get(tok);
  if (hit) return { entry: hit, mapped: true };

  const noSlash = tok.replace(/\/[A-G](#|b)?$/, ''); // strip slash bass
  hit = get(noSlash);
  if (hit) return { entry: hit, mapped: true };

  const m = noSlash.match(/^([A-G](#|b)?)(.*)$/);
  if (m) {
    const root = m[1];
    const isMinor = /^(m|min)(?!aj)/.test(m[3]);
    const triad = isMinor ? `${root}m` : root;
    hit = get(triad);
    if (hit) return { entry: hit, mapped: true };
    hit = get(root);
    if (hit) return { entry: hit, mapped: false };
  }

  return { entry: null, mapped: false };
}

interface Block {
  chords: string[]; // raw chord tokens, left-to-right
  lyric: string;
  section?: string;
}

/** Parse cleaned lines into an ordered list of content blocks. */
export function parseLines(lines: string[]): Block[] {
  const blocks: Block[] = [];
  let pendingSection: string | undefined;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    if (isSectionLine(line)) {
      pendingSection = line.trim();
      continue;
    }

    if (isChordLine(line)) {
      const chords = tokens(line);
      const next = lines[i + 1];
      if (next !== undefined && next.trim() && !isChordLine(next) && !isSectionLine(next)) {
        blocks.push({ chords, lyric: next.trim(), section: pendingSection });
        pendingSection = undefined;
        i++;
      } else {
        blocks.push({ chords, lyric: '', section: pendingSection });
        pendingSection = undefined;
      }
      continue;
    }

    blocks.push({ chords: [], lyric: line.trim(), section: pendingSection });
    pendingSection = undefined;
  }

  return blocks;
}

/**
 * Stamp a chord's fingering into barTab at (bar, cell), mirroring the editor's
 * stampChordToTab: fingering is low->high [E A D G B e]; each present string
 * becomes a quarter-note cell with source 'chord'. Mutates and returns `tab`.
 */
function stampFingering(
  tab: Record<string, TabCell>,
  bar: number,
  cell: number,
  fingering: string[],
  duration: NoteDuration,
): void {
  fingering.forEach((f, s) => {
    if (f === '' || f == null) return;
    tab[`${bar}:${cell}:${s}`] = {
      fret: f === 'x' ? 'x' : parseInt(f, 10) || 0,
      duration,
      source: 'chord',
    };
  });
}

/**
 * Convert pasted song text into editor pages.
 * @param text pasted content
 * @param chordsPerBar beat slots per bar (1 | 2 | 3 | 4 | 6 | 8)
 * @param catalog chord entries (name + fingering) from chords.json
 * @param cellsPerBar 16th-note cells per bar (from time signature) for tab placement
 * @param barsPerLine how many bars each pasted line occupies before the next
 *        line continues; lines pack into consecutive bars (1|2|4)
 * @param barsPerPage bars before a new page starts (16 with the staff shown,
 *        24 without). Pages are still allocated at the max size (24).
 */
export function textToPages(
  text: string,
  chordsPerBar: number,
  catalog: ChordFingering[],
  cellsPerBar: number,
  barsPerLine = 2,
  barsPerPage = BARS_PER_PAGE,
): ImportResult {
  const slots = chordsPerBar > 0 ? chordsPerBar : 4;
  const cells = cellsPerBar > 0 ? cellsPerBar : 16;
  const spread = Math.min(BARS_PER_ROW, Math.max(1, barsPerLine));
  // Round to whole rows so a page never splits mid-row.
  const pageBars = Math.max(BARS_PER_ROW, Math.round(barsPerPage / BARS_PER_ROW) * BARS_PER_ROW);
  const noteDuration = durationForSlots(slots);
  const index = buildCatalogIndex(catalog);
  const blocks = parseLines(cleanInput(text));

  const pages: ImportedPage[] = [];
  const unmapped = new Set<string>();
  const filledRowSet = new Set<number>(); // global row indices that got a lyric

  // Resolve a global bar index to its page + local bar, creating pages as needed.
  // Pagination boundary is `pageBars` (16 or 24); pages are allocated at max size.
  const barAt = (globalBar: number) => {
    const pageIdx = Math.floor(globalBar / pageBars);
    while (pages.length <= pageIdx) pages.push(emptyPage(slots));
    return { page: pages[pageIdx], localBar: globalBar % pageBars };
  };

  // Pack lines into consecutive bars (reading order). Each line occupies `spread`
  // bars; its chords fill those bars' beat slots left-to-right. The next line
  // continues in the very next bar — no wasted bars when a line is short.
  let bar = 0; // global bar cursor

  blocks.forEach((block) => {
    const startBar = bar;

    // Attach the lyric to the ROW that contains this line's first bar (only one
    // lyric input renders per 4-bar row). When several packed lines share a row,
    // join their lyrics so all the words stay visible.
    const rowStartGlobalBar = Math.floor(startBar / BARS_PER_ROW) * BARS_PER_ROW;
    const { page: lyricPage, localBar: lyricBar } = barAt(rowStartGlobalBar);
    const text = block.section ? `${block.section} ${block.lyric}`.trim() : block.lyric;
    if (text) {
      const existing = lyricPage.barLyrics[lyricBar];
      lyricPage.barLyrics[lyricBar] = existing ? `${existing} / ${text}` : text;
      filledRowSet.add(rowStartGlobalBar / BARS_PER_ROW);
    }

    // Stamp this line's chords across its `spread` bars.
    block.chords.forEach((raw, i) => {
      const { entry, mapped } = normalizeChord(raw, index);
      if (!mapped && raw.trim()) unmapped.add(raw.trim());
      const name = entry ? entry.name : raw.replace(/\/[A-G](#|b)?$/, '');

      const barOffset = i % spread;
      const slot = Math.min(slots - 1, Math.floor(i / spread));
      const { page, localBar } = barAt(startBar + barOffset);

      page.barBeatChords[localBar][slot] = name;
      if (entry?.fingering) {
        const cell = Math.round((slot / slots) * cells);
        stampFingering(page.barTab, localBar, cell, entry.fingering, noteDuration);
      }
    });

    // Advance the cursor past the bars this line occupied.
    bar = startBar + spread;
  });

  if (pages.length === 0) pages.push(emptyPage(slots));

  return { pages, filledRows: filledRowSet.size, unmappedChords: [...unmapped] };
}
