# Lyric Chord Composer — Web

Plain web build (React + Vite + MUI) of the composer, deployed to GitHub Pages at
**https://hmugatu.github.io/Lyric-Chord-Composer/**.

This is a full web rewrite of the original Expo/React Native app. Music logic (chord →
note conversion via tonal.js, VexFlow staff notation, tablature, chord diagrams, print
HTML) is reused; the shell is plain React. Storage is local-only: compositions are cached
in `localStorage` and exchanged as `.hmlcc` files (download / file-picker upload). Cloud
sync (Google Drive / OneDrive) from the mobile app is intentionally not included here.

## Local development

```bash
cd web
npm install
npm run dev
```

Open the URL Vite prints (e.g. http://localhost:5173/Lyric-Chord-Composer/).

## Production build

```bash
cd web
npm run build     # outputs to web/dist/
npm run preview   # serves the built app under the /Lyric-Chord-Composer/ base path
```

## Deployment

Pushing to `main` triggers `.github/workflows/deploy.yml`, which builds `web/` and
publishes `web/dist/` to GitHub Pages.

**One-time setup:** in the GitHub repo, go to **Settings → Pages → Build and deployment →
Source** and select **GitHub Actions**.

## Notes

- The base path is `/Lyric-Chord-Composer/` (set in `vite.config.ts`); routing uses
  `HashRouter` so deep links survive a page refresh on Pages' static server.
- The original Expo project (mobile builds via EAS) still lives at the repo root and is
  unaffected by this folder.
