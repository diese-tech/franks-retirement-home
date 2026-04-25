import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { resolveRole } from '@/lib/draftAuth';
import { currentBanTeam, TOTAL_BANS } from '@/lib/draftOrder';

export const dynamic = 'force-dynamic';

// POST /api/drafts/[id]/ban
// Body: { key, godId }
export async function POST(request, { params }) {
  const { id } = await params;
  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { key, godId } = body;
  if (!godId) return NextResponse.json({ error: 'godId required' }, { status: 400 });

  try {
    const draft = await prisma.draft.findUnique({ where: { id } });
    if (!draft) return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    if (draft.status !== 'banning') {
      return NextResponse.json({ error: 'Draft is not in banning phase' }, { status: 400 });
    }

    const role = resolveRole(key, draft);
    if (role === 'spectator') {
      return NextResponse.json({ error: 'Not authorized to ban' }, { status: 403 });
    }

    const bans = await prisma.draftBan.findMany({
      where: { draftId: id },
      orderBy: { banOrder: 'asc' },
    });
    const banCount = bans.length;
    if (banCount >= TOTAL_BANS) {
      return NextResponse.json({ error: 'All bans are complete' }, { status: 400 });
    }

    const expectedTeam = currentBanTeam(banCount);
    if (role === 'captainA' && expectedTeam !== 'A') {
      return NextResponse.json({ error: "It's not your turn to ban" }, { status: 403 });
    }
    if (role === 'captainB' && expectedTeam !== 'B') {
      return NextResponse.json({ error: "It's not your turn to ban" }, { status: 403 });
    }

    const god = await prisma.god.findUnique({ where: { id: godId } });
    if (!god) return NextResponse.json({ error: 'God not found' }, { status: 404 });

    const alreadyBanned = bans.some((b) => b.godId === godId);
    if (alreadyBanned) return NextResponse.json({ error: 'God already banned' }, { status: 409 });

    const newBanCount = banCount + 1;
    await prisma.$transaction([
      prisma.draftBan.create({
        data: { draftId: id, godId, team: expectedTeam, banOrder: banCount },
      }),
      prisma.draft.update({
        where: { id },
        data: {
          version: { increment: 1 },
          ...(newBanCount === TOTAL_BANS ? { status: 'picking' } : {}),
        },
      }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e.code === 'P2002') return NextResponse.json({ error: 'God already banned' }, { status: 409 });
    return NextResponse.json({ error: 'Failed to submit ban' }, { status: 500 });
  }
}
