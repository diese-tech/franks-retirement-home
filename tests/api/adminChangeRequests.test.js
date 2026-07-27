/**
 * API tests for /api/admin/change-requests (list) and
 * /api/admin/change-requests/[id] (approve/reject).
 *
 * Approval applies the requested roster change and marks the request
 * approved in one transaction; rejection requires a reason. logAudit is
 * fire-and-forget (lib/auditLog.js) so it's mocked rather than exercised.
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

vi.mock('@/lib/auditLog', () => ({
  logAudit: vi.fn(),
}));

vi.mock('@/lib/db', () => {
  const tx = {
    player: { findUnique: vi.fn() },
    teamMember: { create: vi.fn(), deleteMany: vi.fn() },
    changeRequest: { update: vi.fn() },
  };
  const prisma = {
    changeRequest: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    $transaction: vi.fn((fn) => fn(tx)),
    _tx: tx,
  };
  return { default: prisma };
});

const { default: prisma } = await import('@/lib/db');
const { resolveAdminAuth } = await import('@/lib/resolveAuth');
const { getDiscordSessionUser } = await import('@/lib/discordAuth');
const { logAudit } = await import('@/lib/auditLog');
const { GET } = await import('@/app/api/admin/change-requests/route.js');
const { PATCH } = await import('@/app/api/admin/change-requests/[id]/route.js');

const tx = prisma._tx;

function reqWithUrl(url) {
  return { url };
}

const PENDING_ADD = {
  id: 'cr-1',
  type: 'ROSTER_ADD',
  status: 'pending',
  teamId: 'team-1',
  payload: { playerId: 'player-1', role: 'sub' },
};
const PENDING_REMOVE = {
  id: 'cr-2',
  type: 'ROSTER_REMOVE',
  status: 'pending',
  teamId: 'team-1',
  payload: { playerId: 'player-1' },
};

beforeEach(() => {
  vi.clearAllMocks();
  resolveAdminAuth.mockResolvedValue(null);
  getDiscordSessionUser.mockReturnValue({ username: 'AdminUser', discordId: 'discord-admin' });
  prisma.$transaction.mockImplementation((fn) => fn(tx));
});

describe('GET /api/admin/change-requests', () => {
  it('returns 401 when not authorized', async () => {
    resolveAdminAuth.mockResolvedValue({ _body: { error: 'Unauthorized' }, _status: 401 });
    const res = await GET(reqWithUrl('http://localhost/api/admin/change-requests'));
    expect(unwrap(res).status).toBe(401);
  });

  it('defaults to pending requests only', async () => {
    prisma.changeRequest.findMany.mockResolvedValue([]);
    await GET(reqWithUrl('http://localhost/api/admin/change-requests'));
    expect(prisma.changeRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'pending' } })
    );
  });

  it('returns every request when status=all', async () => {
    prisma.changeRequest.findMany.mockResolvedValue([]);
    await GET(reqWithUrl('http://localhost/api/admin/change-requests?status=all'));
    expect(prisma.changeRequest.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
  });

  it('returns 503 when the query fails (e.g. missing migrations)', async () => {
    prisma.changeRequest.findMany.mockRejectedValue(new Error('table does not exist'));
    const res = await GET(reqWithUrl('http://localhost/api/admin/change-requests'));
    expect(unwrap(res).status).toBe(503);
  });
});

describe('PATCH /api/admin/change-requests/[id]', () => {
  const PARAMS = { params: { id: 'cr-1' } };

  it('returns 401 when not authorized', async () => {
    resolveAdminAuth.mockResolvedValue({ _body: { error: 'Unauthorized' }, _status: 401 });
    const res = await PATCH(makeReq({ action: 'approve' }), PARAMS);
    expect(unwrap(res).status).toBe(401);
  });

  it('returns 400 for invalid JSON', async () => {
    const res = await PATCH(makeInvalidJsonReq(), PARAMS);
    expect(unwrap(res).status).toBe(400);
  });

  it('returns 400 for an action that is not approve or reject', async () => {
    const res = await PATCH(makeReq({ action: 'ignore' }), PARAMS);
    expect(unwrap(res).status).toBe(400);
  });

  it('returns 404 when the change request does not exist', async () => {
    prisma.changeRequest.findUnique.mockResolvedValue(null);
    const res = await PATCH(makeReq({ action: 'approve' }), PARAMS);
    expect(unwrap(res).status).toBe(404);
  });

  it('returns 400 when the request is no longer pending', async () => {
    prisma.changeRequest.findUnique.mockResolvedValue({ ...PENDING_ADD, status: 'approved' });
    const res = await PATCH(makeReq({ action: 'approve' }), PARAMS);
    expect(unwrap(res).status).toBe(400);
    expect(unwrap(res).body.error).toMatch(/no longer pending/i);
  });

  it('approves a ROSTER_ADD request by creating the team member and marking it approved', async () => {
    prisma.changeRequest.findUnique
      .mockResolvedValueOnce(PENDING_ADD) // pre-transaction lookup
      .mockResolvedValueOnce({ ...PENDING_ADD, status: 'approved' }); // post-transaction re-read
    tx.player.findUnique.mockResolvedValue({ id: 'player-1', role: 'starter' });

    const res = await PATCH(makeReq({ action: 'approve' }), PARAMS);
    expect(unwrap(res).status).toBe(200);
    expect(unwrap(res).body.status).toBe('approved');

    expect(tx.teamMember.create).toHaveBeenCalledWith({
      data: { teamId: 'team-1', playerId: 'player-1', role: 'sub' },
    });
    expect(tx.changeRequest.update).toHaveBeenCalledWith({
      where: { id: 'cr-1' },
      data: expect.objectContaining({ status: 'approved', reviewedByName: 'AdminUser' }),
    });
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'change_request_approved', entityId: 'cr-1' })
    );
  });

  it('returns 400 when the ROSTER_ADD player no longer exists', async () => {
    prisma.changeRequest.findUnique.mockResolvedValue(PENDING_ADD);
    tx.player.findUnique.mockResolvedValue(null);
    const res = await PATCH(makeReq({ action: 'approve' }), PARAMS);
    expect(unwrap(res).status).toBe(400);
    expect(unwrap(res).body.error).toMatch(/player not found/i);
    expect(logAudit).not.toHaveBeenCalled();
  });

  it('approves a ROSTER_REMOVE request by removing the team member', async () => {
    prisma.changeRequest.findUnique
      .mockResolvedValueOnce(PENDING_REMOVE)
      .mockResolvedValueOnce({ ...PENDING_REMOVE, status: 'approved' });

    const res = await PATCH(makeReq({ action: 'approve' }), { params: { id: 'cr-2' } });
    expect(unwrap(res).status).toBe(200);
    expect(tx.teamMember.deleteMany).toHaveBeenCalledWith({
      where: { teamId: 'team-1', playerId: 'player-1' },
    });
  });

  it('returns 400 when reject is requested without a reviewNote', async () => {
    prisma.changeRequest.findUnique.mockResolvedValue(PENDING_ADD);
    const res = await PATCH(makeReq({ action: 'reject' }), PARAMS);
    expect(unwrap(res).status).toBe(400);
    expect(unwrap(res).body.error).toMatch(/reason is required/i);
  });

  it('rejects a request with a reviewNote and logs the audit entry', async () => {
    prisma.changeRequest.findUnique
      .mockResolvedValueOnce(PENDING_ADD)
      .mockResolvedValueOnce({ ...PENDING_ADD, status: 'rejected', reviewNote: 'Not needed' });
    prisma.changeRequest.update.mockResolvedValue({});

    const res = await PATCH(makeReq({ action: 'reject', reviewNote: 'Not needed' }), PARAMS);
    expect(unwrap(res).status).toBe(200);
    expect(prisma.changeRequest.update).toHaveBeenCalledWith({
      where: { id: 'cr-1' },
      data: expect.objectContaining({ status: 'rejected', reviewNote: 'Not needed' }),
    });
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'change_request_rejected' })
    );
  });
});
