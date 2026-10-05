import { useEffect, useState } from 'react';
import { useStore } from '../state/store';
import { getAudio } from '../storage/audioStore';
import { analyzeRecording } from '../audio/analyze';
import type { TempoResult } from '../audio/tempo';
import { toast } from './Toaster';

const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(2).padStart(5, '0')}`;
/** Recordings whose suggestion was used or dismissed this session. */
const done = new Set<string>();

/** "Sounds like 96 bpm": listens to the recording once and offers tempo and bar 1. */
export function TempoSuggest() {
  const song = useStore((s) => s.song);
  const { edit } = useStore.getState();
  const beats = song.timeSig[0];
  const key = `${song.id}:${song.audio?.rev ?? ''}`;
  const [phase, setPhase] = useState<'idle' | 'busy' | 'done' | 'fail'>('idle');
  const [res, setRes] = useState<TempoResult | null>(null);
  const [open, setOpen] = useState(!done.has(key));

  async function run() {
    setPhase('busy');
    setOpen(true);
    try {
      const a = await getAudio(song.id);
      if (!a) throw new Error('no audio');
      const r = await analyzeRecording(key, a.blob, beats);
      setRes(r);
      setPhase('done');
    } catch {
      setPhase('fail');
    }
  }

  // listen once, automatically, for a recording we haven't looked at yet
  useEffect(() => {
    setRes(null);
    setPhase('idle');
    setOpen(!done.has(key));
    if (!done.has(key)) void run();
  }, [key, beats]);

  const close = () => (done.add(key), setOpen(false));
  const useTempo = (bpm: number) => {
    const was = useStore.getState().song.tempo;
    edit((d) => void (d.tempo = Math.round(bpm)));
    toast(`Tempo ${was} → ${Math.round(bpm)} bpm`);
  };
  const useBarOne = (t: number) => edit((d) => void (d.audio && (d.audio.offset = Math.round(t * 100) / 100)));

  if (!open || phase === 'idle') {
    return (
      <button className="btn btn-small" onClick={run}>
        Detect tempo
      </button>
    );
  }
  if (phase === 'busy') {
    return (
      <div className="tempo-card" aria-live="polite">
        <p>
          <span className="spinner" aria-hidden="true" /> Listening for the beat…
        </p>
      </div>
    );
  }
  if (phase === 'fail' || !res || res.confidence < 0.25) {
    return (
      <div className="tempo-card" aria-live="polite">
        <p>{phase === 'fail' ? "Couldn't read the recording." : "Couldn't find a steady beat. Tap the tempo instead (Practice menu)."}</p>
        <button className="link-btn" onClick={close}>
          OK
        </button>
      </div>
    );
  }

  const bpm = Math.round(res.bpm);
  const tempoSet = song.tempo === bpm;
  const barSet = Math.abs((song.audio?.offset ?? 0) - res.barOne) < 0.02;
  return (
    <div className="tempo-card" aria-live="polite">
      <div className="tempo-line">
        <span>
          Sounds like <strong>{bpm} bpm</strong>
        </span>
        {tempoSet ? (
          <span className="tempo-ok">Set</span>
        ) : (
          <button className="btn btn-small btn-primary" onClick={() => useTempo(res.bpm)}>
            Use it
          </button>
        )}
      </div>
      {res.alternatives.length > 0 && (
        <div className="tempo-line tempo-alt">
          <span>Or</span>
          {res.alternatives.map((b) => (
            <button key={b} className={'chip' + (song.tempo === Math.round(b) ? ' on' : '')} onClick={() => useTempo(b)} title={b < res.bpm ? 'Half time' : 'Double time'}>
              {Math.round(b)}
            </button>
          ))}
        </div>
      )}
      <div className="tempo-line">
        <span>
          Bar 1 at <strong>{fmt(res.barOne)}</strong>
        </span>
        {barSet ? (
          <span className="tempo-ok">Set</span>
        ) : (
          <button className="btn btn-small" onClick={() => useBarOne(res.barOne)}>
            Use it
          </button>
        )}
      </div>
      <button className="link-btn tempo-close" onClick={close}>
        {tempoSet && barSet ? 'Done' : 'Dismiss'}
      </button>
    </div>
  );
}
