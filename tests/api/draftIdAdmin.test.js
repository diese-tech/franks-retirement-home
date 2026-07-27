/**
 * API tests for POST /api/drafts/[id]/admin
 * Sensitive endpoint: runs admin-only draft-lifecycle actions (nextGame,
 * resetDraft, reopenLastPick). Auth is via per-draft adminKey, not requireAdmin.
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
    draftPick: { findMany: vi.fn(), updateMany: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    draftBan: { deleteMany: vi.fn(), findMany: vi.fn() },
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
  teamsAreLoaded: vi.fn(),
}));

// ─── Mock @/lib/usedGodIds ───────────────────────────────────────────────────
vi.mock('@/lib/usedGodIds', () => ({
  readUsedGodIds: vi.fn(() => []),
  removeUsedGodId: vi.fn((arr) => arr),
}));

const { default: prisma } = await import('@/lib/db');
const { resolveRole } = await import('@/lib/draftAuth');
const { teamsAreLoaded } = await import('@/lib/draftLifecycle');
const { readUsedGodIds, removeUsedGodId } = await import('@/lib/usedGodIds');
const { POST } = await import('@/app/api/drafts/[id]/admin/route.js');

const DRAFT_ID = 'draft-admin-1';
const PARAMS = { params: Promise.resolve({ id: DRAFT_ID }) };
const MOCK_DRAFT = {
  id: DRAFT_ID,
  status: 'complete',
  adminKey: 'admin-key',
  captainAKey: 'cap-a-key',
  captainBKey: 'cap-b-key',
};

beforeEach(() => {
  vi.clearAllMocks();
  prisma.draft.findUnique.mockResolvedValue(MOCK_DRAFT);
  prisma.draftPick.findMany.mockResolvedValue([]);
  teamsAreLoaded.mockReturnValue(true);
  readUsedGodIds.mockReturnValue([]);
  removeUsedGodId.mockImplementation((arr) => arr);
});

describe('POST /api/drafts/[id]/admin', () => {
  it('returns 400 for invalid JSON', async () => {
    const res = await POST(makeInvalidJsonReq(), PARAMS);
    expect(unwrap(res).status).toBe(400);
  });

  it('returns 400 when action is missing', async () => {
    const res = await POST(makeReq({ key: 'admin-key' }), PARAMS);
    expect(unwrap(res).status).toBe(400);
    expect(unwrap(res).body.error).toMatch(/action/i);
  });

  it('returns 404 when draft does not exist', async () => {
    prisma.draft.findUnique.mockResolvedValue(null);
    const res = await POST(makeReq({ key: 'admin-key', action: 'nextGame' }), PARAMS);
    expect(unwrap(res).status).toBe(404);
  });

  it('returns 403 when a non-admin (captain) tries to run an action', async () => {
    resolveRole.mockReturnValue('captainA');
    const res = await POST(makeReq({ key: 'cap-a-key', action: 'nextGame' }), PARAMS);
    expect(unwrap(res).status).toBe(403);
  });

  it('returns 403 for a spectator / bad key', async () => {
    resolveRole.mockReturnValue('spectator');
    const res = await POST(makeReq({ key: 'nonsense', action: 'nextGame' }), PARAMS);
    expect(unwrap(res).status).toBe(403);
  });

  it('returns 400 for an unsupported action', async () => {
    resolveRole.mockReturnValue('admin');
    const res = await POST(makeReq({ key: 'admin-key', action: 'doNothing' }), PARAMS);
    expect(unwrap(res).status).toBe(400);
    expect(unwrap(res).body.error).toMatch(/Unsupported action/i);
  });

  describe('nextGame', () => {
    it('returns 400 when the draft is not complete', async () => {
      resolveRole.mockReturnValue('admin');
      prisma.draft.findUnique.mockResolvedValue({ ...MOCK_DRAFT, status: 'picking' });
      const res = await POST(makeReq({ key: 'admin-key', action: 'nextGame' }), PARAMS);
      expect(unwrap(res).status).toBe(400);
    });

    it('transitions to lobby when both teams are already loaded', async () => {
      resolveRole.mockReturnValue('admin');
      teamsAreLoaded.mockReturnValue(true);
      prisma.$transaction.mockResolvedValue([]);
      const res = await POST(makeReq({ key: 'admin-key', action: 'nextGame' }), PARAMS);
      expect(unwrap(res).status).toBe(200);
      expect(unwrap(res).body.ok).toBe(true);
    });

    it('transitions to pending when teams are not fully loaded', async () => {
      resolveRole.mockReturnValue('admin');
      teamsAreLoaded.mockReturnValue(false);
      prisma.$transaction.mockImplementation(async (ops) => ops);
      const res = await POST(makeReq({ key: 'admin-key', action: 'nextGame' }), PARAMS);
      expect(unwrap(res).status).toBe(200);
    });
  });

  describe('resetDraft', () => {
    it('resets bans/picks and clears usedGodIds', async () => {
      resolveRole.mockReturnValue('admin');
      prisma.$transaction.mockResolvedValue([]);
      const res = await POST(makeReq({ key: 'admin-key', action: 'resetDraft' }), PARAMS);
      expect(unwrap(res).status).toBe(200);
      expect(unwrap(res).body.ok).toBe(true);
    });
  });

  describe('reopenLastPick', () => {
    it('returns 400 when there are no assigned picks to reopen', async () => {
      resolveRole.mockReturnValue('admin');
      prisma.$transaction.mockImplementation(async (fn) => {
        prisma.draftPick.findFirst.mockResolvedValueOnce(null);
        return fn(prisma);
      });
      const res = await POST(makeReq({ key: 'admin-key', action: 'reopenLastPick' }), PARAMS);
      expect(unwrap(res).status).toBe(400);
      expect(unwrap(res).body.error).toMatch(/No assigned picks/i);
    });

    it('rewinds the most recent pick and reverts status to picking', async () => {
      resolveRole.mockReturnValue('admin');
      prisma.$transaction.mockImplementation(async (fn) => {
        prisma.draftPick.findFirst.mockResolvedValueOnce({ id: 'pick-10', godId: 'zeus' });
        prisma.draftPick.findMany.mockResolvedValueOnce([{ id: 'pick-10', godId: 'zeus' }]);
        prisma.draftBan.findMany.mockResolvedValueOnce([]);
        prisma.draft.findUnique.mockResolvedValueOnce({ usedGodIds: ['zeus'] });
        prisma.draftPick.update.mockResolvedValueOnce({});
        prisma.draft.update.mockResolvedValueOnce({});
        return fn(prisma);
      });
      const res = await POST(makeReq({ key: 'admin-key', action: 'reopenLastPick' }), PARAMS);
      expect(unwrap(res).status).toBe(200);
      expect(unwrap(res).body.ok).toBe(true);
      expect(unwrap(res).body.reopenedGodId).toBe('zeus');
    });
  });

  it('returns 500 on unexpected error', async () => {
    resolveRole.mockReturnValue('admin');
    prisma.draftPick.findMany.mockRejectedValue(new Error('db down'));
    const res = await POST(makeReq({ key: 'admin-key', action: 'nextGame' }), PARAMS);
    expect(unwrap(res).status).toBe(500);
  });
});
