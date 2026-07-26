/**
 * API tests for /api/matches
 *   GET  — public: list matches with filters, captain keys stripped
 *   POST — admin: create a match + its games, auto-provision Draft rooms
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
    match: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
    game: { createMany: vi.fn() },
    $transaction: vi.fn(),
  };
  return { default: prisma };
});

vi.mock('@/lib/resolveAuth', () => ({
  resolveAdminAuth: vi.fn(() => ({ _body: { error: 'Unauthorized' }, _status: 401 })),
}));

vi.mock('@/lib/matchDraftProvisioning', () => ({
  buildDraftForGame: vi.fn(),
}));

const { default: prisma } = await import('@/lib/db');
const { resolveAdminAuth } = await import('@/lib/resolveAuth');
const { buildDraftForGame } = await import('@/lib/matchDraftProvisioning');
const { GET, POST } = await import('@/app/api/matches/route.js');

function makeUrlReq(url) {
  return { url };
}

const FULL_MATCH = {
  id: 'match-1',
  season: { id: 's1', name: 'Season 1', slug: 's1' },
  division: { id: 'd1', name: 'Division 1' },
  homeTeam: { id: 'home', name: 'Home', tag: 'HOM' },
  awayTeam: { id: 'away', name: 'Away', tag: 'AWY' },
  games: [{ id: 'game-1', gameNumber: 1 }],
};

beforeEach(() => {
  vi.clearAllMocks();
  resolveAdminAuth.mockResolvedValue(null);
  prisma.match.create.mockResolvedValue({ id: 'match-1' });
  prisma.match.findUnique.mockResolvedValue(FULL_MATCH);
  prisma.game.createMany.mockResolvedValue({ count: 1 });
  buildDraftForGame.mockResolvedValue({ draft: { id: 'draft-1' }, created: true });
  prisma.$transaction.mockImplementation(async (fn) => fn(prisma));
});

describe('GET /api/matches', () => {
  it('returns matches with captain keys stripped', async () => {
    prisma.match.findMany.mockResolvedValue([
      { id: 'match-1', homeTeamCaptainKey: 'k1', awayTeamCaptainKey: 'k2', week: 1 },
    ]);
    const res = await GET(makeUrlReq('http://localhost/api/matches'));
    expect(unwrap(res).status).toBe(200);
    expect(unwrap(res).body[0].homeTeamCaptainKey).toBeUndefined();
    expect(unwrap(res).body[0].awayTeamCaptainKey).toBeUndefined();
  });

  it('filters by seasonId, divisionId, week, and status query params', async () => {
    prisma.match.findMany.mockResolvedValue([]);
    await GET(makeUrlReq('http://localhost/api/matches?seasonId=s1&divisionId=d1&week=3&status=live'));
    expect(prisma.match.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { seasonId: 's1', divisionId: 'd1', week: 3, status: 'live' },
    }));
  });

  it('returns 500 when the query fails', async () => {
    prisma.match.findMany.mockRejectedValue(new Error('db down'));
    const res = await GET(makeUrlReq('http://localhost/api/matches'));
    expect(unwrap(res).status).toBe(500);
  });
});

describe('POST /api/matches', () => {
  it('returns the admin auth error when not authorized', async () => {
    resolveAdminAuth.mockResolvedValue({ _body: { error: 'Unauthorized' }, _status: 401 });
    const res = await POST(makeReq({}));
    expect(unwrap(res).status).toBe(401);
  });

  it('returns 400 for invalid JSON', async () => {
    const res = await POST(makeInvalidJsonReq());
    expect(unwrap(res).status).toBe(400);
  });

  it('returns 400 when required fields are missing', async () => {
    const res = await POST(makeReq({ seasonId: 's1' }));
    expect(unwrap(res).status).toBe(400);
  });

  it('returns 400 when homeTeamId equals awayTeamId', async () => {
    const res = await POST(makeReq({
      seasonId: 's1', divisionId: 'd1', homeTeamId: 't1', awayTeamId: 't1', week: 1,
    }));
    expect(unwrap(res).status).toBe(400);
    expect(unwrap(res).body.error).toMatch(/must differ/i);
  });

  it('returns 400 for an invalid format', async () => {
    const res = await POST(makeReq({
      seasonId: 's1', divisionId: 'd1', homeTeamId: 'home', awayTeamId: 'away', week: 1, format: 'BO9',
    }));
    expect(unwrap(res).status).toBe(400);
    expect(unwrap(res).body.error).toMatch(/BO1, BO3, or BO5/);
  });

  it('creates a match, its games, and auto-provisions drafts', async () => {
    const res = await POST(makeReq({
      seasonId: 's1', divisionId: 'd1', homeTeamId: 'home', awayTeamId: 'away', week: 1, format: 'BO3',
    }));
    expect(unwrap(res).status).toBe(201);
    expect(prisma.game.createMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.arrayContaining([
        expect.objectContaining({ matchId: 'match-1', gameNumber: 1 }),
        expect.objectContaining({ matchId: 'match-1', gameNumber: 2 }),
        expect.objectContaining({ matchId: 'match-1', gameNumber: 3 }),
      ]),
    }));
    expect(buildDraftForGame).toHaveBeenCalledWith('match-1', 'game-1');
    expect(unwrap(res).body).toEqual(FULL_MATCH);
  });

  it('returns 400 when a referenced season/division/team is invalid (P2003)', async () => {
    prisma.$transaction.mockRejectedValue({ code: 'P2003' });
    const res = await POST(makeReq({
      seasonId: 'bad', divisionId: 'd1', homeTeamId: 'home', awayTeamId: 'away', week: 1,
    }));
    expect(unwrap(res).status).toBe(400);
  });

  it('returns 409 for a duplicate home/away pairing in the same week (P2002)', async () => {
    prisma.$transaction.mockRejectedValue({ code: 'P2002' });
    const res = await POST(makeReq({
      seasonId: 's1', divisionId: 'd1', homeTeamId: 'home', awayTeamId: 'away', week: 1,
    }));
    expect(unwrap(res).status).toBe(409);
  });

  it('returns 500 for unexpected errors', async () => {
    prisma.$transaction.mockRejectedValue(new Error('db down'));
    const res = await POST(makeReq({
      seasonId: 's1', divisionId: 'd1', homeTeamId: 'home', awayTeamId: 'away', week: 1,
    }));
    expect(unwrap(res).status).toBe(500);
  });
});
