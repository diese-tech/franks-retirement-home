/**
 * API tests for /api/seasons
 * Covers: GET (list with divisions), POST (admin create, validation, dup slug)
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
    season: { findMany: vi.fn(), create: vi.fn() },
  };
  return { default: prisma };
});

// ─── Mock @/lib/resolveAuth ──────────────────────────────────────────────────
vi.mock('@/lib/resolveAuth', () => ({
  resolveAdminAuth: vi.fn(async () => null),
}));

// ─── Mock @/lib/apiError ──────────────────────────────────────────────────────
vi.mock('@/lib/apiError', () => ({
  reportServerError: vi.fn(),
}));

const { default: prisma } = await import('@/lib/db');
const { resolveAdminAuth } = await import('@/lib/resolveAuth');
const { reportServerError } = await import('@/lib/apiError');
const { GET, POST } = await import('@/app/api/seasons/route.js');

const SEASON = { id: 's1', name: 'Season 1', slug: 'season-1', status: 'upcoming', divisions: [] };

beforeEach(() => {
  vi.clearAllMocks();
  resolveAdminAuth.mockResolvedValue(null);
});

describe('GET /api/seasons', () => {
  it('lists seasons with their divisions', async () => {
    prisma.season.findMany.mockResolvedValueOnce([SEASON]);
    const res = await GET();
    expect(unwrap(res).status).toBe(200);
    expect(unwrap(res).body).toEqual([SEASON]);
  });

  it('reports and returns 500 on db failure', async () => {
    const dbErr = new Error('db down');
    prisma.season.findMany.mockRejectedValueOnce(dbErr);
    const res = await GET();
    expect(unwrap(res).status).toBe(500);
    expect(reportServerError).toHaveBeenCalledWith(dbErr, { route: 'seasons GET' });
  });
});

describe('POST /api/seasons', () => {
  it('returns 401 when not authorized', async () => {
    resolveAdminAuth.mockResolvedValueOnce({ _body: { error: 'Unauthorized' }, _status: 401 });
    const res = await POST(makeReq({ name: 'Season 1', slug: 'season-1' }));
    expect(res._status).toBe(401);
  });

  it('returns 400 for malformed JSON', async () => {
    const res = await POST(makeInvalidJsonReq());
    expect(unwrap(res).status).toBe(400);
  });

  it('requires name and slug', async () => {
    const res = await POST(makeReq({ name: 'Season 1' }));
    expect(unwrap(res).status).toBe(400);
  });

  it('rejects an invalid status', async () => {
    const res = await POST(makeReq({ name: 'Season 1', slug: 'season-1', status: 'bogus' }));
    expect(unwrap(res).status).toBe(400);
  });

  it('creates a season defaulting status to upcoming', async () => {
    prisma.season.create.mockResolvedValueOnce(SEASON);
    const res = await POST(makeReq({ name: 'Season 1', slug: 'season-1' }));
    expect(unwrap(res).status).toBe(201);
    expect(prisma.season.create).toHaveBeenCalledWith({
      data: { name: 'Season 1', slug: 'season-1', status: 'upcoming', startsAt: undefined, endsAt: undefined },
    });
  });

  it('returns 409 on duplicate slug', async () => {
    prisma.season.create.mockRejectedValueOnce({ code: 'P2002' });
    const res = await POST(makeReq({ name: 'Season 1', slug: 'season-1' }));
    expect(unwrap(res).status).toBe(409);
  });

  it('reports and returns 500 on unexpected db failure', async () => {
    const dbErr = new Error('db down');
    prisma.season.create.mockRejectedValueOnce(dbErr);
    const res = await POST(makeReq({ name: 'Season 1', slug: 'season-1' }));
    expect(unwrap(res).status).toBe(500);
    expect(reportServerError).toHaveBeenCalledWith(dbErr, { route: 'seasons POST' });
  });
});
