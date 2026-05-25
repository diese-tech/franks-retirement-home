import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireAdmin } from '@/lib/adminSession';

export const dynamic = 'force-dynamic';

// PATCH /api/player-drafts/[id]/order
// Admin applies a bilateral slot trade by updating currentOrder.
// Only picks at currentPickIndex or later are affected; past picks are unchanged.
// baseOrder is never modified — it is the audit trail of the originally approved order.
export async function PATCH(req, { params }) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  let body;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { currentOrder } = body;
  if (!Array.isArray(currentOrder) || currentOrder.length === 0) {
    return NextResponse.json({ error: 'currentOrder must be a non-empty array of teamIds' }, { status: 400 });
  }

  try {
    const draft = await prisma.playerDraft.findUnique({ where: { id: params.id } });
    if (!draft) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (draft.status === 'complete') {
      return NextResponse.json({ error: 'Cannot modify order of a completed draft' }, { status: 400 });
    }

    const updated = await prisma.playerDraft.update({
      where: { id: params.id },
      data: { currentOrder, version: { increment: 1 } },
    });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: 'Failed to update order' }, { status: 500 });
  }
}
