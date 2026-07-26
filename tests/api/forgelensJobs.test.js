/**
 * API tests for /api/forgelens/jobs
 *   GET  — admin: list OCR extractions
 *   POST — admin: submit a screenshot for OCR (dispatches to ForgeLens if configured)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { makeReq, makeInvalidJsonReq, unwrap } from './_helpers.js';

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

// ─── Mock @/lib/audit ────────────────────────────────────────────────────────
vi.mock('@/lib/audit', () => ({
  logAudit: vi.fn(),
}));

// ─── Mock @/lib/db ───────────────────────────────────────────────────────────
vi.mock('@/lib/db', () => {
  const prisma = {
    ocrExtraction: { findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
  };
  return { default: prisma };
});

const { default: prisma } = await import('@/lib/db');
const { resolveAdminAuth } = await import('@/lib/resolveAuth');
const { logAudit } = await import('@/lib/audit');
const { GET, POST } = await import('@/app/api/forgelens/jobs/route.js');

function makeUrlReq(query = {}) {
  const params = new URLSearchParams(query);
  return { url: `http://localhost/api/forgelens/jobs?${params.toString()}` };
}

const originalFetch = global.fetch;

beforeEach(() => {
  vi.clearAllMocks();
  resolveAdminAuth.mockResolvedValue(null);
  prisma.ocrExtraction.create.mockResolvedValue({ id: 'ext-1', status: 'pending' });
});

afterEach(() => {
  global.fetch = originalFetch;
  delete process.env.FORGELENS_URL;
  delete process.env.FORGELENS_API_KEY;
});

describe('GET /api/forgelens/jobs', () => {
  it('returns 401 (admin guard response) when not authorized', async () => {
    const guard = { _body: { error: 'Unauthorized' }, _status: 401 };
    resolveAdminAuth.mockResolvedValue(guard);
    const res = await GET(makeUrlReq());
    expect(res).toBe(guard);
    expect(prisma.ocrExtraction.findMany).not.toHaveBeenCalled();
  });

  it('lists jobs, optionally filtered by gameId and status', async () => {
    prisma.ocrExtraction.findMany.mockResolvedValue([{ id: 'ext-1' }]);
    const res = await GET(makeUrlReq({ gameId: 'game-1', status: 'pending' }));
    expect(unwrap(res).body).toEqual([{ id: 'ext-1' }]);
    expect(prisma.ocrExtraction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { gameId: 'game-1', status: 'pending' }, take: 50 }),
    );
  });

  it('queries with an empty where clause when no filters are given', async () => {
    prisma.ocrExtraction.findMany.mockResolvedValue([]);
    await GET(makeUrlReq());
    expect(prisma.ocrExtraction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} }),
    );
  });
});

describe('POST /api/forgelens/jobs', () => {
  it('returns 401 (admin guard response) when not authorized', async () => {
    const guard = { _body: { error: 'Unauthorized' }, _status: 401 };
    resolveAdminAuth.mockResolvedValue(guard);
    const res = await POST(makeReq({ attachmentUrl: 'https://x/y.png' }));
    expect(res).toBe(guard);
  });

  it('returns 400 for invalid JSON', async () => {
    const res = await POST(makeInvalidJsonReq());
    expect(unwrap(res).status).toBe(400);
  });

  it('returns 400 when attachmentUrl is missing', async () => {
    const res = await POST(makeReq({}));
    expect(unwrap(res).status).toBe(400);
    expect(unwrap(res).body.error).toMatch(/attachmentUrl is required/i);
  });

  it('creates the extraction and stays pending when FORGELENS_URL is not configured', async () => {
    const res = await POST(makeReq({ attachmentUrl: 'https://x/y.png', gameId: 'game-1' }));
    expect(unwrap(res).status).toBe(201);
    expect(prisma.ocrExtraction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ attachmentUrl: 'https://x/y.png', gameId: 'game-1', status: 'pending' }),
    });
    expect(prisma.ocrExtraction.update).not.toHaveBeenCalled();
    expect(logAudit).toHaveBeenCalledWith('OcrExtraction', 'ext-1', 'job_submitted', expect.any(Object));
  });

  it('dispatches to ForgeLens and marks the job processing when FORGELENS_URL is set', async () => {
    process.env.FORGELENS_URL = 'https://forgelens.example.com';
    global.fetch = vi.fn().mockResolvedValue({ ok: true });
    prisma.ocrExtraction.update.mockResolvedValue({ id: 'ext-1', status: 'processing' });

    const res = await POST(makeReq({ attachmentUrl: 'https://x/y.png' }));
    expect(unwrap(res).status).toBe(201);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://forgelens.example.com/jobs',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(prisma.ocrExtraction.update).toHaveBeenCalledWith({
      where: { id: 'ext-1' },
      data: { status: 'processing' },
    });
  });

  it('leaves the job pending (does not throw) when ForgeLens is unreachable', async () => {
    process.env.FORGELENS_URL = 'https://forgelens.example.com';
    global.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));

    const res = await POST(makeReq({ attachmentUrl: 'https://x/y.png' }));
    expect(unwrap(res).status).toBe(201);
    expect(prisma.ocrExtraction.update).not.toHaveBeenCalled();
  });
});
