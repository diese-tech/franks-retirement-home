// Helpers that treat Draft.usedGodIds as a set instead of a JSON array.
// The schema column is still Json (a long-term migration to a dedicated
// DraftVaultEntry table is documented in issue #15 but out of scope here),
// so these helpers exist to give every writer the same set semantics:
//
//   - addUsedGodId is a no-op if the godId is already present.
//   - removeUsedGodId only removes the godId when nothing else in the
//     draft references it (no other pick has it assigned, no ban has it).
//
// The defensive approach matters because pick + undo + re-pick cycles
// could otherwise leave duplicates in the array or remove a god that's
// still legitimately in use by another concurrent slot.

import prisma from '@/lib/db';

/**
 * Read usedGodIds off a draft row, normalizing to an array regardless of
 * whether the column held null, an empty string, or junk.
 */
export function readUsedGodIds(draft) {
  return Array.isArray(draft?.usedGodIds) ? draft.usedGodIds : [];
}

/**
 * Return a new array with `godId` added (deduplicated). Order preserved.
 */
export function addUsedGodId(existing, godId) {
  if (!godId) return existing;
  if (existing.includes(godId)) return existing;
  return [...existing, godId];
}

/**
 * Return a new array with `godId` removed, BUT only if no other pick or
 * ban inside the same draft still references it. Caller must pass the
 * current set of picks and bans (those it just observed inside its
 * transaction) so the decision is consistent with the snapshot.
 *
 * @param {string[]} existing       Current usedGodIds value.
 * @param {string} godId            God id to remove.
 * @param {object} ctx
 * @param {{ id: string, godId: string|null }[]} ctx.picks   Picks in this draft.
 * @param {{ godId: string }[]} ctx.bans                     Bans in this draft.
 * @param {string} [ctx.excludePickId]                       A pick id to ignore
 *   (typically the pick whose godId is being cleared in the same tx).
 */
export function removeUsedGodId(existing, godId, ctx) {
  if (!godId) return existing;
  if (!existing.includes(godId)) return existing;

  const picks = ctx?.picks ?? [];
  const bans = ctx?.bans ?? [];
  const excludePickId = ctx?.excludePickId;

  const stillPicked = picks.some((p) => p.godId === godId && p.id !== excludePickId);
  const stillBanned = bans.some((b) => b.godId === godId);
  if (stillPicked || stillBanned) return existing;

  return existing.filter((g) => g !== godId);
}

/**
 * Compute the effective vaulted god IDs for a draft.
 *
 * Standalone draft (gameId = null):
 *   Returns draft.usedGodIds — the per-draft vault written by the pick/ban routes.
 *
 * Match-bound draft (gameId != null):
 *   Aggregates godIds from all picks and bans in SIBLING game drafts
 *   (same match, gameNumber < current game) and unions with the current
 *   draft's own usedGodIds. This enforces the league rule that gods are
 *   vaulted across games in a BO3/BO5 series.
 *
 * @param {string} draftId
 * @returns {Promise<string[]>} deduplicated array of vaulted god IDs
 */
export async function getEffectiveVaultedGodIds(draftId) {
  const draft = await prisma.draft.findUnique({
    where: { id: draftId },
    select: { usedGodIds: true, gameId: true },
  });

  if (!draft) return [];

  const ownVault = Array.isArray(draft.usedGodIds) ? draft.usedGodIds : [];

  // Standalone draft: vault is per-draft only.
  if (!draft.gameId) return ownVault;

  // Match-bound draft: aggregate sibling game picks and bans.
  const currentGame = await prisma.game.findUnique({
    where: { id: draft.gameId },
    select: { matchId: true, gameNumber: true },
  });

  if (!currentGame) return ownVault;

  // Find all completed sibling drafts from earlier games in this match.
  const siblingGames = await prisma.game.findMany({
    where: {
      matchId: currentGame.matchId,
      gameNumber: { lt: currentGame.gameNumber },
    },
    select: {
      draft: {
        select: {
          id: true,
          picks: { select: { godId: true } },
          bans:  { select: { godId: true } },
        },
      },
    },
  });

  const siblingGodIds = new Set(ownVault);
  for (const game of siblingGames) {
    if (!game.draft) continue;
    for (const pick of game.draft.picks) {
      if (pick.godId) siblingGodIds.add(pick.godId);
    }
    for (const ban of game.draft.bans) {
      if (ban.godId) siblingGodIds.add(ban.godId);
    }
  }

  return [...siblingGodIds];
}

