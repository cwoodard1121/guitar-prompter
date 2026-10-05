/** Small vertical chord box. `frets` is high-string-first (our model order), -1 = muted. */
export function ChordDiagram({ frets, size = 1 }: { frets: number[]; size?: number }) {
  const n = frets.length;
  const low = [...frets].reverse(); // diagram draws low string on the left
  const played = low.filter((f) => f > 0);
  const maxF = played.length ? Math.max(...played) : 0;
  const base = maxF > 4 ? Math.min(...played) : 1;
  const gap = 11 * size;
  const fh = 13 * size;
  const left = 14 * size;
  const top = 14 * size;
  const width = left + gap * (n - 1) + 10 * size;
  const height = top + fh * 4 + 6 * size;
  return (
    <svg width={width} height={height} className="chord-diagram" aria-hidden="true">
      {base === 1 ? (
        <rect x={left - 1} y={top - 3 * size} width={gap * (n - 1) + 2} height={3 * size} fill="currentColor" />
      ) : (
        <text x={left - 5 * size} y={top + fh * 0.7} textAnchor="end" className="cd-base">
          {base}
        </text>
      )}
      {Array.from({ length: 5 }, (_, i) => (
        <line key={'f' + i} x1={left} x2={left + gap * (n - 1)} y1={top + i * fh} y2={top + i * fh} stroke="currentColor" strokeOpacity="0.45" />
      ))}
      {low.map((_, i) => (
        <line key={'s' + i} x1={left + i * gap} x2={left + i * gap} y1={top} y2={top + fh * 4} stroke="currentColor" strokeOpacity="0.6" />
      ))}
      {low.map((f, i) => {
        const x = left + i * gap;
        if (f < 0)
          return (
            <text key={i} x={x} y={top - 5 * size} textAnchor="middle" className="cd-mark">
              ×
            </text>
          );
        if (f === 0) return <circle key={i} cx={x} cy={top - 7 * size} r={2.6 * size} fill="none" stroke="currentColor" />;
        const row = f - base;
        return <circle key={i} cx={x} cy={top + (row + 0.5) * fh} r={4 * size} className="cd-dot" />;
      })}
    </svg>
  );
}
