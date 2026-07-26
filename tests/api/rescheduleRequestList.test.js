/**
 * API tests for /api/matches/[id]/reschedule-requests (list/create)
 *   GET  — admin: list all reschedule requests for a match
 *   POST — captain-key gated: create a new reschedule request
 *
 * Distinct from tests/api/rescheduleRequest.test.js, which covers the
 * PATCH /api/matches/[id]/reschedule-requests/[reqId] transition endpoint.
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
    rescheduleRequest: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
    match: { findUnique: vi.fn() },
  };
  return { default: prisma };
});

vi.mock('@/lib/resolveAuth', () => ({
  resolveAdminAuth: vi.fn(() => ({ _body: { error: 'Unauthorized' }, _status: 401 })),
  resolveMatchCaptainAuth: vi.fn(() => ({ side: 'home', source: 'key', isAdmin: false })),
}));

vi.mock('@/lib/audit', () => ({ logAudit: vi.fn() }));

const { default: prisma } = await import('@/lib/db');
const { resolveAdminAuth, resolveMatchCaptainAuth } = await import('@/lib/resolveAuth');
const { GET, POST } = await import('@/app/api/matches/[id]/reschedule-requests/route.js');

const MATCH_ID = 'match-1';
const PARAMS = { params: { id: MATCH_ID } };

const BASE_MATCH = {
  id: MATCH_ID,
  homeTeamCaptainKey: 'home-key',
  awayTeamCaptainKey: 'away-key',
  defaultScheduledAt: null,
  scheduledAt: null,
  status: 'scheduled',
};

beforeEach(() => {
  vi.clearAllMocks();
  resolveAdminAuth.mockResolvedValue(null);
  resolveMatchCaptainAuth.mockResolvedValue({ side: 'home', source: 'key', isAdmin: false });
  prisma.match.findUnique.mockResolvedValue(BASE_MATCH);
  prisma.rescheduleRequest.findFirst.mockResolvedValue(null);
});

describe('GET /api/matches/[id]/reschedule-requests', () => {
  it('returns the admin auth error when not authorized', async () => {
    resolveAdminAuth.mockResolvedValue({ _body: { error: 'Unauthorized' }, _status: 401 });
    const res = await GET({}, PARAMS);
    expect(unwrap(res).status).toBe(401);
  });

  it('returns all reschedule requests for the match, newest first', async () => {
    prisma.rescheduleRequest.findMany.mockResolvedValue([{ id: 'req-1' }]);
    const res = await GET({}, PARAMS);
    expect(unwrap(res).status).toBe(200);
    expect(prisma.rescheduleRequest.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { matchId: MATCH_ID },
      orderBy: { createdAt: 'desc' },
    }));
  });

  it('returns 500 when the query fails', async () => {
    prisma.rescheduleRequest.findMany.mockRejectedValue(new Error('db down'));
    const res = await GET({}, PARAMS);
    expect(unwrap(res).status).toBe(500);
  });
});

describe('POST /api/matches/[id]/reschedule-requests', () => {
  it('returns 400 for invalid JSON', async () => {
    const res = await POST(makeInvalidJsonReq(), PARAMS);
    expect(unwrap(res).status).toBe(400);
  });

  it('returns 400 when proposedScheduledAt is missing', async () => {
    const res = await POST(makeReq({}), PARAMS);
    expect(unwrap(res).status).toBe(400);
    expect(unwrap(res).body.error).toMatch(/proposedScheduledAt/i);
  });

  it('returns 400 when proposedScheduledAt is not a valid date', async () => {
    const res = await POST(makeReq({ proposedScheduledAt: 'not-a-date' }), PARAMS);
    expect(unwrap(res).status).toBe(400);
    expect(unwrap(res).body.error).toMatch(/valid ISO date/i);
  });

  it('returns 404 when the match does not exist', async () => {
    prisma.match.findUnique.mockResolvedValue(null);
    const res = await POST(makeReq({ proposedScheduledAt: '2026-01-01T00:00:00Z' }), PARAMS);
    expect(unwrap(res).status).toBe(404);
  });

  it('returns 401 when the captain key is invalid', async () => {
    resolveMatchCaptainAuth.mockResolvedValue({ side: null, source: null, isAdmin: false });
    const res = await POST(makeReq({ proposedScheduledAt: '2026-01-01T00:00:00Z' }), PARAMS);
    expect(unwrap(res).status).toBe(401);
  });

  it('returns 409 when a request is already open for the match', async () => {
    prisma.rescheduleRequest.findFirst.mockResolvedValue({ id: 'existing-req', status: 'pending' });
    const res = await POST(makeReq({ proposedScheduledAt: '2026-01-01T00:00:00Z' }), PARAMS);
    expect(unwrap(res).status).toBe(409);
    expect(unwrap(res).body.error).toMatch(/already open/i);
  });

  it('creates a pending reschedule request', async () => {
    prisma.rescheduleRequest.create.mockResolvedValue({ id: 'req-1', status: 'pending' });
    const res = await POST(makeReq({ proposedScheduledAt: '2026-01-01T00:00:00Z', evidenceText: 'reason' }), PARAMS);
    expect(unwrap(res).status).toBe(201);
    expect(prisma.rescheduleRequest.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        matchId: MATCH_ID,
        requestedByCaptainSide: 'home',
        status: 'pending',
      }),
    }));
  });

  it('returns 500 when creation fails', async () => {
    prisma.rescheduleRequest.create.mockRejectedValue(new Error('db down'));
    const res = await POST(makeReq({ proposedScheduledAt: '2026-01-01T00:00:00Z' }), PARAMS);
    expect(unwrap(res).status).toBe(500);
  });
});
