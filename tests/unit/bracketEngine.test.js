import { describe, it, expect } from 'vitest';
import {
  generateBracket,
  recordWinner,
  isTournamentComplete,
  matchState,
} from '@/lib/bracketEngine';

describe('generateBracket', () => {
  it('rejects a non-power-of-2 participant count', () => {
    expect(() => generateBracket(['A', 'B', 'C'])).toThrow();
  });

  it('rejects an empty list', () => {
    expect(() => generateBracket([])).toThrow();
  });

  it('builds a 2-participant bracket: one match, no next match', () => {
    const { participants, matches } = generateBracket(['A', 'B']);
    expect(participants).toHaveLength(2);
    expect(matches).toHaveLength(1);

    const [final] = matches;
    expect(final.round).toBe(1);
    expect(final.nextMatchId).toBeNull();
    expect([final.slot1ParticipantId, final.slot2ParticipantId].sort()).toEqual(
      [participants[0].id, participants[1].id].sort()
    );
  });

  it('builds a 4-participant bracket: 2 round-1 matches feeding 1 final', () => {
    const { participants, matches } = generateBracket(['A', 'B', 'C', 'D']);
    expect(matches).toHaveLength(3);

    const round1 = matches.filter((m) => m.round === 1);
    const round2 = matches.filter((m) => m.round === 2);
    expect(round1).toHaveLength(2);
    expect(round2).toHaveLength(1);

    // Round 1 matches pair consecutive seeds and are empty/ready, never decided.
    expect(round1[0].slot1ParticipantId).toBe(participants[0].id);
    expect(round1[0].slot2ParticipantId).toBe(participants[1].id);
    expect(round1[1].slot1ParticipantId).toBe(participants[2].id);
    expect(round1[1].slot2ParticipantId).toBe(participants[3].id);
    round1.forEach((m) => expect(matchState(m)).toBe('ready'));

    // Both round-1 matches feed into the single round-2 (final) match.
    expect(round1[0].nextMatchId).toBe(round2[0].id);
    expect(round1[1].nextMatchId).toBe(round2[0].id);
    expect(round1[0].nextMatchSlot).toBe(1);
    expect(round1[1].nextMatchSlot).toBe(2);

    // The final match starts empty — nothing has fed into it yet.
    expect(matchState(round2[0])).toBe('empty');
    expect(round2[0].nextMatchId).toBeNull();
  });

  it('builds an 8-participant bracket with the right round shape', () => {
    const { matches } = generateBracket(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);
    expect(matches.filter((m) => m.round === 1)).toHaveLength(4);
    expect(matches.filter((m) => m.round === 2)).toHaveLength(2);
    expect(matches.filter((m) => m.round === 3)).toHaveLength(1);
    expect(matches).toHaveLength(7);
  });

  it('treats "BYE" as an ordinary participant name — no special-casing', () => {
    const { participants, matches } = generateBracket(['A', 'BYE']);
    expect(participants.map((p) => p.name)).toEqual(['A', 'BYE']);
    expect(matchState(matches[0])).toBe('ready');
  });
});

describe('recordWinner', () => {
  it('sets the winner and cascades into the next match slot', () => {
    const { participants, matches } = generateBracket(['A', 'B', 'C', 'D']);
    const [m1, m2] = matches.filter((m) => m.round === 1);
    const [final] = matches.filter((m) => m.round === 2);

    const afterM1 = recordWinner(matches, m1.id, participants[0].id);
    const updatedFinal = afterM1.find((m) => m.id === final.id);
    expect(updatedFinal.slot1ParticipantId).toBe(participants[0].id);
    expect(updatedFinal.slot2ParticipantId).toBeNull();
    expect(matchState(afterM1.find((m) => m.id === m1.id))).toBe('decided');

    const afterBoth = recordWinner(afterM1, m2.id, participants[3].id);
    const readyFinal = afterBoth.find((m) => m.id === final.id);
    expect(readyFinal.slot1ParticipantId).toBe(participants[0].id);
    expect(readyFinal.slot2ParticipantId).toBe(participants[3].id);
    expect(matchState(readyFinal)).toBe('ready');
  });

  it('does not mutate the input array', () => {
    const { participants, matches } = generateBracket(['A', 'B']);
    const original = JSON.parse(JSON.stringify(matches));
    recordWinner(matches, matches[0].id, participants[0].id);
    expect(matches).toEqual(original);
  });

  it('rejects an unknown match id', () => {
    const { participants, matches } = generateBracket(['A', 'B']);
    expect(() => recordWinner(matches, 'nope', participants[0].id)).toThrow();
  });

  it('rejects a winner that is not in the target match', () => {
    const { matches } = generateBracket(['A', 'B', 'C', 'D']);
    const [m1] = matches.filter((m) => m.round === 1);
    const [, m2] = matches.filter((m) => m.round === 1);
    expect(() => recordWinner(matches, m1.id, m2.slot1ParticipantId)).toThrow();
  });

  it('rejects recording a winner twice for the same match', () => {
    const { participants, matches } = generateBracket(['A', 'B']);
    const once = recordWinner(matches, matches[0].id, participants[0].id);
    expect(() => recordWinner(once, matches[0].id, participants[1].id)).toThrow();
  });

  it('rejects deciding a match that is not yet ready (empty slot)', () => {
    const { participants, matches } = generateBracket(['A', 'B', 'C', 'D']);
    const [final] = matches.filter((m) => m.round === 2);
    expect(() => recordWinner(matches, final.id, participants[0].id)).toThrow();
  });
});

describe('isTournamentComplete', () => {
  it('is false until the final match has a winner', () => {
    const { participants, matches } = generateBracket(['A', 'B', 'C', 'D']);
    expect(isTournamentComplete(matches)).toBe(false);

    const [m1, m2] = matches.filter((m) => m.round === 1);
    let updated = recordWinner(matches, m1.id, participants[0].id);
    expect(isTournamentComplete(updated)).toBe(false);

    updated = recordWinner(updated, m2.id, participants[3].id);
    expect(isTournamentComplete(updated)).toBe(false);

    const [final] = updated.filter((m) => m.round === 2);
    updated = recordWinner(updated, final.id, participants[0].id);
    expect(isTournamentComplete(updated)).toBe(true);
  });

  it('a single 2-participant bracket completes after one recorded winner', () => {
    const { participants, matches } = generateBracket(['A', 'B']);
    const updated = recordWinner(matches, matches[0].id, participants[0].id);
    expect(isTournamentComplete(updated)).toBe(true);
  });
});

describe('matchState', () => {
  it('empty when neither slot is filled', () => {
    expect(
      matchState({ slot1ParticipantId: null, slot2ParticipantId: null, winnerParticipantId: null })
    ).toBe('empty');
  });

  it('empty when only one slot is filled', () => {
    expect(
      matchState({ slot1ParticipantId: 'p1', slot2ParticipantId: null, winnerParticipantId: null })
    ).toBe('empty');
  });

  it('ready when both slots are filled and no winner', () => {
    expect(
      matchState({ slot1ParticipantId: 'p1', slot2ParticipantId: 'p2', winnerParticipantId: null })
    ).toBe('ready');
  });

  it('decided when a winner is set', () => {
    expect(
      matchState({ slot1ParticipantId: 'p1', slot2ParticipantId: 'p2', winnerParticipantId: 'p1' })
    ).toBe('decided');
  });
});
