/**
 * API tests for /api/gods
 * Covers: GET (role filter), POST (create/update, validation), DELETE (live-draft guards)
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
    god: { findMany: vi.fn(), update: vi.fn(), create: vi.fn(), delete: vi.fn() },
    draftBan: { findFirst: vi.fn() },
    draftPick: { findFirst: vi.fn() },
  };
  return { default: prisma };
});

// ─── Mock @/lib/resolveAuth ──────────────────────────────────────────────────
vi.mock('@/lib/resolveAuth', () => ({
  resolveAdminAuth: vi.fn(async () => null),
}));

// ─── Mock @/lib/referenceData ────────────────────────────────────────────────
vi.mock('@/lib/referenceData', () => ({
  invalidateGods: vi.fn(),
}));

// ─── Mock @/lib/apiError ──────────────────────────────────────────────────────
vi.mock('@/lib/apiError', () => ({
  reportServerError: vi.fn(),
}));

const { default: prisma } = await import('@/lib/db');
const { resolveAdminAuth } = await import('@/lib/resolveAuth');
const { invalidateGods } = await import('@/lib/referenceData');
const { reportServerError } = await import('@/lib/apiError');
const { GET, POST, DELETE } = await import('@/app/api/gods/route.js');

const GOD = { id: 'god-1', name: 'Zeus', role: 'Mage', godClass: 'Magical' };

beforeEach(() => {
  vi.clearAllMocks();
  resolveAdminAuth.mockResolvedValue(null);
});

describe('GET /api/gods', () => {
  it('lists all gods without a role filter', async () => {
    prisma.god.findMany.mockResolvedValueOnce([GOD]);
    const res = await GET({ url: 'http://localhost/api/gods' });
    expect(unwrap(res).status).toBe(200);
    expect(unwrap(res).body).toEqual([GOD]);
  });

  it('rejects an invalid role filter with 400', async () => {
    const res = await GET({ url: 'http://localhost/api/gods?role=Bogus' });
    expect(unwrap(res).status).toBe(400);
    expect(prisma.god.findMany).not.toHaveBeenCalled();
  });

  it('filters by a valid role', async () => {
    prisma.god.findMany.mockResolvedValueOnce([GOD]);
    const res = await GET({ url: 'http://localhost/api/gods?role=Mage' });
    expect(unwrap(res).status).toBe(200);
    expect(prisma.god.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { role: 'Mage' } })
    );
  });

  it('reports and returns 500 on db failure', async () => {
    const dbErr = new Error('db down');
    prisma.god.findMany.mockRejectedValueOnce(dbErr);
    const res = await GET({ url: 'http://localhost/api/gods' });
    expect(unwrap(res).status).toBe(500);
    expect(reportServerError).toHaveBeenCalledWith(dbErr, { route: 'gods GET' });
  });
});

describe('POST /api/gods', () => {
  it('returns 401 when not authorized', async () => {
    resolveAdminAuth.mockResolvedValueOnce({ _body: { error: 'Unauthorized' }, _status: 401 });
    const res = await POST(makeReq({ name: 'Zeus', role: 'Mage', godClass: 'Magical' }));
    expect(res._status).toBe(401);
  });

  it('returns 400 for malformed JSON', async () => {
    const res = await POST(makeInvalidJsonReq());
    expect(unwrap(res).status).toBe(400);
  });

  it('rejects an empty name', async () => {
    const res = await POST(makeReq({ name: '  ', role: 'Mage', godClass: 'Magical' }));
    expect(unwrap(res).status).toBe(400);
  });

  it('rejects an invalid role', async () => {
    const res = await POST(makeReq({ name: 'Zeus', role: 'Bogus', godClass: 'Magical' }));
    expect(unwrap(res).status).toBe(400);
  });

  it('rejects an invalid godClass', async () => {
    const res = await POST(makeReq({ name: 'Zeus', role: 'Mage', godClass: 'Bogus' }));
    expect(unwrap(res).status).toBe(400);
  });

  it('creates a new god and invalidates the cache', async () => {
    prisma.god.create.mockResolvedValueOnce(GOD);
    const res = await POST(makeReq({ name: 'Zeus', role: 'Mage', godClass: 'Magical' }));
    expect(unwrap(res).status).toBe(201);
    expect(invalidateGods).toHaveBeenCalled();
  });

  it('updates an existing god when id is provided', async () => {
    prisma.god.update.mockResolvedValueOnce({ ...GOD, name: 'Zeus Updated' });
    const res = await POST(makeReq({ id: 'god-1', name: 'Zeus Updated', role: 'Mage', godClass: 'Magical' }));
    expect(unwrap(res).status).toBe(200);
    expect(prisma.god.update).toHaveBeenCalledWith({
      where: { id: 'god-1' },
      data: { name: 'Zeus Updated', role: 'Mage', godClass: 'Magical' },
    });
    expect(invalidateGods).toHaveBeenCalled();
  });

  it('reports and returns 500 on db failure', async () => {
    const dbErr = new Error('db down');
    prisma.god.create.mockRejectedValueOnce(dbErr);
    const res = await POST(makeReq({ name: 'Zeus', role: 'Mage', godClass: 'Magical' }));
    expect(unwrap(res).status).toBe(500);
    expect(reportServerError).toHaveBeenCalledWith(dbErr, { route: 'gods POST' });
  });
});

describe('DELETE /api/gods', () => {
  it('returns 401 when not authorized', async () => {
    resolveAdminAuth.mockResolvedValueOnce({ _body: { error: 'Unauthorized' }, _status: 401 });
    const res = await DELETE({ url: 'http://localhost/api/gods?id=god-1' });
    expect(res._status).toBe(401);
  });

  it('requires an id', async () => {
    const res = await DELETE({ url: 'http://localhost/api/gods' });
    expect(unwrap(res).status).toBe(400);
  });

  it('blocks deletion when the god is banned in a live draft', async () => {
    prisma.draftBan.findFirst.mockResolvedValueOnce({ id: 'ban-1' });
    const res = await DELETE({ url: 'http://localhost/api/gods?id=god-1' });
    expect(unwrap(res).status).toBe(409);
    expect(prisma.god.delete).not.toHaveBeenCalled();
  });

  it('blocks deletion when the god is picked in a live draft', async () => {
    prisma.draftBan.findFirst.mockResolvedValueOnce(null);
    prisma.draftPick.findFirst.mockResolvedValueOnce({ id: 'pick-1' });
    const res = await DELETE({ url: 'http://localhost/api/gods?id=god-1' });
    expect(unwrap(res).status).toBe(409);
    expect(prisma.god.delete).not.toHaveBeenCalled();
  });

  it('deletes the god and invalidates the cache when unreferenced', async () => {
    prisma.draftBan.findFirst.mockResolvedValueOnce(null);
    prisma.draftPick.findFirst.mockResolvedValueOnce(null);
    const res = await DELETE({ url: 'http://localhost/api/gods?id=god-1' });
    expect(unwrap(res).status).toBe(200);
    expect(prisma.god.delete).toHaveBeenCalledWith({ where: { id: 'god-1' } });
    expect(invalidateGods).toHaveBeenCalled();
  });

  it('reports and returns 500 on db failure', async () => {
    const dbErr = new Error('db down');
    prisma.draftBan.findFirst.mockRejectedValueOnce(dbErr);
    const res = await DELETE({ url: 'http://localhost/api/gods?id=god-1' });
    expect(unwrap(res).status).toBe(500);
    expect(reportServerError).toHaveBeenCalledWith(dbErr, { route: 'gods DELETE' });
  });
});
