import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Button, IconButton, Tooltip, Typography, TextField, Dialog, DialogTitle,
  DialogContent, DialogContentText, DialogActions, InputAdornment, Snackbar,
  ToggleButton, ToggleButtonGroup, MenuItem, Popover,
} from '@mui/material';
import PrintIcon from '@mui/icons-material/Print';
import SettingsIcon from '@mui/icons-material/Settings';
import SaveIcon from '@mui/icons-material/Save';
import SearchIcon from '@mui/icons-material/Search';
import NoteAddIcon from '@mui/icons-material/NoteAdd';
import { useCompositionStore } from '../store/compositionStore';
import { ALTERNATE_TUNINGS } from '../models/Note';
import type { NoteDuration } from '../models/Note';
import type { TabCell, TabTechnique } from '../models/Tablature';
import { CompositionStorageService } from '../services/compositionService';
import { PrintService, PrintOptions } from '../services/printService';
import { PrintDialog } from '../components/PrintDialog';
import { StaffNotes } from '../components/StaffNotes';
import { Tablature } from '../components/Tablature';
import { ChordDiagram, MiniChordDiagram, ChordData } from '../components/ChordDiagram';
import { shortChordName } from '../utils/chordName';
import { CLEF_RESERVE, getMeasureLayout, getSubdivisionX } from '../utils/rowGeometry';
import chordsDataJson from '../data/chords.json';

interface PageState {
  barLyrics: string[];
  barBeatChords: string[][];
  barTab?: Record<string, TabCell>;
}

const emptyPage = (slots = 4): PageState => ({
  barLyrics: Array(16).fill(''),
  barBeatChords: Array(16).fill(null).map(() => Array(slots).fill('')),
  barTab: {},
});

// Fixed paper dimensions: 1000px = 8.5", 1100px = 11" (100px per inch)
// The editor sheet mirrors a printed US Letter page (8.5in x 11in) so what you
// see on screen maps to what prints. Width is arbitrary px; height and margin
// are derived from the real paper ratio at that width.
const PAPER_WIDTH = 1000;
const PAPER_HEIGHT = Math.round((PAPER_WIDTH * 11) / 8.5); // ~1294, Letter ratio
const PAPER_MARGIN = Math.round((PAPER_WIDTH * 0.5) / 8.5); // 0.5in print margin -> ~59px
const CONTENT_WIDTH = PAPER_WIDTH - PAPER_MARGIN * 2;

// Aged parchment tone for the sheet-music paper (and the notation backgrounds
// that must blend into it), for a warm "old manuscript" look in any theme.
const PAPER_COLOR = '#f4ecd8';

// Common keys for the Key dropdown (majors then relative minors).
const KEY_OPTIONS = [
  'C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#',
  'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb',
  'Am', 'Em', 'Bm', 'F#m', 'C#m', 'G#m', 'D#m', 'A#m',
  'Dm', 'Gm', 'Cm', 'Fm', 'Bbm', 'Ebm', 'Abm',
];

// Common time-signature values.
const BEATS_OPTIONS = [2, 3, 4, 5, 6, 7, 9, 12];
const BEAT_VALUE_OPTIONS = [2, 4, 8, 16];

// Techniques offered in the tab-cell popover (full words — we have space).
const TECHNIQUE_OPTIONS: { value: TabTechnique; label: string }[] = [
  { value: 'hammer-on', label: 'Hammer-on' },
  { value: 'pull-off', label: 'Pull-off' },
  { value: 'slide', label: 'Slide' },
  { value: 'bend', label: 'Bend' },
  { value: 'vibrato', label: 'Vibrato' },
  { value: 'palm-mute', label: 'Palm mute' },
  { value: 'harmonic', label: 'Harmonic' },
];

// Fret options for the picker: default 'x' (muted), then 0-28.
const FRET_OPTIONS: string[] = ['x', ...Array.from({ length: 29 }, (_, i) => String(i))];

// Note values a tab cell can be drawn as on the staff.
const DURATION_OPTIONS: { value: NoteDuration; label: string }[] = [
  { value: 'whole', label: 'Whole' },
  { value: 'half', label: 'Half' },
  { value: 'quarter', label: 'Quarter' },
  { value: 'eighth', label: 'Eighth' },
  { value: 'sixteenth', label: 'Sixteenth' },
];

// Shared per-row measure geometry (also used by Tablature/StaffNotes/print)
// so the chord slots, tab fret numbers, and staff notes all line up vertically.
const rowLayout = getMeasureLayout(CONTENT_WIDTH, 4);

