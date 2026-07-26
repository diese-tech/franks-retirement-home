/**
 * API tests for /api/teams/[id]/members/[memberId]
 * Covers: PATCH (admin update role/captain/sub/leftAt), DELETE (admin remove)
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
    teamMember: { update: vi.fn(), delete: vi.fn() },
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
const { PATCH, DELETE } = await import('@/app/api/teams/[id]/members/[memberId]/route.js');

const PARAMS = { params: { id: 'team-1', memberId: 'mem-1' } };
const MEMBER = { id: 'mem-1', teamId: 'team-1', playerId: 'p1', role: 'Mid' };

beforeEach(() => {
  vi.clearAllMocks();
  resolveAdminAuth.mockResolvedValue(null);
});

describe('PATCH /api/teams/[id]/members/[memberId]', () => {
  it('returns 401 when not authorized', async () => {
    resolveAdminAuth.mockResolvedValueOnce({ _body: { error: 'Unauthorized' }, _status: 401 });
    const res = await PATCH(makeReq({ role: 'Carry' }), PARAMS);
    expect(res._status).toBe(401);
  });

  it('returns 400 for malformed JSON', async () => {
    const res = await PATCH(makeInvalidJsonReq(), PARAMS);
    expect(unwrap(res).status).toBe(400);
  });

  it('updates the member', async () => {
    prisma.teamMember.update.mockResolvedValueOnce({ ...MEMBER, role: 'Carry' });
    const res = await PATCH(makeReq({ role: 'Carry' }), PARAMS);
    expect(unwrap(res).status).toBe(200);
    expect(prisma.teamMember.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'mem-1' } })
    );
  });

  it('sets leftAt to remove a member from active rosters', async () => {
    prisma.teamMember.update.mockResolvedValueOnce({ ...MEMBER, leftAt: new Date('2026-01-01') });
    const res = await PATCH(makeReq({ leftAt: '2026-01-01T00:00:00.000Z' }), PARAMS);
    expect(unwrap(res).status).toBe(200);
    expect(prisma.teamMember.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ leftAt: '2026-01-01T00:00:00.000Z' }) })
    );
  });

  it('returns 404 when the member does not exist', async () => {
    prisma.teamMember.update.mockRejectedValueOnce({ code: 'P2025' });
    const res = await PATCH(makeReq({ role: 'Carry' }), PARAMS);
    expect(unwrap(res).status).toBe(404);
  });

  it('reports and returns 500 on unexpected db failure', async () => {
    const dbErr = new Error('db down');
    prisma.teamMember.update.mockRejectedValueOnce(dbErr);
    const res = await PATCH(makeReq({ role: 'Carry' }), PARAMS);
    expect(unwrap(res).status).toBe(500);
    expect(reportServerError).toHaveBeenCalledWith(dbErr, { route: 'teams/[id]/members/[memberId] PATCH' });
  });
});

describe('DELETE /api/teams/[id]/members/[memberId]', () => {
  it('returns 401 when not authorized', async () => {
    resolveAdminAuth.mockResolvedValueOnce({ _body: { error: 'Unauthorized' }, _status: 401 });
    const res = await DELETE(makeReq({}), PARAMS);
    expect(res._status).toBe(401);
  });

  it('removes the member and logs audit', async () => {
    prisma.teamMember.delete.mockResolvedValueOnce(MEMBER);
    const res = await DELETE(makeReq({}), PARAMS);
    expect(unwrap(res).status).toBe(200);
    expect(unwrap(res).body.ok).toBe(true);
    expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({ entity: 'TeamMember', action: 'member_removed' }));
  });

  it('returns 404 when the member does not exist', async () => {
    prisma.teamMember.delete.mockRejectedValueOnce({ code: 'P2025' });
    const res = await DELETE(makeReq({}), PARAMS);
    expect(unwrap(res).status).toBe(404);
  });

  it('reports and returns 500 on unexpected db failure', async () => {
    const dbErr = new Error('db down');
    prisma.teamMember.delete.mockRejectedValueOnce(dbErr);
    const res = await DELETE(makeReq({}), PARAMS);
    expect(unwrap(res).status).toBe(500);
    expect(reportServerError).toHaveBeenCalledWith(dbErr, { route: 'teams/[id]/members/[memberId] DELETE' });
  });
});
