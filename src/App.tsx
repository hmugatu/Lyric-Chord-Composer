import React from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { AppBar, Toolbar, Tabs, Tab, Typography, Box, IconButton, Tooltip, CircularProgress } from '@mui/material';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import LogoutIcon from '@mui/icons-material/Logout';
import { HomeScreen } from './screens/HomeScreen';
import { EditorScreen } from './screens/EditorScreen';
import { SignInScreen } from './screens/SignInScreen';
import { useAuth } from './auth/AuthProvider';
import { ColorModeContext } from './theme';

export const App: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const current = location.pathname.startsWith('/editor') ? '/editor' : '/';
  const colorMode = React.useContext(ColorModeContext);
  const { session, loading, signOut } = useAuth();

  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!session) {
    return <SignInScreen />;
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <AppBar position="static">
        <Toolbar variant="dense">
          <MusicNoteIcon sx={{ mr: 1 }} />
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Lyric Chord Composer
          </Typography>
          <Tabs
            value={current}
            onChange={(_, v) => navigate(v)}
            textColor="inherit"
            TabIndicatorProps={{ sx: { height: 3, bgcolor: '#fff' } }}
            sx={{
              '& .MuiTab-root': {
                color: 'rgba(255,255,255,0.6)',
                fontWeight: 500,
                minHeight: 48,
              },
              '& .Mui-selected': {
                color: '#fff',
                fontWeight: 700,
                bgcolor: 'rgba(255,255,255,0.16)',
                borderRadius: 1,
              },
            }}
          >
            <Tab label="Compositions" value="/" />
            <Tab label="Editor" value="/editor" />
          </Tabs>
          <Tooltip title={colorMode.mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
            <IconButton color="inherit" onClick={colorMode.toggle} sx={{ ml: 1 }}>
              {colorMode.mode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Sign out">
            <IconButton color="inherit" onClick={() => signOut()}>
              <LogoutIcon />
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>

      <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
        <Routes>
          <Route path="/" element={<HomeScreen />} />
          <Route path="/editor" element={<EditorScreen />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Box>
    </Box>
  );
};
