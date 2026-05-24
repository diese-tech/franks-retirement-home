// Snake pick-order logic for PlayerDraft (season roster draft).
// No DB or framework dependencies — pure input/output functions.
//
// currentOrder is the live team order array (teamIds). It may differ from
// baseOrder when captains have agreed to a slot trade. buildPickSequence
// always runs on currentOrder; baseOrder is the immutable audit trail stored
// separately on the PlayerDraft row.
//
// Examples:
//   buildPickSequence(['A','B','C','D'], 1) → ['A','B','C','D']
//   buildPickSequence(['A','B','C','D'], 2) → ['A','B','C','D','D','C','B','A']
//   buildPickSequence(['A','B','C','D'], 3) → ['A','B','C','D','D','C','B','A','A','B','C','D']
//   buildPickSequence(['A','B'], 5)         → ['A','B','B','A','A','B','B','A','A','B']

// Returns the full snake pick sequence for a player draft.
// Even round indices (0, 2, 4…) use currentOrder as-is.
// Odd round indices  (1, 3, 5…) use currentOrder reversed.
export function buildPickSequence(currentOrder, rounds) {
  const seq = [];
  for (let r = 0; r < rounds; r++) {
    const row = r % 2 === 0 ? currentOrder : [...currentOrder].reverse();
    seq.push(...row);
  }
  return seq;
}

// Returns the teamId that picks at position pickIndex (0-based).
// Returns null when the index is out of range (all picks made).
export function currentPickTeam(currentOrder, rounds, pickIndex) {
  const seq = buildPickSequence(currentOrder, rounds);
  return seq[pickIndex] ?? null;
}

// Returns the total number of picks for a draft.
export function totalPicks(currentOrder, rounds) {
  return currentOrder.length * rounds;
}
