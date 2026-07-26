/**
 * API tests for /api/admin/betting-lines — list + create (opening a line).
 * PATCH .../[id] (settlement) already has its own thorough suite in
 * tests/api/bettingLineSettlement.test.js — not duplicated here.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeReq, makeInvalidJsonReq, unwrap } from './_helpers.js';

vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((body, init) => ({ _body: body, _status: init?.status ?? 200 })),
  },
}));

vi.mock('@/lib/resolveAuth', () => ({
  resolveAdminAuth: vi.fn(),
}));

vi.mock('@/lib/discordAuth', () => ({
  getDiscordSessionUser: vi.fn(),
}));

vi.mock('@/lib/db', () => {
  const prisma = {
    bettingLine: { findMany: vi.fn(), create: vi.fn() },
    match: { findUnique: vi.fn() },
  };
  return { default: prisma };
});

const { default: prisma } = await import('@/lib/db');
const { resolveAdminAuth } = await import('@/lib/resolveAuth');
const { getDiscordSessionUser } = await import('@/lib/discordAuth');
const { GET, POST } = await import('@/app/api/admin/betting-lines/route.js');

const MATCH = { id: 'match-1', homeTeamId: 'team-a', awayTeamId: 'team-b' };
const VALID_BODY = { matchId: 'match-1', teamAId: 'team-a', teamAOdds: 150, teamBId: 'team-b', teamBOdds: -150 };

function reqWithUrl(url) {
  return { url };
}

beforeEach(() => {
  vi.clearAllMocks();
  resolveAdminAuth.mockResolvedValue(null);
  getDiscordSessionUser.mockReturnValue({ username: 'AdminUser' });
  prisma.match.findUnique.mockResolvedValue(MATCH);
});

describe('GET /api/admin/betting-lines', () => {
  it('returns 401 when not authorized', async () => {
    resolveAdminAuth.mockResolvedValue({ _body: { error: 'Unauthorized' }, _status: 401 });
    const res = await GET(reqWithUrl('http://localhost/api/admin/betting-lines'));
    expect(unwrap(res).status).toBe(401);
  });

  it('lists lines with an optional status filter', async () => {
    prisma.bettingLine.findMany.mockResolvedValue([{ id: 'line-1', status: 'open' }]);
    const res = await GET(reqWithUrl('http://localhost/api/admin/betting-lines?status=open'));
    expect(unwrap(res).status).toBe(200);
    expect(prisma.bettingLine.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'open' } })
    );
  });

  it('lists all lines when no status filter is given', async () => {
    prisma.bettingLine.findMany.mockResolvedValue([]);
    await GET(reqWithUrl('http://localhost/api/admin/betting-lines'));
    expect(prisma.bettingLine.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: undefined })
    );
  });

  it('returns 500 on a database error', async () => {
    prisma.bettingLine.findMany.mockRejectedValue(new Error('db down'));
    const res = await GET(reqWithUrl('http://localhost/api/admin/betting-lines'));
    expect(unwrap(res).status).toBe(500);
  });
});

describe('POST /api/admin/betting-lines', () => {
  it('returns 401 when not authorized', async () => {
    resolveAdminAuth.mockResolvedValue({ _body: { error: 'Unauthorized' }, _status: 401 });
    const res = await POST(makeReq(VALID_BODY));
    expect(unwrap(res).status).toBe(401);
  });

  it('returns 400 for invalid JSON', async () => {
    const res = await POST(makeInvalidJsonReq());
    expect(unwrap(res).status).toBe(400);
  });

  it('returns 400 when matchId, teamAId, or teamBId are missing', async () => {
    const res = await POST(makeReq({ teamAOdds: 100, teamBOdds: -100 }));
    expect(unwrap(res).status).toBe(400);
  });

  it('returns 400 when teamA and teamB are the same team', async () => {
    const res = await POST(makeReq({ ...VALID_BODY, teamBId: 'team-a' }));
    expect(unwrap(res).status).toBe(400);
  });

  it('returns 400 when odds are not integers', async () => {
    const res = await POST(makeReq({ ...VALID_BODY, teamAOdds: 150.5 }));
    expect(unwrap(res).status).toBe(400);
  });

  it('returns 404 when the match does not exist', async () => {
    prisma.match.findUnique.mockResolvedValue(null);
    const res = await POST(makeReq(VALID_BODY));
    expect(unwrap(res).status).toBe(404);
  });

  it('returns 400 when the given teams are not the two teams on the match', async () => {
    const res = await POST(makeReq({ ...VALID_BODY, teamAId: 'team-c' }));
    expect(unwrap(res).status).toBe(400);
  });

  it('creates an open line and attributes it to the acting admin', async () => {
    prisma.bettingLine.create.mockResolvedValue({ id: 'line-1', status: 'open', ...VALID_BODY });
    const res = await POST(makeReq(VALID_BODY));
    expect(unwrap(res).status).toBe(201);
    expect(prisma.bettingLine.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        matchId: 'match-1',
        teamAId: 'team-a',
        teamBId: 'team-b',
        status: 'open',
        createdById: 'AdminUser',
        closesAt: null,
      }),
    });
  });

  it('falls back to "FRH Staff" when there is no Discord session', async () => {
    getDiscordSessionUser.mockReturnValue(null);
    prisma.bettingLine.create.mockResolvedValue({ id: 'line-1' });
    await POST(makeReq(VALID_BODY));
    expect(prisma.bettingLine.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ createdById: 'FRH Staff' }) })
    );
  });

  it('parses a closesAt date when provided', async () => {
    prisma.bettingLine.create.mockResolvedValue({ id: 'line-1' });
    await POST(makeReq({ ...VALID_BODY, closesAt: '2026-08-01T00:00:00.000Z' }));
    expect(prisma.bettingLine.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ closesAt: new Date('2026-08-01T00:00:00.000Z') }) })
    );
  });

  it('returns 500 on a database error', async () => {
    prisma.bettingLine.create.mockRejectedValue(new Error('db down'));
    const res = await POST(makeReq(VALID_BODY));
    expect(unwrap(res).status).toBe(500);
  });
});
