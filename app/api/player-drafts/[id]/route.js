import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireAdmin } from '@/lib/adminSession';
import { buildPlayerDraftState } from '@/lib/playerDraftState';

export const dynamic = 'force-dynamic';

export async function GET(_req, { params }) {
  const state = await buildPlayerDraftState(params.id);
  if (!state) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(state);
}

// PATCH — admin controls: start, pause, resume, complete, set order, undo last pick
export async function PATCH(req, { params }) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  let body;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { action, currentOrder } = body;

  try {
    const draft = await prisma.playerDraft.findUnique({ where: { id: params.id } });
    if (!draft) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    if (action === 'start') {
      if (draft.status !== 'pending') {
        return NextResponse.json({ error: 'Draft must be pending to start' }, { status: 400 });
      }
      const order = Array.isArray(draft.currentOrder) && draft.currentOrder.length > 0
        ? draft.currentOrder
        : Array.isArray(draft.baseOrder) ? draft.baseOrder : [];
      if (order.length === 0) {
        return NextResponse.json({ error: 'Set currentOrder before starting' }, { status: 400 });
      }
      const updated = await prisma.playerDraft.update({
        where: { id: params.id },
        data: {
          status: 'active',
          startedAt: new Date(),
          pickStartedAt: new Date(),
          // Freeze baseOrder at start — it is the immutable audit trail.
          // currentOrder remains mutable (slot trades), but baseOrder never changes after this.
          baseOrder: order,
          version: { increment: 1 },
        },
      });
      return NextResponse.json(updated);
    }

    if (action === 'pause') {
      if (draft.status !== 'active') return NextResponse.json({ error: 'Draft is not active' }, { status: 400 });
      const updated = await prisma.playerDraft.update({
        where: { id: params.id },
        data: { status: 'paused', version: { increment: 1 } },
      });
      return NextResponse.json(updated);
    }

    if (action === 'resume') {
      if (draft.status !== 'paused') return NextResponse.json({ error: 'Draft is not paused' }, { status: 400 });
      const updated = await prisma.playerDraft.update({
        where: { id: params.id },
        data: { status: 'active', pickStartedAt: new Date(), version: { increment: 1 } },
      });
      return NextResponse.json(updated);
    }

    if (action === 'skip') {
      // 'skip' is not supported — advancing currentPickIndex without a corresponding
      // PlayerDraftPick row causes index drift that permanently prevents draft completion.
      // Use 'undo' to step backward, or record the pick normally.
      return NextResponse.json({ error: 'skip is not supported; use undo to rewind or record the pick' }, { status: 400 });
    }

    if (action === 'undo') {
      if (draft.currentPickIndex === 0) {
        return NextResponse.json({ error: 'Nothing to undo' }, { status: 400 });
      }
      // Delete the last pick and decrement index
      const lastPick = await prisma.playerDraftPick.findFirst({
        where: { playerDraftId: params.id },
        orderBy: { pickNumber: 'desc' },
      });
      const updated = await prisma.$transaction(async (tx) => {
        if (lastPick) await tx.playerDraftPick.delete({ where: { id: lastPick.id } });
        return tx.playerDraft.update({
          where: { id: params.id },
          data: {
            currentPickIndex: Math.max(0, draft.currentPickIndex - 1),
            status: draft.status === 'complete' ? 'active' : draft.status,
            completedAt: null,
            pickStartedAt: new Date(),
            version: { increment: 1 },
          },
        });
      });
      return NextResponse.json(updated);
    }

    if (action === 'setOrder' && Array.isArray(currentOrder)) {
      if (draft.status !== 'pending') {
        return NextResponse.json({ error: 'Order can only be set before the draft starts' }, { status: 400 });
      }
      const updated = await prisma.playerDraft.update({
        where: { id: params.id },
        data: {
          baseOrder: currentOrder,
          currentOrder,
          version: { increment: 1 },
        },
      });
      return NextResponse.json(updated);
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Failed to update draft' }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  try {
    await prisma.playerDraft.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e.code === 'P2025') return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
