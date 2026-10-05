import { useEffect } from 'react';
import { App } from './App';
import { useStore } from './state/store';
import { useAccount, useSync } from './storage/useAccount';
import { loadLocalSongs, onOtherTabChange } from './storage/storage';
import { Library, Shell } from './ui/Library';
import { SetlistIndex, SetlistPage } from './ui/Setlists';
import { useSetlists } from './state/setlists';
import { setNeighbours } from './model/setlist';
import { setlists } from './storage/storage';
import { routeHref } from './ui/router';
import { Stage, type StageNav } from './ui/Stage';
import { SharedSong } from './ui/SharedSong';
import { Icon } from './ui/Icon';
import { navigate, useRoute } from './ui/router';
import { Toaster, toast } from './ui/Toaster';

/** Picks the page from the URL and keeps sync running whichever page is open. */
export function Root() {
  const route = useRoute();
  const user = useAccount();
  useSync(user);
  const library = useStore((s) => s.library);
  const openId = useStore((s) => s.song.id);

  // Another tab saved songs: pull them in (newest wins, so nothing newer here is lost).
  useEffect(() => onOtherTabChange(() => useStore.getState().replaceLibrary(loadLocalSongs())), []);
  useEffect(() => setlists.onOtherTabChange(() => useSetlists.getState().replace(setlists.loadLocal())), []);
  const sets = useSetlists((s) => s.sets);

  const songId = route.name === 'song' || route.name === 'play' ? route.id : null;
  const known = songId ? library.some((s) => s.id === songId) : false;

  useEffect(() => {
    if (!songId) return;
    if (!known) {
      navigate({ name: 'library', tab: 'songs' }, true);
      toast("That song isn't in your library (deleted, or on another device that hasn't synced).", { tone: 'error' });
      return;
    }
    if (openId !== songId) useStore.getState().openSong(songId);
  }, [songId, known, openId]);

  let page = <Library />;
  if (route.name === 'library' && route.tab === 'sets')
    page = (
      <Shell tab="sets">
        <SetlistIndex />
      </Shell>
    );
  if (route.name === 'set')
    page = (
      <Shell tab="sets">
        <SetlistPage key={route.id} id={route.id} />
      </Shell>
    );
  if (route.name === 'song') page = known && openId === songId ? <App key={songId} /> : <div className="page" />;
  if (route.name === 'share') page = <SharedSong key={route.token} token={route.token} />;
  if (route.name === 'play') {
    const song = library.find((s) => s.id === route.id);
    const set = route.set ? sets.find((s) => s.id === route.set) : undefined;
    let nav: StageNav | undefined;
    if (set) {
      const n = setNeighbours(set, library, set.songIds.indexOf(route.id));
      const href = (id: string) => routeHref({ name: 'play', id, set: set.id });
      nav = {
        label: `${n.position} of ${n.total} · ${set.name || 'Setlist'}`,
        prev: n.prev?.song ? { href: href(n.prev.songId), title: n.prev.song.title || 'Untitled' } : undefined,
        next: n.next?.song ? { href: href(n.next.songId), title: n.next.song.title || 'Untitled' } : undefined,
      };
    }
    page = song ? (
      <Stage
        key={song.id}
        song={song}
        nav={nav}
        backHref={set ? routeHref({ name: 'set', id: set.id }) : '#/'}
        backLabel={set ? `Back to ${set.name || 'setlist'}` : 'All songs'}
        actions={
          <a className="btn btn-small" href={`#/song/${encodeURIComponent(song.id)}`}>
            <Icon name="gear" size={14} /> <span className="btn-label">Edit</span>
          </a>
        }
      />
    ) : (
      <div className="page" />
    );
  }

  return (
    <>
      {page}
      <Toaster />
    </>
  );
}
