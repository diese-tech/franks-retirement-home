/**
 * API tests for /api/admin/homepage-content
 * Covers: GET, POST (save + publish), DELETE
 * Auth is now handled by resolveAdminAuth (Discord role OR password session).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeReq, makeInvalidJsonReq, unwrap } from './_helpers.js';

// ─── Mock next/server ────────────────────────────────────────────────────────
vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((body, init) => ({ _body: body, _status: init?.status ?? 200 })),
  },
}));

// ─── Mock resolveAdminAuth ────────────────────────────────────────────────────
vi.mock('@/lib/resolveAuth', () => ({
  resolveAdminAuth: vi.fn(async () => null), // null = authorized by default
}));

// ─── Mock rateLimit (allow all requests in tests) ────────────────────────────
vi.mock('@/lib/rateLimit', () => ({
  consume: vi.fn(() => true),
  clientIp: vi.fn(() => 'test-ip'),
}));

// ─── Mock discordAuth (no Discord session in tests by default) ───────────────
vi.mock('@/lib/discordAuth', () => ({
  getDiscordSessionUser: vi.fn(() => null),
}));

// ─── Mock homepageDefaults ────────────────────────────────────────────────────
vi.mock('@/lib/homepageDefaults', () => ({
  HOMEPAGE_DEFAULTS: {
    ticker: [], headlines: [], bulletin: [], fraudWatch: [], motw: {},
    rivalries: [], knowsBall: [], washedReports: [], socialCards: [],
    discordInviteUrl: 'https://discord.gg/test',
    washedPct: 0,
    showTicker: true, showHeadlines: true, showBulletin: true,
    showFraudWatch: true, showMotw: true, showRivalries: true,
    showKnowsBall: true, showWashedReports: true, showSocialCards: true,
  },
}));

// ─── Mock @/lib/db ───────────────────────────────────────────────────────────
vi.mock('@/lib/db', () => {
  const prisma = {
    homepageContent: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
  };
  return { default: prisma };
});

const { default: prisma } = await import('@/lib/db');
const { resolveAdminAuth } = await import('@/lib/resolveAuth');
const { GET, POST, DELETE } = await import('@/app/api/admin/homepage-content/route.js');

const VALID_CONTENT = {
  ticker: [{ text: 'Test ticker' }],
  headlines: [],
  bulletin: [],
  fraudWatch: [],
  motw: {},
  rivalries: [],
  knowsBall: [],
  washedReports: [],
  socialCards: [],
  discordInviteUrl: 'https://discord.gg/test',
  washedPct: 42,
  showTicker: true,
  showHeadlines: true,
  showBulletin: true,
  showFraudWatch: false,
  showMotw: true,
  showRivalries: true,
  showKnowsBall: true,
  showWashedReports: true,
  showSocialCards: true,
};

const DRAFT_ROW = { id: 'r1', status: 'draft', savedAt: new Date(), ...VALID_CONTENT };
const PUBLISHED_ROW = { id: 'r2', status: 'published', publishedAt: new Date(), savedAt: new Date(), ...VALID_CONTENT };

describe('GET /api/admin/homepage-content', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when not authorized', async () => {
    resolveAdminAuth.mockResolvedValueOnce({ _body: { error: 'Unauthorized' }, _status: 401 });
    const res = await GET({});
    expect(res._status).toBe(401);
  });

  it('returns both draft and published rows for an authorized admin', async () => {
    resolveAdminAuth.mockResolvedValueOnce(null);
    prisma.homepageContent.findUnique
      .mockResolvedValueOnce(DRAFT_ROW)
      .mockResolvedValueOnce(PUBLISHED_ROW);

    const res = await GET({});
    expect(unwrap(res).status).toBe(200);
    expect(unwrap(res).body.draft.status).toBe('draft');
    expect(unwrap(res).body.published.status).toBe('published');
  });

  it('returns nulls if no content rows exist', async () => {
    resolveAdminAuth.mockResolvedValueOnce(null);
    prisma.homepageContent.findUnique.mockResolvedValue(null);
    const res = await GET({});
    expect(unwrap(res).body).toEqual({ draft: null, published: null });
  });
});

describe('POST /api/admin/homepage-content — save', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when not authorized', async () => {
    resolveAdminAuth.mockResolvedValueOnce({ _body: { error: 'Unauthorized' }, _status: 401 });
    const req = makeReq({ action: 'save', ...VALID_CONTENT });
    const res = await POST(req);
    expect(res._status).toBe(401);
  });

  it('upserts draft row and returns ok for authorized Discord admin', async () => {
    resolveAdminAuth.mockResolvedValueOnce(null); // Discord admin authorized
    prisma.homepageContent.upsert.mockResolvedValueOnce(DRAFT_ROW);
    const req = makeReq({ action: 'save', ...VALID_CONTENT });
    const res = await POST(req);
    expect(unwrap(res).status).toBe(200);
    expect(unwrap(res).body.ok).toBe(true);
    expect(unwrap(res).body.draft).toBeDefined();
  });

  it('upserts draft row and returns ok for authorized password admin (legacy fallback)', async () => {
    resolveAdminAuth.mockResolvedValueOnce(null); // password session authorized
    prisma.homepageContent.upsert.mockResolvedValueOnce(DRAFT_ROW);
    const req = makeReq({ action: 'save', ...VALID_CONTENT });
    const res = await POST(req);
    expect(unwrap(res).status).toBe(200);
    expect(unwrap(res).body.ok).toBe(true);
  });

  it('returns 400 for invalid action', async () => {
    resolveAdminAuth.mockResolvedValueOnce(null);
    const req = makeReq({ action: 'destroy' });
    const res = await POST(req);
    expect(unwrap(res).status).toBe(400);
    expect(unwrap(res).body.error).toMatch(/action/);
  });

  it('returns 422 for oversized ticker array', async () => {
    resolveAdminAuth.mockResolvedValueOnce(null);
    const req = makeReq({
      action: 'save',
      ticker: new Array(25).fill({ text: 'x' }), // max is 20
    });
    const res = await POST(req);
    expect(unwrap(res).status).toBe(422);
    expect(unwrap(res).body.error).toMatch(/ticker/);
  });

  it('returns 422 for invalid discordInviteUrl', async () => {
    resolveAdminAuth.mockResolvedValueOnce(null);
    const req = makeReq({ action: 'save', discordInviteUrl: 'http://not-https.com' });
    const res = await POST(req);
    expect(unwrap(res).status).toBe(422);
    expect(unwrap(res).body.error).toMatch(/discordInviteUrl/);
  });

  it('returns 400 for malformed JSON body', async () => {
    resolveAdminAuth.mockResolvedValueOnce(null);
    const res = await POST(makeInvalidJsonReq());
    expect(unwrap(res).status).toBe(400);
  });
});

describe('POST /api/admin/homepage-content — publish', () => {
  beforeEach(() => vi.clearAllMocks());

  it('upserts published row from draft and returns ok', async () => {
    resolveAdminAuth.mockResolvedValueOnce(null);
    prisma.homepageContent.findUnique.mockResolvedValueOnce(DRAFT_ROW);
    prisma.homepageContent.upsert.mockResolvedValueOnce(PUBLISHED_ROW);
    const req = makeReq({ action: 'publish', ...VALID_CONTENT });
    const res = await POST(req);
    expect(unwrap(res).status).toBe(200);
    expect(unwrap(res).body.ok).toBe(true);
    expect(unwrap(res).body.published).toBeDefined();
  });

  it('publishes even when no draft row exists (uses body fields)', async () => {
    resolveAdminAuth.mockResolvedValueOnce(null);
    prisma.homepageContent.findUnique.mockResolvedValueOnce(null); // no draft
    prisma.homepageContent.upsert.mockResolvedValueOnce(PUBLISHED_ROW);
    const req = makeReq({ action: 'publish', ...VALID_CONTENT });
    const res = await POST(req);
    expect(unwrap(res).status).toBe(200);
  });
});

describe('DELETE /api/admin/homepage-content', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when not authorized', async () => {
    resolveAdminAuth.mockResolvedValueOnce({ _body: { error: 'Unauthorized' }, _status: 401 });
    const req = { url: 'http://localhost/api/admin/homepage-content?target=draft' };
    const res = await DELETE(req);
    expect(res._status).toBe(401);
  });

  it('deletes draft row when target=draft', async () => {
    resolveAdminAuth.mockResolvedValueOnce(null);
    prisma.homepageContent.deleteMany.mockResolvedValueOnce({ count: 1 });
    const req = { url: 'http://localhost/api/admin/homepage-content?target=draft' };
    const res = await DELETE(req);
    expect(unwrap(res).status).toBe(200);
    expect(unwrap(res).body.ok).toBe(true);
    expect(unwrap(res).body.deleted).toEqual(['draft']);
    expect(prisma.homepageContent.deleteMany).toHaveBeenCalledWith({ where: { status: { in: ['draft'] } } });
  });

  it('deletes published row when target=published', async () => {
    resolveAdminAuth.mockResolvedValueOnce(null);
    prisma.homepageContent.deleteMany.mockResolvedValueOnce({ count: 1 });
    const req = { url: 'http://localhost/api/admin/homepage-content?target=published' };
    const res = await DELETE(req);
    expect(unwrap(res).body.deleted).toEqual(['published']);
  });

  it('deletes both rows when target=all', async () => {
    resolveAdminAuth.mockResolvedValueOnce(null);
    prisma.homepageContent.deleteMany.mockResolvedValueOnce({ count: 2 });
    const req = { url: 'http://localhost/api/admin/homepage-content?target=all' };
    const res = await DELETE(req);
    expect(unwrap(res).body.deleted).toEqual(['draft', 'published']);
  });

  it('returns 400 for invalid target', async () => {
    resolveAdminAuth.mockResolvedValueOnce(null);
    const req = { url: 'http://localhost/api/admin/homepage-content?target=everything' };
    const res = await DELETE(req);
    expect(unwrap(res).status).toBe(400);
  });
});
