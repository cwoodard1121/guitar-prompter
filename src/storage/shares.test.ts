import { describe, expect, it } from 'vitest';
import { newToken } from './shares';

describe('share tokens', () => {
  it('are 22 URL-safe characters (the database check)', () => {
    for (let i = 0; i < 50; i++) expect(newToken()).toMatch(/^[A-Za-z0-9_-]{22}$/);
  });
  it('encode the random bytes as base64url', () => {
    expect(newToken(new Uint8Array(16).fill(255))).toBe('_____________________w');
  });
  it("don't repeat", () => {
    expect(new Set(Array.from({ length: 200 }, () => newToken())).size).toBe(200);
  });
});
