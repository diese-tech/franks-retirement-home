import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { resolveRole } from '@/lib/draftAuth';
import { currentPickTeam, TOTAL_PICKS } from '@/lib/draftOrder';

export const dynamic = 'force-dynamic';

// POST /api/drafts/[id]/pick
// Body: { key, pickId, godId }
// Assigns a god to a player's DraftPick during the picking phase.
export async function POST(request, { params }) {
  const { id } = await params;
  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { key, pickId, godId } = body;
  if (!pickId || !godId) {
    return NextResponse.json({ error: 'pickId and godId required' }, { status: 400 });
  }

  try {
    const draft = await prisma.draft.findUnique({ where: { id } });
    if (!draft) return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    if (draft.status !== 'picking' && draft.status !== 'active') {
      return NextResponse.json({ error: 'Draft is not in picking phase' }, { status: 400 });
    }

    const role = resolveRole(key, draft);
    if (role === 'spectator') {
      return NextResponse.json({ error: 'Not authorized to pick' }, { status: 403 });
    }

    const [allPicks, bans] = await Promise.all([
      prisma.draftPick.findMany({ where: { draftId: id }, orderBy: { pickOrder: 'asc' } }),
      prisma.draftBan.findMany({ where: { draftId: id } }),
    ]);

    const completedPicks = allPicks.filter((p) => p.godId !== null).length;
    if (completedPicks >= TOTAL_PICKS) {
      return NextResponse.json({ error: 'All picks are complete' }, { status: 400 });
    }

    const expectedTeam = currentPickTeam(completedPicks);
    if (role === 'captainA' && expectedTeam !== 'A') {
      return NextResponse.json({ error: "It's not your turn to pick" }, { status: 403 });
    }
    if (role === 'captainB' && expectedTeam !== 'B') {
      return NextResponse.json({ error: "It's not your turn to pick" }, { status: 403 });
    }

    const pick = allPicks.find((p) => p.id === pickId);
    if (!pick) return NextResponse.json({ error: 'Pick not found' }, { status: 404 });
    if (pick.draftId !== id) return NextResponse.json({ error: 'Pick does not belong to this draft' }, { status: 400 });
    if (role === 'captainA' && pick.team !== 'A') {
      return NextResponse.json({ error: 'Cannot pick for the other team' }, { status: 403 });
    }
    if (role === 'captainB' && pick.team !== 'B') {
      return NextResponse.json({ error: 'Cannot pick for the other team' }, { status: 403 });
    }
    if (pick.godId !== null) {
      return NextResponse.json({ error: 'Player already has a god assigned' }, { status: 409 });
    }

    const god = await prisma.god.findUnique({ where: { id: godId } });
    if (!god) return NextResponse.json({ error: 'God not found' }, { status: 404 });

    const draftUsedGodIds = Array.isArray(draft.usedGodIds) ? draft.usedGodIds : [];

    if (bans.some((b) => b.godId === godId)) {
      return NextResponse.json({ error: 'That god is banned' }, { status: 409 });
    }
    if (allPicks.some((p) => p.godId === godId)) {
      return NextResponse.json({ error: 'That god is already picked' }, { status: 409 });
    }
    if (draftUsedGodIds.includes(godId)) {
      return NextResponse.json({ error: 'That god was already used earlier in this set' }, { status: 409 });
    }

    const newCompletedPicks = completedPicks + 1;
    await prisma.$transaction([
      prisma.draftPick.update({ where: { id: pickId }, data: { godId } }),
      prisma.draft.update({
        where: { id },
        data: {
          usedGodIds: [...draftUsedGodIds, godId],
          version: { increment: 1 },
          ...(newCompletedPicks === TOTAL_PICKS ? { status: 'complete' } : {}),
        },
      }),
    ]);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Failed to submit pick' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { key, pickId } = body;
  if (!pickId) return NextResponse.json({ error: 'pickId required' }, { status: 400 });

  try {
    const draft = await prisma.draft.findUnique({ where: { id } });
    if (!draft) return NextResponse.json({ error: 'Draft not found' }, { status: 404 });

    const role = resolveRole(key, draft);
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Only admins can undo picks' }, { status: 403 });
    }

    const pick = await prisma.draftPick.findFirst({
      where: { id: pickId, draftId: id },
    });
    if (!pick) return NextResponse.json({ error: 'Pick not found' }, { status: 404 });
    if (!pick.godId) return NextResponse.json({ error: 'Pick has no assigned god' }, { status: 400 });

    const draftUsedGodIds = Array.isArray(draft.usedGodIds) ? draft.usedGodIds : [];

    await prisma.$transaction([
      prisma.draftPick.update({
        where: { id: pickId },
        data: { godId: null },
      }),
      prisma.draft.update({
        where: { id },
        data: {
          status: 'picking',
          usedGodIds: draftUsedGodIds.filter((godId) => godId !== pick.godId),
          version: { increment: 1 },
        },
      }),
    ]);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Failed to undo pick' }, { status: 500 });
  }
}
