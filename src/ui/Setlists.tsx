import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../state/store';
import { useSetlists } from '../state/setlists';
import { ago, searchSongs, sortSongs } from '../model/library';
import { setEntries, setSummary } from '../model/setlist';
import type { Setlist, Song } from '../model/types';
import { Icon } from './Icon';
import { Menu, MenuItem } from './SongMenu';
import { navigate, routeHref } from './router';
import { toast } from './Toaster';

function deleteSetWithUndo(set: Setlist) {
  const gone = useSetlists.getState().remove(set.id);
  if (gone) toast(`Deleted "${gone.name}"`, { action: { label: 'Undo', run: () => useSetlists.getState().restore(gone) } });
}

const playHref = (set: Setlist, library: Song[]) => {
  const first = setEntries(set, library).find((e) => e.song);
  return first ? routeHref({ name: 'play', id: first.songId, set: set.id }) : null;
};

/* ------------------------------------------------------------- all setlists */

export function SetlistIndex() {
  const sets = useSetlists((s) => s.sets);
  const library = useStore((s) => s.library);
  const sorted = useMemo(() => [...sets].sort((a, b) => b.updatedAt - a.updatedAt), [sets]);
  const create = () => navigate({ name: 'set', id: useSetlists.getState().create() });

  useEffect(() => {
    document.title = 'Setlists · Guitar Prompter';
  }, []);

  return (
    <main className="lib">
      <div className="lib-head">
        <h1>
          Setlists <span className="count">{sets.length}</span>
        </h1>
        <div className="lib-tools">
          <button className="btn btn-primary" onClick={create}>
            <Icon name="plus" size={15} /> New setlist
          </button>
        </div>
      </div>
      {sorted.length === 0 ? (
        <div className="empty">
          <Icon name="list" size={40} />
          <h2>No setlists yet</h2>
          <p>Put songs in the order you'll play them, then play straight through on the stage view, one song after the next.</p>
          <div className="empty-actions">
            <button className="btn btn-primary" onClick={create}>
              <Icon name="plus" size={15} /> New setlist
            </button>
          </div>
        </div>
      ) : (
        <ul className="song-list">
          {sorted.map((s) => {
            const play = playHref(s, library);
            return (
              <li key={s.id} className="song-row">
                <a className="song-open set-open" href={routeHref({ name: 'set', id: s.id })}>
                  <span className="song-name">
                    <strong>{s.name || 'Untitled setlist'}</strong>
                    <span>{setSummary(s, library)}</span>
                  </span>
                  <span className="song-meta set-preview">
                    {setEntries(s, library)
                      .filter((e) => e.song)
                      .slice(0, 4)
                      .map((e) => e.song!.title || 'Untitled')
                      .join(' · ')}
                  </span>
                  <span className="song-when">{ago(s.updatedAt)}</span>
                </a>
                <div className="song-actions">
                  {play && (
                    <a className="icon-btn" href={play} aria-label={`Play ${s.name}`} title="Play the set">
                      <Icon name="stage" size={16} />
                    </a>
                  )}
                  <Menu label="Setlist actions">
                    {(close) => (
                      <MenuItem icon="trash" danger onClick={() => (close(), deleteSetWithUndo(s))}>
                        Delete
                      </MenuItem>
                    )}
                  </Menu>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}

/* ------------------------------------------------------------- one setlist */

export function SetlistPage({ id }: { id: string }) {
  const set = useSetlists((s) => s.sets.find((x) => x.id === id));
  const library = useStore((s) => s.library);
  const { rename, removeAt, move } = useSetlists.getState();
  const [picking, setPicking] = useState(false);
  const [drag, setDrag] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (set) document.title = `${set.name || 'Setlist'} · Guitar Prompter`;
  }, [set?.name]);

  // a brand-new setlist starts with its name selected
  useEffect(() => {
    if (set && set.songIds.length === 0 && set.name === 'New setlist') nameRef.current?.select();
  }, [set?.id]);

  if (!set) {
    return (
      <main className="lib">
        <div className="empty">
          <h2>That setlist isn't here</h2>
          <p>It was deleted, or it's on another device that hasn't synced yet.</p>
          <a className="btn" href="#/sets">
            All setlists
          </a>
        </div>
      </main>
    );
  }

  const entries = setEntries(set, library);
  const play = playHref(set, library);

  const drop = (to: number) => {
    if (drag !== null && drag !== to) move(set.id, drag, to);
    setDrag(null);
    setOver(null);
  };

  return (
    <main className="lib">
      <a className="crumb" href="#/sets">
        <Icon name="left" size={14} /> Setlists
      </a>
      <div className="lib-head set-head">
        <div className="set-title">
          <input ref={nameRef} className="set-name" value={set.name} aria-label="Setlist name" placeholder="Setlist name" onChange={(e) => rename(set.id, e.target.value)} />
          <span className="count">{setSummary(set, library)}</span>
        </div>
        <div className="lib-tools">
          <button className="btn" onClick={() => setPicking(true)}>
            <Icon name="plus" size={15} /> Add songs
          </button>
          {play ? (
            <a className="btn btn-primary" href={play}>
              <Icon name="play" size={13} /> Play set
            </a>
          ) : (
            <button className="btn btn-primary" disabled>
              <Icon name="play" size={13} /> Play set
            </button>
          )}
          <Menu label="Setlist actions">
            {(close) => (
              <MenuItem
                icon="trash"
                danger
                onClick={() => {
                  close();
                  navigate({ name: 'library', tab: 'sets' });
                  deleteSetWithUndo(set);
                }}
              >
                Delete setlist
              </MenuItem>
            )}
          </Menu>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="empty empty-small">
          <p>No songs in this set yet.</p>
          <button className="btn btn-primary" onClick={() => setPicking(true)}>
            <Icon name="plus" size={15} /> Add songs
          </button>
        </div>
      ) : (
        <ol className="set-list">
          {entries.map((e, i) => (
            <li
              key={`${e.songId}-${i}`}
              className={'set-row' + (e.song ? '' : ' is-missing') + (drag === i ? ' is-drag' : '') + (over === i && drag !== null && drag !== i ? (drag < i ? ' drop-after' : ' drop-before') : '')}
              draggable
              onDragStart={(ev) => {
                setDrag(i);
                ev.dataTransfer.effectAllowed = 'move';
              }}
              onDragOver={(ev) => {
                ev.preventDefault();
                setOver(i);
              }}
              onDragEnd={() => (setDrag(null), setOver(null))}
              onDrop={(ev) => (ev.preventDefault(), drop(i))}
              tabIndex={0}
              onKeyDown={(ev) => {
                if (!ev.altKey) return;
                if (ev.key === 'ArrowUp' && i > 0) (ev.preventDefault(), move(set.id, i, i - 1));
                if (ev.key === 'ArrowDown' && i < entries.length - 1) (ev.preventDefault(), move(set.id, i, i + 1));
              }}
              aria-label={`${i + 1}. ${e.song?.title ?? 'Missing song'}. Alt+arrow keys to move.`}
            >
              <span className="set-grip" aria-hidden="true">
                <Icon name="grip" size={14} />
              </span>
              <span className="set-num">{i + 1}</span>
              {e.song ? (
                <a className="set-song" href={routeHref({ name: 'play', id: e.songId, set: set.id })} draggable={false}>
                  <strong>{e.song.title || 'Untitled'}</strong>
                  {e.song.artist && <span>{e.song.artist}</span>}
                </a>
              ) : (
                <span className="set-song">
                  <strong>Missing song</strong>
                  <span>Deleted, or not synced to this device yet. Skipped when playing.</span>
                </span>
              )}
              <span className="set-meta">{e.song ? `${e.song.tempo} bpm` : ''}</span>
              <span className="set-move">
                <button className="icon-btn" aria-label="Move up" disabled={i === 0} onClick={() => move(set.id, i, i - 1)}>
                  <Icon name="chevron" size={14} />
                </button>
                <button className="icon-btn flip" aria-label="Move down" disabled={i === entries.length - 1} onClick={() => move(set.id, i, i + 1)}>
                  <Icon name="chevron" size={14} />
                </button>
                <button className="icon-btn" aria-label="Remove from set" onClick={() => removeAt(set.id, i)}>
                  <Icon name="close" size={14} />
                </button>
              </span>
            </li>
          ))}
        </ol>
      )}
      {picking && <SongPicker set={set} onClose={() => setPicking(false)} />}
    </main>
  );
}

/* ------------------------------------------------------------- add songs */

function SongPicker({ set, onClose }: { set: Setlist; onClose: () => void }) {
  const library = useStore((s) => s.library);
  const [query, setQuery] = useState('');
  const shown = useMemo(() => sortSongs(searchSongs(library, query), 'title'), [library, query]);
  const inSet = new Set(set.songIds);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);

  return (
    <div className="modal-back" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal picker" role="dialog" aria-modal="true" aria-labelledby="pick-title">
        <header className="modal-head">
          <h2 id="pick-title">Add songs to "{set.name || 'setlist'}"</h2>
          <button className="icon-btn" aria-label="Close" onClick={onClose}>
            <Icon name="close" size={16} />
          </button>
        </header>
        <label className="search">
          <Icon name="search" size={15} />
          <input autoFocus type="search" placeholder="Search songs" aria-label="Search songs" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <ul className="pick-list">
          {shown.map((s) => (
            <li key={s.id}>
              <button className={'pick-row' + (inSet.has(s.id) ? ' is-in' : '')} onClick={() => useSetlists.getState().addSongs(set.id, [s.id])}>
                <span className="song-name">
                  <strong>{s.title || 'Untitled'}</strong>
                  {s.artist && <span>{s.artist}</span>}
                </span>
                <span className="pick-state">{inSet.has(s.id) ? <><Icon name="check" size={14} /> In set · add again</> : <><Icon name="plus" size={14} /> Add</>}</span>
              </button>
            </li>
          ))}
          {shown.length === 0 && <li className="pick-none">No songs match.</li>}
        </ul>
        <div className="modal-actions">
          <button className="btn btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
