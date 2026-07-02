---
name: note-rendering
description: |
  Renders musical notes on staff notation and guitar tablature derived from chord names.
  Use when working on staff display, note rendering, tablature, chord-to-note conversion,
  or VexFlow/SVG music notation features in the app.
---

# Note Rendering & Tablature Skill

Automatically derives and renders musical notes on the staff and tablature based on selected chord names.

## Overview

This feature uses:
- **@tonaljs/tonal** to parse chord names and extract chord tones (root, 3rd, 5th, 7th)
- **VexFlow 5.0** for professional music notation rendering (clefs, staves, proper note shapes)
- **Chord fingering data** from `chords/chords.json` for tablature display

## Important: Tonal.js Import Pattern

**CRITICAL**: In browser/bundler contexts (React Native web, Metro, webpack), always import tonal.js as a namespace:

```typescript
// CORRECT - works in browser context
import * as Tonal from '@tonaljs/tonal';
const chord = Tonal.Chord.get('Am');

// INCORRECT - may fail with "Cannot read properties of undefined"
import { Chord } from '@tonaljs/chord';
const chord = Chord.get('Am');  // Chord may be undefined!
```

The individual package imports (`@tonaljs/chord`, `@tonaljs/note`) can fail silently in bundled browser environments. Always use `@tonaljs/tonal` and access via `Tonal.Chord`, `Tonal.Note`, etc.

## Architecture

### Print Output (HTML/SVG)
- `src/services/printService/noteRenderer.ts` - Core note rendering and tablature generation
- Generates inline SVG for PDF/print HTML templates

### Editor UI (React Native)
- `src/components/StaffNotes.tsx` - VexFlow-based staff notation for web
- `src/components/Tablature.tsx` - Guitar tablature component
- Renders notes and tabs in real-time as chords are selected

## Key Files

| File | Purpose |
|------|---------|
| `src/services/printService/noteRenderer.ts` | Chord parsing, note positioning, SVG generation, tablature SVG |
| `src/components/StaffNotes.tsx` | VexFlow staff notation for editor (web) |
| `src/components/Tablature.tsx` | Guitar tablature component for editor |
| `src/services/printService/htmlTemplates.ts` | Integrates notes and tabs into print output |
| `app/(tabs)/editor.tsx` | Uses StaffNotes and Tablature in measure boxes |
| `chords/chords.json` | Chord fingering data for tablature |

## Core Functions

### noteRenderer.ts

```typescript
// Get notes from chord name using tonal.js
getChordNotes(chordName: string): StaffNote[]

// Calculate Y position on staff for MIDI note
getNoteYPosition(midiNote: number, staffHeight: number): number

// Generate SVG for print HTML (staff notation)
generateNotesHtml(beatChords: string[], measureWidth: number, staffHeight: number): string

// Generate SVG for print HTML (tablature)
generateTablatureHtml(beatChords: string[], chordsData: ChordDataForTab[], measureWidth: number, tabHeight: number): string
```

### StaffNotes.tsx

```typescript
interface StaffNotesProps {
  beatChords: string[];    // Array of chord names (numMeasures * 4 beats)
  width: number;           // Container width in pixels
  height: number;          // Container height in pixels
  numMeasures?: number;    // Number of measures to display (default: 1)
  scale?: number;          // VexFlow scale factor (default: 0.75)
}
```

**Scale prop**: Controls the size of notes, clef, and staff lines. Default 0.75 (75%).
- Smaller values (0.6-0.7) = more compact notation
- Larger values (0.8-1.0) = bigger notation

### Tablature.tsx

```typescript
interface TablatureProps {
  beatChords: string[];      // Array of chord names (numMeasures * 4 beats)
  chordsData: ChordData[];   // Full chord database with fingerings
  width: number;             // Total width for all measures
  height?: number;           // Height of tablature area (default 60)
  numMeasures?: number;      // Number of measures to display (default: 4)
}
```

