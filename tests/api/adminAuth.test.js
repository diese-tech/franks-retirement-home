/**
 * API tests for /api/admin-auth — password-gate session issuance.
 * Covers: GET (session probe), POST (login + rate limit), DELETE (logout).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { makeReq, unwrap } from './_helpers.js';

// ─── Mock next/server ────────────────────────────────────────────────────────
// This route sets a Set-Cookie header on the response object returned by
// NextResponse.json, so the mock needs a stubbed `headers.set` too.
vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((body, init) => ({
      _body: body,
      _status: init?.status ?? 200,
      headers: { set: vi.fn() },
    })),
  },
}));

// ─── Mock @/lib/adminSession ──────────────────────────────────────────────────
vi.mock('@/lib/adminSession', () => ({
  buildClearSessionCookie: vi.fn(() => 'frh_admin_session=; Max-Age=0'),
  buildSessionCookie: vi.fn(() => 'frh_admin_session=token; Max-Age=1'),
  createSessionToken: vi.fn(() => 'new-session-token'),
  readSessionCookie: vi.fn(),
  verifySessionToken: vi.fn(),
}));

// ─── Mock @/lib/rateLimit ────────────────────────────────────────────────────
vi.mock('@/lib/rateLimit', () => ({
  clientIp: vi.fn(() => '1.2.3.4'),
  checkRateLimit: vi.fn(),
}));

const {
  readSessionCookie,
  verifySessionToken,
  createSessionToken,
  buildSessionCookie,
  buildClearSessionCookie,
} = await import('@/lib/adminSession');
const { checkRateLimit } = await import('@/lib/rateLimit');
const { GET, POST, DELETE } = await import('@/app/api/admin-auth/route.js');

const FAKE_REQUEST = {};

describe('GET /api/admin-auth', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when there is no valid session cookie', async () => {
    readSessionCookie.mockReturnValue(null);
    verifySessionToken.mockReturnValue({ valid: false });
    const res = await GET(FAKE_REQUEST);
    expect(unwrap(res).status).toBe(401);
    expect(unwrap(res).body.error).toMatch(/authentication required/i);
  });

  it('returns { ok: true } when the session cookie is valid', async () => {
    readSessionCookie.mockReturnValue('some-token');
    verifySessionToken.mockReturnValue({ valid: true, issuedAt: Date.now() });
    const res = await GET(FAKE_REQUEST);
    expect(unwrap(res).status).toBe(200);
    expect(unwrap(res).body).toEqual({ ok: true });
  });
});

describe('POST /api/admin-auth', () => {
  const ORIGINAL_PASSWORD = process.env.ADMIN_PASSWORD;

  beforeEach(() => {
    vi.clearAllMocks();
    checkRateLimit.mockResolvedValue({ allowed: true, remaining: 9 });
    process.env.ADMIN_PASSWORD = 'correct-horse-battery-staple';
  });

  afterEach(() => {
    if (ORIGINAL_PASSWORD === undefined) delete process.env.ADMIN_PASSWORD;
    else process.env.ADMIN_PASSWORD = ORIGINAL_PASSWORD;
  });

  it('rate-limits brute-force attempts with 429 before checking the password', async () => {
    checkRateLimit.mockResolvedValue({ allowed: false, remaining: 0 });
    const res = await POST(makeReq({ password: 'anything' }));
    expect(unwrap(res).status).toBe(429);
    expect(checkRateLimit).toHaveBeenCalledWith('admin-auth:1.2.3.4', 10, 300);
  });

  it('returns 400 when password is missing from the body', async () => {
    const res = await POST(makeReq({}));
    expect(unwrap(res).status).toBe(400);
  });

  it('returns 500 when ADMIN_PASSWORD is not configured on the server', async () => {
    delete process.env.ADMIN_PASSWORD;
    const res = await POST(makeReq({ password: 'whatever' }));
    expect(unwrap(res).status).toBe(500);
  });

  it('returns 401 for an incorrect password', async () => {
    const res = await POST(makeReq({ password: 'wrong' }));
    expect(unwrap(res).status).toBe(401);
  });

  it('mints a session token and sets the cookie on a correct password', async () => {
    createSessionToken.mockReturnValue('minted-token');
    buildSessionCookie.mockReturnValue('frh_admin_session=minted-token; HttpOnly');
    const res = await POST(makeReq({ password: 'correct-horse-battery-staple' }));
    expect(unwrap(res).status).toBe(200);
    expect(unwrap(res).body).toEqual({ ok: true });
    expect(createSessionToken).toHaveBeenCalled();
    expect(res.headers.set).toHaveBeenCalledWith('Set-Cookie', 'frh_admin_session=minted-token; HttpOnly');
  });
});

describe('DELETE /api/admin-auth', () => {
  beforeEach(() => vi.clearAllMocks());

  it('clears the session cookie and returns ok', async () => {
    buildClearSessionCookie.mockReturnValue('frh_admin_session=; Max-Age=0');
    const res = await DELETE();
    expect(unwrap(res).status).toBe(200);
    expect(unwrap(res).body).toEqual({ ok: true });
    expect(res.headers.set).toHaveBeenCalledWith('Set-Cookie', 'frh_admin_session=; Max-Age=0');
  });
});
