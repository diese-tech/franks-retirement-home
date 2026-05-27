import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((body, init) => ({ _body: body, _status: init?.status ?? 200 })),
  },
}));

vi.mock('@/lib/db', () => ({
  default: {
    match: { findMany: vi.fn() },
  },
}));

vi.mock('@/lib/discordAuth', () => ({
  getDiscordSessionUser: vi.fn(),
  hasDiscordCaptainRole: vi.fn(),
  resolveTeamFromRoles: vi.fn(),
}));

const { default: prisma } = await import('@/lib/db');
const { getDiscordSessionUser, hasDiscordCaptainRole, resolveTeamFromRoles } = await import('@/lib/discordAuth');
const { GET } = await import('@/app/api/captain/matches/route');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeReq() {
  return { headers: { get: () => null } };
}

function unwrap(res) {
  return { status: res._status, body: res._body };
}

// ─── Setup ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  getDiscordSessionUser.mockReturnValue(null);
  hasDiscordCaptainRole.mockReturnValue(false);
  resolveTeamFromRoles.mockReturnValue(null);
  prisma.match.findMany.mockResolvedValue([]);
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('GET /api/captain/matches', () => {
  it('returns 401 when getDiscordSessionUser returns null', async () => {
    const res = await GET(makeReq());
    expect(unwrap(res).status).toBe(401);
    expect(unwrap(res).body.error).toBe('Not authenticated');
  });

  it('returns 403 when hasDiscordCaptainRole returns false', async () => {
    getDiscordSessionUser.mockReturnValue({ discordId: '1', username: 'User', roles: ['some-role'] });
    hasDiscordCaptainRole.mockReturnValue(false);

    const res = await GET(makeReq());
    expect(unwrap(res).status).toBe(403);
    expect(unwrap(res).body.error).toBe('Captain role required');
  });

  it('returns 403 when resolveTeamFromRoles returns null', async () => {
    getDiscordSessionUser.mockReturnValue({ discordId: '1', username: 'Captain', roles: ['captain-role'] });
    hasDiscordCaptainRole.mockReturnValue(true);
    resolveTeamFromRoles.mockReturnValue(null);

    const res = await GET(makeReq());
    expect(unwrap(res).status).toBe(403);
    expect(unwrap(res).body.error).toBe('No team role found');
  });

  it('returns 200 with matches array when captain is properly authenticated', async () => {
    const teamId = 'team-alpha';
    getDiscordSessionUser.mockReturnValue({ discordId: '2', username: 'CaptainA', roles: ['captain-role', 'team-alpha-role'] });
    hasDiscordCaptainRole.mockReturnValue(true);
    resolveTeamFromRoles.mockReturnValue(teamId);

    const matchData = [
      {
        id: 'match-1',
        homeTeamId: teamId,
        awayTeamId: 'team-beta',
        homeTeam: { id: teamId, name: 'Alpha', tag: 'ALP' },
        awayTeam: { id: 'team-beta', name: 'Beta', tag: 'BET' },
        games: [{ id: 'g1', gameNumber: 1, draft: { id: 'd1', status: 'complete' } }],
        season: { id: 's1' },
        division: { id: 'd1' },
      },
    ];
    prisma.match.findMany.mockResolvedValue(matchData);

    const res = await GET(makeReq());
    expect(unwrap(res).status).toBe(200);
    expect(unwrap(res).body).toHaveLength(1);
    expect(unwrap(res).body[0].id).toBe('match-1');
  });

  it('returned matches include captainSide "home" when team is homeTeamId', async () => {
    const teamId = 'team-alpha';
    getDiscordSessionUser.mockReturnValue({ discordId: '2', username: 'CaptainA', roles: ['captain-role'] });
    hasDiscordCaptainRole.mockReturnValue(true);
    resolveTeamFromRoles.mockReturnValue(teamId);

    prisma.match.findMany.mockResolvedValue([
      { id: 'match-1', homeTeamId: teamId, awayTeamId: 'team-beta', homeTeam: { id: teamId, name: 'Alpha', tag: 'ALP' }, awayTeam: { id: 'team-beta', name: 'Beta', tag: 'BET' }, games: [] },
    ]);

    const res = await GET(makeReq());
    expect(unwrap(res).body[0].captainSide).toBe('home');
  });

  it('returned matches include captainSide "away" when team is awayTeamId', async () => {
    const teamId = 'team-alpha';
    getDiscordSessionUser.mockReturnValue({ discordId: '2', username: 'CaptainA', roles: ['captain-role'] });
    hasDiscordCaptainRole.mockReturnValue(true);
    resolveTeamFromRoles.mockReturnValue(teamId);

    prisma.match.findMany.mockResolvedValue([
      { id: 'match-2', homeTeamId: 'team-beta', awayTeamId: teamId, homeTeam: { id: 'team-beta', name: 'Beta', tag: 'BET' }, awayTeam: { id: teamId, name: 'Alpha', tag: 'ALP' }, games: [] },
    ]);

    const res = await GET(makeReq());
    expect(unwrap(res).body[0].captainSide).toBe('away');
  });

  it('includes expected nested data (games, homeTeam, awayTeam)', async () => {
    const teamId = 'team-alpha';
    getDiscordSessionUser.mockReturnValue({ discordId: '2', username: 'CaptainA', roles: ['captain-role'] });
    hasDiscordCaptainRole.mockReturnValue(true);
    resolveTeamFromRoles.mockReturnValue(teamId);

    const matchData = [
      {
        id: 'match-3',
        homeTeamId: teamId,
        awayTeamId: 'team-gamma',
        homeTeam: { id: teamId, name: 'Alpha', tag: 'ALP' },
        awayTeam: { id: 'team-gamma', name: 'Gamma', tag: 'GAM' },
        games: [
          { id: 'g1', gameNumber: 1, draft: { id: 'd1', status: 'picking' } },
          { id: 'g2', gameNumber: 2, draft: { id: 'd2', status: 'pending' } },
        ],
        season: { id: 's1', name: 'Season 1' },
        division: { id: 'div-1', name: 'Division A' },
      },
    ];
    prisma.match.findMany.mockResolvedValue(matchData);

    const res = await GET(makeReq());
    const match = unwrap(res).body[0];
    expect(match.homeTeam).toEqual({ id: teamId, name: 'Alpha', tag: 'ALP' });
    expect(match.awayTeam).toEqual({ id: 'team-gamma', name: 'Gamma', tag: 'GAM' });
    expect(match.games).toHaveLength(2);
    expect(match.games[0].draft.status).toBe('picking');
  });
});
