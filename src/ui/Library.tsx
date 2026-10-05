import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../state/store';
import { useAccount, syncAndApply } from '../storage/useAccount';
import { parseSongFile, pickTextFiles } from '../storage/songFile';
import { ago, searchSongs, sortSongs, type SongSort } from '../model/library';
import type { Song } from '../model/types';
import { Account, SYNC_LABEL, useSyncState } from './Account';
import { Icon } from './Icon';
import { Menu, SongMenu } from './SongMenu';
import { navigate } from './router';
import { toast } from './Toaster';

const SORT_KEY = 'gp:lib-sort';
const readSort = (): SongSort => {
  try {
    const v = localStorage.getItem(SORT_KEY);
    return v === 'title' || v === 'artist' ? v : 'recent';
  } catch {
    return 'recent';
  }
};

export function Brand() {
  return (
    <a className="brand" href="#/" aria-label="Guitar Prompter: all songs">
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="12" cy="12" r="3.2" fill="currentColor" />
      </svg>
      <span className="brand-word">Guitar Prompter</span>
    </a>
  );
}

/** Account chip + popover with sign-in / sync. */
export function AccountButton() {
  const user = useAccount();
  const sync = useSyncState();
  return (
    <div className="acct-chip">
      <Menu label={user ? `Account: ${SYNC_LABEL[sync]}` : 'Sign in to sync'} icon="user">
        {() => <Account user={user} />}
      </Menu>
      <span className={'sync-dot sync-' + sync} aria-hidden="true" />
    </div>
  );
}

function songMeta(s: Song) {
  const capo = Math.max(0, ...s.parts.map((p) => p.capo));
  return [`${s.tempo} bpm`, s.timeSig.join('/'), capo ? `capo ${capo}` : null].filter(Boolean).join(' · ');
}

export function Library() {
  const library = useStore((s) => s.library);
  const { createSong, addSongs } = useStore.getState();
  const sync = useSyncState();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SongSort>(readSort);
  const search = useRef<HTMLInputElement>(null);

  const shown = useMemo(() => sortSongs(searchSongs(library, query), sort), [library, query, sort]);

  useEffect(() => {
    try {
      localStorage.setItem(SORT_KEY, sort);
    } catch {
      /* ignore */
    }
  }, [sort]);

  // "/" jumps to search, like most libraries
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === '/' && !(e.target as HTMLElement).closest('input, textarea, select')) {
        e.preventDefault();
        search.current?.focus();
      }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);

  useEffect(() => {
    document.title = 'Songs · Guitar Prompter';
  }, []);

  async function importFiles() {
    const files = await pickTextFiles();
    if (!files.length) return;
    const ok: Song[] = [];
    const bad: string[] = [];
    for (const f of files) {
      try {
        ok.push(parseSongFile(f.text));
      } catch {
        bad.push(f.name);
      }
    }
    if (ok.length) addSongs(ok);
    if (bad.length) toast(`${bad.join(', ')} ${bad.length > 1 ? "aren't" : "isn't"} a Guitar Prompter song`, { tone: 'error' });
    if (ok.length === 1) toast(`Imported "${ok[0].title}"`, { action: { label: 'Open', run: () => navigate({ name: 'song', id: ok[0].id }) } });
    else if (ok.length > 1) toast(`Imported ${ok.length} songs`);
  }

  const newSong = () => navigate({ name: 'song', id: createSong() });

  return (
    <div className="page">
      <header className="page-top">
        <Brand />
        <nav className="page-tabs" aria-label="Library">
          <a className="on" href="#/" aria-current="page">
            Songs
          </a>
        </nav>
        <div className="page-top-end">
          <AccountButton />
        </div>
      </header>

      {sync === 'error' && (
        <div className="banner" role="alert">
          <span>Couldn't reach the sync server. Everything is saved on this device and will sync when it can.</span>
          <button className="btn btn-small" onClick={() => void syncAndApply()}>
            Retry
          </button>
        </div>
      )}

      <main className="lib">
        <div className="lib-head">
          <h1>
            Songs <span className="count">{library.length}</span>
          </h1>
          <div className="lib-tools">
            <label className="search">
              <Icon name="search" size={15} />
              <input
                ref={search}
                type="search"
                placeholder="Search songs or artists"
                aria-label="Search songs"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && shown[0]) navigate({ name: 'song', id: shown[0].id });
                  if (e.key === 'Escape') setQuery('');
                }}
              />
              <kbd>/</kbd>
            </label>
            <select aria-label="Sort songs" value={sort} onChange={(e) => setSort(e.target.value as SongSort)}>
              <option value="recent">Recently edited</option>
              <option value="title">Title</option>
              <option value="artist">Artist</option>
            </select>
            <button className="btn" onClick={importFiles}>
              <Icon name="upload" size={15} /> Import
            </button>
            <button className="btn btn-primary" onClick={newSong}>
              <Icon name="plus" size={15} /> New song
            </button>
          </div>
        </div>

        {library.length === 0 ? (
          <div className="empty">
            <svg width="56" height="56" viewBox="0 0 24 24" aria-hidden="true" className="empty-mark">
              <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1" />
              <circle cx="12" cy="12" r="3.2" fill="currentColor" />
            </svg>
            <h2>No songs yet</h2>
            <p>Start one and tab a riff or tap in the chords. Or bring in songs you exported before.</p>
            <div className="empty-actions">
              <button className="btn btn-primary" onClick={newSong}>
                <Icon name="plus" size={15} /> New song
              </button>
              <button className="btn" onClick={importFiles}>
                <Icon name="upload" size={15} /> Import JSON
              </button>
            </div>
          </div>
        ) : shown.length === 0 ? (
          <div className="empty empty-small">
            <p>
              No songs match "<strong>{query}</strong>".
            </p>
            <button className="btn btn-small" onClick={() => setQuery('')}>
              Clear search
            </button>
          </div>
        ) : (
          <ul className="song-list">
            {shown.map((s) => (
              <li key={s.id} className="song-row">
                <a className="song-open" href={`#/song/${encodeURIComponent(s.id)}`}>
                  <span className="song-name">
                    <strong>{s.title || 'Untitled'}</strong>
                    {s.artist && <span>{s.artist}</span>}
                  </span>
                  <span className="song-parts" aria-label={s.parts.map((p) => p.name).join(', ')}>
                    {s.parts.map((p) => (
                      <i key={p.id} style={{ background: p.color }} title={p.name} className={p.kind === 'chords' ? 'is-chords' : ''} />
                    ))}
                    {s.audio && <Icon name="audio" size={13} />}
                  </span>
                  <span className="song-meta">{songMeta(s)}</span>
                  <span className="song-when">{ago(s.updatedAt)}</span>
                </a>
                <div className="song-actions">
                  <a className="icon-btn" href={`#/play/${encodeURIComponent(s.id)}`} aria-label={`Play ${s.title || 'Untitled'} on stage`} title="Play on stage">
                    <Icon name="stage" size={16} />
                  </a>
                  <SongMenu song={s} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
