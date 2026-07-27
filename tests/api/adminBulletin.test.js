/**
 * API tests for /api/admin/bulletin (list/create) and
 * /api/admin/bulletin/[id] (update/delete).
 *
 * bulletinHelpers.createBulletinPostWithUniqueSlug runs unmocked (it's a thin
 * wrapper around prisma.bulletinPost.create), so @/lib/db is mocked directly
 * rather than mocking @/lib/bulletinHelpers.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeReq, makeInvalidJsonReq, unwrap } from './_helpers.js';

vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((body, init) => ({ _body: body, _status: init?.status ?? 200 })),
  },
}));

vi.mock('@/lib/resolveAuth', () => ({
  resolveAdminAuth: vi.fn(),
}));

vi.mock('@/lib/discordAuth', () => ({
  getDiscordSessionUser: vi.fn(),
}));

vi.mock('@/lib/db', () => {
  const prisma = {
    bulletinPost: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  };
  return { default: prisma };
});

const { default: prisma } = await import('@/lib/db');
const { resolveAdminAuth } = await import('@/lib/resolveAuth');
const { getDiscordSessionUser } = await import('@/lib/discordAuth');
const { GET, POST } = await import('@/app/api/admin/bulletin/route.js');
const { PATCH, DELETE } = await import('@/app/api/admin/bulletin/[id]/route.js');

function reqWithUrl(url) {
  return { url };
}

const VALID_BODY = { title: 'Big Trade!', type: 'announcement', body: 'Something happened.' };
const EXISTING_POST = { id: 'post-1', title: 'Old', type: 'announcement', body: 'old', status: 'draft', publishedAt: null };

beforeEach(() => {
  vi.clearAllMocks();
  resolveAdminAuth.mockResolvedValue(null);
  getDiscordSessionUser.mockReturnValue({ username: 'AdminUser' });
});

describe('GET /api/admin/bulletin', () => {
  it('returns 401 when not authorized', async () => {
    resolveAdminAuth.mockResolvedValue({ _body: { error: 'Unauthorized' }, _status: 401 });
    const res = await GET(reqWithUrl('http://localhost/api/admin/bulletin'));
    expect(unwrap(res).status).toBe(401);
  });

  it('filters by status when provided', async () => {
    prisma.bulletinPost.findMany.mockResolvedValue([]);
    await GET(reqWithUrl('http://localhost/api/admin/bulletin?status=draft'));
    expect(prisma.bulletinPost.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'draft' } })
    );
  });

  it('returns 500 on a database error', async () => {
    prisma.bulletinPost.findMany.mockRejectedValue(new Error('db down'));
    const res = await GET(reqWithUrl('http://localhost/api/admin/bulletin'));
    expect(unwrap(res).status).toBe(500);
  });
});

describe('POST /api/admin/bulletin', () => {
  it('returns 401 when not authorized', async () => {
    resolveAdminAuth.mockResolvedValue({ _body: { error: 'Unauthorized' }, _status: 401 });
    const res = await POST(makeReq(VALID_BODY));
    expect(unwrap(res).status).toBe(401);
  });

  it('returns 400 for invalid JSON', async () => {
    const res = await POST(makeInvalidJsonReq());
    expect(unwrap(res).status).toBe(400);
  });

  it('returns 400 when title is missing or blank', async () => {
    const res = await POST(makeReq({ ...VALID_BODY, title: '  ' }));
    expect(unwrap(res).status).toBe(400);
  });

  it('returns 400 for an invalid type', async () => {
    const res = await POST(makeReq({ ...VALID_BODY, type: 'not-a-real-type' }));
    expect(unwrap(res).status).toBe(400);
  });

  it('returns 400 when body is missing or blank', async () => {
    const res = await POST(makeReq({ ...VALID_BODY, body: '' }));
    expect(unwrap(res).status).toBe(400);
  });

  it('creates a draft post by default, attributed to the acting admin', async () => {
    prisma.bulletinPost.create.mockResolvedValue({ id: 'post-1', status: 'draft', ...VALID_BODY });
    const res = await POST(makeReq(VALID_BODY));
    expect(unwrap(res).status).toBe(201);
    expect(prisma.bulletinPost.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        title: 'Big Trade!',
        status: 'draft',
        createdById: 'AdminUser',
        publishedAt: null,
        slug: 'big-trade',
      }),
    });
  });

  it('creates a published post with publishedAt stamped when status is published', async () => {
    prisma.bulletinPost.create.mockResolvedValue({ id: 'post-1', status: 'published' });
    const res = await POST(makeReq({ ...VALID_BODY, status: 'published' }));
    expect(unwrap(res).status).toBe(201);
    expect(prisma.bulletinPost.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ status: 'published', publishedAt: expect.any(Date) }),
    });
  });

  it('returns 500 on a database error', async () => {
    prisma.bulletinPost.create.mockRejectedValue(new Error('db down'));
    const res = await POST(makeReq(VALID_BODY));
    expect(unwrap(res).status).toBe(500);
  });
});

describe('PATCH /api/admin/bulletin/[id]', () => {
  const PARAMS = { params: { id: 'post-1' } };

  it('returns 401 when not authorized', async () => {
    resolveAdminAuth.mockResolvedValue({ _body: { error: 'Unauthorized' }, _status: 401 });
    const res = await PATCH(makeReq({ title: 'New' }), PARAMS);
    expect(unwrap(res).status).toBe(401);
  });

  it('returns 400 for invalid JSON', async () => {
    const res = await PATCH(makeInvalidJsonReq(), PARAMS);
    expect(unwrap(res).status).toBe(400);
  });

  it('returns 404 when the post does not exist', async () => {
    prisma.bulletinPost.findUnique.mockResolvedValue(null);
    const res = await PATCH(makeReq({ title: 'New' }), PARAMS);
    expect(unwrap(res).status).toBe(404);
  });

  it('returns 400 for an invalid type', async () => {
    prisma.bulletinPost.findUnique.mockResolvedValue(EXISTING_POST);
    const res = await PATCH(makeReq({ type: 'nonsense' }), PARAMS);
    expect(unwrap(res).status).toBe(400);
  });

  it('returns 400 for an invalid status', async () => {
    prisma.bulletinPost.findUnique.mockResolvedValue(EXISTING_POST);
    const res = await PATCH(makeReq({ status: 'nonsense' }), PARAMS);
    expect(unwrap(res).status).toBe(400);
  });

  it('updates fields and records the updating admin', async () => {
    prisma.bulletinPost.findUnique.mockResolvedValue(EXISTING_POST);
    prisma.bulletinPost.update.mockResolvedValue({ ...EXISTING_POST, title: 'Updated' });
    const res = await PATCH(makeReq({ title: 'Updated' }), PARAMS);
    expect(unwrap(res).status).toBe(200);
    expect(prisma.bulletinPost.update).toHaveBeenCalledWith({
      where: { id: 'post-1' },
      data: expect.objectContaining({ title: 'Updated', updatedById: 'AdminUser' }),
    });
  });

  it('stamps publishedAt only the first time a post is published', async () => {
    prisma.bulletinPost.findUnique.mockResolvedValue(EXISTING_POST); // publishedAt: null
    prisma.bulletinPost.update.mockResolvedValue({ ...EXISTING_POST, status: 'published' });
    await PATCH(makeReq({ status: 'published' }), PARAMS);
    expect(prisma.bulletinPost.update).toHaveBeenCalledWith({
      where: { id: 'post-1' },
      data: expect.objectContaining({ status: 'published', publishedAt: expect.any(Date) }),
    });
  });

  it('does not re-stamp publishedAt when already published', async () => {
    prisma.bulletinPost.findUnique.mockResolvedValue({ ...EXISTING_POST, publishedAt: new Date('2020-01-01') });
    prisma.bulletinPost.update.mockResolvedValue({ ...EXISTING_POST, status: 'published' });
    await PATCH(makeReq({ status: 'published' }), PARAMS);
    const call = prisma.bulletinPost.update.mock.calls[0][0];
    expect(call.data.publishedAt).toBeUndefined();
  });

  it('returns 500 on a database error', async () => {
    prisma.bulletinPost.findUnique.mockResolvedValue(EXISTING_POST);
    prisma.bulletinPost.update.mockRejectedValue(new Error('db down'));
    const res = await PATCH(makeReq({ title: 'Updated' }), PARAMS);
    expect(unwrap(res).status).toBe(500);
  });
});

describe('DELETE /api/admin/bulletin/[id]', () => {
  const PARAMS = { params: { id: 'post-1' } };

  it('returns 401 when not authorized', async () => {
    resolveAdminAuth.mockResolvedValue({ _body: { error: 'Unauthorized' }, _status: 401 });
    const res = await DELETE(makeReq({}), PARAMS);
    expect(unwrap(res).status).toBe(401);
  });

  it('deletes the post and returns ok', async () => {
    prisma.bulletinPost.delete.mockResolvedValue(EXISTING_POST);
    const res = await DELETE(makeReq({}), PARAMS);
    expect(unwrap(res).status).toBe(200);
    expect(unwrap(res).body).toEqual({ ok: true });
  });

  it('returns 500 on a database error', async () => {
    prisma.bulletinPost.delete.mockRejectedValue(new Error('db down'));
    const res = await DELETE(makeReq({}), PARAMS);
    expect(unwrap(res).status).toBe(500);
  });
});
