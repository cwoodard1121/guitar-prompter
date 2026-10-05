import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStore, focusedPart } from './state/store';
import { TopBar } from './ui/TopBar';
import { Toolbar } from './ui/Toolbar';
import { PartsRail } from './ui/PartsRail';
import { ScoreView } from './ui/ScoreView';
import { Fretboard } from './ui/Fretboard';
import { ChordPalette } from './ui/ChordPalette';
import { addBarsAtEnd, barCapacity, barCount, deleteAtCursor, newPart, placeChordName, placeChordShape, placeNote, playOrder, removeNotes, setRest, usedChords } from './model/song';
import { REACTION, chordForKey, clearChord, heardBar, heardSlot, loopRange, setChordAt, snapTicks } from './model/transcribe';
import { heardTicks, session, setSession, useLiveTaps, type LiveTap } from './state/playback';
import { TranscribeBar } from './ui/TranscribeBar';
import { carryChords, isSlot, notesToBars, type TapNote } from './model/rhythm';
import { TapPanel } from './ui/TapPanel';
import { identifyChord } from './model/music';
import { audioClock, audition, play, type PlayHandle } from './audio/player';
import { audioTimeOfBar, loadTrack, startTrack, stopTrack, trackElement } from './audio/track';
import { ensureLocalAudio } from './storage/audioSync';
import { toast } from './ui/Toaster';
import type { Bar, Cursor, Dur } from './model/types';

const DURS: Dur[] = [1, 2, 4, 8, 16, 32];

/** The beat just before a cursor position (crossing back over a bar line). */
function prevBeat(bars: Bar[], c: Cursor): Cursor {
  if (c.beat > 0) return { ...c, beat: c.beat - 1 };
  if (c.bar > 0) return { ...c, bar: c.bar - 1, beat: Math.max(0, bars[c.bar - 1].beats.length - 1) };
  return c;
}

