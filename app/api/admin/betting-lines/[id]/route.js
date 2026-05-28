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
    data.status = body.status;
    if (body.status === 'settled') data.settledAt = new Date();
  }

  try {
    const line = await prisma.bettingLine.update({ where: { id }, data });
    return NextResponse.json(line);
  } catch (err) {
    console.error('[admin/betting-lines PATCH]', err);
    return NextResponse.json({ error: 'Failed to update line' }, { status: 500 });
  }
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
