/**
 * API tests for POST /api/drafts/[id]/ban  and  DELETE /api/drafts/[id]/ban
 *
 * Strategy: mock prisma and NextResponse so no DB or Next.js runtime is needed.
 * The route module is imported after mocks are registered.
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
    draftBan: {
      count: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
    },
    draftPick: { count: vi.fn() },
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
  currentBanTeam: vi.fn(),
  TOTAL_BANS: 6,
  currentPickTeam: vi.fn(),
  TOTAL_PICKS: 10,
}));

const { default: prisma } = await import('@/lib/db');
const { resolveRole } = await import('@/lib/draftAuth');
const { currentBanTeam } = await import('@/lib/draftOrder');
const { POST, DELETE } = await import('@/app/api/drafts/[id]/ban/route.js');

// ─── Fixtures ────────────────────────────────────────────────────────────────
const DRAFT_ID = 'draft-abc';
const PARAMS = { params: Promise.resolve({ id: DRAFT_ID }) };
const MOCK_DRAFT = {
  id: DRAFT_ID,
  status: 'banning',
  version: 1,
  adminKey: 'admin-key',
  captainAKey: 'cap-a-key',
  captainBKey: 'cap-b-key',
};
const MOCK_GOD = { id: 'zeus', name: 'Zeus' };

// Helper: set up successful transaction — calls the callback and returns its result
function mockSuccessfulTransaction(banCount = 0, team = 'A') {
  currentBanTeam.mockReturnValue(team);
  prisma.$transaction.mockImplementation(async (fn) => {
    // Inside transaction: return current draft + no existing ban + successful update
    prisma.draft.findUnique.mockResolvedValueOnce({ id: DRAFT_ID, status: 'banning', version: 1 });
    prisma.draftBan.count.mockResolvedValueOnce(banCount);
    prisma.draftBan.findFirst.mockResolvedValueOnce(null); // no duplicate
    prisma.draftBan.create.mockResolvedValueOnce({});
    prisma.draft.updateMany.mockResolvedValueOnce({ count: 1 });
    return fn(prisma);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default: outer findUnique returns the mock draft (for role resolution)
  prisma.draft.findUnique.mockResolvedValue(MOCK_DRAFT);
  prisma.god = { findUnique: vi.fn().mockResolvedValue(MOCK_GOD) };
});

// ─── POST tests ──────────────────────────────────────────────────────────────
describe('POST /api/drafts/[id]/ban', () => {
  it('returns 400 for invalid JSON', async () => {
    const { unwrap: uw } = await import('./_helpers.js');
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
    prisma.god = { findUnique: vi.fn().mockResolvedValue(null) };
    const res = await POST(makeReq({ key: 'cap-a-key', godId: 'fake-god' }), PARAMS);
    expect(unwrap(res).status).toBe(404);
  });

  it('returns 403 when spectator tries to ban', async () => {
    resolveRole.mockReturnValue('spectator');
    const res = await POST(makeReq({ key: 'bad-key', godId: 'zeus' }), PARAMS);
    expect(unwrap(res).status).toBe(403);
  });

  it('returns 400 when draft is not in banning phase', async () => {
    resolveRole.mockReturnValue('captainA');
    prisma.$transaction.mockImplementation(async (fn) => {
      prisma.draft.findUnique.mockResolvedValueOnce({ id: DRAFT_ID, status: 'picking', version: 1 });
      return fn(prisma);
    });
    const res = await POST(makeReq({ key: 'cap-a-key', godId: 'zeus' }), PARAMS);
    expect(unwrap(res).status).toBe(400);
    expect(unwrap(res).body.error).toMatch(/banning phase/i);
  });

  it('returns 403 when it is not captainA turn', async () => {
    resolveRole.mockReturnValue('captainA');
    prisma.$transaction.mockImplementation(async (fn) => {
      prisma.draft.findUnique.mockResolvedValueOnce({ id: DRAFT_ID, status: 'banning', version: 1 });
      prisma.draftBan.count.mockResolvedValueOnce(1); // count=1 → B's turn
      currentBanTeam.mockReturnValue('B');
      return fn(prisma);
    });
    const res = await POST(makeReq({ key: 'cap-a-key', godId: 'zeus' }), PARAMS);
    expect(unwrap(res).status).toBe(403);
  });

  it('returns 403 when it is not captainB turn', async () => {
    resolveRole.mockReturnValue('captainB');
    prisma.$transaction.mockImplementation(async (fn) => {
      prisma.draft.findUnique.mockResolvedValueOnce({ id: DRAFT_ID, status: 'banning', version: 1 });
      prisma.draftBan.count.mockResolvedValueOnce(0); // count=0 → A's turn
      currentBanTeam.mockReturnValue('A');
      return fn(prisma);
    });
    const res = await POST(makeReq({ key: 'cap-b-key', godId: 'zeus' }), PARAMS);
    expect(unwrap(res).status).toBe(403);
  });

  it('returns 409 when god is already banned', async () => {
    resolveRole.mockReturnValue('captainA');
    prisma.$transaction.mockImplementation(async (fn) => {
      prisma.draft.findUnique.mockResolvedValueOnce({ id: DRAFT_ID, status: 'banning', version: 1 });
      prisma.draftBan.count.mockResolvedValueOnce(0);
      currentBanTeam.mockReturnValue('A');
      prisma.draftBan.findFirst.mockResolvedValueOnce({ id: 'existing-ban' });
      return fn(prisma);
    });
    const res = await POST(makeReq({ key: 'cap-a-key', godId: 'zeus' }), PARAMS);
    expect(unwrap(res).status).toBe(409);
  });

  it('returns 400 when all bans are already complete', async () => {
    resolveRole.mockReturnValue('captainA');
    prisma.$transaction.mockImplementation(async (fn) => {
      prisma.draft.findUnique.mockResolvedValueOnce({ id: DRAFT_ID, status: 'banning', version: 1 });
      prisma.draftBan.count.mockResolvedValueOnce(6); // TOTAL_BANS = 6
      return fn(prisma);
    });
    const res = await POST(makeReq({ key: 'cap-a-key', godId: 'zeus' }), PARAMS);
    expect(unwrap(res).status).toBe(400);
    expect(unwrap(res).body.error).toMatch(/complete/i);
  });

  it('transitions status to picking when final ban is submitted', async () => {
    resolveRole.mockReturnValue('captainB');
    currentBanTeam.mockReturnValue('B');
    prisma.$transaction.mockImplementation(async (fn) => {
      prisma.draft.findUnique.mockResolvedValueOnce({ id: DRAFT_ID, status: 'banning', version: 1 });
      prisma.draftBan.count.mockResolvedValueOnce(5); // 5th ban (0-indexed) = last
      currentBanTeam.mockReturnValue('B');
      prisma.draftBan.findFirst.mockResolvedValueOnce(null);
      prisma.draftBan.create.mockResolvedValueOnce({});
      // updateMany should be called with status: 'picking'
      prisma.draft.updateMany.mockImplementationOnce(({ data }) => {
        expect(data.status).toBe('picking');
        return { count: 1 };
      });
      return fn(prisma);
    });
    const res = await POST(makeReq({ key: 'cap-b-key', godId: 'athena' }), PARAMS);
    expect(unwrap(res).status).toBe(200);
    expect(unwrap(res).body.ok).toBe(true);
  });

  it('returns 200 ok on successful ban', async () => {
    resolveRole.mockReturnValue('captainA');
    mockSuccessfulTransaction(0, 'A');
    const res = await POST(makeReq({ key: 'cap-a-key', godId: 'zeus' }), PARAMS);
    expect(unwrap(res).status).toBe(200);
    expect(unwrap(res).body.ok).toBe(true);
  });
});

// ─── DELETE tests ─────────────────────────────────────────────────────────────
describe('DELETE /api/drafts/[id]/ban (undo)', () => {
  it('returns 400 for invalid JSON', async () => {
    const res = await DELETE(makeInvalidJsonReq(), PARAMS);
    expect(unwrap(res).status).toBe(400);
  });

  it('returns 400 when banId is missing', async () => {
    const res = await DELETE(makeReq({ key: 'admin-key' }), PARAMS);
    expect(unwrap(res).status).toBe(400);
    expect(unwrap(res).body.error).toMatch(/banId/i);
  });

  it('returns 404 when draft does not exist', async () => {
    prisma.draft.findUnique.mockResolvedValue(null);
    const res = await DELETE(makeReq({ key: 'admin-key', banId: 'ban-1' }), PARAMS);
    expect(unwrap(res).status).toBe(404);
  });

  it('returns 403 when non-admin tries to undo ban', async () => {
    resolveRole.mockReturnValue('captainA');
    const res = await DELETE(makeReq({ key: 'cap-a-key', banId: 'ban-1' }), PARAMS);
    expect(unwrap(res).status).toBe(403);
  });

  it('returns 400 when picks already exist (cannot rewind)', async () => {
    resolveRole.mockReturnValue('admin');
    prisma.draftBan.findFirst = vi.fn().mockResolvedValue({ id: 'ban-1', draftId: DRAFT_ID, godId: 'zeus' });
    prisma.draftPick.count.mockResolvedValue(1); // picks exist
    const res = await DELETE(makeReq({ key: 'admin-key', banId: 'ban-1' }), PARAMS);
    expect(unwrap(res).status).toBe(400);
    expect(unwrap(res).body.error).toMatch(/pick/i);
  });

  it('returns 200 ok when admin successfully undoes a ban', async () => {
    resolveRole.mockReturnValue('admin');
    prisma.draftBan.findFirst = vi.fn().mockResolvedValue({ id: 'ban-1', draftId: DRAFT_ID, godId: 'zeus' });
    prisma.draftPick.count.mockResolvedValue(0);
    prisma.draftBan.findMany.mockResolvedValue([]); // no remaining bans to reorder
    prisma.$transaction.mockImplementation(async (ops) => {
      // ops is an array of prisma calls — just resolve them
      return ops;
    });
    const res = await DELETE(makeReq({ key: 'admin-key', banId: 'ban-1' }), PARAMS);
    expect(unwrap(res).status).toBe(200);
    expect(unwrap(res).body.ok).toBe(true);
  });
});
