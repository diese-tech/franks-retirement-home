import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { resolveAdminAuth } from '@/lib/resolveAuth';
import { checkMatchWindow } from '@/lib/matchWindow';
import { resolveMatchCaptainAuth } from '@/lib/resolveAuth';

export const dynamic = 'force-dynamic';

// GET /api/matches/[id]/submissions — admin: list all submissions for a match
export async function GET(req, { params }) {
  const authError = await resolveAdminAuth(req);
  if (authError) return authError;

  try {
    const submissions = await prisma.matchSubmission.findMany({
      where: { matchId: params.id },
      orderBy: { createdAt: 'desc' },
      include: {
        attachments: true,
        game: { select: { id: true, gameNumber: true } },
      },
    });
    return NextResponse.json(submissions);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch submissions' }, { status: 500 });
  }
}

// POST /api/matches/[id]/submissions
// Captain-key gated (match homeTeamCaptainKey or awayTeamCaptainKey in header X-Captain-Key).
// Admins may submit without a captain key and are not subject to the eligibility window.
// Body: { gameId?, reportedWinnerTeamId?, notes?, attachments?: [{ url, kind, mimeType?, byteSize? }] }
export async function POST(req, { params }) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });

  try {
    const match = await prisma.match.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        homeTeamCaptainKey: true,
        awayTeamCaptainKey: true,
        status: true,
        defaultScheduledAt: true,
      },
    });
    if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 });

    // Determine whether this is an admin request or a captain request.
    const adminErr = await resolveAdminAuth(req);
    const auth = await resolveMatchCaptainAuth(req, match);
    const isAdmin = adminErr === null || auth.isAdmin;
    const captainSide = auth.side;
    const isCaptain = captainSide !== null;

    if (!isAdmin && !isCaptain) {
      return NextResponse.json({ error: 'Invalid captain key' }, { status: 401 });
    }

    // Captains are subject to the eligibility window; admins bypass it.
    if (isCaptain) {
      const windowCheck = checkMatchWindow(match, { adminOverride: false });
      if (!windowCheck.ok) {
        return NextResponse.json({ error: windowCheck.reason }, { status: 403 });
      }
    }

    const { gameId, reportedWinnerTeamId, notes, attachments = [] } = body;

    const submission = await prisma.matchSubmission.create({
      data: {
        matchId: params.id,
        gameId: gameId || null,
        reportedWinnerTeamId: reportedWinnerTeamId || null,
        notes: notes || null,
        attachments: attachments.length > 0 ? {
          create: attachments.map((a) => ({
            kind: a.kind ?? 'screenshot',
            url: a.url,
            mimeType: a.mimeType || null,
            byteSize: a.byteSize || null,
          })),
        } : undefined,
      },
      include: { attachments: true },
    });

    return NextResponse.json(submission, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to create submission' }, { status: 500 });
  }
}
