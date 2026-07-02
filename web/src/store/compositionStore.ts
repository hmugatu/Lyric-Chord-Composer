/**
 * Zustand store for composition state management
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { Composition, Section, GlobalSettings } from '../models';
import { STANDARD_TUNING } from '../models/Note';
import { CompositionStorageService } from '../services/compositionService';
import { CompositionCache } from '../services/cache';

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
  tuning: STANDARD_TUNING,
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
const cacheService = new CompositionCache();

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

        // Save to cache
        await get().saveToCache();
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

        set((state) => {
          results.forEach((result) => {
            const composition = result.composition;
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

        // Save to cache
        await get().saveToCache();
      } catch (error) {
        set((state) => {
          state.isLoading = false;
          state.error = error instanceof Error ? error.message : 'Import failed';
        });
        throw error;
      }
    },

    // Cache operations
    loadFromCache: async () => {
      try {
        set((state) => {
          state.isLoading = true;
          state.error = null;
        });

        const compositions = await cacheService.loadFromCache();

        set((state) => {
          state.compositions = compositions;
          state.isLoading = false;
          state.lastCacheUpdate = new Date();
        });
      } catch (error) {
        set((state) => {
          state.isLoading = false;
          state.error =
            error instanceof Error ? error.message : 'Failed to load cache';
        });
      }
    },

    saveToCache: async () => {
      try {
        await cacheService.saveToCache(get().compositions);

        set((state) => {
          state.lastCacheUpdate = new Date();
        });
      } catch (error) {
        console.error('Failed to save to cache:', error);
      }
    },

    clearCache: async () => {
      try {
        await cacheService.clearCache();

        set((state) => {
          state.lastCacheUpdate = null;
        });
      } catch (error) {
        set((state) => {
          state.error =
            error instanceof Error ? error.message : 'Failed to clear cache';
        });
        throw error;
      }
    },

    initializeStore: async () => {
      // Load compositions from cache on app startup
      await get().loadFromCache();
    },
  }))
);
