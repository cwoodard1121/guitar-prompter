import { useEffect, useState } from 'react';
import type { Song } from '../model/types';
import { copySong } from '../model/library';
import { useStore } from '../state/store';
import { fetchShared } from '../storage/shares';
import { Stage } from './Stage';
import { Brand } from './Library';
import { Icon } from './Icon';
import { navigate } from './router';
import { toast } from './Toaster';

/** A song someone shared: play it on the stage, or copy it into your own library. */
export function SharedSong({ token }: { token: string }) {
  const [song, setSong] = useState<Song | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSong(undefined);
    fetchShared(token).then(setSong, (e) => (setError(String(e.message ?? e)), setSong(null)));
  }, [token]);

  if (song === undefined) {
    return (
      <div className="page page-center">
        <span className="spinner" aria-hidden="true" />
      </div>
    );
  }

  if (!song) {
    return (
      <div className="page page-center">
        <div className="empty">
          <Brand />
          <h2>This link doesn't work anymore</h2>
          <p>{error ? `Couldn't load it: ${error}` : 'The owner may have stopped sharing it, or deleted the song.'}</p>
          <a className="btn" href="#/">
            Go to my songs
          </a>
        </div>
      </div>
    );
  }

  const add = () => {
    const copy = copySong(song);
    useStore.getState().addSongs([copy]);
    toast(`"${copy.title}" is in your library`);
    navigate({ name: 'song', id: copy.id });
  };

  return (
    <Stage
      song={song}
      backHref="#/"
      backLabel="My songs"
      actions={
        <button className="btn btn-small btn-primary" onClick={add}>
          <Icon name="plus" size={14} /> Add to my library
        </button>
      }
    />
  );
}