**numMeasures prop**: Tablature renders vertical bar lines at measure boundaries and positions fret numbers correctly within each measure.

## Staff Positioning

The staff uses treble clef positioning:
- Bottom line = E4 (MIDI 64)
- Lines represent E4, G4, B4, D5, F5
- Middle C (C4) appears on ledger line below staff
- Each staff position (line or space) = half the line spacing

```
Line 5: F5  ─────────────
Line 4: D5  ─────────────
Line 3: B4  ─────────────
Line 2: G4  ─────────────
Line 1: E4  ─────────────
        C4  ── (ledger)
```

## Chord Parsing

Uses `@tonaljs/chord` to parse chord names. Handles various formats:

| Input | Parsed As | Notes |
|-------|-----------|-------|
| `C` | C major | C, E, G |
| `Am` | A minor | A, C, E |
| `G7` | G dominant 7 | G, B, D, F |
| `A major` | A major | A, C#, E |
| `Dm (easy)` | D minor | D, F, A |

The parser strips common suffixes like "(easy)", "(barre)", "major", "minor" for compatibility with the chord database.

## Rendering Details

### Note Heads
- Ellipse shape with -15° rotation (standard notation style)
- Filled black for quarter notes
- Size scales with staff height

### Stems
- Single stem for chord (attached to top note)
- Extends upward from note heads
- Length = ~35% of staff height

