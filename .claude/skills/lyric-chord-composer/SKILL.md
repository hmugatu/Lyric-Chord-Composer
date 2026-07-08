---
name: lyric-chord-composer
description: |
  Context about the Lyric-Chord-Composer Vite/React web app for guitar
  music composition. Use when working on components, models, services,
  or understanding the codebase structure. Covers chord diagrams, lyrics,
  tablature, and music notation features.
---

# Lyric-Chord-Composer Application Overview

## Application Purpose

**Lyric-Chord-Composer** is a web guitar music composition application for creating, editing, and managing guitar compositions with integrated views of:
- Lyrics with chord positioning
- Visual chord diagrams
- Guitar tablature
- Standard musical notation (staff)

**Target Users:**
- Songwriters creating original compositions
- Musicians documenting chord progressions and lyrics
- Teachers creating educational guitar materials
- Artists sharing arrangements with chord diagrams

## Technology Stack

| Category | Technology |
|----------|------------|
| Framework | React 19 + Vite 6 |
| Language | TypeScript 5.9 |
| Routing | React Router 7 (HashRouter) |
| State Management | Zustand 5.0 with Immer middleware |
| UI Components | MUI (Material UI) 6 |
| Music Theory | @tonaljs (chord, note, tonal) |
| Music Notation | VexFlow 5.0 |
| Graphics | Inline SVG |
| Storage | localStorage + `.hmlcc` file download/upload (local only) |

## Project Structure

```
Lyric-Chord-Composer/            # repo root = the Vite app
├── index.html                   # Vite entry HTML
├── vite.config.ts               # Vite config (GitHub Pages base path)
├── public/                      # Static assets (favicon, .nojekyll)
└── src/
    ├── main.tsx                 # App bootstrap
    ├── App.tsx                  # Root component + React Router routes
    ├── theme.tsx                # MUI theme / color mode
    │
    ├── screens/
    │   ├── HomeScreen.tsx        # Compositions list, create/import
    │   └── EditorScreen.tsx      # Main composition editor
    │
    ├── models/                  # TypeScript data models
    │   ├── Composition.ts        # Main composition model
    │   ├── Chord.ts              # Chord definitions
    │   ├── Tablature.ts          # Tab notation
    │   ├── Notation.ts           # Staff notation
    │   ├── Lyrics.ts             # Lyrics with chord positions
    │   ├── Note.ts               # Notes, tunings, time signatures
    │   └── index.ts              # Barrel export
    │
    ├── store/
    │   └── compositionStore.ts   # Zustand global state
    │
    ├── services/
    │   ├── compositionService.ts # Save/load/export compositions
    │   ├── compositionTemplates.ts # Default templates
    │   ├── cache.ts             # localStorage caching
    │   ├── tunerTone.ts         # Reference-tone playback for the tuner
    │   ├── fileStorage/
    │   │   ├── LocalFileProvider.ts # Browser download / file-picker
    │   │   └── types.ts         # StorageProvider interface
    │   └── printService/
    │       ├── index.ts          # Browser print service
    │       ├── chordSvgGenerator.ts # SVG chord diagrams
    │       ├── noteRenderer.ts   # Staff/tab SVG
    │       └── htmlTemplates.ts  # Print templates
    │
    ├── components/              # React components (dialogs, diagrams, staff, tab)
    ├── data/
    │   └── chords.json          # Chord database (200+ chords)
    └── utils/                   # Chord naming, text import, pitch detect, geometry
```

## Core Data Models

### Composition (`src/models/Composition.ts`)
The main data structure containing:
- `id`: Unique identifier
- `title`, `artist`: Metadata
- `sections`: Array of Section objects
- `globalSettings`: Key, tempo, timeSignature, tuning, capo
- `difficulty`, `tags`: Additional metadata
- `createdAt`, `updatedAt`: Timestamps

### Section
Types: `Intro`, `Verse`, `Chorus`, `Bridge`, `Outro`, `Custom`
Each section contains:
- `notation`: Staff notation data
- `tablature`: Tab data
- `lyrics`: Lyrics with chord positions
- `chordProgression`: Array of chord references

