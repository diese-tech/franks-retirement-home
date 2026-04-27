import prisma from '@/lib/db';

// Returns the full sanitized draft state used by SSE and the /state endpoint.
// Keys are stripped so this is safe to send to any client.
export async function buildDraftState(id) {
  const draft = await prisma.draft.findUnique({ where: { id } });
  if (!draft) return null;

  const { captainAKey, captainBKey, adminKey, ...safeDraft } = draft;

  const [picks, bans, chats, players, gods] = await Promise.all([
    prisma.draftPick.findMany({
      where: { draftId: id },
      include: { player: true, god: true },
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
    prisma.player.findMany({ orderBy: { name: 'asc' } }),
    prisma.god.findMany({ orderBy: { name: 'asc' } }),
  ]);

  return { draft: safeDraft, picks, bans, chats, players, gods };
}
