/**
 * API tests for /api/teams/[id]
 * Covers: GET (single team), PATCH (admin update), DELETE (admin delete)
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
    team: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
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
const { GET, PATCH, DELETE } = await import('@/app/api/teams/[id]/route.js');

const PARAMS = { params: { id: 'team-1' } };
const TEAM = { id: 'team-1', name: 'Team A', tag: 'TMA' };

beforeEach(() => {
  vi.clearAllMocks();
  resolveAdminAuth.mockResolvedValue(null);
});

describe('GET /api/teams/[id]', () => {
  it('returns the team', async () => {
    prisma.team.findUnique.mockResolvedValueOnce(TEAM);
    const res = await GET({}, PARAMS);
    expect(unwrap(res).status).toBe(200);
    expect(unwrap(res).body).toEqual(TEAM);
  });

  it('returns 404 when the team does not exist', async () => {
    prisma.team.findUnique.mockResolvedValueOnce(null);
    const res = await GET({}, PARAMS);
    expect(unwrap(res).status).toBe(404);
  });

  it('reports and returns 500 on db failure', async () => {
    const dbErr = new Error('db down');
    prisma.team.findUnique.mockRejectedValueOnce(dbErr);
    const res = await GET({}, PARAMS);
    expect(unwrap(res).status).toBe(500);
    expect(reportServerError).toHaveBeenCalledWith(dbErr, { route: 'teams/[id] GET' });
  });
});

describe('PATCH /api/teams/[id]', () => {
  it('returns 401 when not authorized', async () => {
    resolveAdminAuth.mockResolvedValueOnce({ _body: { error: 'Unauthorized' }, _status: 401 });
    const res = await PATCH(makeReq({ name: 'New Name' }), PARAMS);
    expect(res._status).toBe(401);
  });

  it('returns 400 for malformed JSON', async () => {
    const res = await PATCH(makeInvalidJsonReq(), PARAMS);
    expect(unwrap(res).status).toBe(400);
  });

  it('rejects clearing the tag to empty', async () => {
    const res = await PATCH(makeReq({ tag: '  ' }), PARAMS);
    expect(unwrap(res).status).toBe(400);
  });

  it('updates the team, uppercasing the tag', async () => {
    prisma.team.update.mockResolvedValueOnce({ ...TEAM, tag: 'TMB' });
    const res = await PATCH(makeReq({ tag: 'tmb' }), PARAMS);
    expect(unwrap(res).status).toBe(200);
    expect(prisma.team.update).toHaveBeenCalledWith({
      where: { id: 'team-1' },
      data: expect.objectContaining({ tag: 'TMB' }),
    });
  });

  it('returns 404 when the team does not exist', async () => {
    prisma.team.update.mockRejectedValueOnce({ code: 'P2025' });
    const res = await PATCH(makeReq({ name: 'New Name' }), PARAMS);
    expect(unwrap(res).status).toBe(404);
  });

  it('reports and returns 500 on unexpected db failure', async () => {
    const dbErr = new Error('db down');
    prisma.team.update.mockRejectedValueOnce(dbErr);
    const res = await PATCH(makeReq({ name: 'New Name' }), PARAMS);
    expect(unwrap(res).status).toBe(500);
    expect(reportServerError).toHaveBeenCalledWith(dbErr, { route: 'teams/[id] PATCH' });
  });
});

describe('DELETE /api/teams/[id]', () => {
  it('returns 401 when not authorized', async () => {
    resolveAdminAuth.mockResolvedValueOnce({ _body: { error: 'Unauthorized' }, _status: 401 });
    const res = await DELETE({}, PARAMS);
    expect(res._status).toBe(401);
  });

  it('deletes the team', async () => {
    prisma.team.delete.mockResolvedValueOnce(TEAM);
    const res = await DELETE({}, PARAMS);
    expect(unwrap(res).status).toBe(200);
    expect(unwrap(res).body.ok).toBe(true);
  });

  it('returns 404 when the team does not exist', async () => {
    prisma.team.delete.mockRejectedValueOnce({ code: 'P2025' });
    const res = await DELETE({}, PARAMS);
    expect(unwrap(res).status).toBe(404);
  });

  it('reports and returns 500 on unexpected db failure', async () => {
    const dbErr = new Error('db down');
    prisma.team.delete.mockRejectedValueOnce(dbErr);
    const res = await DELETE({}, PARAMS);
    expect(unwrap(res).status).toBe(500);
    expect(reportServerError).toHaveBeenCalledWith(dbErr, { route: 'teams/[id] DELETE' });
  });
});
