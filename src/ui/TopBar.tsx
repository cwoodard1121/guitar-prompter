import { useRef } from 'react';
import { useStore, focusedPart } from '../state/store';
import { Icon } from './Icon';
import { Menu, SongMenu } from './SongMenu';
import { SYNC_LABEL, useSyncState } from './Account';

interface Props {
  playing: boolean;
  metronome: boolean;
  onPlay: () => void;
  onMetronome: () => void;
}

export function TopBar({ playing, metronome, onPlay, onMetronome }: Props) {
  const song = useStore((s) => s.song);
  const capoView = useStore((s) => s.capoView);
  const focusOnly = useStore((s) => s.focusOnly);
  const speed = useStore((s) => s.speed);
  const loopBars = useStore((s) => s.loopBars);
  const taps = useRef<number[]>([]);

  /** Tap tempo: average the last few taps (a 2 s pause starts over). */
  function tapTempo() {
    const now = performance.now();
    const t = taps.current.filter((x) => now - x < 2000).concat(now).slice(-6);
    taps.current = t;
    if (t.length >= 4) {
      const bpm = Math.round(60000 / ((t[t.length - 1] - t[0]) / (t.length - 1)));
      if (bpm >= 30 && bpm <= 300) edit((d) => void (d.tempo = bpm));
    }
  }
  const part = useStore(focusedPart);
  const { edit, set } = useStore.getState();
  const sync = useSyncState();
  const anyCapo = song.parts.some((p) => p.capo > 0);

  const practiceOn = speed !== 1 || loopBars > 0;

  return (
    <header className="topbar">
      <a className="icon-btn back" href="#/" aria-label="All songs" title="All songs">
        <Icon name="back" size={16} />
      </a>
      <div className="title-fields">
        <input
          className="title-input"
          value={song.title}
          placeholder="Song title"
          aria-label="Song title"
          style={{ width: `${Math.min(28, Math.max(7, song.title.length + 1.5))}ch` }}
          onChange={(e) => edit((d) => void (d.title = e.target.value))}
        />
        <input
          className="artist-input"
          value={song.artist}
          placeholder="Artist"
          aria-label="Artist"
          style={{ width: `${Math.min(22, Math.max(6, song.artist.length + 2))}ch` }}
          onChange={(e) => edit((d) => void (d.artist = e.target.value))}
        />
      </div>

      <div className="transport">
        <button className={'play' + (playing ? ' is-playing' : '')} onClick={onPlay} aria-label={playing ? 'Stop' : 'Play from cursor'} title={playing ? 'Stop (Space)' : 'Play from cursor (Space)'}>
          <Icon name={playing ? 'stop' : 'play'} size={16} />
        </button>
        <label className="tempo" title="Tempo (BPM)">
          <input
            type="number"
            min={30}
            max={300}
            value={song.tempo}
            onChange={(e) => edit((d) => void (d.tempo = Math.max(30, Math.min(300, Number(e.target.value) || 100))))}
          />
          <span>bpm</span>
        </label>
        <select
          className="timesig"
          aria-label="Time signature"
          value={song.timeSig.join('/')}
          onChange={(e) => edit((d) => void (d.timeSig = e.target.value.split('/').map(Number) as [number, number]))}
        >
          {['4/4', '3/4', '2/4', '6/8', '12/8', '5/4', '7/8'].map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <button className={'icon-btn' + (metronome ? ' on' : '')} onClick={onMetronome} aria-pressed={metronome} aria-label="Metronome" title="Metronome">
          <Icon name="metronome" size={16} />
        </button>
        <Menu label="Practice: tap tempo, slow down, loop" icon="loop" text={practiceOn ? `${Math.round(speed * 100)}%${loopBars ? ` · ${loopBars} bar${loopBars > 1 ? 's' : ''}` : ''}` : 'Practice'} align="right" active={practiceOn}>
          {() => (
            <div className="practice">
              <div className="practice-row">
                <span className="pal-key">Tempo</span>
                <button className="btn btn-small" onClick={tapTempo}>
                  Tap in time
                </button>
                <span className="practice-hint">{song.tempo} bpm</span>
              </div>
              <div className="practice-row">
                <span className="pal-key">Speed</span>
                <div className="seg" role="radiogroup" aria-label="Playback speed">
                  {[1, 0.9, 0.75, 0.6, 0.5].map((v) => (
                    <button key={v} role="radio" aria-checked={speed === v} className={speed === v ? 'on' : ''} onClick={() => set({ speed: v })}>
                      {Math.round(v * 100)}%
                    </button>
                  ))}
                </div>
              </div>
              <div className="practice-row">
                <span className="pal-key">Loop</span>
                <div className="seg" role="radiogroup" aria-label="Loop bars from the cursor">
                  {[0, 1, 2, 4].map((v) => (
                    <button key={v} role="radio" aria-checked={loopBars === v} className={loopBars === v ? 'on' : ''} onClick={() => set({ loopBars: v })}>
                      {v ? `${v} bar${v > 1 ? 's' : ''}` : 'Off'}
                    </button>
                  ))}
                </div>
              </div>
              <p className="practice-hint">Slowing down keeps the recording's pitch. Loops start at the cursor.</p>
            </div>
          )}
        </Menu>
      </div>

      <div className="views">
        {anyCapo && (
          <div className="seg" role="radiogroup" aria-label="Capo view">
            <button className={capoView === 'shapes' ? 'on' : ''} role="radio" aria-checked={capoView === 'shapes'} onClick={() => set({ capoView: 'shapes' })}>
              With capo
            </button>
            <button className={capoView === 'concert' ? 'on' : ''} role="radio" aria-checked={capoView === 'concert'} onClick={() => set({ capoView: 'concert' })}>
              No capo
            </button>
          </div>
        )}
        <button className={'icon-btn' + (focusOnly ? ' on' : '')} onClick={() => set({ focusOnly: !focusOnly })} aria-pressed={focusOnly} aria-label={focusOnly ? 'Show all parts' : `Show only ${part.name}`} title={focusOnly ? 'Show all parts' : `Show only ${part.name}`}>
          <Icon name={focusOnly ? 'eye' : 'layers'} size={16} />
        </button>
        <span className={'sync-dot sync-' + sync} role="img" aria-label={SYNC_LABEL[sync]} title={sync === 'off' ? 'Saved on this device only. Sign in from the library to sync' : SYNC_LABEL[sync]} />
        <a className="icon-btn" href={`#/play/${encodeURIComponent(song.id)}`} aria-label="Play on stage" title="Play on stage (big, scrolling view)">
          <Icon name="stage" size={16} />
        </a>
        <SongMenu song={song} inEditor />
      </div>
    </header>
  );
}
