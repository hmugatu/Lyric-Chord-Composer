import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, CardActionArea, CardContent, Typography, IconButton,
  Snackbar, CircularProgress, Tooltip, Dialog, DialogTitle, DialogContent,
  DialogContentText, DialogActions, Button,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { useCompositionStore } from '../store/compositionStore';
import { CompositionStorageService } from '../services/compositionService';
import type { Composition } from '../models';

export const HomeScreen: React.FC = () => {
  const navigate = useNavigate();
  const [snackbar, setSnackbar] = React.useState({ open: false, message: '' });
  const [errorDialog, setErrorDialog] = React.useState<string | null>(null);
  const [isImporting, setIsImporting] = React.useState(false);

  const [pendingDelete, setPendingDelete] = React.useState<Composition | null>(null);

  const compositions = useCompositionStore((s) => s.compositions);
  const createComposition = useCompositionStore((s) => s.createComposition);
  const loadComposition = useCompositionStore((s) => s.loadComposition);
  const addComposition = useCompositionStore((s) => s.addComposition);
  const setCurrentComposition = useCompositionStore((s) => s.setCurrentComposition);
  const deleteComposition = useCompositionStore((s) => s.deleteComposition);
  const saveToCache = useCompositionStore((s) => s.saveToCache);
  const isLoading = useCompositionStore((s) => s.isLoading);
  const initializeStore = useCompositionStore((s) => s.initializeStore);
  const storageService = React.useMemo(() => new CompositionStorageService(), []);

  React.useEffect(() => {
    initializeStore();
  }, [initializeStore]);

  const handleCreateNew = () => {
    createComposition(`New Composition ${compositions.length + 1}`);
    navigate('/editor');
  };

  const handleOpen = (composition: Composition) => {
    loadComposition(composition.id);
    navigate('/editor');
  };

  const handleConfirmDelete = () => {
    if (pendingDelete) {
      deleteComposition(pendingDelete.id);
      saveToCache();
      setSnackbar({ open: true, message: `Deleted "${pendingDelete.title}"` });
    }
    setPendingDelete(null);
  };

  const handleImport = async () => {
    try {
      setIsImporting(true);
      await storageService.setProvider('local');
      const result = await storageService.importComposition();
      addComposition(result.composition);
      setCurrentComposition(result.composition.id);
      useCompositionStore.getState().saveToCache();
      setSnackbar({ open: true, message: 'Composition imported successfully!' });
    } catch (error) {
      setErrorDialog(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Box sx={{ position: 'relative', minHeight: '100%', bgcolor: 'background.default' }}>
      <Box
        sx={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'background.paper',
        }}
      >
        <Box>
          <Typography variant="h6">My Compositions</Typography>
          <Typography variant="caption" color="text.secondary">
            {compositions.length} file{compositions.length !== 1 ? 's' : ''}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreateNew}>
            New
          </Button>
          <Button
            variant="contained"
            startIcon={<FolderOpenIcon />}
            onClick={handleImport}
            disabled={isImporting}
          >
            Import
          </Button>
        </Box>
      </Box>

      {isLoading || isImporting ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mt: 8, gap: 2 }}>
          <CircularProgress />
          <Typography>{isImporting ? 'Importing...' : 'Loading...'}</Typography>
        </Box>
      ) : compositions.length === 0 ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mt: 8, p: 4, textAlign: 'center' }}>
          <MusicNoteIcon sx={{ fontSize: 64, color: '#ccc' }} />
          <Typography variant="h6" sx={{ mt: 2, color: '#666' }}>No compositions yet</Typography>
          <Typography variant="body2" sx={{ mt: 1, color: '#999' }}>
            Create your first composition or import an existing .hmlcc file
          </Typography>
        </Box>
      ) : (
        <Box sx={{ p: 2, pb: 10 }}>
          {compositions.map((item) => (
            <Card key={item.id} sx={{ mb: 1.5, display: 'flex', alignItems: 'stretch' }}>
              <CardActionArea onClick={() => handleOpen(item)} sx={{ flex: 1 }}>
                <CardContent>
                  <Typography variant="h6">{item.title}</Typography>
                  {item.artist && <Typography variant="body2">{item.artist}</Typography>}
                  <Typography variant="body2" sx={{ mt: 0.5, color: '#666' }}>
                    Updated: {new Date(item.updatedAt).toLocaleDateString()}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
                    <Typography variant="caption">
                      {item.sections.length} section{item.sections.length !== 1 ? 's' : ''}
                    </Typography>
                    {item.difficulty && (
                      <Typography variant="caption" sx={{ textTransform: 'capitalize' }}>
                        {item.difficulty}
                      </Typography>
                    )}
                  </Box>
                </CardContent>
              </CardActionArea>
              <Box sx={{ display: 'flex', alignItems: 'center', pr: 1 }}>
                <Tooltip title="Delete composition">
                  <IconButton
                    aria-label={`Delete ${item.title}`}
                    onClick={() => setPendingDelete(item)}
                    sx={{ color: '#b00020' }}
                  >
                    <DeleteOutlineIcon />
                  </IconButton>
                </Tooltip>
              </Box>
            </Card>
          ))}
        </Box>
      )}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ open: false, message: '' })}
        message={snackbar.message}
      />

      <Dialog open={pendingDelete !== null} onClose={() => setPendingDelete(null)}>
        <DialogTitle>Delete composition?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Permanently remove "{pendingDelete?.title}" from your library? This can't be undone.
            If you want to keep a copy, cancel and use Save to export it first.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingDelete(null)}>Cancel</Button>
          <Button color="error" onClick={handleConfirmDelete}>Delete</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={errorDialog !== null} onClose={() => setErrorDialog(null)}>
        <DialogTitle>Import Failed</DialogTitle>
        <DialogContent>
          <DialogContentText>{errorDialog}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setErrorDialog(null)}>OK</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
