import prisma from '@/lib/db';
import DraftClient from './DraftClient';

export const dynamic = 'force-dynamic';

export default async function DraftPage({ params }) {
  const { id } = await params;

  const draft = await prisma.draft.findUnique({ where: { id } });
  if (!draft) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center card">
        <p className="text-red-400 mb-4">Draft not found</p>
        <a href="/" className="btn-secondary text-xs">← Back Home</a>
      </div>
    );
  }

  const picks = await prisma.draftPick.findMany({
    where: { draftId: id },
    include: { player: true, god: true },
    orderBy: { pickOrder: 'asc' },
  });

  const players = await prisma.player.findMany({ orderBy: { pointValue: 'desc' } });
  const gods = await prisma.god.findMany({ orderBy: { name: 'asc' } });

  return (
    <DraftClient
      initialDraft={JSON.parse(JSON.stringify(draft))}
      initialPicks={JSON.parse(JSON.stringify(picks))}
      initialPlayers={JSON.parse(JSON.stringify(players))}
      initialGods={JSON.parse(JSON.stringify(gods))}
    />
  );
}
