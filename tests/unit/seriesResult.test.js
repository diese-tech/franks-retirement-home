import { describe, it, expect } from 'vitest';
import {
  winsRequired,
  computeScore,
  checkSeriesComplete,
  gameCardState,
} from '@/lib/seriesResult';

const HOME = 'home-team';
const AWAY = 'away-team';

// ─── winsRequired ─────────────────────────────────────────────────────────────
describe('winsRequired', () => {
  it('BO1 requires 1 win', () => expect(winsRequired('BO1')).toBe(1));
  it('BO3 requires 2 wins', () => expect(winsRequired('BO3')).toBe(2));
  it('BO5 requires 3 wins', () => expect(winsRequired('BO5')).toBe(3));
  it('unknown format defaults to 1', () => expect(winsRequired('BOGUS')).toBe(1));
});

// ─── computeScore ─────────────────────────────────────────────────────────────
describe('computeScore', () => {
  it('returns 0-0 when no games have winners', () => {
    const games = [{ winnerTeamId: null }, { winnerTeamId: null }];
    expect(computeScore(games, HOME, AWAY)).toEqual({ homeWins: 0, awayWins: 0 });
  });

  it('counts home wins correctly', () => {
    const games = [
      { winnerTeamId: HOME },
      { winnerTeamId: AWAY },
      { winnerTeamId: HOME },
    ];
    expect(computeScore(games, HOME, AWAY)).toEqual({ homeWins: 2, awayWins: 1 });
  });

  it('ignores games won by neither team (null)', () => {
    const games = [{ winnerTeamId: HOME }, { winnerTeamId: null }];
    expect(computeScore(games, HOME, AWAY)).toEqual({ homeWins: 1, awayWins: 0 });
  });
});

// ─── checkSeriesComplete ──────────────────────────────────────────────────────
describe('checkSeriesComplete', () => {
  describe('BO1', () => {
    it('home wins 1-0 → series complete', () => {
      const games = [{ winnerTeamId: HOME }];
      expect(checkSeriesComplete(games, HOME, AWAY, 'BO1'))
        .toEqual({ complete: true, winnerTeamId: HOME });
    });

    it('no winner yet → not complete', () => {
      const games = [{ winnerTeamId: null }];
      expect(checkSeriesComplete(games, HOME, AWAY, 'BO1'))
        .toEqual({ complete: false, winnerTeamId: null });
    });
  });

  describe('BO3', () => {
    it('2-0 → series complete (home)', () => {
      const games = [{ winnerTeamId: HOME }, { winnerTeamId: HOME }, { winnerTeamId: null }];
      expect(checkSeriesComplete(games, HOME, AWAY, 'BO3'))
        .toEqual({ complete: true, winnerTeamId: HOME });
    });

    it('2-1 → series complete (away)', () => {
      const games = [{ winnerTeamId: HOME }, { winnerTeamId: AWAY }, { winnerTeamId: AWAY }];
      expect(checkSeriesComplete(games, HOME, AWAY, 'BO3'))
        .toEqual({ complete: true, winnerTeamId: AWAY });
    });

    it('1-1 → not complete', () => {
      const games = [{ winnerTeamId: HOME }, { winnerTeamId: AWAY }, { winnerTeamId: null }];
      expect(checkSeriesComplete(games, HOME, AWAY, 'BO3'))
        .toEqual({ complete: false, winnerTeamId: null });
    });

    it('1-0 after Game 1 → not complete', () => {
      const games = [{ winnerTeamId: HOME }, { winnerTeamId: null }, { winnerTeamId: null }];
      expect(checkSeriesComplete(games, HOME, AWAY, 'BO3'))
        .toEqual({ complete: false, winnerTeamId: null });
    });

    it('0-0 → not complete', () => {
      const games = [{ winnerTeamId: null }, { winnerTeamId: null }, { winnerTeamId: null }];
      expect(checkSeriesComplete(games, HOME, AWAY, 'BO3'))
        .toEqual({ complete: false, winnerTeamId: null });
    });
  });

  describe('BO5', () => {
    it('3-0 → series complete', () => {
      const games = Array(5).fill(null).map((_, i) => ({
        winnerTeamId: i < 3 ? HOME : null,
      }));
      expect(checkSeriesComplete(games, HOME, AWAY, 'BO5'))
        .toEqual({ complete: true, winnerTeamId: HOME });
    });

    it('2-2 → not complete', () => {
      const games = [HOME, AWAY, HOME, AWAY, null].map((t) => ({ winnerTeamId: t }));
      expect(checkSeriesComplete(games, HOME, AWAY, 'BO5'))
        .toEqual({ complete: false, winnerTeamId: null });
    });

    it('3-2 → series complete', () => {
      const games = [HOME, AWAY, HOME, AWAY, HOME].map((t) => ({ winnerTeamId: t }));
      expect(checkSeriesComplete(games, HOME, AWAY, 'BO5'))
        .toEqual({ complete: true, winnerTeamId: HOME });
    });
  });
});

// ─── gameCardState ────────────────────────────────────────────────────────────
describe('gameCardState', () => {
  it('unneeded when isUnneeded=true', () => {
    expect(gameCardState({}, false, true)).toBe('unneeded');
  });

  it('null game → draft_pending', () => {
    expect(gameCardState(null, false, false)).toBe('draft_pending');
  });

  it('resultStatus=confirmed → confirmed', () => {
    expect(gameCardState({ resultStatus: 'confirmed' }, false, false)).toBe('confirmed');
  });

  it('resultStatus=disputed → disputed', () => {
    expect(gameCardState({ resultStatus: 'disputed' }, false, false)).toBe('disputed');
  });

  it('resultStatus=reported → result_reported', () => {
    expect(gameCardState({ resultStatus: 'reported' }, false, false)).toBe('result_reported');
  });

  it('no resultStatus + no draft → draft_pending', () => {
    expect(gameCardState({ resultStatus: null, draft: null }, false, false)).toBe('draft_pending');
  });

  it('draft.status=complete → draft_complete', () => {
    expect(gameCardState({ resultStatus: null, draft: { status: 'complete' } }, false, false))
      .toBe('draft_complete');
  });

  it('draft.status=banning → draft_in_progress', () => {
    expect(gameCardState({ resultStatus: null, draft: { status: 'banning' } }, false, false))
      .toBe('draft_in_progress');
  });

  it('draft.status=lobby → draft_in_progress', () => {
    expect(gameCardState({ resultStatus: null, draft: { status: 'lobby' } }, false, false))
      .toBe('draft_in_progress');
  });
});
