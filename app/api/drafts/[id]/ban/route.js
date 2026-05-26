import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { resolveRole } from '@/lib/draftAuth';
import { currentBanTeam, TOTAL_BANS } from '@/lib/draftOrder';
import { resolveDraftCaptainAuth } from '@/lib/resolveAuth';

export const dynamic = 'force-dynamic';

// Sentinel thrown inside the transaction when the optimistic version lock
// fails (i.e. another writer landed first). The outer catch retries once.
class VersionConflictError extends Error {
  constructor() { super('version conflict'); this.name = 'VersionConflictError'; }
}

// POST /api/drafts/[id]/ban
// Body: { key, godId }
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

  const { key, godId } = body;
  if (!godId) return NextResponse.json({ error: 'godId required' }, { status: 400 });

  // Resolve the role once outside the transaction. The Draft.*Key fields
  // do not change during a draft, so this is safe even though we re-read
  // the draft inside the transaction for the version lock.
  const draft = await prisma.draft.findUnique({ where: { id } });
  if (!draft) return NextResponse.json({ error: 'Draft not found' }, { status: 404 });

  const auth = await resolveDraftCaptainAuth(request, draft, key);
  const role = auth.role;
  if (role === 'spectator') {
    return NextResponse.json({ error: 'Not authorized to ban' }, { status: 403 });
  }

  const god = await prisma.god.findUnique({ where: { id: godId } });
  if (!god) return NextResponse.json({ error: 'God not found' }, { status: 404 });

  const attempt = async () => {
    return prisma.$transaction(async (tx) => {
      const current = await tx.draft.findUnique({
        where: { id },
        select: { id: true, status: true, version: true },
      });
      if (!current) return { http: NextResponse.json({ error: 'Draft not found' }, { status: 404 }) };
      if (current.status !== 'banning') {
        return { http: NextResponse.json({ error: 'Draft is not in banning phase' }, { status: 400 }) };
      }

      const banCount = await tx.draftBan.count({ where: { draftId: id } });
      if (banCount >= TOTAL_BANS) {
        return { http: NextResponse.json({ error: 'All bans are complete' }, { status: 400 }) };
      }

      const expectedTeam = currentBanTeam(banCount);
      if (role === 'captainA' && expectedTeam !== 'A') {
        return { http: NextResponse.json({ error: "It's not your turn to ban" }, { status: 403 }) };
      }
      if (role === 'captainB' && expectedTeam !== 'B') {
        return { http: NextResponse.json({ error: "It's not your turn to ban" }, { status: 403 }) };
      }

      // Duplicate-ban check inside the transaction. The unique constraint
      // (draftId, godId) is the final guard, but checking first gives a
      // clean 409 instead of an opaque P2002.
      const existing = await tx.draftBan.findFirst({
        where: { draftId: id, godId },
        select: { id: true },
      });
      if (existing) {
        return { http: NextResponse.json({ error: 'God already banned' }, { status: 409 }) };
      }

      await tx.draftBan.create({
        data: { draftId: id, godId, team: expectedTeam, banOrder: banCount },
      });

      const newBanCount = banCount + 1;
      const updated = await tx.draft.updateMany({
        where: { id, version: current.version },
        data: {
          version: { increment: 1 },
          ...(newBanCount === TOTAL_BANS ? { status: 'picking' } : {}),
        },
      });
      if (updated.count !== 1) {
        // Lost the optimistic lock. Throw to roll back and let the outer
        // layer retry once.
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
        // Retry once. If we lose again, surface a 409 — the caller can
        // refresh and resubmit if it's still their turn.
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
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e?.code === 'P2002') return NextResponse.json({ error: 'God already banned' }, { status: 409 });
    return NextResponse.json({ error: 'Failed to submit ban' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { key, banId } = body;
  if (!banId) return NextResponse.json({ error: 'banId required' }, { status: 400 });

  try {
    const draft = await prisma.draft.findUnique({ where: { id } });
    if (!draft) return NextResponse.json({ error: 'Draft not found' }, { status: 404 });

    const role = resolveRole(key, draft);
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Only admins can undo bans' }, { status: 403 });
    }

    const ban = await prisma.draftBan.findFirst({
      where: { id: banId, draftId: id },
    });
    if (!ban) return NextResponse.json({ error: 'Ban not found' }, { status: 404 });

    const completedPicks = await prisma.draftPick.count({
      where: { draftId: id, godId: { not: null } },
    });
    if (completedPicks > 0) {
      return NextResponse.json({ error: 'Undo picks before rewinding bans' }, { status: 400 });
    }

    const remaining = await prisma.draftBan.findMany({
      where: { draftId: id, id: { not: banId } },
      orderBy: { banOrder: 'asc' },
    });

    const updates = remaining.map((item, index) =>
      prisma.draftBan.update({
        where: { id: item.id },
        data: { banOrder: index },
      })
    );

    await prisma.$transaction([
      prisma.draftBan.delete({ where: { id: banId } }),
      ...updates,
      prisma.draft.update({
        where: { id },
        data: {
          status: 'banning',
          version: { increment: 1 },
        },
      }),
    ]);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Failed to undo ban' }, { status: 500 });
  }
}
