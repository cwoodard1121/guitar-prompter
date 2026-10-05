import { useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../storage/supabase';
import { syncAndApply } from '../storage/useAccount';

/** Sign-in / sync section of the song menu. */
export function Account({ user, onDone }: { user: User | null; onDone: (msg: string) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!supabase) {
    return <p className="acct-note">Sync is off. Add your Supabase URL and key to .env.local to sync between devices.</p>;
  }

  if (user) {
    return (
      <div className="acct">
        <p className="acct-note">
          Syncing as <strong>{user.email}</strong>
        </p>
        <div className="acct-actions">
          <button className="btn btn-small" onClick={() => void syncAndApply().then(() => onDone('Synced'))}>
            Sync now
          </button>
          <button className="btn btn-small btn-ghost" onClick={() => void supabase!.auth.signOut().then(() => onDone('Signed out. Songs stay on this device.'))}>
            Sign out
          </button>
        </div>
      </div>
    );
  }

  async function go(kind: 'in' | 'up') {
    setBusy(true);
    setError(null);
    const { error } =
      kind === 'in'
        ? await supabase!.auth.signInWithPassword({ email, password })
        : await supabase!.auth.signUp({ email, password });
    setBusy(false);
    if (error) setError(error.message);
    else onDone(kind === 'in' ? 'Signed in. Syncing your songs.' : 'Account created. Check your email if Supabase asks you to confirm.');
  }

  return (
    <form
      className="acct"
      onSubmit={(e) => {
        e.preventDefault();
        void go('in');
      }}
    >
      <p className="acct-note">Sign in to sync songs between your PC and laptop.</p>
      <input id="acct-email" type="email" autoComplete="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <input
        id="acct-password"
        type="password"
        autoComplete="current-password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        minLength={6}
      />
      {error && <p className="acct-error">{error}</p>}
      <div className="acct-actions">
        <button className="btn btn-small btn-primary" type="submit" disabled={busy}>
          Sign in
        </button>
        <button className="btn btn-small btn-ghost" type="button" disabled={busy} onClick={() => void go('up')}>
          Create account
        </button>
      </div>
    </form>
  );
}
