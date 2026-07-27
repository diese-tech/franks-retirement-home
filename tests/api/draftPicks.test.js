/**
 * API tests for GET/POST/DELETE /api/draft-picks
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
    draftPick: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      findFirst: vi.fn(),
    },
    draft: { update: vi.fn() },
  };
  return { default: prisma };
});

// ─── Mock @/lib/draftLifecycle ───────────────────────────────────────────────
vi.mock('@/lib/draftLifecycle', () => ({
  syncDraftLobbyState: vi.fn(() => Promise.resolve()),
  teamsAreLoaded: vi.fn(),
}));

// ─── Mock @/lib/resolveAuth ──────────────────────────────────────────────────
vi.mock('@/lib/resolveAuth', () => ({
  resolveAdminAuth: vi.fn(),
}));

const { default: prisma } = await import('@/lib/db');
const { syncDraftLobbyState } = await import('@/lib/draftLifecycle');
const { resolveAdminAuth } = await import('@/lib/resolveAuth');
const { GET, POST, DELETE } = await import('@/app/api/draft-picks/route.js');

function makeUrlReq(body, url) {
  return { json: () => Promise.resolve(body), url };
}

beforeEach(() => {
  vi.clearAllMocks();
  resolveAdminAuth.mockResolvedValue(null); // authorized by default
});

// ─── GET ─────────────────────────────────────────────────────────────────────
describe('GET /api/draft-picks', () => {
  it('returns 400 when draftId is missing', async () => {
    const res = await GET(makeUrlReq(null, 'http://x/api/draft-picks'));
    expect(unwrap(res).status).toBe(400);
  });

  it('returns picks for the given draftId', async () => {
    const picks = [{ id: 'p1', draftId: 'd1', team: 'A' }];
    prisma.draftPick.findMany.mockResolvedValue(picks);
    const res = await GET(makeUrlReq(null, 'http://x/api/draft-picks?draftId=d1'));
    expect(unwrap(res).status).toBe(200);
    expect(unwrap(res).body).toEqual(picks);
  });

  it('returns 500 on DB error', async () => {
    prisma.draftPick.findMany.mockRejectedValue(new Error('db down'));
    const res = await GET(makeUrlReq(null, 'http://x/api/draft-picks?draftId=d1'));
    expect(unwrap(res).status).toBe(500);
  });
});

// ─── POST ────────────────────────────────────────────────────────────────────
describe('POST /api/draft-picks', () => {
  it('returns the admin guard response when not authorized', async () => {
    const guard = { _body: { error: 'Admin authentication required' }, _status: 401 };
    resolveAdminAuth.mockResolvedValue(guard);
    const res = await POST(makeUrlReq({ draftId: 'd1', playerId: 'p1', team: 'A' }, 'http://x/api/draft-picks'));
    expect(res).toBe(guard);
  });

  it('returns 400 for invalid JSON', async () => {
    const req = { json: () => { throw new SyntaxError('bad'); }, url: 'http://x/api/draft-picks' };
    const res = await POST(req);
    expect(unwrap(res).status).toBe(400);
  });

  describe('create new pick', () => {
    it('returns 400 when required fields are missing', async () => {
      const res = await POST(makeUrlReq({ draftId: 'd1' }, 'http://x/api/draft-picks'));
      expect(unwrap(res).status).toBe(400);
    });

    it('returns 400 for an invalid team', async () => {
      const res = await POST(makeUrlReq({ draftId: 'd1', playerId: 'p1', team: 'C' }, 'http://x/api/draft-picks'));
      expect(unwrap(res).status).toBe(400);
      expect(unwrap(res).body.error).toMatch(/team must be one of/);
    });

    it('returns 409 when player already drafted (P2002)', async () => {
      const err = Object.assign(new Error('unique'), { code: 'P2002' });
      prisma.draftPick.create.mockRejectedValue(err);
      const res = await POST(makeUrlReq({ draftId: 'd1', playerId: 'p1', team: 'A' }, 'http://x/api/draft-picks'));
      expect(unwrap(res).status).toBe(409);
    });

    it('creates the pick, bumps draft version, and syncs lobby state', async () => {
      const created = { id: 'p1', draftId: 'd1', playerId: 'player-1', team: 'A', pickOrder: 0 };
      prisma.draftPick.create.mockResolvedValue(created);
      prisma.draft.update.mockResolvedValue({});
      const res = await POST(makeUrlReq({ draftId: 'd1', playerId: 'player-1', team: 'A' }, 'http://x/api/draft-picks'));
      expect(unwrap(res).status).toBe(201);
      expect(unwrap(res).body).toEqual(created);
      expect(prisma.draft.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'd1' } })
      );
      expect(syncDraftLobbyState).toHaveBeenCalledWith('d1');
    });

    it('returns 500 on unexpected create error', async () => {
      prisma.draftPick.create.mockRejectedValue(new Error('boom'));
      const res = await POST(makeUrlReq({ draftId: 'd1', playerId: 'p1', team: 'A' }, 'http://x/api/draft-picks'));
      expect(unwrap(res).status).toBe(500);
    });
  });

  describe('update existing pick (legacy admin)', () => {
    it('returns 400 for an invalid team on update', async () => {
      const res = await POST(makeUrlReq({ id: 'p1', team: 'Z' }, 'http://x/api/draft-picks'));
      expect(unwrap(res).status).toBe(400);
    });

    it('returns 409 when the god is already picked in this draft', async () => {
      prisma.draftPick.findUnique.mockResolvedValue({ draftId: 'd1' });
      prisma.draftPick.findFirst.mockResolvedValue({ id: 'other-pick' });
      const res = await POST(makeUrlReq({ id: 'p1', godId: 'zeus' }, 'http://x/api/draft-picks'));
      expect(unwrap(res).status).toBe(409);
    });

    it('updates the pick, bumps version, and syncs lobby state', async () => {
      prisma.draftPick.findUnique.mockResolvedValue({ draftId: 'd1' });
      prisma.draftPick.findFirst.mockResolvedValue(null);
      const updated = { id: 'p1', draftId: 'd1', godId: 'zeus' };
      prisma.draftPick.update.mockResolvedValue(updated);
      prisma.draft.update.mockResolvedValue({});
      const res = await POST(makeUrlReq({ id: 'p1', godId: 'zeus' }, 'http://x/api/draft-picks'));
      expect(unwrap(res).status).toBe(200);
      expect(unwrap(res).body).toEqual(updated);
      expect(syncDraftLobbyState).toHaveBeenCalledWith('d1');
    });

    it('allows clearing godId with an empty string', async () => {
      prisma.draftPick.findUnique.mockResolvedValue({ draftId: 'd1' });
      const updated = { id: 'p1', draftId: 'd1', godId: null };
      prisma.draftPick.update.mockResolvedValue(updated);
      prisma.draft.update.mockResolvedValue({});
      const res = await POST(makeUrlReq({ id: 'p1', godId: '' }, 'http://x/api/draft-picks'));
      expect(unwrap(res).status).toBe(200);
      expect(prisma.draftPick.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ godId: null }) })
      );
    });
  });
});

// ─── DELETE ──────────────────────────────────────────────────────────────────
describe('DELETE /api/draft-picks', () => {
  it('returns the admin guard response when not authorized', async () => {
    const guard = { _body: { error: 'Admin authentication required' }, _status: 401 };
    resolveAdminAuth.mockResolvedValue(guard);
    const res = await DELETE(makeUrlReq(null, 'http://x/api/draft-picks?id=p1'));
    expect(res).toBe(guard);
  });

  it('returns 400 when neither id nor draftId+clear are given', async () => {
    const res = await DELETE(makeUrlReq(null, 'http://x/api/draft-picks'));
    expect(unwrap(res).status).toBe(400);
  });

  it('clears all picks for a draft when clear=true', async () => {
    prisma.draftPick.deleteMany.mockResolvedValue({ count: 5 });
    prisma.draft.update.mockResolvedValue({});
    const res = await DELETE(makeUrlReq(null, 'http://x/api/draft-picks?draftId=d1&clear=true'));
    expect(unwrap(res).status).toBe(200);
    expect(unwrap(res).body).toEqual({ ok: true, cleared: 'd1' });
    expect(syncDraftLobbyState).toHaveBeenCalledWith('d1');
  });

  it('deletes a single pick by id', async () => {
    prisma.draftPick.delete.mockResolvedValue({ id: 'p1', draftId: 'd1' });
    prisma.draft.update.mockResolvedValue({});
    const res = await DELETE(makeUrlReq(null, 'http://x/api/draft-picks?id=p1'));
    expect(unwrap(res).status).toBe(200);
    expect(syncDraftLobbyState).toHaveBeenCalledWith('d1');
  });

  it('returns 500 on delete failure', async () => {
    prisma.draftPick.delete.mockRejectedValue(new Error('boom'));
    const res = await DELETE(makeUrlReq(null, 'http://x/api/draft-picks?id=p1'));
    expect(unwrap(res).status).toBe(500);
  });
});
