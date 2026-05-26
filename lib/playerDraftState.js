import prisma from '@/lib/db';
import { buildPlayerDraftFormat, getFirstDraftTurn, getNextDraftTurn, totalPicks, currentPickTeam } from '@/lib/playerDraftOrder';

// Builds the full PlayerDraft state object sent to clients.
// Does not expose adminKey.
export async function buildPlayerDraftState(id) {
  const draft = await prisma.playerDraft.findUnique({
    where: { id },
    include: {
      season:   { select: { id: true, name: true, slug: true } },
      division: { select: { id: true, name: true } },
      picks: {
        orderBy: { pickNumber: 'asc' },
        include: {
          team:   { select: { id: true, name: true, tag: true } },
          player: { select: { id: true, name: true, role: true, discordUsername: true, secondaryRoles: true } },
        },
      },
    },
  });

  if (!draft) return null;

  const { adminKey: _ak, ...safeDraft } = draft;

  const currentOrder = Array.isArray(safeDraft.currentOrder) ? safeDraft.currentOrder : [];
  const format = buildPlayerDraftFormat(currentOrder, safeDraft.rounds);
  const total = totalPicks(format);

  let currentTurn = null;
  let secondsRemaining = null;

  if (safeDraft.status === 'active' && safeDraft.currentPickIndex < total) {
    currentTurn = getFirstDraftTurn(format);
    // Fast-forward cursor to currentPickIndex
    let turn = currentTurn;
    for (let i = 0; i < safeDraft.currentPickIndex && turn; i++) {
      turn = getNextDraftTurn(format, turn.phaseIndex, turn.stepIndex);
    }
    currentTurn = turn;

    if (safeDraft.pickTimerSeconds > 0 && safeDraft.pickStartedAt) {
      const elapsed = Math.floor((Date.now() - new Date(safeDraft.pickStartedAt).getTime()) / 1000);
      secondsRemaining = Math.max(0, safeDraft.pickTimerSeconds - elapsed);
    }
  }

  const currentTeamId = currentTurn ? currentPickTeam(format, currentTurn.phaseIndex, currentTurn.stepIndex) : null;

  // Eligible players: all players in the draft's division who haven't been picked yet
  const pickedPlayerIds = new Set(safeDraft.picks.map((p) => p.playerId));
  const eligiblePlayers = await prisma.player.findMany({
    where: {
      division: safeDraft.division.name,
      id: { notIn: [...pickedPlayerIds] },
    },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, role: true, discordUsername: true, secondaryRoles: true, timezone: true },
  });

  return {
    draft: safeDraft,
    format,
    total,
    currentTurn,
    currentTeamId,
    secondsRemaining,
    picks: safeDraft.picks,
    eligiblePlayers,
  };
}
