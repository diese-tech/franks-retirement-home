import prisma from '@/lib/db';

const getTeamCounts = (picks) => ({
  A: picks.filter((pick) => pick.team === 'A').length,
  B: picks.filter((pick) => pick.team === 'B').length,
});

export const teamsAreLoaded = (picks) => {
  const counts = getTeamCounts(picks);
  return counts.A > 0 && counts.B > 0;
};

export async function syncDraftLobbyState(draftId) {
  const [draft, picks] = await Promise.all([
    prisma.draft.findUnique({
      where: { id: draftId },
      select: { id: true, status: true, captainAReady: true, captainBReady: true },
    }),
    prisma.draftPick.findMany({
      where: { draftId },
      select: { team: true },
    }),
  ]);

  if (!draft) return null;

  const loaded = teamsAreLoaded(picks);

  if (draft.status === 'pending' && loaded) {
    return prisma.draft.update({
      where: { id: draftId },
      data: {
        status: 'lobby',
        captainAReady: false,
        captainBReady: false,
        version: { increment: 1 },
      },
    });
  }

  if (draft.status === 'lobby' && !loaded) {
    return prisma.draft.update({
      where: { id: draftId },
      data: {
        status: 'pending',
        captainAReady: false,
        captainBReady: false,
        version: { increment: 1 },
      },
    });
  }

  return draft;
}
