import React from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Box, Stack,
} from '@mui/material';
import MicIcon from '@mui/icons-material/Mic';
import StopIcon from '@mui/icons-material/Stop';
import { autoCorrelate, freqToNoteName } from '../utils/pitchDetect';

interface RecordNoteDialogProps {
  open: boolean;
  onClose: () => void;
  /** True when there's somewhere to place notes (selection or an empty bar). */
  hasTarget: boolean;
  /** Called when a recording pass begins, so the caller can seed its cursor. */
  onStart: () => void;
  /** Called once per newly-detected note as the player plays. */
  onNote: (noteName: string) => void;
}

// A note must hold steady across this many frames before it's committed.
const STABLE_FRAMES = 6;
// Stop the pass after this much continuous silence (no detected pitch).
const SILENCE_STOP_MS = 1500;

export const RecordNoteDialog: React.FC<RecordNoteDialogProps> = ({
  open, onClose, hasTarget, onStart, onNote,
}) => {
  const [recording, setRecording] = React.useState(false);
  const [liveNote, setLiveNote] = React.useState('');
  const [count, setCount] = React.useState(0);
  const [lastNote, setLastNote] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  const ctxRef = React.useRef<AudioContext | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const rafRef = React.useRef<number | null>(null);
  // Debounce run of the current candidate note + whether it's been committed.
  const runRef = React.useRef<{ note: string; frames: number; committed: boolean }>(
    { note: '', frames: 0, committed: false },
  );
  const silenceSinceRef = React.useRef<number>(0);
  const onNoteRef = React.useRef(onNote);
  onNoteRef.current = onNote;

  const stop = React.useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    void ctxRef.current?.close();
    ctxRef.current = null;
    setRecording(false);
    setLiveNote('');
  }, []);

  // Tear everything down when the dialog closes; keep it open otherwise (the
  // user can Start another pass without reopening).
  React.useEffect(() => {
    if (!open) {
      stop();
      setLastNote(''); setCount(0); setError(null);
      runRef.current = { note: '', frames: 0, committed: false };
    }
  }, [open, stop]);

  React.useEffect(() => () => stop(), [stop]);

  const start = async () => {
    setError(null);
    runRef.current = { note: '', frames: 0, committed: false };
    silenceSinceRef.current = performance.now();
    onStart();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const ctx = new AudioContext();
      ctxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      const buffer = new Float32Array(analyser.fftSize);
      setRecording(true);

      const tick = () => {
        analyser.getFloatTimeDomainData(buffer);
        const freq = autoCorrelate(buffer, ctx.sampleRate);
        const note = freq > 0 ? freqToNoteName(freq) : '';
        setLiveNote(note);

        const now = performance.now();
        if (note) {
          silenceSinceRef.current = now;
          const run = runRef.current;
          if (note === run.note) {
            run.frames++;
            // Commit once stable; a fresh onset (silence gap) re-arms below.
            if (run.frames === STABLE_FRAMES && !run.committed) {
              run.committed = true;
              setLastNote(note);
              setCount((c) => c + 1);
              onNoteRef.current(note);
            }
          } else {
            runRef.current = { note, frames: 1, committed: false };
          }
        } else {
          // Silence: reset the candidate so the next note is a new onset, and
          // auto-stop after a sustained gap ("until we detect no notes").
          runRef.current = { note: '', frames: 0, committed: false };
          if (now - silenceSinceRef.current > SILENCE_STOP_MS) { stop(); return; }
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch (e) {
      setError(
        e instanceof Error && e.name === 'NotAllowedError'
          ? 'Microphone permission was denied.'
          : 'Could not access the microphone.'
      );
      stop();
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Record notes</DialogTitle>
      <DialogContent>
        {!hasTarget ? (
          <Typography variant="body2" color="warning.main" sx={{ mb: 1 }}>
            The page is full — select a chord/tab cell to place notes.
          </Typography>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Press Start and play. Each note fills the next slot, beginning at the
            selected cell (or the first empty bar). Recording stops after a short
            silence — press Start to record another pass.
          </Typography>
        )}
        <Stack alignItems="center" spacing={1} sx={{ py: 2 }}>
          <Box
            sx={{
              width: 64, height: 64, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              bgcolor: recording ? 'error.main' : 'action.disabledBackground',
              color: recording ? 'error.contrastText' : 'text.disabled',
              transition: 'background-color 150ms',
            }}
          >
            <MicIcon fontSize="large" />
          </Box>
          <Typography variant="h3" sx={{ fontVariantNumeric: 'tabular-nums', minHeight: 56 }}>
            {liveNote || lastNote || '—'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {recording ? `Listening… ${count} note(s) captured` : count ? `${count} note(s) captured` : 'Ready'}
          </Typography>
        </Stack>
        {error && <Typography variant="body2" color="error">{error}</Typography>}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ mr: 'auto' }}>Close</Button>
        {recording
          ? <Button variant="contained" color="error" onClick={stop} startIcon={<StopIcon />}>Stop</Button>
          : <Button variant="contained" disabled={!hasTarget} onClick={() => void start()} startIcon={<MicIcon />}>Start</Button>}
      </DialogActions>
    </Dialog>
  );
};
