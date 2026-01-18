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
- Web, iOS, and Android platforms
- **Customizable print options**:
  - Chord diagrams inline with bars
  - Staff notation (musical notes on treble clef)
  - Guitar tablature (6-string fret numbers)
  - Page size (Letter, A4)
  - Orientation (Portrait, Landscape)
- **Row-spanning architecture** - staff/tablature render once per row across all 4 bars
- **Compact flexible layout** with responsive spacing
- **Multi-page support** for compositions with 16 bars per page
- **Structure visualization** - empty bars show staff lines and tablature strings

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
Generates print-ready HTML with row-spanning architecture:
- `generatePrintHtml()` - Creates complete HTML document
- `generatePrintStyles()` - CSS with responsive flexbox layout
- `generateHeaderHtml()` - Title, composition info
- `generatePageHtml()` - Sheet music pages using row-spanning approach
- `generateStaffLinesSvg()` - Background staff lines (5 lines)
- Respects multi-page composition structure

**Architecture:**
- Each page has 4 rows (4 bars per row)
- Row structure: `.bar-row` (flex-column) containing:
  - `.bar` elements × 4 (lyrics + chord boxes)
  - `.row-tablature` - SVG with tablature for entire row (6 string lines)
  - `.row-staff` - SVG with staff notation for entire row (5 staff lines)
- Staff/tablature render once per row across all 4 bars
- Empty bars still show structure (staff lines and string lines)
- CSS heights: tablature min-height 55pt, staff min-height 70pt

### 3. SVG Generators
#### Chord SVG Generator (`src/services/printService/chordSvgGenerator.ts`)
- `generateChordSvg(chord, size)` - Creates inline SVG chord diagrams
- Supports small/medium/large sizes with proportional scaling
- Renders frets, strings, finger dots, open/muted markers

#### Note Renderer (`src/services/printService/noteRenderer.ts`)
- `generateNotesHtml(beatChords, width, height)` - Creates staff notation SVG
  - Always generates SVG (even for empty chords) to show structure
  - Draws 5 staff lines as background
  - Positions note dots at correct lines/spaces
  - Height: typically 70px for row-spanning
- `generateTablatureHtml(beatChords, chordsData, width, height)` - Creates tablature SVG
  - Always generates string lines (6 strings)
  - Conditionally generates fret numbers when data exists
  - Height: typically 55px for row-spanning
- Handles empty bars gracefully (shows structure without content)

### 4. Print Dialog Component (`src/components/PrintDialog.tsx`)
Clean modal dialog for print options with:
- **Content toggles**:
  - ✅ Chord Diagrams checkbox (inline with bars)
  - ✅ Tablature checkbox (6-string notation)
  - ✅ Staff Notation checkbox (5-line staff)
- **Page size options**: Letter (8.5" x 11") / A4 (210mm x 297mm)
- **Orientation options**: Portrait / Landscape
- **Action buttons**: Cancel (dialog close), Print (system print dialog)
- Removed Export PDF option (redundant with browser print-to-PDF)
- Clean UI with emoji indicators and descriptions

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
Now uses row-spanning SVG generation for efficient rendering:

**Per Row (4 bars):**
```
┌─ Bar 1      │ Bar 2      │ Bar 3      │ Bar 4      │
│ Lyrics      │ Lyrics     │ Lyrics     │ Lyrics     │
│ Chord Boxes │ Chord Boxes│ Chord Boxes│ Chord Boxes│
├────────────────────────────────────────────────────┤
│ Tablature SVG (6 string lines, 800px × 55pt)      │
├────────────────────────────────────────────────────┤
│ Staff SVG (5 staff lines, 800px × 70pt)           │
└────────────────────────────────────────────────────┘
```

**CSS Heights (responsive min-heights, no fixed heights):**
- `.bar-row`: flex-column, gap 2pt
- `.bar-lyrics`: min-height 12pt, font-size 11pt
- `.chord-row`: min-height 14pt, display flex with spacing
- `.row-tablature`: min-height 55pt, contains SVG with 6 string lines
- `.row-staff`: min-height 70pt, contains SVG with 5 staff lines + background

