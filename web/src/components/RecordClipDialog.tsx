import React from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Box, Stack,
  Divider, TextField,
} from '@mui/material';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import StopIcon from '@mui/icons-material/Stop';

interface RecordClipDialogProps {
  open: boolean;
  onClose: () => void;
  /** Receives the finished recording; the caller persists and wires playback. */
  onSave: (blob: Blob, durationSec: number) => void;
  /** Attach an audio URL instead of recording (played directly from the link). */
  onAttachUrl: (url: string) => void;
}

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export const RecordClipDialog: React.FC<RecordClipDialogProps> = ({ open, onClose, onSave, onAttachUrl }) => {
  const [recording, setRecording] = React.useState(false);
  const [elapsed, setElapsed] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const [urlInput, setUrlInput] = React.useState('');

  const recorderRef = React.useRef<MediaRecorder | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);
  const startRef = React.useRef(0);
  const timerRef = React.useRef<number | null>(null);

  const cleanup = React.useCallback(() => {
    if (timerRef.current != null) window.clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
    setRecording(false);
  }, []);

  React.useEffect(() => {
    if (!open) { cleanup(); setElapsed(0); setError(null); setUrlInput(''); chunksRef.current = []; }
  }, [open, cleanup]);

  React.useEffect(() => () => cleanup(), [cleanup]);

  const start = async () => {
    setError(null); setElapsed(0); chunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      recorder.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const durationSec = (Date.now() - startRef.current) / 1000;
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        cleanup();
        if (blob.size) onSave(blob, durationSec);
      };
      startRef.current = Date.now();
      recorder.start();
      setRecording(true);
      timerRef.current = window.setInterval(
        () => setElapsed((Date.now() - startRef.current) / 1000),
        200,
      );
    } catch (e) {
      setError(
        e instanceof Error && e.name === 'NotAllowedError'
          ? 'Microphone permission was denied.'
          : 'Could not access the microphone.'
      );
      cleanup();
    }
  };

  const stop = () => recorderRef.current?.stop();

  return (
    <Dialog open={open} onClose={recording ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Record audio</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Record a take to play back and follow along with the composition. Play
          at the composition's tempo so the follow-along lines up.
        </Typography>
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
            <FiberManualRecordIcon fontSize="large" />
          </Box>
          <Typography variant="h4" sx={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(elapsed)}</Typography>
          <Typography variant="caption" color="text.secondary">
            {recording ? 'Recording…' : 'Ready'}
          </Typography>
        </Stack>
        {error && <Typography variant="body2" color="error">{error}</Typography>}

        <Divider sx={{ my: 2 }}>or</Divider>
        <Stack direction="row" spacing={1}>
          <TextField
            size="small"
            fullWidth
            label="Audio URL"
            placeholder="https://…/take.mp3"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            disabled={recording}
          />
          <Button
            onClick={() => { onAttachUrl(urlInput.trim()); onClose(); }}
            disabled={recording || !urlInput.trim()}
          >
            Use link
          </Button>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={recording} sx={{ mr: 'auto' }}>Cancel</Button>
        {recording
          ? <Button variant="contained" color="error" onClick={stop} startIcon={<StopIcon />}>Stop &amp; save</Button>
          : <Button variant="contained" onClick={() => void start()} startIcon={<FiberManualRecordIcon />}>Record</Button>}
      </DialogActions>
    </Dialog>
  );
};
