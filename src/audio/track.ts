import type { Song } from '../model/types';
import { barCapacity, playOrder } from '../model/song';
import { getAudio } from '../storage/audioStore';
import type { PlayHandle } from './player';

/**
 * The song's imported recording, played through an <audio> element so it can
 * slow down without changing pitch. Kept in step with the score by starting it
 * on the score's first downbeat at the matching point in the recording.
 */
let el: HTMLAudioElement | null = null;
let url: string | null = null;
let loadedFor: string | null = null;
let startTimer: ReturnType<typeof setTimeout> | undefined;

/** Loads the song's recording from this device. `rev` picks up a replaced file under the same song. */
export async function loadTrack(songId: string | null, rev?: string): Promise<boolean> {
  const key = songId && `${songId}:${rev ?? ''}`;
  if (loadedFor === key && el) return true;
  unloadTrack();
  if (!songId) return false;
  const local = await getAudio(songId);
  if (!local || (rev && local.rev !== rev)) return false;
  url = URL.createObjectURL(local.blob);
  el = new Audio(url);
  el.preload = 'auto';
  el.preservesPitch = true;
  loadedFor = key;
  return true;
}

export function unloadTrack() {
  stopTrack();
  if (url) URL.revokeObjectURL(url);
  el = null;
  url = null;
  loadedFor = null;
}

export const trackElement = () => el;

/** Seconds into the recording where `bar` first starts (bar 1 = song.audio.offset). */
export function audioTimeOfBar(song: Song, bar: number): number {
  const barSec = (60 / song.tempo / 16) * barCapacity(song);
  const k = playOrder(song, 0).indexOf(bar);
  return (song.audio?.offset ?? 0) + Math.max(0, k) * barSec;
}

/** Starts the recording so it lines up with a playback that begins at `fromBar`. */
export function startTrack(song: Song, fromBar: number, handle: PlayHandle, ctx: { currentTime: number }, speed: number) {
  if (!el || !song.audio || !loadedFor?.startsWith(song.id + ':')) return;
  const a = el;
  a.pause();
  a.playbackRate = speed;
  a.volume = song.audio.volume ?? 1;
  const at = audioTimeOfBar(song, fromBar);
  const wait = Math.max(0, handle.t0 - ctx.currentTime);
  if (at < 0) {
    // bar 1 is before the recording starts: wait for the recording to "begin"
    a.currentTime = 0;
    clearTimeout(startTimer);
    startTimer = setTimeout(() => void a.play().catch(() => {}), (wait + -at / speed) * 1000);
    return;
  }
  a.currentTime = at;
  clearTimeout(startTimer);
  startTimer = setTimeout(() => void a.play().catch(() => {}), wait * 1000);
}

export function stopTrack() {
  clearTimeout(startTimer);
  el?.pause();
}
