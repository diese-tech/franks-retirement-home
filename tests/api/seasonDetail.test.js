/**
 * API tests for PATCH /api/seasons/[id]
 *
 * Only one season should ever be "active" — activating this season must
 * demote any other active season to "completed" in the same transaction.
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
    season: { update: vi.fn(), updateMany: vi.fn() },
    $transaction: vi.fn(),
  };
  return { default: prisma };
});

// ─── Mock @/lib/resolveAuth ──────────────────────────────────────────────────
vi.mock('@/lib/resolveAuth', () => ({
  resolveAdminAuth: vi.fn(async () => null),
}));

// ─── Mock @/lib/apiError ──────────────────────────────────────────────────────
vi.mock('@/lib/apiError', () => ({
  reportServerError: vi.fn(),
}));

const { default: prisma } = await import('@/lib/db');
const { resolveAdminAuth } = await import('@/lib/resolveAuth');
const { reportServerError } = await import('@/lib/apiError');
const { PATCH } = await import('@/app/api/seasons/[id]/route.js');

const PARAMS = { params: { id: 'season-1' } };
const SEASON = { id: 'season-1', name: 'Season 1', status: 'active' };

beforeEach(() => {
  vi.clearAllMocks();
  resolveAdminAuth.mockResolvedValue(null);
  prisma.$transaction.mockImplementation(async (ops) => Promise.all(ops));
});

describe('PATCH /api/seasons/[id]', () => {
  it('returns 401 when not authorized', async () => {
    resolveAdminAuth.mockResolvedValueOnce({ _body: { error: 'Unauthorized' }, _status: 401 });
    const res = await PATCH(makeReq({ name: 'New Name' }), PARAMS);
    expect(res._status).toBe(401);
  });

  it('returns 400 for malformed JSON', async () => {
    const res = await PATCH(makeInvalidJsonReq(), PARAMS);
    expect(unwrap(res).status).toBe(400);
  });

  it('returns 400 when no valid fields are given', async () => {
    const res = await PATCH(makeReq({}), PARAMS);
    expect(unwrap(res).status).toBe(400);
  });

  it('rejects an empty name', async () => {
    const res = await PATCH(makeReq({ name: '  ' }), PARAMS);
    expect(unwrap(res).status).toBe(400);
  });

  it('rejects an invalid status', async () => {
    const res = await PATCH(makeReq({ status: 'bogus' }), PARAMS);
    expect(unwrap(res).status).toBe(400);
  });

  it('rejects a non-positive currentWeek', async () => {
    const res = await PATCH(makeReq({ currentWeek: 0 }), PARAMS);
    expect(unwrap(res).status).toBe(400);
  });

  it('updates simple fields without a transaction', async () => {
    prisma.season.update.mockResolvedValueOnce({ ...SEASON, name: 'Renamed', status: 'upcoming' });
    const res = await PATCH(makeReq({ name: 'Renamed' }), PARAMS);
    expect(unwrap(res).status).toBe(200);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.season.update).toHaveBeenCalledWith({ where: { id: 'season-1' }, data: { name: 'Renamed' } });
  });

  it('demotes other active seasons to completed when activating this one', async () => {
    prisma.$transaction.mockResolvedValueOnce([{ count: 1 }, SEASON]);
    const res = await PATCH(makeReq({ status: 'active' }), PARAMS);
    expect(unwrap(res).status).toBe(200);
    expect(unwrap(res).body).toEqual(SEASON);
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Array));
  });

  it('scopes the demotion updateMany to other active seasons only', async () => {
    prisma.$transaction.mockImplementationOnce(async (ops) => Promise.all(ops));
    prisma.season.updateMany.mockResolvedValueOnce({ count: 1 });
    prisma.season.update.mockResolvedValueOnce(SEASON);
    await PATCH(makeReq({ status: 'active' }), PARAMS);
    expect(prisma.season.updateMany).toHaveBeenCalledWith({
      where: { status: 'active', id: { not: 'season-1' } },
      data: { status: 'completed' },
    });
  });

  it('parses startsAt/endsAt into Dates, or null when cleared', async () => {
    prisma.season.update.mockResolvedValueOnce(SEASON);
    await PATCH(makeReq({ startsAt: '2026-01-01T00:00:00.000Z', endsAt: null }), PARAMS);
    expect(prisma.season.update).toHaveBeenCalledWith({
      where: { id: 'season-1' },
      data: { startsAt: new Date('2026-01-01T00:00:00.000Z'), endsAt: null },
    });
  });

  it('returns 404 when the season does not exist', async () => {
    prisma.season.update.mockRejectedValueOnce({ code: 'P2025' });
    const res = await PATCH(makeReq({ name: 'Renamed' }), PARAMS);
    expect(unwrap(res).status).toBe(404);
  });

  it('reports and returns 500 on unexpected db failure', async () => {
    const dbErr = new Error('db down');
    prisma.season.update.mockRejectedValueOnce(dbErr);
    const res = await PATCH(makeReq({ name: 'Renamed' }), PARAMS);
    expect(unwrap(res).status).toBe(500);
    expect(reportServerError).toHaveBeenCalledWith(dbErr, { route: 'seasons/[id] PATCH' });
  });
});