**Margin/Padding:**
- `.bar-row` margin-bottom: 2pt
- `.bar-lyrics` margin-bottom: 1pt
- `.chord-row` margin-bottom: 2pt
- All row containers padding: 2pt 0

### Multi-Page Support
Compositions can have multiple pages, each containing:
- 4 rows of 4 bars each (16 bars per page)
- Structure: `{ barLyrics: string[], barBeatChords: string[][] }`
- Stored in `composition.notes` as JSON: `{ pages: PageData[] }`
- Print output includes proper page breaks between pages

### CSS Layout Strategy

The layout uses flexbox with responsive heights:

```css
/* Bar row container */
.bar-row {
  display: flex;
  flex-direction: column;
  margin-bottom: 2pt;
}

/* Individual bars (4 per row) */
.bars-container {
  display: flex;
  flex-direction: row;
  gap: 2pt;
  width: 100%;
}

.bar {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 40pt;
}

/* Content within bars */
.bar-lyrics {
  font-size: 11pt;
  text-align: center;
  margin-bottom: 1pt;
  min-height: 12pt;
}

.chord-row {
  display: flex;
  gap: 1pt;
  margin-bottom: 2pt;
  justify-content: space-between;
  min-height: 14pt;
}

/* Row-spanning elements */
.row-tablature {
  width: 100%;
  min-height: 55pt;
  padding: 2pt 0;
  font-family: 'Courier New', monospace;
  font-size: 7pt;
}

.row-staff {
  width: 100%;
  min-height: 70pt;
  padding: 2pt 0;
  position: relative;
}

/* No borders for clean print look */
.chord-box { background: #fff; border: none; }
.measure { background: #fff; border: none; }
.header { border: none; }
```

### Feature Toggling

The `PrintOptions` interface controls output:
```typescript
interface PrintOptions {
  includeChordDiagrams: boolean;  // Show chord symbols inline with bars
  includeTablature: boolean;       // Show 6-string guitar tablature
  includeNotation: boolean;        // Show 5-line staff notation
  pageSize: 'letter' | 'a4';      // Paper size
  orientation: 'portrait' | 'landscape';  // Page orientation
}

// Examples:
{ includeChordDiagrams: true, includeTablature: true, includeNotation: true }  // Full
{ includeChordDiagrams: true, includeTablature: false, includeNotation: false } // Chords only
{ includeChordDiagrams: false, includeTablature: true, includeNotation: false } // Tabs only
```

Each option toggle automatically adjusts:
- SVG generation calls (staff and tablature only render if enabled)
- HTML structure (conditional row-spanning elements)
- Empty bars still show structure even when content is hidden

## Print Handler Architecture

Simplified to single print method:
```typescript
const handlePrint = async () => {
  setIsPrinting(true);
  try {
    const html = generatePrintHtml(composition, chordsData, options);
    if (Platform.OS === 'web') {
      // Web: Create iframe and use window.print()
      const iframe = document.createElement('iframe');
      iframe.srcDoc = html;
      document.body.appendChild(iframe);
      iframe.contentWindow.print();
    } else {
      // Mobile: Use expo-print
      await Print.printAsync({ html });
    }
  } finally {
    setIsPrinting(false);
    setShowPrintDialog(false);
  }
};
```

| Platform | Method | PDF Export |
|----------|--------|------------|
| Web | iframe + window.print() | Browser "Print to PDF" or system dialog |
| iOS | expo-print.printAsync() | System print dialog with PDF option |
| Android | expo-print.printAsync() | System print dialog with PDF option |

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

Edit CSS in `generatePrintStyles()` in `htmlTemplates.ts`:
```css
.bar-row {
  margin-bottom: 2pt;  /* Space between bar rows (reduce for compact) */
}

.row-tablature {
  min-height: 55pt;    /* Tablature row height (adjust 40-70pt range) */
}

.row-staff {
  min-height: 70pt;    /* Staff row height (adjust 50-85pt range) */
}

.bar-lyrics {
  min-height: 12pt;    /* Lyrics row height */
  margin-bottom: 1pt;  /* Space after lyrics */
}

.chord-row {
  min-height: 14pt;    /* Chord boxes row height */
  margin-bottom: 2pt;  /* Space after chords */
}
```

**Note:** Use `min-height` instead of `height` to allow flexible sizing based on content
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
