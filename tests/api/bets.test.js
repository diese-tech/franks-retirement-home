/**
 * API tests for POST /api/bets — stake deduction integrity.
 *
 * The critical behavior under test: the stake is deducted with a conditional
 * atomic updateMany (WHERE balance >= stake), not a read-compute-write, so a
 * stale balance read cannot overdraw the wallet.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeReq, unwrap } from './_helpers.js';

// ─── Mock next/server ────────────────────────────────────────────────────────
vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((body, init) => ({ _body: body, _status: init?.status ?? 200 })),
  },
}));

// ─── Mock @/lib/db ───────────────────────────────────────────────────────────
vi.mock('@/lib/db', () => {
  const tx = {
    $queryRaw: vi.fn(),
    user: { upsert: vi.fn() },
    wallet: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    walletTransaction: { create: vi.fn() },
    bet: { create: vi.fn() },
  };
  const prisma = {
    $transaction: vi.fn((fn) => fn(tx)),
    _tx: tx,
  };
  return { default: prisma };
});

// ─── Mock @/lib/discordAuth ──────────────────────────────────────────────────
vi.mock('@/lib/discordAuth', () => ({
  getDiscordSessionUser: vi.fn(),
}));

// ─── Mock @/lib/rateLimit ────────────────────────────────────────────────────
vi.mock('@/lib/rateLimit', () => ({
  checkRateLimit: vi.fn(),
}));

const { default: prisma } = await import('@/lib/db');
const { getDiscordSessionUser } = await import('@/lib/discordAuth');
const { checkRateLimit } = await import('@/lib/rateLimit');
const { POST } = await import('@/app/api/bets/route.js');

const tx = prisma._tx;

const SESSION = { discordId: 'discord-1', username: 'Bettor', roles: [] };
// Shape returned by the raw `SELECT ... FOR UPDATE` in the route, not the
// Prisma model shape — no `id`, matching the column list in the query.
const LINE_ROW = {
  status: 'open',
  closesAt: null,
  teamAId: 'team-a',
  teamAOdds: 150,
  teamBId: 'team-b',
  teamBOdds: -150,
};
const VALID_BODY = { lineId: 'line-1', selectedTeamId: 'team-a', stake: 100 };
const WALLET = { id: 'wallet-1', userId: 'user-1', balance: 500, status: 'active' };

beforeEach(() => {
  vi.clearAllMocks();
  getDiscordSessionUser.mockReturnValue(SESSION);
  checkRateLimit.mockResolvedValue({ allowed: true });
  tx.$queryRaw.mockResolvedValue([LINE_ROW]);
  prisma.$transaction.mockImplementation((fn) => fn(tx));
  tx.user.upsert.mockResolvedValue({ id: 'user-1' });
  tx.wallet.findUnique
    .mockResolvedValueOnce(WALLET) // initial lookup
    .mockResolvedValueOnce({ balance: 400 }); // post-decrement re-read
  tx.wallet.updateMany.mockResolvedValue({ count: 1 });
  tx.bet.create.mockResolvedValue({ id: 'bet-1', stake: 100, potentialPayout: 250, status: 'pending' });
});

describe('POST /api/bets', () => {
  it('rejects unauthenticated requests with 401', async () => {
    getDiscordSessionUser.mockReturnValue(null);
    const { status } = unwrap(await POST(makeReq(VALID_BODY)));
    expect(status).toBe(401);
  });

  it('returns 429 when rate limited', async () => {
    checkRateLimit.mockResolvedValue({ allowed: false });
    const { status } = unwrap(await POST(makeReq(VALID_BODY)));
    expect(status).toBe(429);
    expect(checkRateLimit).toHaveBeenCalledWith('bets:discord-1', 10, 60);
  });

  it('deducts the stake via conditional atomic updateMany, not an absolute write', async () => {
    const { status, body } = unwrap(await POST(makeReq(VALID_BODY)));
    expect(status).toBe(201);
    expect(tx.wallet.updateMany).toHaveBeenCalledWith({
      where: { id: 'wallet-1', status: 'active', balance: { gte: 100 } },
      data: { balance: { decrement: 100 } },
    });
    // wallet.update must NOT be used to write an absolute balance for the stake
    expect(tx.wallet.update).not.toHaveBeenCalled();
    expect(body.balance).toBe(400);
  });

  it('records the ledger row with the post-decrement balance', async () => {
    await POST(makeReq(VALID_BODY));
    expect(tx.walletTransaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: 'bet_stake', amount: -100, balanceAfter: 400 }),
    });
  });

  it('returns 409 when the conditional decrement matches no rows (insufficient balance)', async () => {
    tx.wallet.updateMany.mockResolvedValue({ count: 0 });
    const { status, body } = unwrap(await POST(makeReq(VALID_BODY)));
    expect(status).toBe(409);
    expect(body.error).toMatch(/insufficient/i);
    expect(tx.bet.create).not.toHaveBeenCalled();
    expect(tx.walletTransaction.create).not.toHaveBeenCalled();
  });

  it('returns 403 for a suspended wallet without attempting a deduction', async () => {
    tx.wallet.findUnique.mockReset();
    tx.wallet.findUnique.mockResolvedValue({ ...WALLET, status: 'suspended' });
    const { status } = unwrap(await POST(makeReq(VALID_BODY)));
    expect(status).toBe(403);
    expect(tx.wallet.updateMany).not.toHaveBeenCalled();
  });

  it('rejects non-integer and below-minimum stakes', async () => {
    expect(unwrap(await POST(makeReq({ ...VALID_BODY, stake: 10.5 }))).status).toBe(400);
    expect(unwrap(await POST(makeReq({ ...VALID_BODY, stake: 5 }))).status).toBe(400);
  });

  it('rejects bets on closed lines with 409', async () => {
    tx.$queryRaw.mockResolvedValue([{ ...LINE_ROW, status: 'locked' }]);
    expect(unwrap(await POST(makeReq(VALID_BODY))).status).toBe(409);
  });

  it('returns 404 when the line row is not found under lock', async () => {
    tx.$queryRaw.mockResolvedValue([]);
    const { status } = unwrap(await POST(makeReq(VALID_BODY)));
    expect(status).toBe(404);
  });

  it('locks the line row for update before any wallet mutation (settlement race guard)', async () => {
    await POST(makeReq(VALID_BODY));
    expect(tx.$queryRaw).toHaveBeenCalled();
    // The lock must be acquired before the wallet is touched, so a
    // concurrent settlement transaction either fully precedes or fully
    // follows this one rather than interleaving.
    const lockOrder = tx.$queryRaw.mock.invocationCallOrder[0];
    const walletOrder = tx.wallet.findUnique.mock.invocationCallOrder[0];
    expect(lockOrder).toBeLessThan(walletOrder);
  });

  it('rejects a bet on a line settled since the caller last read it', async () => {
    tx.$queryRaw.mockResolvedValue([{ ...LINE_ROW, status: 'settled' }]);
    const { status } = unwrap(await POST(makeReq(VALID_BODY)));
    expect(status).toBe(409);
    expect(tx.wallet.updateMany).not.toHaveBeenCalled();
    expect(tx.bet.create).not.toHaveBeenCalled();
  });
});
