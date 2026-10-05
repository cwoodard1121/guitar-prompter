import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useStore } from '../state/store';
import { hitTest, renderScore, type ScoreLayout, type Theme } from '../render/score';

export const SCREEN_THEME: Theme = {
  ink: '#ece5da',
  dim: '#6f625a',
  staff: '#7a6a5f',
  staffDim: '#3e332d',
  chord: '#8fd3c7',
  chordDim: '#476b64',
  marker: '#e9b872',
  bg: '#1a1310',
  font: '"Schibsted Grotesk", ui-sans-serif, system-ui, sans-serif',
};

export function ScoreView() {
  const song = useStore((s) => s.song);
  const cursor = useStore((s) => s.cursor);
  const focusOnly = useStore((s) => s.focusOnly);
  const capoView = useStore((s) => s.capoView);
  const playhead = useStore((s) => s.playhead);
  const setCursor = useStore((s) => s.setCursor);
  const wrap = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const caret = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [layout, setLayout] = useState<ScoreLayout | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    // Measure once now (ResizeObserver doesn't fire in background tabs), then follow resizes.
    const cs = getComputedStyle(el);
    const initial = Math.floor(el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight));
    if (initial > 0) setWidth(initial);
    // Only re-layout on real width changes; tiny jitters (scrollbars appearing) would loop.
    const ro = new ResizeObserver(([e]) => {
      const w = Math.floor(e.contentRect.width);
      setWidth((prev) => (Math.abs(prev - w) > 24 ? w : prev));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useLayoutEffect(() => {
    if (!host.current || width < 200) return;
    try {
      setLayout(
        renderScore(host.current, song, {
          width,
          theme: SCREEN_THEME,
          focusId: cursor.partId,
          focusOnly,
          capoView,
        }),
      );
      setError(null);
    } catch (e) {
      console.error(e);
      setError(String((e as Error).message || e));
    }
  }, [song, width, cursor.partId, focusOnly, capoView]);

  // keep the caret in view while typing / tapping
  useEffect(() => {
    caret.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [cursor, layout]);

  const find = (partId: string, bar: number) => {
    for (const sys of layout?.systems ?? []) {
      if (bar < sys.first || bar > sys.last) continue;
      const row = sys.rows.find((r) => r.partId === partId);
      const bh = row?.bars.find((b) => b.bar === bar);
      if (row && bh) return { row, bh };
    }
    return null;
  };

  const cur = find(cursor.partId, cursor.bar);
  let caretBox: React.CSSProperties | null = null;
  let stringBox: React.CSSProperties | null = null;
  if (cur) {
    const x = cursor.beat < cur.bh.beatXs.length ? cur.bh.beatXs[cursor.beat] : (cur.bh.appendX ?? cur.bh.x + cur.bh.w - 12);
    caretBox = { left: x - 11, top: cur.row.top - 2, height: cur.row.bottom - cur.row.top + 4 };
    if (cur.row.kind === 'tab' && cur.row.stringYs.length) {
      stringBox = { left: x - 9, top: cur.row.stringYs[cursor.string] - 7 };
    }
  }

  return (
    <div className="score-wrap" ref={wrap}>
      {error && <div className="score-error">Couldn't draw the score: {error}</div>}
      <div
        className="score"
        onPointerDown={(e) => {
          if (!layout) return;
          const r = e.currentTarget.getBoundingClientRect();
          const hit = hitTest(layout, song, e.clientX - r.left, e.clientY - r.top);
          if (hit) setCursor({ partId: hit.partId, bar: hit.bar, beat: hit.beat, ...(hit.string !== undefined ? { string: hit.string } : {}) });
        }}
      >
        <div ref={host} className="score-svg" />
        {layout &&
          playhead &&
          Object.entries(playhead).map(([pid, pos]) => {
            const f = find(pid, pos.bar);
            if (!f || pos.beat >= f.bh.beatXs.length) return null;
            return (
              <div
                key={pid}
                className="playhead"
                style={{ left: f.bh.beatXs[pos.beat] - 10, top: f.row.top - 2, height: f.row.bottom - f.row.top + 4 }}
              />
            );
          })}
        {caretBox && <div ref={caret} className="caret" style={caretBox} />}
        {stringBox && <div className="caret-string" style={stringBox} />}
      </div>
    </div>
  );
}
