import React from 'react';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import type { PaletteMode } from '@mui/material';

type ThemePref = 'light' | 'dark' | 'system';

interface ColorModeContextValue {
  mode: PaletteMode; // resolved mode actually in use
  pref: ThemePref; // user preference (may be "system")
  toggle: () => void; // cycles the effective mode and pins it
}

export const ColorModeContext = React.createContext<ColorModeContextValue>({
  mode: 'light',
  pref: 'system',
  toggle: () => {},
});

const STORAGE_KEY = 'lcc:theme-pref';

function getSystemMode(): PaletteMode {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
}

export const AppThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [pref, setPref] = React.useState<ThemePref>(() => {
    const stored = (typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY)) as ThemePref | null;
    return stored === 'light' || stored === 'dark' ? stored : 'system';
  });

  const [systemMode, setSystemMode] = React.useState<PaletteMode>(getSystemMode);

  // Track OS/browser preference changes while pref is "system".
  React.useEffect(() => {
    if (!window.matchMedia) return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setSystemMode(e.matches ? 'dark' : 'light');
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  const mode: PaletteMode = pref === 'system' ? systemMode : pref;

  const toggle = React.useCallback(() => {
    // Flip the currently-effective mode and pin it as an explicit preference.
    const next: ThemePref = mode === 'dark' ? 'light' : 'dark';
    setPref(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, [mode]);

  const theme = React.useMemo(
    () =>
      createTheme({
        palette: {
          mode,
          primary: { main: '#1976d2' },
        },
      }),
    [mode]
  );

  const ctx = React.useMemo(() => ({ mode, pref, toggle }), [mode, pref, toggle]);

  return (
    <ColorModeContext.Provider value={ctx}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
};
