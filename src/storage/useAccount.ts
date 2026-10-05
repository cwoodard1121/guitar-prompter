import { useEffect } from 'react';
import type { User } from '@supabase/supabase-js';
import { create } from 'zustand';
import { supabase, supabaseAudio, supabaseRemote } from './supabase';
import { setAudioRemote, uploadPending } from './audioSync';
import { setRemote, syncNow } from './storage';
import { useStore } from '../state/store';

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

/** Runs a sync and applies the merged library to the editor. */
export async function syncAndApply() {
  const merged = await syncNow();
  if (merged) {
    useStore.getState().replaceLibrary(merged);
    void uploadPending();
  }
}

/** Keeps songs synced while signed in: now, every minute, on focus and when back online. */
export function useSync(user: User | null) {
  useEffect(() => {
    if (!supabase || !user) {
      setRemote(null);
      setAudioRemote(null);
      return;
    }
    setRemote(supabaseRemote(supabase, user.id));
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
