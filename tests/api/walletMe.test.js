/**
 * API tests for GET /api/wallet/me — returns the caller's wallet summary
 * (or unopened state). Never creates a wallet; that happens lazily on the
 * first bet (see tests/api/bets.test.js).
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
    user: { findUnique: vi.fn() },
  };
  return { default: prisma };
});

// ─── Mock @/lib/discordAuth ──────────────────────────────────────────────────
vi.mock('@/lib/discordAuth', () => ({
  getDiscordSessionUser: vi.fn(),
}));

const { default: prisma } = await import('@/lib/db');
const { getDiscordSessionUser } = await import('@/lib/discordAuth');
const { GET } = await import('@/app/api/wallet/me/route.js');

const SESSION = { discordId: 'discord-1', username: 'Bettor', roles: [] };
const REQ = {};

beforeEach(() => {
  vi.clearAllMocks();
  getDiscordSessionUser.mockReturnValue(SESSION);
});

describe('GET /api/wallet/me', () => {
  it('returns 401 when not authenticated', async () => {
    getDiscordSessionUser.mockReturnValue(null);
    const res = await GET(REQ);
    expect(unwrap(res).status).toBe(401);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('returns unopened status with an empty bet list when the user has no wallet', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1', wallet: null });
    const res = await GET(REQ);
    const { status, body } = unwrap(res);
    expect(status).toBe(200);
    expect(body).toEqual({ status: 'unopened', balance: 0, bets: [] });
  });

  it('returns unopened status when there is no User row at all', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    const { status, body } = unwrap(await GET(REQ));
    expect(status).toBe(200);
    expect(body).toEqual({ status: 'unopened', balance: 0, bets: [] });
  });

  it('returns the wallet balance and recent bets when a wallet exists', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      wallet: {
        status: 'active',
        balance: 400,
        bets: [
          {
            id: 'bet-1',
            stake: 100,
            line: { match: { division: { name: 'Hospice' } } },
            selectedTeam: { id: 'team-a', name: 'Team A', tag: 'TA' },
          },
        ],
      },
    });
    const { status, body } = unwrap(await GET(REQ));
    expect(status).toBe(200);
    expect(body.status).toBe('active');
    expect(body.balance).toBe(400);
    expect(body.bets).toHaveLength(1);
    expect(body.bets[0].selectedTeam.tag).toBe('TA');
  });

  it('queries by discordId, ordering bets newest-first and capping at 20', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1', wallet: null });
    await GET(REQ);
    expect(prisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { discordId: 'discord-1' },
        include: expect.objectContaining({
          wallet: expect.objectContaining({
            include: expect.objectContaining({
              bets: expect.objectContaining({ orderBy: { createdAt: 'desc' }, take: 20 }),
            }),
          }),
        }),
      }),
    );
  });

  it('returns 500 when the database query fails (and reports it via Sentry)', async () => {
    prisma.user.findUnique.mockRejectedValue(new Error('db exploded'));
    const res = await GET(REQ);
    expect(unwrap(res).status).toBe(500);
    expect(unwrap(res).body.error).toMatch(/Failed to load wallet/i);
  });
});
