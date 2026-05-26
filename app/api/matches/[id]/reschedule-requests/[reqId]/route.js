import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireAdmin } from '@/lib/adminSession';
import { logAudit } from '@/lib/audit';
import { resolveMatchCaptainAuth } from '@/lib/resolveAuth';

export const dynamic = 'force-dynamic';

// ─── PATCH /api/matches/[id]/reschedule-requests/[reqId] ─────────────────────
//
// Three actors, three distinct operations, one endpoint:
//
//  Opposing captain  — acknowledge or dispute a pending request
//    Header:  X-Captain-Key
//    Body:    { action: 'acknowledge' | 'dispute', note?: string }
//    Rules:   Only the captain who did NOT create the request may ack/dispute.
//             Request must be in 'pending' status.
//
//  Admin             — approve or deny any non-terminal request
//    Auth:    admin session cookie
//    Body:    { action: 'approve' | 'deny', adminNote?: string }
//    Rules:   On approve, Match.scheduledAt is updated to proposedScheduledAt.
//             Match.defaultScheduledAt is NEVER changed.
//
// Terminal statuses (approved | denied) cannot be transitioned again.

export async function PATCH(req, { params }) {
  const { id: matchId, reqId } = params;

  let body;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { action, note, adminNote } = body;
  if (!action) return NextResponse.json({ error: 'action is required' }, { status: 400 });

  // ── Load the request ──────────────────────────────────────────────────────
  const rescheduleRequest = await prisma.rescheduleRequest.findUnique({
    where: { id: reqId },
    include: {
      match: {
        select: {
          id: true,
          homeTeamCaptainKey: true,
          awayTeamCaptainKey: true,
          defaultScheduledAt: true,
          scheduledAt: true,
        },
      },
    },
  });

  if (!rescheduleRequest || rescheduleRequest.matchId !== matchId) {
    return NextResponse.json({ error: 'Reschedule request not found' }, { status: 404 });
  }

  // Terminal states cannot be mutated.
  if (['approved', 'denied'].includes(rescheduleRequest.status)) {
    return NextResponse.json(
      { error: `Request is already ${rescheduleRequest.status} and cannot be changed.` },
      { status: 409 },
    );
  }

  // ── Route by action ───────────────────────────────────────────────────────

  if (action === 'acknowledge' || action === 'dispute') {
    return handleCaptainResponse(req, rescheduleRequest, action, note);
  }

  if (action === 'approve' || action === 'deny') {
    return handleAdminDecision(req, rescheduleRequest, action, adminNote);
  }

  return NextResponse.json(
    { error: `Unknown action "${action}". Valid actions: acknowledge, dispute, approve, deny.` },
    { status: 400 },
  );
}

// ─── Captain acknowledge / dispute ───────────────────────────────────────────

async function handleCaptainResponse(req, rescheduleRequest, action, note) {
  const match = rescheduleRequest.match;

  const auth = await resolveMatchCaptainAuth(req, match);
  const captainSide = auth.side;
  if (!captainSide) {
    return NextResponse.json({ error: 'Invalid captain key' }, { status: 401 });
  }

  // The opposing captain (not the requester) must respond.
  if (captainSide === rescheduleRequest.requestedByCaptainSide) {
    return NextResponse.json(
      { error: 'The captain who submitted this request cannot acknowledge or dispute it. Only the opposing captain may respond.' },
      { status: 403 },
    );
  }

  // Can only respond to a pending request.
  if (rescheduleRequest.status !== 'pending') {
    return NextResponse.json(
      { error: `Request is in '${rescheduleRequest.status}' status. Only pending requests can be acknowledged or disputed.` },
      { status: 409 },
    );
  }

  const newStatus = action === 'acknowledge' ? 'acknowledged' : 'disputed';

  const updated = await prisma.rescheduleRequest.update({
    where: { id: rescheduleRequest.id },
    data: {
      status: newStatus,
      opposingCaptainNote: note?.trim() || null,
    },
  });

  logAudit('RescheduleRequest', rescheduleRequest.id, action, {
    payload: { matchId: rescheduleRequest.matchId, captainSide, newStatus },
  });

  return NextResponse.json(updated);
}

// ─── Admin approve / deny ─────────────────────────────────────────────────────

async function handleAdminDecision(req, rescheduleRequest, action, adminNote) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  const newStatus = action === 'approve' ? 'approved' : 'denied';

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.rescheduleRequest.update({
        where: { id: rescheduleRequest.id },
        data: {
          status: newStatus,
          adminNote: adminNote?.trim() || null,
          decidedAt: new Date(),
        },
      });

      // On approve: update Match.scheduledAt to the proposed time.
      // defaultScheduledAt is intentionally NOT touched — §7 invariant.
      if (action === 'approve') {
        await tx.match.update({
          where: { id: rescheduleRequest.matchId },
          data: { scheduledAt: rescheduleRequest.proposedScheduledAt },
        });
      }

      return result;
    });

    logAudit('RescheduleRequest', rescheduleRequest.id, action, {
      payload: {
        matchId: rescheduleRequest.matchId,
        newStatus,
        proposedScheduledAt: rescheduleRequest.proposedScheduledAt,
        adminNote: adminNote?.trim() || null,
      },
    });

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: 'Failed to process admin decision' }, { status: 500 });
  }
}
