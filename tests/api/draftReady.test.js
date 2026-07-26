/**
 * API tests for POST /api/drafts/[id]/ready
 * Includes a dedicated test for the two-captain auto-transition race-condition
 * guard: the updateMany WHERE clause requires both ready flags true, so that
 * when two simultaneous ready-ups both observe "both ready", only one of them
 * actually flips the draft to 'banning' (updateMany's WHERE re-check makes the
 * second call a no-op).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeReq, makeInvalidJsonReq, unwrap } from './_helpers.js';

// ─── Mock next/server ────────────────────────────────────────────────────────
vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((body, init) => ({ _body: body, _status: init?.status ?? 200 })),
  },
}));

// ─── Mock @/lib/db ───────────────────────────────────────────────────────────
vi.mock('@/lib/db', () => {
  const prisma = {
    draft: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  };
  return { default: prisma };
});

// ─── Mock @/lib/resolveAuth ──────────────────────────────────────────────────
vi.mock('@/lib/resolveAuth', () => ({
  resolveDraftCaptainAuth: vi.fn(),
}));

// ─── Mock @/lib/discordAuth ──────────────────────────────────────────────────
vi.mock('@/lib/discordAuth', () => ({
  getDiscordSessionUser: vi.fn(() => null),
}));

// ─── Mock @/lib/rateLimit ────────────────────────────────────────────────────
vi.mock('@/lib/rateLimit', () => ({
  checkRateLimit: vi.fn(),
  hashIdentity: vi.fn((v) => `hashed:${v}`),
}));

function reqWithHeaders(body) {
  return {
    json: () => Promise.resolve(body),
    headers: { get: () => null },
  };
}

const { default: prisma } = await import('@/lib/db');
const { resolveDraftCaptainAuth } = await import('@/lib/resolveAuth');
const { checkRateLimit } = await import('@/lib/rateLimit');
const { POST } = await import('@/app/api/drafts/[id]/ready/route.js');

const DRAFT_ID = 'draft-ready-1';
const PARAMS = { params: Promise.resolve({ id: DRAFT_ID }) };
const MOCK_DRAFT = {
  id: DRAFT_ID,
  status: 'lobby',
  captainAReady: false,
  captainBReady: false,
  adminKey: 'admin-key',
  captainAKey: 'cap-a-key',
  captainBKey: 'cap-b-key',
};

beforeEach(() => {
  vi.clearAllMocks();
  prisma.draft.findUnique.mockResolvedValue({ ...MOCK_DRAFT });
  checkRateLimit.mockResolvedValue({ allowed: true });
});

describe('POST /api/drafts/[id]/ready', () => {
  it('returns 400 for invalid JSON', async () => {
    const req = { json: () => { throw new SyntaxError('bad'); }, headers: { get: () => null } };
    const res = await POST(req, PARAMS);
    expect(unwrap(res).status).toBe(400);
  });

  it('returns 404 when draft does not exist', async () => {
    prisma.draft.findUnique.mockResolvedValue(null);
    resolveDraftCaptainAuth.mockResolvedValue({ role: 'captainA', source: 'key' });
    const res = await POST(reqWithHeaders({ key: 'cap-a-key' }), PARAMS);
    expect(unwrap(res).status).toBe(404);
  });

  it('returns 403 for a spectator (not a captain)', async () => {
    resolveDraftCaptainAuth.mockResolvedValue({ role: 'spectator', source: 'key' });
    const res = await POST(reqWithHeaders({ key: 'bad-key' }), PARAMS);
    expect(unwrap(res).status).toBe(403);
  });

  it('returns 403 for admin (only captains can ready up)', async () => {
    resolveDraftCaptainAuth.mockResolvedValue({ role: 'admin', source: 'key' });
    const res = await POST(reqWithHeaders({ key: 'admin-key' }), PARAMS);
    expect(unwrap(res).status).toBe(403);
  });

  it('returns 429 when rate limited', async () => {
    resolveDraftCaptainAuth.mockResolvedValue({ role: 'captainA', source: 'key' });
    checkRateLimit.mockResolvedValue({ allowed: false });
    const res = await POST(reqWithHeaders({ key: 'cap-a-key' }), PARAMS);
    expect(unwrap(res).status).toBe(429);
  });

  it('returns 400 when the draft is not in lobby phase', async () => {
    resolveDraftCaptainAuth.mockResolvedValue({ role: 'captainA', source: 'key' });
    prisma.draft.findUnique.mockResolvedValue({ ...MOCK_DRAFT, status: 'banning' });
    const res = await POST(reqWithHeaders({ key: 'cap-a-key' }), PARAMS);
    expect(unwrap(res).status).toBe(400);
    expect(unwrap(res).body.error).toMatch(/lobby phase/i);
  });

  it('marks captainA ready and does not transition when captainB is not yet ready', async () => {
    resolveDraftCaptainAuth.mockResolvedValue({ role: 'captainA', source: 'key' });
    prisma.draft.update.mockResolvedValue({ ...MOCK_DRAFT, captainAReady: true, captainBReady: false });
    const res = await POST(reqWithHeaders({ key: 'cap-a-key' }), PARAMS);
    expect(unwrap(res).status).toBe(200);
    expect(unwrap(res).body.ok).toBe(true);
    expect(prisma.draft.updateMany).not.toHaveBeenCalled();
  });

  it('transitions to banning when both captains are ready', async () => {
    resolveDraftCaptainAuth.mockResolvedValue({ role: 'captainB', source: 'key' });
    prisma.draft.update.mockResolvedValue({ ...MOCK_DRAFT, captainAReady: true, captainBReady: true });
    prisma.draft.updateMany.mockResolvedValue({ count: 1 });
    const res = await POST(reqWithHeaders({ key: 'cap-b-key' }), PARAMS);
    expect(unwrap(res).status).toBe(200);
    expect(prisma.draft.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: DRAFT_ID,
          captainAReady: true,
          captainBReady: true,
          status: 'lobby',
        }),
        data: expect.objectContaining({ status: 'banning' }),
      })
    );
  });

  it('race guard: the loser of a simultaneous double ready-up gets a no-op updateMany (count 0) but still 200s', async () => {
    // Simulates two near-simultaneous requests both observing captainAReady &&
    // captainBReady === true after their own update. The WHERE clause on
    // updateMany requires status still 'lobby' + both flags true, so the
    // second writer to actually hit the DB finds status already flipped to
    // 'banning' and updateMany matches 0 rows. The route does not treat that
    // as an error — it's a benign, expected race outcome.
    resolveDraftCaptainAuth.mockResolvedValue({ role: 'captainA', source: 'key' });
    prisma.draft.update.mockResolvedValue({ ...MOCK_DRAFT, captainAReady: true, captainBReady: true });
    prisma.draft.updateMany.mockResolvedValue({ count: 0 }); // lost the race — no-op
    const res = await POST(reqWithHeaders({ key: 'cap-a-key' }), PARAMS);
    expect(unwrap(res).status).toBe(200);
    expect(unwrap(res).body.ok).toBe(true);
    expect(prisma.draft.updateMany).toHaveBeenCalledTimes(1);
  });

  it('returns 500 on unexpected error', async () => {
    resolveDraftCaptainAuth.mockResolvedValue({ role: 'captainA', source: 'key' });
    prisma.draft.update.mockRejectedValue(new Error('db down'));
    const res = await POST(reqWithHeaders({ key: 'cap-a-key' }), PARAMS);
    expect(unwrap(res).status).toBe(500);
  });
});
