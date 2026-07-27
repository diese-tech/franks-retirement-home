/**
 * API tests for GET /api/submissions
 * Admin: list pending/in_review submissions, or all when unfiltered.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { unwrap } from './_helpers.js';

vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((body, init) => ({ _body: body, _status: init?.status ?? 200 })),
  },
}));

vi.mock('@/lib/db', () => {
  const prisma = {
    matchSubmission: { findMany: vi.fn() },
  };
  return { default: prisma };
});

vi.mock('@/lib/resolveAuth', () => ({
  resolveAdminAuth: vi.fn(() => ({ _body: { error: 'Unauthorized' }, _status: 401 })),
}));

const { default: prisma } = await import('@/lib/db');
const { resolveAdminAuth } = await import('@/lib/resolveAuth');
const { GET } = await import('@/app/api/submissions/route.js');

function makeUrlReq(url) {
  return { url };
}

beforeEach(() => {
  vi.clearAllMocks();
  resolveAdminAuth.mockResolvedValue(null);
});

describe('GET /api/submissions', () => {
  it('returns the admin auth error when not authorized', async () => {
    resolveAdminAuth.mockResolvedValue({ _body: { error: 'Unauthorized' }, _status: 401 });
    const res = await GET(makeUrlReq('http://localhost/api/submissions'));
    expect(unwrap(res).status).toBe(401);
  });

  it('returns all submissions when no status filter is given', async () => {
    prisma.matchSubmission.findMany.mockResolvedValue([{ id: 'sub-1' }]);
    const res = await GET(makeUrlReq('http://localhost/api/submissions'));
    expect(unwrap(res).status).toBe(200);
    expect(prisma.matchSubmission.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
  });

  it('filters to pending/in_review submissions when status=open', async () => {
    prisma.matchSubmission.findMany.mockResolvedValue([]);
    await GET(makeUrlReq('http://localhost/api/submissions?status=open'));
    expect(prisma.matchSubmission.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { status: { in: ['pending', 'in_review'] } },
    }));
  });

  it('returns 500 when the query fails', async () => {
    prisma.matchSubmission.findMany.mockRejectedValue(new Error('db down'));
    const res = await GET(makeUrlReq('http://localhost/api/submissions'));
    expect(unwrap(res).status).toBe(500);
  });
});