### Chord (`src/data/chords.json`)
Database of 200+ chords with:
- `key`: Root note (C, D, E, etc.)
- `suffix`: Quality (major, minor, 7, m7, sus2, sus4, add9, etc.)
- `positions`: Array of fingering options with fret/string data

## State Management

Single Zustand store at `src/store/compositionStore.ts`:

```typescript
interface CompositionState {
  currentComposition: Composition | null;
  compositions: Composition[];
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  lastCacheUpdate: Date | null;

  // Composition actions
  createComposition: (title: string, artist?: string) => void;
  loadComposition: (id: string) => void;
  setCurrentComposition: (id: string) => void;
  updateComposition: (updates: Partial<Composition>) => void;
  deleteComposition: (id: string) => void;

  // Section management
  addSection: (section: Omit<Section, 'id' | 'order'>) => void;
  updateSection: (sectionId: string, updates: Partial<Section>) => void;
  deleteSection: (sectionId: string) => void;
  reorderSections: (sectionIds: string[]) => void;

  // Global settings
  updateGlobalSettings: (settings: Partial<GlobalSettings>) => void;

  // File operations
  exportComposition: (id: string) => Promise<void>;
  importComposition: () => Promise<void>;

  // Cache operations
  loadFromCache: () => Promise<void>;
  saveToCache: () => Promise<void>;
  initializeStore: () => Promise<void>;
}
```

**Pattern:** Components access state via hooks:
```typescript
const composition = useCompositionStore(state => state.currentComposition);
const addSection = useCompositionStore(state => state.addSection);
```

## Services Architecture

### compositionService
- `saveComposition(comp, provider)`: Save to storage
- `loadComposition(id, provider)`: Load from storage
- `exportToFile(comp)`: Export as `.hmlcc` file
- `importFromFile(data)`: Import and validate

### fileStorage Providers
Provider pattern with `StorageProvider` interface:
- `LocalFileProvider`: Browser download + file-picker upload of `.hmlcc` files (local only; no cloud sync)

### printService
- `print(composition, chordsData, options)`: Opens the browser print dialog (save-as-PDF available there)
- Uses `window.open` + `window.print()` with generated HTML

## File Format (.hmlcc)

JSON-based format for portable composition files:
```json
{
  "version": "1.0",
  "composition": {
    "id": "uuid",
    "title": "Song Title",
    "artist": "Artist Name",
    "sections": [...],
    "globalSettings": {
      "key": "G",
      "tempo": 120,
      "timeSignature": "4/4",
      "tuning": "Standard",
      "capo": 0
    }
  }
}
```

## Key Patterns & Conventions

1. **Provider Pattern**: Storage backends implement `StorageProvider` interface
2. **Service Layer**: Business logic separated from UI components
3. **Routing**: React Router (`HashRouter`) declared in `src/App.tsx`
4. **Immutable State**: Zustand + Immer for safe state updates
5. **Component Hooks**: Access store via `useCompositionStore` selector pattern

## Navigation Flow

```
App.tsx (HashRouter)
├── /        → HomeScreen  (compositions list, create/import)
└── /editor  → EditorScreen (edit current composition)
```

## Editor Layout & Measure Alignment

The editor displays a paper-sized canvas (1000x1100px) with 4 rows of 4 measures each (16 bars per page). Three visual elements must align vertically:

1. **Chord Boxes** - Clickable boxes showing chord names
2. **Tablature** - 6-string tab with fret numbers
3. **Staff Notation** - VexFlow-rendered musical staff

### Layout Constants (`src/screens/EditorScreen.tsx`)

```typescript
const PAPER_WIDTH = 1000;
const PAPER_HEIGHT = 1100;
const PAPER_MARGIN = 50;
const CONTENT_WIDTH = PAPER_WIDTH - (PAPER_MARGIN * 2); // 900px

// Measure width calculation (matching StaffNotes/Tablature)
const totalMeasureWidth = CONTENT_WIDTH - 20;  // 880px
const firstMeasureWidth = totalMeasureWidth / 4 + 40;  // ~260px (wider for clef/time)
const otherMeasureWidth = (totalMeasureWidth - firstMeasureWidth) / 3;  // ~206.67px
```

