/**
 * API tests for /api/games/[id]/stats
 *   GET    — public: list stat lines for a game
 *   POST   — admin: upsert a stat line for one player
 *   DELETE — admin: remove one stat line
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
    statLine: { findMany: vi.fn(), upsert: vi.fn(), delete: vi.fn() },
  };
  return { default: prisma };
});

vi.mock('@/lib/resolveAuth', () => ({
  resolveAdminAuth: vi.fn(() => ({ _body: { error: 'Unauthorized' }, _status: 401 })),
}));

vi.mock('@/lib/audit', () => ({ logAudit: vi.fn() }));

const { default: prisma } = await import('@/lib/db');
const { resolveAdminAuth } = await import('@/lib/resolveAuth');
const { GET, POST, DELETE } = await import('@/app/api/games/[id]/stats/route.js');

const GAME_ID = 'game-1';
const PARAMS = { params: { id: GAME_ID } };

function makeUrlReq(url) {
  return { url };
}

beforeEach(() => {
  vi.clearAllMocks();
  resolveAdminAuth.mockResolvedValue(null); // admin by default; individual tests override
});

describe('GET /api/games/[id]/stats', () => {
  it('returns stat lines for a game (public, no auth)', async () => {
    prisma.statLine.findMany.mockResolvedValue([{ id: 'sl-1' }]);
    const res = await GET({}, PARAMS);
    expect(unwrap(res).status).toBe(200);
    expect(unwrap(res).body).toEqual([{ id: 'sl-1' }]);
    expect(prisma.statLine.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { gameId: GAME_ID },
    }));
  });

  it('returns 500 when the query fails', async () => {
    prisma.statLine.findMany.mockRejectedValue(new Error('db down'));
    const res = await GET({}, PARAMS);
    expect(unwrap(res).status).toBe(500);
  });
});

describe('POST /api/games/[id]/stats', () => {
  it('returns the admin auth error when not authorized', async () => {
    resolveAdminAuth.mockResolvedValue({ _body: { error: 'Unauthorized' }, _status: 401 });
    const res = await POST(makeReq({ playerId: 'p1', teamId: 't1' }), PARAMS);
    expect(unwrap(res).status).toBe(401);
  });

  it('returns 400 for invalid JSON', async () => {
    const res = await POST(makeInvalidJsonReq(), PARAMS);
    expect(unwrap(res).status).toBe(400);
  });

  it('returns 400 when playerId or teamId is missing', async () => {
    const res = await POST(makeReq({ playerId: 'p1' }), PARAMS);
    expect(unwrap(res).status).toBe(400);
    expect(unwrap(res).body.error).toMatch(/playerId and teamId/i);
  });

  it('upserts a stat line and returns 201', async () => {
    prisma.statLine.upsert.mockResolvedValue({ id: 'sl-1', gameId: GAME_ID, playerId: 'p1' });
    const res = await POST(makeReq({ playerId: 'p1', teamId: 't1', kills: '5' }), PARAMS);
    expect(unwrap(res).status).toBe(201);
    expect(prisma.statLine.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { gameId_playerId: { gameId: GAME_ID, playerId: 'p1' } },
      create: expect.objectContaining({ kills: 5 }),
    }));
  });

  it('returns 500 when the upsert fails', async () => {
    prisma.statLine.upsert.mockRejectedValue(new Error('db down'));
    const res = await POST(makeReq({ playerId: 'p1', teamId: 't1' }), PARAMS);
    expect(unwrap(res).status).toBe(500);
  });
});

describe('DELETE /api/games/[id]/stats', () => {
  it('returns the admin auth error when not authorized', async () => {
    resolveAdminAuth.mockResolvedValue({ _body: { error: 'Unauthorized' }, _status: 401 });
    const req = makeUrlReq(`http://localhost/api/games/${GAME_ID}/stats?playerId=p1`);
    const res = await DELETE(req, PARAMS);
    expect(unwrap(res).status).toBe(401);
  });

  it('returns 400 when playerId query param is missing', async () => {
    const req = makeUrlReq(`http://localhost/api/games/${GAME_ID}/stats`);
    const res = await DELETE(req, PARAMS);
    expect(unwrap(res).status).toBe(400);
  });

  it('deletes the stat line and returns ok', async () => {
    prisma.statLine.delete.mockResolvedValue({});
    const req = makeUrlReq(`http://localhost/api/games/${GAME_ID}/stats?playerId=p1`);
    const res = await DELETE(req, PARAMS);
    expect(unwrap(res).status).toBe(200);
    expect(unwrap(res).body).toEqual({ ok: true });
  });

  it('returns 500 when the delete fails', async () => {
    prisma.statLine.delete.mockRejectedValue(new Error('db down'));
    const req = makeUrlReq(`http://localhost/api/games/${GAME_ID}/stats?playerId=p1`);
    const res = await DELETE(req, PARAMS);
    expect(unwrap(res).status).toBe(500);
  });
});
