/**
 * API tests for /api/bulletin/[id]/comments — GET (public list) and
 * POST (add comment, logged-in league members only).
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
    bulletinComment: { findMany: vi.fn(), create: vi.fn() },
    bulletinPost: { findUnique: vi.fn() },
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
const { GET, POST } = await import('@/app/api/bulletin/[id]/comments/route.js');

const SESSION = { discordId: 'discord-1', username: 'Frank', roles: [] };
const PARAMS = { params: { id: 'post-1' } };

const COMMENTS = [
  { id: 'c1', authorName: 'Alice', body: 'nice post', createdAt: new Date('2026-01-01'), discordId: 'discord-1' },
  { id: 'c2', authorName: 'Bob', body: 'agreed', createdAt: new Date('2026-01-02'), discordId: 'discord-2' },
];

beforeEach(() => {
  vi.clearAllMocks();
  getDiscordSessionUser.mockReturnValue(null);
  checkRateLimit.mockResolvedValue({ allowed: true });
  prisma.bulletinComment.findMany.mockResolvedValue(COMMENTS);
  prisma.bulletinPost.findUnique.mockResolvedValue({ id: 'post-1', status: 'published' });
  prisma.bulletinComment.create.mockResolvedValue({
    id: 'c3', authorName: 'Frank', body: 'my comment', createdAt: new Date('2026-01-03'),
  });
});

describe('GET /api/bulletin/[id]/comments', () => {
  it('lists comments without requiring auth, marking isOwn false with no session', async () => {
    const res = await GET({}, PARAMS);
    const { status, body } = unwrap(res);
    expect(status).toBe(200);
    expect(body.comments).toHaveLength(2);
    expect(body.comments.every((c) => c.isOwn === false)).toBe(true);
  });

  it('marks the caller\'s own comment as isOwn:true when a session matches', async () => {
    getDiscordSessionUser.mockReturnValue(SESSION);
    const res = await GET({}, PARAMS);
    const { body } = unwrap(res);
    const own = body.comments.find((c) => c.id === 'c1');
    const other = body.comments.find((c) => c.id === 'c2');
    expect(own.isOwn).toBe(true);
    expect(other.isOwn).toBe(false);
  });

  it('does not leak discordId in the response payload', async () => {
    const res = await GET({}, PARAMS);
    const { body } = unwrap(res);
    expect(body.comments[0].discordId).toBeUndefined();
  });

  it('returns 500 when the database read fails', async () => {
    prisma.bulletinComment.findMany.mockRejectedValue(new Error('db down'));
    const res = await GET({}, PARAMS);
    const { status, body } = unwrap(res);
    expect(status).toBe(500);
    expect(body.error).toMatch(/failed to load/i);
  });
});

describe('POST /api/bulletin/[id]/comments', () => {
  it('returns 401 when not authenticated', async () => {
    const res = await POST(makeReq({ body: 'hello' }), PARAMS);
    expect(unwrap(res).status).toBe(401);
  });

  it('returns 429 when rate limited', async () => {
    getDiscordSessionUser.mockReturnValue(SESSION);
    checkRateLimit.mockResolvedValue({ allowed: false });
    const res = await POST(makeReq({ body: 'hello' }), PARAMS);
    expect(unwrap(res).status).toBe(429);
    expect(checkRateLimit).toHaveBeenCalledWith('bulletin-comment:discord-1', 10, 60);
  });

  it('returns 400 for malformed JSON', async () => {
    getDiscordSessionUser.mockReturnValue(SESSION);
    const res = await POST(makeInvalidJsonReq(), PARAMS);
    expect(unwrap(res).status).toBe(400);
  });

  it('returns 400 for an empty/whitespace-only comment body', async () => {
    getDiscordSessionUser.mockReturnValue(SESSION);
    const res = await POST(makeReq({ body: '   ' }), PARAMS);
    expect(unwrap(res).status).toBe(400);
  });

  it('returns 400 for a comment over the max length', async () => {
    getDiscordSessionUser.mockReturnValue(SESSION);
    const res = await POST(makeReq({ body: 'x'.repeat(1001) }), PARAMS);
    expect(unwrap(res).status).toBe(400);
  });

  it('returns 404 when the post does not exist or is not published', async () => {
    getDiscordSessionUser.mockReturnValue(SESSION);
    prisma.bulletinPost.findUnique.mockResolvedValue(null);
    const res = await POST(makeReq({ body: 'hello' }), PARAMS);
    expect(unwrap(res).status).toBe(404);
  });

  it('returns 404 when the post is still a draft', async () => {
    getDiscordSessionUser.mockReturnValue(SESSION);
    prisma.bulletinPost.findUnique.mockResolvedValue({ id: 'post-1', status: 'draft' });
    const res = await POST(makeReq({ body: 'hello' }), PARAMS);
    expect(unwrap(res).status).toBe(404);
  });

  it('creates the comment and returns 201 with isOwn:true', async () => {
    getDiscordSessionUser.mockReturnValue(SESSION);
    const res = await POST(makeReq({ body: '  my comment  ' }), PARAMS);
    const { status, body } = unwrap(res);
    expect(status).toBe(201);
    expect(body.isOwn).toBe(true);
    expect(prisma.bulletinComment.create).toHaveBeenCalledWith({
      data: { postId: 'post-1', discordId: 'discord-1', authorName: 'Frank', body: 'my comment' },
    });
  });

  it('returns 500 when comment creation fails', async () => {
    getDiscordSessionUser.mockReturnValue(SESSION);
    prisma.bulletinComment.create.mockRejectedValue(new Error('db down'));
    const res = await POST(makeReq({ body: 'hello' }), PARAMS);
    const { status, body } = unwrap(res);
    expect(status).toBe(500);
    expect(body.error).toMatch(/failed to add/i);
  });
});