### Why First Measure is Wider

The StaffNotes component (VexFlow) reserves extra space in the first measure for:
- Treble clef
- Time signature (4/4)

To align all elements, chord boxes and tablature must use the **same width calculation**.

### Key Alignment Points

| Element | Starting Offset | First Measure | Other Measures |
|---------|-----------------|---------------|----------------|
| StaffNotes | 10px | ~260px | ~207px |
| Tablature | 10px | ~260px | ~207px |
| Chord Boxes | 10px (marginLeft) | ~260px | ~207px |

### Component Files

- **Chord boxes**: `src/screens/EditorScreen.tsx` (barRow with marginLeft: 10, variable barWidth)
- **Tablature**: `src/components/Tablature.tsx` (uses same width calc, renders bar lines)
- **Staff**: `src/components/StaffNotes.tsx` (VexFlow with clef/time signature)

### Tablature Bar Lines

The Tablature component renders vertical bar lines at measure boundaries using `getBarLinePositions()`:

```typescript
const getBarLinePositions = (): number[] => {
  const positions: number[] = [];
  let currentX = 10;
  for (let m = 0; m <= numMeasures; m++) {
    positions.push(currentX);
    if (m === 0) currentX += firstMeasureWidth;
    else if (m < numMeasures) currentX += otherMeasureWidth;
  }
  return positions;
};
```

### Beat Positioning Within Measures

Each measure has 4 beats. Beat positions are calculated based on measure width:

```typescript
const getBeatXPosition = (beatIndex: number): number => {
  const measureIndex = Math.floor(beatIndex / 4);
  const beatWithinMeasure = beatIndex % 4;
  // ... calculate based on measure widths
  return measureStart + (beatWidth * beatWithinMeasure) + (beatWidth / 2);
};
```

### StaffNotes Component Props

The StaffNotes component (`src/components/StaffNotes.tsx`) accepts:

```typescript
interface StaffNotesProps {
  beatChords: string[];    // Array of chord names (numMeasures * 4 beats)
  width: number;           // Container width in pixels
  height: number;          // Container height in pixels
  numMeasures?: number;    // Number of measures (default: 1)
  scale?: number;          // VexFlow scale factor (default: 0.75)
}
```

**Scale prop**: Controls the size of notes, clef, and staff lines. Default is 0.75 (75%). Use smaller values (0.6-0.7) for more compact rendering, larger values (0.8-1.0) for bigger notation.

### Chord Boxes Layout

Chord boxes use calculated widths based on measure widths (not hardcoded):

```typescript
// In EditorScreen.tsx - each beat's width is derived from bar width
const beatWidth = barWidth / 4;

// Applied to the beat chord box element
style={{ width: beatWidth }}
```

The beat chord box has no borders - just height, background, and centering.

## Common Development Tasks

### Adding a new section type
1. Update `SectionType` enum in `src/models/Composition.ts`
2. Add handling in `compositionStore.ts` actions
3. Update UI in `src/screens/EditorScreen.tsx`

### Adding a new storage provider
1. Create provider in `src/services/fileStorage/`
2. Implement `StorageProvider` interface
3. Register in `compositionService.ts`

### Modifying chord display
1. Chord data from `src/data/chords.json`
2. SVG generation in `printService/chordSvgGenerator.ts`
3. UI rendering in editor components

### Modifying note rendering on staff
1. Note derivation logic in `src/services/printService/noteRenderer.ts`
2. Editor component in `src/components/StaffNotes.tsx`
3. Print integration in `src/services/printService/htmlTemplates.ts`
4. See `/note-rendering` skill for detailed documentation

## Reference Files

| Purpose | File |
|---------|------|
| Main data model | `src/models/Composition.ts` |
| Global state | `src/store/compositionStore.ts` |
| File I/O | `src/services/compositionService.ts` |
| Editor UI | `src/screens/EditorScreen.tsx` |
| Chord database | `src/data/chords.json` |
| Print service | `src/services/printService/index.ts` |
| Note rendering | `src/services/printService/noteRenderer.ts` |
| Staff notes component | `src/components/StaffNotes.tsx` |
| Storage interface | `src/services/fileStorage/types.ts` |
