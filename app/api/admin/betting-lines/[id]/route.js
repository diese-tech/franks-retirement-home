import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { resolveAdminAuth } from '@/lib/resolveAuth';

const VALID_STATUSES = ['open', 'locked', 'settled', 'void'];

// PATCH /api/admin/betting-lines/[id]  — update odds, lock, settle, or void
export async function PATCH(request, { params }) {
  const guard = await resolveAdminAuth(request);
  if (guard) return guard;

  const { id } = params;

  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const existing = await prisma.bettingLine.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: 'Line not found' }, { status: 404 });
  }

  const data = {};
  if (body.teamAOdds !== undefined) {
    if (!Number.isInteger(body.teamAOdds)) return NextResponse.json({ error: 'teamAOdds must be an integer' }, { status: 400 });
    data.teamAOdds = body.teamAOdds;
  }
  if (body.teamBOdds !== undefined) {
    if (!Number.isInteger(body.teamBOdds)) return NextResponse.json({ error: 'teamBOdds must be an integer' }, { status: 400 });
    data.teamBOdds = body.teamBOdds;
  }
  if (body.closesAt !== undefined) data.closesAt = body.closesAt ? new Date(body.closesAt) : null;
  if (body.status !== undefined) {
    if (!VALID_STATUSES.includes(body.status)) {
      return NextResponse.json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` }, { status: 400 });
    }
    // settled/void are terminal: bets have been paid out or refunded, so
    // reopening would allow a second resolution round (double payout).
    if (['settled', 'void'].includes(existing.status) && body.status !== existing.status) {
      return NextResponse.json({ error: `Line is ${existing.status} and cannot change status` }, { status: 409 });
    }
    data.status = body.status;
    if (body.status === 'settled') data.settledAt = new Date();
  }

  // Settling requires a winner and resolves every pending bet; voiding
  // refunds every pending stake. Both must happen exactly once — the
  // status guard on the line update makes double-settle a no-op 409.
  if (data.status === 'settled') {
    const { winningTeamId } = body;
    if (winningTeamId !== existing.teamAId && winningTeamId !== existing.teamBId) {
      return NextResponse.json({ error: 'winningTeamId must be one of the two teams on this line' }, { status: 400 });
    }
    data.winningTeamId = winningTeamId;
  }

  try {
    if (data.status === 'settled' || data.status === 'void') {
      const line = await prisma.$transaction(async (tx) => {
        const claimed = await tx.bettingLine.updateMany({
          where: { id, status: { in: ['open', 'locked'] } },
          data,
        });
        if (claimed.count === 0) {
          throw Object.assign(new Error('Line is already settled or void'), { httpStatus: 409 });
        }

        const pendingBets = await tx.bet.findMany({ where: { lineId: id, status: 'pending' } });
        for (const bet of pendingBets) {
          if (data.status === 'void') {
            await tx.bet.update({ where: { id: bet.id }, data: { status: 'void' } });
            await creditWallet(tx, bet.walletId, bet.stake, 'bet_refund', `Refund — line ${id} voided`);
          } else if (bet.selectedTeamId === data.winningTeamId) {
            await tx.bet.update({ where: { id: bet.id }, data: { status: 'won' } });
            await creditWallet(tx, bet.walletId, bet.potentialPayout, 'bet_payout', `Payout — won bet on line ${id}`);
          } else {
            await tx.bet.update({ where: { id: bet.id }, data: { status: 'lost' } });
          }
        }

        return tx.bettingLine.findUnique({ where: { id } });
      });
      return NextResponse.json(line);
    }

    const line = await prisma.bettingLine.update({ where: { id }, data });
    return NextResponse.json(line);
  } catch (err) {
    const status = err?.httpStatus ?? 500;
    if (status === 500) console.error('[admin/betting-lines PATCH]', err);
    return NextResponse.json({ error: status === 500 ? 'Failed to update line' : err.message }, { status });
  }
}

// Credits a wallet atomically and records the ledger row with the
// post-credit balance read inside the same transaction.
async function creditWallet(tx, walletId, amount, type, reason) {
  await tx.wallet.update({
    where: { id: walletId },
    data: { balance: { increment: amount } },
  });
  const { balance } = await tx.wallet.findUnique({ where: { id: walletId }, select: { balance: true } });
  await tx.walletTransaction.create({
    data: { walletId, type, amount, balanceAfter: balance, reason },
  });
}

// DELETE /api/admin/betting-lines/[id]  — only when no bets placed
export async function DELETE(request, { params }) {
  const guard = await resolveAdminAuth(request);
  if (guard) return guard;

  try {
    const betCount = await prisma.bet.count({ where: { lineId: params.id } });
    if (betCount > 0) {
      return NextResponse.json(
        { error: 'Cannot delete a line with bets placed. Void it instead.' },
        { status: 409 },
      );
    }
    await prisma.bettingLine.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[admin/betting-lines DELETE]', err);
    return NextResponse.json({ error: 'Failed to delete line' }, { status: 500 });
  }
}
