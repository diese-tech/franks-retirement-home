/**
 * API tests for POST /api/bulletin/submit — public (league-member) bulletin
 * post submission. Always lands as a `draft` pending admin review.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeReq, makeInvalidJsonReq, unwrap } from './_helpers.js';

// ─── Mock next/server ────────────────────────────────────────────────────────
vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((body, init) => ({ _body: body, _status: init?.status ?? 200 })),
  },
}));

// ─── Mock @/lib/discordAuth ──────────────────────────────────────────────────
vi.mock('@/lib/discordAuth', () => ({
  getDiscordSessionUser: vi.fn(),
  hasDiscordPlayerRole: vi.fn(),
  hasDiscordAdminRole: vi.fn(),
}));

// ─── Mock @/lib/bulletinHelpers ──────────────────────────────────────────────
vi.mock('@/lib/bulletinHelpers', () => ({
  PLAYER_SUBMITTABLE_TYPES: ['match_hype', 'player_spotlight', 'team_roast'],
  createBulletinPostWithUniqueSlug: vi.fn(),
}));

// ─── Mock @/lib/rateLimit ────────────────────────────────────────────────────
vi.mock('@/lib/rateLimit', () => ({
  checkRateLimit: vi.fn(),
}));

const { getDiscordSessionUser, hasDiscordPlayerRole, hasDiscordAdminRole } = await import('@/lib/discordAuth');
const { createBulletinPostWithUniqueSlug } = await import('@/lib/bulletinHelpers');
const { checkRateLimit } = await import('@/lib/rateLimit');
const { POST } = await import('@/app/api/bulletin/submit/route.js');

const SESSION = { discordId: 'discord-1', username: 'Frank', roles: [] };
const VALID_BODY = { title: 'Big Win', type: 'match_hype', body: 'What a game!', excerpt: 'Recap' };

beforeEach(() => {
  vi.clearAllMocks();
  getDiscordSessionUser.mockReturnValue(SESSION);
  hasDiscordPlayerRole.mockReturnValue(true);
  hasDiscordAdminRole.mockReturnValue(false);
  checkRateLimit.mockResolvedValue({ allowed: true });
  createBulletinPostWithUniqueSlug.mockResolvedValue({ id: 'post-1' });
});

describe('POST /api/bulletin/submit', () => {
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
    expect(checkRateLimit).toHaveBeenCalledWith('bulletin-submit:discord-1', 5, 600);
    expect(createBulletinPostWithUniqueSlug).not.toHaveBeenCalled();
  });

  it('returns 400 for malformed JSON', async () => {
    const res = await POST(makeInvalidJsonReq());
    expect(unwrap(res).status).toBe(400);
  });

  it('returns 400 when title is missing/blank', async () => {
    const res = await POST(makeReq({ ...VALID_BODY, title: '   ' }));
    expect(unwrap(res).status).toBe(400);
  });

  it('returns 400 when type is not player-submittable', async () => {
    const res = await POST(makeReq({ ...VALID_BODY, type: 'weekly_recap' }));
    expect(unwrap(res).status).toBe(400);
  });

  it('returns 400 when body is missing/blank', async () => {
    const res = await POST(makeReq({ ...VALID_BODY, body: '' }));
    expect(unwrap(res).status).toBe(400);
  });

  it('creates the post as a draft pending review and returns 201', async () => {
    const res = await POST(makeReq(VALID_BODY));
    const { status, body } = unwrap(res);
    expect(status).toBe(201);
    expect(body.ok).toBe(true);
    expect(body.id).toBe('post-1');
    expect(createBulletinPostWithUniqueSlug).toHaveBeenCalledWith({
      title: 'Big Win',
      type: 'match_hype',
      body: 'What a game!',
      excerpt: 'Recap',
      status: 'draft',
      pinned: false,
      createdById: 'Frank',
    });
  });

  it('defaults excerpt to null when omitted', async () => {
    const { excerpt, ...withoutExcerpt } = VALID_BODY;
    await POST(makeReq(withoutExcerpt));
    expect(createBulletinPostWithUniqueSlug).toHaveBeenCalledWith(
      expect.objectContaining({ excerpt: null }),
    );
  });

  it('returns 500 when the post creation fails', async () => {
    createBulletinPostWithUniqueSlug.mockRejectedValue(new Error('db down'));
    const res = await POST(makeReq(VALID_BODY));
    const { status, body } = unwrap(res);
    expect(status).toBe(500);
    expect(body.error).toMatch(/failed to submit/i);
  });
});
