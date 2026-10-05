import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../storage/supabase';
import { syncAndApply } from '../storage/useAccount';
import { onSync, type SyncState } from '../storage/storage';
import { toast } from './Toaster';

export const SYNC_LABEL: Record<SyncState, string> = {
  off: 'On this device only',
  syncing: 'Syncing…',
  synced: 'Synced',
  error: "Couldn't sync. Songs are safe on this device",
};

export function useSyncState() {
  const [s, setS] = useState<SyncState>('off');
  useEffect(() => onSync(setS), []);
  return s;
}

/** Sign in (email link or password), sync status, sign out. */
export function Account({ user }: { user: User | null }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [usePassword, setUsePassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sync = useSyncState();

  if (!supabase) {
    return <p className="acct-note">Sync is off. Add your Supabase URL and key to .env.local to sync between devices.</p>;
  }

  if (user) {
    return (
      <div className="acct">
        <div className="acct-who">
          <span className={'sync-dot sync-' + sync} aria-hidden="true" />
          <div>
            <strong>{user.email}</strong>
            <small>{SYNC_LABEL[sync]}</small>
          </div>
        </div>
        <div className="acct-actions">
          <button className="btn btn-small" disabled={sync === 'syncing'} onClick={() => void syncAndApply().then(() => toast('Synced'))}>
            Sync now
          </button>
          <button className="btn btn-small btn-ghost" onClick={() => void supabase!.auth.signOut().then(() => toast('Signed out. Your songs stay on this device.'))}>
            Sign out
          </button>
        </div>
      </div>
    );
  }

  if (sent) {
    return (
      <div className="acct">
        <p className="acct-note">
          Check <strong>{sent}</strong> for a sign-in link. Open it in this browser and you're in.
        </p>
        <button className="btn btn-small btn-ghost" onClick={() => setSent(null)}>
          Use a different email
        </button>
      </div>
    );
  }

  async function go(kind: 'link' | 'in' | 'up') {
    setBusy(true);
    setError(null);
    const redirect = location.origin + location.pathname;
    const { error } =
      kind === 'link'
        ? await supabase!.auth.signInWithOtp({ email, options: { emailRedirectTo: redirect } })
        : kind === 'in'
          ? await supabase!.auth.signInWithPassword({ email, password })
          : await supabase!.auth.signUp({ email, password, options: { emailRedirectTo: redirect } });
    setBusy(false);
    if (error) return setError(error.message);
    if (kind === 'link') setSent(email);
    else toast(kind === 'in' ? 'Signed in. Syncing your songs.' : 'Account created. Confirm the email if asked.');
  }

  return (
    <form
      className="acct"
      onSubmit={(e) => {
        e.preventDefault();
        void go(usePassword ? 'in' : 'link');
      }}
    >
      <p className="acct-note">Sign in to sync songs, recordings and setlists between devices.</p>
      <input type="email" autoComplete="email" placeholder="you@example.com" aria-label="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      {usePassword && (
        <input
          type="password"
          autoComplete="current-password"
          placeholder="Password"
          aria-label="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
        />
      )}
      {error && <p className="acct-error">{error}</p>}
      <div className="acct-actions">
        <button className="btn btn-small btn-primary" type="submit" disabled={busy}>
          {usePassword ? 'Sign in' : 'Email me a link'}
        </button>
        {usePassword ? (
          <button className="btn btn-small btn-ghost" type="button" disabled={busy} onClick={() => void go('up')}>
            Create account
          </button>
        ) : null}
      </div>
      <button className="link-btn" type="button" onClick={() => setUsePassword(!usePassword)}>
        {usePassword ? 'Use an email link instead' : 'Use a password instead'}
      </button>
    </form>
  );
}
