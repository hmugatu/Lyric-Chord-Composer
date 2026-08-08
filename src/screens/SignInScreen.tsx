import React from 'react';
import {
  Box, Card, CardContent, Typography, Button, Alert, CircularProgress,
} from '@mui/material';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import CloudQueueIcon from '@mui/icons-material/CloudQueue';
import { useAuth } from '../auth/AuthProvider';

/**
 * Google sign-in. Connecting Drive is what signs the user in, since
 * compositions are stored as files in their own Drive folder.
 * Shown by `App` whenever there is no active session.
 */
export const SignInScreen: React.FC = () => {
  const { signIn } = useAuth();
  const [connecting, setConnecting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSignIn = async () => {
    setError(null);
    setConnecting(true);
    try {
      await signIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign in with Google');
    } finally {
      setConnecting(false);
    }
  };

  return (
    <Box
      sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '100%', p: 2, bgcolor: 'background.default',
      }}
    >
      <Card sx={{ width: '100%', maxWidth: 400 }}>
        <CardContent sx={{ p: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <MusicNoteIcon color="primary" />
            <Typography variant="h6">Lyric Chord Composer</Typography>
          </Box>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Sign in with Google to store your compositions in your own Google Drive.
            They're saved to a “Lyric Chord Composer” folder that only this app can see.
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Button
            variant="contained"
            fullWidth
            onClick={handleSignIn}
            disabled={connecting}
            startIcon={
              connecting ? <CircularProgress size={18} color="inherit" /> : <CloudQueueIcon />
            }
          >
            {connecting ? 'Connecting…' : 'Sign in with Google'}
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
};
