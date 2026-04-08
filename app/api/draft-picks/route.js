import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

// GET /api/draft-picks?draftId=xxx — all picks for a draft (with relations)
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const draftId = searchParams.get('draftId');
  if (!draftId) return NextResponse.json({ error: 'draftId required' }, { status: 400 });

  const picks = await prisma.draftPick.findMany({
    where: { draftId },
    include: { player: true, god: true },
    orderBy: { pickOrder: 'asc' },
  });
  return NextResponse.json(picks);
}

// POST /api/draft-picks — create pick or update god selection
// Create: { draftId, playerId, team, pickOrder }
// Update: { id, godId } or { id, team }
export async function POST(request) {
  const body = await request.json();

  // Update existing pick (change god or team)
  if (body.id) {
    const data = {};
    if (body.godId !== undefined) data.godId = body.godId || null;
    if (body.team) data.team = body.team;

    const pick = await prisma.draftPick.update({
      where: { id: body.id },
      data,
      include: { player: true, god: true },
    });
    return NextResponse.json(pick);
  }

  // Create new pick
  const { draftId, playerId, team, pickOrder } = body;
  if (!draftId || !playerId || !team) {
    return NextResponse.json({ error: 'draftId, playerId, team required' }, { status: 400 });
  }

  try {
    const pick = await prisma.draftPick.create({
      data: { draftId, playerId, team, pickOrder: pickOrder || 0 },
      include: { player: true, god: true },
    });
    return NextResponse.json(pick, { status: 201 });
  } catch (e) {
    // Unique constraint — player already drafted
    if (e.code === 'P2002') {
      return NextResponse.json({ error: 'Player already drafted' }, { status: 409 });
    }
    throw e;
  }
}

// DELETE /api/draft-picks?id=xxx  — remove single pick
// DELETE /api/draft-picks?draftId=xxx&clear=true — clear all picks for draft
export async function DELETE(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const draftId = searchParams.get('draftId');
  const clear = searchParams.get('clear');

  if (clear === 'true' && draftId) {
    await prisma.draftPick.deleteMany({ where: { draftId } });
    return NextResponse.json({ ok: true, cleared: draftId });
  }

  if (id) {
    await prisma.draftPick.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'id or draftId+clear required' }, { status: 400 });
}
