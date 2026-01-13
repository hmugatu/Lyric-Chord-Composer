/**
 * Zustand store for composition state management
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { Composition, Section, GlobalSettings } from '../models';
import { STANDARD_TUNING } from '../models/Note';

interface CompositionState {
  // Current composition
  currentComposition: Composition | null;
  compositions: Composition[];

  // Actions
  createComposition: (title: string, artist?: string) => void;
  loadComposition: (id: string) => void;
  updateComposition: (updates: Partial<Composition>) => void;
  deleteComposition: (id: string) => void;

  // Section management
  addSection: (section: Omit<Section, 'id' | 'order'>) => void;
  updateSection: (sectionId: string, updates: Partial<Section>) => void;
  deleteSection: (sectionId: string) => void;
  reorderSections: (sectionIds: string[]) => void;

  // Global settings
  updateGlobalSettings: (settings: Partial<GlobalSettings>) => void;
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
  sections: [],
  globalSettings: createDefaultGlobalSettings(),
  tags: [],
});

export const useCompositionStore = create<CompositionState>()(
  immer((set) => ({
    currentComposition: null,
    compositions: [],

    createComposition: (title: string, artist?: string) => {
      set((state) => {
        const newComposition = createNewComposition(title, artist);
        state.compositions.push(newComposition);
        state.currentComposition = newComposition;
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
  }))
);
