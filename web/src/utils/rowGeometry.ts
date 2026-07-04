/**
 * Shared row geometry for tab/staff rendering.
 * One source of truth for the per-row measure math used by the on-screen
 * Tablature/StaffNotes components AND the print service, so printed frets and
 * notes land exactly where the editor shows them.
 *
 * Conventions (all in real pixels for a row of `numMeasures` bars):
 *  - Content starts at x=10 and spans `width - 20`.
 *  - Measure 1 is wider by 40px because the staff reserves CLEF_RESERVE at its
 *    start for the clef + time signature; remaining measures split the rest.
 */

export const CLEF_RESERVE = 40;

export interface MeasureLayout {
  width: number;
  numMeasures: number;
  firstMeasureWidth: number;
  otherMeasureWidth: number;
  /** X of each vertical bar line, numMeasures + 1 entries. */
  barLineXs: number[];
}

export function getMeasureLayout(width: number, numMeasures: number): MeasureLayout {
  const totalWidth = width - 20;
  const firstMeasureWidth = numMeasures > 1 ? totalWidth / numMeasures + 40 : totalWidth;
  const otherMeasureWidth = numMeasures > 1 ? (totalWidth - firstMeasureWidth) / (numMeasures - 1) : 0;

  const barLineXs: number[] = [];
  let currentX = 10;
  for (let m = 0; m <= numMeasures; m++) {
    barLineXs.push(currentX);
    if (m === 0) {
      currentX += firstMeasureWidth;
    } else if (m < numMeasures) {
      currentX += otherMeasureWidth;
    }
  }

  return { width, numMeasures, firstMeasureWidth, otherMeasureWidth, barLineXs };
}

/**
 * X-centre of subdivision `idx` (0-based across all measures in the row) given
 * how many subdivisions each measure has. Used for both chord beats and 16th
 * cells. Measure 1 excludes the CLEF_RESERVE from its usable span.
 */
export function getSubdivisionX(idx: number, perBar: number, layout: MeasureLayout): number {
  const measureIndex = Math.floor(idx / perBar);
  const within = idx % perBar;

  let measureStart = 10;
  if (measureIndex > 0) {
    measureStart = 10 + layout.firstMeasureWidth + (measureIndex - 1) * layout.otherMeasureWidth;
  }
  const measureWidth = measureIndex === 0 ? layout.firstMeasureWidth : layout.otherMeasureWidth;

  if (measureIndex === 0) {
    const usable = measureWidth - CLEF_RESERVE;
    const w = usable / perBar;
    return measureStart + CLEF_RESERVE + w * within + w / 2;
  }
  const w = measureWidth / perBar;
  return measureStart + w * within + w / 2;
}

/** 16th-note cells per bar, driven by the time signature. */
export function cellsPerBarFor(tsBeats: number, tsBeatValue: number): number {
  return Math.max(1, Math.round((tsBeats * 16) / tsBeatValue));
}
