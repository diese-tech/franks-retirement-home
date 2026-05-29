import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { resolveAdminAuth } from '@/lib/resolveAuth';
import { getDiscordSessionUser } from '@/lib/discordAuth';
import { logAudit } from '@/lib/auditLog';

export const dynamic = 'force-dynamic';

export async function PATCH(req, { params }) {
  const authError = await resolveAdminAuth(req);
  if (authError) return authError;

  const session = getDiscordSessionUser(req);
  const reviewerName = session?.username ?? 'admin';
  const reviewerId = session?.discordId ?? 'admin';

  let body;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { action, reviewNote } = body;
  if (!['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'action must be approve or reject' }, { status: 400 });
  }

  const changeRequest = await prisma.changeRequest.findUnique({ where: { id: params.id } });
  if (!changeRequest) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (changeRequest.status !== 'pending') {
    return NextResponse.json({ error: 'Request is no longer pending' }, { status: 400 });
  }

  const payload = changeRequest.payload ?? {};

  if (action === 'approve') {
    try {
      await prisma.$transaction(async (tx) => {
        if (changeRequest.type === 'ROSTER_ADD') {
          const player = await tx.player.findUnique({ where: { id: payload.playerId } });
          if (!player) throw new Error('Player not found');
          await tx.teamMember.create({
            data: {
              teamId: changeRequest.teamId,
              playerId: payload.playerId,
              role: payload.role ?? player.role,
            },
          });
        } else if (changeRequest.type === 'ROSTER_REMOVE') {
          await tx.teamMember.deleteMany({
            where: { teamId: changeRequest.teamId, playerId: payload.playerId },
          });
        }

        await tx.changeRequest.update({
          where: { id: params.id },
          data: {
            status: 'approved',
            reviewedById: reviewerId,
            reviewedByName: reviewerName,
            reviewNote: reviewNote ?? null,
            reviewedAt: new Date(),
          },
        });
      });

      logAudit({
        entity: 'ChangeRequest',
        entityId: params.id,
        action: 'change_request_approved',
        adminId: reviewerId,
        payload: { type: changeRequest.type, teamId: changeRequest.teamId, ...payload },
      });
    } catch (e) {
      return NextResponse.json({ error: e.message ?? 'Failed to apply change' }, { status: 400 });
    }
  } else {
    if (!reviewNote) return NextResponse.json({ error: 'A reason is required to reject' }, { status: 400 });

    await prisma.changeRequest.update({
      where: { id: params.id },
      data: {
        status: 'rejected',
        reviewedById: reviewerId,
        reviewedByName: reviewerName,
        reviewNote,
        reviewedAt: new Date(),
      },
    });

    logAudit({
      entity: 'ChangeRequest',
      entityId: params.id,
      action: 'change_request_rejected',
      adminId: reviewerId,
      payload: { reason: reviewNote },
    });
  }

  const updated = await prisma.changeRequest.findUnique({ where: { id: params.id } });
  return NextResponse.json(updated);
}
