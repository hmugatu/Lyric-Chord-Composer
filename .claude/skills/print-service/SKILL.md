---
name: print-service
description: |
  Implements cross-platform print and PDF export for React Native/Expo compositions.
  Supports chord diagrams, staff notation, and guitar tablature in print output.
  Use when printing music compositions, generating PDFs, or working with
  expo-print, VexFlow-rendered notation, and document rendering.
---

# Print Document & Composition Skill

Add professional print functionality to music composition applications with PDF export and cross-platform printing support.

## Overview

This skill implements cross-platform print functionality for React Native/Expo music composition applications, supporting:
- Direct print dialog (system native)
- PDF export with share sheet
- Web, iOS, and Android platforms
- **Customizable print options**:
  - Chord diagrams (reference section with fingering charts)
  - Staff notation (musical notes on treble clef)
  - Guitar tablature (6-string fret numbers)
  - Page size (Letter, A4)
  - Orientation (Portrait, Landscape)
- **Dynamic layout** that adjusts based on selected features
- **Multi-page support** for compositions with 16 bars per page
- **Fixed-height layout** that fills the printable area properly

## Files Architecture

### 1. Print Service (`src/services/printService/index.ts`)
Main service class implementing `PrintService`:
- `print(composition, chordsData, options)` - Opens native print dialog
- `exportPdf(composition, chordsData, options)` - Generates PDF and shares
- Platform-specific handling (web uses iframe, mobile uses expo-print)
- Handles both single-page and multi-page compositions

**PrintOptions interface:**
```typescript
interface PrintOptions {
  includeChordDiagrams: boolean;  // Show chord fingering diagrams at top
  includeTablature: boolean;       // Show 6-string guitar tabs
  includeNotation: boolean;        // Show staff notation with notes
  pageSize: 'letter' | 'a4';      // Paper size
  orientation: 'portrait' | 'landscape';  // Page orientation
}
```

### 2. HTML Template Generator (`src/services/printService/htmlTemplates.ts`)
Generates print-ready HTML with dynamic CSS:
- `generatePrintHtml()` - Creates complete HTML document
- `generatePrintStyles()` - Dynamic CSS based on selected options
- `generateHeaderHtml()` - Title, artist, key, tempo, capo
- `generateChordReferenceHtml()` - Visual chord diagrams (SVG)
- `generatePageHtml()` - Sheet music pages with conditional features
- Respects multi-page composition structure

**Features:**
- Dynamically calculates layout heights based on included features
- Chord reference section size adjusts (1.1" with diagrams, 0.1" without)
- Staff notation space expands when tablature excluded
- Proper page breaks for multi-page compositions

### 3. SVG Generators
#### Chord SVG Generator (`src/services/printService/chordSvgGenerator.ts`)
- `generateChordSvg(chord, size)` - Creates inline SVG chord diagrams
- Supports small/medium/large sizes with proportional scaling
- Renders frets, strings, finger dots, open/muted markers

#### Note Renderer (`src/services/printService/noteRenderer.ts`)
- `getChordNotes()` - Derives notes from chord names using tonal.js
- `generateNotesHtml()` - Creates staff notation SVG with notes
- `generateTablatureHtml()` - Creates tablature SVG with fret numbers
- Handles accidentals (sharp/flat) and chord voicing

### 4. Print Dialog Component (`src/components/PrintDialog.tsx`)
Modal dialog for print options with:
- **Content toggles** (all enabled and functional):
  - ✅ Chord Diagrams checkbox
  - ✅ Tablature checkbox
  - ✅ Staff Notation checkbox
- **Page size options**: Letter (8.5" x 11") / A4 (210mm x 297mm)
- **Orientation options**: Portrait / Landscape
- **Action buttons**: Cancel, Export PDF, Print
- Default settings include all features enabled

## Dependencies

```bash
npx expo install expo-print
```

## Integration

Add to editor screen:
1. Import PrintService and PrintDialog
2. Add state: `showPrintDialog`, `isPrinting`
3. Add printer icon button in header
4. Add handlers: `handlePrint()`, `handleExportPdf()`
5. Add PrintDialog to Portal

## Key Implementation Details

### Dynamic Print Layout
The system calculates layout heights based on print options and page size:

