import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStore, focusedPart } from './state/store';
import { TopBar } from './ui/TopBar';
import { Toolbar } from './ui/Toolbar';
import { PartsRail } from './ui/PartsRail';
import { ScoreView } from './ui/ScoreView';
import { Fretboard } from './ui/Fretboard';
import { ChordPalette } from './ui/ChordPalette';
import { barCount, deleteAtCursor, placeChordName, placeChordShape, placeNote, setRest, usedChords } from './model/song';
import { identifyChord } from './model/music';
import { audition, play, type PlayHandle } from './audio/player';
import { connectRemote } from './storage/storage';
import { artifactRemote } from './storage/artifactRemote';
import type { Dur } from './model/types';

const DURS: Dur[] = [1, 2, 4, 8, 16, 32];

export function App() {
  const song = useStore((s) => s.song);
  const cursor = useStore((s) => s.cursor);
  const part = useStore(focusedPart);
  const dur = useStore((s) => s.dur);
  const dotted = useStore((s) => s.dotted);
  const stack = useStore((s) => s.stack);
  const chordStep = useStore((s) => s.chordStep);
  const capoView = useStore((s) => s.capoView);
  const { edit, set, setCursor, undo, redo, replaceLibrary } = useStore.getState();

  const [preview, setPreview] = useState<number[] | null>(null);
  const [draft, setDraft] = useState<Map<number, number>>(new Map());
  const [playing, setPlaying] = useState(false);
  const [metronome, setMetronome] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const handle = useRef<PlayHandle | null>(null);
  const keyBuf = useRef<{ digits: string; at: number; beat: string } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const toast = useCallback((m: string) => {
    setToastMsg(m);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), 2600);
  }, []);

  // Sync with the claude.ai artifact store when we're running there.
  useEffect(() => {
    let alive = true;
    void artifactRemote().then(async (r) => {
      if (!r || !alive) return;
      const merged = await connectRemote(r);
      if (merged && alive) replaceLibrary(merged);
    });
    return () => {
      alive = false;
    };
  }, [replaceLibrary]);

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
    edit((s, c) => placeNote(s, c, string, fret, opts));
  };

  const placeChord = (name: string, frets: number[] | null) => {
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

  const togglePlay = useCallback(() => {
    if (handle.current) {
      handle.current.stop();
      handle.current = null;
      setPlaying(false);
      set({ playhead: null });
      return;
    }
    const s = useStore.getState().song;
    handle.current = play(
      s,
      useStore.getState().cursor.bar,
      { metronome },
      (pos) => set({ playhead: pos }),
      () => {
        handle.current = null;
        setPlaying(false);
        set({ playhead: null });
      },
    );
    setPlaying(true);
  }, [metronome, set]);

  // keyboard: arrows move, digits type frets, Space plays, Delete removes
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input, select, textarea, [contenteditable]')) return;
      const st = useStore.getState();
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
        e.preventDefault();
        const now = performance.now();
        const here = `${c.bar}:${c.beat}:${c.string}`;
        let digits = e.key;
        const kb = keyBuf.current;
        if (kb && kb.beat === here && now - kb.at < 800 && Number(kb.digits + e.key) <= 24) digits = kb.digits + e.key;
        keyBuf.current = { digits, at: now, beat: here };
        const fret = Number(digits);
        audition([p.tuning[c.string] + p.capo + fret]);
        st.edit((s, cc) => placeNote(s, cc, cc.string, fret, { dur: st.dur, dotted: st.dotted, stack: true }));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [togglePlay, setCursor, undo, redo]);

  return (
    <div className="app">
      <TopBar playing={playing} metronome={metronome} onPlay={togglePlay} onMetronome={() => setMetronome(!metronome)} toast={toast} />
      <div className="body">
        <PartsRail />
        <main className="sheet">
          <Toolbar />
          <ScoreView />
        </main>
      </div>
      <section className="dock" aria-label={part.kind === 'tab' ? 'Fretboard and chords' : 'Chords'}>
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
          <Fretboard
            part={part}
            lit={lit}
            preview={part.kind === 'chords' && draft.size ? null : preview}
            activeString={part.kind === 'tab' ? cursor.string : -1}
            showConcert={concert}
            onPick={pick}
            onString={(s) => setCursor({ string: s })}
          />
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
      {toastMsg && (
        <div className="toast" role="status">
          {toastMsg}
        </div>
      )}
    </div>
  );
}
