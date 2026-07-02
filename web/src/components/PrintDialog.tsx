import React from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Checkbox,
  FormControlLabel, FormControl, FormLabel, RadioGroup, Radio, Typography,
  Divider, Box,
} from '@mui/material';
import type { PrintOptions } from '../services/printService';

interface PrintDialogProps {
  open: boolean;
  onClose: () => void;
  onPrint: (options: PrintOptions) => void;
}

export const PrintDialog: React.FC<PrintDialogProps> = ({ open, onClose, onPrint }) => {
  const [includeChordDiagrams, setIncludeChordDiagrams] = React.useState(true);
  const [includeTablature, setIncludeTablature] = React.useState(true);
  const [includeNotation, setIncludeNotation] = React.useState(true);
  const [pageSize, setPageSize] = React.useState<'letter' | 'a4'>('letter');
  const [orientation, setOrientation] = React.useState<'portrait' | 'landscape'>('portrait');

  const selectedCount = [includeChordDiagrams, includeTablature, includeNotation].filter(Boolean).length;

  const handlePrint = () => {
    onPrint({
      includeChordDiagrams,
      includeTablature,
      includeNotation,
      pageSize,
      orientation,
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>🖨️ Print Options</DialogTitle>
      <DialogContent>
        <Typography variant="subtitle2" sx={{ mt: 1 }}>
          📄 Include ({selectedCount} of 3 selected)
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', ml: 1 }}>
          <FormControlLabel
            control={<Checkbox checked={includeChordDiagrams} onChange={(e) => setIncludeChordDiagrams(e.target.checked)} />}
            label="Chord Diagrams"
          />
          <FormControlLabel
            control={<Checkbox checked={includeTablature} onChange={(e) => setIncludeTablature(e.target.checked)} />}
            label="Tablature"
          />
          <FormControlLabel
            control={<Checkbox checked={includeNotation} onChange={(e) => setIncludeNotation(e.target.checked)} />}
            label="Staff Notation"
          />
        </Box>

        <Divider sx={{ my: 1 }} />

        <FormControl>
          <FormLabel>Paper Size</FormLabel>
          <RadioGroup row value={pageSize} onChange={(e) => setPageSize(e.target.value as 'letter' | 'a4')}>
            <FormControlLabel value="letter" control={<Radio />} label="Letter" />
            <FormControlLabel value="a4" control={<Radio />} label="A4" />
          </RadioGroup>
        </FormControl>

        <FormControl>
          <FormLabel>Orientation</FormLabel>
          <RadioGroup row value={orientation} onChange={(e) => setOrientation(e.target.value as 'portrait' | 'landscape')}>
            <FormControlLabel value="portrait" control={<Radio />} label="Portrait" />
            <FormControlLabel value="landscape" control={<Radio />} label="Landscape" />
          </RadioGroup>
        </FormControl>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handlePrint} disabled={selectedCount === 0}>
          Print
        </Button>
      </DialogActions>
    </Dialog>
  );
};
