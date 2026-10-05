import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase, supabaseRemote } from './supabase';
import { setRemote, syncNow } from './storage';
import { useStore } from '../state/store';

/** Signed-in Supabase user (null = signed out or sync not configured). */
export function useAccount(): User | null {
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => data.subscription.unsubscribe();
  }, []);
  return user;
}

/** Runs a sync and applies the merged library to the editor. */
export async function syncAndApply() {
  const merged = await syncNow();
  if (merged) useStore.getState().replaceLibrary(merged);
}

/** Keeps songs synced while signed in: now, every minute, on focus and when back online. */
export function useSync(user: User | null) {
  useEffect(() => {
    if (!supabase || !user) {
      setRemote(null);
      return;
    }
    setRemote(supabaseRemote(supabase, user.id));
    void syncAndApply();
    const tick = () => void syncAndApply();
    const id = setInterval(tick, 60_000);
    const onVisible = () => document.visibilityState === 'visible' && tick();
    window.addEventListener('focus', tick);
    window.addEventListener('online', tick);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      window.removeEventListener('focus', tick);
      window.removeEventListener('online', tick);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [user]);
}
