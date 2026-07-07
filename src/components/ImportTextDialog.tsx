import React from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Typography, Box,
  ToggleButton, ToggleButtonGroup,
} from '@mui/material';

interface ImportTextDialogProps {
  open: boolean;
  onClose: () => void;
  /** The composition's current chords-per-bar, used to seed the selector. */
  defaultChordsPerBar?: number;
  onImport: (text: string, barsPerLine: number, chordsPerBar: number) => void;
}

const PLACEHOLDER = `Paste a song as chords over lyrics, e.g.

C                   Am
Lover, I know you're weary
        Dm         G
Eyes are tired from the night

[Chorus]
  Dm     G
So take from me`;

const ACCEPT = '.txt,.md,.markdown,.html,.htm,.crd,.cho,.chopro,.chordpro,text/plain,text/html';

const CHORDS_PER_BAR_OPTIONS = [1, 2, 3, 4, 6, 8];

/** Reduce dropped HTML to plain text, preserving line breaks from block tags. */
function htmlToText(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  // <br> and block boundaries become newlines; textContent handles the rest.
  doc.querySelectorAll('br').forEach((br) => br.replaceWith('\n'));
  doc.querySelectorAll('p, div, li, tr, h1, h2, h3, h4, h5, h6').forEach((el) => {
    el.append('\n');
  });
  return doc.body ? doc.body.textContent ?? '' : doc.textContent ?? '';
}

async function readFile(file: File): Promise<string> {
  const raw = await file.text();
  return /\.html?$/i.test(file.name) || raw.trimStart().startsWith('<')
    ? htmlToText(raw)
    : raw;
}

export const ImportTextDialog: React.FC<ImportTextDialogProps> = ({
  open, onClose, onImport, defaultChordsPerBar = 4,
}) => {
  const [text, setText] = React.useState('');
  const [dragOver, setDragOver] = React.useState(false);
  const [barsPerLine, setBarsPerLine] = React.useState(2);
  const [chordsPerBar, setChordsPerBar] = React.useState(defaultChordsPerBar);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (open) { setText(''); setChordsPerBar(defaultChordsPerBar); }
  }, [open, defaultChordsPerBar]);

  const loadFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setText(await readFile(files[0]));
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Import from text</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Paste lyrics with chord lines above them, or drop a file below. Chords
          fill each line's bars; [Section] labels prefix the line. Unknown chords
          map to the closest available chord.
        </Typography>
        <Box
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            void loadFiles(e.dataTransfer.files);
          }}
          sx={{
            border: '2px dashed',
            borderColor: dragOver ? 'primary.main' : 'divider',
            borderRadius: 1,
            bgcolor: dragOver ? 'action.hover' : 'transparent',
            p: 1,
            transition: 'background-color 120ms, border-color 120ms',
          }}
        >
          <TextField
            multiline
            minRows={12}
            fullWidth
            autoFocus
            placeholder={PLACEHOLDER}
            value={text}
            onChange={(e) => setText(e.target.value)}
            variant="standard"
            slotProps={{
              input: { disableUnderline: true, sx: { fontFamily: 'monospace', fontSize: 13 } },
            }}
          />
        </Box>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT}
          style={{ display: 'none' }}
          onChange={(e) => { void loadFiles(e.target.files); e.target.value = ''; }}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mr: 'auto' }}>
          <Typography variant="body2" color="text.secondary">Bars/line</Typography>
          {/* How many bars each pasted line occupies; lines pack together. */}
          <ToggleButtonGroup
            size="small"
            exclusive
            value={barsPerLine}
            onChange={(_, v) => v && setBarsPerLine(v)}
          >
            <ToggleButton value={1}>1</ToggleButton>
            <ToggleButton value={2}>2</ToggleButton>
            <ToggleButton value={4}>4</ToggleButton>
          </ToggleButtonGroup>
          <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>Chords/bar</Typography>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={chordsPerBar}
            onChange={(_, v) => v && setChordsPerBar(v)}
          >
            {CHORDS_PER_BAR_OPTIONS.map((n) => (
              <ToggleButton key={n} value={n}>{n}</ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>
        <Button onClick={() => fileInputRef.current?.click()}>Choose file…</Button>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          disabled={!text.trim()}
          onClick={() => onImport(text, barsPerLine, chordsPerBar)}
        >
          Import
        </Button>
      </DialogActions>
    </Dialog>
  );
};
