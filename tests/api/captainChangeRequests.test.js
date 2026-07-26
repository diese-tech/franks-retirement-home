/**
 * API tests for GET/POST /api/captain/change-requests
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
    changeRequest: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
    team: { findUnique: vi.fn() },
  };
  return { default: prisma };
});

// ─── Mock @/lib/discordAuth ──────────────────────────────────────────────────
vi.mock('@/lib/discordAuth', () => ({
  getDiscordSessionUser: vi.fn(),
  resolveTeamFromRoles: vi.fn(),
}));

// ─── Mock @/lib/auditLog ─────────────────────────────────────────────────────
vi.mock('@/lib/auditLog', () => ({
  logAudit: vi.fn(),
}));

// ─── Mock @/lib/discordWebhook ───────────────────────────────────────────────
vi.mock('@/lib/discordWebhook', () => ({
  notifyChangeRequest: vi.fn(() => Promise.resolve()),
}));

// ─── Mock @/lib/rateLimit ────────────────────────────────────────────────────
vi.mock('@/lib/rateLimit', () => ({
  checkRateLimit: vi.fn(),
}));

const { default: prisma } = await import('@/lib/db');
const { getDiscordSessionUser, resolveTeamFromRoles } = await import('@/lib/discordAuth');
const { notifyChangeRequest } = await import('@/lib/discordWebhook');
const { checkRateLimit } = await import('@/lib/rateLimit');
const { GET, POST } = await import('@/app/api/captain/change-requests/route.js');

const SESSION = { discordId: 'user-1', username: 'CaptainAmerica', roles: ['captain-role'] };
const TEAM_ID = 'team-abc';

beforeEach(() => {
  vi.clearAllMocks();
  getDiscordSessionUser.mockReturnValue(SESSION);
  resolveTeamFromRoles.mockReturnValue(TEAM_ID);
  checkRateLimit.mockResolvedValue({ allowed: true });
  notifyChangeRequest.mockResolvedValue();
});

// ─── GET ─────────────────────────────────────────────────────────────────────
describe('GET /api/captain/change-requests', () => {
  it('returns 401 when not authenticated', async () => {
    getDiscordSessionUser.mockReturnValue(null);
    const res = await GET(makeReq({}));
    expect(unwrap(res).status).toBe(401);
  });

  it('returns 403 when no team is found for the account', async () => {
    resolveTeamFromRoles.mockReturnValue(null);
    const res = await GET(makeReq({}));
    expect(unwrap(res).status).toBe(403);
  });

  it('returns the team change requests', async () => {
    const requests = [{ id: 'cr-1', teamId: TEAM_ID }];
    prisma.changeRequest.findMany.mockResolvedValue(requests);
    const res = await GET(makeReq({}));
    expect(unwrap(res).status).toBe(200);
    expect(unwrap(res).body).toEqual(requests);
    expect(prisma.changeRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { teamId: TEAM_ID } })
    );
  });

  it('returns 503 when the DB call fails (migrations not run)', async () => {
    prisma.changeRequest.findMany.mockRejectedValue(new Error('relation does not exist'));
    const res = await GET(makeReq({}));
    expect(unwrap(res).status).toBe(503);
  });
});

// ─── POST ────────────────────────────────────────────────────────────────────
describe('POST /api/captain/change-requests', () => {
  it('returns 401 when not authenticated', async () => {
    getDiscordSessionUser.mockReturnValue(null);
    const res = await POST(makeReq({}));
    expect(unwrap(res).status).toBe(401);
  });

  it('returns 403 when no team is found for the account', async () => {
    resolveTeamFromRoles.mockReturnValue(null);
    const res = await POST(makeReq({}));
    expect(unwrap(res).status).toBe(403);
  });

  it('returns 429 when rate limited', async () => {
    checkRateLimit.mockResolvedValue({ allowed: false });
    const res = await POST(makeReq({ type: 'ROSTER_ADD', playerId: 'p1', playerName: 'Zeus' }));
    expect(unwrap(res).status).toBe(429);
  });

  it('returns 400 for invalid JSON', async () => {
    const res = await POST(makeInvalidJsonReq());
    expect(unwrap(res).status).toBe(400);
  });

  it('returns 400 when type is invalid', async () => {
    const res = await POST(makeReq({ type: 'BOGUS', playerId: 'p1', playerName: 'Zeus' }));
    expect(unwrap(res).status).toBe(400);
    expect(unwrap(res).body.error).toMatch(/ROSTER_ADD/);
  });

  it('returns 400 when playerId or playerName is missing', async () => {
    const res = await POST(makeReq({ type: 'ROSTER_ADD', playerId: 'p1' }));
    expect(unwrap(res).status).toBe(400);
  });

  it('returns 409 when a pending request already exists for this player', async () => {
    prisma.changeRequest.findFirst.mockResolvedValue({ id: 'existing' });
    const res = await POST(makeReq({ type: 'ROSTER_ADD', playerId: 'p1', playerName: 'Zeus' }));
    expect(unwrap(res).status).toBe(409);
  });

  it('returns 503 when the DB call fails (migrations not run)', async () => {
    prisma.changeRequest.findFirst.mockRejectedValue(new Error('relation does not exist'));
    const res = await POST(makeReq({ type: 'ROSTER_ADD', playerId: 'p1', playerName: 'Zeus' }));
    expect(unwrap(res).status).toBe(503);
  });

  it('creates the change request, logs audit, and notifies discord on success', async () => {
    prisma.changeRequest.findFirst.mockResolvedValue(null);
    prisma.team.findUnique.mockResolvedValue({ name: 'Team Foo', tag: 'FOO' });
    const created = { id: 'cr-new', type: 'ROSTER_ADD', teamId: TEAM_ID };
    prisma.changeRequest.create.mockResolvedValue(created);

    const res = await POST(makeReq({ type: 'ROSTER_ADD', playerId: 'p1', playerName: 'Zeus', role: 'Mid', reason: 'trade' }));
    expect(unwrap(res).status).toBe(201);
    expect(unwrap(res).body).toEqual(created);
    expect(notifyChangeRequest).toHaveBeenCalled();
  });
});
