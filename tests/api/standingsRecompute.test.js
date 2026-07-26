/**
 * API tests for POST /api/standings/recompute.
 *
 * Despite the route name, this endpoint does not itself recompute anything —
 * lib/standings.computeStandings is cache-backed (30s TTL, keyed by
 * divisionId) and this route just calls invalidateAllStandings() to flush
 * that whole cache. The next GET /api/standings call for any division then
 * lazily recomputes from the database. There's no per-division targeting and
 * no db access in this route at all, so these tests focus on the auth guard
 * and on confirming the global (not per-division) cache flush actually fires.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeReq, unwrap } from './_helpers.js';

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

// ─── Mock @/lib/standings ─────────────────────────────────────────────────────
vi.mock('@/lib/standings', () => ({
  invalidateAllStandings: vi.fn(),
}));

const { resolveAdminAuth } = await import('@/lib/resolveAuth');
const { invalidateAllStandings } = await import('@/lib/standings');
const { POST } = await import('@/app/api/standings/recompute/route.js');

beforeEach(() => {
  vi.clearAllMocks();
  resolveAdminAuth.mockResolvedValue(null);
});

describe('POST /api/standings/recompute', () => {
  it('returns 401 when not authorized', async () => {
    resolveAdminAuth.mockResolvedValueOnce({ _body: { error: 'Unauthorized' }, _status: 401 });
    const res = await POST(makeReq({}));
    expect(res._status).toBe(401);
    expect(invalidateAllStandings).not.toHaveBeenCalled();
  });

  it('flushes the entire standings cache (not scoped to one division)', async () => {
    const res = await POST(makeReq({}));
    expect(unwrap(res).status).toBe(200);
    expect(unwrap(res).body.ok).toBe(true);
    expect(invalidateAllStandings).toHaveBeenCalledTimes(1);
    expect(invalidateAllStandings).toHaveBeenCalledWith(); // no divisionId arg — flushes everything
  });

  it('returns a recomputedAt ISO timestamp', async () => {
    const res = await POST(makeReq({}));
    const { recomputedAt } = unwrap(res).body;
    expect(typeof recomputedAt).toBe('string');
    expect(new Date(recomputedAt).toISOString()).toBe(recomputedAt);
  });
});
