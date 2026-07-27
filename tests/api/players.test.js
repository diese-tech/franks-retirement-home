/**
 * API tests for /api/players
 * Covers: GET (role filter), POST (create/update), DELETE (live-draft guard)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeReq, makeInvalidJsonReq, unwrap } from './_helpers.js';

// ─── Mock next/server ────────────────────────────────────────────────────────
vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((body, init) => ({ _body: body, _status: init?.status ?? 200, headers: { set: vi.fn() } })),
  },
}));

// ─── Mock @/lib/db ───────────────────────────────────────────────────────────
vi.mock('@/lib/db', () => {
  const prisma = {
    player: { findMany: vi.fn(), update: vi.fn(), create: vi.fn(), delete: vi.fn() },
    draftPick: { findFirst: vi.fn() },
  };
  return { default: prisma };
});

// ─── Mock @/lib/resolveAuth ──────────────────────────────────────────────────
vi.mock('@/lib/resolveAuth', () => ({
  resolveAdminAuth: vi.fn(async () => null),
}));

// ─── Mock @/lib/referenceData ────────────────────────────────────────────────
vi.mock('@/lib/referenceData', () => ({
  invalidatePlayers: vi.fn(),
}));

// ─── Mock @/lib/auditLog ──────────────────────────────────────────────────────
vi.mock('@/lib/auditLog', () => ({
  logAudit: vi.fn(),
}));

// ─── Mock @/lib/apiError ──────────────────────────────────────────────────────
vi.mock('@/lib/apiError', () => ({
  reportServerError: vi.fn(),
}));

const { default: prisma } = await import('@/lib/db');
const { resolveAdminAuth } = await import('@/lib/resolveAuth');
const { invalidatePlayers } = await import('@/lib/referenceData');
const { logAudit } = await import('@/lib/auditLog');
const { reportServerError } = await import('@/lib/apiError');
const { GET, POST, DELETE } = await import('@/app/api/players/route.js');

const PLAYER = { id: 'p1', name: 'Bob', role: 'Mid', discordUsername: null, division: null };

beforeEach(() => {
  vi.clearAllMocks();
  resolveAdminAuth.mockResolvedValue(null);
});

describe('GET /api/players', () => {
  it('lists all players without a role filter', async () => {
    prisma.player.findMany.mockResolvedValueOnce([PLAYER]);
    const res = await GET({ url: 'http://localhost/api/players' });
    expect(unwrap(res).status).toBe(200);
    expect(unwrap(res).body).toEqual([PLAYER]);
  });

  it('rejects an invalid role filter with 400', async () => {
    const res = await GET({ url: 'http://localhost/api/players?role=Bogus' });
    expect(unwrap(res).status).toBe(400);
  });

  it('reports and returns 500 on db failure', async () => {
    const dbErr = new Error('db down');
    prisma.player.findMany.mockRejectedValueOnce(dbErr);
    const res = await GET({ url: 'http://localhost/api/players' });
    expect(unwrap(res).status).toBe(500);
    expect(reportServerError).toHaveBeenCalledWith(dbErr, { route: 'players GET' });
  });
});

describe('POST /api/players', () => {
  it('returns 401 when not authorized', async () => {
    resolveAdminAuth.mockResolvedValueOnce({ _body: { error: 'Unauthorized' }, _status: 401 });
    const res = await POST(makeReq({ name: 'Bob', role: 'Mid' }));
    expect(res._status).toBe(401);
  });

  it('returns 400 for malformed JSON', async () => {
    const res = await POST(makeInvalidJsonReq());
    expect(unwrap(res).status).toBe(400);
  });

  it('rejects a missing name', async () => {
    const res = await POST(makeReq({ role: 'Mid' }));
    expect(unwrap(res).status).toBe(400);
  });

  it('rejects an invalid role', async () => {
    const res = await POST(makeReq({ name: 'Bob', role: 'Bogus' }));
    expect(unwrap(res).status).toBe(400);
  });

  it('rejects an over-length discordUsername', async () => {
    const res = await POST(makeReq({ name: 'Bob', role: 'Mid', discordUsername: 'x'.repeat(65) }));
    expect(unwrap(res).status).toBe(400);
  });

  it('rejects an over-length division', async () => {
    const res = await POST(makeReq({ name: 'Bob', role: 'Mid', division: 'x'.repeat(65) }));
    expect(unwrap(res).status).toBe(400);
  });

  it('creates a new player, invalidates cache, and logs an audit entry', async () => {
    prisma.player.create.mockResolvedValueOnce(PLAYER);
    const res = await POST(makeReq({ name: 'Bob', role: 'Mid' }));
    expect(unwrap(res).status).toBe(201);
    expect(invalidatePlayers).toHaveBeenCalled();
    expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({ entity: 'Player', action: 'player_created' }));
  });

  it('updates an existing player when id is provided', async () => {
    prisma.player.update.mockResolvedValueOnce({ ...PLAYER, name: 'Bobby' });
    const res = await POST(makeReq({ id: 'p1', name: 'Bobby', role: 'Mid' }));
    expect(unwrap(res).status).toBe(200);
    expect(prisma.player.update).toHaveBeenCalled();
    expect(invalidatePlayers).toHaveBeenCalled();
  });

  it('reports and returns 500 on db failure', async () => {
    const dbErr = new Error('db down');
    prisma.player.create.mockRejectedValueOnce(dbErr);
    const res = await POST(makeReq({ name: 'Bob', role: 'Mid' }));
    expect(unwrap(res).status).toBe(500);
    expect(reportServerError).toHaveBeenCalledWith(dbErr, { route: 'players POST' });
  });
});

describe('DELETE /api/players', () => {
  it('returns 401 when not authorized', async () => {
    resolveAdminAuth.mockResolvedValueOnce({ _body: { error: 'Unauthorized' }, _status: 401 });
    const res = await DELETE({ url: 'http://localhost/api/players?id=p1' });
    expect(res._status).toBe(401);
  });

  it('requires an id', async () => {
    const res = await DELETE({ url: 'http://localhost/api/players' });
    expect(unwrap(res).status).toBe(400);
  });

  it('blocks deletion of a player in a live draft', async () => {
    prisma.draftPick.findFirst.mockResolvedValueOnce({ id: 'pick-1' });
    const res = await DELETE({ url: 'http://localhost/api/players?id=p1' });
    expect(unwrap(res).status).toBe(409);
    expect(prisma.player.delete).not.toHaveBeenCalled();
  });

  it('deletes the player and invalidates cache when unreferenced', async () => {
    prisma.draftPick.findFirst.mockResolvedValueOnce(null);
    const res = await DELETE({ url: 'http://localhost/api/players?id=p1' });
    expect(unwrap(res).status).toBe(200);
    expect(prisma.player.delete).toHaveBeenCalledWith({ where: { id: 'p1' } });
    expect(invalidatePlayers).toHaveBeenCalled();
  });

  it('reports and returns 500 on db failure', async () => {
    const dbErr = new Error('db down');
    prisma.draftPick.findFirst.mockRejectedValueOnce(dbErr);
    const res = await DELETE({ url: 'http://localhost/api/players?id=p1' });
    expect(unwrap(res).status).toBe(500);
    expect(reportServerError).toHaveBeenCalledWith(dbErr, { route: 'players DELETE' });
  });
});
