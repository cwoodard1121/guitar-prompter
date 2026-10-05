import { describe, expect, it } from 'vitest';
import { moveItem, newSetlist, setEntries, setNeighbours, setSummary } from './setlist';
import { newSong } from './song';
import { planSync } from '../storage/sync';

const lib = ['a', 'b', 'c', 'd'].map((id) => ({ ...newSong(id.toUpperCase()), id, tempo: 120 }));

describe('setlists', () => {
  it('moves items for drag and drop', () => {
    expect(moveItem(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(moveItem(['a', 'b', 'c', 'd'], 3, 0)).toEqual(['d', 'a', 'b', 'c']);
    expect(moveItem(['a', 'b'], 1, 9)).toEqual(['a', 'b']);
    expect(moveItem(['a', 'b'], 5, 0)).toEqual(['a', 'b']);
  });

  it('marks deleted songs as missing', () => {
    const set = newSetlist('Gig', ['a', 'gone', 'c']);
    expect(setEntries(set, lib).map((e) => e.song?.title ?? null)).toEqual(['A', null, 'C']);
  });

  it('steps over missing songs when playing through', () => {
    const set = newSetlist('Gig', ['a', 'gone', 'c', 'd']);
    const n = setNeighbours(set, lib, 0);
    expect(n.prev).toBeNull();
    expect(n.next?.songId).toBe('c');
    expect([n.position, n.total]).toEqual([1, 3]);
    const m = setNeighbours(set, lib, 2);
    expect(m.prev?.songId).toBe('a');
    expect(m.next?.songId).toBe('d');
    expect(m.position).toBe(2);
  });

  it('summarises length', () => {
    // newSong has 8 bars of 4/4: 32 beats at 120 bpm = 16 s each
    const set = newSetlist('Gig', ['a', 'b', 'c', 'd', 'x']);
    expect(setSummary(set, lib)).toBe('4 songs · ~1 min · 1 missing');
    expect(setSummary(newSetlist('Empty'), lib)).toBe('0 songs');
  });

  it('syncs with the same newest-wins rules as songs', () => {
    const local = { ...newSetlist('Gig'), id: 's1', updatedAt: 20 };
    const p = planSync([local], {}, [{ id: 's1', updatedAt: 10, deletedAt: null }]);
    expect(p.push.map((s) => s.name)).toEqual(['Gig']);
  });
});
