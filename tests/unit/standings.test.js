/**
 * Unit tests for lib/standings.js — series-win aggregation, ordering,
 * and cache invalidation. Prisma is mocked; only completed matches are
 * fed in because the query filters on status server-side.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db', () => ({
  default: {
    match: { findMany: vi.fn() },
  },
}));

const { default: prisma } = await import('@/lib/db');
const { computeStandings, invalidateStandings, invalidateAllStandings } = await import('@/lib/standings');

const TEAM_A = { id: 'team-a', name: 'Alpha', tag: 'ALP', org: { name: 'Org A' } };
const TEAM_B = { id: 'team-b', name: 'Bravo', tag: 'BRV', org: null };
const TEAM_C = { id: 'team-c', name: 'Charlie', tag: 'CHR', org: null };

function match(home, away, gameWinners) {
  return {
    homeTeamId: home.id,
    awayTeamId: away.id,
    homeTeam: home,
    awayTeam: away,
    games: gameWinners.map((winnerTeamId, i) => ({ id: `g${i}`, winnerTeamId })),
  };
}

let divisionCounter = 0;
// Each test uses a fresh divisionId so the module-level cache never bleeds
// between tests.
function freshDivision() {
  divisionCounter += 1;
  return `div-${divisionCounter}`;
}

beforeEach(() => {
  vi.clearAllMocks();
  invalidateAllStandings();
});

describe('computeStandings', () => {
  it('awards a BO3 series win to the team with the game majority', async () => {
    prisma.match.findMany.mockResolvedValue([
      match(TEAM_A, TEAM_B, ['team-a', 'team-b', 'team-a']), // A wins 2-1
    ]);
    const rows = await computeStandings(freshDivision());

    const a = rows.find((r) => r.teamId === 'team-a');
    const b = rows.find((r) => r.teamId === 'team-b');
    expect(a).toMatchObject({ wins: 1, losses: 0, gameWins: 2, gameLosses: 1, gameDiff: 1, played: 1 });
    expect(b).toMatchObject({ wins: 0, losses: 1, gameWins: 1, gameLosses: 2, gameDiff: -1, played: 1 });
  });

  it('handles a BO1 and counts a single game as the series', async () => {
    prisma.match.findMany.mockResolvedValue([match(TEAM_A, TEAM_B, ['team-b'])]);
    const rows = await computeStandings(freshDivision());
    expect(rows[0]).toMatchObject({ teamId: 'team-b', wins: 1 });
    expect(rows[1]).toMatchObject({ teamId: 'team-a', losses: 1 });
  });

  it('awards no series win when no team reaches the game majority', async () => {
    // Completed BO3 with only one decided game (e.g. partial result data).
    prisma.match.findMany.mockResolvedValue([
      match(TEAM_A, TEAM_B, ['team-a', null, null]),
    ]);
    const rows = await computeStandings(freshDivision());
    const a = rows.find((r) => r.teamId === 'team-a');
    // 1 of 3 games — below the ceil(3/2)=2 threshold: no series result,
    // but game wins still tracked.
    expect(a).toMatchObject({ wins: 0, losses: 0, gameWins: 1 });
  });

  it('sorts by wins desc, then losses asc, then gameDiff desc, then name', async () => {
    prisma.match.findMany.mockResolvedValue([
      match(TEAM_A, TEAM_B, ['team-a']),                     // A 1-0
      match(TEAM_C, TEAM_B, ['team-c']),                     // C 1-0
      match(TEAM_B, TEAM_A, ['team-b', 'team-b', 'team-a']), // B beats A 2-1
    ]);
    const rows = await computeStandings(freshDivision());
    // A: 1W 1L diff 0; B: 1W 2L; C: 1W 0L diff +1
    expect(rows.map((r) => r.teamId)).toEqual(['team-c', 'team-a', 'team-b']);
  });

  it('caches results per division and recomputes after invalidation', async () => {
    const div = freshDivision();
    prisma.match.findMany.mockResolvedValue([match(TEAM_A, TEAM_B, ['team-a'])]);

    await computeStandings(div);
    await computeStandings(div);
    expect(prisma.match.findMany).toHaveBeenCalledTimes(1); // second hit served from cache

    invalidateStandings(div);
    await computeStandings(div);
    expect(prisma.match.findMany).toHaveBeenCalledTimes(2);
  });

  it('invalidateAllStandings clears every division', async () => {
    const d1 = freshDivision();
    const d2 = freshDivision();
    prisma.match.findMany.mockResolvedValue([]);
    await computeStandings(d1);
    await computeStandings(d2);
    expect(prisma.match.findMany).toHaveBeenCalledTimes(2);

    invalidateAllStandings();
    await computeStandings(d1);
    await computeStandings(d2);
    expect(prisma.match.findMany).toHaveBeenCalledTimes(4);
  });

  it('only queries completed matches for the division', async () => {
    const div = freshDivision();
    prisma.match.findMany.mockResolvedValue([]);
    await computeStandings(div);
    expect(prisma.match.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { divisionId: div, status: 'completed' } }),
    );
  });
});
