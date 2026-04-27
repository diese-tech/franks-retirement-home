import Link from 'next/link';
import prisma from '@/lib/db';
import { STATUS_COLORS } from '@/lib/constants';

export const dynamic = 'force-dynamic';

const BORDER_ACCENT = {
  pending:  'border-yellow-500/60',
  lobby:    'border-blue-500/60',
  banning:  'border-orange-500/60',
  picking:  'border-green-500/60',
  active:   'border-green-500/60',
  complete: 'border-gray-600/60',
};

export default async function HomePage() {
  const drafts = await prisma.draft.findMany({ orderBy: { createdAt: 'desc' } });

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      {/* Hero */}
      <div className="text-center mb-12">
        <h1 className="font-display text-4xl sm:text-5xl font-bold uppercase tracking-wider mb-3">
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-gold-400 to-ember-400">
            Frank's
          </span>{' '}
          Retirement Home
        </h1>
        <p className="text-gray-400 font-body text-lg max-w-lg mx-auto">
          Competitive Smite 2 draft league — real-time bans, picks, and team assembly.
        </p>
      </div>

      {/* Draft List */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-display text-xl font-bold uppercase tracking-wider text-gray-200">
          Drafts
        </h2>
        <Link href="/admin" className="btn-primary text-xs">
          Manage in Admin →
        </Link>
      </div>

      {drafts.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-500 mb-4">No drafts yet. Create one from the Admin panel.</p>
          <Link href="/admin" className="btn-primary">Go to Admin</Link>
        </div>
      ) : (
        <div className="divide-y divide-brand-700/30">
          {drafts.map((draft) => {
            const statusClass = STATUS_COLORS[draft.status] ?? STATUS_COLORS.pending;
            const borderAccent = BORDER_ACCENT[draft.status] ?? 'border-gray-600/60';
            return (
              <Link
                key={draft.id}
                href={`/draft/${draft.id}`}
                className={`group flex items-center gap-5 border-l-4 pl-5 py-4 pr-3 transition-all hover:bg-brand-800/40 ${borderAccent}`}
              >
                <div className="flex-1 min-w-0">
                  <h3 className="font-display font-bold text-lg text-gray-200 group-hover:text-frost-400 transition-colors truncate leading-tight">
                    {draft.name}
                  </h3>
                  <p className="text-[11px] text-gray-600 font-mono mt-0.5">
                    {new Date(draft.createdAt).toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric', year: 'numeric',
                    })}
                  </p>
                </div>
                <span className={`shrink-0 inline-flex items-center px-2.5 py-1 rounded text-[10px] font-display font-bold uppercase tracking-wider border ${statusClass}`}>
                  {draft.status}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
