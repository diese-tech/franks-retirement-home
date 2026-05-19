import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { resolveRole } from '@/lib/draftAuth';
import { teamsAreLoaded } from '@/lib/draftLifecycle';

export const dynamic = 'force-dynamic';

export async function POST(request, { params }) {
  // NOTE: This endpoint is intentionally NOT guarded by `requireAdmin`. It is
  // a draft-scoped action (nextGame / resetDraft) protected by the per-draft
  // adminKey URL token below. Admins typically reach it from the shared draft
  // URL, not the /admin dashboard. See issue #6 for the rollout decision.
  const { id } = await params;
  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { key, action } = body;
  if (!action) {
    return NextResponse.json({ error: 'action required' }, { status: 400 });
  }

  try {
    const draft = await prisma.draft.findUnique({ where: { id } });
    if (!draft) return NextResponse.json({ error: 'Draft not found' }, { status: 404 });

    const role = resolveRole(key, draft);
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Only admins can run this action' }, { status: 403 });
    }

    const picks = await prisma.draftPick.findMany({
      where: { draftId: id },
      select: { id: true, team: true },
    });

    if (action === 'nextGame') {
      if (draft.status !== 'complete') {
        return NextResponse.json({ error: 'Next Game is only available after a completed game' }, { status: 400 });
      }

      await prisma.$transaction([
        prisma.draftBan.deleteMany({ where: { draftId: id } }),
        prisma.draftPick.updateMany({ where: { draftId: id }, data: { godId: null } }),
        prisma.draft.update({
          where: { id },
          data: {
            status: teamsAreLoaded(picks) ? 'lobby' : 'pending',
            captainAReady: false,
            captainBReady: false,
            version: { increment: 1 },
          },
        }),
      ]);

      return NextResponse.json({ ok: true });
    }

    if (action === 'resetDraft') {
      await prisma.$transaction([
        prisma.draftBan.deleteMany({ where: { draftId: id } }),
        prisma.draftPick.updateMany({ where: { draftId: id }, data: { godId: null } }),
        prisma.draft.update({
          where: { id },
          data: {
            status: teamsAreLoaded(picks) ? 'lobby' : 'pending',
            captainAReady: false,
            captainBReady: false,
            usedGodIds: [],
            version: { increment: 1 },
          },
        }),
      ]);

      return NextResponse.json({ ok: true });
    }

    if (action === 'reopenLastPick') {
      // Issue #14: the previous "Reopen Draft" path flipped status from
      // 'complete' back to 'picking' without nulling a pick, leaving the
      // draft with all 10 slots still assigned. Captains then either saw
      // "no open slots" or the next pick auto-completed the draft again.
      //
      // This action atomically rewinds exactly one pick: it nulls the
      // most-recent assigned pick, removes that god from the vault, and
      // sets status back to 'picking'. Calling it repeatedly steps
      // backwards through the pick history one slot at a time.
      const result = await prisma.$transaction(async (tx) => {
        const lastPick = await tx.draftPick.findFirst({
          where: { draftId: id, godId: { not: null } },
          orderBy: { pickOrder: 'desc' },
        });
        if (!lastPick) {
          return { error: 'No assigned picks to reopen' };
        }

        const current = await tx.draft.findUnique({
          where: { id },
          select: { usedGodIds: true },
        });
        const draftUsedGodIds = Array.isArray(current?.usedGodIds) ? current.usedGodIds : [];
        const reopenedGodId = lastPick.godId;

        await tx.draftPick.update({
          where: { id: lastPick.id },
          data: { godId: null },
        });
        await tx.draft.update({
          where: { id },
          data: {
            status: 'picking',
            usedGodIds: draftUsedGodIds.filter((g) => g !== reopenedGodId),
            version: { increment: 1 },
          },
        });

        return { ok: true, reopenedGodId, reopenedPickId: lastPick.id };
      });

      if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Failed to run admin action' }, { status: 500 });
  }
}
