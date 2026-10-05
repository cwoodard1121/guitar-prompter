import { useEffect } from 'react';
import { App } from './App';
import { useStore } from './state/store';
import { useAccount, useSync } from './storage/useAccount';
import { loadLocalSongs, onOtherTabChange } from './storage/storage';
import { Library } from './ui/Library';
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

  const songId = route.name === 'song' ? route.id : null;
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
  if (route.name === 'song') page = known && openId === songId ? <App key={songId} /> : <div className="page" />;

  return (
    <>
      {page}
      <Toaster />
    </>
  );
}
