/**
 * API tests for POST /api/auth/discord/logout — clears the Discord session cookie.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Mock next/server ────────────────────────────────────────────────────────
vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((body, init) => ({ _body: body, _status: init?.status ?? 200, headers: new Map() })),
  },
}));

// ─── Mock @/lib/db (imported by discordAuth.js at module scope) ─────────────
vi.mock('@/lib/db', () => ({ default: {} }));

const { POST } = await import('@/app/api/auth/discord/logout/route.js');

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.NEXTAUTH_URL;
});

afterEach(() => {
  delete process.env.NEXTAUTH_URL;
});

describe('POST /api/auth/discord/logout', () => {
  it('returns ok:true with a 200 status', async () => {
    const res = await POST();
    expect(res._status).toBe(200);
    expect(res._body).toEqual({ ok: true });
  });

  it('clears the session cookie (name, empty value, Max-Age=0)', async () => {
    const res = await POST();
    const setCookie = res.headers.get('Set-Cookie');
    expect(setCookie).toMatch(/^frh_discord_session=;/);
    expect(setCookie).toMatch(/Max-Age=0/);
    expect(setCookie).toMatch(/HttpOnly/);
    expect(setCookie).toMatch(/SameSite=Lax/);
  });

  it('appends Secure when NEXTAUTH_URL is https', async () => {
    process.env.NEXTAUTH_URL = 'https://frh.example.com';
    const res = await POST();
    expect(res.headers.get('Set-Cookie')).toMatch(/Secure/);
  });

  it('omits Secure when NEXTAUTH_URL is not set (local dev over http)', async () => {
    const res = await POST();
    expect(res.headers.get('Set-Cookie')).not.toMatch(/Secure/);
  });
});
