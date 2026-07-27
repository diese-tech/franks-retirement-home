/**
 * API tests for GET /api/auth/discord/callback — the OAuth2 redirect handler.
 *
 * Strategy: @/lib/db is stubbed (discordAuth.js imports it at module scope,
 * unused by this flow) and global.fetch is mocked so the *real*
 * exchangeCode/getDiscordUser/getDiscordGuildMember/buildDiscordSessionCookie
 * functions run against fake Discord API responses — no real network calls
 * are made. This exercises the full route <-> lib integration, not just the
 * route in isolation.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Mock next/server ────────────────────────────────────────────────────────
vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((body, init) => ({ _body: body, _status: init?.status ?? 200, headers: new Map() })),
    redirect: vi.fn((url, status) => ({ _redirectUrl: String(url), _status: status ?? 302, headers: new Map() })),
  },
}));

// ─── Mock @/lib/db (imported by discordAuth.js at module scope) ─────────────
vi.mock('@/lib/db', () => ({ default: {} }));

const { GET } = await import('@/app/api/auth/discord/callback/route.js');

const ENV_KEYS = [
  'DISCORD_CLIENT_ID',
  'DISCORD_CLIENT_SECRET',
  'DISCORD_GUILD_ID',
  'DISCORD_SESSION_SECRET',
  'DISCORD_ADMIN_ROLE_ID',
  'NEXTAUTH_URL',
];

function setValidEnv() {
  process.env.DISCORD_CLIENT_ID = 'client-abc';
  process.env.DISCORD_CLIENT_SECRET = 'secret-abc';
  process.env.DISCORD_GUILD_ID = 'guild-1';
  process.env.DISCORD_SESSION_SECRET = 'a'.repeat(20);
  process.env.DISCORD_ADMIN_ROLE_ID = 'role-admin';
  process.env.NEXTAUTH_URL = 'https://frh.example.com';
}

function makeCallbackReq(url) {
  return { url };
}

const USER_BODY = { id: 'discord-user-1', username: 'Frank', discriminator: '0', avatar: null };
const MEMBER_BODY = { roles: ['role-player'], nick: null };

function mockFetchSequence({
  tokenOk = true, tokenStatus = 200,
  userOk = true, userStatus = 200,
  memberOk = true, memberStatus = 200,
  memberBody = MEMBER_BODY, userBody = USER_BODY,
} = {}) {
  global.fetch = vi.fn((url) => {
    const href = String(url);
    if (href.includes('/oauth2/token')) {
      return Promise.resolve({
        ok: tokenOk,
        status: tokenStatus,
        text: () => Promise.resolve('token error body'),
        json: () => Promise.resolve({ access_token: 'tok-abc', refresh_token: 'refresh-abc', expires_in: 604800 }),
      });
    }
    if (href.includes('/users/@me/guilds/')) {
      return Promise.resolve({
        ok: memberOk,
        status: memberStatus,
        json: () => Promise.resolve(memberBody),
      });
    }
    if (href.includes('/users/@me')) {
      return Promise.resolve({
        ok: userOk,
        status: userStatus,
        json: () => Promise.resolve(userBody),
      });
    }
    throw new Error(`Unexpected fetch url in test: ${href}`);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  for (const key of ENV_KEYS) delete process.env[key];
  mockFetchSequence();
});

afterEach(() => {
  for (const key of ENV_KEYS) delete process.env[key];
  delete global.fetch;
});

describe('GET /api/auth/discord/callback', () => {
  it('returns 503 when Discord env is not configured', async () => {
    setValidEnv();
    delete process.env.DISCORD_CLIENT_SECRET;
    const res = await GET(makeCallbackReq('http://localhost/api/auth/discord/callback?code=abc123'));
    expect(res._status).toBe(503);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns 400 when the code param is missing', async () => {
    setValidEnv();
    const res = await GET(makeCallbackReq('http://localhost/api/auth/discord/callback'));
    expect(res._status).toBe(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns 502 when the token exchange fails', async () => {
    setValidEnv();
    mockFetchSequence({ tokenOk: false, tokenStatus: 400 });
    const res = await GET(makeCallbackReq('http://localhost/api/auth/discord/callback?code=abc123'));
    expect(res._status).toBe(502);
    expect(res._body.error).toMatch(/authentication failed/i);
  });

  it('returns 502 when the user-info fetch fails', async () => {
    setValidEnv();
    mockFetchSequence({ userOk: false, userStatus: 401 });
    const res = await GET(makeCallbackReq('http://localhost/api/auth/discord/callback?code=abc123'));
    expect(res._status).toBe(502);
  });

  it('returns 502 when the guild-member fetch fails with an unexpected status', async () => {
    setValidEnv();
    mockFetchSequence({ memberOk: false, memberStatus: 500 });
    const res = await GET(makeCallbackReq('http://localhost/api/auth/discord/callback?code=abc123'));
    expect(res._status).toBe(502);
  });

  it('returns 403 when the user is not a member of the guild (404 from Discord)', async () => {
    setValidEnv();
    mockFetchSequence({ memberOk: false, memberStatus: 404 });
    const res = await GET(makeCallbackReq('http://localhost/api/auth/discord/callback?code=abc123'));
    expect(res._status).toBe(403);
    expect(res._body.error).toMatch(/member of the FRH Discord server/i);
  });

  it('sets the signed session cookie and redirects to a same-origin returnUrl (state)', async () => {
    setValidEnv();
    const res = await GET(makeCallbackReq(
      'http://localhost/api/auth/discord/callback?code=abc123&state=%2Flineup%3Ffoo%3Dbar',
    ));
    expect(res._status).toBe(302);
    expect(res._redirectUrl).toBe('https://frh.example.com/lineup?foo=bar');

    const setCookie = res.headers.get('Set-Cookie');
    expect(setCookie).toMatch(/^frh_discord_session=/);
    expect(setCookie).toMatch(/HttpOnly/);

    // Cookie payload should be a signed, base64url-encoded JSON blob carrying
    // the Discord identity and roles fetched above.
    const cookieValue = setCookie.split(';')[0].split('=')[1];
    const [encodedPayload] = cookieValue.split('.');
    const payload = JSON.parse(Buffer.from(encodedPayload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
    expect(payload.discordId).toBe('discord-user-1');
    expect(payload.username).toBe('Frank');
    expect(payload.roles).toEqual(['role-player']);
  });

  it('redirects to / when no state (returnUrl) is provided', async () => {
    setValidEnv();
    const res = await GET(makeCallbackReq('http://localhost/api/auth/discord/callback?code=abc123'));
    expect(res._status).toBe(302);
    expect(res._redirectUrl).toBe('https://frh.example.com/');
  });

  it('falls back to / for a cross-origin state (open-redirect protection)', async () => {
    setValidEnv();
    const res = await GET(makeCallbackReq(
      `http://localhost/api/auth/discord/callback?code=abc123&state=${encodeURIComponent('https://evil.example.com/phish')}`,
    ));
    expect(res._status).toBe(302);
    expect(res._redirectUrl).toBe('https://frh.example.com/');
  });
});
