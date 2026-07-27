/**
 * API tests for POST /api/superlatives/suggest — public (league-member)
 * superlative suggestion. Always lands as `suggested` pending admin review.
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
  const prisma = { superlative: { create: vi.fn() } };
  return { default: prisma };
});

// ─── Mock @/lib/discordAuth ──────────────────────────────────────────────────
vi.mock('@/lib/discordAuth', () => ({
  getDiscordSessionUser: vi.fn(),
  hasDiscordPlayerRole: vi.fn(),
  hasDiscordAdminRole: vi.fn(),
}));

// ─── Mock @/lib/rateLimit ────────────────────────────────────────────────────
vi.mock('@/lib/rateLimit', () => ({
  checkRateLimit: vi.fn(),
}));

const { default: prisma } = await import('@/lib/db');
const { getDiscordSessionUser, hasDiscordPlayerRole, hasDiscordAdminRole } = await import('@/lib/discordAuth');
const { checkRateLimit } = await import('@/lib/rateLimit');
const { POST } = await import('@/app/api/superlatives/suggest/route.js');

const SESSION = { discordId: 'discord-1', username: 'Frank', roles: [] };
const VALID_BODY = { title: 'Most Likely to Rage Quit', description: 'Self explanatory', nominee: 'Bob' };

beforeEach(() => {
  vi.clearAllMocks();
  getDiscordSessionUser.mockReturnValue(SESSION);
  hasDiscordPlayerRole.mockReturnValue(true);
  hasDiscordAdminRole.mockReturnValue(false);
  checkRateLimit.mockResolvedValue({ allowed: true });
  prisma.superlative.create.mockResolvedValue({ id: 'sup-1' });
});

describe('POST /api/superlatives/suggest', () => {
  it('returns 401 when not authenticated', async () => {
    getDiscordSessionUser.mockReturnValue(null);
    const res = await POST(makeReq(VALID_BODY));
    expect(unwrap(res).status).toBe(401);
  });

  it('returns 403 when the caller has neither player nor admin role', async () => {
    hasDiscordPlayerRole.mockReturnValue(false);
    hasDiscordAdminRole.mockReturnValue(false);
    const res = await POST(makeReq(VALID_BODY));
    expect(unwrap(res).status).toBe(403);
  });

  it('allows submission for an admin without the player role', async () => {
    hasDiscordPlayerRole.mockReturnValue(false);
    hasDiscordAdminRole.mockReturnValue(true);
    const res = await POST(makeReq(VALID_BODY));
    expect(unwrap(res).status).toBe(201);
  });

  it('returns 429 when the submitter is rate limited', async () => {
    checkRateLimit.mockResolvedValue({ allowed: false });
    const res = await POST(makeReq(VALID_BODY));
    expect(unwrap(res).status).toBe(429);
    expect(checkRateLimit).toHaveBeenCalledWith('superlatives-suggest:discord-1', 5, 600);
    expect(prisma.superlative.create).not.toHaveBeenCalled();
  });

  it('returns 400 for malformed JSON', async () => {
    const res = await POST(makeInvalidJsonReq());
    expect(unwrap(res).status).toBe(400);
  });

  it('returns 400 when title is missing/blank', async () => {
    const res = await POST(makeReq({ ...VALID_BODY, title: '   ' }));
    expect(unwrap(res).status).toBe(400);
    expect(prisma.superlative.create).not.toHaveBeenCalled();
  });

  it('creates the suggestion as `suggested` status and returns 201', async () => {
    const res = await POST(makeReq(VALID_BODY));
    const { status, body } = unwrap(res);
    expect(status).toBe(201);
    expect(body.ok).toBe(true);
    expect(body.id).toBe('sup-1');
    expect(prisma.superlative.create).toHaveBeenCalledWith({
      data: {
        title: 'Most Likely to Rage Quit',
        description: 'Self explanatory',
        nominee: 'Bob',
        status: 'suggested',
        suggestedBy: 'Frank',
      },
    });
  });

  it('defaults description and nominee to null when omitted', async () => {
    await POST(makeReq({ title: 'Best Draft Pick' }));
    expect(prisma.superlative.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ description: null, nominee: null }),
    });
  });

  it('trims whitespace from title, description, and nominee', async () => {
    await POST(makeReq({ title: '  Trimmed Title  ', description: '  desc  ', nominee: '  nom  ' }));
    expect(prisma.superlative.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ title: 'Trimmed Title', description: 'desc', nominee: 'nom' }),
    });
  });

  it('returns 500 when creation fails', async () => {
    prisma.superlative.create.mockRejectedValue(new Error('db down'));
    const res = await POST(makeReq(VALID_BODY));
    const { status, body } = unwrap(res);
    expect(status).toBe(500);
    expect(body.error).toMatch(/failed to submit/i);
  });
});
