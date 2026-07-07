import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Served from https://hmugatu.github.io/Lyric-Chord-Composer/
export default defineConfig({
  base: '/Lyric-Chord-Composer/',
  plugins: [react()],
});
