/**
 * API tests for POST /api/stats/import
 * Admin: bulk upsert StatLine rows from CSV data (fallback path when
 * ForgeLens/OCR is unavailable).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeReq, makeInvalidJsonReq, unwrap } from './_helpers.js';

// ─── Mock next/server ────────────────────────────────────────────────────────
vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((body, init) => ({ _body: body, _status: init?.status ?? 200 })),
  },
}));

// ─── Mock @/lib/resolveAuth ──────────────────────────────────────────────────
vi.mock('@/lib/resolveAuth', () => ({
  resolveAdminAuth: vi.fn(async () => null),
}));

// ─── Mock @/lib/audit ────────────────────────────────────────────────────────
vi.mock('@/lib/audit', () => ({
  logAudit: vi.fn(),
}));

// ─── Mock @/lib/db ───────────────────────────────────────────────────────────
vi.mock('@/lib/db', () => {
  const prisma = {
    game: { findUnique: vi.fn() },
    player: { findFirst: vi.fn(), findUnique: vi.fn() },
    playerAlias: { findUnique: vi.fn() },
    god: { findFirst: vi.fn() },
    statLine: { findUnique: vi.fn(), upsert: vi.fn() },
  };
  return { default: prisma };
});

const { default: prisma } = await import('@/lib/db');
const { resolveAdminAuth } = await import('@/lib/resolveAuth');
const { logAudit } = await import('@/lib/audit');
const { POST } = await import('@/app/api/stats/import/route.js');

const HOME_ID = 'home-team';
const AWAY_ID = 'away-team';

const GAME = {
  id: 'game-1',
  match: {
    homeTeam: { id: HOME_ID, tag: 'HT' },
    awayTeam: { id: AWAY_ID, tag: 'AT' },
  },
};

const ROW = { playerDiscord: 'p1#0001', playerName: 'Player One', teamTag: 'HT', kills: '10', deaths: '2', assists: '8', damage: '50000', healing: '0', gold: '12000', godName: 'Zeus' };

beforeEach(() => {
  vi.clearAllMocks();
  resolveAdminAuth.mockResolvedValue(null);
  prisma.game.findUnique.mockResolvedValue(GAME);
  prisma.player.findFirst.mockResolvedValue({ id: 'player-1' });
  prisma.playerAlias.findUnique.mockResolvedValue(null);
  prisma.god.findFirst.mockResolvedValue({ id: 'god-1' });
  prisma.statLine.findUnique.mockResolvedValue(null);
  prisma.statLine.upsert.mockResolvedValue({});
});

describe('POST /api/stats/import', () => {
  it('returns 401 (admin guard response) when not authorized', async () => {
    const guard = { _body: { error: 'Unauthorized' }, _status: 401 };
    resolveAdminAuth.mockResolvedValue(guard);
    const res = await POST(makeReq({ gameId: 'game-1', rows: [ROW] }));
    expect(res).toBe(guard);
  });

  it('returns 400 for invalid JSON', async () => {
    const res = await POST(makeInvalidJsonReq());
    expect(unwrap(res).status).toBe(400);
  });

  it('returns 400 when gameId or rows is missing', async () => {
    expect(unwrap(await POST(makeReq({ rows: [ROW] }))).status).toBe(400);
    expect(unwrap(await POST(makeReq({ gameId: 'game-1', rows: [] }))).status).toBe(400);
  });

  it('returns 400 when more than 500 rows are submitted', async () => {
    const rows = Array.from({ length: 501 }, () => ROW);
    const res = await POST(makeReq({ gameId: 'game-1', rows }));
    expect(unwrap(res).status).toBe(400);
    expect(unwrap(res).body.error).toMatch(/maximum 500/i);
  });

  it('returns 404 when the game does not exist', async () => {
    prisma.game.findUnique.mockResolvedValue(null);
    const res = await POST(makeReq({ gameId: 'game-1', rows: [ROW] }));
    expect(unwrap(res).status).toBe(404);
  });

  it('imports a new row and reports imported count', async () => {
    const res = await POST(makeReq({ gameId: 'game-1', rows: [ROW] }));
    expect(unwrap(res).status).toBe(200);
    expect(unwrap(res).body).toEqual({ imported: 1, updated: 0, errors: [] });
    expect(prisma.statLine.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { gameId_playerId: { gameId: 'game-1', playerId: 'player-1' } },
        create: expect.objectContaining({ teamId: HOME_ID, godId: 'god-1', kills: 10, deaths: 2, assists: 8, damage: 50000, gold: 12000 }),
      }),
    );
    expect(logAudit).toHaveBeenCalledWith('StatLine', 'game-1', 'bulk_import', expect.any(Object));
  });

  it('reports updated (not imported) when a StatLine already exists', async () => {
    prisma.statLine.findUnique.mockResolvedValue({ id: 'existing' });
    const res = await POST(makeReq({ gameId: 'game-1', rows: [ROW] }));
    expect(unwrap(res).body).toEqual({ imported: 0, updated: 1, errors: [] });
  });

  it('resolves player by discordUsername first, falling back to name then alias', async () => {
    prisma.player.findFirst.mockResolvedValueOnce(null); // discord lookup misses
    prisma.player.findFirst.mockResolvedValueOnce({ id: 'player-2' }); // name lookup hits
    const res = await POST(makeReq({ gameId: 'game-1', rows: [ROW] }));
    expect(unwrap(res).body.imported).toBe(1);
  });

  it('records a row-level error when the player cannot be resolved', async () => {
    prisma.player.findFirst.mockResolvedValue(null);
    prisma.playerAlias.findUnique.mockResolvedValue(null);
    const res = await POST(makeReq({ gameId: 'game-1', rows: [{ ...ROW, playerDiscord: 'nope', playerName: 'Nope' }] }));
    expect(unwrap(res).body.imported).toBe(0);
    expect(unwrap(res).body.errors).toEqual([
      expect.objectContaining({ row: 1, reason: expect.stringMatching(/Player not found/i) }),
    ]);
  });

  it('records a row-level error when the team tag does not match home or away', async () => {
    const res = await POST(makeReq({ gameId: 'game-1', rows: [{ ...ROW, teamTag: 'ZZ' }] }));
    expect(unwrap(res).body.errors).toEqual([
      expect.objectContaining({ row: 1, reason: expect.stringMatching(/doesn't match/i) }),
    ]);
  });

  it('continues processing subsequent rows after an unexpected per-row error', async () => {
    prisma.statLine.upsert
      .mockRejectedValueOnce(new Error('constraint violation'))
      .mockResolvedValueOnce({});
    const res = await POST(makeReq({ gameId: 'game-1', rows: [ROW, ROW] }));
    expect(unwrap(res).body.errors).toEqual([
      expect.objectContaining({ row: 1, reason: 'Unexpected error processing this row' }),
    ]);
    expect(unwrap(res).body.imported).toBe(1);
  });
});
