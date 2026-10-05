import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Setlist, Song } from '../model/types';
import type { Synced } from './sync';
import type { RemoteStore } from './storage';
import { audioPath, audioType } from './audioPlan';
import type { AudioRemote } from './audioSync';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Null when .env.local isn't set up — the app then runs local-only. */
// PKCE: sign-in links come back as ?code=… which can't collide with the app's #/routes.
export const supabase: SupabaseClient | null = url && key ? createClient(url, key, { auth: { flowType: 'pkce' } }) : null;

const iso = (ms: number) => new Date(ms).toISOString();
const ms = (s: string | null) => (s ? new Date(s).getTime() : null);

/**
 * A synced table behind RLS: every call runs as the signed-in user and Postgres
 * only ever shows or changes that user's rows. No server of our own.
 * `columns` adds searchable plain columns next to the full JSON document.
 */
function tableRemote<T extends Synced>(
  client: SupabaseClient,
  userId: string,
  table: string,
  columns: (item: T) => Record<string, unknown>,
  onDelete?: (id: string) => Promise<unknown>,
): RemoteStore<T> {
  const rows = () => client.from(table);
  const fail = (error: { message: string } | null) => {
    if (error) throw new Error(error.message);
  };
  return {
    async meta() {
      const { data, error } = await rows().select('id, updated_at, deleted_at');
      fail(error);
      return (data ?? []).map((r) => ({ id: r.id as string, updatedAt: ms(r.updated_at)!, deletedAt: ms(r.deleted_at) }));
    },
    async fetch(ids) {
      const out: T[] = [];
      for (let i = 0; i < ids.length; i += 100) {
        const { data, error } = await rows().select('data').in('id', ids.slice(i, i + 100));
        fail(error);
        for (const r of data ?? []) if (r.data) out.push(r.data as T);
      }
      return out;
    },
    async put(item) {
      const { error } = await rows().upsert(
        { owner_id: userId, id: item.id, ...columns(item), data: item, updated_at: iso(item.updatedAt), deleted_at: null },
        { onConflict: 'owner_id,id' },
      );
      fail(error);
    },
    async markDeleted(id, at) {
      const { error } = await rows().upsert(
        { owner_id: userId, id, data: null, updated_at: iso(at), deleted_at: iso(at) },
        { onConflict: 'owner_id,id' },
      );
      fail(error);
      await onDelete?.(id);
    },
  };
}

export const supabaseRemote = (client: SupabaseClient, userId: string) =>
  tableRemote<Song>(
    client,
    userId,
    'guitar_songs',
    (s) => ({ title: s.title, artist: s.artist }),
    // its recording goes too (best effort: a leftover file is harmless and private)
    (id) => client.storage.from(BUCKET).remove([audioPath(userId, id)]).catch(() => undefined),
  );

export const supabaseSetlists = (client: SupabaseClient, userId: string) =>
  tableRemote<Setlist>(client, userId, 'guitar_setlists', (s) => ({ name: s.name }));

const BUCKET = 'guitar-audio';

/** Recordings in Supabase Storage, under the user's own folder (RLS-checked). */
export function supabaseAudio(client: SupabaseClient, userId: string): AudioRemote {
  const bucket = () => client.storage.from(BUCKET);
  return {
    async upload(songId, blob, name) {
      const { error } = await bucket().upload(audioPath(userId, songId), blob, { upsert: true, contentType: audioType(name, blob.type) });
      if (error) throw new Error(error.message);
    },
    async download(songId) {
      const { data, error } = await bucket().download(audioPath(userId, songId));
      if (error || !data) throw new Error(error?.message ?? 'download failed');
      return data;
    },
    async remove(songId) {
      const { error } = await bucket().remove([audioPath(userId, songId)]);
      if (error) throw new Error(error.message);
    },
  };
}
