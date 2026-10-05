/** Anything that syncs: songs, setlists. */
export interface Synced {
  id: string;
  updatedAt: number;
}

/** What the remote knows about a song without downloading it. Times are epoch ms. */
export interface RemoteMeta {
  id: string;
  updatedAt: number;
  deletedAt: number | null;
}

export interface SyncPlan<T extends Synced = Synced> {
  /** Remote is newer: download these and replace local. */
  pull: string[];
  /** Local is newer (or remote has never seen it): upload. */
  push: T[];
  /** Deleted here, still alive remotely: send the tombstone. */
  pushDelete: { id: string; at: number }[];
  /** Deleted on the other device: remove locally. */
  dropLocal: { id: string; at: number }[];
  /** Local tombstones the remote already agrees with (safe to forget). */
  clearTombstones: string[];
}

/**
 * Newest-wins reconciliation between this device and the remote.
 * Pure, so every rule below is unit tested.
 */
export function planSync<T extends Synced>(local: T[], tombstones: Record<string, number>, remote: RemoteMeta[]): SyncPlan<T> {
  const plan: SyncPlan<T> = { pull: [], push: [], pushDelete: [], dropLocal: [], clearTombstones: [] };
  const byId = new Map(local.map((s) => [s.id, s]));
  const seen = new Set<string>();

  for (const r of remote) {
    seen.add(r.id);
    const l = byId.get(r.id);
    const t = tombstones[r.id];
    if (r.deletedAt !== null) {
      if (l && l.updatedAt > r.deletedAt) plan.push.push(l); // edited here after it was deleted there: keep it
      else if (l) plan.dropLocal.push({ id: r.id, at: r.deletedAt });
      if (t !== undefined) plan.clearTombstones.push(r.id);
      continue;
    }
    if (t !== undefined && !l) {
      if (t >= r.updatedAt) plan.pushDelete.push({ id: r.id, at: t });
      else {
        plan.pull.push(r.id); // edited there after we deleted it: bring it back
        plan.clearTombstones.push(r.id);
      }
      continue;
    }
    if (!l) plan.pull.push(r.id);
    else if (r.updatedAt > l.updatedAt) plan.pull.push(r.id);
    else if (l.updatedAt > r.updatedAt) plan.push.push(l);
  }

  for (const l of local) if (!seen.has(l.id)) plan.push.push(l);
  for (const id of Object.keys(tombstones)) if (!seen.has(id)) plan.clearTombstones.push(id);
  return plan;
}
