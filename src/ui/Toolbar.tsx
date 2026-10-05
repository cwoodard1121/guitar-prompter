import { useState } from 'react';
import { useStore, focusedPart } from '../state/store';
import type { Dur } from '../model/types';
import { deleteAtCursor, deleteBar, duplicateBar, insertBar, insertBeatBefore, setBeatDuration, removeRepeat, repeatAt, sectionName, setMarker, setRepeat, setRest, techTarget, toggleTechnique } from '../model/song';
import type { Technique } from '../model/types';
import { DurGlyph, Icon } from './Icon';

const DURS: Dur[] = [1, 2, 4, 8, 16, 32];
const DUR_NAME: Record<number, string> = { 1: 'Whole', 2: 'Half', 4: 'Quarter', 8: 'Eighth', 16: 'Sixteenth', 32: '32nd' };
const TECHS: { id: Technique; label: string; title: string }[] = [
  { id: 'bend1', label: 'b½', title: 'Bend a half step' },
  { id: 'bend2', label: 'b1', title: 'Bend a whole step (full)' },
  { id: 'bend3', label: 'b1½', title: 'Bend 1½ steps' },
  { id: 'h', label: 'H', title: 'Hammer-on to the next note on this string' },
  { id: 'p', label: 'P', title: 'Pull-off to the next note on this string' },
  { id: 'slideUp', label: '/', title: 'Slide up into the next note' },
  { id: 'slideDown', label: '\\', title: 'Slide down into the next note' },
  { id: 'vibrato', label: '~', title: 'Vibrato' },
];
const SECTIONS = ['Intro', 'Verse', 'Pre-chorus', 'Chorus', 'Bridge', 'Solo', 'Outro'];

export function Toolbar() {
  const dur = useStore((s) => s.dur);
  const dotted = useStore((s) => s.dotted);
  const stack = useStore((s) => s.stack);
  const transcribe = useStore((s) => s.transcribe);
  const cursor = useStore((s) => s.cursor);
  const song = useStore((s) => s.song);
  const canUndo = useStore((s) => s.past.length > 0);
  const canRedo = useStore((s) => s.future.length > 0);
  const part = useStore(focusedPart);
  const { edit, set, undo, redo } = useStore.getState();
  const [sec, setSec] = useState(false);
  const [rep, setRep] = useState(false);
  const marker = song.markers.find((m) => m.bar === cursor.bar);
  const repeat = repeatAt(song, cursor.bar);
  // the section the cursor is in: last marker at or before this bar
  const inSection = [...song.markers].reverse().find((m) => m.bar <= cursor.bar) ?? null;
  const sectionStart = inSection ? inSection.bar : null;
  const sectionLabel = inSection?.label ?? '';
  const opts = { dur, dotted, stack };
  const target = techTarget(song, cursor);

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

      <div className="tgroup">
        <button className="tool tool-text tool-accent" onClick={() => set({ tapOpen: !useStore.getState().tapOpen })} title="Tap the rhythm first, fill in notes after">
          <Icon name="tap" size={14} /> Tap rhythm
        </button>
        <button
          className={'tool tool-text' + (transcribe ? ' on' : '')}
          aria-pressed={transcribe}
          onClick={() => set({ transcribe: !transcribe })}
          title="Play the song and tap chords as you hear them"
        >
          <Icon name="audio" size={14} /> Transcribe
        </button>
      </div>

      {part.kind === 'tab' && (
        <div className="tgroup" role="group" aria-label="Technique for the last note">
          {TECHS.map((tq) => {
            const n = target?.note;
            const on =
              !!n &&
              (tq.id.startsWith('bend') ? n.bend === Number(tq.id.slice(4)) : tq.id === 'h' || tq.id === 'p' ? n.legato === tq.id
                : tq.id === 'slideUp' ? n.slide === 'up' : tq.id === 'slideDown' ? n.slide === 'down' : !!n.vibrato);
            return (
              <button
                key={tq.id}
                className={'tool tool-text tool-tech' + (on ? ' on' : '')}
                disabled={!target}
                aria-pressed={on}
                title={target ? `${tq.title} (on the ${target.beat === cursor.beat && target.bar === cursor.bar ? 'selected' : 'last'} note)` : 'Enter a note first, then mark it'}
                onClick={() => edit((s, c) => (toggleTechnique(s, c, tq.id), c))}
              >
                {tq.label}
              </button>
            );
          })}
        </div>
      )}

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
          <button className={'tool tool-text' + (marker ? ' on' : '')} onClick={() => (setSec(!sec), setRep(false))} aria-expanded={sec} title="Start a section (Verse, Chorus…) at this bar">
            <Icon name="flag" size={14} /> {marker?.label ?? 'Section'}
          </button>
          {sec && (
            <div className="popover">
              <div className="pop-title">Section starting at bar {cursor.bar + 1}</div>
              {SECTIONS.map((s) => (
                <button key={s} className="chip" onClick={() => (edit((d) => setMarker(d, cursor.bar, sectionName(d, s, cursor.bar))), setSec(false))}>
                  {s}
                </button>
              ))}
              {marker && (
                <button className="chip chip-quiet" onClick={() => (edit((d) => setMarker(d, cursor.bar, '')), setSec(false))}>
                  Remove
                </button>
              )}
            </div>
          )}
        </div>
        <div className="section-pick">
          <button className={'tool tool-text' + (repeat ? ' on' : '')} onClick={() => (setRep(!rep), setSec(false))} aria-expanded={rep} title="Repeat bars (e.g. play the verse chords 4 times)">
            <Icon name="repeat" size={14} /> {repeat ? `×${repeat.times}` : 'Repeat'}
          </button>
          {rep && (
            <div className="popover popover-wide">
              {repeat ? (
                <>
                  <div className="pop-title">
                    Bars {repeat.start + 1}–{repeat.end + 1} play {repeat.times} times
                  </div>
                  <div className="stepper">
                    <button className="icon-btn" aria-label="Fewer times" disabled={repeat.times <= 2} onClick={() => edit((d) => setRepeat(d, repeat.start, repeat.end, repeat.times - 1))}>
                      <Icon name="minus" size={14} />
                    </button>
                    <output>×{repeat.times}</output>
                    <button className="icon-btn" aria-label="More times" onClick={() => edit((d) => setRepeat(d, repeat.start, repeat.end, repeat.times + 1))}>
                      <Icon name="plus" size={14} />
                    </button>
                    <button className="chip chip-quiet" onClick={() => (edit((d) => removeRepeat(d, cursor.bar)), setRep(false))}>
                      Remove repeat
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="pop-title">Repeat…</div>
                  <button className="chip" onClick={() => (edit((d) => setRepeat(d, cursor.bar, cursor.bar, 2)), setRep(false))}>
                    Bar {cursor.bar + 1} ×2
                  </button>
                  {sectionStart !== null && sectionStart < cursor.bar && (
                    <button className="chip" onClick={() => (edit((d) => setRepeat(d, sectionStart, cursor.bar, 2)), setRep(false))}>
                      {sectionLabel} (bars {sectionStart + 1}–{cursor.bar + 1}) ×2
                    </button>
                  )}
                  {cursor.bar > 0 && (
                    <button className="chip" onClick={() => (edit((d) => setRepeat(d, Math.max(0, cursor.bar - 3), cursor.bar, 2)), setRep(false))}>
                      Last 4 bars ×2
                    </button>
                  )}
                  <div className="pop-hint">Then use + / − to set how many times.</div>
                </>
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
