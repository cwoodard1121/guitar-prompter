// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { renderScore, type Theme } from './score';
import { newSong, newBeat } from '../model/song';
import type { Song } from '../model/types';

// jsdom has no layout engine; VexFlow only needs a rough text size for tab numbers and labels.
(SVGElement.prototype as unknown as { getBBox: () => DOMRect }).getBBox = function (this: SVGElement) {
  const n = (this.textContent ?? '').length;
  return { x: 0, y: 0, width: n * 6, height: 10 } as DOMRect;
};

const theme: Theme = {
  ink: '#000', dim: '#888', staff: '#555', staffDim: '#aaa', chord: '#08f', chordDim: '#8af', marker: '#f80', bg: '#fff', font: 'sans-serif',
};

function songWithRiff(): Song {
  const s = newSong('test');
  const tab = s.parts.find((p) => p.kind === 'tab')!;
  // dotted 8th, 16th, then quarters — the rhythm that used to misalign notation vs tab
  tab.bars[0].beats = [
    newBeat(8, { dotted: true, notes: [{ string: 1, fret: 7, bend: 2 }] }),
    newBeat(16, { notes: [{ string: 1, fret: 5, legato: 'h' }] }),
    newBeat(4, { notes: [{ string: 1, fret: 7, vibrato: true }] }),
    newBeat(4, { notes: [{ string: 2, fret: 5, slide: 'up' }] }),
    newBeat(4, { notes: [{ string: 2, fret: 7 }] }),
  ];
  const chords = s.parts.find((p) => p.kind === 'chords')!;
  chords.bars[0].beats[0].chord = 'G';
  chords.bars[0].beats[2].chord = 'D/F#';
  return s;
}

describe('renderScore', () => {
  it('draws bends, hammer-ons, slides and vibrato without throwing', () => {
    const el = document.createElement('div');
    const s = songWithRiff();
    const layout = renderScore(el, s, { width: 1000, theme, focusId: null, focusOnly: false, capoView: 'shapes' });
    expect(layout.systems.length).toBeGreaterThan(0);
    const texts = [...el.querySelectorAll('text')].map((t) => t.textContent);
    expect(texts).toContain('Full'); // bend label
    expect(texts).toContain('H'); // hammer-on label
  });

  it('keeps notation and tab beats aligned after a dotted note', () => {
    const el = document.createElement('div');
    const s = songWithRiff();
    const tab = s.parts.find((p) => p.kind === 'tab')!;
    const layout = renderScore(el, s, { width: 1000, theme, focusId: null, focusOnly: true, capoView: 'shapes' });
    // focusOnly shows the focused part; null focus → nothing, so focus the tab part
    const l2 = renderScore(el, s, { width: 1000, theme, focusId: tab.id, focusOnly: true, capoView: 'shapes' });
    void layout;
    const bar = l2.systems[0].rows[0].bars[0];
    expect(bar.tabXs).toHaveLength(bar.beatXs.length);
    // every tab number sits under its notation note
    bar.beatXs.forEach((x, i) => expect(Math.abs(x - bar.tabXs![i])).toBeLessThan(3));
  });

  it('tabs out chord shapes under a chord part', () => {
    const el = document.createElement('div');
    const s = songWithRiff();
    const chords = s.parts.find((p) => p.kind === 'chords')!;
    renderScore(el, s, { width: 1000, theme, focusId: chords.id, focusOnly: true, capoView: 'shapes' });
    const texts = [...el.querySelectorAll('text')].map((t) => t.textContent);
    // G = 320003 → the frets 3,2,0,0,0,3 appear as tab digits
    expect(texts.filter((t) => t === '3').length).toBeGreaterThanOrEqual(2);
  });
});
