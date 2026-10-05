import { useEffect, useRef, useState } from 'react';
import { useStore, focusedPart } from '../state/store';
import { onSync, type SyncState } from '../storage/storage';
import { pickFile, saveFile } from '../storage/download';
import { repairSong } from '../model/song';
import type { Song } from '../model/types';
import { Icon } from './Icon';
import { Account } from './Account';
import type { User } from '@supabase/supabase-js';

interface Props {
  user: User | null;
  playing: boolean;
  metronome: boolean;
  onPlay: () => void;
  onMetronome: () => void;
  toast: (msg: string) => void;
}

const slug = (s: string) => s.trim().replace(/[^\w\- ]+/g, '').replace(/\s+/g, '-').toLowerCase() || 'song';

export function TopBar({ user, playing, metronome, onPlay, onMetronome, toast }: Props) {
  const song = useStore((s) => s.song);
  const library = useStore((s) => s.library);
  const capoView = useStore((s) => s.capoView);
  const focusOnly = useStore((s) => s.focusOnly);
  const part = useStore(focusedPart);
  const { edit, set, openSong, createSong, importSong, deleteSong } = useStore.getState();
  const [menu, setMenu] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [sync, setSync] = useState<SyncState>('off');
  const menuRef = useRef<HTMLDivElement>(null);
  const anyCapo = song.parts.some((p) => p.capo > 0);

  useEffect(() => onSync(setSync), []);
  useEffect(() => {
    if (!menu) return;
    const close = (e: PointerEvent) => !menuRef.current?.contains(e.target as Node) && setMenu(false);
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [menu]);

  async function exportJson() {
    const r = await saveFile(`${slug(song.title)}.json`, JSON.stringify({ app: 'guitarprompter', version: 1, song }, null, 2));
    toast(r === 'saved' ? 'Exported JSON' : 'Export cancelled');
  }

  async function importJson() {
    const text = await pickFile();
    if (!text) return;
    try {
      const raw = JSON.parse(text);
      const s: Song = raw.song ?? raw;
      if (!s?.parts?.length) throw new Error('no parts');
      importSong(repairSong(s));
      toast(`Imported "${s.title}"`);
    } catch {
      toast("That file isn't a Guitar Prompter song");
    }
    setMenu(false);
  }

  return (
    <header className="topbar">
      <div className="song-menu" ref={menuRef}>
        <button className="brand" onClick={() => setMenu(!menu)} aria-expanded={menu} aria-haspopup="menu">
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <circle cx="12" cy="12" r="3.2" fill="currentColor" />
          </svg>
          <Icon name="chevron" size={14} />
        </button>
        {menu && (
          <div className="menu" role="menu">
            <div className="menu-label">Songs</div>
            <div className="menu-songs">
              {library.map((s) => (
                <button
                  key={s.id}
                  role="menuitem"
                  className={'menu-item' + (s.id === song.id ? ' on' : '')}
                  onClick={() => {
                    openSong(s.id);
                    setMenu(false);
                  }}
                >
                  <span>{s.title || 'Untitled'}</span>
                  <small>{s.artist}</small>
                </button>
              ))}
            </div>
            <div className="menu-sep" />
            <div className="menu-label">Sync</div>
            <Account user={user} onDone={(m) => toast(m)} />
            <div className="menu-sep" />
            <button role="menuitem" className="menu-item" onClick={() => (createSong(), setMenu(false))}>
              <Icon name="plus" size={14} /> New song
            </button>
            <button role="menuitem" className="menu-item" onClick={importJson}>
              <Icon name="upload" size={14} /> Import JSON…
            </button>
            <button role="menuitem" className="menu-item" onClick={exportJson}>
              <Icon name="download" size={14} /> Export JSON
            </button>
            {confirmDel ? (
              <button
                role="menuitem"
                className="menu-item danger"
                onClick={() => {
                  deleteSong(song.id);
                  setConfirmDel(false);
                  setMenu(false);
                }}
              >
                <Icon name="trash" size={14} /> Really delete "{song.title}"?
              </button>
            ) : (
              <button role="menuitem" className="menu-item" onClick={() => setConfirmDel(true)}>
                <Icon name="trash" size={14} /> Delete song
              </button>
            )}
          </div>
        )}
      </div>

      <div className="title-fields">
        <input
          className="title-input"
          value={song.title}
          placeholder="Song title"
          aria-label="Song title"
          onChange={(e) => edit((d) => void (d.title = e.target.value))}
        />
        <input
          className="artist-input"
          value={song.artist}
          placeholder="Artist"
          aria-label="Artist"
          onChange={(e) => edit((d) => void (d.artist = e.target.value))}
        />
      </div>

      <div className="transport">
        <button className={'play' + (playing ? ' is-playing' : '')} onClick={onPlay} aria-label={playing ? 'Stop' : 'Play from cursor'}>
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
        <button className={'icon-btn' + (metronome ? ' on' : '')} onClick={onMetronome} aria-pressed={metronome} title="Metronome">
          <Icon name="metronome" size={16} />
        </button>
      </div>

      <div className="views">
        <div className="seg" role="radiogroup" aria-label="Capo view" title={anyCapo ? '' : 'Set a capo on a part to use this'}>
          <button className={capoView === 'shapes' ? 'on' : ''} role="radio" aria-checked={capoView === 'shapes'} onClick={() => set({ capoView: 'shapes' })}>
            With capo
          </button>
          <button className={capoView === 'concert' ? 'on' : ''} role="radio" aria-checked={capoView === 'concert'} onClick={() => set({ capoView: 'concert' })}>
            No capo
          </button>
        </div>
        <button className={'icon-btn' + (focusOnly ? ' on' : '')} onClick={() => set({ focusOnly: !focusOnly })} aria-pressed={focusOnly} title={focusOnly ? 'Show all parts' : `Show only ${part.name}`}>
          <Icon name={focusOnly ? 'eye' : 'layers'} size={16} />
        </button>
        <span className={'sync sync-' + sync} title={{ off: 'Saved on this device only. Sign in (song menu) to sync', syncing: 'Syncing…', synced: 'Synced', error: "Couldn't sync — saved in this browser" }[sync]} />
      </div>
    </header>
  );
}
