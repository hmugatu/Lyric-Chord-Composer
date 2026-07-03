import React from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { AppBar, Toolbar, Tabs, Tab, Typography, Box, IconButton, Tooltip } from '@mui/material';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import { HomeScreen } from './screens/HomeScreen';
import { EditorScreen } from './screens/EditorScreen';
import { ColorModeContext } from './theme';

export const App: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const current = location.pathname.startsWith('/editor') ? '/editor' : '/';
  const colorMode = React.useContext(ColorModeContext);

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
            indicatorColor="secondary"
          >
            <Tab label="Compositions" value="/" />
            <Tab label="Editor" value="/editor" />
          </Tabs>
          <Tooltip title={colorMode.mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
            <IconButton color="inherit" onClick={colorMode.toggle} sx={{ ml: 1 }}>
              {colorMode.mode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
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
