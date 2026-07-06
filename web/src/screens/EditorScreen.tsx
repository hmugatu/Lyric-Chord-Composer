import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Button, IconButton, Tooltip, Typography, TextField, Dialog, DialogTitle,
  DialogContent, DialogContentText, DialogActions, InputAdornment, Snackbar,
  ToggleButton, ToggleButtonGroup, MenuItem, Popover, Switch, Slider,
} from '@mui/material';
import PrintIcon from '@mui/icons-material/Print';
import SettingsIcon from '@mui/icons-material/Settings';
import SaveIcon from '@mui/icons-material/Save';
import SearchIcon from '@mui/icons-material/Search';
import NoteAddIcon from '@mui/icons-material/NoteAdd';
import PostAddIcon from '@mui/icons-material/PostAdd';
import DocumentScannerIcon from '@mui/icons-material/DocumentScanner';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import MicIcon from '@mui/icons-material/Mic';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import DeleteIcon from '@mui/icons-material/Delete';
import { useCompositionStore } from '../store/compositionStore';
import { ALTERNATE_TUNINGS, STANDARD_TUNING } from '../models/Note';
import type { NoteDuration } from '../models/Note';
import type { TabCell, TabTechnique } from '../models/Tablature';
import { CompositionStorageService } from '../services/compositionService';
import { PrintService } from '../services/printService';
import { ImportTextDialog } from '../components/ImportTextDialog';
import { ScanPhotoDialog } from '../components/ScanPhotoDialog';
import { RehearsalView } from '../components/RehearsalView';
import { LyricLine } from '../components/LyricLine';
import { textToPages } from '../utils/importText';
import { noteToTabPosition } from '../utils/pitchDetect';
import { RecordNoteDialog } from '../components/RecordNoteDialog';
import { RecordClipDialog } from '../components/RecordClipDialog';
import {
  saveAudioClip, deleteAudioClip, resolveAudioUrl, isObjectUrl,
  type AudioClipRef,
} from '../services/audioStore';
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

// A page is a grid of rows x 4 bars. Rows shown depend on the staff toggle:
// with the staff there's room for 4 rows (16 bars); without it, 7 rows (28 bars).
// Page data is always allocated at the larger size so toggling never drops bars.
// Capture features (OCR photo scan, mic note-capture, audio record + karaoke
// playback) are hidden for now pending a revisit. Flip to true to re-enable;
// all the wiring stays in place. See ocr-audio-features work.
const CAPTURE_FEATURES = false;

const BARS_PER_ROW = 4;
const ROWS_WITH_STAFF = 4;
const ROWS_WITHOUT_STAFF = 7; // 28 bars — fills the page height without the staff
const MAX_ROWS_PER_PAGE = ROWS_WITHOUT_STAFF;
const MAX_BARS_PER_PAGE = MAX_ROWS_PER_PAGE * BARS_PER_ROW; // 28

// How many rows/bars are visible for the current staff setting.
const rowsForStaff = (showStaff: boolean) => (showStaff ? ROWS_WITH_STAFF : ROWS_WITHOUT_STAFF);

const emptyPage = (slots = 4): PageState => ({
  barLyrics: Array(MAX_BARS_PER_PAGE).fill(''),
  barBeatChords: Array(MAX_BARS_PER_PAGE).fill(null).map(() => Array(slots).fill('')),
  barTab: {},
});

// A single bar lifted out of its page, carrying everything indexed by bar.
interface FlatBar {
  lyric: string;
  chords: string[];
  // tab cells for this bar, keyed by `cell:string` (bar index dropped).
  tab: Record<string, TabCell>;
}

