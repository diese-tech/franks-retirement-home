import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireAdmin } from '@/lib/adminSession';
import { logAudit } from '@/lib/audit';
import { resolveCaptainSide } from '@/lib/matchWindow';

export const dynamic = 'force-dynamic';

// ─── Shared match fetch ───────────────────────────────────────────────────────

async function fetchMatch(matchId) {
  return prisma.match.findUnique({
    where: { id: matchId },
    select: {
      id: true,
      homeTeamCaptainKey: true,
      awayTeamCaptainKey: true,
      defaultScheduledAt: true,
      scheduledAt: true,
      status: true,
    },
  });
}

// ─── GET /api/matches/[id]/reschedule-requests ────────────────────────────────
// Admin only. Returns all reschedule requests for a match, newest first.

export async function GET(req, { params }) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  try {
    const requests = await prisma.rescheduleRequest.findMany({
      where: { matchId: params.id },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(requests);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch reschedule requests' }, { status: 500 });
  }
}

// ─── POST /api/matches/[id]/reschedule-requests ───────────────────────────────
// Captain-key gated. Creates a new reschedule request.
// A captain may only have one open (pending|acknowledged|disputed) request at a time.
//
// Body: { proposedScheduledAt: string (ISO), evidenceText?: string }

export async function POST(req, { params }) {
  const captainKey = req.headers.get('x-captain-key');

  let body;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { proposedScheduledAt, evidenceText } = body;
  if (!proposedScheduledAt) {
    return NextResponse.json({ error: 'proposedScheduledAt is required' }, { status: 400 });
  }

  const proposedDate = new Date(proposedScheduledAt);
  if (isNaN(proposedDate.getTime())) {
    return NextResponse.json({ error: 'proposedScheduledAt must be a valid ISO date string' }, { status: 400 });
  }

  try {
    const match = await fetchMatch(params.id);
    if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 });

    const captainSide = resolveCaptainSide(match, captainKey);
    if (!captainSide) {
      return NextResponse.json({ error: 'Invalid captain key' }, { status: 401 });
    }

    // One open request per match at a time — prevents duplicate pending requests.
    const openRequest = await prisma.rescheduleRequest.findFirst({
      where: {
        matchId: params.id,
        status: { in: ['pending', 'acknowledged', 'disputed'] },
      },
    });
    if (openRequest) {
      return NextResponse.json(
        { error: 'A reschedule request is already open for this match. It must be resolved before a new one can be submitted.' },
        { status: 409 },
      );
    }

    const request = await prisma.rescheduleRequest.create({
      data: {
        matchId: params.id,
        proposedScheduledAt: proposedDate,
        requestedByCaptainSide: captainSide,
        evidenceText: evidenceText?.trim() || null,
        status: 'pending',
      },
    });

    logAudit('RescheduleRequest', request.id, 'created', {
      payload: { matchId: params.id, captainSide, proposedScheduledAt },
    });

    return NextResponse.json(request, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to create reschedule request' }, { status: 500 });
  }
}
