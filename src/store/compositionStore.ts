/**
 * Zustand store for composition state management
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { Composition, Section, GlobalSettings } from '../models';
import { STANDARD_TUNING } from '../models/Note';
import { CompositionStorageService } from '../services/compositionService';
import * as compositionsRepo from '../services/compositionsRepo';

// One-time migration of pre-Supabase localStorage compositions into the user's
// cloud account. Runs at most once per browser (guarded by MIGRATED_KEY).
const LEGACY_CACHE_KEY = '@lyric-chord-composer:compositions';
const LEGACY_METADATA_KEY = '@lyric-chord-composer:cache-metadata';
const MIGRATED_KEY = '@lyric-chord-composer:migrated';

async function migrateLegacyLocalCompositions(): Promise<void> {
  if (localStorage.getItem(MIGRATED_KEY)) return;
  try {
    const raw = localStorage.getItem(LEGACY_CACHE_KEY);
    if (raw) {
      const legacy = JSON.parse(raw) as Composition[];
      if (Array.isArray(legacy) && legacy.length > 0) {
        await compositionsRepo.bulkUpsert(legacy);
      }
    }
    // Clear legacy data and mark migrated so this never runs again.
    localStorage.removeItem(LEGACY_CACHE_KEY);
    localStorage.removeItem(LEGACY_METADATA_KEY);
    localStorage.setItem(MIGRATED_KEY, new Date().toISOString());
  } catch (error) {
    console.error('Legacy composition migration failed:', error);
  }
}

interface CompositionState {
  // Current composition
  currentComposition: Composition | null;
  compositions: Composition[];

  // Storage state
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  lastCacheUpdate: Date | null;

  // Actions
  createComposition: (title: string, artist?: string) => void;
  loadComposition: (id: string) => void;
  addComposition: (composition: Composition) => void;
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
  exportAllCompositions: () => Promise<void>;
  importComposition: () => Promise<void>;
  importCompositions: () => Promise<void>;

  // Cache operations
  loadFromCache: () => Promise<void>;
  saveToCache: () => Promise<void>;
  clearCache: () => Promise<void>;
  initializeStore: () => Promise<void>;
}

const createDefaultGlobalSettings = (): GlobalSettings => ({
  key: 'C',
  tempo: 120,
  timeSignature: { beats: 4, beatValue: 4 },
  capo: 0,
  tuning: STANDARD_TUNING,
  chordsPerBar: 1,
});

const createNewComposition = (title: string, artist?: string): Composition => ({
  id: `composition-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  title,
  artist,
  createdAt: new Date(),
  updatedAt: new Date(),
  sections: [
    {
      id: `section-${Date.now()}-intro`,
      type: 'intro',
      label: 'Intro',
      order: 0,
      chordProgression: { id: `chord-${Date.now()}-intro`, measures: 4, chords: [] },
    },
    {
      id: `section-${Date.now()}-verse1`,
      type: 'verse',
      label: 'Verse 1',
      order: 1,
      lyrics: { id: `lyrics-${Date.now()}-verse1`, type: 'verse', lines: [] },
      chordProgression: { id: `chord-${Date.now()}-verse1`, measures: 4, chords: [] },
    },
    {
      id: `section-${Date.now()}-chorus`,
      type: 'chorus',
      label: 'Chorus',
      order: 2,
      lyrics: { id: `lyrics-${Date.now()}-chorus`, type: 'chorus', lines: [] },
      chordProgression: { id: `chord-${Date.now()}-chorus`, measures: 4, chords: [] },
    },
  ],
  globalSettings: createDefaultGlobalSettings(),
  tags: [],
  difficulty: 'beginner',
});

// Initialize services
const storageService = new CompositionStorageService();

export const useCompositionStore = create<CompositionState>()(
  immer((set, get) => ({
    currentComposition: null,
    compositions: [],
    isLoading: false,
    isSaving: false,
    error: null,
    lastCacheUpdate: null,

    createComposition: (title: string, artist?: string) => {
      set((state) => {
        const newComposition = createNewComposition(title, artist);
        state.compositions.push(newComposition);
        state.currentComposition = newComposition;
      });
    },

    addComposition: (composition: Composition) => {
      set((state) => {
        const existingIndex = state.compositions.findIndex(
          (c) => c.id === composition.id
        );
        if (existingIndex >= 0) {
          state.compositions[existingIndex] = composition;
        } else {
          state.compositions.push(composition);
        }
      });
    },

    setCurrentComposition: (id: string) => {
      set((state) => {
        const composition = state.compositions.find((c) => c.id === id);
        if (composition) {
          state.currentComposition = composition;
        }
      });
    },

    loadComposition: (id: string) => {
      set((state) => {
        const composition = state.compositions.find((c) => c.id === id);
        if (composition) {
          state.currentComposition = composition;
        }
      });
    },

    updateComposition: (updates: Partial<Composition>) => {
      set((state) => {
        if (state.currentComposition) {
          Object.assign(state.currentComposition, {
            ...updates,
            updatedAt: new Date(),
          });

          // Update in compositions array
          const index = state.compositions.findIndex(
            (c) => c.id === state.currentComposition?.id
          );
          if (index !== -1) {
            state.compositions[index] = state.currentComposition;
          }
        }
      });
    },

    deleteComposition: (id: string) => {
      set((state) => {
        state.compositions = state.compositions.filter((c) => c.id !== id);
        if (state.currentComposition?.id === id) {
          state.currentComposition = null;
        }
      });
      // Remove from the cloud (fire-and-forget; UI already updated).
      compositionsRepo.deleteComposition(id).catch((error) => {
        console.error('Failed to delete composition from cloud:', error);
      });
    },

    addSection: (section: Omit<Section, 'id' | 'order'>) => {
      set((state) => {
        if (state.currentComposition) {
          const newSection: Section = {
            ...section,
            id: `section-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            order: state.currentComposition.sections.length,
          };
          state.currentComposition.sections.push(newSection);
          state.currentComposition.updatedAt = new Date();
        }
      });
    },

    updateSection: (sectionId: string, updates: Partial<Section>) => {
      set((state) => {
        if (state.currentComposition) {
          const section = state.currentComposition.sections.find(
            (s) => s.id === sectionId
          );
          if (section) {
            Object.assign(section, updates);
            state.currentComposition.updatedAt = new Date();
          }
        }
      });
    },

    deleteSection: (sectionId: string) => {
      set((state) => {
        if (state.currentComposition) {
          state.currentComposition.sections = state.currentComposition.sections
            .filter((s) => s.id !== sectionId)
            .map((s, index) => ({ ...s, order: index }));
          state.currentComposition.updatedAt = new Date();
        }
      });
    },

    reorderSections: (sectionIds: string[]) => {
      set((state) => {
        if (state.currentComposition) {
          const reordered = sectionIds
            .map((id) =>
              state.currentComposition!.sections.find((s) => s.id === id)
            )
            .filter((s): s is Section => s !== undefined)
            .map((s, index) => ({ ...s, order: index }));

          state.currentComposition.sections = reordered;
          state.currentComposition.updatedAt = new Date();
        }
      });
    },

    updateGlobalSettings: (settings: Partial<GlobalSettings>) => {
      set((state) => {
        if (state.currentComposition) {
          Object.assign(state.currentComposition.globalSettings, settings);
          state.currentComposition.updatedAt = new Date();
        }
      });
    },

    // File operations
    exportComposition: async (id: string) => {
      try {
        set((state) => {
          state.isSaving = true;
          state.error = null;
        });

        const composition = get().compositions.find((c) => c.id === id);
        if (!composition) {
          throw new Error('Composition not found');
        }

        await storageService.exportComposition(composition);

        set((state) => {
          state.isSaving = false;
        });
      } catch (error) {
        set((state) => {
          state.isSaving = false;
          state.error = error instanceof Error ? error.message : 'Export failed';
        });
        throw error;
      }
    },

    exportAllCompositions: async () => {
      try {
        set((state) => {
          state.isSaving = true;
          state.error = null;
        });

        await storageService.exportCompositions(get().compositions);

        set((state) => {
          state.isSaving = false;
        });
      } catch (error) {
        set((state) => {
          state.isSaving = false;
          state.error = error instanceof Error ? error.message : 'Export failed';
        });
        throw error;
      }
    },

    importComposition: async () => {
      try {
        set((state) => {
          state.isLoading = true;
          state.error = null;
        });

        const result = await storageService.importComposition();
        const composition = result.composition;

        set((state) => {
          // Check if composition already exists
          const existingIndex = state.compositions.findIndex(
            (c) => c.id === composition.id
          );

          if (existingIndex >= 0) {
            // Replace existing composition
            state.compositions[existingIndex] = composition;
          } else {
            // Add new composition
            state.compositions.push(composition);
          }

          state.isLoading = false;
        });

        // Persist the imported composition to the cloud.
        await compositionsRepo.upsertComposition(composition);
      } catch (error) {
        set((state) => {
          state.isLoading = false;
          state.error = error instanceof Error ? error.message : 'Import failed';
        });
        throw error;
      }
    },

    importCompositions: async () => {
      try {
        set((state) => {
          state.isLoading = true;
          state.error = null;
        });

        const results = await storageService.importCompositions();
        const imported = results.map((r) => r.composition);

        set((state) => {
          imported.forEach((composition) => {
            const existingIndex = state.compositions.findIndex(
              (c) => c.id === composition.id
            );

            if (existingIndex >= 0) {
              state.compositions[existingIndex] = composition;
            } else {
              state.compositions.push(composition);
            }
          });

          state.isLoading = false;
        });

        // Persist all imported compositions to the cloud.
        await compositionsRepo.bulkUpsert(imported);
      } catch (error) {
        set((state) => {
          state.isLoading = false;
          state.error = error instanceof Error ? error.message : 'Import failed';
        });
        throw error;
      }
    },

    // Persistence operations (Supabase-backed).
    // The `*Cache` names are kept so existing call sites don't need to change.
    loadFromCache: async () => {
      try {
        set((state) => {
          state.isLoading = true;
          state.error = null;
        });

        const compositions = await compositionsRepo.listCompositions();

        set((state) => {
          state.compositions = compositions;
          state.isLoading = false;
          state.lastCacheUpdate = new Date();
        });
      } catch (error) {
        set((state) => {
          state.isLoading = false;
          state.error =
            error instanceof Error ? error.message : 'Failed to load compositions';
        });
      }
    },

    // Persist the current composition to the cloud. Called after every edit;
    // per-composition upsert replaces the old "save the whole array" model.
    saveToCache: async () => {
      const current = get().currentComposition;
      if (!current) return;
      try {
        await compositionsRepo.upsertComposition(current);
        set((state) => {
          state.lastCacheUpdate = new Date();
        });
      } catch (error) {
        console.error('Failed to save composition to cloud:', error);
      }
    },

    clearCache: async () => {
      // Nothing to clear client-side; cloud data is authoritative. Kept for API
      // compatibility with existing callers.
      set((state) => {
        state.lastCacheUpdate = null;
      });
    },

    initializeStore: async () => {
      // One-time import of any pre-Supabase localStorage compositions, then load
      // the user's compositions from the cloud. Requires an active session.
      await migrateLegacyLocalCompositions();
      await get().loadFromCache();
    },
  }))
);
