/**
 * API tests for POST /api/drafts/[id]/pick  and  DELETE /api/drafts/[id]/pick
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
    draftPick: { findMany: vi.fn(), update: vi.fn(), findFirst: vi.fn() },
    draftBan: { findMany: vi.fn() },
    god: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  };
  return { default: prisma };
});

// ─── Mock @/lib/draftAuth ────────────────────────────────────────────────────
vi.mock('@/lib/draftAuth', () => ({
  resolveRole: vi.fn(),
}));

// ─── Mock @/lib/draftOrder ───────────────────────────────────────────────────
vi.mock('@/lib/draftOrder', () => ({
  currentPickTeam: vi.fn(),
  TOTAL_PICKS: 10,
  currentBanTeam: vi.fn(),
  TOTAL_BANS: 6,
}));

// ─── Mock @/lib/usedGodIds ───────────────────────────────────────────────────
vi.mock('@/lib/usedGodIds', () => ({
  readUsedGodIds: vi.fn(() => []),
  addUsedGodId: vi.fn((arr, id) => [...arr, id]),
  removeUsedGodId: vi.fn((arr, id) => arr.filter((g) => g !== id)),
}));

const { default: prisma } = await import('@/lib/db');
const { resolveRole } = await import('@/lib/draftAuth');
const { currentPickTeam } = await import('@/lib/draftOrder');
const { readUsedGodIds } = await import('@/lib/usedGodIds');
const { POST, DELETE } = await import('@/app/api/drafts/[id]/pick/route.js');

// ─── Fixtures ────────────────────────────────────────────────────────────────
const DRAFT_ID = 'draft-xyz';
const PARAMS = { params: Promise.resolve({ id: DRAFT_ID }) };
const MOCK_DRAFT = {
  id: DRAFT_ID,
  status: 'picking',
  version: 3,
  usedGodIds: [],
  adminKey: 'admin-key',
  captainAKey: 'cap-a-key',
  captainBKey: 'cap-b-key',
};
// 10 empty pick slots (5 A, 5 B) — draftId must match DRAFT_ID for the draftId check in the route
const EMPTY_PICKS = [
  { id: 'p1',  team: 'A', godId: null, draftId: DRAFT_ID },
  { id: 'p2',  team: 'B', godId: null, draftId: DRAFT_ID },
  { id: 'p3',  team: 'B', godId: null, draftId: DRAFT_ID },
  { id: 'p4',  team: 'A', godId: null, draftId: DRAFT_ID },
  { id: 'p5',  team: 'A', godId: null, draftId: DRAFT_ID },
  { id: 'p6',  team: 'B', godId: null, draftId: DRAFT_ID },
  { id: 'p7',  team: 'B', godId: null, draftId: DRAFT_ID },
  { id: 'p8',  team: 'A', godId: null, draftId: DRAFT_ID },
  { id: 'p9',  team: 'A', godId: null, draftId: DRAFT_ID },
  { id: 'p10', team: 'B', godId: null, draftId: DRAFT_ID },
];

function setupSuccessfulTransaction({ pickedCount = 0, team = 'A', vault = [], bans = [] } = {}) {
  // currentPickTeam is called synchronously inside the transaction callback.
  // Set it before registering the transaction mock so it's ready when fn() runs.
  currentPickTeam.mockReturnValue(team);
  readUsedGodIds.mockReturnValue(vault);
  prisma.$transaction.mockImplementation(async (fn) => {
    prisma.draft.findUnique.mockResolvedValueOnce({ ...MOCK_DRAFT });
    const picks = EMPTY_PICKS.slice();
    for (let i = 0; i < pickedCount; i++) picks[i] = { ...picks[i], godId: `god-${i}` };
    prisma.draftPick.findMany.mockResolvedValueOnce(picks);
    prisma.draftBan.findMany.mockResolvedValueOnce(bans);
    prisma.draftPick.update.mockResolvedValueOnce({});
    prisma.draft.updateMany.mockResolvedValueOnce({ count: 1 });
    return fn(prisma);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  prisma.draft.findUnique.mockResolvedValue(MOCK_DRAFT);
  prisma.god.findUnique.mockResolvedValue({ id: 'zeus', name: 'Zeus' });
  // Safe defaults so tests that don't need to override these still work
  currentPickTeam.mockReturnValue('A');
  readUsedGodIds.mockReturnValue([]);
  // Default transaction: pass-through (tests override as needed)
  prisma.$transaction.mockImplementation(async (fn) => fn(prisma));
});

// ─── POST tests ───────────────────────────────────────────────────────────────
describe('POST /api/drafts/[id]/pick', () => {
  it('returns 400 for invalid JSON', async () => {
    const res = await POST(makeInvalidJsonReq(), PARAMS);
    expect(unwrap(res).status).toBe(400);
  });

  it('returns 400 when godId is missing', async () => {
    const res = await POST(makeReq({ key: 'cap-a-key' }), PARAMS);
    expect(unwrap(res).status).toBe(400);
    expect(unwrap(res).body.error).toMatch(/godId/i);
  });

  it('returns 404 when draft does not exist', async () => {
    prisma.draft.findUnique.mockResolvedValue(null);
    const res = await POST(makeReq({ key: 'cap-a-key', godId: 'zeus' }), PARAMS);
    expect(unwrap(res).status).toBe(404);
  });

  it('returns 404 when god does not exist', async () => {
    resolveRole.mockReturnValue('captainA');
    prisma.god.findUnique.mockResolvedValue(null);
    const res = await POST(makeReq({ key: 'cap-a-key', godId: 'fake-god' }), PARAMS);
    expect(unwrap(res).status).toBe(404);
  });

  it('returns 403 when spectator tries to pick', async () => {
    resolveRole.mockReturnValue('spectator');
    const res = await POST(makeReq({ key: 'bad', godId: 'zeus' }), PARAMS);
    expect(unwrap(res).status).toBe(403);
  });

  it('returns 400 when draft is not in picking phase', async () => {
    resolveRole.mockReturnValue('captainA');
    prisma.$transaction.mockImplementation(async (fn) => {
      prisma.draft.findUnique.mockResolvedValueOnce({ ...MOCK_DRAFT, status: 'banning' });
      return fn(prisma);
    });
    const res = await POST(makeReq({ key: 'cap-a-key', godId: 'zeus' }), PARAMS);
    expect(unwrap(res).status).toBe(400);
    expect(unwrap(res).body.error).toMatch(/picking phase/i);
  });

  it('returns 403 when it is not captainA turn', async () => {
    resolveRole.mockReturnValue('captainA');
    prisma.$transaction.mockImplementation(async (fn) => {
      prisma.draft.findUnique.mockResolvedValueOnce({ ...MOCK_DRAFT });
      prisma.draftPick.findMany.mockResolvedValueOnce(EMPTY_PICKS);
      prisma.draftBan.findMany.mockResolvedValueOnce([]);
      currentPickTeam.mockReturnValue('B'); // B's turn
      readUsedGodIds.mockReturnValue([]);
      return fn(prisma);
    });
    const res = await POST(makeReq({ key: 'cap-a-key', godId: 'zeus' }), PARAMS);
    expect(unwrap(res).status).toBe(403);
  });

  it('returns 403 when captainB tries to pick for team A', async () => {
    resolveRole.mockReturnValue('captainB');
    // It IS B's turn, but we're passing pickId pointing at a team A slot
    currentPickTeam.mockReturnValue('B');
    readUsedGodIds.mockReturnValue([]);
    prisma.$transaction.mockImplementation(async (fn) => {
      prisma.draft.findUnique.mockResolvedValueOnce({ ...MOCK_DRAFT });
      prisma.draftPick.findMany.mockResolvedValueOnce(EMPTY_PICKS.slice());
      prisma.draftBan.findMany.mockResolvedValueOnce([]);
      return fn(prisma);
    });
    // pickId explicitly targeting team A slot
    const res = await POST(makeReq({ key: 'cap-b-key', godId: 'zeus', pickId: 'p1' }), PARAMS);
    expect(unwrap(res).status).toBe(403);
  });

  it('returns 409 when god is banned in current draft', async () => {
    resolveRole.mockReturnValue('captainA');
    currentPickTeam.mockReturnValue('A');
    readUsedGodIds.mockReturnValue([]);
    prisma.$transaction.mockImplementation(async (fn) => {
      prisma.draft.findUnique.mockResolvedValueOnce({ ...MOCK_DRAFT });
      prisma.draftPick.findMany.mockResolvedValueOnce(EMPTY_PICKS.slice());
      prisma.draftBan.findMany.mockResolvedValueOnce([{ godId: 'zeus' }]); // zeus is banned
      return fn(prisma);
    });
    const res = await POST(makeReq({ key: 'cap-a-key', godId: 'zeus' }), PARAMS);
    expect(unwrap(res).status).toBe(409);
    expect(unwrap(res).body.error).toMatch(/banned/i);
  });

  it('returns 409 when god is already picked in current draft', async () => {
    resolveRole.mockReturnValue('captainA');
    currentPickTeam.mockReturnValue('A');
    readUsedGodIds.mockReturnValue([]);
    prisma.$transaction.mockImplementation(async (fn) => {
      prisma.draft.findUnique.mockResolvedValueOnce({ ...MOCK_DRAFT });
      const picks = EMPTY_PICKS.map((p, i) => (i === 1 ? { ...p, godId: 'zeus' } : p));
      prisma.draftPick.findMany.mockResolvedValueOnce(picks);
      prisma.draftBan.findMany.mockResolvedValueOnce([]);
      return fn(prisma);
    });
    const res = await POST(makeReq({ key: 'cap-a-key', godId: 'zeus' }), PARAMS);
    expect(unwrap(res).status).toBe(409);
    expect(unwrap(res).body.error).toMatch(/already picked/i);
  });

  it('returns 409 when god is in vault (picked in prior game)', async () => {
    resolveRole.mockReturnValue('captainA');
    currentPickTeam.mockReturnValue('A');
    readUsedGodIds.mockReturnValue(['zeus']); // zeus is vaulted from prior game pick
    prisma.$transaction.mockImplementation(async (fn) => {
      prisma.draft.findUnique.mockResolvedValueOnce({ ...MOCK_DRAFT });
      prisma.draftPick.findMany.mockResolvedValueOnce(EMPTY_PICKS.slice());
      prisma.draftBan.findMany.mockResolvedValueOnce([]);
      return fn(prisma);
    });
    const res = await POST(makeReq({ key: 'cap-a-key', godId: 'zeus' }), PARAMS);
    expect(unwrap(res).status).toBe(409);
    expect(unwrap(res).body.error).toMatch(/earlier in this set/i);
  });

  it('prior-game BAN is NOT treated as vaulted — pick succeeds', async () => {
    // The vault contains only prior-game picks; prior-game bans are excluded.
    // This test documents the correct post-fix behavior.
    resolveRole.mockReturnValue('captainA');
    currentPickTeam.mockReturnValue('A');
    // vault does NOT include ares — getEffectiveVaultedGodIds fixed to exclude bans
    readUsedGodIds.mockReturnValue([]);
    prisma.$transaction.mockImplementation(async (fn) => {
      prisma.draft.findUnique.mockResolvedValueOnce({ ...MOCK_DRAFT });
      prisma.draftPick.findMany.mockResolvedValueOnce(EMPTY_PICKS.slice());
      prisma.draftBan.findMany.mockResolvedValueOnce([]); // no current-draft bans
      prisma.draftPick.update.mockResolvedValueOnce({});
      prisma.draft.updateMany.mockResolvedValueOnce({ count: 1 });
      return fn(prisma);
    });
    // ares was banned in game 1, but should be pickable in game 2
    const res = await POST(makeReq({ key: 'cap-a-key', godId: 'ares' }), PARAMS);
    expect(unwrap(res).status).toBe(200);
    expect(unwrap(res).body.ok).toBe(true);
  });

  it('final pick transitions status to complete', async () => {
    resolveRole.mockReturnValue('captainB');
    currentPickTeam.mockReturnValue('B');
    readUsedGodIds.mockReturnValue([]);
    prisma.$transaction.mockImplementation(async (fn) => {
      prisma.draft.findUnique.mockResolvedValueOnce({ ...MOCK_DRAFT });
      // 9 picks already done, last slot is B's
      const picks = EMPTY_PICKS.map((p, i) => (i < 9 ? { ...p, godId: `g${i}` } : p));
      prisma.draftPick.findMany.mockResolvedValueOnce(picks);
      prisma.draftBan.findMany.mockResolvedValueOnce([]);
      prisma.draftPick.update.mockResolvedValueOnce({});
      // Capture the updateMany call to verify status='complete'
      prisma.draft.updateMany.mockImplementationOnce(({ data }) => {
        expect(data.status).toBe('complete');
        return { count: 1 };
      });
      return fn(prisma);
    });
    const res = await POST(makeReq({ key: 'cap-b-key', godId: 'aphrodite' }), PARAMS);
    expect(unwrap(res).status).toBe(200);
  });

  it('returns 409 on optimistic version conflict after retry failure', async () => {
    resolveRole.mockReturnValue('captainA');
    currentPickTeam.mockReturnValue('A');
    readUsedGodIds.mockReturnValue([]);
    // Both attempts lose the version lock — mock must fire twice
    prisma.$transaction.mockImplementation(async (fn) => {
      prisma.draft.findUnique.mockResolvedValueOnce({ ...MOCK_DRAFT });
      prisma.draftPick.findMany.mockResolvedValueOnce(EMPTY_PICKS.slice());
      prisma.draftBan.findMany.mockResolvedValueOnce([]);
      prisma.draftPick.update.mockResolvedValueOnce({});
      prisma.draft.updateMany.mockResolvedValueOnce({ count: 0 }); // lock lost
      return fn(prisma);
    });
    const res = await POST(makeReq({ key: 'cap-a-key', godId: 'zeus' }), PARAMS);
    expect(unwrap(res).status).toBe(409);
    expect(unwrap(res).body.error).toMatch(/conflict/i);
  });

  it('returns 200 ok on successful pick', async () => {
    resolveRole.mockReturnValue('captainA');
    setupSuccessfulTransaction({ pickedCount: 0, team: 'A' });
    const res = await POST(makeReq({ key: 'cap-a-key', godId: 'zeus' }), PARAMS);
    expect(unwrap(res).status).toBe(200);
    expect(unwrap(res).body.ok).toBe(true);
  });
});

// ─── DELETE tests ─────────────────────────────────────────────────────────────
describe('DELETE /api/drafts/[id]/pick (undo)', () => {
  it('returns 400 for invalid JSON', async () => {
    const res = await DELETE(makeInvalidJsonReq(), PARAMS);
    expect(unwrap(res).status).toBe(400);
  });

  it('returns 400 when pickId is missing', async () => {
    const res = await DELETE(makeReq({ key: 'admin-key' }), PARAMS);
    expect(unwrap(res).status).toBe(400);
    expect(unwrap(res).body.error).toMatch(/pickId/i);
  });

  it('returns 404 when draft does not exist', async () => {
    prisma.draft.findUnique.mockResolvedValue(null);
    const res = await DELETE(makeReq({ key: 'admin-key', pickId: 'p1' }), PARAMS);
    expect(unwrap(res).status).toBe(404);
  });

  it('returns 403 when non-admin tries to undo pick', async () => {
    resolveRole.mockReturnValue('captainA');
    const res = await DELETE(makeReq({ key: 'cap-a-key', pickId: 'p1' }), PARAMS);
    expect(unwrap(res).status).toBe(403);
  });

  it('returns 200 ok when admin successfully undoes a pick', async () => {
    resolveRole.mockReturnValue('admin');
    prisma.draftPick.findFirst.mockResolvedValue({ id: 'p1', draftId: DRAFT_ID, godId: 'zeus' });
    prisma.$transaction.mockImplementation(async (fn) => {
      prisma.draftPick.findMany.mockResolvedValueOnce([{ id: 'p1', godId: 'zeus' }]);
      prisma.draftBan.findMany.mockResolvedValueOnce([]);
      prisma.draft.findUnique.mockResolvedValueOnce({ usedGodIds: ['zeus'] });
      prisma.draftPick.update.mockResolvedValueOnce({});
      prisma.draft.update.mockResolvedValueOnce({});
      return fn(prisma);
    });
    const res = await DELETE(makeReq({ key: 'admin-key', pickId: 'p1' }), PARAMS);
    expect(unwrap(res).status).toBe(200);
    expect(unwrap(res).body.ok).toBe(true);
  });
});
