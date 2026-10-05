import { useEffect } from 'react';
import type { User } from '@supabase/supabase-js';
import { create } from 'zustand';
import { supabase, supabaseAudio, supabaseRemote, supabaseSetlists } from './supabase';
import { setAudioRemote, uploadPending } from './audioSync';
import { setlists, songs } from './storage';
import { useStore } from '../state/store';
import { useSetlists } from '../state/setlists';

const useAuth = create<{ user: User | null }>(() => ({ user: null }));
if (supabase) {
  void supabase.auth.getSession().then(({ data }) => useAuth.setState({ user: data.session?.user ?? null }));
  supabase.auth.onAuthStateChange((_event, session) => {
    const user = session?.user ?? null;
    if (user?.id !== useAuth.getState().user?.id) useAuth.setState({ user });
  });
}

/** Signed-in Supabase user (null = signed out or sync not configured). */
export const useAccount = (): User | null => useAuth((s) => s.user);
export const currentUser = () => useAuth.getState().user;

/** Runs a sync and applies the merged songs and setlists. */
export async function syncAndApply() {
  const [merged, sets] = await Promise.all([songs.syncNow(), setlists.syncNow()]);
  if (merged) {
    useStore.getState().replaceLibrary(merged);
    void uploadPending();
  }
  if (sets) useSetlists.getState().replace(sets);
}

/** Keeps songs synced while signed in: now, every minute, on focus and when back online. */
export function useSync(user: User | null) {
  useEffect(() => {
    if (!supabase || !user) {
      songs.setRemote(null);
      setlists.setRemote(null);
      setAudioRemote(null);
      return;
    }
    songs.setRemote(supabaseRemote(supabase, user.id));
    setlists.setRemote(supabaseSetlists(supabase, user.id));
    setAudioRemote(supabaseAudio(supabase, user.id));
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
