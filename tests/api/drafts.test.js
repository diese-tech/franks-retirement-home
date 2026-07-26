/**
 * API tests for GET/POST/DELETE /api/drafts
 * GET is the public list (uses PUBLIC_DRAFT_SELECT — no keys).
 * POST creates a draft (with 3 auto-generated keys) or updates status.
 * DELETE removes a draft by `?id=` query param.
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
    draft: { findMany: vi.fn(), update: vi.fn(), create: vi.fn(), delete: vi.fn() },
    draftPick: { count: vi.fn() },
  };
  return { default: prisma };
});

// ─── Mock @/lib/resolveAuth ──────────────────────────────────────────────────
vi.mock('@/lib/resolveAuth', () => ({
  resolveAdminAuth: vi.fn(),
}));

const { default: prisma } = await import('@/lib/db');
const { resolveAdminAuth } = await import('@/lib/resolveAuth');
const { GET, POST, DELETE } = await import('@/app/api/drafts/route.js');

function makeUrlReq(body, url) {
  return { json: () => Promise.resolve(body), url };
}

beforeEach(() => {
  vi.clearAllMocks();
  resolveAdminAuth.mockResolvedValue(null); // authorized
});

// ─── GET ─────────────────────────────────────────────────────────────────────
describe('GET /api/drafts (public list)', () => {
  it('does not require admin auth', async () => {
    prisma.draft.findMany.mockResolvedValue([]);
    const res = await GET(makeUrlReq(null, 'http://x/api/drafts'));
    expect(unwrap(res).status).toBe(200);
    expect(resolveAdminAuth).not.toHaveBeenCalled();
  });

  it('uses the public select (never selects raw keys)', async () => {
    prisma.draft.findMany.mockResolvedValue([]);
    await GET(makeUrlReq(null, 'http://x/api/drafts'));
    const callArg = prisma.draft.findMany.mock.calls[0][0];
    expect(callArg.select).toBeDefined();
    expect(callArg.select.adminKey).toBeUndefined();
    expect(callArg.select.captainAKey).toBeUndefined();
    expect(callArg.select.captainBKey).toBeUndefined();
  });

  it('returns 400 for an invalid status filter', async () => {
    const res = await GET(makeUrlReq(null, 'http://x/api/drafts?status=bogus'));
    expect(unwrap(res).status).toBe(400);
  });

  it('clamps limit to MAX_LIMIT (100)', async () => {
    prisma.draft.findMany.mockResolvedValue([]);
    await GET(makeUrlReq(null, 'http://x/api/drafts?limit=99999'));
    expect(prisma.draft.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100 })
    );
  });

  it('returns 500 on DB error', async () => {
    prisma.draft.findMany.mockRejectedValue(new Error('db down'));
    const res = await GET(makeUrlReq(null, 'http://x/api/drafts'));
    expect(unwrap(res).status).toBe(500);
  });
});

// ─── POST ────────────────────────────────────────────────────────────────────
describe('POST /api/drafts', () => {
  it('returns the admin guard response when not authorized', async () => {
    const guard = { _body: { error: 'Admin authentication required' }, _status: 401 };
    resolveAdminAuth.mockResolvedValue(guard);
    const res = await POST(makeUrlReq({}, 'http://x/api/drafts'));
    expect(res).toBe(guard);
  });

  it('returns 400 for invalid JSON', async () => {
    const req = { json: () => { throw new SyntaxError('bad'); }, url: 'http://x/api/drafts' };
    const res = await POST(req);
    expect(unwrap(res).status).toBe(400);
  });

  describe('create', () => {
    it('creates a draft with 3 auto-generated keys', async () => {
      const created = { id: 'new-1', name: 'Draft', captainAKey: 'a', captainBKey: 'b', adminKey: 'c', version: 0 };
      prisma.draft.create.mockResolvedValue(created);
      const res = await POST(makeUrlReq({}, 'http://x/api/drafts'));
      expect(unwrap(res).status).toBe(201);
      expect(unwrap(res).body).toEqual(created);
      const callArg = prisma.draft.create.mock.calls[0][0];
      expect(callArg.data.captainAKey).toBeTruthy();
      expect(callArg.data.captainBKey).toBeTruthy();
      expect(callArg.data.adminKey).toBeTruthy();
    });

    it('uses a provided name, trimmed and length-capped', async () => {
      prisma.draft.create.mockResolvedValue({});
      await POST(makeUrlReq({ name: '  My Draft  ' }, 'http://x/api/drafts'));
      const callArg = prisma.draft.create.mock.calls[0][0];
      expect(callArg.data.name).toBe('My Draft');
    });

    it('returns 500 on create failure', async () => {
      prisma.draft.create.mockRejectedValue(new Error('boom'));
      const res = await POST(makeUrlReq({}, 'http://x/api/drafts'));
      expect(unwrap(res).status).toBe(500);
    });
  });

  describe('status update', () => {
    it('returns 400 for an invalid status', async () => {
      const res = await POST(makeUrlReq({ id: 'd1', status: 'bogus' }, 'http://x/api/drafts'));
      expect(unwrap(res).status).toBe(400);
    });

    it('returns 400 when opening the lobby without exactly 5+5 players', async () => {
      prisma.draftPick.count.mockResolvedValueOnce(3).mockResolvedValueOnce(5);
      const res = await POST(makeUrlReq({ id: 'd1', status: 'lobby' }, 'http://x/api/drafts'));
      expect(unwrap(res).status).toBe(400);
      expect(unwrap(res).body.error).toMatch(/exactly 5 players/);
    });

    it('allows opening the lobby with exactly 5+5 players', async () => {
      prisma.draftPick.count.mockResolvedValueOnce(5).mockResolvedValueOnce(5);
      const updated = { id: 'd1', status: 'lobby' };
      prisma.draft.update.mockResolvedValue(updated);
      const res = await POST(makeUrlReq({ id: 'd1', status: 'lobby' }, 'http://x/api/drafts'));
      expect(unwrap(res).status).toBe(200);
      expect(unwrap(res).body).toEqual(updated);
    });

    it('updates status without the team-size check for other statuses', async () => {
      const updated = { id: 'd1', status: 'pending' };
      prisma.draft.update.mockResolvedValue(updated);
      const res = await POST(makeUrlReq({ id: 'd1', status: 'pending' }, 'http://x/api/drafts'));
      expect(unwrap(res).status).toBe(200);
      expect(prisma.draftPick.count).not.toHaveBeenCalled();
    });

    it('returns 500 on update failure', async () => {
      prisma.draft.update.mockRejectedValue(new Error('boom'));
      const res = await POST(makeUrlReq({ id: 'd1', status: 'pending' }, 'http://x/api/drafts'));
      expect(unwrap(res).status).toBe(500);
    });
  });
});

// ─── DELETE ──────────────────────────────────────────────────────────────────
describe('DELETE /api/drafts?id=xxx', () => {
  it('returns the admin guard response when not authorized', async () => {
    const guard = { _body: { error: 'Admin authentication required' }, _status: 401 };
    resolveAdminAuth.mockResolvedValue(guard);
    const res = await DELETE(makeUrlReq(null, 'http://x/api/drafts?id=d1'));
    expect(res).toBe(guard);
  });

  it('returns 400 when id query param is missing', async () => {
    const res = await DELETE(makeUrlReq(null, 'http://x/api/drafts'));
    expect(unwrap(res).status).toBe(400);
    expect(unwrap(res).body.error).toMatch(/id required/i);
  });

  it('deletes the draft identified by the id query param', async () => {
    prisma.draft.delete.mockResolvedValue({ id: 'd1' });
    const res = await DELETE(makeUrlReq(null, 'http://x/api/drafts?id=d1'));
    expect(unwrap(res).status).toBe(200);
    expect(unwrap(res).body).toEqual({ ok: true });
    expect(prisma.draft.delete).toHaveBeenCalledWith({ where: { id: 'd1' } });
  });

  it('returns 500 on delete failure', async () => {
    prisma.draft.delete.mockRejectedValue(new Error('boom'));
    const res = await DELETE(makeUrlReq(null, 'http://x/api/drafts?id=d1'));
    expect(unwrap(res).status).toBe(500);
  });
});
