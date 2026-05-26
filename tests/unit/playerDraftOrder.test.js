import { describe, it, expect } from 'vitest';
import {
  buildPlayerDraftFormat,
  getDraftTurn,
  getFirstDraftTurn,
  getNextDraftTurn,
  flatIndexToTurn,
  totalPicks,
  currentPickTeam,
  flattenFormat,
} from '@/lib/playerDraftOrder';

// ─── helpers ─────────────────────────────────────────────────────────────────
const ORDER_4 = ['T1', 'T2', 'T3', 'T4'];
const ORDER_2 = ['A', 'B'];

// ─── buildPlayerDraftFormat ──────────────────────────────────────────────────
describe('buildPlayerDraftFormat', () => {
  it('builds 1 phase for 1 round', () => {
    const fmt = buildPlayerDraftFormat(ORDER_2, 1);
    expect(fmt).toHaveLength(1);
    expect(fmt[0].sequence).toEqual(['A', 'B']);
  });

  it('even phases use currentOrder as-is', () => {
    const fmt = buildPlayerDraftFormat(ORDER_4, 2);
    expect(fmt[0].sequence).toEqual(ORDER_4);
  });

  it('odd phases use currentOrder reversed', () => {
    const fmt = buildPlayerDraftFormat(ORDER_4, 2);
    expect(fmt[1].sequence).toEqual([...ORDER_4].reverse());
  });

  it('snake pattern is correct for 3 rounds with 4 teams', () => {
    const fmt = buildPlayerDraftFormat(ORDER_4, 3);
    expect(fmt[0].sequence).toEqual(['T1', 'T2', 'T3', 'T4']);
    expect(fmt[1].sequence).toEqual(['T4', 'T3', 'T2', 'T1']);
    expect(fmt[2].sequence).toEqual(['T1', 'T2', 'T3', 'T4']);
  });

  it('snake pattern for 5 rounds with 2 teams matches architecture doc', () => {
    const fmt = buildPlayerDraftFormat(['A', 'B'], 5);
    expect(flattenFormat(fmt)).toEqual(['A', 'B', 'B', 'A', 'A', 'B', 'B', 'A', 'A', 'B']);
  });

  it('does not mutate the input array', () => {
    const order = ['X', 'Y'];
    buildPlayerDraftFormat(order, 3);
    expect(order).toEqual(['X', 'Y']);
  });

  it('returns empty format for 0 rounds', () => {
    const fmt = buildPlayerDraftFormat(ORDER_2, 0);
    expect(fmt).toHaveLength(0);
  });

  it('returns empty phases for empty order', () => {
    const fmt = buildPlayerDraftFormat([], 2);
    expect(fmt[0].sequence).toEqual([]);
    expect(fmt[1].sequence).toEqual([]);
  });
});

// ─── getDraftTurn ────────────────────────────────────────────────────────────
describe('getDraftTurn', () => {
  const fmt = buildPlayerDraftFormat(ORDER_4, 2);

  it('returns correct turn for phase 0 step 0', () => {
    expect(getDraftTurn(fmt, 0, 0)).toEqual({ phaseIndex: 0, stepIndex: 0, teamId: 'T1' });
  });

  it('returns correct turn for phase 0 step 2', () => {
    expect(getDraftTurn(fmt, 0, 2)).toEqual({ phaseIndex: 0, stepIndex: 2, teamId: 'T3' });
  });

  it('returns correct turn for phase 1 step 0 (reversed)', () => {
    expect(getDraftTurn(fmt, 1, 0)).toEqual({ phaseIndex: 1, stepIndex: 0, teamId: 'T4' });
  });

  it('returns null for out-of-range stepIndex', () => {
    expect(getDraftTurn(fmt, 0, 10)).toBeNull();
  });

  it('returns null for out-of-range phaseIndex', () => {
    expect(getDraftTurn(fmt, 99, 0)).toBeNull();
  });
});

// ─── getFirstDraftTurn ───────────────────────────────────────────────────────
describe('getFirstDraftTurn', () => {
  it('returns phase 0 step 0', () => {
    const fmt = buildPlayerDraftFormat(ORDER_4, 2);
    expect(getFirstDraftTurn(fmt)).toEqual({ phaseIndex: 0, stepIndex: 0, teamId: 'T1' });
  });

  it('returns null for empty format', () => {
    expect(getFirstDraftTurn([])).toBeNull();
  });
});