// Flatten pages into one continuous sequence of bars, trimming trailing empties
// so blank tail bars from a smaller page size don't force extra pages later.
// `oldBarsPerPage` is how many bars were actually *visible* per page under the
// staff state the pages were built with — only those are lifted. Pages always
// store MAX_BARS_PER_PAGE (24) slots, but with the staff on only 16 are shown;
// pulling the hidden 17–24 padding slots would inject blank bars mid-sequence
// and balloon the page count on reflow.
const flattenPages = (pages: PageState[], slots: number, oldBarsPerPage: number): FlatBar[] => {
  const bars: FlatBar[] = [];
  pages.forEach((page) => {
    const tabByBar: Record<number, Record<string, TabCell>> = {};
    Object.entries(page.barTab || {}).forEach(([key, cell]) => {
      const [bar, c, s] = key.split(':');
      (tabByBar[Number(bar)] ||= {})[`${c}:${s}`] = cell;
    });
    for (let i = 0; i < oldBarsPerPage; i++) {
      bars.push({
        lyric: page.barLyrics[i] || '',
        chords: page.barBeatChords[i] || Array(slots).fill(''),
        tab: tabByBar[i] || {},
      });
    }
  });
  // Drop trailing bars with no lyric, no chord, and no tab.
  let end = bars.length;
  while (end > 0) {
    const b = bars[end - 1];
    const empty = !b.lyric.trim() && !b.chords.some((c) => c.trim()) && Object.keys(b.tab).length === 0;
    if (!empty) break;
    end--;
  }
  return bars.slice(0, end);
};

// Re-chunk a flat bar sequence into fixed-size pages (MAX_BARS_PER_PAGE slots
// each, padded with empties), re-keying each bar's tab to its new page-local
// index. Always returns at least one page.
const barsToPages = (bars: FlatBar[], barsPerPage: number, slots: number): PageState[] => {
  const pages: PageState[] = [];
  const pageCount = Math.max(1, Math.ceil(bars.length / barsPerPage));
  for (let p = 0; p < pageCount; p++) {
    const page = emptyPage(slots);
    for (let i = 0; i < barsPerPage; i++) {
      const src = bars[p * barsPerPage + i];
      if (!src) continue;
      page.barLyrics[i] = src.lyric;
      page.barBeatChords[i] = [...src.chords];
      Object.entries(src.tab).forEach(([ck, cell]) => {
        page.barTab![`${i}:${ck}`] = cell;
      });
    }
    pages.push(page);
  }
  return pages;
};

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

