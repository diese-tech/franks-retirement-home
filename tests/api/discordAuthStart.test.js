/**
 * API tests for GET /api/auth/discord — kicks off the Discord OAuth2 flow.
 *
 * Strategy: only @/lib/db is mocked (discordAuth.js imports it at module
 * scope but this route never touches it). validateDiscordEnv/getDiscordAuthUrl
 * run for real against stubbed env vars, so the assembled authorize URL is
 * checked end to end — no network calls are made by this route at all.
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

const { GET } = await import('@/app/api/auth/discord/route.js');

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

function makeGetReq(url) {
  return { url };
}

beforeEach(() => {
  vi.clearAllMocks();
  for (const key of ENV_KEYS) delete process.env[key];
});

afterEach(() => {
  for (const key of ENV_KEYS) delete process.env[key];
});

describe('GET /api/auth/discord', () => {
  it('returns 503 with missing vars when Discord env is not configured', async () => {
    setValidEnv();
    delete process.env.DISCORD_GUILD_ID;
    const res = await GET(makeGetReq('http://localhost/api/auth/discord'));
    expect(res._status).toBe(503);
    expect(res._body.error).toMatch(/not configured/i);
    expect(res._body.missing).toContain('DISCORD_GUILD_ID');
  });

  it('redirects to the Discord authorize URL with expected params and no state', async () => {
    setValidEnv();
    const res = await GET(makeGetReq('http://localhost/api/auth/discord'));
    expect(res._status).toBe(302);
    const url = new URL(res._redirectUrl);
    expect(url.origin + url.pathname).toBe('https://discord.com/api/oauth2/authorize');
    expect(url.searchParams.get('client_id')).toBe('client-abc');
    expect(url.searchParams.get('redirect_uri')).toBe('https://frh.example.com/api/auth/discord/callback');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('scope')).toBe('identify guilds.members.read');
    expect(url.searchParams.has('state')).toBe(false);
  });

  it('forwards a same-origin returnUrl as the state param', async () => {
    setValidEnv();
    const res = await GET(makeGetReq('http://localhost/api/auth/discord?returnUrl=%2Flineup%3Ffoo%3Dbar'));
    const url = new URL(res._redirectUrl);
    expect(url.searchParams.get('state')).toBe('/lineup?foo=bar');
  });

  it('drops a cross-origin returnUrl (no state param) to prevent an open redirect', async () => {
    setValidEnv();
    const res = await GET(makeGetReq('http://localhost/api/auth/discord?returnUrl=https%3A%2F%2Fevil.example.com%2Fphish'));
    const url = new URL(res._redirectUrl);
    expect(url.searchParams.has('state')).toBe(false);
  });

  it('drops a malformed returnUrl (no state param) instead of crashing', async () => {
    setValidEnv();
    const res = await GET(makeGetReq(`http://localhost/api/auth/discord?returnUrl=${encodeURIComponent('http://[invalid')}`));
    expect(res._status).toBe(302);
    const url = new URL(res._redirectUrl);
    expect(url.searchParams.has('state')).toBe(false);
  });
});
