/**
 * Cloud composition repository (Supabase).
 *
 * Replaces the old localStorage `CompositionCache` as the store's backing
 * persistence. Every operation is scoped to the signed-in user: RLS enforces
 * isolation on the server, and we stamp `user_id` on writes to satisfy the
 * insert/update policies.
 *
 * A composition row stores the full Composition object in `data` (JSONB);
 * `title`/`artist` are duplicated onto columns so the home list is cheap.
 */

import type { Composition } from '../models';
import { supabase } from './supabaseClient';

interface CompositionRow {
  id: string;
  user_id: string;
  title: string;
  artist: string | null;
  data: Composition;
  created_at: string;
  updated_at: string;
}

/** Convert a DB row into a Composition, re-hydrating Date fields. */
function rowToComposition(row: CompositionRow): Composition {
  const data = row.data;
  return {
    ...data,
    id: row.id,
    title: row.title,
    artist: row.artist ?? undefined,
    createdAt: new Date(data.createdAt),
    updatedAt: new Date(data.updatedAt),
  };
}

async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw new Error('Not signed in');
  }
  return data.user.id;
}

/** All of the current user's compositions, newest-updated first. */
export async function listCompositions(): Promise<Composition[]> {
  const { data, error } = await supabase
    .from('compositions')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return (data as CompositionRow[]).map(rowToComposition);
}

/** Insert or update a single composition owned by the current user. */
export async function upsertComposition(composition: Composition): Promise<void> {
  const userId = await requireUserId();
  const { error } = await supabase.from('compositions').upsert(
    {
      id: composition.id,
      user_id: userId,
      title: composition.title,
      artist: composition.artist ?? null,
      data: composition,
      updated_at: new Date(composition.updatedAt).toISOString(),
    },
    { onConflict: 'id' },
  );
  if (error) throw error;
}

/** Delete one of the current user's compositions. */
export async function deleteComposition(id: string): Promise<void> {
  const { error } = await supabase.from('compositions').delete().eq('id', id);
  if (error) throw error;
}

/** Insert/update many compositions at once (used for first-login migration). */
export async function bulkUpsert(compositions: Composition[]): Promise<void> {
  if (compositions.length === 0) return;
  const userId = await requireUserId();
  const rows = compositions.map((c) => ({
    id: c.id,
    user_id: userId,
    title: c.title,
    artist: c.artist ?? null,
    data: c,
    updated_at: new Date(c.updatedAt).toISOString(),
  }));
  const { error } = await supabase.from('compositions').upsert(rows, { onConflict: 'id' });
  if (error) throw error;
}