### Accidentals
- Sharp (#) and flat (♭) symbols
- Positioned to the left of note head
- Rendered as SVG text elements

## Integration Points

### In Editor (editor.tsx)

The editor renders 4 rows of 4 measures each. Each row passes a flattened 16-beat array:

```tsx
// Get all 4 bars worth of chords for this row (16 beats)
const rowBeatChords = [0, 1, 2, 3].map(colIndex => {
  const barIndex = rowIndex * 4 + colIndex;
  return barBeatChords[barIndex] || ['', '', '', ''];
}).flat();

// Tablature spanning all 4 bars with bar lines
<View style={styles.tablatureBox}>
  <Tablature
    beatChords={rowBeatChords}
    chordsData={chordsData}
    width={CONTENT_WIDTH}
    height={65}
    numMeasures={4}
  />
</View>

// Staff with 4 measures (scaled to 75%)
<View style={styles.measureBox}>
  <StaffNotes
    beatChords={rowBeatChords}
    width={CONTENT_WIDTH}
    height={85}
    numMeasures={4}
    scale={0.75}
  />
</View>
```

### In Print (htmlTemplates.ts)
```typescript
const notesSvg = hasChords ? generateNotesHtml(beatChords, 150, 50) : '';

rowHtml += `
  <div class="measure">
    <div class="staff-lines">...</div>
    ${notesSvg}
  </div>
`;
```

## Dependencies

- `@tonaljs/tonal` - Main tonal.js bundle (use this, not individual packages)
- `vexflow` - Music notation rendering (dynamic import on web only)
- `react-native-svg` - SVG rendering in React Native

## Common Tasks

### Adjusting note size
Modify `noteRadius` calculation in both files:
```typescript
const noteRadius = Math.min(height / 10, 5);
```

### Changing octave
Notes default to octave 4. Modify in `noteToStaffNote()`:
```typescript
const fullNote = `${noteName}4`; // Change 4 to desired octave
```

### Adding more chord tones
Currently renders first 3 notes (root, 3rd, 5th). To include 7th:
```typescript
return chord.notes.slice(0, 4).map(...); // Change 3 to 4
```

## VexFlow Patterns

### Dynamic Import (Web Only)
VexFlow only works on web platform. Use dynamic import to avoid bundling issues on native:

```typescript
if (Platform.OS === 'web') {
  const VexFlow = await import('vexflow');
  const vf = VexFlow.default || VexFlow;
  const { Renderer, Stave, StaveNote, Voice, Formatter, Accidental, GhostNote } = vf;
}
```

### Empty Beats - Use GhostNote
For empty beats where no chord is present, use `GhostNote` instead of rest symbols:

```typescript
// CORRECT - invisible placeholder maintains timing
notes.push(new GhostNote({ duration: 'q' }));

// AVOID - shows rest symbol user doesn't want
notes.push(new StaveNote({ keys: ['b/4'], duration: 'qr' }));
```

`GhostNote` is invisible but still counts toward the voice's beat requirements.

### Note Duration Based on Following Empties
Calculate note duration by counting consecutive empty beats after a chord:

```typescript
const noteDurations: { [key: number]: string } = {
  0: 'q',   // quarter note (1 beat)
  1: 'h',   // half note (2 beats)
  2: 'hd',  // dotted half note (3 beats)
  3: 'w',   // whole note (4 beats)
};
```

## Troubleshooting

### Notes not appearing
1. Check tonal.js import pattern (use `@tonaljs/tonal` namespace import)
2. Check chord name is valid (parsed by tonal.js)
3. Verify `beatChords` array is passed correctly
4. Check SVG dimensions match container
5. Verify VexFlow dynamic import succeeded (check console for errors)

### "Cannot read properties of undefined (reading 'get')"
This error means tonal.js import failed. Fix by changing:
```typescript
// From this:
import { Chord } from '@tonaljs/chord';

// To this:
import * as Tonal from '@tonaljs/tonal';
// Then use: Tonal.Chord.get(...)
```

### Notes positioned incorrectly
1. Verify `getNoteYPosition` calculation
2. Check staffHeight matches actual staff area
3. Ensure topOffset aligns with staff lines

### Chord not recognized
The parser handles common formats but may fail on:
- Unusual chord symbols (try simplifying)
- Non-standard notation
- Typos in chord name

### Chord Name Normalization
The parser cleans chord names before parsing:
```typescript
let cleanName = chordName
  .replace(/\s*\(easy\)/gi, '')    // Remove "(easy)"
  .replace(/\s*\(barre\)/gi, '')   // Remove "(barre)"
  .replace(/\s*\(alt\)/gi, '')     // Remove "(alt)"
  .replace(/\s+major$/i, '')       // "A major" → "A"
  .replace(/\s+minor$/i, 'm')      // "A minor" → "Am"
  .replace(/\s+/g, '');            // Remove spaces
```

### Power Chords (e.g., A5)
Power chords need special handling since tonal.js may not recognize them:
```typescript
if (/^[A-G][#b]?5$/.test(tonalName)) {
  // Return root and fifth manually
  return [root, getFifth(root)];
}
```

## Tablature Rendering

### Guitar String Layout
Tablature displays 6 horizontal lines representing guitar strings:
```
e ─────────────  (high E, string 1)
B ─────────────
G ─────────────
D ─────────────
A ─────────────
E ─────────────  (low E, string 6)
```

### Fingering Data Format
Chord fingering in `chords.json` is stored as array `[low E, A, D, G, B, high e]`:
```json
{
  "name": "A major",
  "fingering": ["x", "0", "2", "2", "2", "0"]
}
```
- `"x"` = muted string (don't play)
- `"0"` = open string
- `"1"`, `"2"`, etc. = fret number

### Display Conversion
The fingering array is reversed for display since tablature shows high e at top:
```typescript
const displayFingering = [...chord.fingering].reverse();
// ["x", "0", "2", "2", "2", "0"] becomes ["0", "2", "2", "2", "0", "x"]
```

### Integration Points

#### In Editor (editor.tsx)
```tsx
<View style={styles.measureBox}>
  <StaffNotes beatChords={...} width={...} height={70} />
  <Tablature
    beatChords={barBeatChords[barIndex]}
    chordsData={chordsData}
    width={measureWidth - 32}
    height={50}
  />
</View>
```

#### In Print (htmlTemplates.ts)
```typescript
const tabSvg = hasChords ? generateTablatureHtml(beatChords, chordsData, 150, 35) : '';
rowHtml += `
  <div class="tablature">${tabSvg}</div>
`;
```
