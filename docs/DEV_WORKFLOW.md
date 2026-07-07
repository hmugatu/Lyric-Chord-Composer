# Development Workflow

The web app (Vite + MUI + VexFlow) lives at the repo root. This is the loop to
follow for every non-trivial change so the app stays working and deploys cleanly.

## 1. Run the dev server

```bash
npm install   # first time only
npm run dev
```

Open http://localhost:5173/Lyric-Chord-Composer/. Vite hot-reloads on save, so
keep it running while you iterate instead of rebuilding each time.

## 2. Know the parallel constants before editing layout

Page layout is hardcoded in **three files that must be changed together** — a
"bars per page" / "rows" / geometry change in one without the others will
desync the editor from print:

- `src/screens/EditorScreen.tsx` — the editor grid + render loop
- `src/utils/importText.ts` — import pagination
- `src/services/printService/htmlTemplates.ts` — print layout

Current rule: bars per page follows the staff toggle — **16 bars (4 rows)** when
the staff shows, **28 bars (7 rows)** when it's hidden. Page data is always
stored at the max size so toggling the staff never drops bars.

## 3. Build (must stay green)

```bash
npm run build   # tsc -b && vite build
```

TypeScript errors fail the build. Fix them before moving on.

## 4. Verify in the real app — don't just typecheck

Drive the running app and observe behavior, don't assume it works:

- **UI / behavior changes** — script it with Playwright: import a song, toggle
  the setting, read back the DOM / computed styles, and take a screenshot. Then
  *look at the screenshot*. Install Playwright in a scratch dir (not the project)
  so it doesn't pollute `package.json`.
- **Pure logic** (parser, fret→pitch, chord normalization) — write a small `tsx`
  assertion script and run it with `npx tsx path/to/check.mts`.

Delete any scratch/temporary check files when done — don't commit them.

## 5. Report honestly

State caveats plainly (e.g. a chord line with a typo token is treated as a lyric
and its chords are dropped; a dense staff-on page may spill in print). Don't
overclaim "done" without having driven the change.

## 6. Commit and deploy

Commit only when the change is verified.

```bash
git status              # confirm branch + what's staged FIRST
git add <files>
git commit -m "..."
```

**Deploying = pushing to `main`.** GitHub Pages auto-builds and publishes on
push to `main` via the `.github/workflows/deploy.yml` Pages workflow.

```bash
git checkout main
git merge --ff-only <feature-branch>   # verify it's a clean fast-forward
git push origin main
```

Public site: https://hmugatu.github.io/Lyric-Chord-Composer/

## Guardrails

- **Always check `git branch --show-current` and `git status`/`git log` before
  staging or merging.** Don't assume you're on `main` or that all your edits are
  uncommitted — verify.
- Confirm a clean fast-forward before merging to main:
  ```bash
  git rev-list --left-right --count origin/main...HEAD
  ```
- A "Deployment failed, try again later" from Pages is a known GitHub flake; the
  workflow retries to absorb it.
- Kill stray background dev servers when finished (they accumulate across
  restarts and hold ports 5173+).
