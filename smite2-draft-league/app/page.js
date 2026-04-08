import Link from 'next/link';
import prisma from '@/lib/db';
import { STATUS_COLORS } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const drafts = await prisma.draft.findMany({ orderBy: { createdAt: 'desc' } });

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      {/* Hero */}
      <div className="text-center mb-12">
        <h1 className="font-display text-4xl sm:text-5xl font-bold uppercase tracking-wider mb-3">
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-gold-400 to-ember-400">
            Smite 2
          </span>{' '}
          Draft League
        </h1>
        <p className="text-gray-400 font-body text-lg max-w-lg mx-auto">
          Competitive team drafting with real-time balance tracking and penalty enforcement.
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
        <div className="space-y-3">
          {drafts.map((draft) => (
            <Link
              key={draft.id}
              href={`/draft/${draft.id}`}
              className="card flex items-center justify-between hover:border-frost-500/30 transition-all group"
            >
              <div>
                <h3 className="font-display font-semibold text-lg text-gray-200 group-hover:text-frost-400 transition-colors">
                  {draft.name}
                </h3>
                <p className="text-xs text-gray-500 font-mono mt-0.5">
                  {new Date(draft.createdAt).toLocaleDateString('en-US', {
                    month: 'short', day: 'numeric', year: 'numeric',
                  })}
                </p>
              </div>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-display font-bold uppercase tracking-wider border ${STATUS_COLORS[draft.status]}`}>
                {draft.status}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
