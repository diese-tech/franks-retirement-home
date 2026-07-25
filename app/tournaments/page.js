import Link from 'next/link';
import prisma from '@/lib/db';
import { RetroWindow, PixelBadge } from '@/components/ui';

// Viewer index of published tournaments. Per ADR-0003/0006: only `live` and
// `completed` tournaments are ever listed here — `draft` tournaments are
// admin-only setup and never appear, so an empty list reads as "nothing
// live right now," not an error state. Completed tournaments stay visible
// (ADR-0003's retro league-history flavor), newest first.
export const dynamic = 'force-dynamic';

const STATUS_COLOR = {
  live: 'lime',
  completed: 'purple',
};

function TournamentRow({ tournament }) {
  return (
    <Link href={`/tournaments/${tournament.id}`} className="block group">
      <div className="border-2 border-frh-border group-hover:border-frh-yellow/50 transition-colors p-3 bg-frh-surface/40">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="font-ui text-sm text-frh-text group-hover:text-frh-yellow transition-colors flex-1 min-w-0 truncate">
            {tournament.name}
          </span>
          <PixelBadge
            label={tournament.status}
            color={STATUS_COLOR[tournament.status] ?? 'gray'}
          />
          <span className="text-[10px] text-frh-text-muted font-mono shrink-0">
            {new Date(tournament.createdAt).toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
          </span>
        </div>
      </div>
    </Link>
  );
}

export default async function TournamentsPage() {
  let tournaments = [];
  let dbError = false;

  try {
    tournaments = await prisma.tournament.findMany({
      where: { status: { in: ['live', 'completed'] } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, status: true, createdAt: true },
    });
  } catch (err) {
    console.error('[tournaments]', err);
    dbError = true;
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <RetroWindow title="TOURNAMENTS.EXE" titleBarColor="yellow">
        {dbError ? (
          <div className="text-center py-12">
            <p className="text-sm text-frh-text-muted mb-4">
              Unable to load tournaments. Database may be unreachable.
            </p>
            <a href="/" className="text-xs font-ui text-frh-yellow hover:underline uppercase tracking-widest">
              &larr; Home
            </a>
          </div>
        ) : tournaments.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm text-frh-text-muted">Nothing live right now.</p>
            <p className="text-[11px] text-frh-text-muted mt-1">
              Check back once a tournament is published.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {tournaments.map((t) => (
              <TournamentRow key={t.id} tournament={t} />
            ))}
          </div>
        )}
      </RetroWindow>
    </div>
  );
}
