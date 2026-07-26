/**
 * API tests for GET /api/exports/pending-ocr — admin-only CSV export of
 * pending ExtractedStatLine rows.
 *
 * Sentry (reportServerError) is already wired into this route — these tests
 * only cover behavior, not the Sentry wiring itself.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock next/server ────────────────────────────────────────────────────────
vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((body, init) => ({ _body: body, _status: init?.status ?? 200 })),
  },
}));

// ─── Mock @/lib/resolveAuth ──────────────────────────────────────────────────
vi.mock('@/lib/resolveAuth', () => ({
  resolveAdminAuth: vi.fn(async () => null), // null = authorized by default
}));

// ─── Mock @/lib/db ───────────────────────────────────────────────────────────
vi.mock('@/lib/db', () => {
  const prisma = {
    extractedStatLine: { findMany: vi.fn() },
  };
  return { default: prisma };
});

const { default: prisma } = await import('@/lib/db');
const { resolveAdminAuth } = await import('@/lib/resolveAuth');
const { GET } = await import('@/app/api/exports/pending-ocr/route.js');

const ROW = {
  extractionId: 'ext-1',
  extraction: { id: 'ext-1', gameId: 'game-1', confidence: 0.9, requestedAt: new Date('2026-01-01T00:00:00Z') },
  player: { name: 'Some Player' },
  god: { name: 'Zeus' },
  ignRaw: 'SomePlayer',
  teamRaw: 'order',
  roleRaw: 'mid',
  godRaw: 'Zeus',
  kills: 10,
  deaths: 2,
  assists: 8,
  damageDealt: 50000,
  damageMitigated: 1000,
  healing: 500,
  goldEarned: 12000,
  structureDamage: 300,
};

beforeEach(() => {
  vi.clearAllMocks();
  resolveAdminAuth.mockResolvedValue(null);
  prisma.extractedStatLine.findMany.mockResolvedValue([ROW]);
});

describe('GET /api/exports/pending-ocr', () => {
  it('returns 401 (the admin guard response) when not authorized', async () => {
    const guard = { status: 401 };
    resolveAdminAuth.mockResolvedValue(guard);
    const res = await GET({});
    expect(res).toBe(guard);
    expect(prisma.extractedStatLine.findMany).not.toHaveBeenCalled();
  });

  it('returns a CSV response with the expected headers and PENDING status marker', async () => {
    const res = await GET({});
    expect(res.headers.get('Content-Type')).toMatch(/text\/csv/);
    expect(res.headers.get('Content-Disposition')).toMatch(/frh-s9-pending-ocr-.*\.csv/);

    const text = await res.text();
    const lines = text.split('\r\n');
    expect(lines[0]).toMatch(/^STATUS,ExtractionId,GameId/);
    expect(lines[1]).toMatch(/^PENDING — NOT OFFICIAL,ext-1,game-1/);
    expect(lines[1]).toContain('SomePlayer');
    expect(lines[1]).toContain('Zeus');
  });

  it('only queries rows with status=pending, ordered by extraction.requestedAt', async () => {
    await GET({});
    expect(prisma.extractedStatLine.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'pending' },
        orderBy: { extraction: { requestedAt: 'asc' } },
      }),
    );
  });

  it('falls back to "(unresolved)" for player/god and empty strings for optional raw fields', async () => {
    prisma.extractedStatLine.findMany.mockResolvedValue([
      { ...ROW, player: null, god: null, teamRaw: null, roleRaw: null, godRaw: null },
    ]);
    const res = await GET({});
    const text = await res.text();
    expect(text).toContain('(unresolved)');
  });

  it('returns 500 when the database query fails', async () => {
    prisma.extractedStatLine.findMany.mockRejectedValue(new Error('db exploded'));
    const res = await GET({});
    // Failure path returns a NextResponse.json mock (our route module returns
    // early before constructing the CSV Response in this branch).
    expect(res._status).toBe(500);
    expect(res._body.error).toMatch(/Failed to load pending OCR rows/i);
  });
});
