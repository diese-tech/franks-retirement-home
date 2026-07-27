/**
 * API tests for GET /api/health — trivial uptime check.
 * Also covered end-to-end by tests/e2e/draft.spec.js ("GET /api/health
 * returns ok"), but this unit-level test runs fast and doesn't need a
 * running server or real Postgres connection.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { unwrap } from './_helpers.js';

// ─── Mock next/server ────────────────────────────────────────────────────────
vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((body, init) => ({ _body: body, _status: init?.status ?? 200 })),
  },
}));

// ─── Mock @/lib/db ───────────────────────────────────────────────────────────
vi.mock('@/lib/db', () => {
  const prisma = {
    $queryRaw: vi.fn(),
  };
  return { default: prisma };
});

const { default: prisma } = await import('@/lib/db');
const { GET } = await import('@/app/api/health/route.js');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/health', () => {
  it('returns ok:true with a reachable db when the query succeeds', async () => {
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    const res = await GET();
    const { status, body } = unwrap(res);
    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.db).toBe('reachable');
    expect(body.service).toBe('franks-retirement-home');
    expect(typeof body.latencyMs).toBe('number');
  });

  it('returns ok:false with a 500 when the db query fails', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('connection refused'));
    const res = await GET();
    const { status, body } = unwrap(res);
    expect(status).toBe(500);
    expect(body.ok).toBe(false);
    expect(body.db).toBe('unreachable');
    expect(body.error).toMatch(/connection refused/i);
  });
});
