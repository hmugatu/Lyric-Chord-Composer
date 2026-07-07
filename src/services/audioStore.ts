/**
 * Local audio-clip storage for recorded playback (phase 3).
 *
 * Audio blobs are far too large to sit in the composition JSON (`notes`), so
 * they live in IndexedDB keyed by composition id. This keeps the feature fully
 * offline — no server, no auth.
 *
 * A later phase can add an optional Google Drive location; see
 * `AudioLocation` below, which is stored alongside the composition so the
 * editor knows where a clip lives.
 */

const DB_NAME = 'lcc-audio';
const STORE = 'clips';
const DB_VERSION = 1;

/** Where a composition's audio clip is stored. 'url' covers user-provided links. */
export type AudioLocation =
  | { kind: 'local' }
  | { kind: 'url'; url: string }
  | { kind: 'google-drive'; fileId: string };

/** Reference persisted in the composition so the editor knows a clip exists. */
export interface AudioClipRef {
  location: AudioLocation;
  mimeType?: string;
  durationSec?: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const store = db.transaction(STORE, mode).objectStore(STORE);
        const req = run(store);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

/** Save (or replace) the local audio clip for a composition. */
export async function saveAudioClip(compositionId: string, blob: Blob): Promise<void> {
  await tx('readwrite', (s) => s.put(blob, compositionId));
}

/** Load a composition's local audio clip, or null if none is stored. */
export async function loadAudioClip(compositionId: string): Promise<Blob | null> {
  const blob = await tx<Blob | undefined>('readonly', (s) => s.get(compositionId));
  return blob ?? null;
}

/** Remove a composition's local audio clip. */
export async function deleteAudioClip(compositionId: string): Promise<void> {
  await tx('readwrite', (s) => s.delete(compositionId));
}

/**
 * Resolve a clip reference to a playable object URL. Local clips read from
 * IndexedDB; 'url' locations (user-provided links) are used directly. Returns
 * null when nothing is available. Callers must revoke object URLs they get for
 * local clips — see `isObjectUrl`.
 */
export async function resolveAudioUrl(
  compositionId: string,
  ref: AudioClipRef | undefined,
): Promise<string | null> {
  if (ref?.location.kind === 'url') return ref.location.url;
  const blob = await loadAudioClip(compositionId);
  return blob ? URL.createObjectURL(blob) : null;
}

/** True when a resolved URL is an object URL that the caller should revoke. */
export function isObjectUrl(url: string): boolean {
  return url.startsWith('blob:');
}
