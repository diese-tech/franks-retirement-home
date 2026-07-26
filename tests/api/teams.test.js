/**
 * API tests for /api/teams
 * Covers: GET (divisionId/seasonId filters), POST (admin create, validation)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeReq, makeInvalidJsonReq, unwrap } from './_helpers.js';

// ─── Mock next/server ────────────────────────────────────────────────────────
vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((body, init) => ({ _body: body, _status: init?.status ?? 200, headers: { set: vi.fn() } })),
  },
}));

// ─── Mock @/lib/db ───────────────────────────────────────────────────────────
vi.mock('@/lib/db', () => {
  const prisma = {
    team: { findMany: vi.fn(), create: vi.fn() },
  };
  return { default: prisma };
});

// ─── Mock @/lib/resolveAuth ──────────────────────────────────────────────────
vi.mock('@/lib/resolveAuth', () => ({
  resolveAdminAuth: vi.fn(async () => null),
}));

// ─── Mock @/lib/auditLog ──────────────────────────────────────────────────────
vi.mock('@/lib/auditLog', () => ({
  logAudit: vi.fn(),
}));

// ─── Mock @/lib/apiError ──────────────────────────────────────────────────────
vi.mock('@/lib/apiError', () => ({
  reportServerError: vi.fn(),
}));

const { default: prisma } = await import('@/lib/db');
const { resolveAdminAuth } = await import('@/lib/resolveAuth');
const { logAudit } = await import('@/lib/auditLog');
const { reportServerError } = await import('@/lib/apiError');
const { GET, POST } = await import('@/app/api/teams/route.js');

const TEAM = { id: 't1', name: 'Team A', tag: 'TMA', divisionId: 'div-1' };

beforeEach(() => {
  vi.clearAllMocks();
  resolveAdminAuth.mockResolvedValue(null);
});

describe('GET /api/teams', () => {
  it('lists all teams with no filters', async () => {
    prisma.team.findMany.mockResolvedValueOnce([TEAM]);
    const res = await GET({ url: 'http://localhost/api/teams' });
    expect(unwrap(res).status).toBe(200);
    expect(prisma.team.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
  });

  it('filters by divisionId', async () => {
    prisma.team.findMany.mockResolvedValueOnce([TEAM]);
    await GET({ url: 'http://localhost/api/teams?divisionId=div-1' });
    expect(prisma.team.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { divisionId: 'div-1' } })
    );
  });

  it('filters by seasonId via the division relation', async () => {
    prisma.team.findMany.mockResolvedValueOnce([TEAM]);
    await GET({ url: 'http://localhost/api/teams?seasonId=season-1' });
    expect(prisma.team.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { division: { seasonId: 'season-1' } } })
    );
  });

  it('reports and returns 500 on db failure', async () => {
    const dbErr = new Error('db down');
    prisma.team.findMany.mockRejectedValueOnce(dbErr);
    const res = await GET({ url: 'http://localhost/api/teams' });
    expect(unwrap(res).status).toBe(500);
    expect(reportServerError).toHaveBeenCalledWith(dbErr, { route: 'teams GET' });
  });
});

describe('POST /api/teams', () => {
  it('returns 401 when not authorized', async () => {
    resolveAdminAuth.mockResolvedValueOnce({ _body: { error: 'Unauthorized' }, _status: 401 });
    const res = await POST(makeReq({ divisionId: 'div-1', name: 'Team A', tag: 'TMA' }));
    expect(res._status).toBe(401);
  });

  it('returns 400 for malformed JSON', async () => {
    const res = await POST(makeInvalidJsonReq());
    expect(unwrap(res).status).toBe(400);
  });

  it('requires divisionId, name, and tag', async () => {
    const res = await POST(makeReq({ name: 'Team A' }));
    expect(unwrap(res).status).toBe(400);
  });

  it('rejects a name over 100 chars', async () => {
    const res = await POST(makeReq({ divisionId: 'div-1', name: 'x'.repeat(101), tag: 'TMA' }));
    expect(unwrap(res).status).toBe(400);
  });

  it('rejects a tag over 10 chars', async () => {
    const res = await POST(makeReq({ divisionId: 'div-1', name: 'Team A', tag: 'x'.repeat(11) }));
    expect(unwrap(res).status).toBe(400);
  });

  it('creates a team and logs an audit entry', async () => {
    prisma.team.create.mockResolvedValueOnce(TEAM);
    const res = await POST(makeReq({ divisionId: 'div-1', name: 'Team A', tag: 'TMA' }));
    expect(unwrap(res).status).toBe(201);
    expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({ entity: 'Team', action: 'team_created' }));
  });

  it('reports and returns 500 on db failure', async () => {
    const dbErr = new Error('db down');
    prisma.team.create.mockRejectedValueOnce(dbErr);
    const res = await POST(makeReq({ divisionId: 'div-1', name: 'Team A', tag: 'TMA' }));
    expect(unwrap(res).status).toBe(500);
    expect(reportServerError).toHaveBeenCalledWith(dbErr, { route: 'teams POST' });
  });
});
