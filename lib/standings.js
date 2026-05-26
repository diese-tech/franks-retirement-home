import prisma from '@/lib/db';

// 30-second in-memory cache keyed by divisionId.
// Invalidated explicitly on approval/rejection; expires automatically after TTL.
const CACHE_TTL_MS = 30_000;
const cache = new Map(); // divisionId → { data, expiresAt }

export function invalidateStandings(divisionId) {
  if (divisionId) {
    cache.delete(divisionId);
  }
}

export function invalidateAllStandings() {
  cache.clear();
}

// computeStandings(divisionId) — returns an array of team standing objects
// sorted by wins desc, then losses asc, then team name asc.
//
// A "match win" is awarded when a team wins the majority of games in a match
// (e.g. 2/3 in BO3). Only completed matches are counted.
// Game wins are also tracked separately for tiebreaker/display purposes.
//
// Returns:
// [{ teamId, teamName, teamTag, orgName, wins, losses, gameDiff, gameWins, gameLosses, played }]
export async function computeStandings(divisionId) {
  const now = Date.now();
  const cached = cache.get(divisionId);
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  const matches = await prisma.match.findMany({
    where: { divisionId, status: 'completed' },
    include: {
      homeTeam: { select: { id: true, name: true, tag: true, org: { select: { name: true } } } },
      awayTeam: { select: { id: true, name: true, tag: true, org: { select: { name: true } } } },
      games: { select: { id: true, winnerTeamId: true } },
    },
  });

  const map = new Map(); // teamId → entry

  const ensure = (team) => {
    if (!map.has(team.id)) {
      map.set(team.id, {
        teamId: team.id,
        teamName: team.name,
        teamTag: team.tag,
        orgName: team.org?.name ?? null,
        wins: 0,
        losses: 0,
        gameWins: 0,
        gameLosses: 0,
        played: 0,
      });
    }
    return map.get(team.id);
  };

  for (const match of matches) {
    const home = ensure(match.homeTeam);
    const away = ensure(match.awayTeam);

    let homeGameWins = 0;
    let awayGameWins = 0;

    for (const game of match.games) {
      if (game.winnerTeamId === match.homeTeamId) homeGameWins++;
      else if (game.winnerTeamId === match.awayTeamId) awayGameWins++;
    }

    home.gameWins += homeGameWins;
    home.gameLosses += awayGameWins;
    away.gameWins += awayGameWins;
    away.gameLosses += homeGameWins;
    home.played++;
    away.played++;

    const threshold = Math.ceil(match.games.length / 2);
    if (homeGameWins >= threshold) {
      home.wins++;
      away.losses++;
    } else if (awayGameWins >= threshold) {
      away.wins++;
      home.losses++;
    }
  }

  const data = [...map.values()]
    .map((e) => ({ ...e, gameDiff: e.gameWins - e.gameLosses }))
    .sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (a.losses !== b.losses) return a.losses - b.losses;
      if (b.gameDiff !== a.gameDiff) return b.gameDiff - a.gameDiff;
      return a.teamName.localeCompare(b.teamName);
    });

  cache.set(divisionId, { data, expiresAt: now + CACHE_TTL_MS });
  return data;
}
