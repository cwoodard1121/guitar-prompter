import type { AudioTrack } from '../model/types';

/**
 * What a song's recording needs on this device.
 * - play: `ready` (a matching file is here), `download` (fetch it from the account),
 *   `signin` (it's in the account but we're signed out), `missing` (only on another device, never uploaded)
 * - upload: this device holds the current file and the account doesn't have it yet
 */
export interface AudioPlan {
  play: 'ready' | 'download' | 'signin' | 'missing';
  upload: boolean;
}

export function planAudio(audio: AudioTrack, localRev: string | undefined | null, signedIn: boolean): AudioPlan {
  // null = no local file; undefined = a local file saved before revisions existed
  const hasLocal = localRev !== null;
  const current = hasLocal && (localRev === audio.rev || (!audio.rev && localRev === undefined));
  if (current) return { play: 'ready', upload: signedIn && !audio.uploaded };
  if (audio.uploaded) return { play: signedIn ? 'download' : 'signin', upload: false };
  return { play: 'missing', upload: false };
}

/** Storage object path: the first folder is the owner, which is what the RLS policies check. */
export const audioPath = (userId: string, songId: string) => `${userId}/${songId}`;

const TYPES: Record<string, string> = { mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac', wav: 'audio/wav', ogg: 'audio/ogg', flac: 'audio/flac', webm: 'audio/webm' };

/** Content type for upload; the bucket only accepts audio/*. */
export function audioType(name: string, type: string): string {
  if (type.startsWith('audio/')) return type;
  return TYPES[name.split('.').pop()?.toLowerCase() ?? ''] ?? 'audio/mpeg';
}
