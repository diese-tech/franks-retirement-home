/**
 * API tests for GET /api/exports?type=standings|schedule|roster|stats
 * — admin-only CSV exports of canonical (approved) league data.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock next/server ────────────────────────────────────────────────────────
vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((body, init) => ({ _body: body, _status: init?.status ?? 200 })),
  },
}));

// ─── Mock @/lib/resolveAuth ──────────────────────────────────────────────────
vi.mock('@/lib/resolveAuth', () => ({
  resolveAdminAuth: vi.fn(async () => null),
}));

// ─── Mock @/lib/standings ────────────────────────────────────────────────────
vi.mock('@/lib/standings', () => ({
  computeStandings: vi.fn(),
}));

// ─── Mock @/lib/db ───────────────────────────────────────────────────────────
vi.mock('@/lib/db', () => {
  const prisma = {
    division: { findUnique: vi.fn() },
    match: { findMany: vi.fn() },
    team: { findMany: vi.fn() },
    statLine: { findMany: vi.fn() },
  };
  return { default: prisma };
});

const { default: prisma } = await import('@/lib/db');
const { resolveAdminAuth } = await import('@/lib/resolveAuth');
const { computeStandings } = await import('@/lib/standings');
const { GET } = await import('@/app/api/exports/route.js');

function makeUrlReq(query) {
  const params = new URLSearchParams(query);
  return { url: `http://localhost/api/exports?${params.toString()}` };
}

beforeEach(() => {
  vi.clearAllMocks();
  resolveAdminAuth.mockResolvedValue(null);
});

describe('GET /api/exports', () => {
  it('returns 401 (admin guard response) when not authorized', async () => {
    const guard = { status: 401 };
    resolveAdminAuth.mockResolvedValue(guard);
    const res = await GET(makeUrlReq({ type: 'standings' }));
    expect(res).toBe(guard);
  });

  it('returns 400 for an unknown/missing type', async () => {
    const res = await GET(makeUrlReq({}));
    expect(res._status).toBe(400);
    expect(res._body.error).toMatch(/type must be/i);
  });

  describe('type=standings', () => {
    it('requires divisionId', async () => {
      const res = await GET(makeUrlReq({ type: 'standings' }));
      expect(res._status).toBe(400);
      expect(res._body.error).toMatch(/divisionId required/i);
    });

    it('returns a CSV with computed standings rows', async () => {
      computeStandings.mockResolvedValue([
        { teamName: 'Team A', teamTag: 'TA', wins: 3, losses: 1, played: 4, gameWins: 6, gameLosses: 2, gameDiff: 4 },
      ]);
      prisma.division.findUnique.mockResolvedValue({ name: 'Hospice' });
      const res = await GET(makeUrlReq({ type: 'standings', divisionId: 'div-1' }));
      expect(res.headers.get('Content-Type')).toMatch(/text\/csv/);
      expect(res.headers.get('Content-Disposition')).toMatch(/frh-standings-Hospice-.*\.csv/);
      const text = await res.text();
      expect(text).toContain('Team A');
      expect(text.split('\r\n')[1]).toMatch(/^1,Team A,TA,3,1,4,6,2,4$/);
    });
  });

  describe('type=schedule', () => {
    it('returns a CSV of matches', async () => {
      prisma.match.findMany.mockResolvedValue([
        {
          season: { name: 'Season 9' },
          division: { name: 'Hospice' },
          week: 1,
          scheduledAt: new Date('2026-02-01T00:00:00Z'),
          homeTeam: { name: 'Home Team', tag: 'HT' },
          awayTeam: { name: 'Away Team', tag: 'AT' },
          format: 'BO3',
          status: 'scheduled',
          streamUrl: 'https://twitch.tv/x',
        },
      ]);
      const res = await GET(makeUrlReq({ type: 'schedule' }));
      expect(res.headers.get('Content-Disposition')).toMatch(/frh-schedule-.*\.csv/);
      const text = await res.text();
      expect(text).toContain('Home Team');
      expect(text).toContain('https://twitch.tv/x');
    });

    it('filters by seasonId when provided', async () => {
      prisma.match.findMany.mockResolvedValue([]);
      await GET(makeUrlReq({ type: 'schedule', seasonId: 'season-1' }));
      expect(prisma.match.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { seasonId: 'season-1' } }),
      );
    });
  });

  describe('type=roster', () => {
    it('returns a CSV of active roster members', async () => {
      prisma.team.findMany.mockResolvedValue([
        {
          name: 'Team A',
          tag: 'TA',
          division: { name: 'Hospice' },
          members: [
            { isCaptain: true, isSub: false, player: { name: 'Cap', role: 'mid', discordUsername: 'cap#0001', division: 'div' } },
            { isCaptain: false, isSub: true, player: { name: 'Sub', role: 'jungle', discordUsername: null, division: 'div' } },
          ],
        },
      ]);
      const res = await GET(makeUrlReq({ type: 'roster' }));
      const text = await res.text();
      expect(text).toContain('Cap');
      expect(text).toContain('Captain');
      expect(text).toContain('Sub');
    });
  });

  describe('type=stats', () => {
    it('returns a CSV of approved stat lines', async () => {
      prisma.statLine.findMany.mockResolvedValue([
        {
          game: { gameNumber: 1, match: { week: 1, homeTeam: { tag: 'HT' }, awayTeam: { tag: 'AT' } } },
          player: { name: 'Player One', discordUsername: 'p1#0001' },
          team: { tag: 'HT' },
          god: { name: 'Zeus' },
          role: 'mid',
          kills: 10, deaths: 2, assists: 8, damage: 50000, healing: 0, gold: 12000,
        },
      ]);
      const res = await GET(makeUrlReq({ type: 'stats' }));
      expect(res.headers.get('Content-Disposition')).toMatch(/frh-stats-approved-.*\.csv/);
      const text = await res.text();
      expect(text).toContain('Player One');
      expect(text).toContain('Zeus');
    });

    it('filters by seasonId through the game->match chain', async () => {
      prisma.statLine.findMany.mockResolvedValue([]);
      await GET(makeUrlReq({ type: 'stats', seasonId: 'season-1' }));
      expect(prisma.statLine.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { game: { match: { seasonId: 'season-1' } } } }),
      );
    });
  });

  it('returns 500 and reports to Sentry when the query throws', async () => {
    computeStandings.mockRejectedValue(new Error('db exploded'));
    const res = await GET(makeUrlReq({ type: 'standings', divisionId: 'div-1' }));
    expect(res._status).toBe(500);
    expect(res._body.error).toMatch(/Export failed/i);
  });
});
