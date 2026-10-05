import { Accidental, Beam, Dot, Formatter, GhostNote, Renderer, Stave, StaveNote, TabNote, TabStave, Voice } from 'vexflow';
import type { Beat, Part, Song } from '../model/types';
import { barCapacity, beatTicks, isBarFull } from '../model/song';
import { mod12, transposeChord } from '../model/music';
import type { CapoView } from '../state/store';

export interface Theme {
  ink: string;
  dim: string;
  staff: string;
  staffDim: string;
  chord: string;
  chordDim: string;
  marker: string;
  bg: string;
  font: string;
}

export interface RenderOpts {
  width: number;
  theme: Theme;
  focusId: string | null;
  focusOnly: boolean;
  capoView: CapoView;
}

export interface BarHit {
  bar: number;
  x: number;
  w: number;
  beatXs: number[];
  /** Where a new beat would go, or null when the bar is full. */
  appendX: number | null;
}

export interface RowHit {
  partId: string;
  kind: Part['kind'];
  top: number;
  bottom: number;
  /** y of each tab line (string 0 first); empty for chord rows. */
  stringYs: number[];
  /** y of the notation staff top/bottom, for tab parts. */
  staffTop?: number;
  bars: BarHit[];
}

export interface SystemLayout {
  first: number;
  last: number;
  top: number;
  bottom: number;
  rows: RowHit[];
}

export interface ScoreLayout {
  height: number;
  systems: SystemLayout[];
}

const MARGIN_X = 8;
const SYSTEM_GAP = 30;
const ROW_GAP = 6;
const CHORD_ROW_H = 54;

const BEAT_W: Record<number, number> = { 1: 50, 2: 40, 4: 33, 8: 27, 16: 23, 32: 21 };

/** Chord name as displayed: shapes as written, or translated to concert pitch when playing without the capo. */
export const displayChord = (name: string, part: Part, view: CapoView) =>
  view === 'concert' && part.capo ? transposeChord(name, part.capo) : name;

export const displayFret = (fret: number, part: Part, view: CapoView) =>
  view === 'concert' ? fret + part.capo : fret;

function beatWidth(b: Beat) {
  const base = BEAT_W[b.dur] * (b.dotted ? 1.15 : 1);
  return b.chord ? Math.max(base, b.chord.length * 8 + 8) : base;
}

function barMinWidth(song: Song, parts: Part[], bar: number) {
  let w = 70;
  for (const p of parts) {
    const beats = p.bars[bar].beats;
    let sum = beats.reduce((s, b) => s + beatWidth(b), 0) + 22;
    if (!isBarFull(song, p.bars[bar])) sum += 24; // room for the append slot
    w = Math.max(w, sum);
  }
  return w;
}

const isBassTuning = (t: number[]) => Math.max(...t) < 50;

/** Splits bars into systems (lines) that fit the width, then stretches them to fill. */
function layoutSystems(song: Song, parts: Part[], width: number) {
  const avail = width - MARGIN_X * 2;
  const n = parts[0]?.bars.length ?? 0;
  const systems: { bars: number[]; widths: number[] }[] = [];
  let cur: number[] = [];
  let curW: number[] = [];
  let used = 0;
  for (let i = 0; i < n; i++) {
    const lead = (cur.length === 0 ? 46 : 0) + (i === 0 ? 24 : 0);
    const w = barMinWidth(song, parts, i) + lead;
    if (cur.length && used + w > avail) {
      systems.push({ bars: cur, widths: curW });
      cur = [];
      curW = [];
      used = 0;
      const lead2 = 46 + (i === 0 ? 24 : 0);
      cur.push(i);
      curW.push(w - lead + lead2);
      used = w - lead + lead2;
      continue;
    }
    cur.push(i);
    curW.push(w);
    used += w;
  }
  if (cur.length) systems.push({ bars: cur, widths: curW });
  systems.forEach((s, idx) => {
    const total = s.widths.reduce((a, b) => a + b, 0);
    const last = idx === systems.length - 1;
    const k = last && total < avail * 0.72 ? Math.min(1.35, avail / total) : avail / total;
    s.widths = s.widths.map((w) => w * k);
  });
  return systems;
}

function pitchKey(midi: number) {
  const written = midi + 12; // guitar & bass sound an octave below written
  const names = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b'];
  return { key: `${names[mod12(written)]}/${Math.floor(written / 12) - 1}`, sharp: names[mod12(written)].length > 1 };
}

type Ctx = ReturnType<Renderer['getContext']>;

