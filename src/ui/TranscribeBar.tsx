import { useEffect, useState } from 'react';
import { useStore, focusedPart } from '../state/store';
import { heardTicks, session, useLiveTaps } from '../state/playback';
import { heardBar } from '../model/transcribe';
import { transposeChord } from '../model/music';
import type { ChordStep } from '../model/song';
import { Icon } from './Icon';

interface Props {
  playing: boolean;
  onPlay: () => void;
  /** Restart `by` bars from the one being heard (0 = same bar, after a speed/loop change). */
  onJump: (by: number) => void;
  onUnTap: () => void;
}

const SPEEDS = [1, 0.75, 0.6, 0.5];
const LOOPS: { v: number; label: string }[] = [
  { v: 0, label: 'Off' },
  { v: -1, label: 'Section' },
  { v: 1, label: '1' },
  { v: 2, label: '2' },
  { v: 4, label: '4' },
];
const STEPS: { v: ChordStep; label: string }[] = [
  { v: 'beat', label: 'Beat' },
  { v: 'half', label: '½ bar' },
  { v: 'bar', label: 'Bar' },
];

/**
 * Transcribe strip: play the recording, jump back a bar, slow down or loop,
 * and tap chords as you hear them. They land on the beat you heard.
 */
export function TranscribeBar({ playing, onPlay, onJump, onUnTap }: Props) {
  const song = useStore((s) => s.song);
  const cursor = useStore((s) => s.cursor);
  const part = useStore(focusedPart);
  const speed = useStore((s) => s.speed);
  const loopBars = useStore((s) => s.loopBars);
  const chordStep = useStore((s) => s.chordStep);
  const capoView = useStore((s) => s.capoView);
  const last = useLiveTaps((t) => t.taps[t.taps.length - 1]);
  const set = useStore((s) => s.set);
  const [pos, setPos] = useState<{ bar: number; beat: number } | null>(null);

  // live "bar · beat" readout
  useEffect(() => {
    if (!playing) return setPos(null);
    let raf = 0;
    let shown = '';
    const tick = () => {
      const sess = session();
      const p = sess ? heardBar(useStore.getState().song, sess.order, heardTicks(sess), sess.loop) : null;
      const key = p ? `${p.bar}.${p.beat}` : '';
      if (key !== shown) {
        shown = key;
        setPos(p);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  const change = (p: Parameters<typeof set>[0]) => {
    set(p);
    if (playing) onJump(0); // takes effect from the bar you're on
  };
  const chordPart = song.parts.find((p) => p.id === part.id && p.kind === 'chords') ?? song.parts.find((p) => p.kind === 'chords');
  const disp = (name: string) => (capoView === 'concert' && chordPart?.capo ? transposeChord(name, chordPart.capo) : name);
  const beatOf = (tick: number) => Math.floor(tick / (64 / song.timeSig[1])) + 1;

  return (
    <div className="transcribe" role="region" aria-label="Transcribe">
      <div className="tr-transport">
        <button className={'play tr-play' + (playing ? ' is-playing' : '')} onClick={onPlay} aria-label={playing ? 'Pause' : 'Play'} title={playing ? 'Pause (Space)' : 'Play from the cursor (Space)'}>
          <Icon name={playing ? 'stop' : 'play'} size={16} />
        </button>
        <button className="btn btn-small" onClick={() => onJump(-1)} title={playing ? 'Back a bar (←)' : 'Back a bar'}>
          <Icon name="left" size={13} /> Bar
        </button>
        <output className="tr-pos" aria-live="off">
          {pos ? (
            <>
              <strong>{pos.bar + 1}</strong>
              <span>
                {Array.from({ length: song.timeSig[0] }, (_, i) => (
                  <i key={i} className={i === pos.beat ? 'on' : ''} />
                ))}
              </span>
            </>
          ) : playing ? (
            <span className="tr-count">Count…</span>
          ) : (
            <>
              <strong>{cursor.bar + 1}</strong>
              <span className="tr-count">paused</span>
            </>
          )}
        </output>
      </div>

      <div className="tr-opts">
        <div className="tr-opt">
          <span className="pal-key">Speed</span>
          <span className="seg" role="radiogroup" aria-label="Speed">
            {SPEEDS.map((v) => (
              <button key={v} role="radio" aria-checked={speed === v} className={speed === v ? 'on' : ''} onClick={() => change({ speed: v })}>
                {Math.round(v * 100)}%
              </button>
            ))}
          </span>
        </div>
        <div className="tr-opt">
          <span className="pal-key">Loop</span>
          <span className="seg" role="radiogroup" aria-label="Loop">
            {LOOPS.map((l) => (
              <button key={l.v} role="radio" aria-checked={loopBars === l.v} className={loopBars === l.v ? 'on' : ''} onClick={() => change({ loopBars: l.v })} title={l.v > 0 ? `Loop ${l.v} bar${l.v > 1 ? 's' : ''}` : undefined}>
                {l.label}
              </button>
            ))}
          </span>
        </div>
        <div className="tr-opt">
          <span className="pal-key">Snap</span>
          <span className="seg" role="radiogroup" aria-label="Chords snap to">
            {STEPS.map((st) => (
              <button key={st.v} role="radio" aria-checked={chordStep === st.v} className={chordStep === st.v ? 'on' : ''} onClick={() => set({ chordStep: st.v })}>
                {st.label}
              </button>
            ))}
          </span>
        </div>
      </div>

      <div className="tr-hint">
        {last ? (
          <span className="tr-last" key={last.beatId + last.name}>
            <strong>{disp(last.name)}</strong> {`at bar ${last.bar + 1}, beat ${beatOf(last.tick)}`}
            <button className="icon-btn" onClick={onUnTap} aria-label={`Take ${last.name} back off`} title="Take it back off (Backspace)">
              <Icon name="close" size={12} />
            </button>
          </span>
        ) : (
          <span>
            {playing ? 'Tap a chord when it changes.' : 'Press play, then tap chords as you hear them.'}{' '}
            {part.kind === 'chords' ? 'Keys 1–9 are the song’s chords.' : 'Frets go in at the cursor while it plays.'}
          </span>
        )}
      </div>

      <button className="icon-btn tr-close" onClick={() => set({ transcribe: false })} aria-label="Close transcribe" title="Close">
        <Icon name="close" size={14} />
      </button>
    </div>
  );
}
