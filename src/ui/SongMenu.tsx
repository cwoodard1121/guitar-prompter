import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useStore } from '../state/store';
import { exportSong } from '../storage/songFile';
import type { Song } from '../model/types';
import { Icon } from './Icon';
import { navigate } from './router';
import { toast } from './Toaster';
import { ShareDialog } from './ShareDialog';

/** A small popover menu anchored to its trigger. Closes on outside click or Escape. */
export function Menu({ label, icon = 'more', align = 'right', children }: { label: string; icon?: string; align?: 'left' | 'right'; children: (close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('pointerdown', away);
    window.addEventListener('keydown', esc);
    return () => {
      window.removeEventListener('pointerdown', away);
      window.removeEventListener('keydown', esc);
    };
  }, [open]);
  return (
    <div className="menu-anchor" ref={ref}>
      <button className={'icon-btn' + (open ? ' on' : '')} aria-label={label} title={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>
        <Icon name={icon} size={16} />
      </button>
      {open && (
        <div className={'menu menu-' + align} role="menu">
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

export function MenuItem({ icon, children, onClick, danger }: { icon: string; children: ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button role="menuitem" className={'menu-item' + (danger ? ' danger' : '')} onClick={onClick}>
      <Icon name={icon} size={15} /> {children}
    </button>
  );
}

/** Deletes a song with an Undo toast instead of a confirm dialog. */
export function deleteWithUndo(song: Song) {
  const gone = useStore.getState().deleteSong(song.id);
  if (!gone) return;
  toast(`Deleted "${gone.title || 'Untitled'}"`, { action: { label: 'Undo', run: () => useStore.getState().restoreSong(gone) } });
}

/** Everything you can do to a whole song: shared by library rows and the editor. */
export function SongMenu({ song, inEditor = false }: { song: Song; inEditor?: boolean }) {
  const [sharing, setSharing] = useState(false);
  return (
    <>
    {sharing && <ShareDialog song={song} onClose={() => setSharing(false)} />}
    <Menu label="Song actions">
      {(close) => (
        <>
          {!inEditor && (
            <MenuItem icon="right" onClick={() => (close(), navigate({ name: 'song', id: song.id }))}>
              Open in editor
            </MenuItem>
          )}
          <MenuItem icon="stage" onClick={() => (close(), navigate({ name: 'play', id: song.id }))}>
            Play on stage
          </MenuItem>
          <MenuItem
            icon="copy"
            onClick={() => {
              close();
              const id = useStore.getState().duplicateSong(song.id);
              if (!id) return;
              toast('Copy made', { action: { label: 'Open', run: () => navigate({ name: 'song', id }) } });
            }}
          >
            Duplicate
          </MenuItem>
          <MenuItem icon="share" onClick={() => (close(), setSharing(true))}>
            Share link…
          </MenuItem>
          <MenuItem icon="download" onClick={() => (close(), exportSong(song), toast('Exported JSON'))}>
            Export JSON
          </MenuItem>
          <div className="menu-sep" />
          <MenuItem
            icon="trash"
            danger
            onClick={() => {
              close();
              if (inEditor) navigate({ name: 'library', tab: 'songs' });
              deleteWithUndo(song);
            }}
          >
            Delete
          </MenuItem>
        </>
      )}
    </Menu>
    </>
  );
}
