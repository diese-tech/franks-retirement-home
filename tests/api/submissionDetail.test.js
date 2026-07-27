/**
 * API tests for /api/submissions/[id]
 *   GET   — admin: full submission detail
 *   PATCH — admin: transition status (approve / reject / in_review)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeReq, makeInvalidJsonReq, unwrap } from './_helpers.js';

vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((body, init) => ({ _body: body, _status: init?.status ?? 200 })),
  },
}));

vi.mock('@/lib/db', () => {
  const prisma = {
    matchSubmission: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    game: { update: vi.fn() },
    $transaction: vi.fn(),
  };
  return { default: prisma };
});

vi.mock('@/lib/resolveAuth', () => ({
  resolveAdminAuth: vi.fn(() => ({ _body: { error: 'Unauthorized' }, _status: 401 })),
}));

vi.mock('@/lib/audit', () => ({ logAudit: vi.fn() }));
vi.mock('@/lib/standings', () => ({ invalidateAllStandings: vi.fn() }));

const { default: prisma } = await import('@/lib/db');
const { resolveAdminAuth } = await import('@/lib/resolveAuth');
const { invalidateAllStandings } = await import('@/lib/standings');
const { GET, PATCH } = await import('@/app/api/submissions/[id]/route.js');

const SUB_ID = 'sub-1';
const PARAMS = { params: { id: SUB_ID } };

const BASE_SUBMISSION = {
  id: SUB_ID,
  status: 'pending',
  gameId: 'game-1',
  reportedWinnerTeamId: 'team-a',
};

beforeEach(() => {
  vi.clearAllMocks();
  resolveAdminAuth.mockResolvedValue(null);
  prisma.matchSubmission.findUnique.mockResolvedValue(BASE_SUBMISSION);
  prisma.$transaction.mockImplementation(async (fn) => fn(prisma));
});

describe('GET /api/submissions/[id]', () => {
  it('returns the admin auth error when not authorized', async () => {
    resolveAdminAuth.mockResolvedValue({ _body: { error: 'Unauthorized' }, _status: 401 });
    const res = await GET({}, PARAMS);
    expect(unwrap(res).status).toBe(401);
  });

  it('returns 404 when the submission does not exist', async () => {
    prisma.matchSubmission.findUnique.mockResolvedValue(null);
    const res = await GET({}, PARAMS);
    expect(unwrap(res).status).toBe(404);
  });

  it('returns the submission detail', async () => {
    const res = await GET({}, PARAMS);
    expect(unwrap(res).status).toBe(200);
    expect(unwrap(res).body).toEqual(BASE_SUBMISSION);
  });

  it('returns 500 when the query fails', async () => {
    prisma.matchSubmission.findUnique.mockRejectedValue(new Error('db down'));
    const res = await GET({}, PARAMS);
    expect(unwrap(res).status).toBe(500);
  });
});

describe('PATCH /api/submissions/[id]', () => {
  it('returns the admin auth error when not authorized', async () => {
    resolveAdminAuth.mockResolvedValue({ _body: { error: 'Unauthorized' }, _status: 401 });
    const res = await PATCH(makeReq({ action: 'approve' }), PARAMS);
    expect(unwrap(res).status).toBe(401);
  });

  it('returns 400 for invalid JSON', async () => {
    const res = await PATCH(makeInvalidJsonReq(), PARAMS);
    expect(unwrap(res).status).toBe(400);
  });

  it('returns 400 for an unknown action', async () => {
    const res = await PATCH(makeReq({ action: 'teleport' }), PARAMS);
    expect(unwrap(res).status).toBe(400);
  });

  it('returns 400 when rejecting without a rejectionReason', async () => {
    const res = await PATCH(makeReq({ action: 'reject' }), PARAMS);
    expect(unwrap(res).status).toBe(400);
    expect(unwrap(res).body.error).toMatch(/rejectionReason/i);
  });

  it('returns 404 when the submission does not exist', async () => {
    prisma.matchSubmission.findUnique.mockResolvedValue(null);
    const res = await PATCH(makeReq({ action: 'approve' }), PARAMS);
    expect(unwrap(res).status).toBe(404);
  });

  it('marks the submission in_review', async () => {
    prisma.matchSubmission.update.mockResolvedValue({ ...BASE_SUBMISSION, status: 'in_review' });
    const res = await PATCH(makeReq({ action: 'in_review', adminId: 'admin-1' }), PARAMS);
    expect(unwrap(res).status).toBe(200);
    expect(unwrap(res).body.status).toBe('in_review');
    expect(prisma.matchSubmission.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'in_review', reviewedByAdminId: 'admin-1' }),
    }));
  });

  it('rejects a submission with a reason', async () => {
    prisma.matchSubmission.update.mockResolvedValue({ ...BASE_SUBMISSION, status: 'rejected' });
    const res = await PATCH(makeReq({ action: 'reject', rejectionReason: 'blurry screenshot' }), PARAMS);
    expect(unwrap(res).status).toBe(200);
    expect(prisma.matchSubmission.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'rejected', rejectionReason: 'blurry screenshot' }),
    }));
  });

  it('approves a submission, sets the game winner, and supersedes other open submissions', async () => {
    prisma.matchSubmission.update.mockResolvedValue({ ...BASE_SUBMISSION, status: 'approved' });
    prisma.game.update.mockResolvedValue({ id: 'game-1', winnerTeamId: 'team-a' });
    prisma.matchSubmission.updateMany.mockResolvedValue({ count: 1 });
    const res = await PATCH(makeReq({ action: 'approve', adminId: 'admin-1' }), PARAMS);
    expect(unwrap(res).status).toBe(200);
    expect(prisma.game.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'game-1' },
      data: { winnerTeamId: 'team-a' },
    }));
    expect(prisma.matchSubmission.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: { not: SUB_ID }, gameId: 'game-1' }),
    }));
    expect(invalidateAllStandings).toHaveBeenCalled();
  });

  it('returns 500 when the transition fails', async () => {
    prisma.matchSubmission.update.mockRejectedValue(new Error('db down'));
    const res = await PATCH(makeReq({ action: 'in_review' }), PARAMS);
    expect(unwrap(res).status).toBe(500);
  });
});
