import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { resolveAdminAuth } from '@/lib/resolveAuth';
import { logAudit } from '@/lib/audit';
import { invalidateAllStandings } from '@/lib/standings';

export const dynamic = 'force-dynamic';

// GET /api/submissions/[id] — admin: full submission detail
export async function GET(req, { params }) {
  const authError = await resolveAdminAuth(req);
  if (authError) return authError;

  try {
    const submission = await prisma.matchSubmission.findUnique({
      where: { id: params.id },
      include: {
        attachments: true,
        match: {
          select: {
            id: true,
            week: true,
            status: true,
            homeTeamId: true,
            awayTeamId: true,
            homeTeam: { select: { id: true, name: true, tag: true } },
            awayTeam: { select: { id: true, name: true, tag: true } },
          },
        },
        game: { select: { id: true, gameNumber: true, winnerTeamId: true } },
      },
    });
    if (!submission) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(submission);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch submission' }, { status: 500 });
  }
}

// PATCH /api/submissions/[id] — admin: transition status
// Body: { action: 'approve' | 'reject' | 'in_review', rejectionReason?, adminId? }
// approve: sets status=approved; if reportedWinnerTeamId present and gameId set,
//          also sets Game.winnerTeamId and supersedes other pending submissions for that game.
// reject: sets status=rejected + rejectionReason.
// in_review: sets status=in_review + reviewStartedAt.
export async function PATCH(req, { params }) {
  const authError = await resolveAdminAuth(req);
  if (authError) return authError;

  let body;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { action, rejectionReason, adminId } = body;
  if (!['approve', 'reject', 'in_review'].includes(action)) {
    return NextResponse.json({ error: 'action must be approve, reject, or in_review' }, { status: 400 });
  }
  if (action === 'reject' && !rejectionReason) {
    return NextResponse.json({ error: 'rejectionReason is required when rejecting' }, { status: 400 });
  }

  try {
    const submission = await prisma.matchSubmission.findUnique({
      where: { id: params.id },
    });
    if (!submission) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    if (action === 'in_review') {
      const updated = await prisma.matchSubmission.update({
        where: { id: params.id },
        data: {
          status: 'in_review',
          reviewStartedAt: new Date(),
          reviewedByAdminId: adminId || null,
        },
        include: { attachments: true },
      });
      logAudit('MatchSubmission', params.id, 'in_review', { adminId });
      return NextResponse.json(updated);
    }

    if (action === 'reject') {
      const updated = await prisma.matchSubmission.update({
        where: { id: params.id },
        data: {
          status: 'rejected',
          rejectionReason,
          reviewedAt: new Date(),
          reviewedByAdminId: adminId || null,
        },
        include: { attachments: true },
      });
      logAudit('MatchSubmission', params.id, 'rejected', { adminId, payload: { rejectionReason } });
      return NextResponse.json(updated);
    }

    // approve — atomic: mark approved, optionally set Game.winnerTeamId,
    // supersede other pending/in_review submissions for the same game
    const result = await prisma.$transaction(async (tx) => {
      const approved = await tx.matchSubmission.update({
        where: { id: params.id },
        data: {
          status: 'approved',
          reviewedAt: new Date(),
          reviewedByAdminId: adminId || null,
        },
        include: { attachments: true },
      });

      // Set canonical game winner if submission references a game and a winner team
      if (submission.gameId && submission.reportedWinnerTeamId) {
        await tx.game.update({
          where: { id: submission.gameId },
          data: { winnerTeamId: submission.reportedWinnerTeamId },
        });
      }

      // Supersede other open submissions for the same game
      if (submission.gameId) {
        await tx.matchSubmission.updateMany({
          where: {
            id: { not: params.id },
            gameId: submission.gameId,
            status: { in: ['pending', 'in_review'] },
          },
          data: { status: 'superseded' },
        });
      }

      return approved;
    });

    logAudit('MatchSubmission', params.id, 'approved', {
      adminId,
      payload: { gameId: submission.gameId, reportedWinnerTeamId: submission.reportedWinnerTeamId },
    });
    invalidateAllStandings();
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: 'Failed to update submission' }, { status: 500 });
  }
}
