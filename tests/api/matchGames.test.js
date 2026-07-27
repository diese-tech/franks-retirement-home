/**
 * API tests for /api/matches/[id]/games
 *   GET   — public: list games for a match
 *   PATCH — admin: update a game directly (winnerTeamId override, durationSeconds)
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
    game: { findMany: vi.fn(), update: vi.fn() },
  };
  return { default: prisma };
});

vi.mock('@/lib/resolveAuth', () => ({
  resolveAdminAuth: vi.fn(() => ({ _body: { error: 'Unauthorized' }, _status: 401 })),
}));

const { default: prisma } = await import('@/lib/db');
const { resolveAdminAuth } = await import('@/lib/resolveAuth');
const { GET, PATCH } = await import('@/app/api/matches/[id]/games/route.js');

const MATCH_ID = 'match-1';
const PARAMS = { params: { id: MATCH_ID } };

beforeEach(() => {
  vi.clearAllMocks();
  resolveAdminAuth.mockResolvedValue(null);
});

describe('GET /api/matches/[id]/games', () => {
  it('returns games ordered by gameNumber', async () => {
    prisma.game.findMany.mockResolvedValue([{ id: 'game-1', gameNumber: 1 }]);
    const res = await GET({}, PARAMS);
    expect(unwrap(res).status).toBe(200);
    expect(prisma.game.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { matchId: MATCH_ID },
      orderBy: { gameNumber: 'asc' },
    }));
  });

  it('returns 500 when the query fails', async () => {
    prisma.game.findMany.mockRejectedValue(new Error('db down'));
    const res = await GET({}, PARAMS);
    expect(unwrap(res).status).toBe(500);
  });
});

describe('PATCH /api/matches/[id]/games', () => {
  it('returns the admin auth error when not authorized', async () => {
    resolveAdminAuth.mockResolvedValue({ _body: { error: 'Unauthorized' }, _status: 401 });
    const res = await PATCH(makeReq({ gameId: 'game-1' }), PARAMS);
    expect(unwrap(res).status).toBe(401);
  });

  it('returns 400 for invalid JSON', async () => {
    const res = await PATCH(makeInvalidJsonReq(), PARAMS);
    expect(unwrap(res).status).toBe(400);
  });

  it('returns 400 when gameId is missing', async () => {
    const res = await PATCH(makeReq({}), PARAMS);
    expect(unwrap(res).status).toBe(400);
    expect(unwrap(res).body.error).toMatch(/gameId/i);
  });

  it('updates the game winner and duration', async () => {
    prisma.game.update.mockResolvedValue({ id: 'game-1', winnerTeamId: 'team-a', durationSeconds: 1800 });
    const res = await PATCH(makeReq({ gameId: 'game-1', winnerTeamId: 'team-a', durationSeconds: 1800 }), PARAMS);
    expect(unwrap(res).status).toBe(200);
    expect(prisma.game.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'game-1', matchId: MATCH_ID },
      data: { winnerTeamId: 'team-a', durationSeconds: 1800 },
    }));
  });

  it('returns 404 when the game does not exist', async () => {
    prisma.game.update.mockRejectedValue({ code: 'P2025' });
    const res = await PATCH(makeReq({ gameId: 'missing' }), PARAMS);
    expect(unwrap(res).status).toBe(404);
  });

  it('returns 500 for unexpected errors', async () => {
    prisma.game.update.mockRejectedValue(new Error('db down'));
    const res = await PATCH(makeReq({ gameId: 'game-1' }), PARAMS);
    expect(unwrap(res).status).toBe(500);
  });
});
