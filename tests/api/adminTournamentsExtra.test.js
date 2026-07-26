/**
 * Supplementary API tests for the Tournament bracket routes, covering
 * branches NOT already exercised by tests/api/tournaments.test.js (which
 * runs a full bracket lifecycle through an in-memory fake db):
 *
 *   - GET /api/admin/tournaments            (admin listing — untested there)
 *   - PATCH /api/admin/tournaments/[id]     (invalid JSON / invalid action /
 *                                             404 / delete action / 500 path)
 *   - GET /api/tournaments                  (public list — 500 path)
 *   - GET /api/tournaments/[id]/state       (500 path)
 *
 * Uses plain vi.fn() prisma mocks (not the fake db from tournaments.test.js)
 * since these are isolated edge cases that don't need real bracket state.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeReq, makeInvalidJsonReq, unwrap } from './_helpers.js';

vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((body, init) => ({ _body: body, _status: init?.status ?? 200 })),
  },
}));

vi.mock('@/lib/resolveAuth', () => ({
  resolveAdminAuth: vi.fn(),
}));

vi.mock('@/lib/db', () => {
  const prisma = {
    tournament: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
  };
  return { default: prisma };
});

vi.mock('@/lib/tournamentState', () => ({
  buildTournamentState: vi.fn(),
}));

const { default: prisma } = await import('@/lib/db');
const { resolveAdminAuth } = await import('@/lib/resolveAuth');
const { buildTournamentState } = await import('@/lib/tournamentState');
const { GET: adminListGET } = await import('@/app/api/admin/tournaments/route.js');
const { PATCH: adminPatch } = await import('@/app/api/admin/tournaments/[id]/route.js');
const { GET: publicListGET } = await import('@/app/api/tournaments/route.js');
const { GET: stateGET } = await import('@/app/api/tournaments/[id]/state/route.js');

beforeEach(() => {
  vi.clearAllMocks();
  resolveAdminAuth.mockResolvedValue(null);
});

describe('GET /api/admin/tournaments', () => {
  it('returns 401 when not authorized', async () => {
    resolveAdminAuth.mockResolvedValue({ _body: { error: 'Unauthorized' }, _status: 401 });
    const res = await adminListGET({});
    expect(unwrap(res).status).toBe(401);
  });

  it('returns every tournament regardless of status, newest first', async () => {
    prisma.tournament.findMany.mockResolvedValue([{ id: 't1', status: 'draft' }, { id: 't2', status: 'live' }]);
    const res = await adminListGET({});
    expect(unwrap(res).status).toBe(200);
    expect(unwrap(res).body).toHaveLength(2);
    expect(prisma.tournament.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: 'desc' } })
    );
  });

  it('returns 500 on a database error', async () => {
    prisma.tournament.findMany.mockRejectedValue(new Error('db down'));
    const res = await adminListGET({});
    expect(unwrap(res).status).toBe(500);
  });
});

describe('PATCH /api/admin/tournaments/[id] — edge cases', () => {
  const PARAMS = { params: { id: 't1' } };

  it('returns 400 for invalid JSON', async () => {
    const res = await adminPatch(makeInvalidJsonReq(), PARAMS);
    expect(unwrap(res).status).toBe(400);
  });

  it('returns 400 for an action outside the allowed set', async () => {
    const res = await adminPatch(makeReq({ action: 'nuke' }), PARAMS);
    expect(unwrap(res).status).toBe(400);
    expect(unwrap(res).body.error).toMatch(/action must be one of/i);
  });

  it('returns 404 when the tournament does not exist', async () => {
    prisma.tournament.findUnique.mockResolvedValue(null);
    const res = await adminPatch(makeReq({ action: 'publish' }), PARAMS);
    expect(unwrap(res).status).toBe(404);
  });

  it('deletes the tournament for the delete action (cascade handled by the schema)', async () => {
    prisma.tournament.findUnique.mockResolvedValue({ id: 't1', status: 'draft' });
    prisma.tournament.delete.mockResolvedValue({ id: 't1' });
    const res = await adminPatch(makeReq({ action: 'delete' }), PARAMS);
    expect(unwrap(res).status).toBe(200);
    expect(unwrap(res).body).toEqual({ ok: true });
    expect(prisma.tournament.delete).toHaveBeenCalledWith({ where: { id: 't1' } });
  });

  it('surfaces an unexpected internal error as a 500', async () => {
    prisma.tournament.findUnique.mockResolvedValue({ id: 't1', status: 'draft' });
    prisma.tournament.delete.mockRejectedValue(new Error('connection reset'));
    const res = await adminPatch(makeReq({ action: 'delete' }), PARAMS);
    expect(unwrap(res).status).toBe(500);
  });
});

describe('GET /api/tournaments (public list)', () => {
  it('returns only live/completed tournaments', async () => {
    prisma.tournament.findMany.mockResolvedValue([{ id: 't1', status: 'live' }]);
    const res = await publicListGET();
    expect(unwrap(res).status).toBe(200);
    expect(prisma.tournament.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: { in: ['live', 'completed'] } } })
    );
  });

  it('returns 500 on a database error', async () => {
    prisma.tournament.findMany.mockRejectedValue(new Error('db down'));
    const res = await publicListGET();
    expect(unwrap(res).status).toBe(500);
  });
});

describe('GET /api/tournaments/[id]/state', () => {
  const PARAMS = { params: Promise.resolve({ id: 't1' }) };

  it('returns 404 for a missing or draft tournament', async () => {
    buildTournamentState.mockResolvedValue(null);
    const res = await stateGET({}, PARAMS);
    expect(unwrap(res).status).toBe(404);
  });

  it('returns the sanitized state on success', async () => {
    buildTournamentState.mockResolvedValue({ tournament: { id: 't1', status: 'live' }, matches: [] });
    const res = await stateGET({}, PARAMS);
    expect(unwrap(res).status).toBe(200);
  });

  it('returns 500 when buildTournamentState throws', async () => {
    buildTournamentState.mockRejectedValue(new Error('db down'));
    const res = await stateGET({}, PARAMS);
    expect(unwrap(res).status).toBe(500);
  });
});
