import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import prisma from '@/lib/db';
import { requireAdmin } from '@/lib/adminSession';

// POST /api/matches/[id]/games/[gameId]/draft
// Admin action: create a match-bound Draft for a specific game,
// pre-seeded with DraftPick rows from the two teams' active rosters.
export async function POST(req, { params }) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  const { id: matchId, gameId } = params;

  try {
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        homeTeam: {
          include: {
            members: {
              where: { isSub: false, leftAt: null },
              include: { player: true },
            },
          },
        },
        awayTeam: {
          include: {
            members: {
              where: { isSub: false, leftAt: null },
              include: { player: true },
            },
          },
        },
      },
    });

    if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 });

    const game = await prisma.game.findUnique({ where: { id: gameId, matchId } });
    if (!game) return NextResponse.json({ error: 'Game not found' }, { status: 404 });

    const existing = await prisma.draft.findUnique({ where: { gameId } });
    if (existing) {
      return NextResponse.json({ error: 'Draft already exists for this game', draftId: existing.id }, { status: 409 });
    }

    const homeMembers = match.homeTeam.members;
    const awayMembers = match.awayTeam.members;

    const draft = await prisma.$transaction(async (tx) => {
      const created = await tx.draft.create({
        data: {
          name: `${match.homeTeam.name} vs ${match.awayTeam.name} — Game ${game.gameNumber}`,
          gameId,
          captainAKey: randomUUID(),
          captainBKey: randomUUID(),
          adminKey: randomUUID(),
          picks: {
            create: [
              ...homeMembers.map((m, i) => ({
                playerId: m.playerId,
                team: 'A',
                pickOrder: i,
              })),
              ...awayMembers.map((m, i) => ({
                playerId: m.playerId,
                team: 'B',
                pickOrder: i,
              })),
            ],
          },
        },
        include: { picks: true },
      });
      return created;
    });

    return NextResponse.json(draft, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to create draft' }, { status: 500 });
  }
}
