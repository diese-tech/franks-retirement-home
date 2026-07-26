/**
 * API tests for /api/teams/[id]/members
 * Covers: GET (list current+past members), POST (admin add member)
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
    teamMember: { findMany: vi.fn(), create: vi.fn() },
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
const { GET, POST } = await import('@/app/api/teams/[id]/members/route.js');

const PARAMS = { params: { id: 'team-1' } };
const MEMBER = { id: 'mem-1', teamId: 'team-1', playerId: 'p1', role: 'Mid' };

beforeEach(() => {
  vi.clearAllMocks();
  resolveAdminAuth.mockResolvedValue(null);
});

describe('GET /api/teams/[id]/members', () => {
  it('lists members for the team', async () => {
    prisma.teamMember.findMany.mockResolvedValueOnce([MEMBER]);
    const res = await GET({}, PARAMS);
    expect(unwrap(res).status).toBe(200);
    expect(prisma.teamMember.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { teamId: 'team-1' } })
    );
  });

  it('reports and returns 500 on db failure', async () => {
    const dbErr = new Error('db down');
    prisma.teamMember.findMany.mockRejectedValueOnce(dbErr);
    const res = await GET({}, PARAMS);
    expect(unwrap(res).status).toBe(500);
    expect(reportServerError).toHaveBeenCalledWith(dbErr, { route: 'teams/[id]/members GET' });
  });
});

describe('POST /api/teams/[id]/members', () => {
  it('returns 401 when not authorized', async () => {
    resolveAdminAuth.mockResolvedValueOnce({ _body: { error: 'Unauthorized' }, _status: 401 });
    const res = await POST(makeReq({ playerId: 'p1', role: 'Mid' }), PARAMS);
    expect(res._status).toBe(401);
  });

  it('returns 400 for malformed JSON', async () => {
    const res = await POST(makeInvalidJsonReq(), PARAMS);
    expect(unwrap(res).status).toBe(400);
  });

  it('requires playerId and role', async () => {
    const res = await POST(makeReq({ playerId: 'p1' }), PARAMS);
    expect(unwrap(res).status).toBe(400);
  });

  it('adds a member, defaulting isCaptain/isSub to false, and logs audit', async () => {
    prisma.teamMember.create.mockResolvedValueOnce(MEMBER);
    const res = await POST(makeReq({ playerId: 'p1', role: 'Mid' }), PARAMS);
    expect(unwrap(res).status).toBe(201);
    expect(prisma.teamMember.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ isCaptain: false, isSub: false }) })
    );
    expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({ entity: 'TeamMember', action: 'member_added' }));
  });

  it('returns 409 when the player is already a member', async () => {
    prisma.teamMember.create.mockRejectedValueOnce({ code: 'P2002' });
    const res = await POST(makeReq({ playerId: 'p1', role: 'Mid' }), PARAMS);
    expect(unwrap(res).status).toBe(409);
  });

  it('reports and returns 500 on unexpected db failure', async () => {
    const dbErr = new Error('db down');
    prisma.teamMember.create.mockRejectedValueOnce(dbErr);
    const res = await POST(makeReq({ playerId: 'p1', role: 'Mid' }), PARAMS);
    expect(unwrap(res).status).toBe(500);
    expect(reportServerError).toHaveBeenCalledWith(dbErr, { route: 'teams/[id]/members POST' });
  });
});
