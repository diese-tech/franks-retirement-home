/**
 * API tests for /api/admin/superlatives (list/create) and
 * /api/admin/superlatives/[id] (update/delete — including the
 * suggested -> active approval flow that stamps createdById).
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
    superlative: {
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
const { GET, POST } = await import('@/app/api/admin/superlatives/route.js');
const { PATCH, DELETE } = await import('@/app/api/admin/superlatives/[id]/route.js');

function reqWithUrl(url) {
  return { url };
}

const VALID_BODY = { title: 'Biggest Choker', description: 'Blew a 3-0 lead', nominee: 'Team X', weekLabel: 'Week 3' };
const SUGGESTED = { id: 'sup-1', title: 'Fan suggestion', status: 'suggested' };
const ACTIVE = { id: 'sup-2', title: 'Existing', status: 'active' };

beforeEach(() => {
  vi.clearAllMocks();
  resolveAdminAuth.mockResolvedValue(null);
  getDiscordSessionUser.mockReturnValue({ username: 'AdminUser' });
});

describe('GET /api/admin/superlatives', () => {
  it('returns 401 when not authorized', async () => {
    resolveAdminAuth.mockResolvedValue({ _body: { error: 'Unauthorized' }, _status: 401 });
    const res = await GET(reqWithUrl('http://localhost/api/admin/superlatives'));
    expect(unwrap(res).status).toBe(401);
  });

  it('filters by status when provided', async () => {
    prisma.superlative.findMany.mockResolvedValue([]);
    await GET(reqWithUrl('http://localhost/api/admin/superlatives?status=suggested'));
    expect(prisma.superlative.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'suggested' } })
    );
  });

  it('returns 500 on a database error', async () => {
    prisma.superlative.findMany.mockRejectedValue(new Error('db down'));
    const res = await GET(reqWithUrl('http://localhost/api/admin/superlatives'));
    expect(unwrap(res).status).toBe(500);
  });
});

describe('POST /api/admin/superlatives', () => {
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
    const res = await POST(makeReq({ ...VALID_BODY, title: '' }));
    expect(unwrap(res).status).toBe(400);
  });

  it('creates an active superlative attributed to the acting admin', async () => {
    prisma.superlative.create.mockResolvedValue({ id: 'sup-1', status: 'active' });
    const res = await POST(makeReq(VALID_BODY));
    expect(unwrap(res).status).toBe(201);
    expect(prisma.superlative.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ status: 'active', createdById: 'AdminUser' }),
    });
  });

  it('returns 500 on a database error', async () => {
    prisma.superlative.create.mockRejectedValue(new Error('db down'));
    const res = await POST(makeReq(VALID_BODY));
    expect(unwrap(res).status).toBe(500);
  });
});

describe('PATCH /api/admin/superlatives/[id]', () => {
  const PARAMS = { params: { id: 'sup-1' } };

  it('returns 401 when not authorized', async () => {
    resolveAdminAuth.mockResolvedValue({ _body: { error: 'Unauthorized' }, _status: 401 });
    const res = await PATCH(makeReq({ title: 'New' }), PARAMS);
    expect(unwrap(res).status).toBe(401);
  });

  it('returns 400 for invalid JSON', async () => {
    const res = await PATCH(makeInvalidJsonReq(), PARAMS);
    expect(unwrap(res).status).toBe(400);
  });

  it('returns 404 when the superlative does not exist', async () => {
    prisma.superlative.findUnique.mockResolvedValue(null);
    const res = await PATCH(makeReq({ title: 'New' }), PARAMS);
    expect(unwrap(res).status).toBe(404);
  });

  it('returns 400 for an invalid status', async () => {
    prisma.superlative.findUnique.mockResolvedValue(ACTIVE);
    const res = await PATCH(makeReq({ status: 'nonsense' }), PARAMS);
    expect(unwrap(res).status).toBe(400);
  });

  it('approving a suggestion (suggested -> active) stamps createdById with the approving admin', async () => {
    prisma.superlative.findUnique.mockResolvedValue(SUGGESTED);
    prisma.superlative.update.mockResolvedValue({ ...SUGGESTED, status: 'active' });
    const res = await PATCH(makeReq({ status: 'active' }), PARAMS);
    expect(unwrap(res).status).toBe(200);
    expect(prisma.superlative.update).toHaveBeenCalledWith({
      where: { id: 'sup-1' },
      data: expect.objectContaining({ status: 'active', createdById: 'AdminUser' }),
    });
  });

  it('editing an already-active item does not overwrite createdById', async () => {
    prisma.superlative.findUnique.mockResolvedValue(ACTIVE);
    prisma.superlative.update.mockResolvedValue({ ...ACTIVE, title: 'Renamed' });
    await PATCH(makeReq({ title: 'Renamed' }), { params: { id: 'sup-2' } });
    const call = prisma.superlative.update.mock.calls[0][0];
    expect(call.data.createdById).toBeUndefined();
  });

  it('accepts an integer displayOrder and nulls out a non-integer one', async () => {
    prisma.superlative.findUnique.mockResolvedValue(ACTIVE);
    prisma.superlative.update.mockResolvedValue({ ...ACTIVE });
    await PATCH(makeReq({ displayOrder: 'first' }), { params: { id: 'sup-2' } });
    expect(prisma.superlative.update).toHaveBeenCalledWith({
      where: { id: 'sup-2' },
      data: expect.objectContaining({ displayOrder: null }),
    });
  });

  it('returns 500 on a database error', async () => {
    prisma.superlative.findUnique.mockResolvedValue(ACTIVE);
    prisma.superlative.update.mockRejectedValue(new Error('db down'));
    const res = await PATCH(makeReq({ title: 'x' }), { params: { id: 'sup-2' } });
    expect(unwrap(res).status).toBe(500);
  });
});

describe('DELETE /api/admin/superlatives/[id]', () => {
  const PARAMS = { params: { id: 'sup-1' } };

  it('returns 401 when not authorized', async () => {
    resolveAdminAuth.mockResolvedValue({ _body: { error: 'Unauthorized' }, _status: 401 });
    const res = await DELETE(makeReq({}), PARAMS);
    expect(unwrap(res).status).toBe(401);
  });

  it('deletes the superlative and returns ok', async () => {
    prisma.superlative.delete.mockResolvedValue(ACTIVE);
    const res = await DELETE(makeReq({}), PARAMS);
    expect(unwrap(res).status).toBe(200);
    expect(unwrap(res).body).toEqual({ ok: true });
  });

  it('returns 500 on a database error', async () => {
    prisma.superlative.delete.mockRejectedValue(new Error('db down'));
    const res = await DELETE(makeReq({}), PARAMS);
    expect(unwrap(res).status).toBe(500);
  });
});
