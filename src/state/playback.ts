import { create } from 'zustand';
import type { PlayHandle } from '../audio/player';
import type { Song } from '../model/types';

/** The playback that's running now, so live taps and the readout share its clock. */
export interface Session {
  h: PlayHandle;
  /** Bars it plays through, in order (repeats expanded). */
  order: number[];
  loop: boolean;
  from: number;
}

let current: Session | null = null;
export const session = () => current;
export const setSession = (s: Session | null) => void (current = s);

/** Ticks since playback's first downbeat, as heard now, less `lag` seconds of reaction time. */
export const heardTicks = (s: Session, lag = 0) => (s.h.heardNow() - lag - s.h.t0) / s.h.spt;

export interface LiveTap {
  partId: string;
  beatId: string;
  name: string;
  bar: number;
  tick: number;
  /** The song right after the tap, so Backspace can undo it exactly while nothing else has changed. */
  after: Song;
}

/** Chords dropped live while listening, newest last (Backspace takes the last one off). */
export const useLiveTaps = create<{ taps: LiveTap[] }>(() => ({ taps: [] }));
