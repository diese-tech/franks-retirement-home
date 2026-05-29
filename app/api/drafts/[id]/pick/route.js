import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { resolveRole } from '@/lib/draftAuth';
import { currentPickTeam, TOTAL_PICKS } from '@/lib/draftOrder';
import { addUsedGodId, readUsedGodIds, removeUsedGodId } from '@/lib/usedGodIds';
import { resolveDraftCaptainAuth } from '@/lib/resolveAuth';
import { logAudit } from '@/lib/auditLog';

export const dynamic = 'force-dynamic';

class VersionConflictError extends Error {
  constructor() { super('version conflict'); this.name = 'VersionConflictError'; }
}

// POST /api/drafts/[id]/pick
// Body: { key, godId } with optional { pickId } for legacy/admin callers
//
// Concurrency: read + write happen inside a single $transaction with an
// optimistic version lock on Draft. If two valid submissions race, exactly
// one wins; the loser sees a 409 after one transparent retry.
export async function POST(request, { params }) {
  const { id } = await params;
  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { key, pickId, godId } = body;
  if (!godId) return NextResponse.json({ error: 'godId required' }, { status: 400 });

  // Resolve the role once outside the transaction. The Draft.*Key fields
  // do not change during a draft.
  const draft = await prisma.draft.findUnique({ where: { id } });
  if (!draft) return NextResponse.json({ error: 'Draft not found' }, { status: 404 });

  const auth = await resolveDraftCaptainAuth(request, draft, key);
  const role = auth.role;
  if (role === 'spectator') {
    return NextResponse.json({ error: 'Not authorized to pick' }, { status: 403 });
  }

  const god = await prisma.god.findUnique({ where: { id: godId } });
  if (!god) return NextResponse.json({ error: 'God not found' }, { status: 404 });

  const attempt = async () => {
    return prisma.$transaction(async (tx) => {
      const current = await tx.draft.findUnique({
        where: { id },
        select: { id: true, status: true, version: true, usedGodIds: true },
      });
      if (!current) return { http: NextResponse.json({ error: 'Draft not found' }, { status: 404 }) };
      if (current.status !== 'picking') {
        return { http: NextResponse.json({ error: 'Draft is not in picking phase' }, { status: 400 }) };
      }

      const [allPicks, bans] = await Promise.all([
        tx.draftPick.findMany({ where: { draftId: id }, orderBy: { pickOrder: 'asc' } }),
        tx.draftBan.findMany({ where: { draftId: id } }),
      ]);

      const completedPicks = allPicks.filter((p) => p.godId !== null).length;
      if (completedPicks >= TOTAL_PICKS) {
        return { http: NextResponse.json({ error: 'All picks are complete' }, { status: 400 }) };
      }

      const expectedTeam = currentPickTeam(completedPicks);
      if (role === 'captainA' && expectedTeam !== 'A') {
        return { http: NextResponse.json({ error: "It's not your turn to pick" }, { status: 403 }) };
      }
      if (role === 'captainB' && expectedTeam !== 'B') {
        return { http: NextResponse.json({ error: "It's not your turn to pick" }, { status: 403 }) };
      }

      const derivedPick = allPicks.find((p) => p.team === expectedTeam && p.godId === null);
      const pick = pickId
        ? allPicks.find((p) => p.id === pickId)
        : derivedPick;
      if (!pick) return { http: NextResponse.json({ error: 'Pick not found' }, { status: 404 }) };
      if (pick.draftId !== id) {
        return { http: NextResponse.json({ error: 'Pick does not belong to this draft' }, { status: 400 }) };
      }
      if (role === 'captainA' && pick.team !== 'A') {
        return { http: NextResponse.json({ error: 'Cannot pick for the other team' }, { status: 403 }) };
      }
      if (role === 'captainB' && pick.team !== 'B') {
        return { http: NextResponse.json({ error: 'Cannot pick for the other team' }, { status: 403 }) };
      }
      if (pick.godId !== null) {
        return { http: NextResponse.json({ error: 'Player already has a god assigned' }, { status: 409 }) };
      }
      if (pick.team !== expectedTeam) {
        return { http: NextResponse.json({ error: 'Pick does not match the active team' }, { status: 409 }) };
      }

      const draftUsedGodIds = readUsedGodIds(current);

      if (bans.some((b) => b.godId === godId)) {
        return { http: NextResponse.json({ error: 'That god is banned' }, { status: 409 }) };
      }
      if (allPicks.some((p) => p.godId === godId)) {
        return { http: NextResponse.json({ error: 'That god is already picked' }, { status: 409 }) };
      }
      if (draftUsedGodIds.includes(godId)) {
        return { http: NextResponse.json({ error: 'That god was already used earlier in this set' }, { status: 409 }) };
      }

      await tx.draftPick.update({ where: { id: pick.id }, data: { godId } });

      const newCompletedPicks = completedPicks + 1;
      const updated = await tx.draft.updateMany({
        where: { id, version: current.version },
        data: {
          usedGodIds: addUsedGodId(draftUsedGodIds, godId),
          version: { increment: 1 },
          ...(newCompletedPicks === TOTAL_PICKS ? { status: 'complete' } : {}),
        },
      });
      if (updated.count !== 1) {
        throw new VersionConflictError();
      }

      return { ok: true };
    });
  };

  try {
    let result;
    try {
      result = await attempt();
    } catch (err) {
      if (err instanceof VersionConflictError) {
        try {
          result = await attempt();
        } catch (err2) {
          if (err2 instanceof VersionConflictError) {
            return NextResponse.json({ error: 'Conflicting submission, please retry' }, { status: 409 });
          }
          throw err2;
        }
      } else {
        throw err;
      }
    }
    if (result.http) return result.http;
    logAudit({
      entity: 'DraftPick',
      entityId: params.id,
      action: 'pick_recorded',
      payload: { godId, slot: pickId },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e?.code === 'P2002') return NextResponse.json({ error: 'That god is already in this draft' }, { status: 409 });
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

    // Read picks + bans in the same step the writer uses to decide whether
    // this god is still referenced elsewhere in the draft. The undone pick
    // is excluded via excludePickId so we don't see ourselves as a holdout.
    await prisma.$transaction(async (tx) => {
      const [allPicks, bans, current] = await Promise.all([
        tx.draftPick.findMany({ where: { draftId: id }, select: { id: true, godId: true } }),
        tx.draftBan.findMany({ where: { draftId: id }, select: { godId: true } }),
        tx.draft.findUnique({ where: { id }, select: { usedGodIds: true } }),
      ]);
      const draftUsedGodIds = readUsedGodIds(current);
      const nextUsedGodIds = removeUsedGodId(draftUsedGodIds, pick.godId, {
        picks: allPicks,
        bans,
        excludePickId: pickId,
      });

      await tx.draftPick.update({
        where: { id: pickId },
        data: { godId: null },
      });
      await tx.draft.update({
        where: { id },
        data: {
          status: 'picking',
          usedGodIds: nextUsedGodIds,
          version: { increment: 1 },
        },
      });
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Failed to undo pick' }, { status: 500 });
  }
}
