import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { resolveAdminAuth } from '@/lib/resolveAuth';
import { buildPlayerDraftFormat, totalPicks } from '@/lib/playerDraftOrder';

export const dynamic = 'force-dynamic';

// POST /api/player-drafts/[id]/complete
// Admin "Complete Draft" action.
// Validates all picks are in, then runs a Prisma $transaction that:
//   1. Upserts TeamMember rows from every PlayerDraftPick.
//   2. Marks the draft complete.
// Uses upsert to handle players manually pre-assigned to a team.
export async function POST(req, { params }) {
  const authError = await resolveAdminAuth(req);
  if (authError) return authError;

  try {
    const draft = await prisma.playerDraft.findUnique({
      where: { id: params.id },
      include: {
        division: { select: { name: true } },
        picks: {
          include: {
            player: { select: { id: true, role: true } },
          },
        },
      },
    });

    if (!draft) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (draft.status === 'complete') {
      return NextResponse.json({ error: 'Draft is already complete' }, { status: 409 });
    }

    const currentOrder = Array.isArray(draft.currentOrder) ? draft.currentOrder : [];
    const format = buildPlayerDraftFormat(currentOrder, draft.rounds);
    const total = totalPicks(format);

    if (draft.picks.length < total) {
      return NextResponse.json({
        error: `Draft has ${draft.picks.length} of ${total} picks. All picks must be recorded before completing.`,
      }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      // Upsert a TeamMember row for each pick
      let created = 0;
      let updated = 0;
      for (const pick of draft.picks) {
        const existing = await tx.teamMember.findUnique({
          where: { teamId_playerId: { teamId: pick.teamId, playerId: pick.playerId } },
        });
        if (existing) {
          await tx.teamMember.update({
            where: { id: existing.id },
            data: { role: pick.player.role, leftAt: null },
          });
          updated++;
        } else {
          await tx.teamMember.create({
            data: {
              teamId: pick.teamId,
              playerId: pick.playerId,
              role: pick.player.role,
              isCaptain: false,
              isSub: false,
            },
          });
          created++;
        }
      }

      const completed = await tx.playerDraft.update({
        where: { id: params.id },
        data: {
          status: 'complete',
          completedAt: new Date(),
          version: { increment: 1 },
        },
      });

      return { draft: completed, teamMembersCreated: created, teamMembersUpdated: updated };
    });

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: 'Failed to complete draft' }, { status: 500 });
  }
}
