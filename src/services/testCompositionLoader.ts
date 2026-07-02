/**
 * Test utility for loading sample compositions for print testing
 * This can be removed after testing is complete
 */

import * as FileSystem from 'expo-file-system';
import { Composition } from '../models/Composition';

export const testCompositions = {
  'my-new-song': {
    id: 'composition-1768423149921-a9svculr1',
    title: 'My New Song',
    createdAt: '2026-01-14T20:39:09.921Z',
    updatedAt: '2026-01-14T20:40:01.165Z',
    sections: [
      {
        id: 'section-1768423149921-intro',
        type: 'intro' as const,
        label: 'Intro',
        order: 0,
        chordProgression: { chords: [] }
      },
      {
        id: 'section-1768423149921-verse1',
        type: 'verse' as const,
        label: 'Verse 1',
        order: 1,
        lyrics: { lines: [] },
        chordProgression: { chords: [] }
      },
      {
        id: 'section-1768423149921-chorus',
        type: 'chorus' as const,
        label: 'Chorus',
        order: 2,
        lyrics: { lines: [] },
        chordProgression: { chords: [] }
      }
    ],
    globalSettings: {
      key: 'C',
      tempo: 120,
      timeSignature: { beats: 4, beatValue: 4 },
      tuning: {
        name: 'Standard',
        notes: ['E2', 'A2', 'D3', 'G3', 'B3', 'E4']
      }
    },
    tags: [],
    difficulty: 'beginner' as const,
    notes: JSON.stringify({
      pages: [{
        barLyrics: ['Here are my lyrics ', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
        barBeatChords: [
          ['A7sus4', '', '', ''],
          ['', '', '', ''],
          ['', '', '', ''],
          ['', '', '', ''],
          ['', '', '', ''],
          ['', '', '', ''],
          ['', '', '', ''],
          ['', '', '', ''],
          ['', '', '', ''],
          ['', '', '', ''],
          ['', '', '', ''],
          ['', '', '', ''],
          ['', '', '', ''],
          ['', '', '', ''],
          ['', '', '', ''],
          ['', '', '', '']
        ]
      }]
    })
  }
};

export function getTestComposition(name: string): Composition | null {
  const comp = testCompositions[name as keyof typeof testCompositions];
  if (!comp) return null;
  
  return {
    ...comp,
    // Ensure notes is properly parsed if needed
  } as Composition;
}

export function getTestCompositionList(): string[] {
  return Object.keys(testCompositions);
}
