/**
 * API tests for PATCH /api/matches/[id]/reschedule-requests/[reqId]
 *
 * Focus: the TOCTOU fix — captain response uses updateMany with a status guard
 * so concurrent requests can't both succeed when only one pending slot exists.
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
    rescheduleRequest: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
    match: { update: vi.fn() },
    $transaction: vi.fn(),
  };
  return { default: prisma };
});

vi.mock('@/lib/resolveAuth', () => ({
  resolveAdminAuth: vi.fn(() => ({ _body: { error: 'Unauthorized' }, _status: 401 })),
  resolveMatchCaptainAuth: vi.fn(() => ({ side: 'away', source: 'key', isAdmin: false })),
}));

vi.mock('@/lib/audit', () => ({ logAudit: vi.fn() }));

const { default: prisma } = await import('@/lib/db');
const { resolveMatchCaptainAuth, resolveAdminAuth } = await import('@/lib/resolveAuth');
const { PATCH } = await import('@/app/api/matches/[id]/reschedule-requests/[reqId]/route.js');

const MATCH_ID = 'match-1';
const REQ_ID   = 'req-1';
const PARAMS   = { params: { id: MATCH_ID, reqId: REQ_ID } };

const BASE_REQUEST = {
  id: REQ_ID,
  matchId: MATCH_ID,
  status: 'pending',
  requestedByCaptainSide: 'home',
  proposedScheduledAt: new Date('2025-01-01T20:00:00Z'),
  match: {
    id: MATCH_ID,
    homeTeamCaptainKey: 'home-key',
    awayTeamCaptainKey: 'away-key',
    defaultScheduledAt: null,
    scheduledAt: null,
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  prisma.rescheduleRequest.findUnique.mockResolvedValue(BASE_REQUEST);
  prisma.rescheduleRequest.updateMany.mockResolvedValue({ count: 1 });
  prisma.$transaction.mockImplementation(async (fn) => fn(prisma));
  resolveMatchCaptainAuth.mockResolvedValue({ side: 'away', source: 'key', isAdmin: false });
  resolveAdminAuth.mockResolvedValue({ _body: { error: 'Unauthorized' }, _status: 401 });
});

describe('PATCH /api/matches/[id]/reschedule-requests/[reqId] — captain acknowledge/dispute', () => {
  it('returns 400 for invalid JSON', async () => {
    const res = await PATCH(makeInvalidJsonReq(), PARAMS);
    expect(unwrap(res).status).toBe(400);
  });

  it('returns 400 when action is missing', async () => {
    const res = await PATCH(makeReq({}), PARAMS);
    expect(unwrap(res).status).toBe(400);
    expect(unwrap(res).body.error).toMatch(/action/i);
  });

  it('returns 404 when request does not exist', async () => {
    prisma.rescheduleRequest.findUnique.mockResolvedValue(null);
    const res = await PATCH(makeReq({ action: 'acknowledge' }), PARAMS);
    expect(unwrap(res).status).toBe(404);
  });

  it('returns 409 when request is already in a terminal state', async () => {
    prisma.rescheduleRequest.findUnique.mockResolvedValue({ ...BASE_REQUEST, status: 'approved' });
    const res = await PATCH(makeReq({ action: 'acknowledge' }), PARAMS);
    expect(unwrap(res).status).toBe(409);
    expect(unwrap(res).body.error).toMatch(/approved/i);
  });

  it('returns 401 when captain key is invalid', async () => {
    resolveMatchCaptainAuth.mockResolvedValue({ side: null, source: null, isAdmin: false });
    const res = await PATCH(makeReq({ action: 'acknowledge' }), PARAMS);
    expect(unwrap(res).status).toBe(401);
  });

  it('returns 403 when the submitting captain tries to acknowledge their own request', async () => {
    resolveMatchCaptainAuth.mockResolvedValue({ side: 'home', source: 'key', isAdmin: false });
    const res = await PATCH(makeReq({ action: 'acknowledge' }), PARAMS);
    expect(unwrap(res).status).toBe(403);
  });

  it('acknowledges a pending request and returns the updated row', async () => {
    const updated = { ...BASE_REQUEST, status: 'acknowledged' };
    prisma.rescheduleRequest.updateMany.mockResolvedValue({ count: 1 });
    prisma.rescheduleRequest.findUnique
      .mockResolvedValueOnce(BASE_REQUEST)  // initial load
      .mockResolvedValueOnce(updated);       // post-update read
    const res = await PATCH(makeReq({ action: 'acknowledge' }), PARAMS);
    expect(unwrap(res).status).toBe(200);
    expect(unwrap(res).body.status).toBe('acknowledged');
  });

  it('returns 409 when updateMany finds 0 rows — concurrent request already claimed it', async () => {
    prisma.rescheduleRequest.updateMany.mockResolvedValue({ count: 0 });
    const res = await PATCH(makeReq({ action: 'acknowledge' }), PARAMS);
    expect(unwrap(res).status).toBe(409);
    expect(unwrap(res).body.error).toMatch(/no longer pending/i);
  });

  it('uses updateMany (not update) to guard against TOCTOU races', async () => {
    await PATCH(makeReq({ action: 'dispute' }), PARAMS);
    expect(prisma.rescheduleRequest.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: 'pending' }) }),
    );
  });
});

describe('PATCH — admin approve/deny', () => {
  beforeEach(() => {
    resolveAdminAuth.mockResolvedValue(null); // admin authorized
    prisma.$transaction.mockImplementation(async (fn) => fn(prisma));
    prisma.rescheduleRequest.findUnique.mockResolvedValue(BASE_REQUEST);
    prisma.rescheduleRequest.updateMany.mockResolvedValue({ count: 1 }); // not used for admin path
  });

  it('returns 401 when caller is not admin', async () => {
    resolveAdminAuth.mockResolvedValue({ _body: { error: 'Unauthorized' }, _status: 401 });
    const res = await PATCH(makeReq({ action: 'approve' }), PARAMS);
    expect(unwrap(res).status).toBe(401);
  });
});
