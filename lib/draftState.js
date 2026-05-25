import prisma from '@/lib/db';
import { getPlayers, getGods } from '@/lib/referenceData';
import { getEffectiveVaultedGodIds } from '@/lib/usedGodIds';

// Returns the full sanitized draft state used by the /state endpoint and
// SSE 'state' frames. Keys are stripped so this is safe to send to any
// client.
//
// Players and gods come from the reference-data cache (issue #8) so a draft
// with many connected SSE viewers does not re-read those rows from the DB
// for every state push.
//
// Chat is included here for compatibility with /api/drafts/[id]/state and
// the initial render. Live chat updates ride on a separate, lighter SSE
// frame produced by buildChatPayload — see issue #8.
export async function buildDraftState(id) {
  const draft = await prisma.draft.findUnique({ where: { id } });
  if (!draft) return null;

  const { captainAKey: _captainAKey, captainBKey: _captainBKey, adminKey: _adminKey, ...safeDraft } = draft;

  const [effectiveVault, picks, bans, chats, players, gods] = await Promise.all([
    getEffectiveVaultedGodIds(id),
    prisma.draftPick.findMany({
      where: { draftId: id },
      include: { player: { select: { id: true, name: true, role: true } }, god: true },
      orderBy: { pickOrder: 'asc' },
    }),
    prisma.draftBan.findMany({
      where: { draftId: id },
      include: { god: true },
      orderBy: { banOrder: 'asc' },
    }),
    prisma.draftChat.findMany({
      where: { draftId: id },
      orderBy: { createdAt: 'asc' },
    }),
    getPlayers(),
    getGods(),
  ]);

  // Gods picked in the current game are live — not in the "previously used" set.
  const currentGamePickedIds = picks.map((pick) => pick.godId).filter(Boolean);
  const previouslyUsedGodIds = effectiveVault.filter((godId) => !currentGamePickedIds.includes(godId));

  // For match-bound drafts, include active team rosters for Lineup Confirmation.
  let rosterA = [];
  let rosterB = [];
  if (draft.gameId) {
    const game = await prisma.game.findUnique({
      where: { id: draft.gameId },
      select: {
        match: {
          select: {
            homeTeamId: true,
            awayTeamId: true,
            homeTeam: {
              select: {
                members: {
                  where: { leftAt: null },
                  include: { player: { select: { id: true, name: true, role: true } } },
                },
              },
            },
            awayTeam: {
              select: {
                members: {
                  where: { leftAt: null },
                  include: { player: { select: { id: true, name: true, role: true } } },
                },
              },
            },
          },
        },
      },
    });
    rosterA = game?.match?.homeTeam?.members ?? [];
    rosterB = game?.match?.awayTeam?.members ?? [];
  }

  return {
    draft: { ...safeDraft, usedGodIds: effectiveVault },
    picks,
    bans,
    chats,
    players,
    gods,
    usedGodIds: effectiveVault,
    previouslyUsedGodIds,
    rosterA,
    rosterB,
  };
}

// Returns a lightweight payload with just the chat history. Used by the SSE
// stream when only Draft.chatsVersion changed, so we don't ship the entire
// state (gods, players, picks, bans) just to deliver a chat message.
export async function buildChatPayload(id) {
  const chats = await prisma.draftChat.findMany({
    where: { draftId: id },
    orderBy: { createdAt: 'asc' },
  });
  return { chats };
}