export function renderScore(el: HTMLElement, song: Song, opts: RenderOpts): ScoreLayout {
  el.innerHTML = '';
  const parts = opts.focusOnly ? song.parts.filter((p) => p.id === opts.focusId) : song.parts;
  const renderer = new Renderer(el as HTMLDivElement, Renderer.Backends.SVG);
  const ctx = renderer.getContext();
  (ctx as unknown as { setBackgroundFillStyle?: (s: string) => void }).setBackgroundFillStyle?.(opts.theme.bg);
  const systems = layoutSystems(song, parts, opts.width);
  const out: SystemLayout[] = [];

  // Measure pass is the draw pass: VexFlow tells us real heights as we go.
  let y = 6;
  for (const sys of systems) {
    const top = y;
    const rows: RowHit[] = [];
    const markerRoom = song.markers.some((m) => sys.bars.includes(m.bar)) ? 18 : 6;
    y += markerRoom;
    for (const part of parts) {
      const dim = !opts.focusOnly && opts.focusId !== null && part.id !== opts.focusId;
      const row = part.kind === 'tab'
        ? drawTabRow(ctx, song, part, sys, y, opts, dim)
        : drawChordRow(ctx, song, part, sys, y, opts, dim);
      rows.push(row);
      y = row.bottom + ROW_GAP;
    }
    // section markers + bar numbers above the first row
    const firstRow = rows[0];
    ctx.save();
    ctx.setFont(opts.theme.font, 11, 'bold');
    ctx.setFillStyle(opts.theme.marker);
    for (const bh of firstRow.bars) {
      const m = song.markers.find((mk) => mk.bar === bh.bar);
      if (m) ctx.fillText(m.label.toUpperCase(), bh.x + 4, top + markerRoom - 4);
    }
    ctx.setFont(opts.theme.font, 9, 'normal');
    ctx.setFillStyle(opts.theme.staff);
    ctx.fillText(String(sys.bars[0] + 1), MARGIN_X, firstRow.top + 4);
    ctx.restore();
    out.push({ first: sys.bars[0], last: sys.bars[sys.bars.length - 1], top, bottom: y, rows });
    y += SYSTEM_GAP - ROW_GAP;
  }
  renderer.resize(opts.width, y);
  return { height: y, systems: out };
}

function barXs(sys: { bars: number[]; widths: number[] }) {
  let x = MARGIN_X;
  return sys.bars.map((bar, i) => {
    const r = { bar, x, w: sys.widths[i] };
    x += sys.widths[i];
    return r;
  });
}

