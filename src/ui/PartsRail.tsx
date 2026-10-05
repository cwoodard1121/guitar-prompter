import { useState } from 'react';
import { useStore } from '../state/store';
import { TUNINGS, tuningLabel } from '../model/music';
import { barCount, emptyBar, newPart, PART_COLORS } from '../model/song';
import type { PartKind } from '../model/types';
import { Icon } from './Icon';

export function PartsRail() {
  const song = useStore((s) => s.song);
  const cursor = useStore((s) => s.cursor);
  const edit = useStore((s) => s.edit);
  const setCursor = useStore((s) => s.setCursor);
  const [open, setOpen] = useState<string | null>(null);

  const add = (kind: PartKind) =>
    edit((d, c) => {
      const p = newPart(d, kind, barCount(d));
      d.parts.push(p);
      setOpen(p.id);
      return { ...c, partId: p.id, beat: 0, string: 0 };
    });

  return (
    <aside className="rail" aria-label="Parts">
      <div className="rail-head">
        <span>Parts</span>
      </div>
      <ul className="parts">
        {song.parts.map((p) => {
          const active = p.id === cursor.partId;
          return (
            <li key={p.id} className={'part' + (active ? ' is-active' : '')}>
              <button className="part-main" onClick={() => setCursor({ partId: p.id, beat: 0 })} aria-pressed={active}>
                <span className="part-pip" style={{ background: p.color }} />
                <span className="part-text">
                  <span className="part-name">{p.name}</span>
                  <span className="part-meta">
                    {p.kind === 'tab' ? 'Tab' : 'Chords'} · {tuningLabel(p.tuning)}
                    {p.capo ? ` · Capo ${p.capo}` : ''}
                  </span>
                </span>
              </button>
              <button
                className={'icon-btn' + (p.muted ? ' is-off' : '')}
                aria-label={p.muted ? `Unmute ${p.name}` : `Mute ${p.name}`}
                onClick={() => edit((d) => void (d.parts.find((x) => x.id === p.id)!.muted = !p.muted))}
              >
                <Icon name={p.muted ? 'mute' : 'sound'} size={15} />
              </button>
              <button
                className={'icon-btn' + (open === p.id ? ' on' : '')}
                aria-label={`Settings for ${p.name}`}
                aria-expanded={open === p.id}
                onClick={() => setOpen(open === p.id ? null : p.id)}
              >
                <Icon name="gear" size={15} />
              </button>
              {open === p.id && (
                <div className="part-settings">
                  <label>
                    <span>Name</span>
                    <input
                      value={p.name}
                      onChange={(e) => edit((d) => void (d.parts.find((x) => x.id === p.id)!.name = e.target.value))}
                    />
                  </label>
                  <label>
                    <span>Type</span>
                    <select
                      value={p.kind}
                      onChange={(e) =>
                        edit((d) => {
                          const part = d.parts.find((x) => x.id === p.id)!;
                          const kind = e.target.value as PartKind;
                          if (kind === part.kind) return;
                          part.kind = kind;
                          // keep chord names; tab notes don't carry into a chord chart
                          part.bars = part.bars.map((b) => {
                            const fresh = emptyBar(d, kind);
                            const names = b.beats.filter((x) => x.chord);
                            if (kind === 'chords' && names.length && fresh.beats.length) fresh.beats[0].chord = names[0].chord;
                            return kind === 'tab' ? { beats: b.beats.map((x) => ({ ...x, notes: [] })) } : fresh;
                          });
                        })
                      }
                    >
                      <option value="tab">Tab (notes + tab)</option>
                      <option value="chords">Chords (play-along chart)</option>
                    </select>
                  </label>
                  <label>
                    <span>Tuning</span>
                    <select
                      value={TUNINGS.find((t) => t.notes.join() === p.tuning.join())?.id ?? ''}
                      onChange={(e) =>
                        edit((d) => {
                          const t = TUNINGS.find((x) => x.id === e.target.value)!;
                          const part = d.parts.find((x) => x.id === p.id)!;
                          part.tuning = [...t.notes];
                          for (const b of part.bars)
                            for (const bt of b.beats) bt.notes = bt.notes.filter((n) => n.string < t.notes.length);
                        })
                      }
                    >
                      {TUNINGS.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="field">
                    <span>Capo</span>
                    <div className="stepper">
                      <button
                        className="icon-btn"
                        aria-label="Capo down"
                        disabled={p.capo === 0}
                        onClick={() => edit((d) => void (d.parts.find((x) => x.id === p.id)!.capo = Math.max(0, p.capo - 1)))}
                      >
                        −
                      </button>
                      <output>{p.capo === 0 ? 'None' : p.capo}</output>
                      <button
                        className="icon-btn"
                        aria-label="Capo up"
                        disabled={p.capo >= 12}
                        onClick={() => edit((d) => void (d.parts.find((x) => x.id === p.id)!.capo = Math.min(12, p.capo + 1)))}
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <div className="field">
                    <span>Color</span>
                    <div className="swatches">
                      {PART_COLORS.map((c) => (
                        <button
                          key={c}
                          className={'swatch' + (c === p.color ? ' on' : '')}
                          style={{ background: c }}
                          aria-label={`Color ${c}`}
                          onClick={() => edit((d) => void (d.parts.find((x) => x.id === p.id)!.color = c))}
                        />
                      ))}
                    </div>
                  </div>
                  <button
                    className="btn btn-danger btn-small"
                    disabled={song.parts.length <= 1}
                    onClick={() =>
                      edit((d, c) => {
                        d.parts = d.parts.filter((x) => x.id !== p.id);
                        setOpen(null);
                        return { ...c, partId: d.parts[0].id, beat: 0 };
                      })
                    }
                  >
                    <Icon name="trash" size={14} /> Delete part
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <div className="rail-add">
        <button className="btn btn-ghost" onClick={() => add('tab')}>
          <Icon name="plus" size={14} /> Tab part
        </button>
        <button className="btn btn-ghost" onClick={() => add('chords')}>
          <Icon name="plus" size={14} /> Chord part
        </button>
      </div>
    </aside>
  );
}
