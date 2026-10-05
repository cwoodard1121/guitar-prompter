import { useEffect, useState } from 'react';
import { useStore } from '../state/store';
import { uid } from '../model/song';
import { deleteAudio, putAudio } from '../storage/audioStore';
import { audioSyncOn, ensureLocalAudio, removeRemoteAudio, uploadIfNeeded, useAudioBusy } from '../storage/audioSync';
import { useAccount } from '../storage/useAccount';
import { loadTrack, trackElement, unloadTrack } from '../audio/track';
import { Icon } from './Icon';
import { toast } from './Toaster';

const MAX_SYNC = 50 * 1024 * 1024;
const mb = (n?: number) => (!n ? '' : n < 1048576 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1048576).toFixed(n < 10485760 ? 1 : 0)} MB`);

const fmt = (s: number) => {
  const sign = s < 0 ? '-' : '';
  const a = Math.abs(s);
  return `${sign}${Math.floor(a / 60)}:${(a % 60).toFixed(2).padStart(5, '0')}`;
};

function pickAudio(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = Object.assign(document.createElement('input'), { type: 'file', accept: 'audio/*,.mp3,.m4a,.wav,.ogg,.flac' });
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.click();
  });
}

/** The song's recording: add it, find where bar 1 starts, set the mix. */
export function AudioRow() {
  const song = useStore((s) => s.song);
  const synthOn = useStore((s) => s.synthOn);
  const { edit, set } = useStore.getState();
  const user = useAccount();
  const busy = useAudioBusy((b) => b[song.id]);
  const [state, setState] = useState<'ready' | 'download' | 'signin' | 'missing' | 'error' | 'none'>('none');
  const [finding, setFinding] = useState(false);
  const audio = song.audio;
  const rev = audio?.rev;

  useEffect(() => {
    if (!audio) return setState('none');
    let live = true;
    const s = useStore.getState().song;
    void ensureLocalAudio(s).then(async (r) => {
      if (r === 'ready') await loadTrack(s.id, s.audio?.rev);
      if (live) setState(r);
    });
    return () => void (live = false);
  }, [song.id, !!audio, rev, user?.id]);

  async function add() {
    const file = await pickAudio();
    if (!file) return;
    const next = uid();
    await putAudio(song.id, file, next);
    unloadTrack();
    edit((d) => void (d.audio = { name: file.name, rev: next, size: file.size, uploaded: false, offset: d.audio?.offset ?? 0, volume: d.audio?.volume ?? 0.9 }));
    await loadTrack(song.id, next);
    setState('ready');
    if (file.size > MAX_SYNC) toast(`${mb(file.size)} is over the 50 MB sync limit, so it stays on this device.`, { tone: 'error' });
    else void uploadIfNeeded(useStore.getState().song);
  }

  function retry() {
    useAudioBusy.setState({ [song.id]: undefined });
    const s = useStore.getState().song;
    if (state === 'ready') void uploadIfNeeded(s);
    else void ensureLocalAudio(s).then(async (r) => (r === 'ready' && (await loadTrack(s.id, s.audio?.rev)), setState(r)));
  }

  /** Plays the recording from the start; press again the moment bar 1 begins. */
  function findBarOne() {
    const el = trackElement();
    if (!el) return;
    if (!finding) {
      el.currentTime = Math.max(0, (audio?.offset ?? 0) - 3);
      el.playbackRate = 1;
      void el.play();
      setFinding(true);
      return;
    }
    const t = Math.max(0, el.currentTime - 0.08); // human reaction time
    el.pause();
    setFinding(false);
    edit((d) => void (d.audio!.offset = Math.round(t * 100) / 100));
  }

  const nudge = (d: number) => edit((s) => void (s.audio!.offset = Math.round((s.audio!.offset + d) * 100) / 100));

  if (!audio) {
    return (
      <div className="audio-row">
        <button className="btn btn-ghost" onClick={add}>
          <Icon name="audio" size={14} /> Add recording (mp3)
        </button>
      </div>
    );
  }

  return (
    <div className="audio-row has-audio">
      <div className="audio-head">
        <Icon name="audio" size={14} />
        <span className="audio-name" title={audio.name}>
          {audio.name}
        </span>
        <button
          className="icon-btn"
          aria-label="Remove recording"
          onClick={() => {
            unloadTrack();
            void deleteAudio(song.id);
            if (audio.uploaded) void removeRemoteAudio(song.id);
            edit((d) => void delete d.audio);
          }}
        >
          <Icon name="trash" size={13} />
        </button>
      </div>
      {state !== 'ready' ? (
        <div className="audio-state">
          {busy === 'downloading' ? (
            <p>
              <span className="spinner" aria-hidden="true" /> Getting it from your account…
            </p>
          ) : state === 'signin' ? (
            <p>It's saved in your account. Sign in (library, top right) to get it here.</p>
          ) : state === 'error' ? (
            <>
              <p>Couldn't download the recording.</p>
              <button className="btn btn-small" onClick={retry}>
                Try again
              </button>
            </>
          ) : state === 'missing' ? (
            <>
              <p>This file is only on the device it was added on. Open the song there while signed in to sync it, or add it here.</p>
              <button className="btn btn-small" onClick={add}>
                Add the file here
              </button>
            </>
          ) : (
            <p>
              <span className="spinner" aria-hidden="true" /> Loading…
            </p>
          )}
        </div>
      ) : (
        <>
          <div className="audio-line">
            <span className="pal-key">Bar 1</span>
            <button className="icon-btn" aria-label="Earlier" onClick={() => nudge(-0.05)}>
              <Icon name="minus" size={12} />
            </button>
            <output>{fmt(audio.offset)}</output>
            <button className="icon-btn" aria-label="Later" onClick={() => nudge(0.05)}>
              <Icon name="plus" size={12} />
            </button>
          </div>
          <button className={'btn btn-small' + (finding ? ' btn-primary' : '')} onClick={findBarOne}>
            {finding ? 'Bar 1 starts NOW' : 'Find bar 1 by ear'}
          </button>
          <div className="audio-line">
            <span className="pal-key">Vol</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={audio.volume}
              aria-label="Recording volume"
              onChange={(e) => edit((d) => void (d.audio!.volume = Number(e.target.value)))}
            />
          </div>
          <label className="check">
            <input type="checkbox" checked={synthOn} onChange={(e) => set({ synthOn: e.target.checked })} />
            <span>Hear the tab too</span>
          </label>
          <div className={'audio-cloud' + (busy === 'error' ? ' is-error' : '')}>
            <Icon name="cloud" size={13} />
            {busy === 'uploading' ? (
              <span>Uploading {mb(audio.size)}…</span>
            ) : busy === 'error' ? (
              <>
                <span>Upload failed</span>
                <button className="link-btn" onClick={retry}>
                  Retry
                </button>
              </>
            ) : audio.uploaded ? (
              <span>In your account{audio.size ? ` · ${mb(audio.size)}` : ''}</span>
            ) : audioSyncOn() && (audio.size ?? 0) <= MAX_SYNC ? (
              <span>Waiting to upload</span>
            ) : (
              <span>On this device only{(audio.size ?? 0) > MAX_SYNC ? ' (over 50 MB)' : user ? '' : ' · sign in to sync'}</span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
