/**
 * API tests for POST /api/players/import — bulk player import.
 *
 * Upserts by discordUsername when present, else falls back to a
 * case-insensitive name match. Every row is validated independently, so a
 * single malformed row must not abort the batch — the response's
 * { imported, updated, skipped, errors } counters track per-row outcomes.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeReq, makeInvalidJsonReq, unwrap } from './_helpers.js';

// ─── Mock next/server ────────────────────────────────────────────────────────
vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((body, init) => ({ _body: body, _status: init?.status ?? 200 })),
  },
}));

// ─── Mock @/lib/db ───────────────────────────────────────────────────────────
vi.mock('@/lib/db', () => {
  const prisma = {
    player: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
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

// ─── Mock @/lib/apiError ──────────────────────────────────────────────────────
vi.mock('@/lib/apiError', () => ({
  reportServerError: vi.fn(),
}));

const { default: prisma } = await import('@/lib/db');
const { resolveAdminAuth } = await import('@/lib/resolveAuth');
const { invalidatePlayers } = await import('@/lib/referenceData');
const { reportServerError } = await import('@/lib/apiError');
const { POST } = await import('@/app/api/players/import/route.js');

beforeEach(() => {
  vi.clearAllMocks();
  resolveAdminAuth.mockResolvedValue(null);
});

describe('POST /api/players/import', () => {
  it('returns 401 when not authorized', async () => {
    resolveAdminAuth.mockResolvedValueOnce({ _body: { error: 'Unauthorized' }, _status: 401 });
    const res = await POST(makeReq({ players: [{ name: 'Bob', role: 'Mid' }] }));
    expect(res._status).toBe(401);
  });

  it('returns 400 for malformed JSON', async () => {
    const res = await POST(makeInvalidJsonReq());
    expect(unwrap(res).status).toBe(400);
  });

  it('requires a non-empty players array', async () => {
    const res = await POST(makeReq({ players: [] }));
    expect(unwrap(res).status).toBe(400);
  });

  it('rejects a players array over 500 rows', async () => {
    const players = new Array(501).fill({ name: 'Bob', role: 'Mid' });
    const res = await POST(makeReq({ players }));
    expect(unwrap(res).status).toBe(400);
    expect(prisma.player.findFirst).not.toHaveBeenCalled();
  });

  it('collects a per-row error for a missing name without aborting the batch', async () => {
    prisma.player.findFirst.mockResolvedValue(null);
    prisma.player.create.mockResolvedValue({ id: 'p1' });
    const res = await POST(makeReq({
      players: [
        { name: '', role: 'Mid' },
        { name: 'Good Player', role: 'Mid' },
      ],
    }));
    expect(unwrap(res).status).toBe(200);
    expect(unwrap(res).body.errors).toHaveLength(1);
    expect(unwrap(res).body.errors[0].reason).toMatch(/Missing name/);
    expect(unwrap(res).body.imported).toBe(1);
  });

  it('collects a per-row error for a name exceeding 100 chars', async () => {
    const res = await POST(makeReq({
      players: [{ name: 'x'.repeat(101), role: 'Mid' }],
    }));
    expect(unwrap(res).body.errors[0].reason).toMatch(/100 chars/);
    expect(unwrap(res).body.imported).toBe(0);
  });

  it('collects a per-row error for an invalid role', async () => {
    const res = await POST(makeReq({
      players: [{ name: 'Bob', role: 'NotARole' }],
    }));
    expect(unwrap(res).body.errors[0].reason).toMatch(/Invalid role/);
  });

  it('collects a per-row error for an over-length discordUsername', async () => {
    const res = await POST(makeReq({
      players: [{ name: 'Bob', role: 'Mid', discordUsername: 'x'.repeat(65) }],
    }));
    expect(unwrap(res).body.errors[0].reason).toMatch(/discordUsername/);
  });

  it('collects a per-row error for an over-length division', async () => {
    const res = await POST(makeReq({
      players: [{ name: 'Bob', role: 'Mid', division: 'x'.repeat(65) }],
    }));
    expect(unwrap(res).body.errors[0].reason).toMatch(/division/);
  });

  it('imports a new player by name when no existing match found', async () => {
    prisma.player.findFirst.mockResolvedValueOnce(null);
    prisma.player.create.mockResolvedValueOnce({ id: 'p1' });
    const res = await POST(makeReq({ players: [{ name: 'New Guy', role: 'Support' }] }));
    expect(unwrap(res).body.imported).toBe(1);
    expect(prisma.player.create).toHaveBeenCalledWith({
      data: { name: 'New Guy', role: 'Support', discordUsername: null, division: null, timezone: null, secondaryRoles: [] },
    });
    expect(invalidatePlayers).toHaveBeenCalled();
  });

  it('dedups by discordUsername over case-insensitive name match', async () => {
    prisma.player.findFirst.mockResolvedValueOnce({
      id: 'p1', name: 'Existing', role: 'Support', discordUsername: 'existing#1', division: null, secondaryRoles: [], timezone: null,
    });
    prisma.player.update.mockResolvedValueOnce({ id: 'p1' });
    const res = await POST(makeReq({
      players: [{ name: 'Existing Renamed', role: 'Support', discordUsername: 'existing#1' }],
    }));
    expect(prisma.player.findFirst).toHaveBeenCalledWith({ where: { discordUsername: 'existing#1' } });
    expect(unwrap(res).body.updated).toBe(1);
  });

  it('skips an unchanged existing row', async () => {
    prisma.player.findFirst.mockResolvedValueOnce({
      id: 'p1', name: 'Same', role: 'Support', discordUsername: null, division: null, secondaryRoles: [], timezone: null,
    });
    const res = await POST(makeReq({ players: [{ name: 'Same', role: 'Support' }] }));
    expect(unwrap(res).body.skipped).toBe(1);
    expect(prisma.player.update).not.toHaveBeenCalled();
  });

  it('updates a changed existing row', async () => {
    prisma.player.findFirst.mockResolvedValueOnce({
      id: 'p1', name: 'Same', role: 'Support', discordUsername: null, division: null, secondaryRoles: [], timezone: null,
    });
    prisma.player.update.mockResolvedValueOnce({ id: 'p1' });
    const res = await POST(makeReq({ players: [{ name: 'Same', role: 'Carry' }] }));
    expect(unwrap(res).body.updated).toBe(1);
  });

  it('filters secondaryRoles down to valid PLAYER_ROLES values', async () => {
    prisma.player.findFirst.mockResolvedValueOnce(null);
    prisma.player.create.mockResolvedValueOnce({ id: 'p1' });
    await POST(makeReq({
      players: [{ name: 'Bob', role: 'Mid', secondaryRoles: ['Carry', 'NotARole'] }],
    }));
    expect(prisma.player.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ secondaryRoles: ['Carry'] }),
    });
  });

  it('does not invalidate the players cache if every row was skipped or errored', async () => {
    const res = await POST(makeReq({ players: [{ name: '', role: 'Mid' }] }));
    expect(unwrap(res).body.imported).toBe(0);
    expect(unwrap(res).body.updated).toBe(0);
    expect(invalidatePlayers).not.toHaveBeenCalled();
  });

  it('reports and records a per-row database error without failing the batch', async () => {
    const dbErr = new Error('db down');
    prisma.player.findFirst.mockRejectedValueOnce(dbErr);
    const res = await POST(makeReq({ players: [{ name: 'Bob', role: 'Mid' }] }));
    expect(unwrap(res).status).toBe(200);
    expect(unwrap(res).body.errors[0].reason).toBe('Database error');
    expect(reportServerError).toHaveBeenCalledWith(dbErr, { route: 'players/import POST' });
  });
});
