import React from 'react';
import {
  Box, Card, CardContent, Typography, TextField, Button, Alert, CircularProgress,
} from '@mui/material';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import { useAuth } from '../auth/AuthProvider';

/**
 * Passwordless sign-in: the user enters an email and receives a magic link.
 * Shown by `App` whenever there is no active session.
 */
export const SignInScreen: React.FC = () => {
  const { signInWithEmail } = useAuth();
  const [email, setEmail] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSending(true);
    try {
      await signInWithEmail(email.trim());
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send login link');
    } finally {
      setSending(false);
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

          {sent ? (
            <Alert severity="success" sx={{ mt: 2 }}>
              Check your inbox — we sent a login link to <strong>{email}</strong>. Open it on
              this device to sign in.
            </Alert>
          ) : (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Enter your email and we'll send you a magic link to sign in. No password needed.
              </Typography>
              <Box component="form" onSubmit={handleSubmit}>
                <TextField
                  fullWidth
                  type="email"
                  label="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                  disabled={sending}
                />
                {error && (
                  <Alert severity="error" sx={{ mt: 2 }}>
                    {error}
                  </Alert>
                )}
                <Button
                  type="submit"
                  variant="contained"
                  fullWidth
                  sx={{ mt: 3 }}
                  disabled={sending || !email.trim()}
                  startIcon={sending ? <CircularProgress size={18} color="inherit" /> : undefined}
                >
                  {sending ? 'Sending…' : 'Send login link'}
                </Button>
              </Box>
            </>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};