// ─── getNextDraftTurn ────────────────────────────────────────────────────────
describe('getNextDraftTurn', () => {
  const fmt = buildPlayerDraftFormat(ORDER_4, 2); // 4+4 = 8 picks

  it('advances within the same phase', () => {
    const next = getNextDraftTurn(fmt, 0, 0);
    expect(next).toEqual({ phaseIndex: 0, stepIndex: 1, teamId: 'T2' });
  });

  it('rolls over to the next phase when at the last step', () => {
    const next = getNextDraftTurn(fmt, 0, 3); // last step of phase 0
    expect(next).toEqual({ phaseIndex: 1, stepIndex: 0, teamId: 'T4' });
  });

  it('returns null at the very last step of the last phase', () => {
    const next = getNextDraftTurn(fmt, 1, 3); // last step of last phase
    expect(next).toBeNull();
  });
});

// ─── flatIndexToTurn ─────────────────────────────────────────────────────────
describe('flatIndexToTurn', () => {
  const fmt = buildPlayerDraftFormat(ORDER_4, 2); // phases: [T1,T2,T3,T4], [T4,T3,T2,T1]

  it('flat index 0 → phase 0 step 0', () => {
    expect(flatIndexToTurn(fmt, 0)).toEqual({ phaseIndex: 0, stepIndex: 0, teamId: 'T1' });
  });

  it('flat index 3 → last step of phase 0', () => {
    expect(flatIndexToTurn(fmt, 3)).toEqual({ phaseIndex: 0, stepIndex: 3, teamId: 'T4' });
  });

  it('flat index 4 → first step of phase 1', () => {
    expect(flatIndexToTurn(fmt, 4)).toEqual({ phaseIndex: 1, stepIndex: 0, teamId: 'T4' });
  });

  it('flat index 7 → last step of phase 1', () => {
    expect(flatIndexToTurn(fmt, 7)).toEqual({ phaseIndex: 1, stepIndex: 3, teamId: 'T1' });
  });

  it('returns null for index equal to totalPicks', () => {
    expect(flatIndexToTurn(fmt, 8)).toBeNull();
  });

  it('returns null for index beyond totalPicks', () => {
    expect(flatIndexToTurn(fmt, 100)).toBeNull();
  });
});

// ─── totalPicks ──────────────────────────────────────────────────────────────
describe('totalPicks', () => {
  it('4 teams × 1 round = 4', () => {
    expect(totalPicks(buildPlayerDraftFormat(ORDER_4, 1))).toBe(4);
  });

  it('4 teams × 2 rounds = 8', () => {
    expect(totalPicks(buildPlayerDraftFormat(ORDER_4, 2))).toBe(8);
  });

  it('4 teams × 5 rounds = 20', () => {
    expect(totalPicks(buildPlayerDraftFormat(ORDER_4, 5))).toBe(20);
  });

  it('2 teams × 5 rounds = 10', () => {
    expect(totalPicks(buildPlayerDraftFormat(ORDER_2, 5))).toBe(10);
  });

  it('0 rounds = 0', () => {
    expect(totalPicks(buildPlayerDraftFormat(ORDER_4, 0))).toBe(0);
  });
});

// ─── currentPickTeam ─────────────────────────────────────────────────────────
describe('currentPickTeam (playerDraftOrder)', () => {
  const fmt = buildPlayerDraftFormat(['A', 'B'], 5);
  const flat = flattenFormat(fmt); // [A,B,B,A,A,B,B,A,A,B]

  it('returns correct team for each flat index', () => {
    flat.forEach((team, i) => {
      expect(currentPickTeam(fmt, i)).toBe(team);
    });
  });

  it('returns null when flat index equals total picks', () => {
    expect(currentPickTeam(fmt, 10)).toBeNull();
  });

  it('returns null when flat index exceeds total picks', () => {
    expect(currentPickTeam(fmt, 99)).toBeNull();
  });
});

// ─── cursor walks full draft without skipping or doubling ────────────────────
describe('cursor walks', () => {
  it('getNextDraftTurn walks all 10 turns in a 2-team 5-round draft', () => {
    const fmt = buildPlayerDraftFormat(['A', 'B'], 5);
    const expected = flattenFormat(fmt);
    const visited = [];
    let turn = getFirstDraftTurn(fmt);
    while (turn) {
      visited.push(turn.teamId);
      turn = getNextDraftTurn(fmt, turn.phaseIndex, turn.stepIndex);
    }
    expect(visited).toEqual(expected);
  });

  it('cursor transitions match flatIndexToTurn at every step', () => {
    const fmt = buildPlayerDraftFormat(ORDER_4, 3);
    const total = totalPicks(fmt);
    let turn = getFirstDraftTurn(fmt);
    for (let i = 0; i < total; i++) {
      expect(turn).toEqual(flatIndexToTurn(fmt, i));
      turn = getNextDraftTurn(fmt, turn.phaseIndex, turn.stepIndex);
    }
    expect(turn).toBeNull();
  });
});
