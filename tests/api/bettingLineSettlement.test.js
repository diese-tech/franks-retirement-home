/**
 * API tests for PATCH /api/admin/betting-lines/[id] — settlement & void.
 *
 * Settlement must resolve every pending bet exactly once: winners credited
 * potentialPayout, losers marked lost, voided lines refunding stakes. The
 * status guard on the line update makes double-settlement a 409 no-op.
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
    bettingLine: { updateMany: vi.fn(), findUnique: vi.fn() },
    bet: { findMany: vi.fn(), update: vi.fn() },
    wallet: { update: vi.fn(), findUnique: vi.fn() },
    walletTransaction: { create: vi.fn() },
  };
  const prisma = {
    bettingLine: { findUnique: vi.fn(), update: vi.fn() },
    bet: { count: vi.fn() },
    $transaction: vi.fn((fn) => fn(tx)),
    _tx: tx,
  };
  return { default: prisma };
});

// ─── Mock @/lib/resolveAuth ──────────────────────────────────────────────────
vi.mock('@/lib/resolveAuth', () => ({
  resolveAdminAuth: vi.fn(),
}));

const { default: prisma } = await import('@/lib/db');
const { resolveAdminAuth } = await import('@/lib/resolveAuth');
const { PATCH } = await import('@/app/api/admin/betting-lines/[id]/route.js');

const tx = prisma._tx;

const LINE = {
  id: 'line-1',
  status: 'locked',
  teamAId: 'team-a',
  teamBId: 'team-b',
  teamAOdds: 150,
  teamBOdds: -150,
};
const PARAMS = { params: { id: 'line-1' } };

const BETS = [
  { id: 'bet-won', walletId: 'w1', selectedTeamId: 'team-a', stake: 100, potentialPayout: 250, status: 'pending' },
  { id: 'bet-lost', walletId: 'w2', selectedTeamId: 'team-b', stake: 50, potentialPayout: 83, status: 'pending' },
];

beforeEach(() => {
  vi.clearAllMocks();
  resolveAdminAuth.mockResolvedValue(null);
  prisma.bettingLine.findUnique.mockResolvedValue(LINE);
  prisma.$transaction.mockImplementation((fn) => fn(tx));
  tx.bettingLine.updateMany.mockResolvedValue({ count: 1 });
  tx.bettingLine.findUnique.mockResolvedValue({ ...LINE, status: 'settled', winningTeamId: 'team-a' });
  tx.bet.findMany.mockResolvedValue(BETS);
  tx.wallet.findUnique.mockResolvedValue({ balance: 999 });
});

describe('PATCH /api/admin/betting-lines/[id] settlement', () => {
  it('requires winningTeamId to be one of the two line teams', async () => {
    const res = await PATCH(makeReq({ status: 'settled', winningTeamId: 'team-x' }), PARAMS);
    expect(unwrap(res).status).toBe(400);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('credits winners with potentialPayout and marks losers lost', async () => {
    const res = await PATCH(makeReq({ status: 'settled', winningTeamId: 'team-a' }), PARAMS);
    expect(unwrap(res).status).toBe(200);

    expect(tx.bet.update).toHaveBeenCalledWith({ where: { id: 'bet-won' }, data: { status: 'won' } });
    expect(tx.bet.update).toHaveBeenCalledWith({ where: { id: 'bet-lost' }, data: { status: 'lost' } });
    expect(tx.wallet.update).toHaveBeenCalledTimes(1);
    expect(tx.wallet.update).toHaveBeenCalledWith({
      where: { id: 'w1' },
      data: { balance: { increment: 250 } },
    });
    expect(tx.walletTransaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ walletId: 'w1', type: 'bet_payout', amount: 250 }),
    });
  });

  it('claims the line with a status guard so double-settlement returns 409', async () => {
    await PATCH(makeReq({ status: 'settled', winningTeamId: 'team-a' }), PARAMS);
    expect(tx.bettingLine.updateMany).toHaveBeenCalledWith({
      where: { id: 'line-1', status: { in: ['open', 'locked'] } },
      data: expect.objectContaining({ status: 'settled', winningTeamId: 'team-a' }),
    });

    // Concurrent second settle: the guard matches no rows.
    tx.bettingLine.updateMany.mockResolvedValue({ count: 0 });
    const res = await PATCH(makeReq({ status: 'settled', winningTeamId: 'team-a' }), PARAMS);
    expect(unwrap(res).status).toBe(409);
    expect(tx.bet.update).toHaveBeenCalledTimes(2); // only from the first call
  });

  it('rejects status changes on an already-settled line (no reopen → no double payout)', async () => {
    prisma.bettingLine.findUnique.mockResolvedValue({ ...LINE, status: 'settled' });
    const res = await PATCH(makeReq({ status: 'open' }), PARAMS);
    expect(unwrap(res).status).toBe(409);
  });

  it('voiding refunds stakes and marks bets void', async () => {
    tx.bettingLine.findUnique.mockResolvedValue({ ...LINE, status: 'void' });
    const res = await PATCH(makeReq({ status: 'void' }), PARAMS);
    expect(unwrap(res).status).toBe(200);

    expect(tx.bet.update).toHaveBeenCalledWith({ where: { id: 'bet-won' }, data: { status: 'void' } });
    expect(tx.bet.update).toHaveBeenCalledWith({ where: { id: 'bet-lost' }, data: { status: 'void' } });
    expect(tx.wallet.update).toHaveBeenCalledWith({ where: { id: 'w1' }, data: { balance: { increment: 100 } } });
    expect(tx.wallet.update).toHaveBeenCalledWith({ where: { id: 'w2' }, data: { balance: { increment: 50 } } });
    expect(tx.walletTransaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ walletId: 'w2', type: 'bet_refund', amount: 50 }),
    });
  });

  it('plain odds updates do not touch bets', async () => {
    prisma.bettingLine.update.mockResolvedValue({ ...LINE, teamAOdds: 120 });
    const res = await PATCH(makeReq({ teamAOdds: 120 }), PARAMS);
    expect(unwrap(res).status).toBe(200);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
