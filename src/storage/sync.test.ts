import { describe, expect, it } from 'vitest';
import { planSync, type RemoteMeta } from './sync';
import { newSong } from '../model/song';

const song = (id: string, updatedAt: number) => ({ ...newSong(id), id, updatedAt });
const meta = (id: string, updatedAt: number, deletedAt: number | null = null): RemoteMeta => ({ id, updatedAt, deletedAt });

describe('planSync', () => {
  it('first sync uploads everything local', () => {
    const p = planSync([song('a', 1), song('b', 2)], {}, []);
    expect(p.push.map((s) => s.id)).toEqual(['a', 'b']);
  });

  it('newest edit wins in both directions', () => {
    const p = planSync([song('a', 10), song('b', 5)], {}, [meta('a', 5), meta('b', 10)]);
    expect(p.push.map((s) => s.id)).toEqual(['a']);
    expect(p.pull).toEqual(['b']);
  });

  it('downloads songs made on the other device', () => {
    expect(planSync([], {}, [meta('x', 3)]).pull).toEqual(['x']);
  });

  it('a delete here is sent, not undone by the next pull', () => {
    const p = planSync([], { a: 20 }, [meta('a', 10)]);
    expect(p.pushDelete).toEqual([{ id: 'a', at: 20 }]);
    expect(p.pull).toEqual([]);
  });

  it('a delete on the other device removes it here', () => {
    const p = planSync([song('a', 10)], {}, [meta('a', 10, 15)]);
    expect(p.dropLocal).toEqual([{ id: 'a', at: 15 }]);
  });

  it('an edit made after the other device deleted it survives', () => {
    const p = planSync([song('a', 30)], {}, [meta('a', 10, 15)]);
    expect(p.push.map((s) => s.id)).toEqual(['a']);
    expect(p.dropLocal).toEqual([]);
  });

  it('an edit there after a delete here brings the song back', () => {
    const p = planSync([], { a: 10 }, [meta('a', 20)]);
    expect(p.pull).toEqual(['a']);
    expect(p.clearTombstones).toEqual(['a']);
  });

  it('forgets tombstones once both sides agree', () => {
    expect(planSync([], { a: 10 }, [meta('a', 10, 10)]).clearTombstones).toEqual(['a']);
    expect(planSync([], { b: 10 }, []).clearTombstones).toEqual(['b']);
  });

  it('does nothing when already in sync', () => {
    const p = planSync([song('a', 10)], {}, [meta('a', 10)]);
    expect(p).toEqual({ pull: [], push: [], pushDelete: [], dropLocal: [], clearTombstones: [] });
  });
});
