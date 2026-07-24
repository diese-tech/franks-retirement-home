import { randomUUID } from 'crypto';

// Pure single-elimination bracket logic (docs/adr/0001, 0002, 0007;
// docs/tournament-bracket-implementation-plan.md). No Prisma imports —
// callers persist the returned shapes and bump Tournament.version themselves.
//
// "BYE" is not special-cased here: per docs/adr/0007 an admin types "BYE"
// into a slot exactly like any other participant name, and recordWinner
// advances past it the same way it would any other match.

function isPowerOfTwo(n) {
  return Number.isInteger(n) && n >= 2 && (n & (n - 1)) === 0;
}

/**
 * @param {string[]} participantNames - already padded to a power of 2 by the
 *   admin (using literal "BYE" entries where needed).
 * @returns {{ participants: Array<{id, name, seed}>, matches: Array<object> }}
 */
export function generateBracket(participantNames) {
  if (!Array.isArray(participantNames) || !isPowerOfTwo(participantNames.length)) {
    throw new Error('participantNames must be a power-of-2-length array (pad with "BYE")');
  }

  const participants = participantNames.map((name, seed) => ({
    id: randomUUID(),
    name,
    seed,
  }));

  const numRounds = Math.log2(participants.length);

  // Build every round's matches, keyed by [round][position], so later rounds
  // can look up the match they feed into before all matches exist.
  const roundsMatches = [];
  for (let round = 1; round <= numRounds; round++) {
    const matchesInRound = participants.length / 2 ** round;
    roundsMatches.push(
      Array.from({ length: matchesInRound }, () => ({
        id: randomUUID(),
        round,
        position: null, // set below once the array index is stable
        slot1ParticipantId: null,
        slot2ParticipantId: null,
        winnerParticipantId: null,
        nextMatchId: null,
        nextMatchSlot: null,
        loserNextMatchId: null,
        loserNextMatchSlot: null,
      }))
    );
  }

  const matches = [];
  for (let round = 1; round <= numRounds; round++) {
    const thisRound = roundsMatches[round - 1];
    const nextRound = round < numRounds ? roundsMatches[round] : null;

    thisRound.forEach((match, position) => {
      match.position = position;

      if (round === 1) {
        match.slot1ParticipantId = participants[position * 2].id;
        match.slot2ParticipantId = participants[position * 2 + 1].id;
      }

      if (nextRound) {
        const next = nextRound[Math.floor(position / 2)];
        match.nextMatchId = next.id;
        match.nextMatchSlot = position % 2 === 0 ? 1 : 2;
      }

      matches.push(match);
    });
  }

  return { participants, matches };
}

/** 'empty' | 'ready' | 'decided' — see the Bracket Match states in CONTEXT.md. */
export function matchState(match) {
  if (match.winnerParticipantId) return 'decided';
  if (match.slot1ParticipantId && match.slot2ParticipantId) return 'ready';
  return 'empty';
}

/**
 * Records a winner and cascades them into the next match's slot.
 * Validates the target match is 'ready' and the winner occupies one of its
 * two slots — rejects stale/malformed requests rather than silently
 * corrupting the bracket.
 * @returns {Array<object>} a new matches array (does not mutate the input)
 */
export function recordWinner(matches, matchId, winnerParticipantId) {
  const target = matches.find((m) => m.id === matchId);
  if (!target) {
    throw new Error(`No match with id ${matchId}`);
  }
  if (matchState(target) !== 'ready') {
    throw new Error(`Match ${matchId} is not ready to be decided`);
  }
  if (
    winnerParticipantId !== target.slot1ParticipantId &&
    winnerParticipantId !== target.slot2ParticipantId
  ) {
    throw new Error(`${winnerParticipantId} is not a participant in match ${matchId}`);
  }

  return matches.map((match) => {
    if (match.id === matchId) {
      return { ...match, winnerParticipantId };
    }
    if (target.nextMatchId && match.id === target.nextMatchId) {
      const slotKey = target.nextMatchSlot === 1 ? 'slot1ParticipantId' : 'slot2ParticipantId';
      return { ...match, [slotKey]: winnerParticipantId };
    }
    return match;
  });
}

/** True once the final match (the one with no nextMatchId) has a winner. */
export function isTournamentComplete(matches) {
  const final = matches.find((m) => m.nextMatchId === null);
  return Boolean(final && final.winnerParticipantId);
}
