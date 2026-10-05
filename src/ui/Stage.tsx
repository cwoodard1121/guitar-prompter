import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Song } from '../model/types';
import { chartBars, defaultStagePart, sectionOf, stepSection, type ChartBar } from '../model/stage';
import { displayChord, renderScore, type ScoreLayout } from '../render/score';
import { audioClock, play, type PlayHandle } from '../audio/player';
import { loadTrack, startTrack, stopTrack } from '../audio/track';
import { ensureLocalAudio } from '../storage/audioSync';
import type { CapoView } from '../state/store';
import { SCREEN_THEME } from './ScoreView';
import { Icon } from './Icon';

const SIZE_KEY = 'gp:stage-size';
const READ_LINE = 0.28; // the current bar sits this far down the screen
const SIZES = [0.8, 0.9, 1, 1.15, 1.3, 1.5, 1.75, 2];

const readSize = () => {
  try {
    const v = Number(localStorage.getItem(SIZE_KEY));
    return SIZES.includes(v) ? v : 1;
  } catch {
    return 1;
  }
};

export interface StageNav {
  label: string;
  prev?: { href: string; title: string };
  next?: { href: string; title: string };
}

interface Props {
  song: Song;
  /** Links/buttons at the right of the header (Edit, Add to my library…). */
  actions?: ReactNode;
  /** Back link (defaults to the library). */
  backHref?: string;
  backLabel?: string;
  /** Setlist position and prev/next songs. */
  nav?: StageNav;
}

