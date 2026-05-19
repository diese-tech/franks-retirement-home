import prisma from '@/lib/db';
import AdminClient from './AdminClient';
import { PUBLIC_DRAFT_SELECT } from '@/lib/draftSelect';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const players = await prisma.player.findMany({ orderBy: { name: 'asc' } });
  const gods = await prisma.god.findMany({ orderBy: { name: 'asc' } });
  // Drafts are loaded with PUBLIC_DRAFT_SELECT so the *Key fields never appear
  // in the SSR HTML or `__NEXT_DATA__`. The share modal fetches keys on
  // demand from the authenticated /api/drafts/admin endpoint.
  const drafts = await prisma.draft.findMany({
    orderBy: { createdAt: 'desc' },
    select: PUBLIC_DRAFT_SELECT,
  });

  return (
    <AdminClient
      initialPlayers={JSON.parse(JSON.stringify(players))}
      initialGods={JSON.parse(JSON.stringify(gods))}
      initialDrafts={JSON.parse(JSON.stringify(drafts))}
    />
  );
}