**Letter size (8.5" x 11") with 0.5" margins:**
- Printable area: 7.5" wide × 10" tall
- Header: 0.9" (title, artist, tempo, key, capo)
- Chord reference: 1.1" if included, 0.1" if excluded
- Page indicator: 0.3"
- Bar rows: Remaining height ÷ 4 (approximately 2.0" per row)

**Each bar row components (flexible sizing):**
- Lyrics: 0.25" (always shown)
- Chord boxes: 0.25" (always shown)
- Staff notation: Variable (0-1.5") - only if `includeNotation: true`
- Tablature: Variable (0-0.5") - only if `includeTablature: true`

**Layout combinations:**
```
With Notation + Tablature:
┌─ Lyrics (0.25")
├─ Chords (0.25")
├─ Staff Notes (1.25")
└─ Tablature (0.4")
  Total: ~2.15" per row

With Notation only:
┌─ Lyrics (0.25")
├─ Chords (0.25")
└─ Staff Notes (1.65") ← expanded
  Total: ~2.15" per row

With Tablature only:
┌─ Lyrics (0.25")
├─ Chords (0.25")
└─ Tablature (1.65") ← expanded
  Total: ~2.15" per row

With neither (minimal):
┌─ Lyrics (0.25")
└─ Chords (1.9") ← expanded
  Total: ~2.15" per row
```

### Multi-Page Support
Compositions can have multiple pages, each containing:
- 4 rows of 4 bars each (16 bars per page)
- Structure: `{ barLyrics: string[], barBeatChords: string[][] }`
- Stored in `composition.notes` as JSON: `{ pages: PageData[] }`
- Print output includes proper page breaks between pages

### CSS Layout Strategy
```css
/* Dynamic sizing based on options */
.bar-row {
  height: ${barRowHeight}in;  /* calculated dynamically */
  display: flex;
}

.bar-lyrics { height: 0.25in; }
.chord-row { height: 0.25in; }

.measure {
  height: ${measureHeight}in;  /* 0 if notation excluded */
  position: relative;
  background: #fff;
}

.tablature {
  height: ${tablatureHeight}in;  /* 0 if tablature excluded */
  display: ${tablatureHeight === 0 ? 'none' : 'block'};
}

/* No borders for clean print look */
.chord-box { background: #fff; }
.measure { background: #fff; }
.header { border: none; }
```

### Feature Toggling
The `PrintOptions` interface controls output:
```typescript
// Example: Notation + Tablature (default)
{ includeChordDiagrams: true, includeTablature: true, includeNotation: true }

// Example: Chords only (minimal)
{ includeChordDiagrams: true, includeTablature: false, includeNotation: false }

// Example: Tablature focused
{ includeChordDiagrams: false, includeTablature: true, includeNotation: false }
```

Each option toggle automatically adjusts:
- CSS layout heights
- SVG generation calls
- HTML structure
- Available space for remaining elements

### Platform Handling
| Platform | Print | PDF Export |
|----------|-------|------------|
| Web | iframe + window.print() | Browser "Save as PDF" |
| iOS | expo-print.printAsync() | printToFileAsync() + Sharing |
| Android | expo-print.printAsync() | printToFileAsync() + Sharing |

## Platform Handling

| Platform | Print | PDF Export | Notes |
|----------|-------|------------|-------|
| Web | iframe + window.print() | Browser "Save as PDF" | User chooses printer/format in system dialog |
| iOS | expo-print.printAsync() | printToFileAsync() + Sharing | Native print queue, share sheet for PDF |
| Android | expo-print.printAsync() | printToFileAsync() + Sharing | Native print queue, share sheet for PDF |

## Composition Data Structure

Compositions store pages as JSON in the `notes` field:

```typescript
interface Composition {
  notes: string; // JSON stringified CompositionPages
}

interface CompositionPages {
  pages: PageData[];
}

interface PageData {
  barLyrics: string[];      // 16 bar lyrics (one per bar)
  barBeatChords: string[][]; // 16 bars, each with 4 beats
}

// Example:
{
  "pages": [
    {
      "barLyrics": ["Verse", "", "", "", "Chorus", "", "", "", "Bridge", "", "", "", "Outro", "", "", ""],
      "barBeatChords": [
        ["G", "", "", ""],
        ["G", "", "", ""],
        ["D", "", "", ""],
        ["A", "", "", ""],
        // ... 12 more bars
      ]
    },
    // ... more pages
  ]
}
```

## Common Tasks

### Add Print Button to Header
```tsx
<IconButton
  icon="printer"
  size={24}
  onPress={() => setShowPrintDialog(true)}
  disabled={isPrinting}
  iconColor="#333"
/>
```

### Handle Print Options
```typescript
const options: PrintOptions = {
  includeChordDiagrams: true,  // Show chord reference
  includeTablature: true,       // Show tabs
  includeNotation: true,        // Show staff notes
  pageSize: 'letter',
  orientation: 'portrait',
};
```

### Change Default Print Options
Update the `useState` initializer in `PrintDialog.tsx`:
```typescript
const [options, setOptions] = useState<PrintOptions>({
  includeChordDiagrams: true,  // Toggle default
  includeTablature: false,      // Toggle default
  includeNotation: false,       // Toggle default
  pageSize: 'letter',
  orientation: 'portrait',
});
```

### Customize Layout Spacing
Modify height values in `generatePrintStyles()`:
- `headerHeight` - Title section size
- `chordRefHeight` - Chord diagrams section
- `pageIndicatorHeight` - Page number display
- `lyricsHeight` - Lyrics row height
- `chordRowHeight` - Chord boxes row height
- `tablatureHeight` - Tab section height
- `measureHeight` - Staff notation height

## Reference Implementation

See these files in this project:
- `src/services/printService/index.ts` - Main print service
- `src/services/printService/htmlTemplates.ts` - HTML/CSS generation
- `src/services/printService/chordSvgGenerator.ts` - Chord diagram SVG
- `src/services/printService/noteRenderer.ts` - Staff notation and tab SVG
- `src/components/PrintDialog.tsx` - Print options UI
- `app/(tabs)/editor.tsx` - Integration example
