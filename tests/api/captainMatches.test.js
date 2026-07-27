/**
 * API tests for GET /api/captain/matches
 *
 * Strategy: mock prisma, discordAuth, and NextResponse so no DB or Next.js
 * runtime is needed. No test file existed for this route before Workstream 1
 * wrapped its Prisma call in try/catch — covers the success path and the new
 * clean-500-instead-of-throw error path.
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
  const prisma = { match: { findMany: vi.fn() } };
  return { default: prisma };
});

// ─── Mock @/lib/discordAuth ───────────────────────────────────────────────────
vi.mock('@/lib/discordAuth', () => ({
  getDiscordSessionUser: vi.fn(),
  hasDiscordCaptainRole: vi.fn(),
  resolveTeamFromRoles: vi.fn(),
}));

const { default: prisma } = await import('@/lib/db');
const { getDiscordSessionUser, hasDiscordCaptainRole, resolveTeamFromRoles } = await import('@/lib/discordAuth');
const { GET } = await import('@/app/api/captain/matches/route.js');

function makeReq() {
  return { headers: { get: () => null } };
}

const SESSION = { discordId: 'discord-1', roles: ['captain'] };
const MATCH = { id: 'match-1', homeTeamId: 'team-1', awayTeamId: 'team-2' };

beforeEach(() => {
  vi.clearAllMocks();
  getDiscordSessionUser.mockReturnValue(SESSION);
  hasDiscordCaptainRole.mockReturnValue(true);
  resolveTeamFromRoles.mockReturnValue('team-1');
  prisma.match.findMany.mockResolvedValue([MATCH]);
});

describe('GET /api/captain/matches', () => {
  it('returns 401 when not authenticated', async () => {
    getDiscordSessionUser.mockReturnValue(null);
    const res = await GET(makeReq());
    expect(unwrap(res).status).toBe(401);
  });

  it('returns 403 when the session lacks the captain role', async () => {
    hasDiscordCaptainRole.mockReturnValue(false);
    const res = await GET(makeReq());
    expect(unwrap(res).status).toBe(403);
  });

  it('returns 403 when no team role is found', async () => {
    resolveTeamFromRoles.mockReturnValue(null);
    const res = await GET(makeReq());
    expect(unwrap(res).status).toBe(403);
  });

  it('returns the captain\'s matches annotated with captainSide', async () => {
    const res = await GET(makeReq());
    const { status, body } = unwrap(res);
    expect(status).toBe(200);
    expect(body).toEqual([{ ...MATCH, captainSide: 'home' }]);
  });

  it('returns a clean 500 instead of throwing when the DB call fails', async () => {
    prisma.match.findMany.mockRejectedValue(new Error('DB down'));
    const res = await GET(makeReq());
    const { status, body } = unwrap(res);
    expect(status).toBe(500);
    expect(body.error).toMatch(/failed to load matches/i);
  });
});