// Chord slots per bar offered in Settings and the import dialog.
const CHORDS_PER_BAR_OPTIONS = [1, 2, 3, 4, 6, 8];
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
  const [showChordModal, setShowChordModal] = React.useState(false);
  const [showNewDialog, setShowNewDialog] = React.useState(false);
  const [showImportDialog, setShowImportDialog] = React.useState(false);
  const [showScanDialog, setShowScanDialog] = React.useState(false);
  const [rehearsalMode, setRehearsalMode] = React.useState(false);
  const [showRecordDialog, setShowRecordDialog] = React.useState(false);
  const [showClipDialog, setShowClipDialog] = React.useState(false);
  // Reference to the composition's audio clip (local IndexedDB or a URL), plus
  // a resolved object URL for the <audio> element. null when there's no clip.
  const [audioRef, setAudioRef] = React.useState<AudioClipRef | null>(null);
  const [audioUrl, setAudioUrl] = React.useState<string | null>(null);
  // Follow-along transport state.
  const [playhead, setPlayhead] = React.useState(0); // seconds
  const [isPlaying, setIsPlaying] = React.useState(false);
  const audioElRef = React.useRef<HTMLAudioElement | null>(null);
  const activeRowRef = React.useRef<HTMLDivElement | null>(null);
  const [showImportConfirm, setShowImportConfirm] = React.useState(false);
  const [pendingImport, setPendingImport] = React.useState<{
    text: string; barsPerLine: number; chordsPerBar: number;
  } | null>(null);
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
  const [pendingChordsPerBar, setPendingChordsPerBar] = React.useState(1);
  const [pendingLyricSpacing, setPendingLyricSpacing] = React.useState<'stretch' | 'left'>('stretch');
  const [pendingShowStaff, setPendingShowStaff] = React.useState(true);

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
  const lyricSpacing = currentComposition?.globalSettings.lyricSpacing || 'stretch';
  const showStaff = currentComposition?.globalSettings.showStaff !== false; // default on
  // Rows/bars shown per page depend on the staff: 4 rows (16 bars) with the
  // staff, 7 rows (28 bars) without it. Data is stored at MAX size regardless.
  const visibleRows = rowsForStaff(showStaff);
  const visibleBars = visibleRows * BARS_PER_ROW;
  const tsBeats = currentComposition?.globalSettings.timeSignature.beats || 4;
  const tsBeatValue = currentComposition?.globalSettings.timeSignature.beatValue || 4;

  const barLyrics = allPages[currentPage]?.barLyrics || Array(MAX_BARS_PER_PAGE).fill('');
  const barBeatChords = allPages[currentPage]?.barBeatChords || Array(MAX_BARS_PER_PAGE).fill(null).map(() => Array(chordsPerBar).fill(''));
  const barTab = allPages[currentPage]?.barTab || {};

  // Latest audio ref, mirrored so every notes-write picks it up without stale
  // closures (many call sites persist pages independently of audio changes).
  const audioRefRef = React.useRef<AudioClipRef | null>(null);
  React.useEffect(() => { audioRefRef.current = audioRef; }, [audioRef]);

  // Serialize the notes blob: pages plus the current audio clip reference.
  const notesJson = (pages: PageState[]) =>
    JSON.stringify({ pages, audio: audioRefRef.current ?? undefined });

  // Persist the given pages array into the composition notes blob.
  const persistPages = (pages: PageState[]) => {
    if (currentComposition) {
      updateComposition({ notes: notesJson(pages) });
      saveToCache();
    }
  };

  // Any content on any page? Used to warn before an import overwrites work.
  const hasContent = (pages: PageState[]) =>
    pages.some(
      (p) =>
        p.barLyrics.some((l) => l.trim()) ||
        p.barBeatChords.some((bar) => bar.some((c) => c.trim())),
    );

  // Import pasted chords-over-lyrics text into the current composition, replacing
  // its pages. Prompts first when there is existing content to overwrite.
  const runImport = (text: string, barsPerLine: number, importChordsPerBar: number) => {
    const cellsPerBar = Math.max(1, Math.round((tsBeats * 16) / tsBeatValue));
    const result = textToPages(text, importChordsPerBar, chordsData, cellsPerBar, barsPerLine, visibleBars);
    setAllPages(result.pages);
    setCurrentPage(0);
    if (currentComposition) {
      // Chords-per-bar is a global grid setting; keep it in sync with the import.
      const settings =
        importChordsPerBar !== chordsPerBar ? { chordsPerBar: importChordsPerBar } : undefined;
      if (settings) updateGlobalSettings(settings);
      updateComposition({ notes: notesJson(result.pages) });
      saveToCache();
    }
    const unmapped = result.unmappedChords.length
      ? ` (${result.unmappedChords.length} chord(s) approximated)`
      : '';
    setSnackbar({ open: true, message: `Imported ${result.filledRows} line(s)${unmapped}` });
  };

  const handleImportRequest = (text: string, barsPerLine: number, importChordsPerBar: number) => {
    setShowImportDialog(false);
    setShowScanDialog(false);
    if (hasContent(allPages)) {
      setPendingImport({ text, barsPerLine, chordsPerBar: importChordsPerBar });
      setShowImportConfirm(true);
    } else {
      runImport(text, barsPerLine, importChordsPerBar);
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
    updateComposition({ notes: notesJson(remapped) });
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

    // Reset transport whenever the active composition changes.
    setIsPlaying(false);
    setPlayhead(0);
    let parsedAudio: AudioClipRef | null = null;
    if (currentComposition.notes) {
      try {
        const barData = JSON.parse(currentComposition.notes);
        if (barData.audio) parsedAudio = barData.audio as AudioClipRef;
        if (barData.pages && Array.isArray(barData.pages)) {
          setAllPages(barData.pages);
          setCurrentPage(0);
        } else if (barData.barLyrics && barData.barBeatChords) {
          setAllPages([{ barLyrics: barData.barLyrics, barBeatChords: barData.barBeatChords }]);
          setCurrentPage(0);
        } else if (barData.barChords) {
          const newBeatChords = barData.barChords.map((chord: string) => [chord, '', '', '']);
          setAllPages([{ barLyrics: Array(MAX_BARS_PER_PAGE).fill(''), barBeatChords: newBeatChords }]);
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
    setAudioRef(parsedAudio);
    audioRefRef.current = parsedAudio;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentComposition?.id]);

  // Resolve the audio ref (local IndexedDB clip or a URL) into a playable URL
  // for the <audio> element, revoking any prior object URL. A local clip may
  // exist in IndexedDB even without a stored ref (recorded this session), so we
  // probe on every composition/ref change.
  React.useEffect(() => {
    let cancelled = false;
    let created: string | null = null;
    const compId = currentComposition?.id;
    if (!compId) { setAudioUrl(null); return; }
    resolveAudioUrl(compId, audioRef ?? undefined).then((url) => {
      if (cancelled) { if (url && isObjectUrl(url)) URL.revokeObjectURL(url); return; }
      created = url && isObjectUrl(url) ? url : null;
      setAudioUrl(url);
    });
    return () => { cancelled = true; if (created) URL.revokeObjectURL(created); };
  }, [currentComposition?.id, audioRef]);

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

  // First bar on the visible page with no chords and no tab notes, or -1.
  const firstEmptyBar = (): number => {
    const chords = allPages[currentPage]?.barBeatChords || [];
    const tab = allPages[currentPage]?.barTab || {};
    for (let b = 0; b < visibleBars; b++) {
      const hasChord = (chords[b] || []).some((c) => c && c.trim());
      const hasTab = Object.keys(tab).some((k) => k.startsWith(`${b}:`));
      if (!hasChord && !hasTab) return b;
    }
    return -1;
  };

  // Resolve where a mic-detected note should land. Prefer an open tab-cell
  // popover (exact bar/cell), then the selected chord slot (converting its beat
  // index to a 16th-cell like stampChordToTab does); if nothing is selected,
  // fall back to the first empty bar so recording always has a home.
  const noteTarget = (): { bar: number; cell: number } | null => {
    if (tabPopover) return { bar: tabPopover.bar, cell: tabPopover.cell };
    if (selectedBarIndex !== null && selectedBeatIndex !== null) {
      return { bar: selectedBarIndex, cell: Math.round((selectedBeatIndex / chordsPerBar) * cellsPerBar) };
    }
    const empty = firstEmptyBar();
    return empty >= 0 ? { bar: empty, cell: 0 } : null;
  };

  // Live recording cursor: where the NEXT detected note lands. Seeded from
  // noteTarget() when recording starts, then advanced one chord-slot per note.
  const recordCursorRef = React.useRef<{ bar: number; cell: number } | null>(null);

  const beginNoteRecording = () => {
    recordCursorRef.current = noteTarget();
  };

  // Advance the cursor by one chord slot, wrapping into the next bar and
  // stopping at the end of the visible page.
  const advanceCursor = (cur: { bar: number; cell: number }): { bar: number; cell: number } | null => {
    const step = Math.max(1, Math.round(cellsPerBar / chordsPerBar));
    let cell = cur.cell + step;
    let bar = cur.bar;
    if (cell >= cellsPerBar) { cell = 0; bar += 1; }
    return bar < visibleBars ? { bar, cell } : null;
  };

  // Stamp one mic-detected note at the live cursor, then advance it. Called
  // repeatedly as the player plays; each distinct note fills the next slot.
  const placeNextNote = (noteName: string) => {
    const target = recordCursorRef.current ?? noteTarget();
    if (!target) return;
    const tuningNotesArr =
      currentComposition?.globalSettings.tuning.notes?.length
        ? currentComposition.globalSettings.tuning.notes
        : STANDARD_TUNING.notes;
    const pos = noteToTabPosition(noteName, tuningNotesArr);
    if (!pos) {
      setSnackbar({ open: true, message: `${noteName} is out of range — skipped` });
      return;
    }
    setAllPages((pages) => {
      const newTab = { ...(pages[currentPage]?.barTab || {}) };
      newTab[`${target.bar}:${target.cell}:${pos.stringIndex}`] = { fret: pos.fret, duration: 'quarter' };
      const newPages = [...pages];
      newPages[currentPage] = { ...newPages[currentPage], barTab: newTab };
      persistPages(newPages);
      return newPages;
    });
    recordCursorRef.current = advanceCursor(target);
  };

  // Persist a freshly recorded clip locally and reference it from the notes.
  const handleClipSaved = async (blob: Blob, durationSec: number) => {
    setShowClipDialog(false);
    if (!currentComposition) return;
    await saveAudioClip(currentComposition.id, blob);
    const ref: AudioClipRef = { location: { kind: 'local' }, mimeType: blob.type, durationSec };
    setAudioRef(ref);
    audioRefRef.current = ref;
    persistPages(allPages); // writes the audio ref into notes via notesJson
    setSnackbar({ open: true, message: 'Recording saved' });
  };

  // Attach a user-provided audio URL as the clip (no download; played directly).
  const attachAudioUrl = (url: string) => {
    const ref: AudioClipRef = { location: { kind: 'url', url } };
    setAudioRef(ref);
    audioRefRef.current = ref;
    persistPages(allPages);
  };

  const removeAudio = async () => {
    setIsPlaying(false);
    setPlayhead(0);
    if (currentComposition) await deleteAudioClip(currentComposition.id);
    setAudioRef(null);
    audioRefRef.current = null;
    persistPages(allPages);
    setSnackbar({ open: true, message: 'Recording removed' });
  };

  // Follow-along: seconds per bar from tempo + time signature. A bar has
  // `tsBeats` beats; each beat is 60/tempo seconds (beat = the beatValue note).
  const tempoBpm = currentComposition?.globalSettings.tempo || 120;
  const secondsPerBar = (60 / tempoBpm) * tsBeats;
  // Active global bar index and 0..1 progress within it at the current playhead.
  const activeBar = isPlaying || playhead > 0 ? Math.floor(playhead / secondsPerBar) : -1;
  const barProgress = activeBar >= 0 ? (playhead - activeBar * secondsPerBar) / secondsPerBar : 0;
  const activeRow = activeBar >= 0 ? Math.floor(activeBar / 4) : -1;

  // Auto-scroll the active row into view as playback advances. Keyed on the row
  // (not the playhead) so it only scrolls when the row actually changes.
  React.useEffect(() => {
    if (isPlaying && activeRow >= 0) {
      activeRowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeRow, isPlaying]);

  const togglePlay = () => {
    const el = audioElRef.current;
    if (!el) return;
    if (el.paused) void el.play(); else el.pause();
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
    setPendingLyricSpacing(lyricSpacing);
    setPendingShowStaff(showStaff);
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
      lyricSpacing: pendingLyricSpacing,
      showStaff: pendingShowStaff,
    });
    // Re-slice chords-per-bar and/or reflow bars across pages when the staff
    // toggles. Both derive from the same `allPages`, so do them together off one
    // snapshot rather than through two handlers that would race on stale state.
    const chordsChanged = pendingChordsPerBar !== chordsPerBar;
    const staffChanged = pendingShowStaff !== showStaff;
    if (chordsChanged || staffChanged) {
      // Apply the chords-per-bar reslice first so flattened bars carry the new
      // slot count; the total number of bars is unaffected.
      let pages = allPages;
      if (chordsChanged) {
        pages = pages.map((page) => ({
          ...page,
          barBeatChords: page.barBeatChords.map((bar) => resliceBar(bar, chordsPerBar, pendingChordsPerBar)),
        }));
      }
      // Toggling the staff changes bars-per-page (16 with, 28 without); tear the
      // pages down to one flat bar list and rebuild them from scratch so no stale
      // page (e.g. a now-out-of-range 4th page) can survive. 60 bars stay 60 bars.
      if (staffChanged) {
        const oldBarsPerPage = rowsForStaff(showStaff) * BARS_PER_ROW;
        const newBarsPerPage = rowsForStaff(pendingShowStaff) * BARS_PER_ROW;
        const flat = flattenPages(pages, pendingChordsPerBar, oldBarsPerPage);
        pages = barsToPages(flat, newBarsPerPage, pendingChordsPerBar);
      }
      setAllPages(pages);
      if (chordsChanged) updateGlobalSettings({ chordsPerBar: pendingChordsPerBar });
      updateComposition({ notes: notesJson(pages) });
    }
    // Return to the first page on any settings save — the page grid may have
    // been rebuilt, and this avoids rendering a stale/out-of-range page index.
    setCurrentPage(0);
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

  const handlePrint = async () => {
    if (!currentComposition) return;
    setIsPrinting(true);
    await new Promise((r) => setTimeout(r, 300));
    const result = await printService.print(currentComposition, chordsData, {
      includeChordDiagrams: true,
      includeTablature: true,
      includeNotation: showStaff,
      pageSize: 'letter',
      orientation: 'portrait',
    });
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

  // Rehearsal mode: read-only two-page spread view of the whole composition.
  if (rehearsalMode) {
    return (
      <RehearsalView
        pages={allPages}
        composition={currentComposition}
        chordsData={chordsData}
        rows={visibleRows}
        showStaff={showStaff}
        onExit={() => setRehearsalMode(false)}
      />
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
          <Tooltip title="Import from text">
            <IconButton onClick={() => setShowImportDialog(true)}><PostAddIcon /></IconButton>
          </Tooltip>
          {/* OCR scan + mic note-capture + audio record/playback are hidden for
              now (CAPTURE_FEATURES) — to revisit. Code below stays wired. */}
          {CAPTURE_FEATURES && (
            <>
              <Tooltip title="Scan a photo">
                <IconButton onClick={() => setShowScanDialog(true)}><DocumentScannerIcon /></IconButton>
              </Tooltip>
              <Tooltip title="Record a note into the selected cell">
                <IconButton onClick={() => setShowRecordDialog(true)}><MicIcon /></IconButton>
              </Tooltip>
              <Tooltip title="Record audio for playback">
                <IconButton onClick={() => setShowClipDialog(true)}><FiberManualRecordIcon /></IconButton>
              </Tooltip>
              {audioUrl && (
                <Tooltip title={isPlaying ? 'Pause follow-along' : 'Play with karaoke follow-along'}>
                  <IconButton color={isPlaying ? 'primary' : 'default'} onClick={togglePlay}>
                    {isPlaying ? <PauseIcon /> : <PlayArrowIcon />}
                  </IconButton>
                </Tooltip>
              )}
            </>
          )}
          <Tooltip title="Rehearsal mode (two-page read-only view)">
            <IconButton onClick={() => setRehearsalMode(true)}><MenuBookIcon /></IconButton>
          </Tooltip>
          <Tooltip title="Print">
            <span><IconButton onClick={handlePrint} disabled={isPrinting}><PrintIcon /></IconButton></span>
          </Tooltip>
          <Tooltip title="Settings">
            <IconButton onClick={openSettings}><SettingsIcon /></IconButton>
          </Tooltip>
          <Tooltip title="Save .hmlcc">
            <span><IconButton color="primary" onClick={handleSave} disabled={isSaving}><SaveIcon /></IconButton></span>
          </Tooltip>
        </Box>
      </Box>

      {/* Hidden audio element drives follow-along; controlled by the Play button. */}
      {CAPTURE_FEATURES && audioUrl && (
        <audio
          ref={audioElRef}
          src={audioUrl}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => { setIsPlaying(false); setPlayhead(0); }}
          onTimeUpdate={(e) => setPlayhead(e.currentTarget.currentTime)}
        />
      )}

      {/* Playback / karaoke transport — shown when the composition has audio. */}
      {CAPTURE_FEATURES && audioUrl && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1, borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'action.hover' }}>
          <Tooltip title={isPlaying ? 'Pause' : 'Play'}>
            <IconButton size="small" color="primary" onClick={togglePlay}>
              {isPlaying ? <PauseIcon /> : <PlayArrowIcon />}
            </IconButton>
          </Tooltip>
          <Typography variant="caption" sx={{ fontVariantNumeric: 'tabular-nums', minWidth: 40 }}>
            {Math.floor(playhead / 60)}:{Math.floor(playhead % 60).toString().padStart(2, '0')}
          </Typography>
          <Slider
            size="small"
            min={0}
            max={audioElRef.current?.duration && isFinite(audioElRef.current.duration) ? audioElRef.current.duration : Math.max(1, playhead)}
            value={playhead}
            onChange={(_, v) => {
              const t = v as number;
              setPlayhead(t);
              if (audioElRef.current) audioElRef.current.currentTime = t;
            }}
            sx={{ mx: 1 }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
            Karaoke follow-along
          </Typography>
          <Tooltip title="Remove recording">
            <IconButton size="small" onClick={() => void removeAudio()}><DeleteIcon fontSize="small" /></IconButton>
          </Tooltip>
        </Box>
      )}

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
          <Typography variant="caption" color="text.secondary">({visibleBars} bars per page)</Typography>
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
            {Array.from({ length: visibleRows }, (_, rowIndex) => {
              const emptyBar = Array(chordsPerBar).fill('');
              const rowBeatChords = [0, 1, 2, 3]
                .map((colIndex) => barBeatChords[rowIndex * 4 + colIndex] || emptyBar)
                .flat();

              return (
                // Guaranteed gap below each row so a staff's low notes never
                // collide with the next row's lyrics.
                <Box
                  key={rowIndex}
                  ref={activeBar >= 0 && Math.floor(activeBar / 4) === rowIndex ? activeRowRef : undefined}
                  sx={{
                    mb: '12px',
                    // Follow-along: subtly highlight the row the playhead is in.
                    bgcolor: activeBar >= 0 && Math.floor(activeBar / 4) === rowIndex
                      ? 'rgba(25,118,210,0.06)' : 'transparent',
                    borderRadius: 1,
                    transition: 'background-color 120ms',
                  }}
                >
                  {/* Lyrics for the row — justified edge-to-edge to fill the line.
                      During playback the row's lyric sweeps left-to-right across
                      its 4-bar span (karaoke). */}
                  <LyricLine
                    value={barLyrics[rowIndex * 4] || ''}
                    width={CONTENT_WIDTH}
                    justify={lyricSpacing === 'stretch'}
                    progress={
                      activeBar >= 0 && Math.floor(activeBar / 4) === rowIndex
                        ? ((activeBar % 4) + barProgress) / 4
                        : undefined
                    }
                    onChange={(text) => handleLyricsChange(rowIndex * 4, text)}
                  />

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
                              <span style={{ fontSize: chordName ? 14 : 14, fontWeight: 'bold', color: chordName ? '#000' : '#1976d2' }}>
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
                      the next lyrics. Hidden (and its height reclaimed) when the
                      showStaff setting is off, leaving more room for 28 bars. */}
                  {showStaff && (
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
                        keySignature={currentComposition.globalSettings.key}
                        barTab={barTab}
                        rowStartBar={rowIndex * 4}
                      />
                    </Box>
                  )}
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
                {CHORDS_PER_BAR_OPTIONS.map((n) => (
                  <ToggleButton key={n} value={n}>{n}</ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 0.5 }}>
              <Box>
                <Typography variant="body2">Lyric spacing</Typography>
                <Typography variant="caption" color="text.secondary">
                  How words fill each line
                </Typography>
              </Box>
              <ToggleButtonGroup
                size="small"
                exclusive
                value={pendingLyricSpacing}
                onChange={(_, v) => v && setPendingLyricSpacing(v)}
              >
                <ToggleButton value="left">Left</ToggleButton>
                <ToggleButton value="stretch">Stretch</ToggleButton>
              </ToggleButtonGroup>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 0.5 }}>
              <Box>
                <Typography variant="body2">Staff notation</Typography>
                <Typography variant="caption" color="text.secondary">
                  Show the musical staff below each row
                </Typography>
              </Box>
              <Switch
                checked={pendingShowStaff}
                onChange={(e) => setPendingShowStaff(e.target.checked)}
              />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setPendingChordsPerBar(chordsPerBar); setPendingLyricSpacing(lyricSpacing); setPendingShowStaff(showStaff); setShowSettingsDialog(false); }}>Cancel</Button>
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

      <ImportTextDialog
        open={showImportDialog}
        onClose={() => setShowImportDialog(false)}
        defaultChordsPerBar={chordsPerBar}
        onImport={handleImportRequest}
      />

      {/* Capture dialogs hidden with the toolbar buttons (CAPTURE_FEATURES). */}
      {CAPTURE_FEATURES && (
        <>
          <ScanPhotoDialog
            open={showScanDialog}
            onClose={() => setShowScanDialog(false)}
            defaultChordsPerBar={chordsPerBar}
            onImport={handleImportRequest}
          />

          <RecordNoteDialog
            open={showRecordDialog}
            onClose={() => setShowRecordDialog(false)}
            hasTarget={noteTarget() !== null}
            onStart={beginNoteRecording}
            onNote={placeNextNote}
          />

          <RecordClipDialog
            open={showClipDialog}
            onClose={() => setShowClipDialog(false)}
            onSave={handleClipSaved}
            onAttachUrl={attachAudioUrl}
          />
        </>
      )}

      {/* Import overwrite confirmation */}
      <Dialog open={showImportConfirm} onClose={() => setShowImportConfirm(false)}>
        <DialogTitle>Replace current content?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Importing replaces the bars and lyrics in "{currentComposition.title || 'Untitled Song'}".
            This can't be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowImportConfirm(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => {
              setShowImportConfirm(false);
              if (pendingImport) {
                runImport(pendingImport.text, pendingImport.barsPerLine, pendingImport.chordsPerBar);
              }
            }}
          >
            Replace
          </Button>
        </DialogActions>
      </Dialog>

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
