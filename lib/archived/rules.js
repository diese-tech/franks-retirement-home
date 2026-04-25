// ─────────────────────────────────────────────────────
// RULES ENGINE
// Pure functions — no database calls, no side effects.
// Feed it picks, get back balance state + violations.
// ─────────────────────────────────────────────────────

/**
 * Calculate total points for one team.
 */
export function teamPoints(picks, team) {
  return picks
    .filter((p) => p.team === team)
    .reduce((sum, p) => sum + (p.player?.pointValue ?? 0), 0);
}

/**
 * Get picks for one team.
 */
export function teamPicks(picks, team) {
  return picks.filter((p) => p.team === team);
}

// ─── Individual Rules ────────────────────────────────
// Each rule: (picksA, picksB, ptsA, ptsB) => violation | null

function pointDifferenceRule(picksA, picksB, ptsA, ptsB) {
  const diff = Math.abs(ptsA - ptsB);
  if (diff < 3) return null;
  const penalized = ptsA > ptsB ? 'A' : 'B';
  return {
    id: 'point-difference',
    name: 'Point Difference Penalty',
    severity: 'critical',
    message: `Team ${penalized} is penalized — point gap is ${diff} (≥ 3).`,
    penalizedTeam: penalized,
    meta: { diff, ptsA, ptsB },
  };
}

function cautionRule(picksA, picksB, ptsA, ptsB) {
  const diff = Math.abs(ptsA - ptsB);
  if (diff !== 2) return null;
  const higher = ptsA > ptsB ? 'A' : 'B';
  return {
    id: 'caution',
    name: 'Balance Caution',
    severity: 'warning',
    message: `Caution — Team ${higher} is 1 point from penalty territory.`,
    penalizedTeam: null,
    meta: { diff },
  };
}

function rosterImbalanceRule(picksA, picksB) {
  const diff = Math.abs(picksA.length - picksB.length);
  if (diff < 2) return null;
  const bigger = picksA.length > picksB.length ? 'A' : 'B';
  return {
    id: 'roster-imbalance',
    name: 'Roster Size Imbalance',
    severity: 'warning',
    message: `Team ${bigger} has ${diff} more player(s) than the other team.`,
    penalizedTeam: null,
    meta: { diff },
  };
}

// ─── Rule Registry ───────────────────────────────────
// Add new rules here — just append to the array.
const RULES = [pointDifferenceRule, cautionRule, rosterImbalanceRule];

// ─── Main Evaluator ──────────────────────────────────

export function evaluateDraft(picks) {
  const pA = teamPicks(picks, 'A');
  const pB = teamPicks(picks, 'B');
  const ptsA = teamPoints(picks, 'A');
  const ptsB = teamPoints(picks, 'B');
  const diff = Math.abs(ptsA - ptsB);

  const violations = RULES.map((rule) => rule(pA, pB, ptsA, ptsB)).filter(Boolean);

  let rating = 'balanced'; // green
  if (violations.some((v) => v.severity === 'critical')) rating = 'penalized'; // red
  else if (violations.some((v) => v.severity === 'warning')) rating = 'caution'; // yellow

  return {
    teamA: { points: ptsA, count: pA.length, picks: pA },
    teamB: { points: ptsB, count: pB.length, picks: pB },
    diff,
    violations,
    rating,
  };
}