function drawTabRow(
  ctx: Ctx,
  song: Song,
  part: Part,
  sys: { bars: number[]; widths: number[] },
  y: number,
  opts: RenderOpts,
  dim: boolean,
): RowHit {
  const { theme } = opts;
  const ink = dim ? theme.dim : theme.ink;
  const staffInk = dim ? theme.staffDim : theme.staff;
  const chordInk = dim ? theme.chordDim : theme.chord;
  const bass = isBassTuning(part.tuning);
  const nStr = part.tuning.length;
  const hasChords = sys.bars.some((b) => part.bars[b].beats.some((x) => x.chord));
  const chordRoom = hasChords ? 30 : 8;
  const staveY = y + chordRoom;
  const bars: BarHit[] = [];
  let bottom = y;
  let stringYs: number[] = [];
  let staffTop = 0;

  ctx.save();
  ctx.setFillStyle(ink);
  ctx.setStrokeStyle(ink);

  barXs(sys).forEach(({ bar, x, w }, i) => {
    const stave = new Stave(x, staveY, w, { space_above_staff_ln: 1, space_below_staff_ln: 0 } as never);
    (stave as unknown as { options: { fill_style: string } }).options.fill_style = staffInk;
    if (i === 0) stave.addClef(bass ? 'bass' : 'treble', 'default', '8vb');
    if (bar === 0) stave.addTimeSignature(`${song.timeSig[0]}/${song.timeSig[1]}`);
    const tabY = stave.getBottomLineY() + 14;
    const tab = new TabStave(x, tabY, w, { num_lines: nStr, space_above_staff_ln: 0.5, space_below_staff_ln: 0 } as never);
    (tab as unknown as { options: { fill_style: string } }).options.fill_style = staffInk;
    if (i === 0) tab.addClef('tab');
    const sx = Math.max(stave.getNoteStartX(), tab.getNoteStartX());
    stave.setNoteStartX(sx);
    tab.setNoteStartX(sx);
    stave.setContext(ctx).draw();
    tab.setContext(ctx).draw();
    staffTop = stave.getYForLine(0);
    stringYs = Array.from({ length: nStr }, (_, s) => tab.getYForLine(s));
    bottom = Math.max(bottom, tab.getBottomLineY() + 8);

    const beats = part.bars[bar].beats;
    const restKey = bass ? 'd/3' : 'b/4';
    let beatXs: number[] = [];
    if (!beats.length) {
      const r = new StaveNote({ keys: [restKey], duration: 'wr', align_center: true } as never);
      r.setStyle({ fillStyle: staffInk, strokeStyle: staffInk });
      const v = new Voice({ num_beats: song.timeSig[0], beat_value: song.timeSig[1] }).setMode(Voice.Mode.SOFT);
      v.addTickables([r]);
      new Formatter().joinVoices([v]).format([v], stave.getNoteEndX() - sx - 10);
      v.draw(ctx, stave);
    } else {
      const sNotes: StaveNote[] = [];
      const tNotes: (TabNote | GhostNote)[] = [];
      for (const b of beats) {
        const d = String(b.dur);
        if (b.rest || !b.notes.length) {
          const r = new StaveNote({ keys: [restKey], duration: d + 'r', clef: bass ? 'bass' : 'treble' } as never);
          if (b.dotted) Dot.buildAndAttach([r], { all: true });
          sNotes.push(r);
          const g = new GhostNote({ duration: d + (b.dotted ? 'd' : '') } as never);
          tNotes.push(g);
          continue;
        }
        const pitched = b.notes
          .map((n) => ({ n, midi: part.tuning[n.string] + part.capo + n.fret }))
          .sort((a, z) => a.midi - z.midi);
        const keys = pitched.map((p) => pitchKey(p.midi));
        const sn = new StaveNote({
          keys: keys.map((k) => k.key),
          duration: d,
          clef: bass ? 'bass' : 'treble',
          auto_stem: true,
        } as never);
        keys.forEach((k, idx) => k.sharp && sn.addModifier(new Accidental('#'), idx));
        if (b.dotted) Dot.buildAndAttach([sn], { all: true });
        sNotes.push(sn);
        const tn = new TabNote({
          positions: b.notes.map((n) => ({ str: n.string + 1, fret: displayFret(n.fret, part, opts.capoView) })),
          duration: d + (b.dotted ? 'd' : ''),
        } as never);
        tNotes.push(tn);
      }
      for (const n of [...sNotes, ...tNotes]) n.setStyle({ fillStyle: ink, strokeStyle: ink });
      const beams = Beam.generateBeams(sNotes.filter((n) => !n.isRest()) as never);
      const vs = new Voice({ num_beats: song.timeSig[0], beat_value: song.timeSig[1] }).setMode(Voice.Mode.SOFT);
      vs.addTickables(sNotes);
      const vt = new Voice({ num_beats: song.timeSig[0], beat_value: song.timeSig[1] }).setMode(Voice.Mode.SOFT);
      vt.addTickables(tNotes);
      const full = isBarFull(song, part.bars[bar]);
      const room = stave.getNoteEndX() - sx - (full ? 12 : 36);
      new Formatter().joinVoices([vs]).joinVoices([vt]).format([vs, vt], Math.max(20, room));
      vs.draw(ctx, stave);
      vt.draw(ctx, tab);
      for (const bm of beams) {
        bm.setStyle({ fillStyle: ink, strokeStyle: ink });
        bm.setContext(ctx).draw();
      }
      beatXs = sNotes.map((n) => n.getAbsoluteX() + 5);
      // chord names above the staff
      ctx.save();
      ctx.setFont(opts.theme.font, 12, 'bold');
      ctx.setFillStyle(chordInk);
      beats.forEach((b, bi) => {
        if (b.chord) ctx.fillText(displayChord(b.chord, part, opts.capoView), beatXs[bi] - 4, y + 13);
      });
      ctx.restore();
    }
    const full = isBarFull(song, part.bars[bar]) && beats.length > 0;
    const appendX = full
      ? null
      : beats.length
        ? Math.min(x + w - 14, beatXs[beatXs.length - 1] + 24)
        : sx + 14;
    bars.push({ bar, x, w, beatXs, appendX });
  });
  ctx.restore();
  return { partId: part.id, kind: 'tab', top: y, bottom, stringYs, staffTop, bars };
}