export const EditorScreen: React.FC = () => {
  const navigate = useNavigate();

  const currentComposition = useCompositionStore((s) => s.currentComposition);
  const updateGlobalSettings = useCompositionStore((s) => s.updateGlobalSettings);
  const updateComposition = useCompositionStore((s) => s.updateComposition);
  const createComposition = useCompositionStore((s) => s.createComposition);
  const compositions = useCompositionStore((s) => s.compositions);
  const saveToCache = useCompositionStore((s) => s.saveToCache);

  const storageService = React.useMemo(() => new CompositionStorageService(), []);
  const printService = React.useMemo(() => new PrintService(), []);
  const chordsData = React.useMemo(() => chordsDataJson as ChordData[], []);
  const availableChords = React.useMemo(() => chordsData.map((c) => c.name), [chordsData]);

  const [showSettingsDialog, setShowSettingsDialog] = React.useState(false);
  const [showPrintDialog, setShowPrintDialog] = React.useState(false);
  const [showChordModal, setShowChordModal] = React.useState(false);
  const [showNewDialog, setShowNewDialog] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isPrinting, setIsPrinting] = React.useState(false);
  const [snackbar, setSnackbar] = React.useState({ open: false, message: '' });

  const [tempo, setTempo] = React.useState('');
  const [key, setKey] = React.useState('');
  const [capo, setCapo] = React.useState('');
  const [beats, setBeats] = React.useState('');
  const [beatValue, setBeatValue] = React.useState('');
  const [tuningName, setTuningName] = React.useState('');
  // 6 string notes low->high, as a comma/space list for the custom override.
  const [tuningNotes, setTuningNotes] = React.useState('');
  // Chords-per-bar is edited as a pending value in Settings and only committed
  // (re-slicing bars) on Save, so Cancel restores the previous value.
  const [pendingChordsPerBar, setPendingChordsPerBar] = React.useState(4);

  const [currentPage, setCurrentPage] = React.useState(0);
  const [allPages, setAllPages] = React.useState<PageState[]>([emptyPage()]);

  const [selectedBarIndex, setSelectedBarIndex] = React.useState<number | null>(null);
  const [selectedBeatIndex, setSelectedBeatIndex] = React.useState<number | null>(null);
  const [chordSearchText, setChordSearchText] = React.useState('');
  const [selectedChordData, setSelectedChordData] = React.useState<ChordData | null>(null);

  // Tab-cell editing popover state.
  const [tabPopover, setTabPopover] = React.useState<{
    bar: number; cell: number; string: number; anchor: DOMRect; fret: string;
    techniques: TabTechnique[]; duration: NoteDuration;
  } | null>(null);

  const chordsPerBar = currentComposition?.globalSettings.chordsPerBar || 4;
  const tsBeats = currentComposition?.globalSettings.timeSignature.beats || 4;
  const tsBeatValue = currentComposition?.globalSettings.timeSignature.beatValue || 4;

  const barLyrics = allPages[currentPage]?.barLyrics || Array(16).fill('');
  const barBeatChords = allPages[currentPage]?.barBeatChords || Array(16).fill(null).map(() => Array(chordsPerBar).fill(''));
  const barTab = allPages[currentPage]?.barTab || {};

  // Persist the given pages array into the composition notes blob.
  const persistPages = (pages: PageState[]) => {
    if (currentComposition) {
      updateComposition({ notes: JSON.stringify({ pages }) });
      saveToCache();
    }
  };

  const setBarLyrics = (newLyrics: string[]) => {
    const newPages = [...allPages];
    newPages[currentPage] = { ...newPages[currentPage], barLyrics: newLyrics };
    setAllPages(newPages);
    persistPages(newPages);
  };

  const cellKey = (bar: number, cell: number, string: number) => `${bar}:${cell}:${string}`;

  // Open the fret/technique popover for a clicked tab cell, seeded with any
  // existing value at that string:cell.
  const openTabCell = (bar: number, cell: number, string: number, anchor: DOMRect) => {
    const existing = barTab[cellKey(bar, cell, string)];
    setTabPopover({
      bar, cell, string, anchor,
      // Default new cells to 'x' (muted), matching the picker's default.
      fret: existing ? String(existing.fret) : 'x',
      techniques: existing?.techniques || [],
      duration: existing?.duration || 'quarter',
    });
  };

  // Re-seed the popover when the string is retargeted, from whatever exists there.
  const retargetTabPopover = (bar: number, cell: number, string: number) => {
    if (!tabPopover) return;
    const existing = barTab[cellKey(bar, cell, string)];
    setTabPopover({
      ...tabPopover, bar, cell, string,
      fret: existing ? String(existing.fret) : 'x',
      techniques: existing?.techniques || [],
      duration: existing?.duration || tabPopover.duration || 'quarter',
    });
  };

  // Commit / clear a single tab cell, persisting into the current page's barTab.
  const setTabCell = (bar: number, cell: number, string: number, value: TabCell | null) => {
    const key = cellKey(bar, cell, string);
    const nextTab = { ...(allPages[currentPage]?.barTab || {}) };
    if (value === null) {
      delete nextTab[key];
    } else {
      nextTab[key] = value;
    }
    const newPages = [...allPages];
    newPages[currentPage] = { ...newPages[currentPage], barTab: nextTab };
    setAllPages(newPages);
    persistPages(newPages);
  };

  // Commit the popover: parse the fret ('x' or 0-24); empty clears the cell.
  const applyTabPopover = () => {
    if (!tabPopover) return;
    const raw = tabPopover.fret.trim().toLowerCase();
    if (raw === '') {
      setTabCell(tabPopover.bar, tabPopover.cell, tabPopover.string, null);
    } else {
      const fret: number | 'x' = raw === 'x' ? 'x' : Math.max(0, Math.min(28, parseInt(raw) || 0));
      const cell: TabCell = { fret, duration: tabPopover.duration };
      if (tabPopover.techniques.length > 0) cell.techniques = tabPopover.techniques;
      setTabCell(tabPopover.bar, tabPopover.cell, tabPopover.string, cell);
    }
    setTabPopover(null);
  };

  const clearTabPopover = () => {
    if (!tabPopover) return;
    setTabCell(tabPopover.bar, tabPopover.cell, tabPopover.string, null);
    setTabPopover(null);
  };

  const setBarBeatChords = (newChords: string[][]) => {
    const newPages = [...allPages];
    newPages[currentPage] = { ...newPages[currentPage], barBeatChords: newChords };
    setAllPages(newPages);
    persistPages(newPages);
  };

  // Re-slice a bar's chord slots to a new count, keeping existing chords at
  // their proportional positions (e.g. 4->8 keeps chords on the down-beats).
  const resliceBar = (bar: string[], from: number, to: number): string[] => {
    const out = Array(to).fill('');
    for (let i = 0; i < bar.length && i < from; i++) {
      if (bar[i] && bar[i].trim() !== '') {
        const newIndex = Math.round((i / from) * to);
        if (newIndex < to) out[newIndex] = bar[i];
      }
    }
    return out;
  };

  const handleChordsPerBarChange = (next: number) => {
    if (!currentComposition || next === chordsPerBar) return;
    const remapped: PageState[] = allPages.map((page) => ({
      barLyrics: page.barLyrics,
      barBeatChords: page.barBeatChords.map((bar) => resliceBar(bar, chordsPerBar, next)),
    }));
    setAllPages(remapped);
    updateGlobalSettings({ chordsPerBar: next });
    // Persist both the settings change and the re-sliced pages.
    updateComposition({ notes: JSON.stringify({ pages: remapped }) });
    saveToCache();
  };

  // Load settings + bar data when the active composition changes.
  React.useEffect(() => {
    if (!currentComposition) return;
    setTempo(currentComposition.globalSettings.tempo.toString());
    setKey(currentComposition.globalSettings.key);
    setCapo((currentComposition.globalSettings.capo || 0).toString());
    setBeats(currentComposition.globalSettings.timeSignature.beats.toString());
    setBeatValue(currentComposition.globalSettings.timeSignature.beatValue.toString());
    setTuningName(currentComposition.globalSettings.tuning.name);
    setTuningNotes((currentComposition.globalSettings.tuning.notes || []).join(' '));

    if (currentComposition.notes) {
      try {
        const barData = JSON.parse(currentComposition.notes);
        if (barData.pages && Array.isArray(barData.pages)) {
          setAllPages(barData.pages);
          setCurrentPage(0);
        } else if (barData.barLyrics && barData.barBeatChords) {
          setAllPages([{ barLyrics: barData.barLyrics, barBeatChords: barData.barBeatChords }]);
          setCurrentPage(0);
        } else if (barData.barChords) {
          const newBeatChords = barData.barChords.map((chord: string) => [chord, '', '', '']);
          setAllPages([{ barLyrics: Array(16).fill(''), barBeatChords: newBeatChords }]);
          setCurrentPage(0);
        }
      } catch {
        setAllPages([emptyPage(chordsPerBar)]);
        setCurrentPage(0);
      }
    } else {
      setAllPages([emptyPage(chordsPerBar)]);
      setCurrentPage(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentComposition?.id]);

  const handleLyricsChange = (barIndex: number, text: string) => {
    const newLyrics = [...barLyrics];
    newLyrics[barIndex] = text;
    setBarLyrics(newLyrics);
  };

  // Cells-per-bar for the 16th grid, from the time signature.
  const cellsPerBar = Math.max(1, Math.round((tsBeats * 16) / tsBeatValue));

  // Stamp a chord's fingering into the tab grid at (bar, beat). Only cells that
  // were auto-stamped from a chord (source:'chord') are cleared first, so any
  // hand-entered/edited notes at that position survive. New stamped cells are
  // tagged source:'chord' so removing the chord later removes only them.
  const stampChordToTab = (
    tab: Record<string, TabCell>,
    barIndex: number,
    beatIndex: number,
    chordName: string
  ): Record<string, TabCell> => {
    const next = { ...tab };
    const cell = Math.round((beatIndex / chordsPerBar) * cellsPerBar);
    // Remove previously chord-stamped cells at this (bar, cell); keep manual ones.
    for (let s = 0; s < 6; s++) {
      const k = `${barIndex}:${cell}:${s}`;
      if (next[k]?.source === 'chord') delete next[k];
    }

    const chordData = chordName ? chordsData.find((c) => c.name === chordName) : undefined;
    if (chordData?.fingering) {
      // fingering is low->high [E A D G B e]; string index = position in array.
      // Muted strings stamp as 'x' cells so the tab shows the full chord shape.
      chordData.fingering.forEach((f, s) => {
        if (f !== '' && f != null) {
          const k = `${barIndex}:${cell}:${s}`;
          // Don't clobber a hand-entered note that's sitting on this exact cell.
          if (next[k] && next[k].source !== 'chord') return;
          next[k] = {
            fret: f === 'x' ? 'x' : parseInt(f, 10) || 0,
            duration: 'quarter',
            source: 'chord',
          };
        }
      });
    }
    return next;
  };

  const handleBeatChordChange = (barIndex: number, beatIndex: number, chord: string) => {
    const newChords = barBeatChords.map((row) => [...row]);
    newChords[barIndex][beatIndex] = chord;
    // Also stamp (or clear) the chord's frets into the tab grid at this position.
    const newTab = stampChordToTab(allPages[currentPage]?.barTab || {}, barIndex, beatIndex, chord);
    const newPages = [...allPages];
    newPages[currentPage] = { ...newPages[currentPage], barBeatChords: newChords, barTab: newTab };
    setAllPages(newPages);
    persistPages(newPages);
  };

  const openChordSelector = (barIndex: number, beatIndex: number) => {
    setSelectedBarIndex(barIndex);
    setSelectedBeatIndex(beatIndex);
    setChordSearchText('');
    setSelectedChordData(null);
    setShowChordModal(true);
  };

  const selectChord = (chord: string) => {
    if (selectedBarIndex !== null && selectedBeatIndex !== null) {
      handleBeatChordChange(selectedBarIndex, selectedBeatIndex, chord);
      setTimeout(() => {
        setShowChordModal(false);
        setChordSearchText('');
        setSelectedChordData(null);
      }, 400);
    }
  };

  const filteredChords = availableChords.filter((c) =>
    c.toLowerCase().includes(chordSearchText.toLowerCase())
  );

  // Actually spin up a fresh blank composition and reset the editor to page 1.
  const startNewComposition = () => {
    createComposition(`New Composition ${compositions.length + 1}`);
    setAllPages([emptyPage()]);
    setCurrentPage(0);
    saveToCache();
  };

  // Entry point for the "New" button. If a composition is open, prompt first.
  const handleCreateNew = () => {
    if (currentComposition) {
      setShowNewDialog(true);
    } else {
      startNewComposition();
    }
  };

  // Dialog: download the current composition, then start fresh.
  const handleNewSaveFirst = async () => {
    await handleSave();
    setShowNewDialog(false);
    startNewComposition();
  };

  // Dialog: discard (current stays in the local library) and start fresh.
  const handleNewDiscard = () => {
    setShowNewDialog(false);
    startNewComposition();
  };

  // Open Settings, seeding the pending chords-per-bar from the current value.
  const openSettings = () => {
    setPendingChordsPerBar(chordsPerBar);
    setShowSettingsDialog(true);
  };

  const handleSettingsSave = () => {
    if (!currentComposition) return;

    // Resolve tuning: a known preset uses its canonical notes; otherwise treat
    // it as a custom tuning with the notes typed in the override field.
    const preset = ALTERNATE_TUNINGS.find((t) => t.name === tuningName);
    const customNotes = tuningNotes.trim().split(/[\s,]+/).filter(Boolean);
    const tuning = preset
      ? { name: preset.name, notes: [...preset.notes] }
      : {
          name: tuningName || 'Custom',
          notes: customNotes.length > 0 ? customNotes : currentComposition.globalSettings.tuning.notes,
        };

    updateGlobalSettings({
      tempo: parseInt(tempo) || 120,
      key: key || 'C',
      capo: parseInt(capo) || 0,
      timeSignature: { beats: parseInt(beats) || 4, beatValue: parseInt(beatValue) || 4 },
      tuning,
    });
    // Commit the chords-per-bar change (re-slices bars) only on Save.
    if (pendingChordsPerBar !== chordsPerBar) {
      handleChordsPerBarChange(pendingChordsPerBar);
    }
    saveToCache();
    setShowSettingsDialog(false);
    setSnackbar({ open: true, message: 'Settings saved' });
  };

  const handleSave = async () => {
    if (!currentComposition) {
      setSnackbar({ open: true, message: 'No composition to save' });
      return;
    }
    try {
      setIsSaving(true);
      const compositionToSave = {
        ...currentComposition,
        title: currentComposition.title || 'Untitled Song',
        updatedAt: new Date(),
      };
      await storageService.setProvider('local');
      const saved = await storageService.exportComposition(compositionToSave);
      if (saved) {
        setSnackbar({ open: true, message: `Saved as ${compositionToSave.title}.hmlcc` });
      }
    } catch (error) {
      setSnackbar({ open: true, message: `Failed to save: ${error instanceof Error ? error.message : 'error'}` });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrint = async (options: PrintOptions) => {
    if (!currentComposition) return;
    setShowPrintDialog(false);
    setIsPrinting(true);
    await new Promise((r) => setTimeout(r, 300));
    const result = await printService.print(currentComposition, chordsData, options);
    if (!result.success) {
      setSnackbar({ open: true, message: result.error || 'Failed to print' });
    }
    setIsPrinting(false);
  };

  if (!currentComposition) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 2 }}>
        <Typography variant="h5">No composition selected</Typography>
        <Typography color="text.secondary">Create or open a composition to start editing</Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button variant="contained" onClick={handleCreateNew}>Create New Composition</Button>
          <Button variant="outlined" onClick={() => navigate('/')}>Back to Compositions</Button>
        </Box>
      </Box>
    );
  }

  // Unique chords used on the CURRENT page, for the reference strip (matches
  // print, which repeats each page's own chords at its top).
  const usedChordNames = new Set<string>();
  (allPages[currentPage]?.barBeatChords || []).forEach((bar) => {
    bar.forEach((chord) => {
      if (chord) usedChordNames.add(chord);
    });
  });
  const uniqueChords = Array.from(usedChordNames)
    .map((name) => chordsData.find((c) => c.name === name))
    .filter((c): c is ChordData => c !== undefined);

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100%' }}>
      {/* Header */}
      <Box sx={{ p: 2, bgcolor: 'background.paper', color: 'text.primary', borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <input
          style={{ fontSize: 20, fontWeight: 600, color: 'currentColor', background: 'transparent', flex: 1, border: 'none', outline: 'none', padding: '4px 8px', marginRight: 16 }}
          value={currentComposition.title}
          onChange={(e) => updateComposition({ title: e.target.value })}
          placeholder="Untitled Song"
        />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Tooltip title="New composition">
            <IconButton onClick={handleCreateNew}><NoteAddIcon /></IconButton>
          </Tooltip>
          <Tooltip title="Print">
            <span><IconButton onClick={() => setShowPrintDialog(true)} disabled={isPrinting}><PrintIcon /></IconButton></span>
          </Tooltip>
          <Tooltip title="Settings">
            <IconButton onClick={openSettings}><SettingsIcon /></IconButton>
          </Tooltip>
          <Tooltip title="Save .hmlcc">
            <span><IconButton color="primary" onClick={handleSave} disabled={isSaving}><SaveIcon /></IconButton></span>
          </Tooltip>
        </Box>
      </Box>

      {/* Page navigation */}
      <Box sx={{ display: 'flex', alignItems: 'center', px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'action.hover' }}>
        <Button
          variant="outlined"
          disabled={currentPage === 0}
          onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
        >
          ← Previous
        </Button>
        <Box sx={{ flex: 1, textAlign: 'center' }}>
          <Typography sx={{ fontWeight: 600 }}>Page {currentPage + 1} of {allPages.length}</Typography>
          <Typography variant="caption" color="text.secondary">(16 bars per page)</Typography>
        </Box>
        <Button
          variant="outlined"
          onClick={() => {
            if (currentPage < allPages.length - 1) {
              setCurrentPage(currentPage + 1);
            } else {
              const newPages = [...allPages, emptyPage(chordsPerBar)];
              setAllPages(newPages);
              persistPages(newPages);
              setCurrentPage(allPages.length);
            }
          }}
        >
          {currentPage === allPages.length - 1 ? '+ Add Page' : 'Next →'}
        </Button>
      </Box>

      {/* Paper canvas */}
      <Box sx={{ overflowX: 'auto', display: 'flex', justifyContent: 'center', p: 2 }}>
        <Box
          sx={{
            width: PAPER_WIDTH, minHeight: PAPER_HEIGHT, bgcolor: PAPER_COLOR, color: '#333',
            border: '1px solid #ccc', boxShadow: '0 2px 8px rgba(0,0,0,0.15)', my: 2,
            // Top/bottom padding = the print margin, so content sits inside the
            // same printable area a real Letter page has.
            py: `${PAPER_MARGIN}px`,
          }}
        >
          {currentPage === 0 && (
            <Box sx={{ width: CONTENT_WIDTH, mx: `${PAPER_MARGIN}px`, py: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <input
                style={{
                  fontSize: 20,
                  fontWeight: 600,
                  color: '#333',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: '1px solid #cbb98f',
                  outline: 'none',
                  flex: 1,
                  padding: '4px 8px',
                  marginRight: 32,
                }}
                value={currentComposition.title}
                onChange={(e) => updateComposition({ title: e.target.value })}
                placeholder="Untitled Song"
              />
              <Box sx={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                <Typography variant="caption"><b>Key:</b> {currentComposition.globalSettings.key}</Typography>
                <Typography variant="caption"><b>Tempo:</b> ♩ = {currentComposition.globalSettings.tempo}</Typography>
                <Typography variant="caption"><b>Capo:</b> {currentComposition.globalSettings.capo || 'None'}</Typography>
              </Box>
            </Box>
          )}

          {uniqueChords.length > 0 && (
            // Sit in the content area (same margin as the tab/staff) and inset
            // ~1.25% to line up with the tab's first bar line, so the chord
            // charts share the notation's horizontal start. Shown on every page.
            <Box
              sx={{
                width: CONTENT_WIDTH, mx: `${PAPER_MARGIN}px`, pl: `${Math.max(0, CONTENT_WIDTH * 0.0125 - 5)}px`,
                pt: 1, pb: 0, display: 'flex', gap: 1.5, flexWrap: 'wrap',
              }}
            >
              {uniqueChords.map((chord, index) => (
                <MiniChordDiagram key={index} chord={chord} background={PAPER_COLOR} />
              ))}
            </Box>
          )}

          <Box sx={{ width: CONTENT_WIDTH, mx: `${PAPER_MARGIN}px`, pt: 0, pb: '10px' }}>
            {[0, 1, 2, 3].map((rowIndex) => {
              const emptyBar = Array(chordsPerBar).fill('');
              const rowBeatChords = [0, 1, 2, 3]
                .map((colIndex) => barBeatChords[rowIndex * 4 + colIndex] || emptyBar)
                .flat();

              return (
                // Guaranteed gap below each row so a staff's low notes never
                // collide with the next row's lyrics.
                <Box key={rowIndex} sx={{ mb: '12px' }}>
                  {/* Lyrics for the row */}
                  <Tooltip title="click here to add lyrics!" placement="top-start">
                    <input
                      style={{ width: CONTENT_WIDTH, background: 'transparent', border: 'none', borderBottom: '1px solid #ccc', outline: 'none', padding: '2px 0', marginTop: '2px', marginBottom: '2px', minHeight: 30, fontSize: 18, color: '#333' }}
                      value={barLyrics[rowIndex * 4] || ''}
                      onChange={(e) => handleLyricsChange(rowIndex * 4, e.target.value)}
                    />
                  </Tooltip>

                  {/* Chord slots — each centered over the 16th cell its frets are
                      stamped to (see stampChordToTab), so names line up with
                      their tab columns. Same geometry as Tablature/print. */}
                  <Box sx={{ position: 'relative', height: 24, mb: '5px' }}>
                    {[0, 1, 2, 3].map((colIndex) => {
                      const barIndex = rowIndex * 4 + colIndex;
                      const barWidth = colIndex === 0 ? rowLayout.firstMeasureWidth : rowLayout.otherMeasureWidth;
                      const reserve = colIndex === 0 ? CLEF_RESERVE : 0;
                      const beatWidth = (barWidth - reserve) / chordsPerBar;
                      const barSlots = barBeatChords[barIndex] || emptyBar;
                      return Array.from({ length: chordsPerBar }, (_, beatIndex) => {
                        const chordName = barSlots[beatIndex] || '';
                        const chord = chordName ? chordsData.find((c) => c.name === chordName) : undefined;
                        const label = chordName ? shortChordName(chordName, chord?.startingFret) : '+';
                        const stampCell = Math.round((beatIndex / chordsPerBar) * cellsPerBar);
                        const x = getSubdivisionX(colIndex * cellsPerBar + stampCell, cellsPerBar, rowLayout);
                        return (
                          <Tooltip key={`${colIndex}-${beatIndex}`} title={!chordName ? 'click to add chord' : chordName}>
                            <button
                              onClick={() => openChordSelector(barIndex, beatIndex)}
                              style={{
                                position: 'absolute', left: x - beatWidth / 2, top: 0,
                                width: beatWidth, height: 24, background: 'transparent', border: 'none',
                                cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center',
                              }}
                            >
                              <span style={{ fontSize: chordName ? 10 : 14, fontWeight: 'bold', color: chordName ? '#000' : '#1976d2' }}>
                                {label}
                              </span>
                            </button>
                          </Tooltip>
                        );
                      });
                    })}
                  </Box>

                  {/* Tablature — vertical padding only; horizontal padding would
                      push the 900px-wide notation past the content edge. */}
                  <Box sx={{ py: '4px', bgcolor: PAPER_COLOR, position: 'relative', overflow: 'hidden' }}>
                    <Tablature
                      beatChords={rowBeatChords}
                      chordsData={chordsData}
                      width={CONTENT_WIDTH}
                      height={65}
                      numMeasures={4}
                      beatsPerBar={chordsPerBar}
                      tsBeats={tsBeats}
                      tsBeatValue={tsBeatValue}
                      paperColor={PAPER_COLOR}
                      rowStartBar={rowIndex * 4}
                      barTab={barTab}
                      onCellClick={openTabCell}
                    />
                  </Box>

                  {/* Staff — pulled up ~5px so its top sits closer to the tab.
                      Height fits the stave plus a few ledger positions below so
                      low chords aren't clipped; the row's mb keeps it clear of
                      the next lyrics. */}
                  <Box sx={{ pt: 0, pb: 0, mt: '-5px', bgcolor: PAPER_COLOR, height: 110, position: 'relative', overflow: 'hidden' }}>
                    <StaffNotes
                      beatChords={rowBeatChords}
                      width={CONTENT_WIDTH}
                      height={150}
                      numMeasures={4}
                      beatsPerBar={chordsPerBar}
                      tsBeats={currentComposition.globalSettings.timeSignature.beats}
                      tsBeatValue={currentComposition.globalSettings.timeSignature.beatValue}
                      tuning={currentComposition.globalSettings.tuning.notes}
                      barTab={barTab}
                      rowStartBar={rowIndex * 4}
                    />
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Box>
      </Box>

      {/* Chord selector dialog */}
      <Dialog open={showChordModal} onClose={() => setShowChordModal(false)} maxWidth="md" fullWidth>
        <DialogTitle>Select a Chord</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', gap: 1.5, maxHeight: 500 }}>
            {/* Left: search + list */}
            <Box sx={{ width: 220, display: 'flex', flexDirection: 'column' }}>
              <TextField
                label="Search chords"
                value={chordSearchText}
                onChange={(e) => setChordSearchText(e.target.value)}
                size="small"
                autoFocus
                placeholder="e.g., C, Dm, G7"
                sx={{ mb: 1, mt: 1 }}
                InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
              />
              <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, flex: 1, overflowY: 'auto', maxHeight: 420 }}>
                {filteredChords.map((item) => {
                  const selected = selectedChordData?.name === item;
                  return (
                    <Box
                      key={item}
                      onClick={() => {
                        const detail = chordsData.find((c) => c.name === item);
                        if (detail) setSelectedChordData(detail);
                      }}
                      sx={{
                        py: 1, px: 1, cursor: 'pointer',
                        borderBottom: '1px solid', borderBottomColor: 'divider',
                        bgcolor: selected ? 'action.selected' : 'transparent',
                        borderLeft: selected ? '4px solid' : '4px solid transparent',
                        borderLeftColor: selected ? 'info.main' : 'transparent',
                        fontWeight: selected ? 700 : 500, fontSize: 13,
                        color: selected ? 'info.main' : 'text.primary',
                        '&:hover': { bgcolor: 'action.hover' },
                      }}
                    >
                      {item}
                    </Box>
                  );
                })}
              </Box>
            </Box>

            {/* Right: preview */}
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              {selectedChordData ? (
                <>
                  <ChordDiagram chord={selectedChordData} />
                  <Box sx={{ bgcolor: '#f5f5f5', borderRadius: 1, p: 1.5, borderLeft: '4px solid #1976d2', width: '100%' }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: '#1976d2', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block' }}>
                      How to Play:
                    </Typography>
                    <Typography variant="body2" sx={{ fontStyle: 'italic', color: '#333' }}>
                      {selectedChordData.commonFingeringNotes}
                    </Typography>
                  </Box>
                </>
              ) : (
                <Typography sx={{ color: '#999', fontStyle: 'italic' }}>
                  Select a chord from the list to view details
                </Typography>
              )}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          {selectedChordData && (
            <Button variant="contained" color="info" onClick={() => selectChord(selectedChordData.name)}>Select</Button>
          )}
          <Button color="inherit" onClick={() => {
            if (selectedBarIndex !== null && selectedBeatIndex !== null) {
              handleBeatChordChange(selectedBarIndex, selectedBeatIndex, '');
            }
            setShowChordModal(false);
            setChordSearchText('');
            setSelectedChordData(null);
          }}>Clear</Button>
          <Button color="inherit" onClick={() => {
            setShowChordModal(false);
            setChordSearchText('');
            setSelectedChordData(null);
          }}>Cancel</Button>
        </DialogActions>
      </Dialog>

      {/* Settings dialog */}
      <Dialog open={showSettingsDialog} onClose={() => setShowSettingsDialog(false)}>
        <DialogTitle>Composition Settings</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 1, minWidth: 320 }}>
            <TextField select label="Key" value={key || 'C'} onChange={(e) => setKey(e.target.value)} size="small">
              {KEY_OPTIONS.map((k) => (
                <MenuItem key={k} value={k}>{k}</MenuItem>
              ))}
            </TextField>
            <TextField
              type="number"
              label="Tempo (BPM)"
              value={tempo}
              onChange={(e) => setTempo(e.target.value)}
              size="small"
              placeholder="120"
              inputProps={{ min: 20, max: 400, step: 1 }}
            />
            <TextField
              type="number"
              label="Capo"
              value={capo}
              onChange={(e) => {
                const n = Math.max(0, Math.min(12, parseInt(e.target.value) || 0));
                setCapo(String(n));
              }}
              size="small"
              placeholder="0"
              inputProps={{ min: 0, max: 12, step: 1 }}
            />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <TextField select label="Beats" value={parseInt(beats) || 4} onChange={(e) => setBeats(String(e.target.value))} size="small" sx={{ flex: 1 }}>
                {BEATS_OPTIONS.map((b) => (
                  <MenuItem key={b} value={b}>{b}</MenuItem>
                ))}
              </TextField>
              <Typography sx={{ fontSize: 20, fontWeight: 'bold' }}>/</Typography>
              <TextField select label="Beat Value" value={parseInt(beatValue) || 4} onChange={(e) => setBeatValue(String(e.target.value))} size="small" sx={{ flex: 1 }}>
                {BEAT_VALUE_OPTIONS.map((b) => (
                  <MenuItem key={b} value={b}>{b}</MenuItem>
                ))}
              </TextField>
            </Box>
            <TextField
              select
              label="Tuning"
              size="small"
              value={ALTERNATE_TUNINGS.some((t) => t.name === tuningName) ? tuningName : '__custom__'}
              onChange={(e) => {
                const val = e.target.value;
                if (val === '__custom__') {
                  // Switch to a custom tuning, seeding notes from the current one.
                  setTuningName('Custom');
                  if (!tuningNotes.trim()) {
                    setTuningNotes((currentComposition.globalSettings.tuning.notes || []).join(' '));
                  }
                } else {
                  const preset = ALTERNATE_TUNINGS.find((t) => t.name === val);
                  setTuningName(val);
                  if (preset) setTuningNotes(preset.notes.join(' '));
                }
              }}
            >
              {ALTERNATE_TUNINGS.map((t) => (
                <MenuItem key={t.name} value={t.name}>
                  {t.name} ({t.notes.map((n) => n.replace(/\d+$/, '')).join(' ')})
                </MenuItem>
              ))}
              <MenuItem value="__custom__">Custom…</MenuItem>
            </TextField>
            {!ALTERNATE_TUNINGS.some((t) => t.name === tuningName) && (
              <TextField
                label="Custom tuning (low → high)"
                size="small"
                value={tuningNotes}
                onChange={(e) => setTuningNotes(e.target.value)}
                placeholder="e.g. D2 A2 D3 G3 B3 E4"
                helperText="Six string notes, low to high, space-separated"
              />
            )}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 0.5 }}>
              <Box>
                <Typography variant="body2">Chords per bar</Typography>
                <Typography variant="caption" color="text.secondary">
                  Slots each bar is divided into
                </Typography>
              </Box>
              <ToggleButtonGroup
                size="small"
                exclusive
                value={pendingChordsPerBar}
                onChange={(_, v) => v && setPendingChordsPerBar(v)}
              >
                <ToggleButton value={2}>2</ToggleButton>
                <ToggleButton value={4}>4</ToggleButton>
                <ToggleButton value={8}>8</ToggleButton>
              </ToggleButtonGroup>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setPendingChordsPerBar(chordsPerBar); setShowSettingsDialog(false); }}>Cancel</Button>
          <Button variant="contained" onClick={handleSettingsSave}>Save</Button>
        </DialogActions>
      </Dialog>

      {/* New-composition confirmation */}
      <Dialog open={showNewDialog} onClose={() => setShowNewDialog(false)}>
        <DialogTitle>Start a new composition?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Save "{currentComposition.title || 'Untitled Song'}" as a .hmlcc file before starting fresh?
            It also stays in your local library either way.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowNewDialog(false)}>Cancel</Button>
          <Button color="error" onClick={handleNewDiscard}>Discard</Button>
          <Button variant="contained" onClick={handleNewSaveFirst} disabled={isSaving}>Save</Button>
        </DialogActions>
      </Dialog>

      <PrintDialog open={showPrintDialog} onClose={() => setShowPrintDialog(false)} onPrint={handlePrint} />

      {/* Tab-cell fret + technique popover */}
      <Popover
        open={tabPopover !== null}
        onClose={() => setTabPopover(null)}
        anchorReference="anchorPosition"
        anchorPosition={tabPopover ? { top: tabPopover.anchor.bottom + 4, left: tabPopover.anchor.left } : undefined}
      >
        {tabPopover && (
          <Box sx={{ p: 1.5, width: 260, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <TextField
              select
              label="Note value"
              size="small"
              fullWidth
              value={tabPopover.duration}
              onChange={(e) => setTabPopover({ ...tabPopover, duration: e.target.value as NoteDuration })}
              helperText="How this note is drawn on the staff"
            >
              {DURATION_OPTIONS.map((d) => (
                <MenuItem key={d.value} value={d.value}>{d.label}</MenuItem>
              ))}
            </TextField>

            <TextField
              select
              label="String"
              size="small"
              fullWidth
              value={tabPopover.string}
              onChange={(e) => retargetTabPopover(tabPopover.bar, tabPopover.cell, Number(e.target.value))}
            >
              {[0, 1, 2, 3, 4, 5].map((s) => (
                <MenuItem key={s} value={s}>
                  String {s + 1} ({['E', 'A', 'D', 'G', 'B', 'e'][s]})
                </MenuItem>
              ))}
            </TextField>

            <TextField
              select
              label="Fret"
              size="small"
              fullWidth
              autoFocus
              value={tabPopover.fret === '' ? 'x' : tabPopover.fret}
              onChange={(e) => setTabPopover({ ...tabPopover, fret: e.target.value })}
            >
              {FRET_OPTIONS.map((f) => (
                <MenuItem key={f} value={f}>{f === 'x' ? 'x (muted)' : f}</MenuItem>
              ))}
            </TextField>

            <TextField
              select
              label="Technique"
              size="small"
              fullWidth
              SelectProps={{
                multiple: true,
                renderValue: (selected) => {
                  const vals = selected as TabTechnique[];
                  if (vals.length === 0) return 'None';
                  return vals.map((v) => TECHNIQUE_OPTIONS.find((t) => t.value === v)?.label).join(', ');
                },
              }}
              value={tabPopover.techniques}
              onChange={(e) => {
                const val = e.target.value as unknown as TabTechnique[];
                setTabPopover({ ...tabPopover, techniques: val });
              }}
            >
              {TECHNIQUE_OPTIONS.map((t) => (
                <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
              ))}
            </TextField>

            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
              <Button size="small" color="inherit" onClick={clearTabPopover}>Clear</Button>
              <Button size="small" variant="contained" onClick={applyTabPopover}>Apply</Button>
            </Box>
          </Box>
        )}
      </Popover>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ open: false, message: '' })}
        message={snackbar.message}
      />
    </Box>
  );
};
