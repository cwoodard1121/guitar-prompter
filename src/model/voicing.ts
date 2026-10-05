import { mod12, parseChord } from './music';

/** Frets per string (index 0 = highest string), -1 = muted. Capo-relative. */
export type Voicing = number[];

interface Options {
  maxFret?: number;
  /** Largest stretch between lowest and highest fretted note. */
  maxSpan?: number;
  limit?: number;
}

const cache = new Map<string, Voicing[]>();

/**
 * Finds playable voicings for a chord by search, not by lookup table:
 * every voicing is built from the chord's actual tones on the given tuning,
 * so it is correct by construction for any root, quality, slash bass or tuning.
 */
export function findVoicings(name: string, tuning: number[], opts: Options = {}): Voicing[] {
  const { maxFret = 12, maxSpan = 3, limit = 8 } = opts;
  const key = `${name}|${tuning.join(',')}|${maxFret}|${maxSpan}|${limit}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const chord = parseChord(name);
  if (!chord?.quality) {
    cache.set(key, []);
    return [];
  }
  const q = chord.quality;
  const tones = q.intervals.map((i) => mod12(chord.root + i));
  const optional = new Set((q.optional ?? []).map((i) => mod12(chord.root + i)));
  const pcs = new Set(tones);
  const required = [...pcs].filter((pc) => !optional.has(pc));
  const bass = chord.bass ?? chord.root;
  if (chord.bass !== undefined) pcs.add(chord.bass);

  const n = tuning.length;
  const low = n - 1;
  // Power chords and dyads are played on 2–3 strings with the top strings muted.
  const small = pcs.size <= 2;
  const minSounding = small ? 2 : n >= 6 ? 4 : n >= 4 ? 3 : 2;
  const found = new Map<string, { v: Voicing; score: number }>();

  for (let start = 1; start <= maxFret - maxSpan; start++) {
    const choices: number[][] = tuning.map((open) => {
      const c = [-1];
      if (pcs.has(mod12(open))) c.push(0);
      for (let f = start; f <= start + maxSpan; f++) if (pcs.has(mod12(open + f))) c.push(f);
      return c;
    });

    const cur: number[] = new Array(n).fill(-1);
    // Walk from the lowest string up. Phase 0 = bass-side mutes, 1 = sounding,
    // 2 = treble-side mutes (power chords only). No interior mutes.
    const walk = (s: number, phase: 0 | 1 | 2) => {
      if (s < 0) {
        evaluate(cur.slice());
        return;
      }
      for (const f of choices[s]) {
        let next: 0 | 1 | 2 = phase;
        if (f === -1) {
          if (phase === 1) {
            if (!small) continue;
            next = 2;
          }
        } else {
          if (phase === 2) continue;
          // First sounding (lowest) note must be the bass.
          if (phase === 0 && mod12(tuning[s] + f) !== bass) continue;
          next = 1;
        }
        cur[s] = f;
        walk(s - 1, next);
      }
      cur[s] = -1;
    };
    walk(low, 0);
  }

  function evaluate(v: Voicing) {
    const sounding = v.filter((f) => f >= 0);
    if (sounding.length < minSounding) return;
    const present = new Set(v.map((f, i) => (f >= 0 ? mod12(tuning[i] + f) : -1)));
    for (const pc of required) if (!present.has(pc)) return;
    if (chord!.bass !== undefined && !present.has(chord!.root)) return;
    const fretted = v.filter((f) => f > 0);
    const minF = fretted.length ? Math.min(...fretted) : 0;
    const maxF = fretted.length ? Math.max(...fretted) : 0;
    if (maxF - minF > maxSpan) return;
    // Barre: the lowest fret on 2+ strings is one finger.
    const atMin = fretted.filter((f) => f === minF).length;
    const fingers = atMin >= 2 ? 1 + fretted.filter((f) => f > minF).length : fretted.length;
    if (fingers > 4) return;
    const opens = v.filter((f) => f === 0).length;
    const muted = n - sounding.length;
    const missingOptional = [...optional].filter((pc) => !present.has(pc)).length;
    const score =
      minF * 1.4 + muted * 1.6 + fingers * 0.45 + (maxF - minF) ** 2 * 0.3 - opens * 0.7 + missingOptional * 0.8 +
      (atMin >= 2 && opens === 0 ? 0.6 : 0); // barre chords cost a little more than open shapes
    const k = v.join(',');
    const prev = found.get(k);
    if (!prev || prev.score > score) found.set(k, { v, score });
  }

  const out = [...found.values()].sort((a, b) => a.score - b.score).slice(0, limit).map((x) => x.v);
  cache.set(key, out);
  return out;
}
