/**
 * API tests for GET/POST /api/player-drafts
 * GET is public (season/division filterable, strips adminKey).
 * POST creates a new player draft (admin only).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeInvalidJsonReq, unwrap } from './_helpers.js';

// ─── Mock next/server ────────────────────────────────────────────────────────
vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((body, init) => ({ _body: body, _status: init?.status ?? 200 })),
  },
}));

// ─── Mock @/lib/db ───────────────────────────────────────────────────────────
vi.mock('@/lib/db', () => {
  const prisma = {
    playerDraft: { findMany: vi.fn(), create: vi.fn() },
  };
  return { default: prisma };
});

// ─── Mock @/lib/resolveAuth ──────────────────────────────────────────────────
vi.mock('@/lib/resolveAuth', () => ({
  resolveAdminAuth: vi.fn(),
}));

const { default: prisma } = await import('@/lib/db');
const { resolveAdminAuth } = await import('@/lib/resolveAuth');
const { GET, POST } = await import('@/app/api/player-drafts/route.js');

function makeUrlReq(body, url) {
  return { json: () => Promise.resolve(body), url };
}

beforeEach(() => {
  vi.clearAllMocks();
  resolveAdminAuth.mockResolvedValue(null); // authorized
});

// ─── GET ─────────────────────────────────────────────────────────────────────
describe('GET /api/player-drafts', () => {
  it('does not require admin auth', async () => {
    prisma.playerDraft.findMany.mockResolvedValue([]);
    await GET(makeUrlReq(null, 'http://x/api/player-drafts'));
    expect(resolveAdminAuth).not.toHaveBeenCalled();
  });

  it('strips adminKey from each returned draft', async () => {
    prisma.playerDraft.findMany.mockResolvedValue([
      { id: 'pd-1', adminKey: 'super-secret', name: 'Draft 1' },
    ]);
    const res = await GET(makeUrlReq(null, 'http://x/api/player-drafts'));
    expect(unwrap(res).status).toBe(200);
    expect(unwrap(res).body[0].adminKey).toBeUndefined();
    expect(unwrap(res).body[0].id).toBe('pd-1');
  });

  it('filters by seasonId and divisionId when provided', async () => {
    prisma.playerDraft.findMany.mockResolvedValue([]);
    await GET(makeUrlReq(null, 'http://x/api/player-drafts?seasonId=s1&divisionId=div1'));
    expect(prisma.playerDraft.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { seasonId: 's1', divisionId: 'div1' } })
    );
  });

  it('returns 500 on DB error', async () => {
    prisma.playerDraft.findMany.mockRejectedValue(new Error('db down'));
    const res = await GET(makeUrlReq(null, 'http://x/api/player-drafts'));
    expect(unwrap(res).status).toBe(500);
  });
});

// ─── POST ────────────────────────────────────────────────────────────────────
describe('POST /api/player-drafts', () => {
  it('returns the admin guard response when not authorized', async () => {
    const guard = { _body: { error: 'Admin authentication required' }, _status: 401 };
    resolveAdminAuth.mockResolvedValue(guard);
    const res = await POST(makeUrlReq({}, 'http://x/api/player-drafts'));
    expect(res).toBe(guard);
  });

  it('returns 400 for invalid JSON', async () => {
    const req = { json: () => { throw new SyntaxError('bad'); }, url: 'http://x/api/player-drafts' };
    const res = await POST(req);
    expect(unwrap(res).status).toBe(400);
  });

  it('returns 400 when seasonId or divisionId is missing', async () => {
    const res = await POST(makeUrlReq({ seasonId: 's1' }, 'http://x/api/player-drafts'));
    expect(unwrap(res).status).toBe(400);
  });

  it('creates a draft with defaults for rounds and pickTimerSeconds', async () => {
    const created = { id: 'pd-new', seasonId: 's1', divisionId: 'div1', rounds: 5, pickTimerSeconds: 120 };
    prisma.playerDraft.create.mockResolvedValue(created);
    const res = await POST(makeUrlReq({ seasonId: 's1', divisionId: 'div1' }, 'http://x/api/player-drafts'));
    expect(unwrap(res).status).toBe(201);
    expect(unwrap(res).body).toEqual(created);
    const callArg = prisma.playerDraft.create.mock.calls[0][0];
    expect(callArg.data.rounds).toBe(5);
    expect(callArg.data.pickTimerSeconds).toBe(120);
    expect(callArg.data.adminKey).toBeTruthy();
  });

  it('respects provided rounds and pickTimerSeconds', async () => {
    prisma.playerDraft.create.mockResolvedValue({});
    await POST(makeUrlReq({ seasonId: 's1', divisionId: 'div1', rounds: '3', pickTimerSeconds: '60' }), 'http://x/api/player-drafts');
    const callArg = prisma.playerDraft.create.mock.calls[0][0];
    expect(callArg.data.rounds).toBe(3);
    expect(callArg.data.pickTimerSeconds).toBe(60);
  });

  it('returns 409 when a draft already exists for this season+division (P2002)', async () => {
    const err = Object.assign(new Error('unique'), { code: 'P2002' });
    prisma.playerDraft.create.mockRejectedValue(err);
    const res = await POST(makeUrlReq({ seasonId: 's1', divisionId: 'div1' }, 'http://x/api/player-drafts'));
    expect(unwrap(res).status).toBe(409);
  });

  it('returns 400 for an invalid seasonId/divisionId (P2003)', async () => {
    const err = Object.assign(new Error('fk'), { code: 'P2003' });
    prisma.playerDraft.create.mockRejectedValue(err);
    const res = await POST(makeUrlReq({ seasonId: 'bad', divisionId: 'bad' }, 'http://x/api/player-drafts'));
    expect(unwrap(res).status).toBe(400);
  });

  it('returns 500 on other create errors', async () => {
    prisma.playerDraft.create.mockRejectedValue(new Error('boom'));
    const res = await POST(makeUrlReq({ seasonId: 's1', divisionId: 'div1' }, 'http://x/api/player-drafts'));
    expect(unwrap(res).status).toBe(500);
  });
});
