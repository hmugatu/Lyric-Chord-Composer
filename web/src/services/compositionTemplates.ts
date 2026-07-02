/**
 * Default Composition Template Factory
 * Creates default templates for new compositions
 */

import type { Composition, Section, GlobalSettings } from '../models/Composition';
import type { NotationMeasure } from '../models/Notation';
import type { TimeSignature } from '../models/Note';

const DEFAULT_BARS_PER_PAGE = 16;
const DEFAULT_TIME_SIGNATURE: TimeSignature = { beats: 4, beatValue: 4 };
const DEFAULT_TUNING = 'standard';
const DEFAULT_KEY = 'C';
const DEFAULT_TEMPO = 120;

// Simple UUID generation
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a default/blank composition with musical staff
 * Shows 16 bars per page on white background
 */
export function createDefaultComposition(
  title: string = 'Untitled Composition',
  artist?: string
): Composition {
  const compositionId = generateId();
  const now = new Date();

  const globalSettings: GlobalSettings = {
    key: DEFAULT_KEY,
    tempo: DEFAULT_TEMPO,
    timeSignature: DEFAULT_TIME_SIGNATURE,
    tuning: DEFAULT_TUNING as any,
  };

  // Create default verse section with musical staff (16 bars)
  const notationMeasures = createBlankNotationMeasures(DEFAULT_BARS_PER_PAGE, globalSettings);

  const verseSection: Section = {
    id: generateId(),
    type: 'verse',
    label: 'Verse',
    notation: notationMeasures,
    order: 1,
  };

  const composition: Composition = {
    id: compositionId,
    title,
    artist,
    createdAt: now,
    updatedAt: now,
    sections: [verseSection],
    globalSettings,
    difficulty: 'beginner',
    notes: 'New composition created from template',
  };

  return composition;
}

/**
 * Create a blank notation measure (empty staff bar)
 */
function createBlankNotationMeasures(
  count: number,
  globalSettings: GlobalSettings
): NotationMeasure[] {
  const measures: NotationMeasure[] = [];

  for (let i = 0; i < count; i++) {
    measures.push({
      id: generateId(),
      notes: [], // Empty measure - will be filled in by user
      clef: 'treble',
      keySignature: globalSettings.key as any,
      timeSignature: globalSettings.timeSignature,
    });
  }

  return measures;
}

/**
 * Create a multi-page composition template
 * Each page has 16 bars
 */
export function createMultiPageComposition(
  title: string,
  numPages: number = 1,
  artist?: string
): Composition {
  const compositionId = generateId();
  const now = new Date();

  const globalSettings: GlobalSettings = {
    key: DEFAULT_KEY,
    tempo: DEFAULT_TEMPO,
    timeSignature: DEFAULT_TIME_SIGNATURE,
    tuning: DEFAULT_TUNING as any,
  };

  const sections: Section[] = [];
  const sectionTypes: Array<'verse' | 'chorus' | 'bridge' | 'intro' | 'outro'> = [
    'verse',
    'chorus',
    'verse',
    'chorus',
  ];

  for (let page = 0; page < numPages; page++) {
    const sectionType = sectionTypes[page % sectionTypes.length];
    const notationMeasures = createBlankNotationMeasures(DEFAULT_BARS_PER_PAGE, globalSettings);

    sections.push({
      id: generateId(),
      type: sectionType,
      label: `${sectionType.charAt(0).toUpperCase() + sectionType.slice(1)} ${Math.floor(page / 2) + 1}`,
      notation: notationMeasures,
      order: page + 1,
    });
  }

  return {
    id: compositionId,
    title,
    artist,
    createdAt: now,
    updatedAt: now,
    sections,
    globalSettings,
    difficulty: 'beginner',
    notes: `Multi-page composition with ${numPages} page(s)`,
  };
}

/**
 * Create a composition with predefined structure
 * Intro -> Verse -> Chorus -> Verse -> Chorus -> Bridge -> Chorus -> Outro
 */
export function createStructuredComposition(
  title: string,
  artist?: string
): Composition {
  const compositionId = generateId();
  const now = new Date();

  const globalSettings: GlobalSettings = {
    key: DEFAULT_KEY,
    tempo: DEFAULT_TEMPO,
    timeSignature: DEFAULT_TIME_SIGNATURE,
    tuning: DEFAULT_TUNING as any,
  };

  const structureMap: Array<{ type: Section['type']; bars: number; label: string }> = [
    { type: 'intro', bars: 8, label: 'Intro' },
    { type: 'verse', bars: 16, label: 'Verse 1' },
    { type: 'chorus', bars: 16, label: 'Chorus' },
    { type: 'verse', bars: 16, label: 'Verse 2' },
    { type: 'chorus', bars: 16, label: 'Chorus' },
    { type: 'bridge', bars: 8, label: 'Bridge' },
    { type: 'chorus', bars: 16, label: 'Chorus' },
    { type: 'outro', bars: 8, label: 'Outro' },
  ];

  const sections: Section[] = structureMap.map((item, index) => {
    const notationMeasures = createBlankNotationMeasures(item.bars, globalSettings);
    return {
      id: generateId(),
      type: item.type,
      label: item.label,
      notation: notationMeasures,
      order: index + 1,
    };
  });

  return {
    id: compositionId,
    title,
    artist,
    createdAt: now,
    updatedAt: now,
    sections,
    globalSettings,
    difficulty: 'intermediate',
    notes: 'Structured composition with typical song layout',
  };
}

/**
 * Get template options for user to choose from
 */
export const COMPOSITION_TEMPLATES = [
  {
    id: 'blank',
    name: 'Blank (16 bars)',
    description: 'Single page with 16 blank musical bars',
    icon: 'music',
    create: (title: string, artist?: string) => createDefaultComposition(title, artist),
  },
  {
    id: 'multipage',
    name: 'Multi-page',
    description: 'Multiple pages (32 bars)',
    icon: 'file-multiple',
    create: (title: string, artist?: string) => createMultiPageComposition(title, 2, artist),
  },
  {
    id: 'structured',
    name: 'Structured Song',
    description: 'Intro, Verse, Chorus, Bridge layout',
    icon: 'format-list-numbered',
    create: (title: string, artist?: string) => createStructuredComposition(title, artist),
  },
];

/**
 * UI Constants for rendering musical staff
 */
export const UI_CONSTANTS = {
  // Layout
  BARS_PER_PAGE: DEFAULT_BARS_PER_PAGE,
  BARS_PER_LINE: 4, // 4 bars per line of staff
  STAFF_LINES: 5, // Standard 5-line musical staff
  LINE_SPACING: 8, // Pixels between staff lines
  
  // Page dimensions
  PAGE_PADDING: 16,
  PAGE_WIDTH: 800,
  PAGE_HEIGHT: 1000, // 11 inches at 100 DPI
  
  // Colors & styles
  PAPER_COLOR: '#FFFFFF', // White background like sheet music
  STAFF_LINE_COLOR: '#000000',
  STAFF_LINE_WIDTH: 1,
  BAR_LINE_COLOR: '#000000',
  BAR_LINE_WIDTH: 2,
  MEASURE_NUMBER_COLOR: '#666666',
  
  // Default settings
  DEFAULT_KEY,
  DEFAULT_TEMPO,
  DEFAULT_TIME_SIGNATURE,
  DEFAULT_TUNING,
};
