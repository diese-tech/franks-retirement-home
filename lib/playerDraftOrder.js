// Phased pick-order logic for PlayerDraft (season roster draft).
//
// Uses the same phase/step cursor architecture as the GodDraft engine
// (lib/draftOrder.js) and SAL's src/lib/god-draft-format.ts, so turn
// navigation is consistent across both draft types.
//
// A format is an array of phases. Each phase covers one round of picks.
// Each phase has a `sequence` array of teamIds in pick order for that round.
// Cursor: { phaseIndex, stepIndex } — same shape as SAL's DraftTurn.
//
// Snake pattern: even phase indices use currentOrder as-is;
//               odd  phase indices use currentOrder reversed.
//
// Examples:
//   buildPlayerDraftFormat(['A','B','C','D'], 2):
//     [
//       { sequence: ['A','B','C','D'] },  // round 1 (even)
//       { sequence: ['D','C','B','A'] },  // round 2 (odd — reversed)
//     ]
//
//   getDraftTurn(format, 0, 2) → { phaseIndex:0, stepIndex:2, teamId:'C' }
//   getNextDraftTurn(format, 0, 3) → { phaseIndex:1, stepIndex:0, teamId:'D' }
//   getNextDraftTurn(format, 1, 3) → null  (draft over)

// ---------------------------------------------------------------------------
// Format construction
// ---------------------------------------------------------------------------

// Builds a PlayerDraft phase format from the live pick order and round count.
// currentOrder is the live team order (may differ from baseOrder after slot
// trades). Even phases use currentOrder; odd phases reverse it.
export function buildPlayerDraftFormat(currentOrder, rounds) {
  return Array.from({ length: rounds }, (_, r) => ({
    sequence: r % 2 === 0 ? [...currentOrder] : [...currentOrder].reverse(),
  }));
}

// ---------------------------------------------------------------------------
// Cursor navigation  (mirrors SAL getDraftTurn / getNextDraftTurn exactly)
// ---------------------------------------------------------------------------

// Returns { phaseIndex, stepIndex, teamId } or null when out of range.
export function getDraftTurn(format, phaseIndex, stepIndex) {
  const phase = format[phaseIndex];
  const teamId = phase?.sequence[stepIndex];
  if (!phase || teamId === undefined) return null;
  return { phaseIndex, stepIndex, teamId };
}

export function getFirstDraftTurn(format) {
  return getDraftTurn(format, 0, 0);
}

// Advances within the current phase, then rolls to the next phase.
// Returns null when all picks are exhausted (draft is complete).
export function getNextDraftTurn(format, phaseIndex, stepIndex) {
  const nextInPhase = getDraftTurn(format, phaseIndex, stepIndex + 1);
  if (nextInPhase) return nextInPhase;
  return getDraftTurn(format, phaseIndex + 1, 0);
}

// ---------------------------------------------------------------------------
// Flat-index helpers  (bridge between PlayerDraft.currentPickIndex and turns)
// ---------------------------------------------------------------------------

// Converts a 0-based flat pick index (stored in PlayerDraft.currentPickIndex)
// to a { phaseIndex, stepIndex, teamId } turn, or null when exhausted.
export function flatIndexToTurn(format, flatIndex) {
  let i = 0;
  for (let p = 0; p < format.length; p++) {
    const len = format[p].sequence.length;
    if (flatIndex < i + len) return getDraftTurn(format, p, flatIndex - i);
    i += len;
  }
  return null;
}

// Returns the total number of picks across all phases.
export function totalPicks(format) {
  return format.reduce((sum, phase) => sum + phase.sequence.length, 0);
}

// Returns the teamId that picks at the given flat index, or null when done.
export function currentPickTeam(format, flatIndex) {
  return flatIndexToTurn(format, flatIndex)?.teamId ?? null;
}

// Collapses the format to an ordered flat array of teamIds.
// Useful for displaying the full pick timeline in the draft UI.
export function flattenFormat(format) {
  return format.flatMap((phase) => phase.sequence);
}
