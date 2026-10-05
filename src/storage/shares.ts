import type { Song } from '../model/types';
import { repairSong } from '../model/song';
import { supabase } from './supabase';
import { syncNow } from './storage';

/** 16 random bytes as base64url: 22 characters, ~128 bits. */
export function newToken(bytes: Uint8Array = crypto.getRandomValues(new Uint8Array(16))): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Where shared links point. Set VITE_PUBLIC_URL when the app is hosted somewhere others can reach. */
export function shareUrl(token: string): string {
  const base = (import.meta.env.VITE_PUBLIC_URL as string | undefined) || location.origin + location.pathname;
  return `${base.replace(/\/?$/, '/')}#/s/${token}`;
}

const need = () => {
  if (!supabase) throw new Error('Sync is not set up');
  return supabase;
};

/** The song's current share token, if it has one. */
export async function getShare(songId: string): Promise<string | null> {
  const { data, error } = await need().from('guitar_shares').select('token').eq('song_id', songId).maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.token as string | undefined) ?? null;
}

/** Makes (or returns) the song's link. Syncs first so the shared copy is the latest. */
export async function createShare(songId: string): Promise<string> {
  await syncNow();
  const existing = await getShare(songId);
  if (existing) return existing;
  const token = newToken();
  const { error } = await need().from('guitar_shares').insert({ token, song_id: songId });
  if (error) throw new Error(error.message);
  return token;
}

/** Stops sharing: the old link stops working immediately. */
export async function removeShare(songId: string): Promise<void> {
  const { error } = await need().from('guitar_shares').delete().eq('song_id', songId);
  if (error) throw new Error(error.message);
}

/** Reads a shared song by token (works signed out). Null when the link is dead. */
export async function fetchShared(token: string): Promise<Song | null> {
  const { data, error } = await need().rpc('get_shared_song', { p_token: token });
  if (error) throw new Error(error.message);
  const row = (data as { data: Song }[] | null)?.[0];
  return row?.data ? repairSong(row.data) : null;
}
