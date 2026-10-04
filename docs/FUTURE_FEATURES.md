# Future Features

Ideas that have been scoped but deliberately parked. Each entry records the
decisions already made so work can start without re-asking.

## Strum patterns

Show a strumming pattern (e.g. `D DU UDU`) on the sheet.

**Decisions made (2026-10-04):**

- **Scope:** one default pattern per song, with an optional override on any bar.
- **Display:** a row of ↓ ↑ arrows between the chord names and the tab,
  lined up with the same 16th-note grid the chord slots and tab use
  (`getSubdivisionX` / `cellsPerBar` in `src/utils/rowGeometry.ts`), so each
  strum sits on its beat.

  ```
  Asus2/F#          Asus2
  ↓   ↓ ↑   ↑ ↓ ↑  ↓   ↓ ↑   ↑ ↓ ↑
  1 & 2 & 3 & 4 &  1 & 2 & 3 & 4 &
  |-0---0-0---0-0-0-|-0---0-0---0-0-0-|
  ```

- **Effect:** display only to start. The pattern does not change tab, staff
  or playback.

**Not started.** No strum code exists yet.

**Likely touch points:**

- `GlobalSettings` in `src/models/Composition.ts` for the song default.
- A per-bar override stored in the page data.
- The three row renderers: the editor row loop (`src/screens/EditorScreen.tsx`),
  `src/components/RehearsalPage.tsx` and print (`src/services/printService/htmlTemplates.ts`).
- A pattern editor in Settings, plus a click-to-edit arrow row per bar.

**Follow-ups to consider later:**

- Driving tab, staff and karaoke playback from the pattern, so each strum
  becomes a chord hit with the right note lengths.
- Importing a pattern from text, e.g. a `Strum: D DU UDU` line.
