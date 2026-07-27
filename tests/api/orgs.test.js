/**
 * API tests for /api/orgs
 * Covers: GET (list with teams), POST (admin create)
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
    org: { findMany: vi.fn(), create: vi.fn() },
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
const { GET, POST } = await import('@/app/api/orgs/route.js');

const ORG = { id: 'org-1', name: 'Frank Org', tag: 'FRK', teams: [] };

beforeEach(() => {
  vi.clearAllMocks();
  resolveAdminAuth.mockResolvedValue(null);
});

describe('GET /api/orgs', () => {
  it('lists orgs with their teams', async () => {
    prisma.org.findMany.mockResolvedValueOnce([ORG]);
    const res = await GET();
    expect(unwrap(res).status).toBe(200);
    expect(unwrap(res).body).toEqual([ORG]);
  });

  it('reports and returns 500 on db failure', async () => {
    const dbErr = new Error('db down');
    prisma.org.findMany.mockRejectedValueOnce(dbErr);
    const res = await GET();
    expect(unwrap(res).status).toBe(500);
    expect(reportServerError).toHaveBeenCalledWith(dbErr, { route: 'orgs GET' });
  });
});

describe('POST /api/orgs', () => {
  it('returns 401 when not authorized', async () => {
    resolveAdminAuth.mockResolvedValueOnce({ _body: { error: 'Unauthorized' }, _status: 401 });
    const res = await POST(makeReq({ name: 'Frank Org', tag: 'FRK' }));
    expect(res._status).toBe(401);
  });

  it('returns 400 for malformed JSON', async () => {
    const res = await POST(makeInvalidJsonReq());
    expect(unwrap(res).status).toBe(400);
  });

  it('requires name and tag', async () => {
    const res = await POST(makeReq({ name: 'Frank Org' }));
    expect(unwrap(res).status).toBe(400);
    expect(unwrap(res).body.error).toMatch(/required/);
  });

  it('creates an org and returns 201', async () => {
    prisma.org.create.mockResolvedValueOnce(ORG);
    const res = await POST(makeReq({ name: 'Frank Org', tag: 'FRK', logoInitials: 'FO', accentColor: '#fff' }));
    expect(unwrap(res).status).toBe(201);
    expect(prisma.org.create).toHaveBeenCalledWith({
      data: { name: 'Frank Org', tag: 'FRK', logoInitials: 'FO', accentColor: '#fff' },
    });
  });

  it('reports and returns 500 on db failure', async () => {
    const dbErr = new Error('db down');
    prisma.org.create.mockRejectedValueOnce(dbErr);
    const res = await POST(makeReq({ name: 'Frank Org', tag: 'FRK' }));
    expect(unwrap(res).status).toBe(500);
    expect(reportServerError).toHaveBeenCalledWith(dbErr, { route: 'orgs POST' });
  });
});
