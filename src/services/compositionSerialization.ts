/**
 * Composition <-> `.hmlcc` serialization.
 *
 * Extracted so both the local export/import path (`CompositionStorageService`)
 * and the Google Drive repository use one implementation of the file format and
 * naming scheme, rather than each carrying its own copy.
 */

import type { Composition } from '../models';

export function serializeComposition(composition: Composition): string {
  return JSON.stringify(composition, null, 2);
}

/**
 * Parse `.hmlcc` content, re-hydrating the Date fields that JSON flattens into
 * strings. Callers rely on `createdAt`/`updatedAt` being real Dates.
 */
export function deserializeComposition(content: string): Composition {
  let data: any;
  try {
    data = JSON.parse(content);
  } catch (error) {
    throw new Error(
      `Failed to parse composition: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }

  if (!data?.id || !data?.title) {
    throw new Error('Invalid composition: missing required fields (id, title)');
  }

  return {
    ...data,
    createdAt: new Date(data.createdAt ?? Date.now()),
    updatedAt: new Date(data.updatedAt ?? Date.now()),
  } as Composition;
}

export function sanitizeFilename(title: string): string {
  return title
    .replace(/[^a-z0-9-_\s]/gi, '')
    .replace(/\s+/g, '-')
    // Collapse runs of underscores so a title can never contain the `__` that
    // delimits the id suffix in `generateFilename`.
    .replace(/_{2,}/g, '_')
    .toLowerCase()
    .substring(0, 50);
}

/**
 * `<sanitized-title>__<id>.hmlcc`. The id is embedded so a composition can be
 * matched back to its file even after the title (and thus the name) changes.
 *
 * A double underscore separates the two parts: ids are `<timestamp>-<random>`
 * and so contain hyphens themselves, and `sanitizeFilename` strips `__` from
 * titles — so this delimiter can never appear on the left-hand side.
 */
export const ID_DELIMITER = '__';

export function generateFilename(composition: Composition): string {
  return `${sanitizeFilename(composition.title)}${ID_DELIMITER}${composition.id}.hmlcc`;
}

/**
 * Recover a composition id from a filename produced by `generateFilename`.
 * Returns null for names that don't carry one (e.g. hand-created files).
 */
export function idFromFilename(filename: string): string | null {
  const base = filename.replace(/\.hmlcc$/, '');
  const index = base.lastIndexOf(ID_DELIMITER);
  if (index === -1) return null;
  const id = base.slice(index + ID_DELIMITER.length);
  return id || null;
}
