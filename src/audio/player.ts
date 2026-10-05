import type { Song } from '../model/types';
import { barCapacity, beatTicks } from '../model/song';
import { findVoicings } from '../model/voicing';

let ac: AudioContext | null = null;
const buffers = new Map<number, AudioBuffer>();

function audio() {
  ac ??= new AudioContext();
  if (ac.state === 'suspended') void ac.resume();
  return ac;
}

/** Karplus–Strong plucked string, rendered once per pitch and cached. */
function pluck(ctx: AudioContext, midi: number): AudioBuffer {
  const hit = buffers.get(midi);
  if (hit) return hit;
  const sr = ctx.sampleRate;
  const freq = 440 * 2 ** ((midi - 69) / 12);
  const len = Math.floor(sr * 2.6);
  const buf = ctx.createBuffer(1, len, sr);
  const d = buf.getChannelData(0);
  const N = Math.max(2, Math.round(sr / freq));
  const ring = new Float32Array(N);
  let prev = 0;
  for (let i = 0; i < N; i++) {
    const r = Math.random() * 2 - 1;
    prev = prev * 0.55 + r * 0.45; // soften the attack a little
    ring[i] = prev;
  }
  const decay = 0.9965 + Math.min(0.0025, 30 / freq / 100);
  let idx = 0;
  for (let n = 0; n < len; n++) {
    const a = ring[idx];
    const b = ring[(idx + 1) % N];
    const y = decay * 0.5 * (a + b);
    ring[idx] = y;
    d[n] = a;
    idx = (idx + 1) % N;
  }
  buffers.set(midi, buf);
  return buf;
}

export interface PlayHandle {
  stop(): void;
}

interface Ev {
  time: number;
  midis: number[];
  strum: boolean;
  len: number;
}

/**
 * Schedules the whole song from `fromBar` on the Web Audio clock.
 * `onBeat` reports which beat of each part is sounding, for the playhead.
 */
export function play(
  song: Song,
  fromBar: number,
  opts: { metronome: boolean; loopBars?: [number, number] },
  onBeat: (pos: Record<string, { bar: number; beat: number }>) => void,
  onEnd: () => void,
): PlayHandle {
  const ctx = audio();
  const master = ctx.createGain();
  master.gain.value = 0.55;
  master.connect(ctx.destination);
  const spt = 60 / song.tempo / 16; // seconds per tick (quarter = 16)
  const cap = barCapacity(song);
  const t0 = ctx.currentTime + 0.12;
  const nBars = song.parts[0]?.bars.length ?? 0;
  const timeline: { t: number; partId: string; bar: number; beat: number }[] = [];
  const events: Ev[] = [];

  for (const part of song.parts) {
    let chord: string | undefined;
    // carry the chord in effect before the start bar
    for (let b = 0; b < fromBar; b++) for (const bt of part.bars[b].beats) if (bt.chord) chord = bt.chord;
    for (let b = fromBar; b < nBars; b++) {
      let tick = (b - fromBar) * cap;
      part.bars[b].beats.forEach((beat, bi) => {
        const time = t0 + tick * spt;
        const len = beatTicks(beat) * spt;
        timeline.push({ t: time, partId: part.id, bar: b, beat: bi });
        if (beat.chord) chord = beat.chord;
        tick += beatTicks(beat);
        if (part.muted || beat.rest) return;
        if (part.kind === 'tab' && beat.notes.length) {
          events.push({
            time,
            len,
            strum: beat.notes.length > 2,
            midis: beat.notes
              .map((n) => ({ s: n.string, m: part.tuning[n.string] + part.capo + n.fret }))
              .sort((a, z) => z.s - a.s)
              .map((x) => x.m),
          });
        } else if (part.kind === 'chords' && chord) {
          const v = findVoicings(chord, part.tuning)[0];
          if (!v) return;
          const midis: number[] = [];
          for (let s = v.length - 1; s >= 0; s--) if (v[s] >= 0) midis.push(part.tuning[s] + part.capo + v[s]);
          events.push({ time, len, strum: true, midis });
        }
      });
    }
  }

  const sources: AudioScheduledSourceNode[] = [];
  for (const ev of events) {
    ev.midis.forEach((m, i) => {
      const src = ctx.createBufferSource();
      src.buffer = pluck(ctx, m);
      const g = ctx.createGain();
      const start = ev.time + (ev.strum ? i * 0.014 : 0);
      const end = start + Math.max(0.12, ev.len) + 0.08;
      g.gain.setValueAtTime(ev.strum ? 0.32 : 0.5, start);
      g.gain.setTargetAtTime(0, end, 0.05);
      src.connect(g).connect(master);
      src.start(start);
      src.stop(end + 0.4);
      sources.push(src);
    });
  }

  const total = (nBars - fromBar) * cap * spt;
  if (opts.metronome) {
    const step = 64 / song.timeSig[1];
    for (let t = 0, k = 0; t < (nBars - fromBar) * cap; t += step, k++) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      const at = t0 + t * spt;
      o.frequency.value = k % song.timeSig[0] === 0 ? 1500 : 1000;
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(0.25, at + 0.002);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.05);
      o.connect(g).connect(master);
      o.start(at);
      o.stop(at + 0.06);
      sources.push(o);
    }
  }

  timeline.sort((a, b) => a.t - b.t);
  let raf = 0;
  let last = '';
  let stopped = false;
  const tick = () => {
    if (stopped) return;
    const now = ctx.currentTime;
    if (now > t0 + total + 0.1) {
      stop();
      onEnd();
      return;
    }
    const pos: Record<string, { bar: number; beat: number }> = {};
    for (const e of timeline) {
      if (e.t > now) break;
      pos[e.partId] = { bar: e.bar, beat: e.beat };
    }
    const key = JSON.stringify(pos);
    if (key !== last) {
      last = key;
      onBeat(pos);
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  function stop() {
    if (stopped) return;
    stopped = true;
    cancelAnimationFrame(raf);
    master.gain.setTargetAtTime(0, ctx.currentTime, 0.03);
    setTimeout(() => {
      sources.forEach((s) => {
        try {
          s.stop();
        } catch {
          /* already stopped */
        }
      });
      master.disconnect();
    }, 150);
  }
  return { stop };
}

/** Plays a single pitch or chord immediately (fretboard / palette feedback). */
export function audition(midis: number[], strum = false) {
  const ctx = audio();
  const now = ctx.currentTime + 0.01;
  midis.forEach((m, i) => {
    const src = ctx.createBufferSource();
    src.buffer = pluck(ctx, m);
    const g = ctx.createGain();
    g.gain.setValueAtTime(strum ? 0.28 : 0.45, now);
    g.gain.setTargetAtTime(0, now + 1.1, 0.25);
    src.connect(g).connect(ctx.destination);
    src.start(now + (strum ? i * 0.018 : 0));
    src.stop(now + 2.4);
  });
}
