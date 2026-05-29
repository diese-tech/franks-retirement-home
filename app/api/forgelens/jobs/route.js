import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { resolveAdminAuth } from '@/lib/resolveAuth';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

// GET /api/forgelens/jobs — admin: list OCR extractions
export async function GET(req) {
  const authError = await resolveAdminAuth(req);
  if (authError) return authError;

  const { searchParams } = new URL(req.url);
  const gameId = searchParams.get('gameId');
  const status = searchParams.get('status');

  const where = {};
  if (gameId) where.gameId = gameId;
  if (status) where.status = status;

  const jobs = await prisma.ocrExtraction.findMany({
    where,
    orderBy: { requestedAt: 'desc' },
    take: 50,
    include: {
      rows: { select: { id: true, ignRaw: true, status: true, kills: true, deaths: true, assists: true } },
      game: { select: { gameNumber: true, match: { select: { week: true, homeTeam: { select: { tag: true } }, awayTeam: { select: { tag: true } } } } } },
    },
  });

  return NextResponse.json(jobs);
}

// POST /api/forgelens/jobs — admin: submit a screenshot for OCR
// Body: { attachmentUrl, mimeType?, gameId?, submissionId?, attachmentChecksum? }
// Creates an OcrExtraction row and POSTs a job request to ForgeLens.
// The ForgeLens endpoint is configured via FORGELENS_URL env var.
// Returns the created OcrExtraction row immediately (job is async).
export async function POST(req) {
  const authError = await resolveAdminAuth(req);
  if (authError) return authError;

  let body;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { attachmentUrl, mimeType, gameId, submissionId, attachmentChecksum } = body;
  if (!attachmentUrl) return NextResponse.json({ error: 'attachmentUrl is required' }, { status: 400 });

  const extraction = await prisma.ocrExtraction.create({
    data: {
      attachmentUrl,
      mimeType: mimeType || null,
      gameId: gameId || null,
      submissionId: submissionId || null,
      attachmentChecksum: attachmentChecksum || null,
      status: 'pending',
    },
  });

  // If FORGELENS_URL is configured, dispatch the job to ForgeLens.
  // If not, job stays 'pending' and can be resubmitted later or handled manually.
  const forgeLensUrl = process.env.FORGELENS_URL;
  if (forgeLensUrl) {
    const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/api/forgelens/callback`;
    try {
      await fetch(`${forgeLensUrl}/jobs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.FORGELENS_API_KEY ?? ''}`,
        },
        body: JSON.stringify({
          jobId: extraction.id,
          callbackUrl,
          attachmentUrl,
          attachmentChecksum: attachmentChecksum || null,
          mimeType: mimeType || 'image/png',
          context: { gameId, submissionId },
        }),
      });
      await prisma.ocrExtraction.update({
        where: { id: extraction.id },
        data: { status: 'processing' },
      });
    } catch {
      // ForgeLens unreachable — job stays 'pending', admin can retry later
    }
  }

  logAudit('OcrExtraction', extraction.id, 'job_submitted', { payload: { gameId, submissionId } });
  return NextResponse.json(extraction, { status: 201 });
}
