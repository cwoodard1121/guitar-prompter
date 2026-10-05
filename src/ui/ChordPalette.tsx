import { useEffect, useMemo, useState } from 'react';
import type { Part } from '../model/types';
import { QUALITIES, pcName, qualityById, transposeChord, mod12 } from '../model/music';
import { findVoicings } from '../model/voicing';
import type { ChordStep } from '../model/song';
import { ChordDiagram } from './ChordDiagram';
import { Icon } from './Icon';
import { audition } from '../audio/player';

const PALETTE = ['maj', 'm', '5', '7', 'm7', 'maj7', 'sus2', 'sus4', '7sus4', 'add9', 'madd9', '6', 'm6', '9', 'm9', 'maj9', 'dim', 'dim7', 'm7b5', 'aug', 'mmaj7', '7#9', '11', '13'];
const label = (id: string) => (id === 'maj' ? 'maj' : qualityById(id).suffix);

interface Props {
  part: Part;
  /** Chords already used in the song (shape names), for one-tap entry. */
  used: string[];
  /** Name worked out from the notes at the cursor or the fretboard draft. */
  detected: { name: string; source: 'beat' | 'draft'; auto?: boolean } | null;
  concert: boolean;
  chordStep: ChordStep;
  onStep: (s: ChordStep) => void;
  /** name is the shape name to store; frets null = name only. */
  onPlace: (name: string, frets: number[] | null) => void;
  onNameBeat: (name: string) => void;
  onPreview: (frets: number[] | null) => void;
  onClearDraft: () => void;
}

export function ChordPalette(p: Props) {
  const { part, concert } = p;
  const [root, setRoot] = useState(7); // G
  const [flats, setFlats] = useState(false);
  const [qual, setQual] = useState('maj');
  const [bass, setBass] = useState<number | null>(null);
  const [vi, setVi] = useState(0);

  const spell = flats ? 'flat' : 'sharp';
  const shown = pcName(root, spell) + qualityById(qual).suffix + (bass !== null && bass !== root ? '/' + pcName(bass, spell) : '');
  // What you see is concert pitch when playing without the capo; we store the shape.
  const shapeName = concert && part.capo ? transposeChord(shown, -part.capo) : shown;
  const voicings = useMemo(() => findVoicings(shapeName, part.tuning), [shapeName, part.tuning]);
  const frets = voicings[Math.min(vi, voicings.length - 1)] ?? null;

  useEffect(() => setVi(0), [shapeName]);
  useEffect(() => {
    p.onPreview(frets);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frets?.join(',')]);

  const disp = (name: string) => (concert && part.capo ? transposeChord(name, part.capo) : name);
  const tab = part.kind === 'tab';

  function hear(f: number[] | null) {
    if (!f) return;
    const m: number[] = [];
    for (let s = f.length - 1; s >= 0; s--) if (f[s] >= 0) m.push(part.tuning[s] + part.capo + f[s]);
    audition(m, true);
  }

  function place(name: string) {
    const v = findVoicings(name, part.tuning)[0] ?? null;
    p.onPlace(name, tab ? v : null);
  }

  return (
    <div className="palette">
      <div className="pal-main">
        <div className="pal-row">
          <span className="pal-key">Song</span>
          <div className="chips">
            {p.used.length === 0 && <span className="chips-empty">Chords you add show up here for one-tap reuse</span>}
            {p.used.map((c) => (
              <button key={c} className="chip chip-song" onClick={() => place(c)} title={`Add ${disp(c)}`}>
                {disp(c)}
              </button>
            ))}
          </div>
        </div>
        <div className="pal-row">
          <span className="pal-key">Root</span>
          <div className="chips roots">
            {Array.from({ length: 12 }, (_, pc) => (
              <button key={pc} className={'chip' + (pc === root ? ' on' : '')} onClick={() => setRoot(pc)}>
                {pcName(pc, spell)}
              </button>
            ))}
            <button className="chip chip-quiet" onClick={() => setFlats(!flats)} title="Spell with sharps or flats">
              {flats ? '♭' : '♯'}
            </button>
          </div>
        </div>
        <div className="pal-row">
          <span className="pal-key">Type</span>
          <div className="chips">
            {PALETTE.map((id) => (
              <button key={id} className={'chip' + (id === qual ? ' on' : '')} onClick={() => setQual(id)}>
                {label(id)}
              </button>
            ))}
          </div>
        </div>
        <div className="pal-row">
          <span className="pal-key">Bass</span>
          <div className="chips roots">
            <button className={'chip' + (bass === null ? ' on' : '')} onClick={() => setBass(null)}>
              —
            </button>
            {Array.from({ length: 12 }, (_, pc) => (
              <button
                key={pc}
                className={'chip' + (pc === bass ? ' on' : '')}
                onClick={() => setBass(mod12(pc) === root ? null : pc)}
              >
                /{pcName(pc, spell)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="pal-side">
        {p.detected && (
          <div className="detected">
            <span>{p.detected.source === 'draft' ? 'Your shape' : p.detected.auto ? 'Named from notes' : 'This beat is'}</span>
            <strong>{disp(p.detected.name)}</strong>
            {p.detected.source === 'draft' ? (
              <>
                <button className="btn btn-small" onClick={() => p.onPlace(p.detected!.name, null)}>Add</button>
                <button className="btn btn-small btn-ghost" onClick={p.onClearDraft}>Clear</button>
              </>
            ) : (
              !p.detected.auto && <button className="btn btn-small" onClick={() => p.onNameBeat(p.detected!.name)}>Name it</button>
            )}
          </div>
        )}
        <div className="pick">
          <div className="pick-name" onClick={() => hear(frets)} title="Listen">
            {shown}
            {concert && part.capo > 0 && shapeName !== shown && <small>shape {shapeName}</small>}
          </div>
          {frets ? <ChordDiagram frets={frets} /> : <div className="pick-none">No shape</div>}
          {voicings.length > 1 && (
            <div className="voicings">
              <button className="icon-btn" onClick={() => setVi((vi + voicings.length - 1) % voicings.length)} aria-label="Previous voicing">
                <Icon name="left" size={14} />
              </button>
              <span>
                {vi + 1}/{voicings.length}
              </span>
              <button className="icon-btn" onClick={() => setVi((vi + 1) % voicings.length)} aria-label="Next voicing">
                <Icon name="right" size={14} />
              </button>
            </div>
          )}
        </div>
        <div className="pick-actions">
          <button className="btn btn-primary" onClick={() => p.onPlace(shapeName, tab ? frets : null)}>
            Add {shown}
          </button>
          {tab ? (
            <button className="btn btn-ghost" onClick={() => p.onPlace(shapeName, null)} title="Name the beat without writing the shape">
              Name only
            </button>
          ) : (
            <div className="seg" role="radiogroup" aria-label="After adding, move">
              {(['beat', 'half', 'bar'] as ChordStep[]).map((s) => (
                <button key={s} className={p.chordStep === s ? 'on' : ''} onClick={() => p.onStep(s)} role="radio" aria-checked={p.chordStep === s}>
                  {s === 'beat' ? 'Beat' : s === 'half' ? '½ bar' : 'Bar'}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export { QUALITIES };
