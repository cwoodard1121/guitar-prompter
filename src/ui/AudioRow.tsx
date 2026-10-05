import { useEffect, useState } from 'react';
import { useStore } from '../state/store';
import { deleteAudio, putAudio } from '../storage/audioStore';
import { loadTrack, trackElement, unloadTrack } from '../audio/track';
import { Icon } from './Icon';

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
  const [missing, setMissing] = useState(false);
  const [finding, setFinding] = useState(false);
  const audio = song.audio;

  useEffect(() => {
    if (!audio) return setMissing(false);
    void loadTrack(song.id).then((ok) => setMissing(!ok));
  }, [song.id, audio]);

  async function add() {
    const file = await pickAudio();
    if (!file) return;
    await putAudio(song.id, file);
    unloadTrack();
    edit((d) => void (d.audio = { name: file.name, offset: d.audio?.offset ?? 0, volume: d.audio?.volume ?? 0.9 }));
    await loadTrack(song.id);
    setMissing(false);
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
            edit((d) => void delete d.audio);
          }}
        >
          <Icon name="trash" size={13} />
        </button>
      </div>
      {missing ? (
        <button className="btn btn-small" onClick={add}>
          File not on this device: add it again
        </button>
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
        </>
      )}
    </div>
  );
}
