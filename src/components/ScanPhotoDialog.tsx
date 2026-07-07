import React from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Typography, Box,
  ToggleButton, ToggleButtonGroup, LinearProgress, Stack,
} from '@mui/material';

interface ScanPhotoDialogProps {
  open: boolean;
  onClose: () => void;
  /** The composition's current chords-per-bar, used to seed the selector. */
  defaultChordsPerBar?: number;
  /** Same contract as ImportTextDialog: recognized text is imported the same way. */
  onImport: (text: string, barsPerLine: number, chordsPerBar: number) => void;
}

const CHORDS_PER_BAR_OPTIONS = [1, 2, 3, 4, 6, 8];

/**
 * Load an image from a user-provided source. A local File is used directly;
 * a URL is fetched (best-effort — subject to the remote server's CORS policy)
 * and turned into a Blob so Tesseract can read it. If the URL points at plain
 * text (e.g. a chords .txt link) we return that text and skip OCR entirely.
 */
type ScanSource =
  | { kind: 'image'; blob: Blob }
  | { kind: 'text'; text: string };

async function fetchSource(url: string): Promise<ScanSource> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed (${res.status})`);
  const type = res.headers.get('content-type') ?? '';
  if (type.startsWith('text/') || /\.(txt|md|crd|cho|chopro)(\?|$)/i.test(url)) {
    return { kind: 'text', text: await res.text() };
  }
  return { kind: 'image', blob: await res.blob() };
}

export const ScanPhotoDialog: React.FC<ScanPhotoDialogProps> = ({
  open, onClose, onImport, defaultChordsPerBar = 4,
}) => {
  const [text, setText] = React.useState('');
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [urlInput, setUrlInput] = React.useState('');
  const [dragOver, setDragOver] = React.useState(false);
  const [barsPerLine, setBarsPerLine] = React.useState(2);
  const [chordsPerBar, setChordsPerBar] = React.useState(defaultChordsPerBar);
  const [busy, setBusy] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (open) {
      setText(''); setUrlInput(''); setError(null); setProgress(0);
      setChordsPerBar(defaultChordsPerBar);
    }
  }, [open, defaultChordsPerBar]);

  // Revoke the object URL when the preview changes or the dialog closes.
  React.useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const setPreview = (blob: Blob) => {
    setPreviewUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(blob); });
  };

  /** Run Tesseract on an image blob and drop the recognized text into the editor. */
  const runOcr = async (blob: Blob) => {
    setBusy(true); setError(null); setProgress(0);
    try {
      // Dynamic import keeps the WASM worker out of the initial bundle.
      const { recognize } = await import('tesseract.js');
      const { data } = await recognize(blob, 'eng', {
        logger: (m: { status: string; progress: number }) => {
          if (m.status === 'recognizing text') setProgress(Math.round(m.progress * 100));
        },
      });
      setText(data.text.trimEnd());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'OCR failed');
    } finally {
      setBusy(false);
    }
  };

  const handleImageBlob = (blob: Blob) => { setPreview(blob); void runOcr(blob); };

  const loadFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    handleImageBlob(files[0]);
  };

  const loadUrl = async () => {
    const url = urlInput.trim();
    if (!url) return;
    setBusy(true); setError(null);
    try {
      const src = await fetchSource(url);
      if (src.kind === 'text') {
        setPreviewUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return null; });
        setText(src.text.trimEnd());
        setBusy(false);
      } else {
        handleImageBlob(src.blob);
      }
    } catch (e) {
      setError(
        (e instanceof Error ? e.message : 'Could not load link') +
        ' — the site may block cross-origin access. Try downloading the image and choosing the file.'
      );
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Scan a photo</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Take or upload a photo of a chords-over-lyrics sheet, or paste a link to
          an image or text. Text is recognized on-device; review and fix it below,
          then import it the same way as a text file.
        </Typography>

        <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
          <TextField
            size="small"
            fullWidth
            placeholder="Paste an image or text URL…"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void loadUrl(); }}
            disabled={busy}
          />
          <Button onClick={() => void loadUrl()} disabled={busy || !urlInput.trim()}>Load</Button>
        </Stack>

        <Box
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); loadFiles(e.dataTransfer.files); }}
          sx={{
            border: '2px dashed',
            borderColor: dragOver ? 'primary.main' : 'divider',
            borderRadius: 1,
            bgcolor: dragOver ? 'action.hover' : 'transparent',
            p: 1,
            transition: 'background-color 120ms, border-color 120ms',
          }}
        >
          {previewUrl && (
            <Box
              component="img"
              src={previewUrl}
              alt="Scan preview"
              sx={{ maxWidth: '100%', maxHeight: 180, display: 'block', mx: 'auto', mb: 1, borderRadius: 1 }}
            />
          )}
          {busy && <LinearProgress variant={progress ? 'determinate' : 'indeterminate'} value={progress} sx={{ mb: 1 }} />}
          <TextField
            multiline
            minRows={8}
            fullWidth
            placeholder="Recognized text appears here — edit as needed."
            value={text}
            onChange={(e) => setText(e.target.value)}
            variant="standard"
            slotProps={{
              input: { disableUnderline: true, sx: { fontFamily: 'monospace', fontSize: 13 } },
            }}
          />
        </Box>
        {error && (
          <Typography variant="body2" color="error" sx={{ mt: 1 }}>{error}</Typography>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: 'none' }}
          onChange={(e) => { loadFiles(e.target.files); e.target.value = ''; }}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mr: 'auto' }}>
          <Typography variant="body2" color="text.secondary">Bars/line</Typography>
          <ToggleButtonGroup size="small" exclusive value={barsPerLine} onChange={(_, v) => v && setBarsPerLine(v)}>
            <ToggleButton value={1}>1</ToggleButton>
            <ToggleButton value={2}>2</ToggleButton>
            <ToggleButton value={4}>4</ToggleButton>
          </ToggleButtonGroup>
          <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>Chords/bar</Typography>
          <ToggleButtonGroup size="small" exclusive value={chordsPerBar} onChange={(_, v) => v && setChordsPerBar(v)}>
            {CHORDS_PER_BAR_OPTIONS.map((n) => (
              <ToggleButton key={n} value={n}>{n}</ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>
        <Button onClick={() => fileInputRef.current?.click()} disabled={busy}>Take / choose photo…</Button>
        <Button onClick={onClose} disabled={busy}>Cancel</Button>
        <Button
          variant="contained"
          disabled={busy || !text.trim()}
          onClick={() => onImport(text, barsPerLine, chordsPerBar)}
        >
          Import
        </Button>
      </DialogActions>
    </Dialog>
  );
};
