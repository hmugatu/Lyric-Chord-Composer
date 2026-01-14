# Multi-Page Support Implementation Summary

## Changes Made

### 1. Data Model Updates ([Composition.ts](src/models/Composition.ts))
- Added `PageData` interface with `barLyrics` and `barBeatChords` 
- Added `CompositionPages` interface for the pages structure
- Updated `Composition` interface documentation to clarify that `notes` field stores JSON with `{ pages: PageData[] }` format

### 2. Default Composition Updated ([default.hmlcc](assets/default.hmlcc))
- Updated the `notes` field from legacy format to new multi-page format
- Default composition now has one page with 16 bars
- Format: `{ pages: [{ barLyrics: [], barBeatChords: [] }] }`

### 3. Editor UI Enhancements ([editor.tsx](app/(tabs)/editor.tsx))

#### State Management:
- Added `currentPage` state to track which page is being viewed
- Added `allPages` state to store multiple pages of bar data
- Each page contains 16 bars with lyrics and chord beats

#### Data Setters:
- `setBarLyrics()`: Updates bar lyrics for current page
- `setBarBeatChords()`: Updates chord beats for current page

#### Load/Save Logic:
- Updated initialization to detect multi-page format and load accordingly
- Supports backward compatibility with legacy single-page format
- Converts old formats to new pages structure automatically
- Both `handleLyricsChange` and `handleBeatChordChange` now save all pages in new format

#### UI Components:
- **Page Navigation Bar**: Shows between settings and chord reference
  - Previous button: Navigate to previous page (disabled on first page)
  - Page indicator: "Page X of Y (16 bars per page)"
  - Next/Add Page button: Navigate to next page or create new page if on last page
  
#### Styles Added:
- `pageNavContainer`: Container for page controls with light gray background
- `pageButton`: Styled buttons for page navigation
- `pageInfo`: Center section showing current page information
- `pageNumber`: Bold page number display
- `pageDescription`: Gray text showing bars per page

## Features

✅ **Multiple Pages**: Each composition can have unlimited pages
✅ **16 Bars Per Page**: Standard music notation format
✅ **Page Navigation**: Easy switching between pages
✅ **Add New Pages**: Automatically create new page when reaching the last one
✅ **Backward Compatibility**: Loads old compositions and converts them to new format
✅ **Persistent Storage**: All pages saved in composition notes field

## Data Structure

### New Format (Saved in notes field):
```json
{
  "pages": [
    {
      "barLyrics": ["Verse", "", "", "", ...],
      "barBeatChords": [["G", "", "", ""], ["D", "", "", ""], ...]
    },
    {
      "barLyrics": ["Chorus", "", "", "", ...],
      "barBeatChords": [["C", "", "", ""], ["G", "", "", ""], ...]
    }
  ]
}
```

### Supported Legacy Formats:
1. Single page with barLyrics/barBeatChords
2. Very old format with barChords (converted to beat chords)

## Testing

A test file has been created ([test-pages.json](test-pages.json)) with three pages:
- Page 1: 16 bars with G, D, A chord progression
- Page 2: 16 bars with Em, G, D chord progression  
- Page 3: 16 bars with C, G, D chord progression

To test:
1. Load the app with web: `npm run web`
2. Create a new composition
3. Use page navigation buttons to add/switch between pages
4. Edit lyrics and chords on different pages
5. Save composition and reload to verify persistence

## Files Modified

1. [src/models/Composition.ts](src/models/Composition.ts) - Added page interfaces
2. [assets/default.hmlcc](assets/default.hmlcc) - Updated default format
3. [app/(tabs)/editor.tsx](app/(tabs)/editor.tsx) - Added page UI and logic

## No Breaking Changes

- All existing code paths remain intact
- Automatic format conversion ensures old compositions still load
- UI maintains all existing functionality while adding page support
