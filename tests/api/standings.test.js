/**
 * API tests for GET /api/standings — public standings lookup.
 * Delegates all computation to lib/standings.computeStandings, which is
 * mocked here so we only test the route's own request handling.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { unwrap } from './_helpers.js';

// ─── Mock next/server ────────────────────────────────────────────────────────
vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((body, init) => ({ _body: body, _status: init?.status ?? 200, headers: { set: vi.fn() } })),
  },
}));

// ─── Mock @/lib/standings ─────────────────────────────────────────────────────
vi.mock('@/lib/standings', () => ({
  computeStandings: vi.fn(),
}));

// ─── Mock @/lib/apiError ──────────────────────────────────────────────────────
vi.mock('@/lib/apiError', () => ({
  reportServerError: vi.fn(),
}));

const { computeStandings } = await import('@/lib/standings');
const { reportServerError } = await import('@/lib/apiError');
const { GET } = await import('@/app/api/standings/route.js');

const ROW = { teamId: 't1', teamName: 'Team A', wins: 3, losses: 1 };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/standings', () => {
  it('requires a divisionId query param', async () => {
    const res = await GET({ url: 'http://localhost/api/standings' });
    expect(unwrap(res).status).toBe(400);
    expect(computeStandings).not.toHaveBeenCalled();
  });

  it('returns computed standings for a division', async () => {
    computeStandings.mockResolvedValueOnce([ROW]);
    const res = await GET({ url: 'http://localhost/api/standings?divisionId=div-1' });
    expect(unwrap(res).status).toBe(200);
    expect(unwrap(res).body).toEqual([ROW]);
    expect(computeStandings).toHaveBeenCalledWith('div-1');
  });

  it('reports and returns 500 when computation fails', async () => {
    const err = new Error('boom');
    computeStandings.mockRejectedValueOnce(err);
    const res = await GET({ url: 'http://localhost/api/standings?divisionId=div-1' });
    expect(unwrap(res).status).toBe(500);
    expect(reportServerError).toHaveBeenCalledWith(err, { route: 'standings GET' });
  });
});
