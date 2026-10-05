import { create } from 'zustand';
import type { Song } from '../model/types';
import { useStore } from '../state/store';
import { getAudio, putAudio } from './audioStore';
import { planAudio, type AudioPlan } from './audioPlan';

/** Where recordings sync to (Supabase Storage when signed in). */
export interface AudioRemote {
  upload(songId: string, blob: Blob, name: string): Promise<void>;
  download(songId: string): Promise<Blob>;
  remove(songId: string): Promise<void>;
}

export type AudioBusy = 'uploading' | 'downloading' | 'error';
/** Per-song transfer state, for the audio row. */
export const useAudioBusy = create<Record<string, AudioBusy | undefined>>(() => ({}));
const busy = (id: string, b: AudioBusy | undefined) => useAudioBusy.setState({ [id]: b });

let remote: AudioRemote | null = null;
export function setAudioRemote(r: AudioRemote | null) {
  remote = r;
}
export const audioSyncOn = () => !!remote;

const inflight = new Map<string, Promise<unknown>>();
function once<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const running = inflight.get(key) as Promise<T> | undefined;
  if (running) return running;
  const p = fn().finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

async function plan(song: Song): Promise<AudioPlan | null> {
  if (!song.audio) return null;
  const local = await getAudio(song.id);
  return planAudio(song.audio, local ? local.rev : null, !!remote);
}

/** Uploads this song's recording if the account doesn't have it yet. */
export function uploadIfNeeded(song: Song): Promise<void> {
  return once('up:' + song.id, async () => {
    const p = await plan(song);
    const r = remote;
    if (!p?.upload || !r) return;
    const local = await getAudio(song.id);
    if (!local) return;
    const rev = song.audio!.rev;
    busy(song.id, 'uploading');
    try {
      await r.upload(song.id, local.blob, song.audio!.name);
      busy(song.id, undefined);
      // only mark it if the same file is still attached (it may have been replaced meanwhile)
      useStore.getState().patchSong(song.id, (d) => {
        if (d.audio && d.audio.rev === rev) d.audio.uploaded = true;
      });
    } catch (e) {
      console.warn('recording upload failed', e);
      busy(song.id, 'error');
    }
  });
}

/** Uploads every recording this device has that the account doesn't (after sign-in and each sync). */
export async function uploadPending() {
  if (!remote) return;
  for (const s of useStore.getState().library) if (s.audio && !s.audio.uploaded) await uploadIfNeeded(s);
}

/**
 * Makes sure the current recording file is on this device, downloading it from
 * the account when needed. Resolves with how it went.
 */
export function ensureLocalAudio(song: Song): Promise<AudioPlan['play'] | 'none' | 'error'> {
  return once('down:' + song.id + ':' + (song.audio?.rev ?? ''), async () => {
    const p = await plan(song);
    if (!p) return 'none';
    if (p.upload) void uploadIfNeeded(song);
    if (p.play !== 'download' || !remote) return p.play;
    busy(song.id, 'downloading');
    try {
      const blob = await remote.download(song.id);
      await putAudio(song.id, blob, song.audio!.rev);
      busy(song.id, undefined);
      return 'ready';
    } catch (e) {
      console.warn('recording download failed', e);
      busy(song.id, 'error');
      return 'error';
    }
  });
}

/** Removes the account copy (when the recording is removed from the song). */
export async function removeRemoteAudio(songId: string) {
  await remote?.remove(songId).catch(() => undefined);
}