function drawChordRow(
  ctx: Ctx,
  song: Song,
  part: Part,
  sys: { bars: number[]; widths: number[] },
  y: number,
  opts: RenderOpts,
  dim: boolean,
): RowHit {
  const { theme } = opts;
  const ink = dim ? theme.dim : theme.ink;
  const staffInk = dim ? theme.staffDim : theme.staff;
  const chordInk = dim ? theme.chordDim : theme.chord;
  const lineY = y + 38;
  const cap = barCapacity(song);
  const bars: BarHit[] = [];
  ctx.save();
  barXs(sys).forEach(({ bar, x, w }, i) => {
    // staff: one line + bar lines
    ctx.setStrokeStyle(staffInk);
    ctx.setLineWidth(1);
    ctx.beginPath();
    ctx.moveTo(x, lineY);
    ctx.lineTo(x + w, lineY);
    ctx.moveTo(x + w, lineY - 10);
    ctx.lineTo(x + w, lineY + 10);
    if (i === 0) {
      ctx.moveTo(x, lineY - 10);
      ctx.lineTo(x, lineY + 10);
    }
    ctx.stroke();
    if (bar === 0) {
      ctx.setFont(theme.font, 10, 'bold');
      ctx.setFillStyle(staffInk);
      ctx.fillText(`${song.timeSig[0]}/${song.timeSig[1]}`, x + 6, lineY + 4);
    }
    const inner = x + (bar === 0 ? 36 : 14);
    const innerW = x + w - inner - 12;
    const beats = part.bars[bar].beats;
    let t = 0;
    const beatXs: number[] = [];
    for (const b of beats) {
      const cx = inner + (t / cap) * innerW + 6;
      beatXs.push(cx);
      t += beatTicks(b);
      ctx.setStrokeStyle(ink);
      ctx.setFillStyle(ink);
      if (b.rest) {
        ctx.setLineWidth(2);
        ctx.beginPath();
        ctx.moveTo(cx - 4, lineY - 3);
        ctx.lineTo(cx + 4, lineY - 3);
        ctx.stroke();
      } else {
        // slash: thick for quarter & shorter, outlined for half/whole
        ctx.setLineWidth(b.dur <= 2 ? 1.2 : 3.2);
        ctx.beginPath();
        ctx.moveTo(cx - 5, lineY + 7);
        ctx.lineTo(cx + 5, lineY - 7);
        if (b.dur <= 2) {
          ctx.moveTo(cx - 2, lineY + 7);
          ctx.lineTo(cx + 8, lineY - 7);
        }
        ctx.stroke();
        if (b.dur >= 8) {
          // flag ticks for eighths/sixteenths
          ctx.setLineWidth(1.2);
          for (let k = 0; k < (b.dur >= 16 ? 2 : 1); k++) {
            ctx.beginPath();
            ctx.moveTo(cx + 5, lineY - 7 + k * 4);
            ctx.lineTo(cx + 10, lineY - 3 + k * 4);
            ctx.stroke();
          }
        }
        if (b.dotted) {
          ctx.beginPath();
          ctx.arc(cx + 10, lineY + 2, 1.6, 0, Math.PI * 2, false);
          ctx.fill();
        }
      }
      if (b.chord) {
        ctx.setFont(theme.font, 15, 'bold');
        ctx.setFillStyle(chordInk);
        ctx.fillText(displayChord(b.chord, part, opts.capoView), cx - 6, y + 18);
      }
    }
    const full = isBarFull(song, part.bars[bar]) && beats.length > 0;
    const appendX = full ? null : beats.length ? Math.min(x + w - 10, beatXs[beatXs.length - 1] + 20) : inner + 8;
    bars.push({ bar, x, w, beatXs, appendX });
  });
  ctx.restore();
  return { partId: part.id, kind: 'chords', top: y, bottom: y + CHORD_ROW_H, stringYs: [], bars };
}

export interface Hit {
  partId: string;
  bar: number;
  beat: number;
  string?: number;
}

/** Maps a click inside the score to a part / bar / beat / string. */
export function hitTest(layout: ScoreLayout, song: Song, px: number, py: number): Hit | null {
  const sys = layout.systems.find((s) => py >= s.top && py <= s.bottom) ?? null;
  if (!sys) return null;
  const row = sys.rows.find((r) => py >= r.top - 3 && py <= r.bottom + 3) ?? sys.rows[sys.rows.length - 1];
  const bh = row.bars.find((b) => px >= b.x && px < b.x + b.w);
  if (!bh) return null;
  const xs = [...bh.beatXs];
  if (bh.appendX !== null) xs.push(bh.appendX);
  let beat = 0;
  let best = Infinity;
  xs.forEach((x, i) => {
    const d = Math.abs(x - px);
    if (d < best) {
      best = d;
      beat = i;
    }
  });
  const hit: Hit = { partId: row.partId, bar: bh.bar, beat };
  if (row.kind === 'tab' && row.stringYs.length && py >= row.stringYs[0] - 8) {
    let s = 0;
    let bd = Infinity;
    row.stringYs.forEach((sy, i) => {
      if (Math.abs(sy - py) < bd) {
        bd = Math.abs(sy - py);
        s = i;
      }
    });
    hit.string = s;
  }
  void song;
  return hit;
}
