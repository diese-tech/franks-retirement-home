import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireAdmin } from '@/lib/adminSession';

export const dynamic = 'force-dynamic';

// GET /api/submissions?status=open — admin: list pending/in_review submissions
export async function GET(req) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  const { searchParams } = new URL(req.url);
  const statusFilter = searchParams.get('status');

  const where = statusFilter === 'open'
    ? { status: { in: ['pending', 'in_review'] } }
    : {};

  try {
    const submissions = await prisma.matchSubmission.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      include: {
        attachments: { select: { id: true, kind: true, url: true } },
        match: {
          select: {
            id: true,
            week: true,
            homeTeam: { select: { id: true, name: true, tag: true } },
            awayTeam: { select: { id: true, name: true, tag: true } },
          },
        },
        game: { select: { id: true, gameNumber: true } },
      },
    });
    return NextResponse.json(submissions);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch submissions' }, { status: 500 });
  }
}
