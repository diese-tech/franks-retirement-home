/**
 * API tests for POST /api/bulletin/[id]/reactions — toggle an emoji reaction
 * on a published bulletin post.
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
    bulletinPost: { findUnique: vi.fn() },
    bulletinReaction: {
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      groupBy: vi.fn(),
    },
  };
  return { default: prisma };
});

// ─── Mock @/lib/discordAuth ──────────────────────────────────────────────────
vi.mock('@/lib/discordAuth', () => ({
  getDiscordSessionUser: vi.fn(),
}));

// ─── Mock @/lib/rateLimit ────────────────────────────────────────────────────
vi.mock('@/lib/rateLimit', () => ({
  checkRateLimit: vi.fn(),
}));

const { default: prisma } = await import('@/lib/db');
const { getDiscordSessionUser } = await import('@/lib/discordAuth');
const { checkRateLimit } = await import('@/lib/rateLimit');
const { POST } = await import('@/app/api/bulletin/[id]/reactions/route.js');

const SESSION = { discordId: 'discord-1', username: 'Frank', roles: [] };
const PARAMS = { params: { id: 'post-1' } };

beforeEach(() => {
  vi.clearAllMocks();
  getDiscordSessionUser.mockReturnValue(SESSION);
  checkRateLimit.mockResolvedValue({ allowed: true });
  prisma.bulletinPost.findUnique.mockResolvedValue({ id: 'post-1', status: 'published' });
  prisma.bulletinReaction.findUnique.mockResolvedValue(null);
  prisma.bulletinReaction.create.mockResolvedValue({ id: 'r1' });
  prisma.bulletinReaction.delete.mockResolvedValue({ id: 'r1' });
  prisma.bulletinReaction.groupBy.mockResolvedValue([
    { emoji: 'beer', _count: { emoji: 3 } },
    { emoji: 'fire', _count: { emoji: 1 } },
  ]);
});

describe('POST /api/bulletin/[id]/reactions', () => {
  it('returns 401 when not authenticated', async () => {
    getDiscordSessionUser.mockReturnValue(null);
    const res = await POST(makeReq({ emoji: 'beer' }), PARAMS);
    expect(unwrap(res).status).toBe(401);
  });

  it('returns 429 when rate limited', async () => {
    checkRateLimit.mockResolvedValue({ allowed: false });
    const res = await POST(makeReq({ emoji: 'beer' }), PARAMS);
    expect(unwrap(res).status).toBe(429);
    expect(checkRateLimit).toHaveBeenCalledWith('bulletin-react:discord-1', 30, 60);
  });

  it('returns 400 for malformed JSON', async () => {
    const res = await POST(makeInvalidJsonReq(), PARAMS);
    expect(unwrap(res).status).toBe(400);
  });

  it('returns 400 for an emoji outside the allowed palette', async () => {
    const res = await POST(makeReq({ emoji: 'poop' }), PARAMS);
    expect(unwrap(res).status).toBe(400);
  });

  it('returns 404 when the post does not exist or is unpublished', async () => {
    prisma.bulletinPost.findUnique.mockResolvedValue(null);
    const res = await POST(makeReq({ emoji: 'beer' }), PARAMS);
    expect(unwrap(res).status).toBe(404);
  });

  it('adds a reaction (toggle on) when none exists yet', async () => {
    const res = await POST(makeReq({ emoji: 'beer' }), PARAMS);
    const { status, body } = unwrap(res);
    expect(status).toBe(200);
    expect(body.reacted).toBe(true);
    expect(body.emoji).toBe('beer');
    expect(prisma.bulletinReaction.create).toHaveBeenCalledWith({
      data: { postId: 'post-1', discordId: 'discord-1', emoji: 'beer' },
    });
    expect(prisma.bulletinReaction.delete).not.toHaveBeenCalled();
    expect(body.counts).toEqual({ beer: 3, fire: 1 });
  });

  it('removes a reaction (toggle off) when one already exists', async () => {
    prisma.bulletinReaction.findUnique.mockResolvedValue({ id: 'existing-r1' });
    const res = await POST(makeReq({ emoji: 'beer' }), PARAMS);
    const { status, body } = unwrap(res);
    expect(status).toBe(200);
    expect(body.reacted).toBe(false);
    expect(prisma.bulletinReaction.delete).toHaveBeenCalledWith({ where: { id: 'existing-r1' } });
    expect(prisma.bulletinReaction.create).not.toHaveBeenCalled();
  });

  it('returns 500 when the reaction lookup fails', async () => {
    prisma.bulletinReaction.findUnique.mockRejectedValue(new Error('db down'));
    const res = await POST(makeReq({ emoji: 'beer' }), PARAMS);
    const { status, body } = unwrap(res);
    expect(status).toBe(500);
    expect(body.error).toMatch(/failed to react/i);
  });
});
