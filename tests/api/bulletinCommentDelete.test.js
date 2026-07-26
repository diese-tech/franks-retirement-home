/**
 * API tests for DELETE /api/bulletin/comments/[commentId] — delete your own
 * comment, or any comment if you hold the admin role.
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
    bulletinComment: { findUnique: vi.fn(), delete: vi.fn() },
  };
  return { default: prisma };
});

// ─── Mock @/lib/discordAuth ──────────────────────────────────────────────────
vi.mock('@/lib/discordAuth', () => ({
  getDiscordSessionUser: vi.fn(),
  hasDiscordAdminRole: vi.fn(),
}));

const { default: prisma } = await import('@/lib/db');
const { getDiscordSessionUser, hasDiscordAdminRole } = await import('@/lib/discordAuth');
const { DELETE } = await import('@/app/api/bulletin/comments/[commentId]/route.js');

const OWNER_SESSION = { discordId: 'discord-1', username: 'Frank', roles: [] };
const OTHER_SESSION = { discordId: 'discord-2', username: 'Bob', roles: [] };
const PARAMS = { params: { commentId: 'c1' } };
const COMMENT = { id: 'c1', discordId: 'discord-1', body: 'hi' };

beforeEach(() => {
  vi.clearAllMocks();
  getDiscordSessionUser.mockReturnValue(OWNER_SESSION);
  hasDiscordAdminRole.mockReturnValue(false);
  prisma.bulletinComment.findUnique.mockResolvedValue(COMMENT);
  prisma.bulletinComment.delete.mockResolvedValue(COMMENT);
});

describe('DELETE /api/bulletin/comments/[commentId]', () => {
  it('returns 401 when not authenticated', async () => {
    getDiscordSessionUser.mockReturnValue(null);
    const res = await DELETE({}, PARAMS);
    expect(unwrap(res).status).toBe(401);
  });

  it('returns 404 when the comment does not exist', async () => {
    prisma.bulletinComment.findUnique.mockResolvedValue(null);
    const res = await DELETE({}, PARAMS);
    expect(unwrap(res).status).toBe(404);
  });

  it('returns 403 when the caller neither owns the comment nor is an admin', async () => {
    getDiscordSessionUser.mockReturnValue(OTHER_SESSION);
    const res = await DELETE({}, PARAMS);
    expect(unwrap(res).status).toBe(403);
    expect(prisma.bulletinComment.delete).not.toHaveBeenCalled();
  });

  it('allows the owner to delete their own comment', async () => {
    const res = await DELETE({}, PARAMS);
    const { status, body } = unwrap(res);
    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    expect(prisma.bulletinComment.delete).toHaveBeenCalledWith({ where: { id: 'c1' } });
  });

  it('allows an admin to delete someone else\'s comment', async () => {
    getDiscordSessionUser.mockReturnValue(OTHER_SESSION);
    hasDiscordAdminRole.mockReturnValue(true);
    const res = await DELETE({}, PARAMS);
    expect(unwrap(res).status).toBe(200);
    expect(prisma.bulletinComment.delete).toHaveBeenCalledWith({ where: { id: 'c1' } });
  });

  it('returns 500 when the delete fails', async () => {
    prisma.bulletinComment.delete.mockRejectedValue(new Error('db down'));
    const res = await DELETE({}, PARAMS);
    const { status, body } = unwrap(res);
    expect(status).toBe(500);
    expect(body.error).toMatch(/failed to delete/i);
  });
});
