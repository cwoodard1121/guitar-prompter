import { useEffect, useRef, useState } from 'react';
import type { Part } from '../model/types';
import { midiToName, stringLabel } from '../model/music';

interface Props {
  part: Part;
  /** Frets lit on the current beat, per string (capo-relative). */
  lit: Map<number, number>;
  /** Chord shape shown as rings (capo-relative frets, -1 muted). */
  preview: number[] | null;
  activeString: number;
  showConcert: boolean;
  onPick: (string: number, fret: number) => void;
  onString: (string: number) => void;
}

const FRETS = 15;
const INLAYS = [3, 5, 7, 9, 15];
const LABEL_W = 30;
const OPEN_W = 30;

/** Fret wire positions, compressed relative to a real neck so high frets stay tappable. */
function wires(width: number) {
  const span = width - LABEL_W - OPEN_W - 6;
  const k = 22;
  const norm = 1 - 2 ** (-FRETS / k);
  return Array.from({ length: FRETS + 1 }, (_, n) => LABEL_W + OPEN_W + (span * (1 - 2 ** (-n / k))) / norm);
}

export function Fretboard({ part, lit, preview, activeString, showConcert, onPick, onString }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(900);
  const [hover, setHover] = useState<{ s: number; abs: number } | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.clientWidth > 0) setW(Math.max(420, el.clientWidth));
    const ro = new ResizeObserver(([e]) => {
      const nw = Math.max(420, Math.floor(e.contentRect.width));
      setW((prev) => (Math.abs(prev - nw) > 4 ? nw : prev));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const n = part.tuning.length;
  const rowH = n > 6 ? 17 : 20;
  const top = 10;
  const h = top * 2 + rowH * (n - 1) + 18;
  const xs = wires(w);
  const capo = part.capo;
  const sy = (s: number) => top + s * rowH;
  /** Center x for an absolute fret (0 = open, left of the nut). */
  const cx = (abs: number) => (abs === 0 ? LABEL_W + OPEN_W / 2 - 2 : (xs[abs - 1] + xs[abs]) / 2);

  function absFromX(x: number): number | null {
    if (x < LABEL_W) return null;
    if (x < xs[0]) return 0;
    for (let f = 1; f <= FRETS; f++) if (x < xs[f]) return f;
    return null;
  }

  function locate(e: React.PointerEvent<SVGSVGElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const s = Math.round((y - top) / rowH);
    if (s < 0 || s >= n) return null;
    const abs = absFromX(x);
    return { s, abs, x };
  }

  const fretLabel = (rel: number) => String(showConcert ? rel + capo : rel);
  /** In "No capo" view the neck is drawn without a capo and frets are real frets. */
  const drawCapo = showConcert ? 0 : capo;
  /** x for a stored (capo-relative) fret. With the capo on, "open" is drawn in the open zone. */
  const relX = (rel: number) => (!showConcert && rel === 0 && capo > 0 ? cx(0) : cx(rel + capo));
  /** x for a preview voicing: capo-relative shape normally, absolute frets in "No capo" view. */
  const previewX = (f: number) => (showConcert ? cx(f) : relX(f));

  return (
    <div className="fretboard" ref={ref}>
      <svg
        width={w}
        height={h}
        role="group"
        aria-label={`Fretboard, ${part.name}. Click a string at a fret to enter a note.`}
        onPointerMove={(e) => {
          const p = locate(e);
          setHover(p && p.abs !== null ? { s: p.s, abs: p.abs } : null);
        }}
        onPointerLeave={() => setHover(null)}
        onPointerDown={(e) => {
          const p = locate(e);
          if (!p) return;
          if (p.abs === null) {
            onString(p.s);
            return;
          }
          if (showConcert) {
            // real frets; below the capo can't be written while the part has a capo
            if (p.abs - capo < 0) return;
            onPick(p.s, p.abs - capo);
            return;
          }
          // below the capo is unreachable; the open zone means "open at the capo"
          const abs = p.abs === 0 ? capo : p.abs;
          if (abs < capo) return;
          onPick(p.s, abs - capo);
        }}
      >
        <defs>
          <linearGradient id="rosewood" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#3a241b" />
            <stop offset="0.5" stopColor="#2e1c15" />
            <stop offset="1" stopColor="#24160f" />
          </linearGradient>
          <radialGradient id="pearl" cx="0.35" cy="0.3" r="0.8">
            <stop offset="0" stopColor="#fbf8f2" />
            <stop offset="0.55" stopColor="#dcd6cc" />
            <stop offset="1" stopColor="#a9c9c3" />
          </radialGradient>
        </defs>
        {/* board */}
        <rect x={xs[0]} y={top - 8} width={xs[FRETS] - xs[0] + 4} height={rowH * (n - 1) + 16} rx="3" fill="url(#rosewood)" />
        {/* inlays */}
        {INLAYS.map((f) => (
          <circle key={f} cx={cx(f)} cy={sy((n - 1) / 2)} r="4" fill="url(#pearl)" opacity="0.5" />
        ))}
        <circle cx={cx(12)} cy={sy((n - 1) / 2 - 1.2)} r="4" fill="url(#pearl)" opacity="0.5" />
        <circle cx={cx(12)} cy={sy((n - 1) / 2 + 1.2)} r="4" fill="url(#pearl)" opacity="0.5" />
        {/* frets */}
        {xs.map((x, i) =>
          i === 0 ? (
            <rect key={i} x={x - 3} y={top - 9} width="5" height={rowH * (n - 1) + 18} rx="1.5" fill="#d8c9a8" />
          ) : (
            <rect key={i} x={x - 1} y={top - 8} width="2" height={rowH * (n - 1) + 16} fill="#9aa0a6" opacity="0.75" />
          ),
        )}
        {/* below-capo shade + capo */}
        {drawCapo > 0 && (
          <>
            <rect x={LABEL_W} y={top - 9} width={xs[drawCapo] - LABEL_W - 6} height={rowH * (n - 1) + 18} fill="#15100d" opacity="0.62" />
            <rect x={xs[drawCapo] - 11} y={top - 13} width="9" height={rowH * (n - 1) + 26} rx="4" fill="#1b1b1d" stroke="#5c5f66" />
            <text x={xs[drawCapo] - 6.5} y={h - 1} textAnchor="middle" className="fb-capo">CAPO {drawCapo}</text>
          </>
        )}
        {/* strings */}
        {part.tuning.map((midi, s) => (
          <g key={s}>
            <line
              x1={LABEL_W}
              x2={w - 4}
              y1={sy(s)}
              y2={sy(s)}
              stroke={s === activeString ? '#efe9df' : '#b9bcc0'}
              strokeWidth={0.8 + (s / Math.max(1, n - 1)) * 1.6}
              opacity={s === activeString ? 1 : 0.8}
            />
            <text
              x={LABEL_W - 8}
              y={sy(s) + 4}
              textAnchor="end"
              className={'fb-label' + (s === activeString ? ' is-active' : '')}
            >
              {stringLabel(midi + (showConcert ? capo : 0))}
            </text>
          </g>
        ))}
        {/* fret numbers */}
        {[3, 5, 7, 9, 12, 15].map((f) => (
          <text key={f} x={cx(f)} y={h - 1} textAnchor="middle" className="fb-num">
            {f}
          </text>
        ))}
        {/* chord preview rings */}
        {preview?.map((rel, s) =>
          rel < 0 ? (
            <text key={'x' + s} x={LABEL_W + OPEN_W / 2 - 2} y={sy(s) + 4} textAnchor="middle" className="fb-mute">
              ×
            </text>
          ) : (
            <circle key={'p' + s} cx={previewX(rel)} cy={sy(s)} r="7.5" className="fb-ring" />
          ),
        )}
        {/* hover ghost */}
        {hover && (showConcert ? hover.abs >= capo || hover.abs === 0 && capo === 0 : hover.abs >= capo || hover.abs === 0) && !lit.has(hover.s) && (
          <g className="fb-ghost">
            <circle cx={cx(hover.abs)} cy={sy(hover.s)} r="8" />
            <text x={cx(hover.abs)} y={sy(hover.s) + 3.5} textAnchor="middle">
              {showConcert ? hover.abs : Math.max(0, hover.abs - capo)}
            </text>
          </g>
        )}
        {/* lit notes */}
        {[...lit.entries()].map(([s, rel]) => {
          const abs = rel + capo;
          const x = relX(rel);
          return (
            <g key={'n' + s} className="fb-note">
              <circle cx={x} cy={sy(s)} r="8.5" fill="url(#pearl)" />
              <text x={x} y={sy(s) + 3.6} textAnchor="middle">
                {fretLabel(rel)}
              </text>
              <title>{midiToName(part.tuning[s] + abs)}</title>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
