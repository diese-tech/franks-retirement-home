/**
 * matchDraftProvisioning.js
 *
 * Creates a match-bound Draft for a specific game, pre-seeded with DraftPick
 * rows from the two teams' active rosters. Idempotent — returns the existing
 * draft if one already exists for the game.
 *
 * Extracted from app/api/matches/[id]/games/[gameId]/draft/route.js so it can
 * be called from the match creation flow (auto-provisioning) as well as the
 * existing admin-only route.
 */

import { randomUUID } from 'node:crypto';
import prisma from '@/lib/db';

/**
 * @param {string} matchId
 * @param {string} gameId
 * @returns {Promise<{ draft: object, created: boolean }>}
 *   `created: false` when the draft already existed (idempotent).
 */
export async function buildDraftForGame(matchId, gameId) {
  // Return early if a draft already exists for this game
  const existing = await prisma.draft.findUnique({ where: { gameId } });
  if (existing) return { draft: existing, created: false };

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
  if (!match) throw new Error(`Match ${matchId} not found`);

  const game = await prisma.game.findUnique({ where: { id: gameId } });
  if (!game || game.matchId !== matchId) throw new Error(`Game ${gameId} not found on match ${matchId}`);

  const homeMembers = match.homeTeam.members;
  const awayMembers = match.awayTeam.members;

  const draft = await prisma.$transaction(async (tx) => {
    // Double-check inside the transaction (race protection)
    const raceCheck = await tx.draft.findUnique({ where: { gameId } });
    if (raceCheck) return raceCheck;

    return tx.draft.create({
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
  });

  return { draft, created: true };
}
