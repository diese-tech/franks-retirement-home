import prisma from '@/lib/db';
import { notFound } from 'next/navigation';
import AdminClient from './AdminClient';
import PasswordGate from '../../PasswordGate';
import { isAdminFromCookies } from '@/lib/serverAuth';

// Detail/edit screen for a single Tournament (docs/adr/0006 — admin editor
// lives under /admin, separate from the /tournaments viewer route tree).
// Mirrors app/admin/games/[id]/stats/page.js: a server component gate +
// direct Prisma read (independent of workstream B's admin API for the read
// path), handing serialized data to a client component that performs all
// mutations against workstream B's PATCH /api/admin/tournaments/[id].

export const dynamic = 'force-dynamic';

export default async function TournamentAdminPage({ params }) {
  let isAdmin = false;
  try { isAdmin = isAdminFromCookies(); } catch { /* cookies() may throw outside request context */ }
  if (!isAdmin) return <PasswordGate />;

  const tournament = await prisma.tournament.findUnique({
    where: { id: params.id },
    include: {
      participants: { orderBy: { seed: 'asc' } },
      matches: { orderBy: [{ round: 'asc' }, { position: 'asc' }] },
    },
  });

  if (!tournament) notFound();

  return <AdminClient tournament={JSON.parse(JSON.stringify(tournament))} />;
}
