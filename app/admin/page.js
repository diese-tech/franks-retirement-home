import prisma from '@/lib/db';
import AdminClient from './AdminClient';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const players = await prisma.player.findMany({ orderBy: { name: 'asc' } });
  const gods = await prisma.god.findMany({ orderBy: { name: 'asc' } });
  const drafts = await prisma.draft.findMany({ orderBy: { createdAt: 'desc' } });

  return (
    <AdminClient
      initialPlayers={JSON.parse(JSON.stringify(players))}
      initialGods={JSON.parse(JSON.stringify(gods))}
      initialDrafts={JSON.parse(JSON.stringify(drafts))}
    />
  );
}
