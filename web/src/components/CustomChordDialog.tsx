import React from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Typography, Box,
} from '@mui/material';
import { ChordDiagram, type ChordData } from './ChordDiagram';

interface CustomChordDialogProps {
  open: boolean;
  onClose: () => void;
  /** Existing chord names (catalog + custom) — used to block duplicates. */
  existingNames: string[];
  onSave: (chord: ChordData) => void;
}

// Per-string state: open, muted, or an absolute fret number.
type StringState = 'open' | 'muted' | number;

// Strings low→high [E A D G B e]; labels shown left→right to match the diagram.
const STRING_LABELS = ['E', 'A', 'D', 'G', 'B', 'e'];
const FRETS_SHOWN = 5;

/** Build a ChordData from the grid state + metadata. */
function toChordData(
  name: string,
  startingFret: number,
  strings: StringState[],
  notes: string,
): ChordData {
  const fingering = strings.map((s) => (s === 'muted' ? 'x' : s === 'open' ? '0' : String(s)));
  const openStrings = strings.map((s, i) => (s === 'open' ? i : -1)).filter((i) => i >= 0);
  const mutedStrings = strings.map((s, i) => (s === 'muted' ? i : -1)).filter((i) => i >= 0);
  return {
    name: name.trim(),
    startingFret,
    fingering,
    openStrings,
    mutedStrings,
    commonFingeringNotes: notes.trim(),
  };
}

export const CustomChordDialog: React.FC<CustomChordDialogProps> = ({
  open, onClose, existingNames, onSave,
}) => {
  const [name, setName] = React.useState('');
  const [startingFret, setStartingFret] = React.useState(1);
  const [notes, setNotes] = React.useState('');
  // Default: all strings muted until the user places something.
  const [strings, setStrings] = React.useState<StringState[]>(() => Array(6).fill('muted'));

  React.useEffect(() => {
    if (open) {
      setName(''); setStartingFret(1); setNotes('');
      setStrings(Array(6).fill('muted'));
    }
  }, [open]);

  // Clicking a fret cell toggles that string to that absolute fret (click the
  // same cell again to clear back to muted).
  const setFret = (stringIndex: number, fret: number) => {
    setStrings((prev) => {
      const next = [...prev];
      next[stringIndex] = prev[stringIndex] === fret ? 'muted' : fret;
      return next;
    });
  };

  // The open/muted indicator above each string cycles open → muted → open.
  const toggleTop = (stringIndex: number) => {
    setStrings((prev) => {
      const next = [...prev];
      next[stringIndex] = prev[stringIndex] === 'open' ? 'muted' : 'open';
      return next;
    });
  };

  const draft = toChordData(name || 'New', startingFret, strings, notes);

  const trimmed = name.trim();
  const duplicate = trimmed !== '' &&
    existingNames.some((n) => n.toLowerCase() === trimmed.toLowerCase());
  const canSave = trimmed !== '' && !duplicate;

  // Fret rows show absolute frets startingFret..startingFret+FRETS_SHOWN-1.
  const fretRows = Array.from({ length: FRETS_SHOWN }, (_, r) => startingFret + r);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add custom chord</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', gap: 3, mt: 1, flexWrap: 'wrap' }}>
          {/* Left: metadata + interactive fretboard */}
          <Box sx={{ flex: 1, minWidth: 240 }}>
            <TextField
              label="Chord name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              size="small"
              fullWidth
              autoFocus
              error={duplicate}
              helperText={duplicate ? 'That name already exists — choose a unique name' : ' '}
              placeholder="e.g. Cadd9, Gsus4"
            />
            <TextField
              label="Starting fret"
              type="number"
              value={startingFret}
              onChange={(e) => setStartingFret(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
              size="small"
              sx={{ mt: 1, width: 130 }}
              inputProps={{ min: 1, max: 20 }}
            />

            {/* Interactive fretboard grid */}
            <Box sx={{ mt: 2 }}>
              {/* Open/muted indicator row */}
              <Box sx={{ display: 'flex', ml: '28px' }}>
                {STRING_LABELS.map((label, s) => (
                  <Box key={s} sx={{ width: 32, textAlign: 'center' }}>
                    <Box
                      onClick={() => toggleTop(s)}
                      sx={{
                        cursor: 'pointer', fontSize: 14, fontWeight: 700, height: 20,
                        color: strings[s] === 'open' ? 'success.main' : strings[s] === 'muted' ? 'error.main' : 'text.disabled',
                      }}
                    >
                      {strings[s] === 'open' ? 'o' : strings[s] === 'muted' ? '×' : ''}
                    </Box>
                    <Typography variant="caption" color="text.secondary">{label}</Typography>
                  </Box>
                ))}
              </Box>

              {/* Fret rows */}
              <Box sx={{ mt: 0.5 }}>
                {fretRows.map((absFret, r) => (
                  <Box key={absFret} sx={{ display: 'flex', alignItems: 'center' }}>
                    <Box sx={{ width: 28, textAlign: 'right', pr: 0.5, fontSize: 11, color: 'text.secondary' }}>
                      {absFret}
                    </Box>
                    {STRING_LABELS.map((_, s) => {
                      const active = strings[s] === absFret;
                      return (
                        <Box
                          key={s}
                          onClick={() => setFret(s, absFret)}
                          sx={{
                            width: 32, height: 32, cursor: 'pointer',
                            borderTop: r === 0 ? '2px solid' : '1px solid',
                            borderColor: 'text.primary',
                            borderRight: s === STRING_LABELS.length - 1 ? '1px solid' : 'none',
                            borderLeft: '1px solid',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            bgcolor: 'transparent',
                            '&:hover': { bgcolor: 'action.hover' },
                          }}
                        >
                          {active && (
                            <Box sx={{ width: 18, height: 18, borderRadius: '50%', bgcolor: 'text.primary' }} />
                          )}
                        </Box>
                      );
                    })}
                  </Box>
                ))}
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                Click a cell to place a finger; click the o/× above a string to toggle open/muted.
              </Typography>
            </Box>

            <TextField
              label="How to play (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              size="small"
              fullWidth
              multiline
              minRows={2}
              sx={{ mt: 2 }}
              placeholder="Fingering tips, e.g. 'ring finger on 3rd fret'"
            />
          </Box>

          {/* Right: live preview — hugs the fixed-size diagram. */}
          <Box sx={{ flexShrink: 0, alignSelf: 'flex-start' }}>
            <Typography variant="overline" color="text.secondary">Preview</Typography>
            <Box sx={{ width: 'fit-content' }}>
              <ChordDiagram chord={draft} />
            </Box>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          disabled={!canSave}
          onClick={() => onSave(toChordData(name, startingFret, strings, notes))}
        >
          Save chord
        </Button>
      </DialogActions>
    </Dialog>
  );
};
