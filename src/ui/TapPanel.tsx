import { useEffect, useRef, useState } from 'react';
import { useStore, focusedPart } from '../state/store';
import { audioClock, play, type PlayHandle } from '../audio/player';
import { startTrack, stopTrack } from '../audio/track';
import { quantizeTaps, type RawTap, type TapNote } from '../model/rhythm';
import { barCapacity } from '../model/song';
import { Icon } from './Icon';

type Phase = 'ready' | 'countin' | 'recording';

interface Props {
  onCommit: (notes: TapNote[], startBar: number, bars: number) => void;
  onClose: () => void;
}

const GRIDS = [
  { id: 8, label: '8ths', ticks: 8 },
  { id: 16, label: '16ths', ticks: 4 },
];

/**
 * Tap the rhythm first, fill in frets after. Counts in one bar, plays the
 * other parts along, records taps from the pad / Space / any letter key.
 */
export function TapPanel({ onCommit, onClose }: Props) {
  const song = useStore((s) => s.song);
  const cursor = useStore((s) => s.cursor);
  const part = useStore(focusedPart);
  const set = useStore((s) => s.set);
  const [grid, setGrid] = useState(8);
  const [bars, setBars] = useState(2);
  const [along, setAlong] = useState(true);
  const [metro, setMetro] = useState(true);
  const [phase, setPhase] = useState<Phase>('ready');
  const [count, setCount] = useState(0);
  const [beatNo, setBeatNo] = useState<number | null>(null);
  const [flash, setFlash] = useState(0);
  const handle = useRef<PlayHandle | null>(null);
  const taps = useRef<RawTap[]>([]);
  const [held, setHeld] = useState(false);
  const timer = useRef<number>(0);
  const startBar = cursor.bar;
  const listen = useRef<PlayHandle | null>(null);
  const [listening, setListening] = useState(false);

  /** Loops the bars you're about to tap (no recording), to learn the rhythm first. */
  const stopListen = () => {
    if (!listen.current) return;
    listen.current.stop();
    listen.current = null;
    stopTrack();
    set({ playhead: null });
    setListening(false);
  };
  const startListen = () => {
    const st = useStore.getState();
    const go = () => {
      const h = play(st.song, startBar, { metronome: metro, bars, speed: st.speed, synth: st.synthOn }, (pos) => set({ playhead: pos }), () => {
        if (listen.current === h) go();
      });
      listen.current = h;
      startTrack(st.song, startBar, h, audioClock(), st.speed);
    };
    go();
    setListening(true);
  };
  const moveStart = (by: number) => {
    stopListen();
    useStore.getState().setCursor({ bar: Math.max(0, startBar + by), beat: 0 });
  };
  useEffect(
    () => () => {
      if (!listen.current) return;
      listen.current.stop();
      stopTrack();
      useStore.getState().set({ playhead: null });
    },
    [],
  );

  const finish = (save: boolean) => {
    const h = handle.current;
    handle.current = null;
    cancelAnimationFrame(timer.current);
    h?.stop();
    stopTrack();
    set({ playhead: null });
    setPhase('ready');
    setBeatNo(null);
    if (save && h) {
      const gridTicks = GRIDS.find((g) => g.id === grid)!.ticks;
      const total = bars * barCapacity(song);
      const notes = quantizeTaps(taps.current, h.spt, gridTicks).filter((n) => n.onset < total);
      if (notes.length) onCommit(notes, startBar, bars);
    }
  };

  const start = () => {
    stopListen();
    taps.current = [];
    setCount(0);
    // the part being recorded stays silent; others play along if wanted
    const s = structuredClone(song);
    for (const p of s.parts) if (p.id === part.id || !along) p.muted = true;
    handle.current = play(
      s,
      startBar,
      { metronome: metro, countIn: true, bars, speed: useStore.getState().speed, synth: useStore.getState().synthOn },
      (pos) => set({ playhead: pos }),
      () => finish(true),
    );
    setPhase('countin');
    const h = handle.current;
    startTrack(song, startBar, h, audioClock(), useStore.getState().speed); // the recording plays along
    const beatSec = (64 / song.timeSig[1]) * h.spt;
    const tick = () => {
      if (!handle.current) return;
      const now = h.heardNow() - h.t0;
      setPhase(now < 0 ? 'countin' : 'recording');
      setBeatNo(Math.floor(now / beatSec));
      timer.current = requestAnimationFrame(tick);
    };
    timer.current = requestAnimationFrame(tick);
  };

  /** Press = a note starts. Holding sets its length; release() ends it. */
  const press = () => {
    const h = handle.current;
    if (!h) return;
    release(); // a press while another is held ends the previous note
    taps.current.push({ down: h.heardNow() - h.t0, up: null });
    setHeld(true);
    setCount((c) => c + 1);
    setFlash((f) => f + 1);
  };

  const release = () => {
    const h = handle.current;
    const last = taps.current[taps.current.length - 1];
    if (h && last && last.up === null) last.up = h.heardNow() - h.t0;
    setHeld(false);
  };

  // keyboard: Space / Enter / letters tap while recording; Escape cancels
  useEffect(() => {
    set({ tapping: true });
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, select, textarea')) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        if (handle.current) finish(false);
        else onClose();
        return;
      }
      if (e.key === ' ' || e.key === 'Enter' || /^[a-z]$/i.test(e.key)) {
        e.preventDefault();
        if (e.repeat) return; // holding a key = holding the note
        if (handle.current) press();
        else if (e.key === ' ' || e.key === 'Enter') start();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (handle.current && (e.key === ' ' || e.key === 'Enter' || /^[a-z]$/i.test(e.key))) release();
    };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('keyup', onKeyUp, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('keyup', onKeyUp, true);
      set({ tapping: false });
      handle.current?.stop();
      cancelAnimationFrame(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grid, bars, along, metro, part.id, song]);

  const beatsPerBar = song.timeSig[0];
  const recording = phase !== 'ready';
  const countLabel =
    phase === 'countin' && beatNo !== null ? String(beatsPerBar + beatNo + 1) : phase === 'recording' && beatNo !== null
      ? `Bar ${startBar + 1 + Math.floor(beatNo / beatsPerBar)} · ${(beatNo % beatsPerBar) + 1}`
      : '';

  return (
    <div className="tap-panel">
      <div className="tap-settings">
        <div className="tap-title">
          <strong>Tap rhythm</strong>
          <span>
            {part.name} · from bar {startBar + 1}. Tap along, then tap frets to fill each note in order.
          </span>
        </div>
        <div className="tap-row">
          <span className="pal-key">Snap</span>
          <div className="seg">
            {GRIDS.map((g) => (
              <button key={g.id} className={grid === g.id ? 'on' : ''} disabled={recording} onClick={() => setGrid(g.id)}>
                {g.label}
              </button>
            ))}
          </div>
          <span className="pal-key">Bars</span>
          <div className="seg">
            {[1, 2, 4, 8].map((n) => (
              <button key={n} className={bars === n ? 'on' : ''} disabled={recording} onClick={() => setBars(n)}>
                {n}
              </button>
            ))}
          </div>
          <button className={'chip' + (metro ? ' on' : '')} disabled={recording} onClick={() => setMetro(!metro)} aria-pressed={metro}>
            <Icon name="metronome" size={12} /> Metronome
          </button>
          <button className={'chip' + (along ? ' on' : '')} disabled={recording} onClick={() => setAlong(!along)} aria-pressed={along}>
            Play other parts
          </button>
        </div>
        <div className="tap-row">
          {recording ? (
            <button className="btn" onClick={() => finish(true)}>
              <Icon name="stop" size={12} /> Stop &amp; keep
            </button>
          ) : (
            <button className="btn btn-primary" onClick={start}>
              <Icon name="play" size={12} /> Count in &amp; record
            </button>
          )}
          {!recording && (
            <>
              <button className={'btn' + (listening ? ' on' : '')} onClick={listening ? stopListen : startListen} aria-pressed={listening} title={`Loop bar${bars > 1 ? 's' : ''} ${startBar + 1}${bars > 1 ? `–${startBar + bars}` : ''} to learn the rhythm`}>
                <Icon name={listening ? 'stop' : 'loop'} size={12} /> {listening ? 'Stop' : 'Listen'}
              </button>
              <span className="tap-from" role="group" aria-label="Start bar">
                <button className="icon-btn" onClick={() => moveStart(-1)} disabled={startBar === 0} aria-label="Start a bar earlier">
                  <Icon name="left" size={13} />
                </button>
                <span>Bar {startBar + 1}</span>
                <button className="icon-btn" onClick={() => moveStart(1)} aria-label="Start a bar later">
                  <Icon name="right" size={13} />
                </button>
              </span>
            </>
          )}
          <button className="btn btn-ghost" onClick={() => (stopListen(), handle.current ? finish(false) : onClose())}>
            {recording ? 'Cancel' : 'Done'}
          </button>
          <span className="tap-hint">Tap or hold (hold = longer note) · Space or any letter works too · move off the pad or Esc to finish</span>
        </div>
      </div>
      <button
        className={'tap-pad' + (phase === 'recording' ? ' is-live' : phase === 'countin' ? ' is-count' : '') + (held ? ' is-held' : '')}
        onPointerDown={(e) => {
          e.preventDefault();
          if (handle.current) press();
          else start();
        }}
        onPointerUp={() => release()}
        onPointerCancel={() => release()}
        onPointerLeave={(e) => {
          // sliding the mouse off the pad ends the take: keep what was tapped, drop a take still counting in
          // (touch fires pointerleave after every tap, so this is mouse-only)
          if (!handle.current || e.pointerType !== 'mouse') return;
          finish(phase === 'recording');
        }}
        aria-label={recording ? 'Tap the rhythm' : 'Start recording'}
      >
        <span key={flash} className="tap-ring" />
        <span className="tap-big">{phase === 'ready' ? 'TAP' : phase === 'countin' ? countLabel : 'TAP'}</span>
        <span className="tap-sub">{phase === 'ready' ? 'press to start' : phase === 'countin' ? 'count-in' : `${countLabel} · ${count} taps`}</span>
        <span className="tap-beats" aria-hidden="true">
          {Array.from({ length: beatsPerBar }, (_, i) => {
            const cur = beatNo === null ? -1 : ((beatNo % beatsPerBar) + beatsPerBar) % beatsPerBar;
            return <i key={i} className={(i === cur ? 'on' : '') + (i === 0 ? ' down' : '')} />;
          })}
        </span>
      </button>
    </div>
  );
}
