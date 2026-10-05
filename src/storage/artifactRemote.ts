import type { Song } from '../model/types';
import type { RemoteStore } from './storage';

/* Minimal typings for the claude.ai artifact runtime (only what we call). */
interface DocSnap {
  id: string;
  exists: boolean;
  data(): Record<string, unknown> | undefined;
}
interface DocRef {
  set(data: Record<string, unknown>): Promise<void>;
  delete(): Promise<void>;
}
interface CollectionRef {
  doc(id: string): DocRef;
  get(): Promise<{ docs: DocSnap[] }>;
}
interface DbNs {
  collection(path: string): CollectionRef;
}
interface UserNs {
  id(): Promise<string | null>;
}
interface ClaudeRuntime {
  use(name: string): Promise<unknown>;
}

export const runtime = (): ClaudeRuntime | null =>
  (globalThis as unknown as { claude?: ClaudeRuntime }).claude ?? null;

/**
 * Songs stored in the artifact's private per-viewer subtree (data/users/<id>),
 * so they follow Cameron between the PC and the laptop. Null when not running
 * inside a claude.ai artifact or signed out.
 */
export async function artifactRemote(): Promise<RemoteStore | null> {
  const claude = runtime();
  if (!claude?.use) return null;
  const [db, user] = (await Promise.all([claude.use('db'), claude.use('user')])) as [DbNs | null, UserNs | null];
  if (!db || !user) return null;
  const id = await user.id();
  if (!id) return null;
  const col = db.collection(`data/users/${id}`);
  return {
    name: 'claude.ai',
    async list() {
      const snap = await col.get();
      const out: Song[] = [];
      for (const d of snap.docs) {
        const body = d.data();
        if (!body || typeof body.json !== 'string') continue;
        try {
          out.push(JSON.parse(body.json));
        } catch {
          /* skip a corrupt row rather than failing the whole sync */
        }
      }
      return out;
    },
    put: (song) => col.doc(song.id).set({ json: JSON.stringify(song), title: song.title, updatedAt: song.updatedAt }),
    remove: (songId) => col.doc(songId).delete(),
  };
}