export function App() {
  const song = useStore((s) => s.song);
  const cursor = useStore((s) => s.cursor);
  const part = useStore(focusedPart);
  const dur = useStore((s) => s.dur);
  const dotted = useStore((s) => s.dotted);
  const stack = useStore((s) => s.stack);
  const chordStep = useStore((s) => s.chordStep);
  const capoView = useStore((s) => s.capoView);
  const tapOpen = useStore((s) => s.tapOpen);
  const transcribe = useStore((s) => s.transcribe);
  const { edit, set, setCursor, undo, redo } = useStore.getState();

  const [preview, setPreview] = useState<number[] | null>(null);
  const [draft, setDraft] = useState<Map<number, number>>(new Map());
  const [playing, setPlaying] = useState(false);
  const [metronome, setMetronome] = useState(false);
  const handle = useRef<PlayHandle | null>(null);
  const keyBuf = useRef<{ digits: string; at: number; at2: Cursor } | null>(null);

  useEffect(() => {
    document.title = `${song.title || 'Untitled'} · Guitar Prompter`;
  }, [song.title]);

  useEffect(() => setDraft(new Map()), [cursor.partId]);

  const beat = part.bars[cursor.bar]?.beats[cursor.beat];
  const opts = { dur, dotted, stack };
  const concert = capoView === 'concert';

  const lit = useMemo(() => {
    if (part.kind === 'chords') return draft;
    return new Map((beat?.notes ?? []).map((n) => [n.string, n.fret] as [number, number]));
  }, [part.kind, beat, draft]);

  const detected = useMemo(() => {
    if (part.kind === 'chords') {
      if (draft.size < 2) return null;
      const name = identifyChord([...draft].map(([s, f]) => part.tuning[s] + f));
      return name ? { name, source: 'draft' as const } : null;
    }
    if (!beat || beat.notes.length < 2) return null;
    const name = identifyChord(beat.notes.map((n) => part.tuning[n.string] + n.fret));
    if (!name) return null;
    if (beat.chord && !beat.chordAuto && beat.chord === name) return null;
    return { name, source: 'beat' as const, auto: beat.chordAuto && beat.chord === name };
  }, [part, beat, draft]);

  const pick = (string: number, fret: number) => {
    audition([part.tuning[string] + part.capo + fret]);
    if (part.kind === 'chords') {
      setDraft((d) => {
        const n = new Map(d);
        if (n.get(string) === fret) n.delete(string);
        else n.set(string, fret);
        return n;
      });
      return;
    }
    // Tapping a note that's already lit on this beat takes it back off (no advance).
    if (beat?.notes.some((n) => n.string === string && n.fret === fret)) {
      edit((s, c) => (removeNotes(s, c.partId, c.bar, c.beat, string), { ...c, string }));
      return;
    }
    edit((s, c) => placeNote(s, c, string, fret, opts));
  };

  const placeChord = (name: string, frets: number[] | null) => {
    if (liveChord(name)) return setDraft(new Map());
    if (part.kind === 'chords') {
      edit((s, c) => placeChordName(s, c, name, chordStep, opts));
      setDraft(new Map());
    } else if (frets) {
      edit((s, c) => placeChordShape(s, c, name, frets, opts));
    } else {
      edit((s, c) => {
        const p = s.parts.find((x) => x.id === c.partId)!;
        const b = p.bars[c.bar].beats[c.beat];
        if (b) {
          b.chord = name;
          b.chordAuto = undefined;
          return c;
        }
        return placeChordName(s, c, name, 'beat', opts);
      });
    }
  };

  /** Writes tapped onsets into the focused part as empty rhythm slots, then parks the cursor on the first one. */
  const commitRhythm = (notes: TapNote[], startBar: number, bars: number) => {
    edit((d, c) => {
      const p = d.parts.find((x) => x.id === c.partId)!;
      const need = startBar + bars - barCount(d);
      if (need > 0) addBarsAtEnd(d, need);
      const fresh = notesToBars(notes, barCapacity(d), bars);
      fresh.forEach((b, i) => {
        carryChords(p.bars[startBar + i], b);
        p.bars[startBar + i] = b;
      });
      for (let i = 0; i < bars; i++) {
        const k = p.bars[startBar + i].beats.findIndex(isSlot);
        if (k >= 0) return { ...c, bar: startBar + i, beat: k };
      }
      return { ...c, bar: startBar, beat: 0 };
    });
    set({ tapOpen: false, stack: false });
    toast(`${notes.length} notes tapped. Now tap frets to fill them in order.`);
  };

  const stopPlayback = useCallback(() => {
    const sess = session();
    const st = useStore.getState();
    // transcribing: stopping is a pause, so the next play picks up at the bar you were hearing
    if (sess && st.transcribe) {
      const at = heardBar(st.song, sess.order, heardTicks(sess), sess.loop);
      if (at) setCursor({ bar: Math.min(at.bar, barCount(st.song) - 1), beat: 0 });
    }
    setSession(null);
    handle.current?.stop();
    handle.current = null;
    stopTrack();
    setPlaying(false);
    set({ playhead: null });
  }, [set, setCursor]);

  /**
   * Plays from `fromBar` (default: the cursor), looping bars or the section if
   * Loop is on, with the recording in step. Transcribing, it runs to the end of
   * the recording even past the written bars.
   */
  const startPlayback = useCallback(
    (fromBar?: number) => {
      const st = useStore.getState();
      const s = st.song;
      const { from, bars } = loopRange(s, fromBar ?? st.cursor.bar, st.loopBars);
      let total = bars;
      const el = trackElement();
      if (!bars && st.transcribe && s.audio && el && Number.isFinite(el.duration)) {
        const barSec = (60 / s.tempo / 16) * barCapacity(s);
        total = Math.max(playOrder(s, from).length, Math.ceil((el.duration - audioTimeOfBar(s, from)) / barSec));
      }
      const h: PlayHandle = play(
        s,
        from,
        { metronome, speed: st.speed, bars: total, synth: st.synthOn },
        (pos) => set({ playhead: pos }),
        () => {
          if (handle.current !== h) return;
          if (bars) startPlayback(from);
          else stopPlayback();
        },
      );
      handle.current = h;
      setSession({ h, order: playOrder(s, from).slice(0, bars ?? Infinity), loop: !!bars, from });
      startTrack(s, from, h, audioClock(), st.speed);
      setPlaying(true);
    },
    [metronome, set, stopPlayback],
  );

  const togglePlay = useCallback(() => {
    if (handle.current) stopPlayback();
    else startPlayback();
  }, [startPlayback, stopPlayback]);

  /** Restarts at the bar being heard, `by` bars on (Back = -1; 0 after changing speed or loop). */
  const jump = useCallback(
    (by: number) => {
      const st = useStore.getState();
      const sess = session();
      if (!sess || !handle.current) return setCursor({ bar: Math.max(0, Math.min(st.cursor.bar + by, barCount(st.song) - 1)), beat: 0 });
      const at = heardBar(st.song, sess.order, heardTicks(sess), sess.loop)?.bar ?? sess.from;
      const to = Math.max(0, Math.min(at + by, barCount(st.song) - 1));
      setSession(null); // don't let the stop move the cursor
      handle.current.stop();
      handle.current = null;
      stopTrack();
      startPlayback(to);
    },
    [setCursor, startPlayback],
  );

  /**
   * Transcribing while it plays: the chord lands on the beat you're hearing (less
   * reaction time), snapped to the chord step, on the chord part. Returns false
   * when nothing is playing, so the caller does its usual thing at the cursor.
   */
  function liveChord(name: string): boolean {
    const st = useStore.getState();
    const sess = session();
    if (!sess || !st.transcribe) return false;
    const slot = heardSlot(st.song, sess.order, heardTicks(sess, REACTION), snapTicks(st.song, st.chordStep), sess.loop);
    if (!slot) return true; // still counting in
    let tap: LiveTap | null = null;
    let made = false;
    st.edit((d, c) => {
      let p = d.parts.find((x) => x.id === c.partId && x.kind === 'chords') ?? d.parts.find((x) => x.kind === 'chords');
      if (!p) {
        p = newPart(d, 'chords', barCount(d));
        d.parts.unshift(p);
        made = true;
      }
      tap = { partId: p.id, beatId: setChordAt(d, p.id, slot.bar, slot.tick, name), name, ...slot, after: d };
      return c;
    });
    if (tap) {
      const t: LiveTap = { ...(tap as LiveTap), after: useStore.getState().song };
      useLiveTaps.setState((x) => ({ taps: [...x.taps.slice(-49), t] }));
    }
    if (made) toast('Added a Chords part for the chords you tap.');
    return true;
  }

  /** Backspace while listening: takes the last live chord back off. */
  function unTap(): boolean {
    const { taps } = useLiveTaps.getState();
    const last = taps[taps.length - 1];
    if (!last) return false;
    useLiveTaps.setState({ taps: taps.slice(0, -1) });
    // still the latest edit: undo it, which also puts back a chord it replaced
    if (useStore.getState().song === last.after) return useStore.getState().undo(), true;
    let gone = false;
    useStore.getState().edit((d, c) => ((gone = clearChord(d, last.partId, last.beatId)), c));
    if (!gone) useStore.getState().undo(); // already gone (undone): drop the empty history step
    return true;
  }
  const liveRef = useRef({ liveChord, unTap });
  liveRef.current = { liveChord, unTap };

  // the strip's tap list belongs to one song
  useEffect(() => useLiveTaps.setState({ taps: [] }), [song.id]);

  // keep the song's recording loaded (IndexedDB on this device, fetched from the account if needed)
  const audioRev = song.audio?.rev;
  const hasAudio = !!song.audio;
  useEffect(() => {
    const s = useStore.getState().song;
    if (!hasAudio) return void loadTrack(null);
    void ensureLocalAudio(s).then((r) => r === 'ready' && loadTrack(s.id, s.audio?.rev));
  }, [song.id, hasAudio, audioRev]);

  // keyboard: arrows move, digits type frets, Space plays, Delete removes
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input, select, textarea, [contenteditable]')) return;
      const st = useStore.getState();
      if (st.tapping) return; // the tap panel owns the keyboard while open
      const c = st.cursor;
      const p = focusedPart(st);
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
        return;
      }
      if (mod) return;
      const bars = p.bars;
      const live = st.transcribe && !!session();
      if (live && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault();
        jump(e.key === 'ArrowLeft' ? -1 : 1);
        return;
      }
      if (live && e.key === 'Backspace' && liveRef.current.unTap()) return e.preventDefault();
      if (/^[1-9]$/.test(e.key) && p.kind === 'chords') {
        // chord part: 1-9 are the song's chords
        const name = chordForKey(usedChords(st.song), e.key);
        if (!name) return;
        e.preventDefault();
        if (!liveRef.current.liveChord(name)) st.edit((s, cc) => placeChordName(s, cc, name, st.chordStep, { dur: st.dur, dotted: st.dotted, stack: st.stack }));
        return;
      }
      switch (e.key) {
        case ' ':
          e.preventDefault();
          togglePlay();
          return;
        case 'ArrowRight': {
          e.preventDefault();
          const len = bars[c.bar].beats.length;
          if (c.beat >= len) {
            if (c.bar < barCount(st.song) - 1) setCursor({ bar: c.bar + 1, beat: 0 });
          } else setCursor({ beat: c.beat + 1 });
          return;
        }
        case 'ArrowLeft': {
          e.preventDefault();
          if (c.beat > 0) setCursor({ beat: c.beat - 1 });
          else if (c.bar > 0) setCursor({ bar: c.bar - 1, beat: Math.max(0, bars[c.bar - 1].beats.length - 1) });
          return;
        }
        case 'ArrowUp':
          e.preventDefault();
          if (p.kind === 'tab') setCursor({ string: Math.max(0, c.string - 1) });
          else {
            const i = st.song.parts.findIndex((x) => x.id === p.id);
            if (i > 0) setCursor({ partId: st.song.parts[i - 1].id, beat: 0 });
          }
          return;
        case 'ArrowDown':
          e.preventDefault();
          if (p.kind === 'tab' && c.string < p.tuning.length - 1) setCursor({ string: c.string + 1 });
          else {
            const i = st.song.parts.findIndex((x) => x.id === p.id);
            if (i < st.song.parts.length - 1) setCursor({ partId: st.song.parts[i + 1].id, beat: 0, string: 0 });
          }
          return;
        case 'Delete':
        case 'Backspace':
          e.preventDefault();
          st.edit((s, cc) => deleteAtCursor(s, cc));
          return;
        case 'r':
        case 'R':
          st.edit((s, cc) => setRest(s, cc, { dur: st.dur, dotted: st.dotted, stack: st.stack }));
          return;
        case '.':
          st.set({ dotted: !st.dotted });
          return;
        case '=':
        case '+': {
          const i = DURS.indexOf(st.dur);
          if (i < DURS.length - 1) st.set({ dur: DURS[i + 1] });
          return;
        }
        case '-': {
          const i = DURS.indexOf(st.dur);
          if (i > 0) st.set({ dur: DURS[i - 1] });
          return;
        }
      }
      if (/^[0-9]$/.test(e.key) && p.kind === 'tab') {
        // Typed frets behave like fretboard taps: write and move on (unless Stack is on).
        // A second digit within 700 ms rewrites the note just typed (1 then 2 → 12).
        e.preventDefault();
        const now = performance.now();
        const kb = keyBuf.current;
        const entry = { dur: st.dur, dotted: st.dotted, stack: st.stack };
        if (kb && now - kb.at < 700 && Number(kb.digits + e.key) <= 24) {
          const fret = Number(kb.digits + e.key);
          keyBuf.current = null;
          audition([p.tuning[kb.at2.string] + p.capo + fret]);
          st.edit((s) => {
            const back = placeNote(s, kb.at2, kb.at2.string, fret, { ...entry, stack: true });
            return entry.stack ? back : { ...back, beat: back.beat + 1 };
          });
          return;
        }
        const fret = Number(e.key);
        audition([p.tuning[c.string] + p.capo + fret]);
        let placedAt = c;
        st.edit((s, cc) => {
          const after = placeNote(s, cc, cc.string, fret, entry);
          // where the note actually landed (the cursor may have spilled into the next bar)
          const part = s.parts.find((x) => x.id === cc.partId)!;
          const landed = entry.stack ? after : prevBeat(part.bars, after);
          placedAt = { ...landed, string: cc.string };
          return after;
        });
        keyBuf.current = { digits: e.key, at: now, at2: placedAt };
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [togglePlay, jump, setCursor, undo, redo]);

  return (
    <div className="app">
      <TopBar playing={playing} metronome={metronome} onPlay={togglePlay} onMetronome={() => setMetronome(!metronome)} />
      <div className="body">
        <PartsRail />
        <main className="sheet">
          <Toolbar />
          <ScoreView />
        </main>
      </div>
      <section className={'dock' + (transcribe ? ' is-transcribing' : '')} aria-label={part.kind === 'tab' ? 'Fretboard and chords' : 'Chords'}>
        {transcribe && <TranscribeBar playing={playing} onPlay={togglePlay} onJump={jump} onUnTap={() => liveRef.current.unTap()} />}
        <div className="dock-board">
          <div className="dock-hint">
            <span className="part-pip" style={{ background: part.color }} />
            <strong>{part.name}</strong>
            <span>
              {part.kind === 'tab'
                ? stack
                  ? 'Stack is on — tap frets to build a chord on this beat'
                  : 'Tap a fret to write a note · Stack builds chords'
                : 'Tap a chord to add it · or fret a shape and we’ll name it'}
            </span>
            {part.capo > 0 && <span className="dock-capo">{concert ? `No capo · showing real frets` : `Capo ${part.capo}`}</span>}
          </div>
          {tapOpen ? (
            <TapPanel onCommit={commitRhythm} onClose={() => set({ tapOpen: false })} />
          ) : (
          <Fretboard
            part={part}
            lit={lit}
            preview={part.kind === 'chords' && draft.size ? null : preview}
            activeString={part.kind === 'tab' ? cursor.string : -1}
            showConcert={concert}
            onPick={pick}
            onString={(s) => setCursor({ string: s })}
          />
          )}
        </div>
        <ChordPalette
          part={part}
          used={usedChords(song)}
          detected={detected}
          concert={concert}
          chordStep={chordStep}
          onStep={(s) => set({ chordStep: s })}
          onPlace={placeChord}
          onNameBeat={(name) =>
            edit((s, c) => {
              const b = s.parts.find((x) => x.id === c.partId)!.bars[c.bar].beats[c.beat];
              if (b) {
                b.chord = name;
                b.chordAuto = undefined;
              }
              return c;
            })
          }
          onPreview={setPreview}
          onClearDraft={() => setDraft(new Map())}
        />
      </section>
    </div>
  );
}
