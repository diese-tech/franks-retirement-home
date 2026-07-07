/**
 * API tests for POST /api/forgelens/callback — signature verification.
 *
 * Strategy: mock prisma, audit, and NextResponse so no DB or Next.js runtime
 * is needed. The route module is imported after mocks are registered.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHmac } from 'node:crypto';
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
    ocrExtraction: { findUnique: vi.fn(), update: vi.fn() },
    extractedStatLine: { createMany: vi.fn(), deleteMany: vi.fn() },
    $transaction: vi.fn(),
  };
  return { default: prisma };
});

// ─── Mock @/lib/audit ────────────────────────────────────────────────────────
vi.mock('@/lib/audit', () => ({
  logAudit: vi.fn(),
}));

const { default: prisma } = await import('@/lib/db');
const { POST } = await import('@/app/api/forgelens/callback/route.js');

const SECRET = 'test-forgelens-secret';

function makeCallbackReq(bodyObj, { signature } = {}) {
  const raw = JSON.stringify(bodyObj);
  return {
    text: () => Promise.resolve(raw),
    headers: {
      get: (name) => (name.toLowerCase() === 'x-forgelens-signature' ? signature ?? null : null),
    },
  };
}

function sign(bodyObj, secret = SECRET) {
  return createHmac('sha256', secret).update(JSON.stringify(bodyObj)).digest('hex');
}

const VALID_BODY = { jobId: 'job-1', status: 'failed', error: 'worker exploded' };

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  delete process.env.FORGELENS_HMAC_SECRET;
  vi.unstubAllEnvs();
});

describe('POST /api/forgelens/callback signature verification', () => {
  it('returns 503 in production when FORGELENS_HMAC_SECRET is unset (fail closed)', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const res = await POST(makeCallbackReq(VALID_BODY));
    const { status, body } = unwrap(res);
    expect(status).toBe(503);
    expect(body.error).toMatch(/not configured/i);
    expect(prisma.ocrExtraction.findUnique).not.toHaveBeenCalled();
  });

  it('returns 401 when the secret is set but the signature header is missing', async () => {
    process.env.FORGELENS_HMAC_SECRET = SECRET;
    const res = await POST(makeCallbackReq(VALID_BODY));
    const { status } = unwrap(res);
    expect(status).toBe(401);
    expect(prisma.ocrExtraction.findUnique).not.toHaveBeenCalled();
  });

  it('returns 401 when the signature does not match', async () => {
    process.env.FORGELENS_HMAC_SECRET = SECRET;
    const res = await POST(makeCallbackReq(VALID_BODY, { signature: sign(VALID_BODY, 'wrong-secret') }));
    const { status } = unwrap(res);
    expect(status).toBe(401);
    expect(prisma.ocrExtraction.findUnique).not.toHaveBeenCalled();
  });

  it('accepts a correctly signed request (sha256= prefix supported)', async () => {
    process.env.FORGELENS_HMAC_SECRET = SECRET;
    prisma.ocrExtraction.findUnique.mockResolvedValue(null); // job lookup: not found
    const res = await POST(
      makeCallbackReq(VALID_BODY, { signature: `sha256=${sign(VALID_BODY)}` })
    );
    const { status } = unwrap(res);
    // Signature passed; request proceeds to the job lookup (404 = not found).
    expect(status).toBe(404);
    expect(prisma.ocrExtraction.findUnique).toHaveBeenCalledWith({ where: { id: 'job-1' } });
  });

  it('skips verification outside production only when the secret is unset', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    prisma.ocrExtraction.findUnique.mockResolvedValue(null);
    const res = await POST(makeCallbackReq(VALID_BODY));
    const { status } = unwrap(res);
    expect(status).toBe(404); // proceeds without signature in dev/test
  });
});
