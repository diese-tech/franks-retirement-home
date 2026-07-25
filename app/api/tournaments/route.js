import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET /api/tournaments
// Public index of published tournaments (docs/adr/0003, docs/adr/0006):
// only `live` or `completed`, newest first. `draft` tournaments are
// admin-only setup and never appear here — the same exclusion is also
// enforced per-id in lib/tournamentState.js, since a Tournament's id isn't
// secret.
export async function GET() {
  try {
    const tournaments = await prisma.tournament.findMany({
      where: { status: { in: ['live', 'completed'] } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, status: true, version: true, createdAt: true },
    });
    return NextResponse.json(tournaments);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch tournaments' }, { status: 500 });
  }
}
