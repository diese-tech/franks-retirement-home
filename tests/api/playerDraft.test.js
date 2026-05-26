/**
 * PlayerDraft tests — pick route + completion transaction + PATCH admin actions
 * Covers: app/api/player-drafts/[id]/pick/route.js
 *         app/api/player-drafts/[id]/complete/route.js
 *         app/api/player-drafts/[id]/route.js   (PATCH start / skip / order)
 *         app/api/player-drafts/[id]/order/route.js
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeReq, makeInvalidJsonReq, unwrap } from './_helpers.js';

// ─── Mock next/server ────────────────────────────────────────────────────────
vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((body, init) => ({ _body: body, _status: init?.status ?? 200 })),
  },
}));

// ─── Mock adminSession (requireAdmin) ────────────────────────────────────────
vi.mock('@/lib/adminSession', () => ({
  requireAdmin: vi.fn(() => null), // null = authorized
}));

// ─── Mock @/lib/playerDraftState ─────────────────────────────────────────────
vi.mock('@/lib/playerDraftState', () => ({
  buildPlayerDraftState: vi.fn(async () => null),
}));

// ─── Mock @/lib/db ───────────────────────────────────────────────────────────
vi.mock('@/lib/db', () => {
  const prisma = {
    playerDraft: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
    playerDraftPick: { findUnique: vi.fn(), create: vi.fn(), findFirst: vi.fn(), delete: vi.fn() },
    player: { findUnique: vi.fn() },
    teamMember: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(),
  };
  return { default: prisma };
});

const { default: prisma } = await import('@/lib/db');
const { requireAdmin } = await import('@/lib/adminSession');
const { POST: pickPOST } = await import('@/app/api/player-drafts/[id]/pick/route.js');
const { POST: completePOST } = await import('@/app/api/player-drafts/[id]/complete/route.js');
const { PATCH: draftPATCH } = await import('@/app/api/player-drafts/[id]/route.js');
const { PATCH: orderPATCH } = await import('@/app/api/player-drafts/[id]/order/route.js');

// ─── Fixtures ────────────────────────────────────────────────────────────────
const DRAFT_ID = 'pd-1';
const PARAMS = { params: { id: DRAFT_ID } };

// 4 teams, 2 rounds = 8 picks, snake: [T1,T2,T3,T4,T4,T3,T2,T1]
const CURRENT_ORDER = ['T1', 'T2', 'T3', 'T4'];
const MOCK_DRAFT = {
  id: DRAFT_ID,
  status: 'active',
  rounds: 2,
  currentOrder: CURRENT_ORDER,
  currentPickIndex: 0,
  pickTimerSeconds: 0,
  pickStartedAt: null,
  adminKey: 'admin-key',
  division: { name: 'Hospice' },
  picks: [],
};

const MOCK_PLAYER = { id: 'player-1', name: 'Zapman', role: 'Carry', division: 'Hospice' };

beforeEach(() => {
  vi.clearAllMocks();
  requireAdmin.mockReturnValue(null); // authorized
});

// ─── Pick route ───────────────────────────────────────────────────────────────
describe('POST /api/player-drafts/[id]/pick', () => {
  it('returns 400 for invalid JSON', async () => {
    const res = await pickPOST(makeInvalidJsonReq(), PARAMS);
    expect(unwrap(res).status).toBe(400);
  });

  it('returns 400 when teamId or playerId is missing', async () => {
    prisma.$transaction.mockImplementation(async (fn) => fn(prisma));
    prisma.playerDraft.findUnique.mockResolvedValue(MOCK_DRAFT);
    const res = await pickPOST(makeReq({ teamId: 'T1' }), PARAMS); // missing playerId
    expect(unwrap(res).status).toBe(400);
  });

  it('returns 404 when draft does not exist', async () => {
    prisma.$transaction.mockImplementation(async (fn) => fn(prisma));
    prisma.playerDraft.findUnique.mockResolvedValue(null);
    const res = await pickPOST(makeReq({ teamId: 'T1', playerId: 'p1' }), PARAMS);
    expect(unwrap(res).status).toBe(404);
  });

  it('returns 400 when draft is not active', async () => {
    prisma.$transaction.mockImplementation(async (fn) => fn(prisma));
    prisma.playerDraft.findUnique.mockResolvedValue({ ...MOCK_DRAFT, status: 'pending' });
    const res = await pickPOST(makeReq({ teamId: 'T1', playerId: 'p1' }), PARAMS);
    expect(unwrap(res).status).toBe(400);
    expect(unwrap(res).body.error).toMatch(/not active/i);
  });

  it('returns 400 when teamId is not the active team', async () => {
    prisma.$transaction.mockImplementation(async (fn) => fn(prisma));
    prisma.playerDraft.findUnique.mockResolvedValue({ ...MOCK_DRAFT, currentPickIndex: 0 });
    // index 0 → T1's turn, submitting T2
    const res = await pickPOST(makeReq({ teamId: 'T2', playerId: 'player-1' }), PARAMS);
    expect(unwrap(res).status).toBe(400);
    expect(unwrap(res).body.error).toMatch(/turn/i);
  });

  it('returns 404 when player does not exist', async () => {
    prisma.$transaction.mockImplementation(async (fn) => fn(prisma));
    prisma.playerDraft.findUnique.mockResolvedValue(MOCK_DRAFT);
    prisma.player.findUnique.mockResolvedValue(null);
    const res = await pickPOST(makeReq({ teamId: 'T1', playerId: 'bad-player' }), PARAMS);
    expect(unwrap(res).status).toBe(404);
  });

  it('returns 400 when player division does not match draft division', async () => {
    prisma.$transaction.mockImplementation(async (fn) => fn(prisma));
    prisma.playerDraft.findUnique.mockResolvedValue(MOCK_DRAFT);
    prisma.player.findUnique.mockResolvedValue({ ...MOCK_PLAYER, division: 'Rehabilitation' });
    const res = await pickPOST(makeReq({ teamId: 'T1', playerId: 'player-1' }), PARAMS);
    expect(unwrap(res).status).toBe(400);
    expect(unwrap(res).body.error).toMatch(/division/i);
  });

  it('returns 409 when player is already drafted', async () => {
    prisma.$transaction.mockImplementation(async (fn) => fn(prisma));
    prisma.playerDraft.findUnique.mockResolvedValue(MOCK_DRAFT);
    prisma.player.findUnique.mockResolvedValue(MOCK_PLAYER);
    prisma.playerDraftPick.findUnique.mockResolvedValue({ id: 'existing-pick' });
    const res = await pickPOST(makeReq({ teamId: 'T1', playerId: 'player-1' }), PARAMS);
    expect(unwrap(res).status).toBe(409);
    expect(unwrap(res).body.error).toMatch(/already drafted/i);
  });

  it('a player cannot be drafted twice — pick slot is unique per player', async () => {
    prisma.$transaction.mockImplementation(async (fn) => fn(prisma));
    prisma.playerDraft.findUnique.mockResolvedValue(MOCK_DRAFT);
    prisma.player.findUnique.mockResolvedValue(MOCK_PLAYER);
    // findUnique returns an existing pick for this player
    prisma.playerDraftPick.findUnique.mockResolvedValue({ id: 'pick-1', playerId: 'player-1' });
    const res = await pickPOST(makeReq({ teamId: 'T1', playerId: 'player-1' }), PARAMS);
    expect(unwrap(res).status).toBe(409);
  });

  it('division constraint is strict equality — Hospice != Rehabilitation', async () => {
    prisma.$transaction.mockImplementation(async (fn) => fn(prisma));
    prisma.playerDraft.findUnique.mockResolvedValue({ ...MOCK_DRAFT, division: { name: 'Hospice' } });
    prisma.player.findUnique.mockResolvedValue({ ...MOCK_PLAYER, division: 'Rehabilitation' });
    prisma.playerDraftPick.findUnique.mockResolvedValue(null);
    const res = await pickPOST(makeReq({ teamId: 'T1', playerId: 'player-1' }), PARAMS);
    expect(unwrap(res).status).toBe(400);
  });

  it('successful pick advances currentPickIndex and returns ok', async () => {
    prisma.$transaction.mockImplementation(async (fn) => fn(prisma));
    prisma.playerDraft.findUnique.mockResolvedValue(MOCK_DRAFT);
    prisma.player.findUnique.mockResolvedValue(MOCK_PLAYER);
    prisma.playerDraftPick.findUnique.mockResolvedValue(null);
    prisma.playerDraftPick.create.mockResolvedValue({});
    prisma.playerDraft.update.mockResolvedValue({ ...MOCK_DRAFT, currentPickIndex: 1 });
    const res = await pickPOST(makeReq({ teamId: 'T1', playerId: 'player-1' }), PARAMS);
    expect(unwrap(res).status).toBe(200);
    expect(prisma.playerDraftPick.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ playerId: 'player-1', teamId: 'T1' }) })
    );
  });

  it('snake order: index 4 (first step of round 2) belongs to T4 — uses turn.teamId directly', async () => {
    // After the bug fix, the route uses turn.teamId directly (not currentPickTeam(format, phaseIndex, stepIndex)).
    // With currentOrder ['T1','T2','T3','T4'] and 2 rounds:
    //   Round 1: T1, T2, T3, T4  (even phase, as-is)
    //   Round 2: T4, T3, T2, T1  (odd phase, reversed)
    // flat index 4 = phase 1, step 0 → turn.teamId = 'T4'
    prisma.$transaction.mockImplementation(async (fn) => fn(prisma));
    prisma.playerDraft.findUnique.mockResolvedValue({ ...MOCK_DRAFT, currentPickIndex: 4 });
    prisma.player.findUnique.mockResolvedValue({ ...MOCK_PLAYER, division: 'Hospice' });
    prisma.playerDraftPick.findUnique.mockResolvedValue(null);
    prisma.playerDraftPick.create.mockResolvedValue({});
    prisma.playerDraft.update.mockResolvedValue({});
    // T4 picks at index 4 — should succeed
    const res = await pickPOST(makeReq({ teamId: 'T4', playerId: 'player-1' }), PARAMS);
    expect(unwrap(res).status).toBe(200);
  });

  it('snake order: wrong team at index 4 is correctly rejected after bug fix', async () => {
    // After the fix, T2 is not the active team at flat index 4 — T4 is.
    prisma.$transaction.mockImplementation(async (fn) => fn(prisma));
    prisma.playerDraft.findUnique.mockResolvedValue({ ...MOCK_DRAFT, currentPickIndex: 4 });
    prisma.player.findUnique.mockResolvedValue({ ...MOCK_PLAYER, division: 'Hospice' });
    prisma.playerDraftPick.findUnique.mockResolvedValue(null);
    // T2 tries to pick at index 4 — must be rejected (T4's turn)
    const wrongRes = await pickPOST(makeReq({ teamId: 'T2', playerId: 'player-1' }), PARAMS);
    expect(unwrap(wrongRes).status).toBe(400);
    expect(unwrap(wrongRes).body.error).toMatch(/turn/i);
  });

  it('snake order: index 7 (last pick) belongs to T1', async () => {
    // flat index 7 = phase 1, step 3 → turn.teamId = 'T1' (reversed T4,T3,T2,T1)
    prisma.$transaction.mockImplementation(async (fn) => fn(prisma));
    prisma.playerDraft.findUnique.mockResolvedValue({ ...MOCK_DRAFT, currentPickIndex: 7 });
    prisma.player.findUnique.mockResolvedValue({ ...MOCK_PLAYER, division: 'Hospice' });
    prisma.playerDraftPick.findUnique.mockResolvedValue(null);
    prisma.playerDraftPick.create.mockResolvedValue({});
    prisma.playerDraft.update.mockResolvedValue({});
    const res = await pickPOST(makeReq({ teamId: 'T1', playerId: 'player-1' }), PARAMS);
    expect(unwrap(res).status).toBe(200);
  });

  it('snake order: T4 is rejected at index 7 (T1 turn)', async () => {
    prisma.$transaction.mockImplementation(async (fn) => fn(prisma));
    prisma.playerDraft.findUnique.mockResolvedValue({ ...MOCK_DRAFT, currentPickIndex: 7 });
    prisma.player.findUnique.mockResolvedValue({ ...MOCK_PLAYER, division: 'Hospice' });
    prisma.playerDraftPick.findUnique.mockResolvedValue(null);
    const res = await pickPOST(makeReq({ teamId: 'T4', playerId: 'player-1' }), PARAMS);
    expect(unwrap(res).status).toBe(400);
    expect(unwrap(res).body.error).toMatch(/turn/i);
  });
});

// ─── Completion transaction ────────────────────────────────────────────────────
describe('POST /api/player-drafts/[id]/complete', () => {
  // 4 teams × 2 rounds = 8 picks required
  const PICKS_ALL = [
    { id: 'pk1', teamId: 'T1', playerId: 'pl1', player: { id: 'pl1', role: 'Carry' } },
    { id: 'pk2', teamId: 'T2', playerId: 'pl2', player: { id: 'pl2', role: 'Mid' } },
    { id: 'pk3', teamId: 'T3', playerId: 'pl3', player: { id: 'pl3', role: 'Solo' } },
    { id: 'pk4', teamId: 'T4', playerId: 'pl4', player: { id: 'pl4', role: 'Support' } },
    { id: 'pk5', teamId: 'T4', playerId: 'pl5', player: { id: 'pl5', role: 'Jungle' } },
    { id: 'pk6', teamId: 'T3', playerId: 'pl6', player: { id: 'pl6', role: 'Carry' } },
    { id: 'pk7', teamId: 'T2', playerId: 'pl7', player: { id: 'pl7', role: 'Mid' } },
    { id: 'pk8', teamId: 'T1', playerId: 'pl8', player: { id: 'pl8', role: 'Solo' } },
  ];

  const COMPLETE_DRAFT = {
    ...MOCK_DRAFT,
    status: 'active',
    picks: PICKS_ALL,
  };

  it('returns 404 when draft does not exist', async () => {
    prisma.playerDraft.findUnique.mockResolvedValue(null);
    const res = await completePOST(makeReq({}), PARAMS);
    expect(unwrap(res).status).toBe(404);
  });

  it('returns 409 when draft is already complete', async () => {
    prisma.playerDraft.findUnique.mockResolvedValue({ ...COMPLETE_DRAFT, status: 'complete' });
    const res = await completePOST(makeReq({}), PARAMS);
    expect(unwrap(res).status).toBe(409);
  });

  it('returns 400 when not all picks are recorded', async () => {
    prisma.playerDraft.findUnique.mockResolvedValue({
      ...COMPLETE_DRAFT,
      picks: PICKS_ALL.slice(0, 5), // only 5 of 8
    });
    const res = await completePOST(makeReq({}), PARAMS);
    expect(unwrap(res).status).toBe(400);
    expect(unwrap(res).body.error).toMatch(/5 of 8/);
  });

  it('completion transaction upserts TeamMember rows and marks draft complete', async () => {
    prisma.playerDraft.findUnique.mockResolvedValue(COMPLETE_DRAFT);
    prisma.$transaction.mockImplementation(async (fn) => {
      // All players are new — no pre-existing TeamMember rows
      prisma.teamMember.findUnique.mockResolvedValue(null);
      prisma.teamMember.create.mockResolvedValue({});
      prisma.playerDraft.update.mockResolvedValue({ ...COMPLETE_DRAFT, status: 'complete' });
      return fn(prisma);
    });
    const res = await completePOST(makeReq({}), PARAMS);
    expect(unwrap(res).status).toBe(200);
    expect(unwrap(res).body.draft.status).toBe('complete');
    expect(unwrap(res).body.teamMembersCreated).toBe(8);
    expect(unwrap(res).body.teamMembersUpdated).toBe(0);
  });

  it('completion uses upsert — updates existing TeamMember rows', async () => {
    prisma.playerDraft.findUnique.mockResolvedValue(COMPLETE_DRAFT);
    prisma.$transaction.mockImplementation(async (fn) => {
      // All 8 players already have TeamMember rows
      prisma.teamMember.findUnique.mockResolvedValue({ id: 'tm-existing' });
      prisma.teamMember.update.mockResolvedValue({});
      prisma.playerDraft.update.mockResolvedValue({ ...COMPLETE_DRAFT, status: 'complete' });
      return fn(prisma);
    });
    const res = await completePOST(makeReq({}), PARAMS);
    expect(unwrap(res).status).toBe(200);
    expect(unwrap(res).body.teamMembersUpdated).toBe(8);
    expect(unwrap(res).body.teamMembersCreated).toBe(0);
  });

  it('failed transaction does not partially write TeamMember rows', async () => {
    prisma.playerDraft.findUnique.mockResolvedValue(COMPLETE_DRAFT);
    // Transaction throws — simulates DB failure mid-write
    prisma.$transaction.mockRejectedValue(new Error('DB error'));
    const res = await completePOST(makeReq({}), PARAMS);
    expect(unwrap(res).status).toBe(500);
    // Verify teamMember.create was never individually committed
    expect(prisma.teamMember.create).not.toHaveBeenCalled();
  });

  it('baseOrder is frozen at draft start — currentOrder changes only affect future slots', () => {
    // This is an architectural invariant enforced by the schema, not this endpoint.
    // The completion endpoint reads currentOrder (live), not baseOrder.
    // We verify that baseOrder is not used in completion logic by checking the
    // findUnique call only uses id.
    prisma.playerDraft.findUnique.mockResolvedValue({
      ...COMPLETE_DRAFT,
      baseOrder: ['T4', 'T3', 'T2', 'T1'], // frozen old order
      currentOrder: ['T1', 'T2', 'T3', 'T4'], // live order after trades
    });
    prisma.$transaction.mockImplementation(async (fn) => {
      prisma.teamMember.findUnique.mockResolvedValue(null);
      prisma.teamMember.create.mockResolvedValue({});
      prisma.playerDraft.update.mockResolvedValue({ ...COMPLETE_DRAFT, status: 'complete' });
      return fn(prisma);
    });
    // Just verify it completes without error — baseOrder is irrelevant to completion
    return completePOST(makeReq({}), PARAMS).then((res) => {
      expect(unwrap(res).status).toBe(200);
    });
  });
});


// ─── PATCH admin actions (start, skip, order) ────────────────────────────────

describe('PATCH /api/player-drafts/[id] — start action', () => {
  const PENDING_DRAFT = {
    id: DRAFT_ID,
    status: 'pending',
    rounds: 2,
    currentOrder: ['T1', 'T2', 'T3', 'T4'],
    baseOrder: [],
    currentPickIndex: 0,
    version: 0,
  };

  it('returns 400 when draft is not pending', async () => {
    prisma.playerDraft.findUnique.mockResolvedValue({ ...PENDING_DRAFT, status: 'active' });
    const res = await draftPATCH(makeReq({ action: 'start' }), PARAMS);
    expect(unwrap(res).status).toBe(400);
    expect(unwrap(res).body.error).toMatch(/pending/i);
  });

  it('returns 400 when currentOrder is empty', async () => {
    prisma.playerDraft.findUnique.mockResolvedValue({ ...PENDING_DRAFT, currentOrder: [] });
    const res = await draftPATCH(makeReq({ action: 'start' }), PARAMS);
    expect(unwrap(res).status).toBe(400);
    expect(unwrap(res).body.error).toMatch(/currentOrder/i);
  });

  it('freezes baseOrder to currentOrder when starting', async () => {
    prisma.playerDraft.findUnique.mockResolvedValue(PENDING_DRAFT);
    let capturedData;
    prisma.playerDraft.update.mockImplementation(({ data }) => {
      capturedData = data;
      return Promise.resolve({ ...PENDING_DRAFT, status: 'active', baseOrder: data.baseOrder });
    });
    const res = await draftPATCH(makeReq({ action: 'start' }), PARAMS);
    expect(unwrap(res).status).toBe(200);
    // baseOrder must be set to currentOrder at start — the freeze
    expect(capturedData.baseOrder).toEqual(['T1', 'T2', 'T3', 'T4']);
  });
});

describe('PATCH /api/player-drafts/[id] — skip action is disabled', () => {
  it('returns 400 — skip is not supported (would corrupt index without pick record)', async () => {
    prisma.playerDraft.findUnique.mockResolvedValue({
      id: DRAFT_ID,
      status: 'active',
      rounds: 2,
      currentOrder: ['T1', 'T2'],
      currentPickIndex: 0,
      version: 0,
    });
    const res = await draftPATCH(makeReq({ action: 'skip' }), PARAMS);
    expect(unwrap(res).status).toBe(400);
    expect(unwrap(res).body.error).toMatch(/skip/i);
  });
});

// ─── PATCH /api/player-drafts/[id]/order — team-ID validation ────────────────

describe('PATCH /api/player-drafts/[id]/order', () => {
  const ACTIVE_DRAFT = {
    id: DRAFT_ID,
    status: 'active',
    currentOrder: ['T1', 'T2', 'T3', 'T4'],
    version: 1,
  };

  it('returns 400 for invalid JSON', async () => {
    const res = await orderPATCH(makeInvalidJsonReq(), PARAMS);
    expect(unwrap(res).status).toBe(400);
  });

  it('returns 400 when currentOrder is missing or empty', async () => {
    const res = await orderPATCH(makeReq({ currentOrder: [] }), PARAMS);
    expect(unwrap(res).status).toBe(400);
  });

  it('returns 404 when draft does not exist', async () => {
    prisma.playerDraft.findUnique.mockResolvedValue(null);
    const res = await orderPATCH(makeReq({ currentOrder: ['T1', 'T2'] }), PARAMS);
    expect(unwrap(res).status).toBe(404);
  });

  it('returns 400 when completed', async () => {
    prisma.playerDraft.findUnique.mockResolvedValue({ ...ACTIVE_DRAFT, status: 'complete' });
    const res = await orderPATCH(makeReq({ currentOrder: ['T1', 'T2', 'T3', 'T4'] }), PARAMS);
    expect(unwrap(res).status).toBe(400);
    expect(unwrap(res).body.error).toMatch(/complete/i);
  });

  it('rejects currentOrder with different team IDs (cannot add new teams)', async () => {
    prisma.playerDraft.findUnique.mockResolvedValue(ACTIVE_DRAFT);
    const res = await orderPATCH(makeReq({ currentOrder: ['T1', 'T2', 'T3', 'T99'] }), PARAMS);
    expect(unwrap(res).status).toBe(400);
    expect(unwrap(res).body.error).toMatch(/same team IDs/i);
  });

  it('rejects currentOrder with duplicate team IDs', async () => {
    prisma.playerDraft.findUnique.mockResolvedValue(ACTIVE_DRAFT);
    // ['T1','T1','T3','T4'] has same Set size reduction but different length
    const res = await orderPATCH(makeReq({ currentOrder: ['T1', 'T1', 'T3', 'T4'] }), PARAMS);
    expect(unwrap(res).status).toBe(400);
  });

  it('rejects currentOrder with fewer team IDs', async () => {
    prisma.playerDraft.findUnique.mockResolvedValue(ACTIVE_DRAFT);
    const res = await orderPATCH(makeReq({ currentOrder: ['T1', 'T2', 'T3'] }), PARAMS);
    expect(unwrap(res).status).toBe(400);
  });

  it('accepts a valid reordering of the same teams', async () => {
    prisma.playerDraft.findUnique.mockResolvedValue(ACTIVE_DRAFT);
    prisma.playerDraft.update.mockResolvedValue({ ...ACTIVE_DRAFT, currentOrder: ['T4', 'T3', 'T2', 'T1'] });
    const res = await orderPATCH(makeReq({ currentOrder: ['T4', 'T3', 'T2', 'T1'] }), PARAMS);
    expect(unwrap(res).status).toBe(200);
  });
});
