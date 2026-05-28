import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getDiscordSessionUser } from '@/lib/discordAuth';

// GET /api/wallet/me  — returns the caller's wallet summary (or unopened state).
// Does NOT create a wallet; that happens lazily on the first bet.
export async function GET(request) {
  const session = getDiscordSessionUser(request);
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { discordId: session.discordId },
      include: {
        wallet: {
          include: {
            bets: {
              orderBy: { createdAt: 'desc' },
              take: 20,
              include: {
                line: { include: { match: { include: { division: { select: { name: true } } } } } },
                selectedTeam: { select: { id: true, name: true, tag: true } },
              },
            },
          },
        },
      },
    });

    if (!user?.wallet) {
      return NextResponse.json({ status: 'unopened', balance: 0, bets: [] });
    }

    return NextResponse.json({
      status: user.wallet.status,
      balance: user.wallet.balance,
      bets: JSON.parse(JSON.stringify(user.wallet.bets)),
    });
  } catch (err) {
    console.error('[wallet/me GET]', err);
    return NextResponse.json({ error: 'Failed to load wallet' }, { status: 500 });
  }
}
