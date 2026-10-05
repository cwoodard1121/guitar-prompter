import { useEffect, useRef, useState } from 'react';
import type { Song } from '../model/types';
import { useAccount } from '../storage/useAccount';
import { supabase } from '../storage/supabase';
import { createShare, getShare, removeShare, shareUrl } from '../storage/shares';
import { Icon } from './Icon';
import { toast } from './Toaster';

/** Make, copy or stop a read-only link to a song. */
export function ShareDialog({ song, onClose }: { song: Song; onClose: () => void }) {
  const user = useAccount();
  const [token, setToken] = useState<string | null | undefined>(undefined); // undefined = loading
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return setToken(null);
    getShare(song.id).then(setToken, (e) => (setError(String(e.message ?? e)), setToken(null)));
  }, [song.id, user]);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    box.current?.focus();
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(String((e as Error).message ?? e));
    }
    setBusy(false);
  }

  const url = token ? shareUrl(token) : '';
  const local = /^https?:\/\/(localhost|127\.0\.0\.1)/.test(url);

  return (
    <div className="modal-back" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="share-title" tabIndex={-1} ref={box}>
        <header className="modal-head">
          <h2 id="share-title">Share "{song.title || 'Untitled'}"</h2>
          <button className="icon-btn" aria-label="Close" onClick={onClose}>
            <Icon name="close" size={16} />
          </button>
        </header>

        {!supabase || !user ? (
          <p className="modal-note">Sign in (library, top right) to make share links. Links are read-only and you can turn them off any time.</p>
        ) : token === undefined ? (
          <p className="modal-note">
            <span className="spinner" aria-hidden="true" /> Checking…
          </p>
        ) : token ? (
          <>
            <p className="modal-note">Anyone with this link can view and play along, read-only. They see your latest saved version. Recordings aren't shared.</p>
            <div className="share-url">
              <input readOnly value={url} aria-label="Share link" onFocus={(e) => e.currentTarget.select()} />
              <button
                className="btn btn-primary"
                onClick={() =>
                  void navigator.clipboard.writeText(url).then(
                    () => toast('Link copied'),
                    () => toast('Select the link and copy it', { tone: 'error' }),
                  )
                }
              >
                <Icon name="copy" size={14} /> Copy
              </button>
            </div>
            {local && <p className="modal-warn">This link points at your own computer (localhost), so it only opens where the app is running. Bandmates can open it once the app is hosted online (set VITE_PUBLIC_URL to that address).</p>}
            <div className="modal-actions">
              <button className="btn btn-danger" disabled={busy} onClick={() => void run(async () => (await removeShare(song.id), setToken(null), toast('Link turned off')))}>
                Stop sharing
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="modal-note">Make a read-only link to send to bandmates. No account needed to open it, and you can turn it off any time.</p>
            <div className="modal-actions">
              <button className="btn btn-primary" disabled={busy} onClick={() => void run(async () => setToken(await createShare(song.id)))}>
                <Icon name="link" size={14} /> {busy ? 'Making link…' : 'Create link'}
              </button>
            </div>
          </>
        )}
        {error && <p className="acct-error">{error}</p>}
      </div>
    </div>
  );
}
