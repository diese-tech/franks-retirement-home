import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getDiscordSessionUser } from '@/lib/discordAuth';

const STARTER_GRANT = 1500;
const MIN_STAKE = 10;

/**
 * Computes total return (stake + profit) from American odds.
 * +150 → profit = stake * 1.5 ; -150 → profit = stake * (100/150)
 */
function computePayout(stake, odds) {
  const profit = odds >= 0
    ? stake * (odds / 100)
    : stake * (100 / Math.abs(odds));
  return Math.round(stake + profit);
}

// POST /api/bets  — place a bet. Opens the wallet (with a starter grant) on the
// first bet. No real money — FRH fantasy points only.
// Body: { lineId, selectedTeamId, stake }
export async function POST(request) {
  const session = getDiscordSessionUser(request);
  if (!session) {
    return NextResponse.json(
      { error: 'Are you an editor? Hmm, didn’t think so... log in to place a bet.' },
      { status: 401 },
    );
  }

  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { lineId, selectedTeamId, stake } = body;
  if (!lineId || !selectedTeamId) {
    return NextResponse.json({ error: 'lineId and selectedTeamId are required' }, { status: 400 });
  }
  if (!Number.isInteger(stake) || stake < MIN_STAKE) {
    return NextResponse.json({ error: `stake must be a whole number of at least ${MIN_STAKE} points` }, { status: 400 });
  }

  const line = await prisma.bettingLine.findUnique({ where: { id: lineId } });
  if (!line) {
    return NextResponse.json({ error: 'Line not found' }, { status: 404 });
  }
  if (line.status !== 'open') {
    return NextResponse.json({ error: 'This line is closed for betting' }, { status: 409 });
  }
  if (line.closesAt && new Date(line.closesAt) < new Date()) {
    return NextResponse.json({ error: 'This line has closed' }, { status: 409 });
  }
  if (selectedTeamId !== line.teamAId && selectedTeamId !== line.teamBId) {
    return NextResponse.json({ error: 'selectedTeam must be one of the two teams on this line' }, { status: 400 });
  }

  const odds = selectedTeamId === line.teamAId ? line.teamAOdds : line.teamBOdds;
  const potentialPayout = computePayout(stake, odds);

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Ensure a User row exists for this Discord identity.
      const user = await tx.user.upsert({
        where: { discordId: session.discordId },
        update: { username: session.username },
        create: { discordId: session.discordId, username: session.username },
      });

      // 2. Ensure a wallet exists; open it with a starter grant on first contact.
      let wallet = await tx.wallet.findUnique({ where: { userId: user.id } });
      if (!wallet) {
        wallet = await tx.wallet.create({
          data: { userId: user.id, balance: STARTER_GRANT, status: 'active', openedAt: new Date() },
        });
        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            type: 'starter_grant',
            amount: STARTER_GRANT,
            balanceAfter: STARTER_GRANT,
            reason: 'Welcome to Knows Ball — starter points',
          },
        });
      } else if (wallet.status === 'unopened') {
        wallet = await tx.wallet.update({
          where: { id: wallet.id },
          data: { balance: wallet.balance + STARTER_GRANT, status: 'active', openedAt: new Date() },
        });
        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            type: 'starter_grant',
            amount: STARTER_GRANT,
            balanceAfter: wallet.balance,
            reason: 'Welcome to Knows Ball — starter points',
          },
        });
      }

      if (wallet.status === 'suspended') {
        throw Object.assign(new Error('Wallet suspended'), { httpStatus: 403 });
      }
      if (wallet.balance < stake) {
        throw Object.assign(new Error('Insufficient points'), { httpStatus: 409 });
      }

      // 3. Deduct stake and record the ledger entry.
      const newBalance = wallet.balance - stake;
      await tx.wallet.update({ where: { id: wallet.id }, data: { balance: newBalance } });
      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'bet_stake',
          amount: -stake,
          balanceAfter: newBalance,
          reason: `Bet on line ${lineId}`,
        },
      });

      // 4. Create the bet.
      const bet = await tx.bet.create({
        data: { walletId: wallet.id, lineId, selectedTeamId, stake, potentialPayout, status: 'pending' },
      });

      return { balance: newBalance, bet };
    });

    return NextResponse.json(
      { ok: true, balance: result.balance, bet: JSON.parse(JSON.stringify(result.bet)) },
      { status: 201 },
    );
  } catch (err) {
    const status = err?.httpStatus ?? 500;
    if (status === 500) console.error('[bets POST]', err);
    return NextResponse.json({ error: err.message || 'Failed to place bet' }, { status });
  }
}
