import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireAdmin } from '@/lib/adminSession';

export const dynamic = 'force-dynamic';

// GET /api/matches/[id]/submissions — admin: list all submissions for a match
export async function GET(req, { params }) {
  const authError = await requireAdmin(req);
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
// Body: { gameId?, reportedWinnerTeamId?, notes?, attachments?: [{ url, kind, mimeType?, byteSize? }] }
export async function POST(req, { params }) {
  const captainKey = req.headers.get('x-captain-key');
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });

  try {
    const match = await prisma.match.findUnique({
      where: { id: params.id },
      select: { id: true, homeTeamCaptainKey: true, awayTeamCaptainKey: true, status: true },
    });
    if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 });

    // Verify captain key (or admin can also submit)
    const isAdminReq = !captainKey;
    if (!isAdminReq) {
      const adminErr = await requireAdmin(req);
      const isCaptain = captainKey === match.homeTeamCaptainKey || captainKey === match.awayTeamCaptainKey;
      if (!isCaptain && adminErr) {
        return NextResponse.json({ error: 'Invalid captain key' }, { status: 401 });
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