/** Big, dark, distraction-free view for playing a song: on a music stand, laptop or phone. */
export function Stage({ song, actions, backHref = '#/', backLabel = 'All songs', nav }: Props) {
  const [partId, setPartId] = useState(() => defaultStagePart(song).id);
  const part = song.parts.find((p) => p.id === partId) ?? defaultStagePart(song);
  const [capoView, setCapoView] = useState<CapoView>('shapes');
  const [size, setSize] = useState(readSize);
  const [playing, setPlaying] = useState(false);
  const [metronome, setMetronome] = useState(false);
  const [countIn, setCountIn] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [hasTrack, setHasTrack] = useState(false);
  const [synth, setSynth] = useState(true);
  const [chrome, setChrome] = useState(true);
  const [bar, setBar] = useState(0); // the bar being played (or read)
  const scroller = useRef<HTMLDivElement>(null);
  const handle = useRef<PlayHandle | null>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    document.title = `${song.title || 'Untitled'} · Stage`;
  }, [song.title]);

  useEffect(() => {
    try {
      localStorage.setItem(SIZE_KEY, String(size));
    } catch {
      /* ignore */
    }
  }, [size]);

  // recording, when this device has (or can fetch) it
  useEffect(() => {
    let live = true;
    setHasTrack(false);
    if (!song.audio) return;
    void ensureLocalAudio(song).then(async (r) => {
      const ok = r === 'ready' && (await loadTrack(song.id, song.audio?.rev));
      if (live && ok) {
        setHasTrack(true);
        setSynth(false); // with the real recording, the synth is usually just noise
      }
    });
    return () => void (live = false);
  }, [song.id, song.audio?.rev]);

  // keep the screen awake while the stage is open
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    const grab = () => {
      if (document.visibilityState === 'visible') void navigator.wakeLock?.request('screen').then((l) => (lock = l)).catch(() => {});
    };
    grab();
    document.addEventListener('visibilitychange', grab);
    return () => {
      document.removeEventListener('visibilitychange', grab);
      void lock?.release().catch(() => {});
    };
  }, []);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver(([e]) => setWidth((w) => (Math.abs(w - e.contentRect.width) > 16 ? e.contentRect.width : w)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* ---------------------------------------------------------- positions */

  const tabLayout = useRef<ScoreLayout | null>(null);
  /** y of a bar's top inside the scroller content. */
  const barTop = useCallback(
    (b: number): number | null => {
      const el = scroller.current;
      if (!el) return null;
      if (part.kind === 'chords') {
        const cell = el.querySelector<HTMLElement>(`[data-bar="${b}"]`);
        const line = cell?.closest<HTMLElement>('.chart-line');
        return line ? line.offsetTop : null;
      }
      const sys = tabLayout.current?.systems.find((s) => b >= s.first && b <= s.last);
      const sheet = el.querySelector<HTMLElement>('.stage-tab');
      return sys && sheet ? sheet.offsetTop + sys.top * size : null;
    },
    [part.kind, size],
  );

  const autoScrollUntil = useRef(0);
  const scrollToBar = useCallback(
    (b: number, smooth = true) => {
      const el = scroller.current;
      const y = barTop(b);
      if (!el || y === null) return;
      autoScrollUntil.current = performance.now() + 900; // not the reader scrolling
      el.scrollTo({ top: Math.max(0, y - el.clientHeight * READ_LINE + 8), behavior: smooth ? 'smooth' : 'auto' });
    },
    [barTop],
  );

  /** The bar on the reading line after the reader scrolls by hand (the very top reads as bar 1). */
  const barAtReadLine = useCallback((): number => {
    const el = scroller.current;
    if (!el) return 0;
    const line = el.scrollTop + Math.min(el.clientHeight * READ_LINE, el.scrollTop + 24);
    let best = 0;
    for (let b = 0; b < part.bars.length; b++) {
      const y = barTop(b);
      if (y !== null && y <= line + 4) best = b;
    }
    return best;
  }, [barTop, part.bars.length]);

  /* ----------------------------------------------------------- playback */

  const stop = useCallback(() => {
    handle.current?.stop();
    handle.current = null;
    stopTrack();
    setPlaying(false);
  }, []);

  const start = useCallback(
    (from: number) => {
      handle.current?.stop();
      stopTrack();
      const h = play(
        song,
        from,
        { metronome, countIn, speed, synth: synth || !hasTrack },
        (pos) => {
          const p = pos[part.id] ?? Object.values(pos)[0];
          if (p) setBar(p.bar);
        },
        () => {
          if (handle.current === h) stop();
        },
      );
      handle.current = h;
      if (hasTrack) startTrack(song, from, h, audioClock(), speed);
      setBar(from);
      setPlaying(true);
      scrollToBar(from);
    },
    [song, metronome, countIn, speed, synth, hasTrack, part.id, stop, scrollToBar],
  );

  useEffect(() => () => stop(), [stop]);

  // follow the music: scroll when the playing bar moves to a new line
  const lastTop = useRef<number | null>(null);
  useEffect(() => {
    if (!playing) return;
    const y = barTop(bar);
    if (y !== null && y !== lastTop.current) {
      lastTop.current = y;
      scrollToBar(bar);
    }
  }, [bar, playing, barTop, scrollToBar]);

  const toggle = useCallback(() => (handle.current ? stop() : start(bar)), [start, stop, bar]);

  // scrolling by hand moves the reading position (ignored while the music or a page turn scrolls)
  const onScroll = () => {
    if (playing || performance.now() < autoScrollUntil.current) return;
    setBar(barAtReadLine());
  };

  /** Page turn: next/previous section (pedals send arrow / page keys). */
  const turn = useCallback(
    (dir: 1 | -1) => {
      const to = stepSection(song, bar, dir);
      if (to === null) {
        if (!song.markers.length && scroller.current) scroller.current.scrollBy({ top: dir * scroller.current.clientHeight * 0.7, behavior: 'smooth' });
        return;
      }
      setBar(to);
      if (playing) start(to);
      else scrollToBar(to);
    },
    [playing, bar, song, start, scrollToBar],
  );

  const jump = (to: number) => {
    setBar(to);
    if (playing) start(to);
    else scrollToBar(to);
  };

  const fullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.().catch(() => {});
  };

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, select, textarea')) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      switch (e.key) {
        case ' ':
          e.preventDefault();
          toggle();
          break;
        case 'ArrowRight':
        case 'ArrowDown':
        case 'PageDown':
          e.preventDefault();
          turn(1);
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
        case 'PageUp':
          e.preventDefault();
          turn(-1);
          break;
        case '+':
        case '=':
          setSize((s) => SIZES[Math.min(SIZES.length - 1, SIZES.indexOf(s) + 1)]);
          break;
        case '-':
          setSize((s) => SIZES[Math.max(0, SIZES.indexOf(s) - 1)]);
          break;
        case 'f':
        case 'F':
          fullscreen();
          break;
        case 'h':
        case 'H':
          setChrome((c) => !c);
          break;
        case 'n':
        case 'N':
          if (nav?.next) location.hash = nav.next.href;
          break;
        case 'p':
        case 'P':
          if (nav?.prev) location.hash = nav.prev.href;
          break;
      }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [toggle, turn, nav]);

  /** Tap the left/right third to turn back/forward; the middle shows or hides the controls. */
  const onTap = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button, a, input, select')) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    if (x < 1 / 3) turn(-1);
    else if (x > 2 / 3) turn(1);
    else setChrome((c) => !c);
  };

  const anyCapo = part.capo > 0;
  const section = song.markers.find((m) => m.bar === sectionOf(song, bar));

  return (
    <div className={'stage' + (chrome ? '' : ' is-bare')} style={{ '--size': size } as React.CSSProperties}>
      <header className="stage-top">
        <a className="icon-btn" href={backHref} aria-label={backLabel} title={backLabel}>
          <Icon name="back" size={18} />
        </a>
        <div className="stage-title">
          <strong>{song.title || 'Untitled'}</strong>
          {song.artist && <span>{song.artist}</span>}
        </div>
        {nav && (
          <div className="stage-setnav">
            {nav.prev ? (
              <a className="icon-btn" href={nav.prev.href} title={`Previous: ${nav.prev.title}`} aria-label={`Previous song: ${nav.prev.title}`}>
                <Icon name="left" size={16} />
              </a>
            ) : (
              <span className="icon-btn" aria-hidden="true" />
            )}
            <span className="stage-setpos">{nav.label}</span>
            {nav.next ? (
              <a className="icon-btn" href={nav.next.href} title={`Next: ${nav.next.title}`} aria-label={`Next song: ${nav.next.title}`}>
                <Icon name="right" size={16} />
              </a>
            ) : (
              <span className="icon-btn" aria-hidden="true" />
            )}
          </div>
        )}
        <div className="stage-tools">
          {song.parts.length > 1 && (
            <select aria-label="Part to show" value={part.id} onChange={(e) => setPartId(e.target.value)}>
              {song.parts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
          {anyCapo && (
            <div className="seg" role="radiogroup" aria-label="Capo view">
              <button className={capoView === 'shapes' ? 'on' : ''} role="radio" aria-checked={capoView === 'shapes'} onClick={() => setCapoView('shapes')}>
                Capo {part.capo}
              </button>
              <button className={capoView === 'concert' ? 'on' : ''} role="radio" aria-checked={capoView === 'concert'} onClick={() => setCapoView('concert')}>
                No capo
              </button>
            </div>
          )}
          <div className="stage-size" role="group" aria-label="Text size">
            <button className="icon-btn" aria-label="Smaller" onClick={() => setSize(SIZES[Math.max(0, SIZES.indexOf(size) - 1)])} disabled={size === SIZES[0]}>
              <Icon name="textDown" size={16} />
            </button>
            <button className="icon-btn" aria-label="Bigger" onClick={() => setSize(SIZES[Math.min(SIZES.length - 1, SIZES.indexOf(size) + 1)])} disabled={size === SIZES[SIZES.length - 1]}>
              <Icon name="textUp" size={16} />
            </button>
          </div>
          <button className="icon-btn stage-fs" aria-label="Full screen" title="Full screen (F)" onClick={fullscreen}>
            <Icon name="fullscreen" size={16} />
          </button>
          {actions}
        </div>
      </header>

      {song.markers.length > 0 && (
        <nav className="stage-sections" aria-label="Sections">
          {song.markers.map((m) => (
            <button key={m.bar} className={'chip' + (sectionOf(song, bar) === m.bar ? ' on' : '')} onClick={() => jump(m.bar)}>
              {m.label}
            </button>
          ))}
        </nav>
      )}

      <div className="stage-scroll" ref={scroller} onClick={onTap} onScroll={onScroll}>
        <div className="stage-readline" aria-hidden="true" />
        {part.kind === 'chords' ? (
          <ChordChart song={song} bars={chartBars(song, part)} view={capoView} capo={part.capo} current={bar} playing={playing} width={width} size={size} />
        ) : (
          <TabSheet song={song} partId={part.id} view={capoView} width={width} size={size} current={playing ? bar : null} onLayout={(l) => (tabLayout.current = l)} />
        )}
        <div className="stage-end">End of {song.title || 'song'}</div>
      </div>

      <footer className="stage-transport">
        <button className="icon-btn" aria-label="Previous section" title="Previous section (←)" onClick={() => turn(-1)}>
          <Icon name="left" size={20} />
        </button>
        <button className={'play play-big' + (playing ? ' is-playing' : '')} onClick={toggle} aria-label={playing ? 'Stop' : 'Play from here'}>
          <Icon name={playing ? 'stop' : 'play'} size={20} />
        </button>
        <button className="icon-btn" aria-label="Next section" title="Next section (→)" onClick={() => turn(1)}>
          <Icon name="right" size={20} />
        </button>
        <span className="stage-pos">
          {section ? <strong>{section.label}</strong> : null}
          <span>Bar {bar + 1}</span>
        </span>
        <div className="stage-transport-end">
          <span className="stage-tempo">{Math.round(song.tempo * speed)} bpm</span>
          <select aria-label="Speed" value={speed} onChange={(e) => setSpeed(Number(e.target.value))} disabled={playing}>
            {[1, 0.9, 0.75, 0.6, 0.5].map((v) => (
              <option key={v} value={v}>
                {Math.round(v * 100)}%
              </option>
            ))}
          </select>
          <button className={'icon-btn' + (countIn ? ' on' : '')} aria-pressed={countIn} title="Count in one bar" onClick={() => setCountIn(!countIn)} disabled={playing}>
            1-2-3-4
          </button>
          <button className={'icon-btn' + (metronome ? ' on' : '')} aria-pressed={metronome} title="Metronome" onClick={() => setMetronome(!metronome)} disabled={playing}>
            <Icon name="metronome" size={16} />
          </button>
          {hasTrack && (
            <button className={'icon-btn' + (synth ? ' on' : '')} aria-pressed={synth} title="Hear the tab/chords along with the recording" onClick={() => setSynth(!synth)} disabled={playing}>
              <Icon name="sound" size={16} />
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}

/* ------------------------------------------------------------ chord chart */

function ChordChart({ song, bars, view, capo, current, playing, width, size }: { song: Song; bars: ChartBar[]; view: CapoView; capo: number; current: number; playing: boolean; width: number; size: number }) {
  const part = { capo } as Parameters<typeof displayChord>[1];
  const name = (n: string) => displayChord(n, part, view);
  // 4 bars a line when they fit, else 2, else 1; a new section always starts a line
  const minBar = 165 * size;
  const cols = width >= minBar * 4 ? 4 : width >= minBar * 2 ? 2 : 1;
  const lines = useMemo(() => {
    const out: ChartBar[][] = [];
    for (const b of bars) {
      const last = out[out.length - 1];
      if (!last || last.length >= cols || b.label) out.push([b]);
      else last.push(b);
    }
    return out;
  }, [bars, cols]);
  const beats = song.timeSig[0];

  return (
    <div className="chart" style={{ '--cols': cols } as React.CSSProperties}>
      {lines.map((line) => (
        <div key={line[0].bar} className="chart-line">
          {line[0].label && <div className="chart-label">{line[0].label}</div>}
          <div className="chart-bars">
            {line.map((b) => (
              <div key={b.bar} data-bar={b.bar} className={'cbar' + (current === b.bar ? (playing ? ' is-now' : ' is-here') : '') + (b.repeatStart ? ' rep-start' : '') + (b.repeatEnd ? ' rep-end' : '')}>
                <div className="cbar-chords">
                  {b.carry && !b.chords.some((c) => c.at === 0) && <span className="cchord is-carry">{name(b.carry)}</span>}
                  {b.chords.map((c, i) => (
                    <span key={i} className="cchord" style={{ left: `${c.at * 100}%` }}>
                      {name(c.name)}
                    </span>
                  ))}
                </div>
                <div className="cbar-beats" aria-hidden="true">
                  {Array.from({ length: beats }, (_, i) => (
                    <i key={i} />
                  ))}
                </div>
                {b.repeatEnd && <span className="rep-times">×{b.repeatEnd}</span>}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* --------------------------------------------------------------- tab sheet */

function TabSheet({ song, partId, view, width, size, current, onLayout }: { song: Song; partId: string; view: CapoView; width: number; size: number; current: number | null; onLayout: (l: ScoreLayout) => void }) {
  const host = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<ScoreLayout | null>(null);
  const scale = 1.25 * size;
  const inner = Math.max(320, Math.floor((width - 8) / scale));

  useLayoutEffect(() => {
    if (!host.current || width < 100) return;
    const l = renderScore(host.current, song, { width: inner, theme: SCREEN_THEME, focusId: partId, focusOnly: true, capoView: view });
    setLayout(l);
    onLayout(l);
  }, [song, partId, view, inner]);

  let box: React.CSSProperties | null = null;
  if (layout && current !== null) {
    for (const s of layout.systems) {
      const row = s.rows.find((r) => r.partId === partId);
      const bh = row?.bars.find((b) => b.bar === current);
      if (row && bh) box = { left: bh.x, top: row.top - 4, width: bh.w, height: row.bottom - row.top + 8 };
    }
  }

  return (
    <div className="stage-tab" style={{ height: layout ? layout.height * scale : undefined }}>
      <div className="stage-tab-inner" style={{ width: inner, transform: `scale(${scale})` }}>
        <div ref={host} />
        {box && <div className="stage-tab-now" style={box} />}
      </div>
    </div>
  );
}
