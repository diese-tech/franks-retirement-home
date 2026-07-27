/**
 * API tests for GET /api/drafts/admin
 * Gated by resolveAdminAuth — returns drafts INCLUDING admin/captain keys,
 * used by the AdminClient share modal. Never used for public listing.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { unwrap } from './_helpers.js';

// ─── Mock next/server ────────────────────────────────────────────────────────
vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((body, init) => ({ _body: body, _status: init?.status ?? 200 })),
  },
}));

// ─── Mock @/lib/db ───────────────────────────────────────────────────────────
vi.mock('@/lib/db', () => {
  const prisma = {
    draft: { findUnique: vi.fn(), findMany: vi.fn() },
  };
  return { default: prisma };
});

// ─── Mock @/lib/resolveAuth ──────────────────────────────────────────────────
vi.mock('@/lib/resolveAuth', () => ({
  resolveAdminAuth: vi.fn(),
}));

const { default: prisma } = await import('@/lib/db');
const { resolveAdminAuth } = await import('@/lib/resolveAuth');
const { GET } = await import('@/app/api/drafts/admin/route.js');

function makeUrlReq(url) {
  return { url };
}

const DRAFT_WITH_KEYS = {
  id: 'd1',
  name: 'Draft 1',
  status: 'lobby',
  adminKey: 'super-secret-admin-key',
  captainAKey: 'cap-a-secret',
  captainBKey: 'cap-b-secret',
};

beforeEach(() => {
  vi.clearAllMocks();
  resolveAdminAuth.mockResolvedValue(null); // authorized
});

describe('GET /api/drafts/admin', () => {
  it('returns the admin guard response when not authorized', async () => {
    const guard = { _body: { error: 'Admin authentication required' }, _status: 401 };
    resolveAdminAuth.mockResolvedValue(guard);
    const res = await GET(makeUrlReq('http://x/api/drafts/admin'));
    expect(res).toBe(guard);
  });

  it('returns 404 for a single draft that does not exist', async () => {
    prisma.draft.findUnique.mockResolvedValue(null);
    const res = await GET(makeUrlReq('http://x/api/drafts/admin?id=missing'));
    expect(unwrap(res).status).toBe(404);
  });

  it('returns a single draft INCLUDING keys when id is given', async () => {
    prisma.draft.findUnique.mockResolvedValue(DRAFT_WITH_KEYS);
    const res = await GET(makeUrlReq('http://x/api/drafts/admin?id=d1'));
    expect(unwrap(res).status).toBe(200);
    expect(unwrap(res).body).toEqual(DRAFT_WITH_KEYS);
    expect(unwrap(res).body.adminKey).toBe('super-secret-admin-key');
  });

  it('returns the list form INCLUDING keys, paginated by default limit', async () => {
    prisma.draft.findMany.mockResolvedValue([DRAFT_WITH_KEYS]);
    const res = await GET(makeUrlReq('http://x/api/drafts/admin'));
    expect(unwrap(res).status).toBe(200);
    expect(unwrap(res).body[0].adminKey).toBe('super-secret-admin-key');
    expect(prisma.draft.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100 })
    );
  });

  it('clamps limit to MAX_LIMIT (200)', async () => {
    prisma.draft.findMany.mockResolvedValue([]);
    await GET(makeUrlReq('http://x/api/drafts/admin?limit=9999'));
    expect(prisma.draft.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 200 })
    );
  });

  it('falls back to default limit for a non-numeric limit', async () => {
    prisma.draft.findMany.mockResolvedValue([]);
    await GET(makeUrlReq('http://x/api/drafts/admin?limit=notanumber'));
    expect(prisma.draft.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100 })
    );
  });

  it('returns 400 for an invalid status filter', async () => {
    const res = await GET(makeUrlReq('http://x/api/drafts/admin?status=bogus'));
    expect(unwrap(res).status).toBe(400);
  });

  it('filters by a valid status', async () => {
    prisma.draft.findMany.mockResolvedValue([]);
    await GET(makeUrlReq('http://x/api/drafts/admin?status=lobby'));
    expect(prisma.draft.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'lobby' } })
    );
  });

  it('returns 500 on DB error', async () => {
    prisma.draft.findMany.mockRejectedValue(new Error('db down'));
    const res = await GET(makeUrlReq('http://x/api/drafts/admin'));
    expect(unwrap(res).status).toBe(500);
  });
});
