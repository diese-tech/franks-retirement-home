import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db', () => {
  const prisma = {
    draft: { findUnique: vi.fn(), create: vi.fn() },
    match: { findUnique: vi.fn() },
    game: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  };
  return { default: prisma };
});

const { default: prisma } = await import('@/lib/db');
const { buildDraftForGame } = await import('@/lib/matchDraftProvisioning');

const MATCH_ID = 'match-1';
const GAME_ID  = 'game-1';

const BASE_MATCH = {
  id: MATCH_ID,
  homeTeam: {
    name: 'Home Team',
    members: [{ playerId: 'p1', player: {} }, { playerId: 'p2', player: {} }],
  },
  awayTeam: {
    name: 'Away Team',
    members: [{ playerId: 'p3', player: {} }, { playerId: 'p4', player: {} }],
  },
};

const BASE_GAME = { id: GAME_ID, matchId: MATCH_ID, gameNumber: 1 };

beforeEach(() => {
  vi.clearAllMocks();
  prisma.draft.findUnique.mockResolvedValue(null); // no existing draft
  prisma.match.findUnique.mockResolvedValue(BASE_MATCH);
  prisma.game.findUnique.mockResolvedValue(BASE_GAME);
  prisma.$transaction.mockImplementation(async (fn) => fn(prisma));
  prisma.draft.create.mockResolvedValue({ id: 'new-draft', captainAKey: 'key-a', captainBKey: 'key-b', adminKey: 'key-admin' });
});

describe('buildDraftForGame', () => {
  it('creates a new draft and returns created=true', async () => {
    const { draft, created } = await buildDraftForGame(MATCH_ID, GAME_ID);
    expect(created).toBe(true);
    expect(draft.id).toBe('new-draft');
    expect(prisma.draft.create).toHaveBeenCalledOnce();
  });

  it('is idempotent — returns existing draft with created=false', async () => {
    const existing = { id: 'existing-draft', captainAKey: 'a', captainBKey: 'b', adminKey: 'c' };
    prisma.draft.findUnique.mockResolvedValue(existing);

    const { draft, created } = await buildDraftForGame(MATCH_ID, GAME_ID);
    expect(created).toBe(false);
    expect(draft).toBe(existing);
    expect(prisma.draft.create).not.toHaveBeenCalled();
  });

  it('draft is created with captainAKey, captainBKey, adminKey', async () => {
    await buildDraftForGame(MATCH_ID, GAME_ID);
    const callArgs = prisma.draft.create.mock.calls[0][0].data;
    expect(callArgs.captainAKey).toBeTruthy();
    expect(callArgs.captainBKey).toBeTruthy();
    expect(callArgs.adminKey).toBeTruthy();
    // Keys must be distinct
    expect(callArgs.captainAKey).not.toBe(callArgs.captainBKey);
    expect(callArgs.captainAKey).not.toBe(callArgs.adminKey);
  });

  it('seeds DraftPick rows from home (team A) and away (team B) members', async () => {
    await buildDraftForGame(MATCH_ID, GAME_ID);
    const picks = prisma.draft.create.mock.calls[0][0].data.picks.create;
    const teamA = picks.filter((p) => p.team === 'A');
    const teamB = picks.filter((p) => p.team === 'B');
    expect(teamA).toHaveLength(2); // 2 home members
    expect(teamB).toHaveLength(2); // 2 away members
    expect(teamA.map((p) => p.playerId)).toContain('p1');
    expect(teamB.map((p) => p.playerId)).toContain('p3');
  });

  it('throws when match not found', async () => {
    prisma.match.findUnique.mockResolvedValue(null);
    await expect(buildDraftForGame(MATCH_ID, GAME_ID)).rejects.toThrow('not found');
  });

  it('throws when game not found or belongs to wrong match', async () => {
    prisma.game.findUnique.mockResolvedValue({ id: GAME_ID, matchId: 'OTHER-MATCH', gameNumber: 1 });
    await expect(buildDraftForGame(MATCH_ID, GAME_ID)).rejects.toThrow('not found');
  });
});
