/**
 * API tests for /api/bulletin-board and /api/bulletin-board/[id]
 *
 * Strategy: mock prisma, bulletinAuth, and NextResponse so no DB or Next.js runtime is needed.
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

// ─── Mock @/lib/bulletinAuth ─────────────────────────────────────────────────
vi.mock('@/lib/bulletinAuth', () => ({
  getBulletinAdmin: vi.fn(),
  requireBulletinAdmin: vi.fn(),
}));

const { default: prisma } = await import('@/lib/db');
const { getBulletinAdmin, requireBulletinAdmin } = await import('@/lib/bulletinAuth');
const { GET, POST } = await import('@/app/api/bulletin-board/route.js');
const { GET: GET_ID, PATCH, DELETE } = await import('@/app/api/bulletin-board/[id]/route.js');

// ─── Helpers ─────────────────────────────────────────────────────────────────
function makeReq(body, url = 'http://localhost/api/bulletin-board') {
  return {
    url,
    json: () => Promise.resolve(body),
    headers: { get: () => null },
  };
}

function makeInvalidJsonReq(url = 'http://localhost/api/bulletin-board') {
  return {
    url,
    json: () => { throw new SyntaxError('bad json'); },
    headers: { get: () => null },
  };
}

const PARAMS = { params: { id: 'post-123' } };

const MOCK_POST = {
  id: 'post-123',
  title: 'Test Post',
  slug: 'test-post-ab12',
  type: 'announcement',
  body: 'Hello world',
  status: 'published',
  pinned: false,
  publishedAt: new Date(),
  createdAt: new Date(),
};

beforeEach(() => {
  vi.clearAllMocks();
  // Default: no auth errors (admin is authorized)
  requireBulletinAdmin.mockReturnValue(null);
  getBulletinAdmin.mockReturnValue({ username: 'admin-user', roles: ['admin-role'] });
});

// ─── GET /api/bulletin-board ─────────────────────────────────────────────────
describe('GET /api/bulletin-board', () => {
  it('returns published posts for non-admins', async () => {
    getBulletinAdmin.mockReturnValue(null);
    prisma.bulletinPost.findMany.mockResolvedValue([MOCK_POST]);
    const req = makeReq(null, 'http://localhost/api/bulletin-board');
    const res = await GET(req);
    expect(unwrap(res).status).toBe(200);
    expect(unwrap(res).body).toEqual([MOCK_POST]);
    // Verify the where clause was called with status: 'published'
    expect(prisma.bulletinPost.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: 'published' }) })
    );
  });

  it('allows admin to filter by status', async () => {
    prisma.bulletinPost.findMany.mockResolvedValue([]);
    const req = makeReq(null, 'http://localhost/api/bulletin-board?status=draft');
    const res = await GET(req);
    expect(unwrap(res).status).toBe(200);
    expect(prisma.bulletinPost.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: 'draft' }) })
    );
  });

  it('ignores status filter for non-admins (fail-closed)', async () => {
    getBulletinAdmin.mockReturnValue(null);
    prisma.bulletinPost.findMany.mockResolvedValue([]);
    const req = makeReq(null, 'http://localhost/api/bulletin-board?status=draft');
    const res = await GET(req);
    expect(unwrap(res).status).toBe(200);
    expect(prisma.bulletinPost.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: 'published' }) })
    );
  });
});

// ─── POST /api/bulletin-board ────────────────────────────────────────────────
describe('POST /api/bulletin-board', () => {
  it('returns 401 when not authenticated', async () => {
    const authResponse = { _body: { error: 'Authentication required' }, _status: 401 };
    requireBulletinAdmin.mockReturnValue(authResponse);
    const req = makeReq({ title: 'Test', type: 'announcement' });
    const res = await POST(req);
    expect(unwrap(res).status).toBe(401);
  });

  it('returns 403 when not admin', async () => {
    const authResponse = { _body: { error: 'Admin role required' }, _status: 403 };
    requireBulletinAdmin.mockReturnValue(authResponse);
    const req = makeReq({ title: 'Test', type: 'announcement' });
    const res = await POST(req);
    expect(unwrap(res).status).toBe(403);
  });

  it('returns 400 for invalid JSON body', async () => {
    const req = makeInvalidJsonReq();
    const res = await POST(req);
    expect(unwrap(res).status).toBe(400);
    expect(unwrap(res).body.error).toMatch(/invalid json/i);
  });

  it('returns 400 when title is missing', async () => {
    const req = makeReq({ type: 'announcement' });
    const res = await POST(req);
    expect(unwrap(res).status).toBe(400);
    expect(unwrap(res).body.error).toMatch(/title/i);
  });

  it('returns 400 when title is empty string', async () => {
    const req = makeReq({ title: '   ', type: 'announcement' });
    const res = await POST(req);
    expect(unwrap(res).status).toBe(400);
    expect(unwrap(res).body.error).toMatch(/title/i);
  });

  it('returns 400 when type is missing', async () => {
    const req = makeReq({ title: 'Test Post' });
    const res = await POST(req);
    expect(unwrap(res).status).toBe(400);
    expect(unwrap(res).body.error).toMatch(/type/i);
  });

  it('returns 400 when type is invalid', async () => {
    const req = makeReq({ title: 'Test Post', type: 'invalid_type' });
    const res = await POST(req);
    expect(unwrap(res).status).toBe(400);
    expect(unwrap(res).body.error).toMatch(/type must be one of/i);
  });

  it('creates post with valid data', async () => {
    prisma.bulletinPost.create.mockResolvedValue(MOCK_POST);
    const req = makeReq({ title: 'Test Post', type: 'announcement', body: 'Hello' });
    const res = await POST(req);
    expect(unwrap(res).status).toBe(201);
    expect(unwrap(res).body).toEqual(MOCK_POST);
    expect(prisma.bulletinPost.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: 'Test Post',
          type: 'announcement',
          body: 'Hello',
          createdBy: 'admin-user',
        }),
      })
    );
  });

  it('retries on slug collision (P2002) and succeeds', async () => {
    const p2002Error = new Error('Unique constraint failed');
    p2002Error.code = 'P2002';
    prisma.bulletinPost.create
      .mockRejectedValueOnce(p2002Error)
      .mockResolvedValueOnce(MOCK_POST);
    const req = makeReq({ title: 'Test Post', type: 'announcement' });
    const res = await POST(req);
    expect(unwrap(res).status).toBe(201);
    expect(prisma.bulletinPost.create).toHaveBeenCalledTimes(2);
  });

  it('returns 409 after 3 slug collisions', async () => {
    const p2002Error = new Error('Unique constraint failed');
    p2002Error.code = 'P2002';
    prisma.bulletinPost.create
      .mockRejectedValueOnce(p2002Error)
      .mockRejectedValueOnce(p2002Error)
      .mockRejectedValueOnce(p2002Error);
    const req = makeReq({ title: 'Test Post', type: 'announcement' });
    const res = await POST(req);
    expect(unwrap(res).status).toBe(409);
    expect(unwrap(res).body.error).toMatch(/unique slug/i);
    expect(prisma.bulletinPost.create).toHaveBeenCalledTimes(3);
  });

  it('sets publishedAt when status is published', async () => {
    prisma.bulletinPost.create.mockResolvedValue(MOCK_POST);
    const req = makeReq({ title: 'Test', type: 'announcement', status: 'published' });
    await POST(req);
    expect(prisma.bulletinPost.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'published',
          publishedAt: expect.any(Date),
        }),
      })
    );
  });

  it('defaults status to draft', async () => {
    prisma.bulletinPost.create.mockResolvedValue(MOCK_POST);
    const req = makeReq({ title: 'Test', type: 'announcement' });
    await POST(req);
    expect(prisma.bulletinPost.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'draft',
          publishedAt: null,
        }),
      })
    );
  });
});

// ─── PATCH /api/bulletin-board/[id] ──────────────────────────────────────────
describe('PATCH /api/bulletin-board/[id]', () => {
  it('returns 401/403 when not admin', async () => {
    const authResponse = { _body: { error: 'Admin role required' }, _status: 403 };
    requireBulletinAdmin.mockReturnValue(authResponse);
    const req = makeReq({ title: 'New Title' });
    const res = await PATCH(req, PARAMS);
    expect(unwrap(res).status).toBe(403);
  });

  it('returns 404 when post does not exist', async () => {
    prisma.bulletinPost.findUnique.mockResolvedValue(null);
    const req = makeReq({ title: 'New Title' });
    const res = await PATCH(req, PARAMS);
    expect(unwrap(res).status).toBe(404);
  });

  it('returns 400 for invalid JSON', async () => {
    const req = makeInvalidJsonReq();
    const res = await PATCH(req, PARAMS);
    expect(unwrap(res).status).toBe(400);
    expect(unwrap(res).body.error).toMatch(/invalid json/i);
  });

  it('updates title without changing slug', async () => {
    prisma.bulletinPost.findUnique.mockResolvedValue(MOCK_POST);
    const updatedPost = { ...MOCK_POST, title: 'New Title' };
    prisma.bulletinPost.update.mockResolvedValue(updatedPost);
    const req = makeReq({ title: 'New Title' });
    const res = await PATCH(req, PARAMS);
    expect(unwrap(res).status).toBe(200);
    // Verify that update was called with title but NOT slug
    const updateCall = prisma.bulletinPost.update.mock.calls[0][0];
    expect(updateCall.data.title).toBe('New Title');
    expect(updateCall.data.slug).toBeUndefined();
  });

  it('validates type enum on update', async () => {
    prisma.bulletinPost.findUnique.mockResolvedValue(MOCK_POST);
    const req = makeReq({ type: 'invalid_type' });
    const res = await PATCH(req, PARAMS);
    expect(unwrap(res).status).toBe(400);
    expect(unwrap(res).body.error).toMatch(/type must be one of/i);
  });

  it('sets publishedAt on first publish', async () => {
    const draftPost = { ...MOCK_POST, status: 'draft', publishedAt: null };
    prisma.bulletinPost.findUnique.mockResolvedValue(draftPost);
    prisma.bulletinPost.update.mockResolvedValue({ ...draftPost, status: 'published' });
    const req = makeReq({ status: 'published' });
    const res = await PATCH(req, PARAMS);
    expect(unwrap(res).status).toBe(200);
    const updateCall = prisma.bulletinPost.update.mock.calls[0][0];
    expect(updateCall.data.publishedAt).toBeInstanceOf(Date);
  });

  it('does not overwrite publishedAt on re-publish', async () => {
    const existingDate = new Date('2024-01-01');
    const publishedPost = { ...MOCK_POST, status: 'archived', publishedAt: existingDate };
    prisma.bulletinPost.findUnique.mockResolvedValue(publishedPost);
    prisma.bulletinPost.update.mockResolvedValue({ ...publishedPost, status: 'published' });
    const req = makeReq({ status: 'published' });
    const res = await PATCH(req, PARAMS);
    expect(unwrap(res).status).toBe(200);
    const updateCall = prisma.bulletinPost.update.mock.calls[0][0];
    expect(updateCall.data.publishedAt).toBeUndefined();
  });
});

// ─── DELETE /api/bulletin-board/[id] ─────────────────────────────────────────
describe('DELETE /api/bulletin-board/[id]', () => {
  it('returns 401/403 when not admin', async () => {
    const authResponse = { _body: { error: 'Authentication required' }, _status: 401 };
    requireBulletinAdmin.mockReturnValue(authResponse);
    const req = makeReq(null);
    const res = await DELETE(req, PARAMS);
    expect(unwrap(res).status).toBe(401);
  });

  it('returns 404 when post not found', async () => {
    const p2025Error = new Error('Record not found');
    p2025Error.code = 'P2025';
    prisma.bulletinPost.delete.mockRejectedValue(p2025Error);
    const req = makeReq(null);
    const res = await DELETE(req, PARAMS);
    expect(unwrap(res).status).toBe(404);
  });

  it('deletes post successfully', async () => {
    prisma.bulletinPost.delete.mockResolvedValue(MOCK_POST);
    const req = makeReq(null);
    const res = await DELETE(req, PARAMS);
    expect(unwrap(res).status).toBe(200);
    expect(unwrap(res).body.ok).toBe(true);
  });
});

// ─── GET /api/bulletin-board/[id] ────────────────────────────────────────────
describe('GET /api/bulletin-board/[id]', () => {
  it('returns published post without auth', async () => {
    getBulletinAdmin.mockReturnValue(null);
    prisma.bulletinPost.findUnique.mockResolvedValue(MOCK_POST);
    const req = makeReq(null);
    const res = await GET_ID(req, PARAMS);
    expect(unwrap(res).status).toBe(200);
    expect(unwrap(res).body).toEqual(MOCK_POST);
  });

  it('returns 403 for draft post when not admin', async () => {
    getBulletinAdmin.mockReturnValue(null);
    prisma.bulletinPost.findUnique.mockResolvedValue({ ...MOCK_POST, status: 'draft' });
    const req = makeReq(null);
    const res = await GET_ID(req, PARAMS);
    expect(unwrap(res).status).toBe(403);
  });

  it('returns draft post when admin', async () => {
    prisma.bulletinPost.findUnique.mockResolvedValue({ ...MOCK_POST, status: 'draft' });
    const req = makeReq(null);
    const res = await GET_ID(req, PARAMS);
    expect(unwrap(res).status).toBe(200);
  });

  it('returns 404 when post not found', async () => {
    prisma.bulletinPost.findUnique.mockResolvedValue(null);
    const req = makeReq(null);
    const res = await GET_ID(req, PARAMS);
    expect(unwrap(res).status).toBe(404);
  });
});
