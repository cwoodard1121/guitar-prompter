import { describe, expect, it } from 'vitest';
import { audioTimeOfBar } from './track';
import { newSong, setRepeat } from '../model/song';

describe('audioTimeOfBar', () => {
  it('maps bars to seconds in the recording from the bar-1 offset and tempo', () => {
    const s = { ...newSong(), tempo: 120, audio: { name: 'x.mp3', offset: 2.5, volume: 1 } }; // 4/4 @120 → 2 s per bar
    expect(audioTimeOfBar(s, 0)).toBe(2.5);
    expect(audioTimeOfBar(s, 3)).toBe(8.5);
  });

  it('counts repeated bars, since the recording plays them every time', () => {
    const s = { ...newSong(), tempo: 120, audio: { name: 'x.mp3', offset: 0, volume: 1 } };
    setRepeat(s, 0, 1, 2); // bars 0 1 0 1 2 …
    expect(audioTimeOfBar(s, 2)).toBe(8);
  });
});
