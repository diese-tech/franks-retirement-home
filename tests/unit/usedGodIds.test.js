import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  readUsedGodIds,
  addUsedGodId,
  removeUsedGodId,
  getEffectiveVaultedGodIds,
} from '@/lib/usedGodIds';

// ─── readUsedGodIds ───────────────────────────────────────────────────────────
describe('readUsedGodIds', () => {
  it('returns the array when usedGodIds is a valid array', () => {
    expect(readUsedGodIds({ usedGodIds: ['a', 'b'] })).toEqual(['a', 'b']);
  });

  it('returns empty array for empty array', () => {
    expect(readUsedGodIds({ usedGodIds: [] })).toEqual([]);
  });

  it('returns empty array when usedGodIds is null', () => {
    expect(readUsedGodIds({ usedGodIds: null })).toEqual([]);
  });

  it('returns empty array when usedGodIds is undefined', () => {
    expect(readUsedGodIds({ usedGodIds: undefined })).toEqual([]);
  });

  it('returns empty array when usedGodIds is a string (junk data)', () => {
    expect(readUsedGodIds({ usedGodIds: 'bad' })).toEqual([]);
  });

  it('returns empty array when usedGodIds is a number', () => {
    expect(readUsedGodIds({ usedGodIds: 42 })).toEqual([]);
  });

  it('returns empty array when draft is null', () => {
    expect(readUsedGodIds(null)).toEqual([]);
  });

  it('returns empty array when draft is undefined', () => {
    expect(readUsedGodIds(undefined)).toEqual([]);
  });
});

// ─── addUsedGodId ────────────────────────────────────────────────────────────
describe('addUsedGodId', () => {
  it('adds a new godId to an empty array', () => {
    expect(addUsedGodId([], 'zeus')).toEqual(['zeus']);
  });

  it('adds a new godId without disturbing existing entries', () => {
    expect(addUsedGodId(['ares'], 'zeus')).toEqual(['ares', 'zeus']);
  });

  it('deduplicates — does not add if already present', () => {
    expect(addUsedGodId(['zeus', 'ares'], 'zeus')).toEqual(['zeus', 'ares']);
  });

  it('preserves insertion order', () => {
    const result = addUsedGodId(['a', 'b', 'c'], 'd');
    expect(result).toEqual(['a', 'b', 'c', 'd']);
  });

  it('is a no-op for falsy godId', () => {
    expect(addUsedGodId(['a'], null)).toEqual(['a']);
    expect(addUsedGodId(['a'], undefined)).toEqual(['a']);
    expect(addUsedGodId(['a'], '')).toEqual(['a']);
  });

  it('returns a new array (does not mutate)', () => {
    const orig = ['a'];
    const result = addUsedGodId(orig, 'b');
    expect(result).not.toBe(orig);
  });
});

// ─── removeUsedGodId ─────────────────────────────────────────────────────────
describe('removeUsedGodId', () => {
  it('removes godId when it has no other references', () => {
    const result = removeUsedGodId(['zeus'], 'zeus', { picks: [], bans: [] });
    expect(result).toEqual([]);
  });

  it('does NOT remove if another pick still references the godId', () => {
    const picks = [{ id: 'p2', godId: 'zeus' }];
    const result = removeUsedGodId(['zeus'], 'zeus', { picks, bans: [], excludePickId: 'p1' });
    expect(result).toEqual(['zeus']);
  });

  it('does NOT remove if a ban still references the godId', () => {
    const bans = [{ godId: 'zeus' }];
    const result = removeUsedGodId(['zeus'], 'zeus', { picks: [], bans });
    expect(result).toEqual(['zeus']);
  });

  it('excludePickId causes that pick to be ignored in still-referenced check', () => {
    // Only pick referencing zeus is the one being undone — should be removed
    const picks = [{ id: 'p1', godId: 'zeus' }];
    const result = removeUsedGodId(['zeus'], 'zeus', { picks, bans: [], excludePickId: 'p1' });
    expect(result).toEqual([]);
  });

  it('is a no-op when godId is not in existing array', () => {
    const result = removeUsedGodId(['ares'], 'zeus', { picks: [], bans: [] });
    expect(result).toEqual(['ares']);
  });

  it('is a no-op for falsy godId', () => {
    const result = removeUsedGodId(['a'], null, { picks: [], bans: [] });
    expect(result).toEqual(['a']);
  });

  it('returns a new array (does not mutate)', () => {
    const orig = ['zeus'];
    const result = removeUsedGodId(orig, 'zeus', { picks: [], bans: [] });
    expect(result).not.toBe(orig);
  });

  it('preserves other godIds when removing one', () => {
    const result = removeUsedGodId(['ares', 'zeus', 'ra'], 'zeus', { picks: [], bans: [] });
    expect(result).toEqual(['ares', 'ra']);
  });
});

// ─── getEffectiveVaultedGodIds — mocked Prisma ───────────────────────────────
// We mock lib/db so we never touch a real database in unit tests.

vi.mock('@/lib/db', () => {
  const prisma = {
    draft: { findUnique: vi.fn() },
    game: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
  };
  return { default: prisma };
});

