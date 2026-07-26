/**
 * API tests for /api/matches/[id]
 *   GET    — public: match detail with captain keys stripped
 *   PATCH  — admin: update allowed fields (immutable eligibility anchor guarded)
 *   DELETE — admin: delete a match
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
    match: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
  };
  return { default: prisma };
});

vi.mock('@/lib/resolveAuth', () => ({
  resolveAdminAuth: vi.fn(() => ({ _body: { error: 'Unauthorized' }, _status: 401 })),
}));

const { default: prisma } = await import('@/lib/db');
const { resolveAdminAuth } = await import('@/lib/resolveAuth');
const { GET, PATCH, DELETE } = await import('@/app/api/matches/[id]/route.js');

const MATCH_ID = 'match-1';
const PARAMS = { params: { id: MATCH_ID } };

const BASE_MATCH = {
  id: MATCH_ID,
  homeTeamCaptainKey: 'home-key',
  awayTeamCaptainKey: 'away-key',
  status: 'scheduled',
  week: 1,
};

beforeEach(() => {
  vi.clearAllMocks();
  resolveAdminAuth.mockResolvedValue(null);
});

describe('GET /api/matches/[id]', () => {
  it('returns 404 when the match does not exist', async () => {
    prisma.match.findUnique.mockResolvedValue(null);
    const res = await GET({}, PARAMS);
    expect(unwrap(res).status).toBe(404);
  });

  it('returns the match with captain keys stripped', async () => {
    prisma.match.findUnique.mockResolvedValue(BASE_MATCH);
    const res = await GET({}, PARAMS);
    expect(unwrap(res).status).toBe(200);
    expect(unwrap(res).body.homeTeamCaptainKey).toBeUndefined();
    expect(unwrap(res).body.awayTeamCaptainKey).toBeUndefined();
    expect(unwrap(res).body.id).toBe(MATCH_ID);
  });

  it('returns 500 when the query fails', async () => {
    prisma.match.findUnique.mockRejectedValue(new Error('db down'));
    const res = await GET({}, PARAMS);
    expect(unwrap(res).status).toBe(500);
  });
});

describe('PATCH /api/matches/[id]', () => {
  it('returns the admin auth error when not authorized', async () => {
    resolveAdminAuth.mockResolvedValue({ _body: { error: 'Unauthorized' }, _status: 401 });
    const res = await PATCH(makeReq({ status: 'live' }), PARAMS);
    expect(unwrap(res).status).toBe(401);
  });

  it('returns 400 for invalid JSON', async () => {
    const res = await PATCH(makeInvalidJsonReq(), PARAMS);
    expect(unwrap(res).status).toBe(400);
  });

  it('returns 400 for an invalid status value', async () => {
    const res = await PATCH(makeReq({ status: 'bogus' }), PARAMS);
    expect(unwrap(res).status).toBe(400);
    expect(unwrap(res).body.error).toMatch(/status must be one of/i);
  });

  it('returns 400 for a non-integer week', async () => {
    const res = await PATCH(makeReq({ week: 'not-a-number' }), PARAMS);
    expect(unwrap(res).status).toBe(400);
    expect(unwrap(res).body.error).toMatch(/week must be an integer/i);
  });

  it('returns 400 for a malformed streamUrl', async () => {
    const res = await PATCH(makeReq({ streamUrl: 'not-a-url' }), PARAMS);
    expect(unwrap(res).status).toBe(400);
    expect(unwrap(res).body.error).toMatch(/streamUrl must be an http/i);
  });

  it('returns 400 when attempting to change defaultScheduledAt', async () => {
    const res = await PATCH(makeReq({ defaultScheduledAt: '2026-01-01T00:00:00Z' }), PARAMS);
    expect(unwrap(res).status).toBe(400);
    expect(unwrap(res).body.error).toMatch(/immutable/i);
  });

  it('returns 400 when there are no valid fields to update', async () => {
    const res = await PATCH(makeReq({ notAllowed: 'x' }), PARAMS);
    expect(unwrap(res).status).toBe(400);
    expect(unwrap(res).body.error).toMatch(/No valid fields/i);
  });

  it('updates allowed fields', async () => {
    prisma.match.update.mockResolvedValue({ ...BASE_MATCH, status: 'live' });
    const res = await PATCH(makeReq({ status: 'live' }), PARAMS);
    expect(unwrap(res).status).toBe(200);
    expect(prisma.match.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: MATCH_ID },
      data: { status: 'live' },
    }));
  });

  it('returns 404 when the match does not exist', async () => {
    prisma.match.update.mockRejectedValue({ code: 'P2025' });
    const res = await PATCH(makeReq({ status: 'live' }), PARAMS);
    expect(unwrap(res).status).toBe(404);
  });

  it('returns 500 for unexpected errors', async () => {
    prisma.match.update.mockRejectedValue(new Error('db down'));
    const res = await PATCH(makeReq({ status: 'live' }), PARAMS);
    expect(unwrap(res).status).toBe(500);
  });
});

describe('DELETE /api/matches/[id]', () => {
  it('returns the admin auth error when not authorized', async () => {
    resolveAdminAuth.mockResolvedValue({ _body: { error: 'Unauthorized' }, _status: 401 });
    const res = await DELETE({}, PARAMS);
    expect(unwrap(res).status).toBe(401);
  });

  it('deletes the match', async () => {
    prisma.match.delete.mockResolvedValue({});
    const res = await DELETE({}, PARAMS);
    expect(unwrap(res).status).toBe(200);
    expect(unwrap(res).body).toEqual({ ok: true });
  });

  it('returns 404 when the match does not exist', async () => {
    prisma.match.delete.mockRejectedValue({ code: 'P2025' });
    const res = await DELETE({}, PARAMS);
    expect(unwrap(res).status).toBe(404);
  });

  it('returns 500 for unexpected errors', async () => {
    prisma.match.delete.mockRejectedValue(new Error('db down'));
    const res = await DELETE({}, PARAMS);
    expect(unwrap(res).status).toBe(500);
  });
});
