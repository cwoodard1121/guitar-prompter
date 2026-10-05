import type { TempoResult } from './tempo';

const cache = new Map<string, Promise<TempoResult | null>>();

/** Decodes a recording to mono samples (44.1 kHz). */
async function decode(blob: Blob): Promise<{ samples: Float32Array; sampleRate: number }> {
  const ctx = new OfflineAudioContext(1, 1, 44100);
  const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
  const samples = new Float32Array(buf.length);
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const ch = buf.getChannelData(c);
    for (let i = 0; i < ch.length; i++) samples[i] += ch[i] / buf.numberOfChannels;
  }
  return { samples, sampleRate: buf.sampleRate };
}

/** Tempo + bar 1 for a recording, analysed in a worker; cached per file revision. */
export function analyzeRecording(key: string, blob: Blob, beatsPerBar: number): Promise<TempoResult | null> {
  const k = `${key}:${beatsPerBar}`;
  let p = cache.get(k);
  if (!p) {
    p = decode(blob).then(
      ({ samples, sampleRate }) =>
        new Promise<TempoResult | null>((resolve, reject) => {
          const w = new Worker(new URL('./tempo.worker.ts', import.meta.url), { type: 'module' });
          w.onmessage = (e) => {
            w.terminate();
            if (e.data.ok) resolve(e.data.result);
            else reject(new Error(e.data.error));
          };
          w.onerror = (e) => (w.terminate(), reject(new Error(e.message)));
          w.postMessage({ samples, sampleRate, beatsPerBar }, [samples.buffer]);
        }),
    );
    p.catch(() => cache.delete(k));
    cache.set(k, p);
  }
  return p;
}