// Import prisma AFTER the mock so we get the mocked version
const { default: prisma } = await import('@/lib/db');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getEffectiveVaultedGodIds', () => {
  it('returns [] when draft does not exist', async () => {
    prisma.draft.findUnique.mockResolvedValue(null);
    expect(await getEffectiveVaultedGodIds('nonexistent')).toEqual([]);
  });

  it('standalone draft returns its own usedGodIds', async () => {
    prisma.draft.findUnique.mockResolvedValue({ usedGodIds: ['zeus', 'ares'], gameId: null });
    expect(await getEffectiveVaultedGodIds('draft-1')).toEqual(['zeus', 'ares']);
  });

  it('standalone draft normalizes null usedGodIds to []', async () => {
    prisma.draft.findUnique.mockResolvedValue({ usedGodIds: null, gameId: null });
    expect(await getEffectiveVaultedGodIds('draft-1')).toEqual([]);
  });

  it('match-bound draft returns ownVault when game not found', async () => {
    prisma.draft.findUnique.mockResolvedValue({ usedGodIds: ['ra'], gameId: 'game-1' });
    prisma.game.findUnique.mockResolvedValue(null);
    expect(await getEffectiveVaultedGodIds('draft-1')).toEqual(['ra']);
  });

  it('match-bound Game 1 has no prior-game vault (no sibling games)', async () => {
    prisma.draft.findUnique.mockResolvedValue({ usedGodIds: [], gameId: 'game-1' });
    prisma.game.findUnique.mockResolvedValue({ matchId: 'match-1', gameNumber: 1 });
    prisma.game.findMany.mockResolvedValue([]); // no earlier games
    expect(await getEffectiveVaultedGodIds('draft-1')).toEqual([]);
  });

  it('match-bound Game 2 includes Game 1 picks in vault', async () => {
    prisma.draft.findUnique.mockResolvedValue({ usedGodIds: [], gameId: 'game-2' });
    prisma.game.findUnique.mockResolvedValue({ matchId: 'match-1', gameNumber: 2 });
    prisma.game.findMany.mockResolvedValue([
      {
        draft: {
          id: 'draft-g1',
          picks: [{ godId: 'zeus' }, { godId: 'ares' }],
        },
      },
    ]);
    const vault = await getEffectiveVaultedGodIds('draft-2');
    expect(vault).toContain('zeus');
    expect(vault).toContain('ares');
  });

  it('match-bound Game 2 does NOT include Game 1 bans in vault (bug fix)', async () => {
    prisma.draft.findUnique.mockResolvedValue({ usedGodIds: [], gameId: 'game-2' });
    prisma.game.findUnique.mockResolvedValue({ matchId: 'match-1', gameNumber: 2 });
    // Game 1 had picks for zeus and ares, and bans for ra and loki
    prisma.game.findMany.mockResolvedValue([
      {
        draft: {
          id: 'draft-g1',
          picks: [{ godId: 'zeus' }, { godId: 'ares' }],
          // Note: the fixed code does NOT select bans from sibling drafts,
          // so even if bans were returned they'd be ignored — but we verify
          // the result does not contain ra or loki
        },
      },
    ]);
    const vault = await getEffectiveVaultedGodIds('draft-2');
    expect(vault).toContain('zeus');
    expect(vault).toContain('ares');
    expect(vault).not.toContain('ra');
    expect(vault).not.toContain('loki');
  });

  it('duplicate prior picks are deduped in the vault', async () => {
    prisma.draft.findUnique.mockResolvedValue({ usedGodIds: ['zeus'], gameId: 'game-2' });
    prisma.game.findUnique.mockResolvedValue({ matchId: 'match-1', gameNumber: 2 });
    // sibling game also has zeus picked — should only appear once
    prisma.game.findMany.mockResolvedValue([
      {
        draft: {
          id: 'draft-g1',
          picks: [{ godId: 'zeus' }, { godId: 'ares' }],
        },
      },
    ]);
    const vault = await getEffectiveVaultedGodIds('draft-2');
    expect(vault.filter((g) => g === 'zeus')).toHaveLength(1);
  });

  it('sibling game with no draft is skipped safely', async () => {
    prisma.draft.findUnique.mockResolvedValue({ usedGodIds: [], gameId: 'game-2' });
    prisma.game.findUnique.mockResolvedValue({ matchId: 'match-1', gameNumber: 2 });
    prisma.game.findMany.mockResolvedValue([{ draft: null }]);
    expect(await getEffectiveVaultedGodIds('draft-2')).toEqual([]);
  });

  it('picks with null godId are not included in vault', async () => {
    prisma.draft.findUnique.mockResolvedValue({ usedGodIds: [], gameId: 'game-2' });
    prisma.game.findUnique.mockResolvedValue({ matchId: 'match-1', gameNumber: 2 });
    prisma.game.findMany.mockResolvedValue([
      {
        draft: {
          id: 'draft-g1',
          picks: [{ godId: null }, { godId: 'zeus' }],
        },
      },
    ]);
    const vault = await getEffectiveVaultedGodIds('draft-2');
    expect(vault).toEqual(['zeus']);
  });

  it('ownVault is included alongside sibling picks', async () => {
    prisma.draft.findUnique.mockResolvedValue({ usedGodIds: ['ra'], gameId: 'game-2' });
    prisma.game.findUnique.mockResolvedValue({ matchId: 'match-1', gameNumber: 2 });
    prisma.game.findMany.mockResolvedValue([
      {
        draft: {
          id: 'draft-g1',
          picks: [{ godId: 'zeus' }],
        },
      },
    ]);
    const vault = await getEffectiveVaultedGodIds('draft-2');
    expect(vault).toContain('ra');
    expect(vault).toContain('zeus');
  });
});
