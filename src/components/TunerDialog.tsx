import React from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Box, ButtonBase,
  TextField, MenuItem,
} from '@mui/material';
import { playNoteTone, stopTone } from '../services/tunerTone';
import type { GuitarTuning } from '../models/Note';

interface TunerDialogProps {
  open: boolean;
  onClose: () => void;
  /** Tuning notes low→high, e.g. ["E2","A2","D3","G3","B3","E4"]. */
  tuningNotes: string[];
  /** Tuning name for the header, e.g. "Standard" or "Drop D". */
  tuningName: string;
  /** Preset tunings to offer in the in-modal selector. */
  presets: GuitarTuning[];
  /** Apply a chosen preset tuning immediately (persisted by the caller). */
  onApplyTuning: (tuning: GuitarTuning) => void;
}

/** Strip the octave digit(s) so "E2" → "E". */
const pitchClass = (note: string): string => note.replace(/\d+$/, '');

/**
 * A reference-tone tuner: one rectangle per string, ordered low E → high e
 * (the tuning array as stored, left-to-right). Clicking a rectangle plays that
 * string's note out loud so the player tunes their guitar to match by ear.
 * It only plays tones — no microphone, no recording.
 */
export const TunerDialog: React.FC<TunerDialogProps> = ({
  open, onClose, tuningNotes, tuningName, presets, onApplyTuning,
}) => {
  // Index of the string whose tone is currently sounding, or null.
  const [activeIndex, setActiveIndex] = React.useState<number | null>(null);
  const stopRef = React.useRef<(() => void) | null>(null);

  const stop = React.useCallback(() => {
    stopRef.current?.();
    stopRef.current = null;
    stopTone();
    setActiveIndex(null);
  }, []);

  // Stop any tone when the dialog closes or unmounts.
  React.useEffect(() => { if (!open) stop(); }, [open, stop]);
  React.useEffect(() => () => stop(), [stop]);

  const playString = (index: number, note: string) => {
    stop();
    const stopFn = playNoteTone(note);
    if (!stopFn) return;
    stopRef.current = stopFn;
    setActiveIndex(index);
    // Clear the highlight when the tone finishes on its own.
    window.setTimeout(() => {
      setActiveIndex((cur) => (cur === index ? null : cur));
    }, 2000);
  };

  // The dropdown shows the matching preset, or a "Custom" entry when the
  // current tuning isn't one of the presets.
  const matchingPreset = presets.find((t) => t.name === tuningName);
  const CUSTOM_VALUE = '__custom__';

  const handleSelect = (value: string) => {
    if (value === CUSTOM_VALUE) return; // Custom is display-only here.
    const preset = presets.find((t) => t.name === value);
    if (preset) {
      stop();
      onApplyTuning({ name: preset.name, notes: [...preset.notes] });
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Tuner — {tuningName}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Click a string to hear its note, then tune your guitar to match.
        </Typography>
        <TextField
          select
          label="Tuning"
          size="small"
          fullWidth
          value={matchingPreset ? matchingPreset.name : CUSTOM_VALUE}
          onChange={(e) => handleSelect(e.target.value)}
          helperText="Change the tuning here — it updates the composition's setting."
          sx={{ mb: 2 }}
        >
          {presets.map((t) => (
            <MenuItem key={t.name} value={t.name}>
              {t.name} ({t.notes.map(pitchClass).join(' ')})
            </MenuItem>
          ))}
          {!matchingPreset && (
            <MenuItem value={CUSTOM_VALUE} disabled>
              Custom ({tuningNotes.map(pitchClass).join(' ')})
            </MenuItem>
          )}
        </TextField>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'center' }}>
          {tuningNotes.map((note, index) => {
            const activeString = activeIndex === index;
            return (
              <ButtonBase
                key={`${index}-${note}`}
                onClick={() => playString(index, note)}
                sx={{
                  flex: '1 1 0',
                  minWidth: 64,
                  height: 96,
                  borderRadius: 1.5,
                  border: '2px solid',
                  borderColor: activeString ? 'primary.main' : 'divider',
                  bgcolor: activeString ? 'primary.main' : 'background.paper',
                  color: activeString ? 'primary.contrastText' : 'text.primary',
                  flexDirection: 'column',
                  transition: 'background-color 120ms, border-color 120ms',
                }}
              >
                <Typography variant="h4" component="span" sx={{ fontWeight: 'bold', lineHeight: 1 }}>
                  {pitchClass(note)}
                </Typography>
                <Typography variant="caption" component="span" sx={{ opacity: 0.7, mt: 0.5 }}>
                  {note}
                </Typography>
              </ButtonBase>
            );
          })}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};
