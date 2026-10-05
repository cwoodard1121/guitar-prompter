import { useState } from 'react';
import { useStore, focusedPart } from '../state/store';
import type { Dur } from '../model/types';
import { deleteAtCursor, deleteBar, duplicateBar, insertBar, insertBeatBefore, setBeatDuration, setMarker, setRest } from '../model/song';
import { DurGlyph, Icon } from './Icon';

const DURS: Dur[] = [1, 2, 4, 8, 16, 32];
const DUR_NAME: Record<number, string> = { 1: 'Whole', 2: 'Half', 4: 'Quarter', 8: 'Eighth', 16: 'Sixteenth', 32: '32nd' };
const SECTIONS = ['Intro', 'Verse', 'Pre', 'Chorus', 'Bridge', 'Solo', 'Outro'];

export function Toolbar() {
  const dur = useStore((s) => s.dur);
  const dotted = useStore((s) => s.dotted);
  const stack = useStore((s) => s.stack);
  const cursor = useStore((s) => s.cursor);
  const song = useStore((s) => s.song);
  const canUndo = useStore((s) => s.past.length > 0);
  const canRedo = useStore((s) => s.future.length > 0);
  const part = useStore(focusedPart);
  const { edit, set, undo, redo } = useStore.getState();
  const [sec, setSec] = useState(false);
  const marker = song.markers.find((m) => m.bar === cursor.bar);
  const opts = { dur, dotted, stack };

  const pickDur = (d: Dur) => {
    set({ dur: d });
    const beat = part.bars[cursor.bar]?.beats[cursor.beat];
    if (beat) edit((s, c) => setBeatDuration(s, c, d, dotted));
  };

  return (
    <div className="toolbar" role="toolbar" aria-label="Edit">
      <div className="tgroup" role="radiogroup" aria-label="Note length">
        {DURS.map((d) => (
          <button key={d} className={'tool' + (d === dur ? ' on' : '')} onClick={() => pickDur(d)} role="radio" aria-checked={d === dur} title={DUR_NAME[d]}>
            <DurGlyph dur={d} />
          </button>
        ))}
        <button
          className={'tool' + (dotted ? ' on' : '')}
          aria-pressed={dotted}
          title="Dotted"
          onClick={() => {
            set({ dotted: !dotted });
            const beat = part.bars[cursor.bar]?.beats[cursor.beat];
            if (beat) edit((s, c) => setBeatDuration(s, c, beat.dur, !dotted));
          }}
        >
          <svg width="16" height="20" viewBox="0 0 16 20" aria-hidden="true">
            <circle cx="8" cy="12" r="2.4" fill="currentColor" />
          </svg>
        </button>
        <button className="tool" title="Rest" onClick={() => edit((s, c) => setRest(s, c, opts))}>
          <DurGlyph dur={4} rest />
        </button>
      </div>

      {part.kind === 'tab' && (
        <div className="tgroup">
          <button className={'tool tool-text' + (stack ? ' on' : '')} aria-pressed={stack} onClick={() => set({ stack: !stack })} title="Stack notes on one beat to build a chord">
            Stack
          </button>
        </div>
      )}

      <div className="tgroup">
        <button className="tool" title="Insert beat before cursor" onClick={() => edit((s, c) => insertBeatBefore(s, c, opts))}>
          <Icon name="insert" />
        </button>
        <button className="tool" title="Delete (note, then chord name, then beat)" onClick={() => edit((s, c) => deleteAtCursor(s, c))}>
          <Icon name="trash" />
        </button>
      </div>

      <div className="tgroup">
        <span className="tlabel">Bar {cursor.bar + 1}</span>
        <button className="tool" title="Insert empty bar before" onClick={() => edit((s, c) => (insertBar(s, c.bar), { ...c, beat: 0 }))}>
          <Icon name="bar" />
        </button>
        <button className="tool" title="Duplicate bar" onClick={() => edit((s, c) => (duplicateBar(s, c.bar), { ...c, bar: c.bar + 1, beat: 0 }))}>
          <Icon name="copy" />
        </button>
        <button className="tool tool-danger" title="Delete bar (all parts)" onClick={() => edit((s, c) => (deleteBar(s, c.bar), { ...c, beat: 0 }))}>
          <Icon name="trash" />
        </button>
        <div className="section-pick">
          <button className={'tool tool-text' + (marker ? ' on' : '')} onClick={() => setSec(!sec)} aria-expanded={sec} title="Mark a section">
            <Icon name="flag" size={14} /> {marker?.label ?? 'Section'}
          </button>
          {sec && (
            <div className="popover">
              {SECTIONS.map((s) => (
                <button key={s} className="chip" onClick={() => (edit((d) => setMarker(d, cursor.bar, s)), setSec(false))}>
                  {s}
                </button>
              ))}
              {marker && (
                <button className="chip chip-quiet" onClick={() => (edit((d) => setMarker(d, cursor.bar, '')), setSec(false))}>
                  Clear
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="tgroup tgroup-end">
        <button className="tool" disabled={!canUndo} onClick={undo} title="Undo (Ctrl+Z)">
          <Icon name="undo" />
        </button>
        <button className="tool" disabled={!canRedo} onClick={redo} title="Redo (Ctrl+Shift+Z)">
          <Icon name="redo" />
        </button>
      </div>
    </div>
  );
}
