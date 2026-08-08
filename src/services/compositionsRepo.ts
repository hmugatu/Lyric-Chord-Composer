/**
 * Composition repository backed by Google Drive.
 *
 * Each composition is one `.hmlcc` file in the user's "Lyric Chord Composer"
 * Drive folder. Isolation is inherent — files live in the signing-in user's own
 * Drive, so there is no server-side ownership check to enforce.
 *
 * A localStorage cache (`compositionCache`) is the synchronous source of truth;
 * Drive writes are debounced behind it. The exported API is storage-agnostic, so
 * the store calls it without knowing where compositions are persisted.
 */

import type { Composition } from '../models';
import { googleDrive } from './fileStorage/GoogleDriveProvider';
import {
  deserializeComposition,
  generateFilename,
  idFromFilename,
  serializeComposition,
} from './compositionSerialization';
import {
  cacheDelete,
  cacheUpsert,
  mergeCompositions,
  readCache,
  writeCache,
} from './compositionCache';

/** How long to coalesce rapid edits before pushing a composition to Drive. */
const SYNC_DEBOUNCE_MS = 3000;

/** composition id -> Drive file id, populated by `listCompositions`. */
const fileIds = new Map<string, string>();

/** Pending debounced Drive writes, keyed by composition id. */
const pendingWrites = new Map<string, ReturnType<typeof setTimeout>>();

/** Reset all in-memory state. Called on sign-out so the next user starts clean. */
export function resetRepo(): void {
  for (const timer of pendingWrites.values()) clearTimeout(timer);
  pendingWrites.clear();
  fileIds.clear();
}

/**
 * Load compositions: the cache answers immediately, then Drive reconciles.
 * When Drive is unreachable (offline, or not yet signed in) the cached copies
 * are returned rather than surfacing an error.
 */
export async function listCompositions(): Promise<Composition[]> {
  const cached = readCache();
  if (!googleDrive.isAuthenticated()) return cached;

  try {
    const files = await googleDrive.listFiles();
    const remote: Composition[] = [];

    for (const file of files) {
      try {
        const content = await googleDrive.readFile(file.id);
        const composition = deserializeComposition(content);
        remote.push(composition);
        fileIds.set(composition.id, file.id);
      } catch (error) {
        // One unreadable/corrupt file shouldn't blank the whole library.
        const id = idFromFilename(file.name);
        console.error(`Skipping unreadable Drive file "${file.name}" (${id}):`, error);
      }
    }

    const merged = mergeCompositions(cached, remote);
    writeCache(merged);
    return merged;
  } catch (error) {
    console.error('Failed to list compositions from Drive; using cache:', error);
    return cached;
  }
}

/** Write a composition to Drive now, creating or overwriting its file. */
async function pushToDrive(composition: Composition): Promise<void> {
  const filename = generateFilename(composition);
  const content = serializeComposition(composition);
  const existingFileId = fileIds.get(composition.id);

  if (existingFileId) {
    await googleDrive.updateFile(existingFileId, filename, content);
    return;
  }

  const created = await googleDrive.writeFile(filename, content);
  fileIds.set(composition.id, created.id);
}

/**
 * Persist a composition. The cache is updated synchronously; the Drive write is
 * debounced, since this is called after every edit.
 */
export async function upsertComposition(composition: Composition): Promise<void> {
  cacheUpsert(composition);
  if (!googleDrive.isAuthenticated()) return;

  const existing = pendingWrites.get(composition.id);
  if (existing) clearTimeout(existing);

  pendingWrites.set(
    composition.id,
    setTimeout(() => {
      pendingWrites.delete(composition.id);
      pushToDrive(composition).catch((error) => {
        console.error(`Failed to sync "${composition.title}" to Drive:`, error);
      });
    }, SYNC_DEBOUNCE_MS),
  );
}

/** Flush any debounced writes immediately (e.g. before the page unloads). */
export async function flushPendingWrites(): Promise<void> {
  const ids = [...pendingWrites.keys()];
  for (const id of ids) {
    const timer = pendingWrites.get(id);
    if (timer) clearTimeout(timer);
    pendingWrites.delete(id);
  }

  const cached = readCache();
  await Promise.all(
    ids.map(async (id) => {
      const composition = cached.find((c) => c.id === id);
      if (!composition) return;
      try {
        await pushToDrive(composition);
      } catch (error) {
        console.error(`Failed to flush "${composition.title}" to Drive:`, error);
      }
    }),
  );
}

export async function deleteComposition(id: string): Promise<void> {
  const pending = pendingWrites.get(id);
  if (pending) {
    clearTimeout(pending);
    pendingWrites.delete(id);
  }

  cacheDelete(id);
  if (!googleDrive.isAuthenticated()) return;

  const fileId = fileIds.get(id);
  if (!fileId) return;

  try {
    await googleDrive.deleteFile(fileId);
    fileIds.delete(id);
  } catch (error) {
    console.error('Failed to delete composition from Drive:', error);
  }
}

/** Persist many compositions at once (used by the import flow). */
export async function bulkUpsert(compositions: Composition[]): Promise<void> {
  if (compositions.length === 0) return;

  for (const composition of compositions) cacheUpsert(composition);
  if (!googleDrive.isAuthenticated()) return;

  // Sequential: Drive rate-limits aggressive parallel writes, and imports are
  // rare enough that throughput doesn't matter here.
  for (const composition of compositions) {
    try {
      await pushToDrive(composition);
    } catch (error) {
      console.error(`Failed to upload "${composition.title}" to Drive:`, error);
    }
  }
}
