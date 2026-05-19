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

    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Failed to run admin action' }, { status: 500 });
  }
}
