/**
 * localStorage cache of the user's compositions.
 *
 * Drive is a high-latency store behind an expiring token, so it can't be the
 * synchronous source of truth for an editor that saves after every edit. This
 * cache is written synchronously on every save and reconciled against Drive in
 * the background, which also means the app still opens offline.
 */

import type { Composition } from '../models';
import { deserializeComposition } from './compositionSerialization';

const CACHE_KEY = '@lyric-chord-composer:compositions';

/** Read all cached compositions. Never throws — a corrupt cache reads empty. */
export function readCache(): Composition[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Round-trip each entry so Date fields come back as Dates, not strings.
    return parsed
      .map((entry) => {
        try {
          return deserializeComposition(JSON.stringify(entry));
        } catch {
          return null;
        }
      })
      .filter((c): c is Composition => c !== null);
  } catch (error) {
    console.error('Failed to read composition cache:', error);
    return [];
  }
}

export function writeCache(compositions: Composition[]): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(compositions));
  } catch (error) {
    // Quota exceeded, or storage disabled (private mode). Drive still has the
    // data, so this degrades to "no offline cache" rather than data loss.
    console.error('Failed to write composition cache:', error);
  }
}

/** Insert or replace one composition in the cache. */
export function cacheUpsert(composition: Composition): void {
  const all = readCache();
  const index = all.findIndex((c) => c.id === composition.id);
  if (index >= 0) {
    all[index] = composition;
  } else {
    all.push(composition);
  }
  writeCache(all);
}

export function cacheDelete(id: string): void {
  writeCache(readCache().filter((c) => c.id !== id));
}

export function clearCache(): void {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    // Nothing actionable — the cache is best-effort by design.
  }
}

/**
 * Merge local and remote copies, last-write-wins on `updatedAt`.
 * Divergence is logged rather than silently resolved, so a stale overwrite is
 * visible when debugging a "my edit disappeared" report.
 */
export function mergeCompositions(local: Composition[], remote: Composition[]): Composition[] {
  const byId = new Map<string, Composition>();
  for (const composition of remote) byId.set(composition.id, composition);

  for (const localCopy of local) {
    const remoteCopy = byId.get(localCopy.id);
    if (!remoteCopy) {
      byId.set(localCopy.id, localCopy);
      continue;
    }
    const localTime = new Date(localCopy.updatedAt).getTime();
    const remoteTime = new Date(remoteCopy.updatedAt).getTime();
    if (localTime > remoteTime) {
      console.warn(
        `Local copy of "${localCopy.title}" is newer than Drive's; keeping local.`,
      );
      byId.set(localCopy.id, localCopy);
    }
  }

  return [...byId.values()].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}
