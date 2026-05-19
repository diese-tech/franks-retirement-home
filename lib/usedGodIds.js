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
