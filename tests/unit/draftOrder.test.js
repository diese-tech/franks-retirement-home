import { describe, it, expect } from 'vitest';
import {
  BAN_ORDER,
  PICK_ORDER,
  TOTAL_BANS,
  TOTAL_PICKS,
  currentBanTeam,
  currentPickTeam,
} from '@/lib/draftOrder';

describe('draftOrder constants', () => {
  it('BAN_ORDER has 6 entries alternating A/B starting with A', () => {
    expect(BAN_ORDER).toEqual(['A', 'B', 'A', 'B', 'A', 'B']);
  });

  it('PICK_ORDER has 10 entries with the correct sequence', () => {
    expect(PICK_ORDER).toEqual(['A', 'B', 'B', 'A', 'A', 'B', 'B', 'A', 'A', 'B']);
  });

  it('TOTAL_BANS equals BAN_ORDER length', () => {
    expect(TOTAL_BANS).toBe(BAN_ORDER.length);
    expect(TOTAL_BANS).toBe(6);
  });

  it('TOTAL_PICKS equals PICK_ORDER length', () => {
    expect(TOTAL_PICKS).toBe(PICK_ORDER.length);
    expect(TOTAL_PICKS).toBe(10);
  });

  it('each team gets exactly 3 bans', () => {
    const aCnt = BAN_ORDER.filter((t) => t === 'A').length;
    const bCnt = BAN_ORDER.filter((t) => t === 'B').length;
    expect(aCnt).toBe(3);
    expect(bCnt).toBe(3);
  });

  it('each team gets exactly 5 picks', () => {
    const aCnt = PICK_ORDER.filter((t) => t === 'A').length;
    const bCnt = PICK_ORDER.filter((t) => t === 'B').length;
    expect(aCnt).toBe(5);
    expect(bCnt).toBe(5);
  });
});

describe('currentBanTeam', () => {
  it('returns the correct team for every ban slot', () => {
    BAN_ORDER.forEach((team, i) => {
      expect(currentBanTeam(i)).toBe(team);
    });
  });

  it('returns null when count equals TOTAL_BANS', () => {
    expect(currentBanTeam(TOTAL_BANS)).toBeNull();
  });

  it('returns null when count exceeds TOTAL_BANS', () => {
    expect(currentBanTeam(TOTAL_BANS + 5)).toBeNull();
  });

  it('ban 0 is team A', () => {
    expect(currentBanTeam(0)).toBe('A');
  });

  it('ban 1 is team B', () => {
    expect(currentBanTeam(1)).toBe('B');
  });
});

describe('currentPickTeam', () => {
  it('returns the correct team for every pick slot', () => {
    PICK_ORDER.forEach((team, i) => {
      expect(currentPickTeam(i)).toBe(team);
    });
  });

  it('returns null when count equals TOTAL_PICKS', () => {
    expect(currentPickTeam(TOTAL_PICKS)).toBeNull();
  });

  it('returns null when count exceeds TOTAL_PICKS', () => {
    expect(currentPickTeam(TOTAL_PICKS + 3)).toBeNull();
  });

  it('pick 0 is A, pick 1 is B, pick 2 is B', () => {
    expect(currentPickTeam(0)).toBe('A');
    expect(currentPickTeam(1)).toBe('B');
    expect(currentPickTeam(2)).toBe('B');
  });
});
