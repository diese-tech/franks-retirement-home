/**
 * seriesResult.js
 *
 * Pure helpers for computing BO3/BO5 series state from a set of Game rows.
 * No DB calls — callers pass in the game array from their own queries.
 *
 * Kept pure so they can be unit-tested without Prisma.
 */

// Number of game wins required to clinch the series for a given format.
export function winsRequired(format) {
  const totals = { BO1: 1, BO3: 2, BO5: 3 };
  return totals[format] ?? 1;
}

/**
 * Compute the current series score for a match.
 *
 * @param {{ winnerTeamId: string|null }[]} games
 * @param {string} homeTeamId
 * @param {string} awayTeamId
 * @returns {{ homeWins: number, awayWins: number }}
 */
export function computeScore(games, homeTeamId, awayTeamId) {
  let homeWins = 0;
  let awayWins = 0;
  for (const g of games) {
    if (g.winnerTeamId === homeTeamId) homeWins++;
    else if (g.winnerTeamId === awayTeamId) awayWins++;
  }
  return { homeWins, awayWins };
}

/**
 * Determine if the series is over and who won.
 *
 * @param {{ winnerTeamId: string|null }[]} games
 * @param {string} homeTeamId
 * @param {string} awayTeamId
 * @param {string} format  "BO1" | "BO3" | "BO5"
 * @returns {{ complete: boolean, winnerTeamId: string|null }}
 */
export function checkSeriesComplete(games, homeTeamId, awayTeamId, format) {
  const needed = winsRequired(format);
  const { homeWins, awayWins } = computeScore(games, homeTeamId, awayTeamId);
  if (homeWins >= needed) return { complete: true, winnerTeamId: homeTeamId };
  if (awayWins >= needed) return { complete: true, winnerTeamId: awayTeamId };
  return { complete: false, winnerTeamId: null };
}

/**
 * Determine the state label for a single game card given match context.
 *
 * @param {object} game
 * @param {boolean} isDraftUnlocked  — true when a prior game in the series is confirmed
 * @param {boolean} isUnneeded       — true when the match is already over
 * @returns {string} One of the defined game card state labels
 */
export function gameCardState(game, isDraftUnlocked, isUnneeded) {
  if (isUnneeded) return 'unneeded';
  if (!game) return 'draft_pending';

  switch (game.resultStatus) {
    case 'confirmed': return 'confirmed';
    case 'disputed':  return 'disputed';
    case 'reported':  return 'result_reported';
  }

  // No result yet — look at draft state
  if (!game.draft) return 'draft_pending';
  if (game.draft.status === 'complete') return 'draft_complete';
  if (['pending', 'lobby', 'banning', 'picking'].includes(game.draft.status)) return 'draft_in_progress';
  return 'draft_pending';
}
