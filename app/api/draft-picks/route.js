import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { TEAMS } from '@/lib/constants';

// Active-ish statuses where picks are locked into a live draft
const LIVE_STATUSES = ['lobby', 'banning', 'picking', 'active'];

// GET /api/draft-picks?draftId=xxx
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const draftId = searchParams.get('draftId');
  if (!draftId) return NextResponse.json({ error: 'draftId required' }, { status: 400 });

  try {
    const picks = await prisma.draftPick.findMany({
      where: { draftId },
      include: { player: true, god: true },
      orderBy: { pickOrder: 'asc' },
    });
    return NextResponse.json(picks);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch draft picks' }, { status: 500 });
  }
}

// POST /api/draft-picks
// Create: { draftId, playerId, team, pickOrder }
// Update god (legacy admin): { id, godId } or { id, team }
export async function POST(request) {
  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  try {
    // Update existing pick
    if (body.id) {
      const data = {};

      if (body.godId !== undefined) {
        const godId = body.godId || null;
        if (godId) {
          const currentPick = await prisma.draftPick.findUnique({
            where: { id: body.id },
            select: { draftId: true },
          });
          if (currentPick) {
            const conflict = await prisma.draftPick.findFirst({
              where: { draftId: currentPick.draftId, godId, id: { not: body.id } },
            });
            if (conflict) return NextResponse.json({ error: 'That god is already picked in this draft' }, { status: 409 });
          }
        }
        data.godId = godId;
      }

      if (body.team !== undefined) {
        if (!TEAMS.includes(body.team)) {
          return NextResponse.json({ error: `team must be one of: ${TEAMS.join(', ')}` }, { status: 400 });
        }
        data.team = body.team;
      }

      const pick = await prisma.draftPick.update({
        where: { id: body.id },
        data,
        include: { player: true, god: true },
      });

      // Bump draft version so SSE sees the change
      await prisma.draft.update({
        where: { id: pick.draftId },
        data: { version: { increment: 1 } },
      });

      return NextResponse.json(pick);
    }

    // Create new pick
    const { draftId, playerId, team, pickOrder } = body;
    if (!draftId || !playerId || !team) {
      return NextResponse.json({ error: 'draftId, playerId, team required' }, { status: 400 });
    }
    if (!TEAMS.includes(team)) {
      return NextResponse.json({ error: `team must be one of: ${TEAMS.join(', ')}` }, { status: 400 });
    }

    const pick = await prisma.draftPick.create({
      data: { draftId, playerId, team, pickOrder: Number.isInteger(pickOrder) ? pickOrder : 0 },
      include: { player: true, god: true },
    });

    await prisma.draft.update({
      where: { id: draftId },
      data: { version: { increment: 1 } },
    });

    return NextResponse.json(pick, { status: 201 });
  } catch (e) {
    if (e.code === 'P2002') return NextResponse.json({ error: 'Player already drafted' }, { status: 409 });
    return NextResponse.json({ error: 'Failed to save draft pick' }, { status: 500 });
  }
}

// DELETE /api/draft-picks?id=xxx
// DELETE /api/draft-picks?draftId=xxx&clear=true
export async function DELETE(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const draftId = searchParams.get('draftId');
  const clear = searchParams.get('clear');

  try {
    if (clear === 'true' && draftId) {
      await prisma.draftPick.deleteMany({ where: { draftId } });
      await prisma.draft.update({ where: { id: draftId }, data: { version: { increment: 1 } } });
      return NextResponse.json({ ok: true, cleared: draftId });
    }

    if (id) {
      const pick = await prisma.draftPick.delete({ where: { id } });
      await prisma.draft.update({ where: { id: pick.draftId }, data: { version: { increment: 1 } } });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'id or draftId+clear required' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Failed to delete draft pick' }, { status: 500 });
  }
}
