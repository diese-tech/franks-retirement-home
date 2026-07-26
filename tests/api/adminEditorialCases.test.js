/**
 * API tests for /api/admin/editorial-cases (list/create) and
 * /api/admin/editorial-cases/[id] (update/delete).
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
    editorialCase: {
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
const { GET, POST } = await import('@/app/api/admin/editorial-cases/route.js');
const { PATCH, DELETE } = await import('@/app/api/admin/editorial-cases/[id]/route.js');

function reqWithUrl(url) {
  return { url };
}

const VALID_BODY = { type: 'fraud_watch', title: 'Suspicious Sub' };
const EXISTING_CASE = { id: 'case-1', type: 'fraud_watch', title: 'Old', status: 'draft', publishedAt: null };

beforeEach(() => {
  vi.clearAllMocks();
  resolveAdminAuth.mockResolvedValue(null);
  getDiscordSessionUser.mockReturnValue({ username: 'AdminUser' });
});

describe('GET /api/admin/editorial-cases', () => {
  it('returns 401 when not authorized', async () => {
    resolveAdminAuth.mockResolvedValue({ _body: { error: 'Unauthorized' }, _status: 401 });
    const res = await GET(reqWithUrl('http://localhost/api/admin/editorial-cases'));
    expect(unwrap(res).status).toBe(401);
  });

  it('filters by type and status when provided', async () => {
    prisma.editorialCase.findMany.mockResolvedValue([]);
    await GET(reqWithUrl('http://localhost/api/admin/editorial-cases?type=fraud_watch&status=draft'));
    expect(prisma.editorialCase.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { type: 'fraud_watch', status: 'draft' } })
    );
  });

  it('returns 500 on a database error', async () => {
    prisma.editorialCase.findMany.mockRejectedValue(new Error('db down'));
    const res = await GET(reqWithUrl('http://localhost/api/admin/editorial-cases'));
    expect(unwrap(res).status).toBe(500);
  });
});

describe('POST /api/admin/editorial-cases', () => {
  it('returns 401 when not authorized', async () => {
    resolveAdminAuth.mockResolvedValue({ _body: { error: 'Unauthorized' }, _status: 401 });
    const res = await POST(makeReq(VALID_BODY));
    expect(unwrap(res).status).toBe(401);
  });

  it('returns 400 for invalid JSON', async () => {
    const res = await POST(makeInvalidJsonReq());
    expect(unwrap(res).status).toBe(400);
  });

  it('returns 400 for an invalid type', async () => {
    const res = await POST(makeReq({ ...VALID_BODY, type: 'not-a-type' }));
    expect(unwrap(res).status).toBe(400);
  });

  it('returns 400 when title is missing or blank', async () => {
    const res = await POST(makeReq({ ...VALID_BODY, title: '   ' }));
    expect(unwrap(res).status).toBe(400);
  });

  it('creates a draft case by default, with severity coerced to null if not an integer', async () => {
    prisma.editorialCase.create.mockResolvedValue({ id: 'case-1', status: 'draft' });
    const res = await POST(makeReq({ ...VALID_BODY, severity: 'high' }));
    expect(unwrap(res).status).toBe(201);
    expect(prisma.editorialCase.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ status: 'draft', severity: null, createdById: 'AdminUser', publishedAt: null }),
    });
  });

  it('accepts an integer severity and stamps publishedAt when status is published', async () => {
    prisma.editorialCase.create.mockResolvedValue({ id: 'case-1', status: 'published' });
    const res = await POST(makeReq({ ...VALID_BODY, severity: 3, status: 'published' }));
    expect(unwrap(res).status).toBe(201);
    expect(prisma.editorialCase.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ severity: 3, status: 'published', publishedAt: expect.any(Date) }),
    });
  });

  it('returns 500 on a database error', async () => {
    prisma.editorialCase.create.mockRejectedValue(new Error('db down'));
    const res = await POST(makeReq(VALID_BODY));
    expect(unwrap(res).status).toBe(500);
  });
});

describe('PATCH /api/admin/editorial-cases/[id]', () => {
  const PARAMS = { params: { id: 'case-1' } };

  it('returns 401 when not authorized', async () => {
    resolveAdminAuth.mockResolvedValue({ _body: { error: 'Unauthorized' }, _status: 401 });
    const res = await PATCH(makeReq({ title: 'New' }), PARAMS);
    expect(unwrap(res).status).toBe(401);
  });

  it('returns 400 for invalid JSON', async () => {
    const res = await PATCH(makeInvalidJsonReq(), PARAMS);
    expect(unwrap(res).status).toBe(400);
  });

  it('returns 404 when the case does not exist', async () => {
    prisma.editorialCase.findUnique.mockResolvedValue(null);
    const res = await PATCH(makeReq({ title: 'New' }), PARAMS);
    expect(unwrap(res).status).toBe(404);
  });

  it('returns 400 for an invalid status', async () => {
    prisma.editorialCase.findUnique.mockResolvedValue(EXISTING_CASE);
    const res = await PATCH(makeReq({ status: 'nonsense' }), PARAMS);
    expect(unwrap(res).status).toBe(400);
  });

  it('updates fields and records the updating admin', async () => {
    prisma.editorialCase.findUnique.mockResolvedValue(EXISTING_CASE);
    prisma.editorialCase.update.mockResolvedValue({ ...EXISTING_CASE, title: 'Updated' });
    const res = await PATCH(makeReq({ title: 'Updated' }), PARAMS);
    expect(unwrap(res).status).toBe(200);
    expect(prisma.editorialCase.update).toHaveBeenCalledWith({
      where: { id: 'case-1' },
      data: expect.objectContaining({ title: 'Updated', updatedById: 'AdminUser' }),
    });
  });

  it('stamps publishedAt only the first time a case is published', async () => {
    prisma.editorialCase.findUnique.mockResolvedValue(EXISTING_CASE);
    prisma.editorialCase.update.mockResolvedValue({ ...EXISTING_CASE, status: 'published' });
    await PATCH(makeReq({ status: 'published' }), PARAMS);
    expect(prisma.editorialCase.update).toHaveBeenCalledWith({
      where: { id: 'case-1' },
      data: expect.objectContaining({ status: 'published', publishedAt: expect.any(Date) }),
    });
  });

  it('returns 500 on a database error', async () => {
    prisma.editorialCase.findUnique.mockResolvedValue(EXISTING_CASE);
    prisma.editorialCase.update.mockRejectedValue(new Error('db down'));
    const res = await PATCH(makeReq({ title: 'Updated' }), PARAMS);
    expect(unwrap(res).status).toBe(500);
  });
});

describe('DELETE /api/admin/editorial-cases/[id]', () => {
  const PARAMS = { params: { id: 'case-1' } };

  it('returns 401 when not authorized', async () => {
    resolveAdminAuth.mockResolvedValue({ _body: { error: 'Unauthorized' }, _status: 401 });
    const res = await DELETE(makeReq({}), PARAMS);
    expect(unwrap(res).status).toBe(401);
  });

  it('deletes the case and returns ok', async () => {
    prisma.editorialCase.delete.mockResolvedValue(EXISTING_CASE);
    const res = await DELETE(makeReq({}), PARAMS);
    expect(unwrap(res).status).toBe(200);
    expect(unwrap(res).body).toEqual({ ok: true });
  });

  it('returns 500 on a database error', async () => {
    prisma.editorialCase.delete.mockRejectedValue(new Error('db down'));
    const res = await DELETE(makeReq({}), PARAMS);
    expect(unwrap(res).status).toBe(500);
  });
});
