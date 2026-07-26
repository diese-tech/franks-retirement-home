/**
 * API tests for /api/divisions
 * Covers: GET (optional seasonId filter), POST (admin create, validation, dup name)
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
    division: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
  };
  return { default: prisma };
});

// ─── Mock @/lib/resolveAuth ──────────────────────────────────────────────────
vi.mock('@/lib/resolveAuth', () => ({
  resolveAdminAuth: vi.fn(async () => null), // null = authorized by default
}));

// ─── Mock @/lib/apiError ──────────────────────────────────────────────────────
vi.mock('@/lib/apiError', () => ({
  reportServerError: vi.fn(),
}));

const { default: prisma } = await import('@/lib/db');
const { resolveAdminAuth } = await import('@/lib/resolveAuth');
const { reportServerError } = await import('@/lib/apiError');
const { GET, POST } = await import('@/app/api/divisions/route.js');

const DIVISION = { id: 'div-1', seasonId: 'season-1', name: 'Premier', tier: 1 };

beforeEach(() => {
  vi.clearAllMocks();
  resolveAdminAuth.mockResolvedValue(null);
});

describe('GET /api/divisions', () => {
  it('lists divisions without a seasonId filter', async () => {
    prisma.division.findMany.mockResolvedValueOnce([DIVISION]);
    const res = await GET({ url: 'http://localhost/api/divisions' });
    expect(unwrap(res).status).toBe(200);
    expect(unwrap(res).body).toEqual([DIVISION]);
    expect(prisma.division.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} })
    );
  });

  it('filters by seasonId query param', async () => {
    prisma.division.findMany.mockResolvedValueOnce([DIVISION]);
    const res = await GET({ url: 'http://localhost/api/divisions?seasonId=season-1' });
    expect(unwrap(res).status).toBe(200);
    expect(prisma.division.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { seasonId: 'season-1' } })
    );
  });

  it('reports and returns 500 on db failure', async () => {
    const dbErr = new Error('db down');
    prisma.division.findMany.mockRejectedValueOnce(dbErr);
    const res = await GET({ url: 'http://localhost/api/divisions' });
    expect(unwrap(res).status).toBe(500);
    expect(reportServerError).toHaveBeenCalledWith(dbErr, { route: 'divisions GET' });
  });
});

describe('POST /api/divisions', () => {
  it('returns 401 when not authorized', async () => {
    resolveAdminAuth.mockResolvedValueOnce({ _body: { error: 'Unauthorized' }, _status: 401 });
    const res = await POST(makeReq({ seasonId: 's1', name: 'Premier', tier: 1 }));
    expect(res._status).toBe(401);
  });

  it('returns 400 for malformed JSON', async () => {
    const res = await POST(makeInvalidJsonReq());
    expect(unwrap(res).status).toBe(400);
  });

  it('requires seasonId, name, and tier', async () => {
    const res = await POST(makeReq({ name: 'Premier' }));
    expect(unwrap(res).status).toBe(400);
    expect(unwrap(res).body.error).toMatch(/required/);
  });

  it('creates a division and returns 201', async () => {
    prisma.division.create.mockResolvedValueOnce(DIVISION);
    const res = await POST(makeReq({ seasonId: 'season-1', name: 'Premier', tier: '1' }));
    expect(unwrap(res).status).toBe(201);
    expect(prisma.division.create).toHaveBeenCalledWith({
      data: { seasonId: 'season-1', name: 'Premier', tier: 1 },
    });
  });

  it('returns 409 on duplicate division name for a season', async () => {
    prisma.division.create.mockRejectedValueOnce({ code: 'P2002' });
    const res = await POST(makeReq({ seasonId: 'season-1', name: 'Premier', tier: 1 }));
    expect(unwrap(res).status).toBe(409);
  });

  it('reports and returns 500 on unexpected db failure', async () => {
    const dbErr = new Error('db down');
    prisma.division.create.mockRejectedValueOnce(dbErr);
    const res = await POST(makeReq({ seasonId: 'season-1', name: 'Premier', tier: 1 }));
    expect(unwrap(res).status).toBe(500);
    expect(reportServerError).toHaveBeenCalledWith(dbErr, { route: 'divisions POST' });
  });
});
