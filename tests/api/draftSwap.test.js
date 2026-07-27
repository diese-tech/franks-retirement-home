/**
 * API tests for POST /api/drafts/[id]/swap
 * Covers role-based team-ownership checks (captainA can only swap team A's
 * players, captainB only team B's, admin either) and duplicate-player guards.
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
    draft: { findUnique: vi.fn(), update: vi.fn() },
    draftPick: { findFirst: vi.fn(), delete: vi.fn(), create: vi.fn() },
    player: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  };
  return { default: prisma };
});

// ─── Mock @/lib/draftAuth ────────────────────────────────────────────────────
vi.mock('@/lib/draftAuth', () => ({
  resolveRole: vi.fn(),
}));

// ─── Mock @/lib/draftLifecycle ───────────────────────────────────────────────
vi.mock('@/lib/draftLifecycle', () => ({
  syncDraftLobbyState: vi.fn(() => Promise.resolve()),
}));

// ─── Mock @/lib/rateLimit ────────────────────────────────────────────────────
vi.mock('@/lib/rateLimit', () => ({
  checkRateLimit: vi.fn(),
  hashIdentity: vi.fn((v) => `hashed:${v}`),
}));

const { default: prisma } = await import('@/lib/db');
const { resolveRole } = await import('@/lib/draftAuth');
const { syncDraftLobbyState } = await import('@/lib/draftLifecycle');
const { checkRateLimit } = await import('@/lib/rateLimit');
const { POST } = await import('@/app/api/drafts/[id]/swap/route.js');

const DRAFT_ID = 'draft-swap-1';
const PARAMS = { params: Promise.resolve({ id: DRAFT_ID }) };
const MOCK_DRAFT = {
  id: DRAFT_ID,
  status: 'lobby',
  adminKey: 'admin-key',
  captainAKey: 'cap-a-key',
  captainBKey: 'cap-b-key',
};

beforeEach(() => {
  vi.clearAllMocks();
  prisma.draft.findUnique.mockResolvedValue({ ...MOCK_DRAFT });
  checkRateLimit.mockResolvedValue({ allowed: true });
  prisma.$transaction.mockResolvedValue([]);
});

describe('POST /api/drafts/[id]/swap', () => {
  it('returns 400 for invalid JSON', async () => {
    const res = await POST(makeInvalidJsonReq(), PARAMS);
    expect(unwrap(res).status).toBe(400);
  });

  it('returns 400 when outPlayerId or inPlayerId is missing', async () => {
    const res = await POST(makeReq({ key: 'admin-key', outPlayerId: 'p1' }), PARAMS);
    expect(unwrap(res).status).toBe(400);
  });

  it('returns 400 when swapping a player with themselves', async () => {
    const res = await POST(makeReq({ key: 'admin-key', outPlayerId: 'p1', inPlayerId: 'p1' }), PARAMS);
    expect(unwrap(res).status).toBe(400);
    expect(unwrap(res).body.error).toMatch(/themselves/i);
  });

  it('returns 404 when draft does not exist', async () => {
    prisma.draft.findUnique.mockResolvedValue(null);
    const res = await POST(makeReq({ key: 'admin-key', outPlayerId: 'p1', inPlayerId: 'p2' }), PARAMS);
    expect(unwrap(res).status).toBe(404);
  });

  it('returns 403 for a spectator', async () => {
    resolveRole.mockReturnValue('spectator');
    const res = await POST(makeReq({ key: 'bad-key', outPlayerId: 'p1', inPlayerId: 'p2' }), PARAMS);
    expect(unwrap(res).status).toBe(403);
  });

  it('returns 429 when rate limited', async () => {
    resolveRole.mockReturnValue('admin');
    checkRateLimit.mockResolvedValue({ allowed: false });
    const res = await POST(makeReq({ key: 'admin-key', outPlayerId: 'p1', inPlayerId: 'p2' }), PARAMS);
    expect(unwrap(res).status).toBe(429);
  });

  it('returns 400 when a captain tries to swap outside the lobby phase', async () => {
    resolveRole.mockReturnValue('captainA');
    prisma.draft.findUnique.mockResolvedValue({ ...MOCK_DRAFT, status: 'pending' });
    const res = await POST(makeReq({ key: 'cap-a-key', outPlayerId: 'p1', inPlayerId: 'p2' }), PARAMS);
    expect(unwrap(res).status).toBe(400);
    expect(unwrap(res).body.error).toMatch(/lobby phase/i);
  });

  it('allows admin to swap during pending (captains cannot)', async () => {
    resolveRole.mockReturnValue('admin');
    prisma.draft.findUnique.mockResolvedValue({ ...MOCK_DRAFT, status: 'pending' });
    prisma.draftPick.findFirst
      .mockResolvedValueOnce({ id: 'pick-1', team: 'A', pickOrder: 0 }) // outPick
      .mockResolvedValueOnce(null); // inPlayer not already picked
    prisma.player.findUnique.mockResolvedValue({ id: 'p2' });
    const res = await POST(makeReq({ key: 'admin-key', outPlayerId: 'p1', inPlayerId: 'p2' }), PARAMS);
    expect(unwrap(res).status).toBe(200);
  });

  it('returns 404 when the outgoing player is not on any team', async () => {
    resolveRole.mockReturnValue('admin');
    prisma.draftPick.findFirst.mockResolvedValueOnce(null);
    const res = await POST(makeReq({ key: 'admin-key', outPlayerId: 'p1', inPlayerId: 'p2' }), PARAMS);
    expect(unwrap(res).status).toBe(404);
  });

  it('returns 403 when captainA tries to swap a team B player', async () => {
    resolveRole.mockReturnValue('captainA');
    prisma.draftPick.findFirst.mockResolvedValueOnce({ id: 'pick-1', team: 'B', pickOrder: 0 });
    const res = await POST(makeReq({ key: 'cap-a-key', outPlayerId: 'p1', inPlayerId: 'p2' }), PARAMS);
    expect(unwrap(res).status).toBe(403);
    expect(unwrap(res).body.error).toMatch(/own team/i);
  });

  it('returns 403 when captainB tries to swap a team A player', async () => {
    resolveRole.mockReturnValue('captainB');
    prisma.draftPick.findFirst.mockResolvedValueOnce({ id: 'pick-1', team: 'A', pickOrder: 0 });
    const res = await POST(makeReq({ key: 'cap-b-key', outPlayerId: 'p1', inPlayerId: 'p2' }), PARAMS);
    expect(unwrap(res).status).toBe(403);
    expect(unwrap(res).body.error).toMatch(/own team/i);
  });

  it("allows captainA to swap their own team's player", async () => {
    resolveRole.mockReturnValue('captainA');
    prisma.draftPick.findFirst
      .mockResolvedValueOnce({ id: 'pick-1', team: 'A', pickOrder: 0 })
      .mockResolvedValueOnce(null);
    prisma.player.findUnique.mockResolvedValue({ id: 'p2' });
    const res = await POST(makeReq({ key: 'cap-a-key', outPlayerId: 'p1', inPlayerId: 'p2' }), PARAMS);
    expect(unwrap(res).status).toBe(200);
    expect(unwrap(res).body.ok).toBe(true);
    expect(syncDraftLobbyState).toHaveBeenCalledWith(DRAFT_ID);
  });

  it('returns 404 when the incoming player does not exist', async () => {
    resolveRole.mockReturnValue('admin');
    prisma.draftPick.findFirst.mockResolvedValueOnce({ id: 'pick-1', team: 'A', pickOrder: 0 });
    prisma.player.findUnique.mockResolvedValue(null);
    const res = await POST(makeReq({ key: 'admin-key', outPlayerId: 'p1', inPlayerId: 'p2' }), PARAMS);
    expect(unwrap(res).status).toBe(404);
  });

  it('returns 409 when the incoming player is already on a team (duplicate-player guard)', async () => {
    resolveRole.mockReturnValue('admin');
    prisma.draftPick.findFirst
      .mockResolvedValueOnce({ id: 'pick-1', team: 'A', pickOrder: 0 }) // outPick
      .mockResolvedValueOnce({ id: 'pick-2', team: 'B' }); // inPlayer already picked
    prisma.player.findUnique.mockResolvedValue({ id: 'p2' });
    const res = await POST(makeReq({ key: 'admin-key', outPlayerId: 'p1', inPlayerId: 'p2' }), PARAMS);
    expect(unwrap(res).status).toBe(409);
    expect(unwrap(res).body.error).toMatch(/already on a team/i);
  });

  it('performs the swap in a transaction and bumps the draft version', async () => {
    resolveRole.mockReturnValue('admin');
    prisma.draftPick.findFirst
      .mockResolvedValueOnce({ id: 'pick-1', team: 'A', pickOrder: 3 })
      .mockResolvedValueOnce(null);
    prisma.player.findUnique.mockResolvedValue({ id: 'p2' });
    let txOps;
    prisma.$transaction.mockImplementation((ops) => { txOps = ops; return Promise.resolve([]); });
    const res = await POST(makeReq({ key: 'admin-key', outPlayerId: 'p1', inPlayerId: 'p2' }), PARAMS);
    expect(unwrap(res).status).toBe(200);
    expect(Array.isArray(txOps)).toBe(true);
    expect(txOps).toHaveLength(3);
  });

  it('returns 500 on unexpected error', async () => {
    resolveRole.mockReturnValue('admin');
    prisma.draftPick.findFirst.mockRejectedValue(new Error('db down'));
    const res = await POST(makeReq({ key: 'admin-key', outPlayerId: 'p1', inPlayerId: 'p2' }), PARAMS);
    expect(unwrap(res).status).toBe(500);
  });
});
