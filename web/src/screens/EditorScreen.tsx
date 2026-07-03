import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Button, IconButton, Tooltip, Typography, TextField, Dialog, DialogTitle,
  DialogContent, DialogContentText, DialogActions, InputAdornment, Snackbar,
  ToggleButton, ToggleButtonGroup, MenuItem,
} from '@mui/material';
import PrintIcon from '@mui/icons-material/Print';
import SettingsIcon from '@mui/icons-material/Settings';
import SaveIcon from '@mui/icons-material/Save';
import SearchIcon from '@mui/icons-material/Search';
import NoteAddIcon from '@mui/icons-material/NoteAdd';
import { useCompositionStore } from '../store/compositionStore';
import { ALTERNATE_TUNINGS } from '../models/Note';
import { CompositionStorageService } from '../services/compositionService';
import { PrintService, PrintOptions } from '../services/printService';
import { PrintDialog } from '../components/PrintDialog';
import { StaffNotes } from '../components/StaffNotes';
import { Tablature } from '../components/Tablature';
import { ChordDiagram, MiniChordDiagram, ChordData } from '../components/ChordDiagram';
import { shortChordName } from '../utils/chordName';
import chordsDataJson from '../data/chords.json';

interface PageState {
  barLyrics: string[];
  barBeatChords: string[][];
}

const emptyPage = (slots = 4): PageState => ({
  barLyrics: Array(16).fill(''),
  barBeatChords: Array(16).fill(null).map(() => Array(slots).fill('')),
});

// Fixed paper dimensions: 1000px = 8.5", 1100px = 11" (100px per inch)
const PAPER_WIDTH = 1000;
const PAPER_HEIGHT = 1100;
const PAPER_MARGIN = 50;
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

const totalMeasureWidth = CONTENT_WIDTH - 20;
const firstMeasureWidth = totalMeasureWidth / 4 + 40;
const otherMeasureWidth = (totalMeasureWidth - firstMeasureWidth) / 3;

// Clef + time-signature space reserved at the start of measure 1. Must match
// CLEF_RESERVE in Tablature.tsx and the clef width in StaffNotes so the chord
// boxes, tab fret numbers, and staff notes all line up vertically.
const CLEF_RESERVE = 40;

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

  const chordsPerBar = currentComposition?.globalSettings.chordsPerBar || 4;

  const barLyrics = allPages[currentPage]?.barLyrics || Array(16).fill('');
  const barBeatChords = allPages[currentPage]?.barBeatChords || Array(16).fill(null).map(() => Array(chordsPerBar).fill(''));

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

  const handleBeatChordChange = (barIndex: number, beatIndex: number, chord: string) => {
    const newChords = barBeatChords.map((row) => [...row]);
    newChords[barIndex][beatIndex] = chord;
    setBarBeatChords(newChords);
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

  // Unique chords across all pages, for the reference strip.
  const usedChordNames = new Set<string>();
  allPages.forEach((page) => {
    page.barBeatChords.forEach((bar) => {
      bar.forEach((chord) => {
        if (chord) usedChordNames.add(chord);
      });
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
            border: '1px solid #ccc', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', my: 2,
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

          {currentPage === 0 && uniqueChords.length > 0 && (
            <Box sx={{ px: 2, py: 1.5, display: 'flex', gap: 1.5, overflowX: 'auto' }}>
              {uniqueChords.map((chord, index) => (
                <MiniChordDiagram key={index} chord={chord} background={PAPER_COLOR} />
              ))}
            </Box>
          )}

          <Box sx={{ width: CONTENT_WIDTH, mx: `${PAPER_MARGIN}px`, py: 3 }}>
            {[0, 1, 2, 3].map((rowIndex) => {
              const emptyBar = Array(chordsPerBar).fill('');
              const rowBeatChords = [0, 1, 2, 3]
                .map((colIndex) => barBeatChords[rowIndex * 4 + colIndex] || emptyBar)
                .flat();

              return (
                <Box key={rowIndex} sx={{ mb: 3 }}>
                  {/* Lyrics for the row */}
                  <Tooltip title="click here to add lyrics!" placement="top-start">
                    <input
                      style={{ width: CONTENT_WIDTH, background: 'transparent', border: 'none', outline: 'none', padding: '2px 0', marginTop: 8, marginBottom: 8, minHeight: 30, fontSize: 18, color: '#333' }}
                      value={barLyrics[rowIndex * 4] || ''}
                      onChange={(e) => handleLyricsChange(rowIndex * 4, e.target.value)}
                    />
                  </Tooltip>

                  {/* Chord boxes — 10px left offset matches the tab/staff internal
                      start x so chord names sit over their beats. */}
                  <Box sx={{ display: 'flex', flexDirection: 'row', mb: '5px', pl: '10px' }}>
                    {[0, 1, 2, 3].map((colIndex) => {
                      const barIndex = rowIndex * 4 + colIndex;
                      const barWidth = colIndex === 0 ? firstMeasureWidth : otherMeasureWidth;
                      // Measure 1 reserves clef/time-sig space so its chord names
                      // line up with the tab/staff, which do the same.
                      const reserve = colIndex === 0 ? CLEF_RESERVE : 0;
                      const beatWidth = (barWidth - reserve) / chordsPerBar;
                      const barSlots = barBeatChords[barIndex] || emptyBar;
                      return (
                        <Box key={colIndex} sx={{ width: barWidth }}>
                          <Box sx={{ display: 'flex', flexDirection: 'row' }}>
                            {reserve > 0 && <Box sx={{ width: reserve, flexShrink: 0 }} />}
                            {Array.from({ length: chordsPerBar }, (_, beatIndex) => {
                              const chordName = barSlots[beatIndex] || '';
                              const chord = chordName ? chordsData.find((c) => c.name === chordName) : undefined;
                              const label = chordName ? shortChordName(chordName, chord?.startingFret) : '+';
                              return (
                                <Tooltip key={beatIndex} title={!chordName ? 'click to add chord' : chordName}>
                                  <button
                                    onClick={() => openChordSelector(barIndex, beatIndex)}
                                    style={{
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
                            })}
                          </Box>
                        </Box>
                      );
                    })}
                  </Box>

                  {/* Tablature — vertical padding only; horizontal padding would
                      push the 900px-wide notation past the content edge. */}
                  <Box sx={{ py: '4px', bgcolor: PAPER_COLOR, position: 'relative', overflow: 'hidden' }}>
                    <Tablature beatChords={rowBeatChords} chordsData={chordsData} width={CONTENT_WIDTH} height={65} numMeasures={4} beatsPerBar={chordsPerBar} paperColor={PAPER_COLOR} />
                  </Box>

                  <Box sx={{ height: 2 }} />

                  {/* Staff */}
                  <Box sx={{ py: '4px', bgcolor: PAPER_COLOR, height: 160, position: 'relative', overflow: 'hidden' }}>
                    <StaffNotes
                      beatChords={rowBeatChords}
                      width={CONTENT_WIDTH}
                      height={85}
                      numMeasures={4}
                      beatsPerBar={chordsPerBar}
                      tsBeats={currentComposition.globalSettings.timeSignature.beats}
                      tsBeatValue={currentComposition.globalSettings.timeSignature.beatValue}
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

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ open: false, message: '' })}
        message={snackbar.message}
      />
    </Box>
  );
};
