# Lyric Chord Composer

A web app (React + Vite + MUI) for composing guitar music — chord diagrams, tablature,
staff notation, and lyrics with chord positioning. Deployed to GitHub Pages at
**https://hmugatu.github.io/Lyric-Chord-Composer/**.

Music logic uses tonal.js (chord → note conversion), VexFlow (staff notation), and a
custom renderer for tablature, chord diagrams, and print HTML. Storage is local-only:
compositions are cached in `localStorage` and exchanged as `.hmlcc` files (download /
file-picker upload).

> This project was originally an Expo/React Native app; it has been rewritten as a plain
> Vite web app, which is what now lives at the repo root.

## Tech stack

- **React 19** + **Vite 6** — app shell and dev server/build
- **TypeScript** — type-safe development
- **MUI (Material UI)** — UI components
- **VexFlow** — music notation and tablature rendering
- **tonal.js** — music theory operations
- **Zustand** — state management
- **React Router (HashRouter)** — routing

## Getting started

Prerequisites: Node.js 18+ and npm.

```bash
npm install
npm run dev
```

Open the URL Vite prints (e.g. http://localhost:5173/Lyric-Chord-Composer/).

## Production build

```bash
npm run build     # outputs to dist/
npm run preview   # serves the built app under the /Lyric-Chord-Composer/ base path
```

## Project structure

```
Lyric-Chord-Composer/
├── index.html                # Vite entry HTML
├── vite.config.ts            # Vite config (base path for GitHub Pages)
├── public/                   # Static assets (favicon, .nojekyll)
└── src/
    ├── main.tsx              # App bootstrap
    ├── App.tsx               # Root component / routing
    ├── screens/              # HomeScreen, EditorScreen
    ├── components/           # Chord diagrams, tablature, staff, lyrics, dialogs
    ├── models/               # TypeScript data models (Composition, Chord, …)
    ├── store/                # Zustand state
    ├── services/             # Composition I/O, caching, print service
    ├── data/                 # chords.json chord database
    └── utils/                # Chord naming, text import, pitch detection, geometry
```

## Deployment

Pushing to `main` triggers [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml),
which builds the app and publishes `dist/` to GitHub Pages.

**One-time setup:** in the GitHub repo, go to **Settings → Pages → Build and deployment →
Source** and select **GitHub Actions**.

## Notes

- The base path is `/Lyric-Chord-Composer/` (set in `vite.config.ts`); routing uses
  `HashRouter` so deep links survive a page refresh on Pages' static server.

## Contributing

Before making changes, read the [Development Workflow](docs/DEV_WORKFLOW.md).

## License

MIT License — see [LICENSE](LICENSE).

## Repository

https://github.com/hmugatu/Lyric-Chord-Composer
