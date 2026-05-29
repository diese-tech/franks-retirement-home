import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHmac } from 'node:crypto';

vi.mock('@/lib/db', () => ({ default: {} }));

const { buildDiscordSessionCookie, getDiscordSessionFromRaw } = await import('@/lib/discordAuth');

const SECRET = 'test-secret-at-least-16-chars!!';

function base64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function makeRaw({ discordId = 'u1', username = 'TestUser', roles = [], exp = Date.now() + 60_000 } = {}) {
  const payload = JSON.stringify({ discordId, username, roles, exp });
  const encoded = base64url(Buffer.from(payload, 'utf8'));
  const sig = base64url(createHmac('sha256', SECRET).update(encoded).digest());
  return `${encoded}.${sig}`;
}

describe('getDiscordSessionFromRaw', () => {
  beforeEach(() => {
    process.env.DISCORD_SESSION_SECRET = SECRET;
  });
  afterEach(() => {
    delete process.env.DISCORD_SESSION_SECRET;
  });

  it('returns session payload for a valid signed cookie', () => {
    const raw = makeRaw({ discordId: 'abc123', username: 'Player1', roles: ['role-a'] });
    const result = getDiscordSessionFromRaw(raw);
    expect(result).toEqual({ discordId: 'abc123', username: 'Player1', roles: ['role-a'] });
  });

  it('returns null for null input', () => {
    expect(getDiscordSessionFromRaw(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(getDiscordSessionFromRaw(undefined)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(getDiscordSessionFromRaw('')).toBeNull();
  });

  it('returns null when signature is tampered', () => {
    const raw = makeRaw();
    const tampered = raw.slice(0, -4) + 'XXXX';
    expect(getDiscordSessionFromRaw(tampered)).toBeNull();
  });

  it('returns null for an expired session', () => {
    const raw = makeRaw({ exp: Date.now() - 1000 });
    expect(getDiscordSessionFromRaw(raw)).toBeNull();
  });

  it('returns null for malformed base64 payload', () => {
    expect(getDiscordSessionFromRaw('!!!.invalidsig')).toBeNull();
  });

  it('returns null when no dot separator is present', () => {
    expect(getDiscordSessionFromRaw('nodothere')).toBeNull();
  });

  it('returns null when payload is missing required fields', () => {
    const payload = JSON.stringify({ exp: Date.now() + 60_000 }); // missing discordId etc.
    const encoded = base64url(Buffer.from(payload, 'utf8'));
    const sig = base64url(createHmac('sha256', SECRET).update(encoded).digest());
    expect(getDiscordSessionFromRaw(`${encoded}.${sig}`)).toBeNull();
  });

  it('returns null when signed with a different secret', () => {
    const payload = JSON.stringify({ discordId: 'u1', username: 'U', roles: [], exp: Date.now() + 60_000 });
    const encoded = base64url(Buffer.from(payload, 'utf8'));
    const wrongSig = base64url(createHmac('sha256', 'different-secret-key!!').update(encoded).digest());
    expect(getDiscordSessionFromRaw(`${encoded}.${wrongSig}`)).toBeNull();
  });

  it('buildDiscordSessionCookie output is accepted by getDiscordSessionFromRaw', () => {
    const raw = buildDiscordSessionCookie({ discordId: 'd1', username: 'Bob', roles: ['r1', 'r2'] });
    const result = getDiscordSessionFromRaw(raw);
    expect(result).not.toBeNull();
    expect(result.discordId).toBe('d1');
    expect(result.username).toBe('Bob');
    expect(result.roles).toEqual(['r1', 'r2']);
  });
});
