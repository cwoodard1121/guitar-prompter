import { describe, expect, it } from 'vitest';
import { audioPath, audioType, planAudio } from './audioPlan';

const track = (o: object = {}) => ({ name: 'a.mp3', offset: 0, volume: 1, rev: 'r1', ...o });

describe('planAudio', () => {
  it('plays a matching local file and uploads it once signed in', () => {
    expect(planAudio(track(), 'r1', false)).toEqual({ play: 'ready', upload: false });
    expect(planAudio(track(), 'r1', true)).toEqual({ play: 'ready', upload: true });
    expect(planAudio(track({ uploaded: true }), 'r1', true)).toEqual({ play: 'ready', upload: false });
  });

  it('downloads when the file is only in the account', () => {
    expect(planAudio(track({ uploaded: true }), null, true).play).toBe('download');
    expect(planAudio(track({ uploaded: true }), null, false).play).toBe('signin');
  });

  it('refetches a stale copy after the recording was replaced elsewhere', () => {
    expect(planAudio(track({ rev: 'r2', uploaded: true }), 'r1', true)).toEqual({ play: 'download', upload: false });
  });

  it('a file never uploaded from the other device is missing here', () => {
    expect(planAudio(track(), null, true)).toEqual({ play: 'missing', upload: false });
  });

  it('files saved before revisions still count as current', () => {
    expect(planAudio(track({ rev: undefined }), undefined, true)).toEqual({ play: 'ready', upload: true });
  });

  it('builds owner-first paths and audio content types', () => {
    expect(audioPath('u1', 's1')).toBe('u1/s1');
    expect(audioType('Song.MP3', '')).toBe('audio/mpeg');
    expect(audioType('x.flac', 'application/octet-stream')).toBe('audio/flac');
    expect(audioType('x.wav', 'audio/x-wav')).toBe('audio/x-wav');
  });
});
