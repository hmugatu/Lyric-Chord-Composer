# Print Feature Updates - New Feature Integration

## Overview
This document outlines the updates made to the print system to fully support new features added to the editor (Staff Notation and Tablature).

## New Features in Editor
1. **Staff Notation Component** - Renders musical notes on staff lines
   - File: `src/components/StaffNotes.tsx`
   - Derives notes from chord names using tonal.js
   - Uses VexFlow for rendering on web platform

2. **Tablature Component** - Renders guitar tab notation
   - File: `src/components/Tablature.tsx`
   - Shows 6-string guitar tab with fret numbers
   - Displays measure bar lines at correct positions

3. **Multi-Page Support** - Compositions now support multiple pages
   - Each page contains 16 bars (4 rows × 4 bars)
   - Page data structure: `{ barLyrics: string[], barBeatChords: string[][] }`
   - Stored in composition.notes as JSON: `{ pages: PageData[] }`

## Print Service Updates

### 1. PrintDialog Component (`src/components/PrintDialog.tsx`)
**Changes:**
- ✅ Enabled "Tablature" checkbox (previously disabled as "coming soon")
- ✅ Enabled "Staff Notation" checkbox (previously disabled as "coming soon")
- ✅ Updated default print options to include both features:
  ```typescript
  includeChordDiagrams: true,
  includeTablature: true,        // Now enabled
  includeNotation: true,         // Now enabled
  ```

### 2. HTML Templates (`src/services/printService/htmlTemplates.ts`)
**Changes:**
- ✅ **Dynamic Print Styles** - CSS now adjusts based on selected options:
  - Chord reference section size adjusted if not included
  - Tablature height becomes 0 if not included
  - Measure/staff height expands if tablature excluded
  - Both notation and tablature can be shown together or separately

- ✅ **Page Generation** - Updated `generatePageHtml()`:
  - Now accepts `options` parameter to control output
  - Conditionally generates `notesSvg` only when `includeNotation` is true
  - Conditionally generates `tabSvg` only when `includeTablature` is true
  - Staff lines rendered only when notation included

- ✅ **Layout Calculations**:
  - Header: 0.9"
  - Chord reference: 1.1" if included, 0.1" if excluded
  - Page indicator: 0.3"
  - Bar rows: Dynamically calculated based on included features
    - Always includes: lyrics (0.25") + chords (0.25")
    - Optional: tablature (0.4") + notation (remaining)

### 3. Note Rendering (`src/services/printService/noteRenderer.ts`)
**Status:** ✅ Already implemented
- Supports staff notation SVG generation
- Derives notes from chord names
- Handles accidentals (sharp/flat)
- Generates tablature with fret numbers

### 4. Chord SVG Generator (`src/services/printService/chordSvgGenerator.ts`)
**Status:** ✅ Already implemented
- Generates chord diagrams in SVG format
- Supports small/medium/large sizes
- Shows fingering, open strings, muted strings

### 5. Print Service (`src/services/printService/index.ts`)
**Status:** ✅ Already implemented
- `print()` - Opens native print dialog
- `exportPdf()` - Exports as PDF file
- Platform-specific handling (web vs mobile)

## Feature Interaction Matrix

| Feature | Editor | Print | Dialog Option |
|---------|--------|-------|---|
| Chord boxes | ✅ Always | ✅ Always | N/A (always shown) |
| Chord diagrams | ✅ Yes | ✅ Included | ✅ Toggle available |
| Staff notation | ✅ Yes (VexFlow) | ✅ SVG | ✅ Toggle available |
| Tablature | ✅ Yes | ✅ SVG | ✅ Toggle available |
| Lyrics | ✅ Yes | ✅ Yes | N/A (always shown) |
| Multi-page | ✅ Yes | ✅ Yes | N/A (respects pages) |
| Page size | N/A | ✅ Letter/A4 | ✅ Toggle available |
| Orientation | N/A | ✅ Portrait/Landscape | ✅ Toggle available |

## Print Output Layout

### With All Features (Default)
```
┌─────────────────────────────────┐
│  Header: Title, Artist, Settings│  0.9"
├─────────────────────────────────┤
│  Chord Reference Diagrams       │  1.1"
├─────────────────────────────────┤
│ Bar 1  Bar 2  Bar 3  Bar 4     │
│ Lyr    Lyr    Lyr    Lyr      │ 0.25" (lyrics)
│ C Dm G Am  (chord boxes)       │ 0.25" (chords)
│ [Staff with notes]             │ 1.25" (notation)
│ [Tablature with frets]         │ 0.4"  (tablature)
│ ────────────────────────────── │
│ (4 rows per page, pattern repeats)
└─────────────────────────────────┘
```

### Notation Only
```
┌─────────────────────────────────┐
│  Header                         │  0.9"
├─────────────────────────────────┤
│  Chord Reference                │  1.1"
├─────────────────────────────────┤
│ Lyrics, Chords, [Staff Notes] (larger)
│ (Tablature omitted - more space for staff)
└─────────────────────────────────┘
```

### Tablature Only
```
┌─────────────────────────────────┐
│  Header                         │  0.9"
├─────────────────────────────────┤
│  Chord Reference                │  1.1"
├─────────────────────────────────┤
│ Lyrics, Chords, [Tablature] (larger)
│ (Notation omitted - more space for tabs)
└─────────────────────────────────┘
```

### No Notation or Tablature (Minimal)
```
┌─────────────────────────────────┐
│  Header                         │  0.9"
├─────────────────────────────────┤
│  Chord Reference                │  1.1"
├─────────────────────────────────┤
│ Lyrics, Chords only
│ (Maximum space for lyrics and chords)
└─────────────────────────────────┘
```

## Testing Checklist

- [ ] Print dialog shows all options enabled and working
- [ ] Toggling "Chord Diagrams" hides/shows reference section
- [ ] Toggling "Tablature" includes/excludes tab SVG in output
- [ ] Toggling "Staff Notation" includes/excludes staff SVG in output
- [ ] Disabling both notation and tablature leaves only lyrics/chords
- [ ] Page size selection (Letter/A4) works correctly
- [ ] Orientation selection (Portrait/Landscape) works correctly
- [ ] Multi-page compositions print all pages with correct page breaks
- [ ] Print preview shows proper layout on web
- [ ] PDF export works on mobile with proper formatting
- [ ] Empty bars display correctly in output
- [ ] Staff notes render correctly from chord names
- [ ] Tablature displays correct fret numbers
- [ ] All text escapes HTML properly to avoid rendering issues

## Files Modified

1. `src/components/PrintDialog.tsx`
   - Enabled tablature and notation checkboxes
   - Updated default options to include new features

2. `src/services/printService/htmlTemplates.ts`
   - Updated `generatePrintHtml()` to pass options to page generator
   - Modified `generatePrintStyles()` to dynamically calculate heights
   - Updated `generatePageHtml()` to conditionally include features
   - Added dynamic CSS for optional features

## Backward Compatibility

✅ All changes are backward compatible:
- Existing compositions continue to work
- Print dialog gracefully handles missing pages data
- Falls back to single page if multi-page structure not found
- Defaults to showing all features (user can toggle off)

## Future Enhancements

- Add option for scaling/zoom level
- Support for different chord diagram sizes in output
- Add capo indicator in staff notation
- Support for custom templates
- Print preview with zoom controls
