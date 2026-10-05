import type { Dur } from '../model/types';

const P: Record<string, string> = {
  play: 'M7 4.5v15l12-7.5z',
  stop: 'M6.5 6.5h11v11h-11z',
  undo: 'M9 7 4 12l5 5M4.5 12H14a5.5 5.5 0 0 1 0 11h-2',
  redo: 'm15 7 5 5-5 5M19.5 12H10a5.5 5.5 0 0 0 0 11h2',
  plus: 'M12 5v14M5 12h14',
  trash: 'M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13',
  copy: 'M8 8h11v11H8zM5 16V5h11',
  chevron: 'm7 10 5 5 5-5',
  left: 'm15 6-6 6 6 6',
  right: 'm9 6 6 6-6 6',
  gear: 'M12 9.2a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6zM19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3 1a7 7 0 0 0-2-1.2L14.2 3h-4l-.4 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.5a7 7 0 0 0 0 2.4l-2 1.5 2 3.4 2.4-1a7 7 0 0 0 2 1.2l.4 2.6h4l.4-2.6a7 7 0 0 0 2-1.2l2.3 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z',
  download: 'M12 4v11m-5-5 5 5 5-5M5 20h14',
  upload: 'M12 16V5m-5 5 5-5 5 5M5 20h14',
  metronome: 'M9 3h6l4 18H5zM12 16l5-9',
  eye: 'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z',
  mute: 'M4 9h4l5-4v14l-5-4H4zM17 9l4 6M21 9l-4 6',
  sound: 'M4 9h4l5-4v14l-5-4H4zM16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12',
  insert: 'M12 4v16M5 8l-2 4 2 4M19 8l2 4-2 4',
  bar: 'M5 4v16M19 4v16M9 12h6M12 9v6',
  flag: 'M6 21V4h10l-2 4 2 4H6',
  layers: 'm12 4 9 5-9 5-9-5zM3 14l9 5 9-5',
  tap: 'M9 11V5.5a1.5 1.5 0 0 1 3 0V11m0-1.5a1.5 1.5 0 0 1 3 0V11m0-.5a1.5 1.5 0 0 1 3 0v3.5a6 6 0 0 1-6 6h-.6a5 5 0 0 1-4-2L4.5 14a1.6 1.6 0 0 1 2.4-2L9 14M4 4.5 6 6M15 4.5 13 6',
  minus: 'M5 12h14',
  repeat: 'M4 9h12l-3-3M20 15H8l3 3M4 9v2M20 15v-2',
  audio: 'M9 18V6l10-2v12M9 18a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0zM19 16a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z',
  loop: 'M17 2l3 3-3 3M4 11V9a4 4 0 0 1 4-4h12M7 22l-3-3 3-3M20 13v2a4 4 0 0 1-4 4H4',
};

export function Icon({ name, size = 16 }: { name: keyof typeof P | string; size?: number }) {
  const filled = name === 'play' || name === 'stop';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="icon">
      <path
        d={P[name]}
        fill={filled ? 'currentColor' : 'none'}
        stroke={filled ? 'none' : 'currentColor'}
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Drawn note-value glyphs for the duration buttons. */
export function DurGlyph({ dur, rest = false }: { dur: Dur; rest?: boolean }) {
  if (rest) {
    return (
      <svg width="16" height="20" viewBox="0 0 16 20" aria-hidden="true" className="icon">
        <path d="M6 2l4 4.5-3 3.5 4 4.5c-2-1-4-.5-3 2.5-3-2-2.5-5 .5-5L5 9.5 8 6z" fill="currentColor" />
      </svg>
    );
  }
  const open = dur <= 2;
  const stem = dur >= 2;
  const flags = dur >= 32 ? 3 : dur >= 16 ? 2 : dur >= 8 ? 1 : 0;
  return (
    <svg width="16" height="20" viewBox="0 0 16 20" aria-hidden="true" className="icon">
      <ellipse
        cx="6"
        cy="15.5"
        rx="3.6"
        ry="2.6"
        transform="rotate(-22 6 15.5)"
        fill={open ? 'none' : 'currentColor'}
        stroke="currentColor"
        strokeWidth={open ? 1.4 : 0}
      />
      {stem && <path d="M9.3 14.6V2.5" stroke="currentColor" strokeWidth="1.3" />}
      {Array.from({ length: flags }, (_, i) => (
        <path key={i} d={`M9.3 ${2.5 + i * 3.4}c1 2.2 4 3 3.4 6.2`} stroke="currentColor" strokeWidth="1.3" fill="none" />
      ))}
    </svg>
  );
}
