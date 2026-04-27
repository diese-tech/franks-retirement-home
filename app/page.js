import Link from 'next/link';
import prisma from '@/lib/db';
import { STATUS_COLORS } from '@/lib/constants';

export const dynamic = 'force-dynamic';

const BORDER_ACCENT = {
  pending: 'border-yellow-500/60',
  lobby: 'border-blue-500/60',
  banning: 'border-orange-500/60',
  picking: 'border-green-500/60',
  active: 'border-green-500/60',
  complete: 'border-gray-600/60',
};

const HOW_IT_WORKS = [
  { title: 'Load the match', body: 'Admins build both teams, share role links, and the room opens as soon as both rosters are loaded.' },
  { title: 'Ban in order', body: 'Captains take turns through the fixed six-ban sequence with live updates for every connected viewer.' },
  { title: 'Lock the comp', body: 'Teams follow the fixed ten-pick order, and set-wide god restrictions stop repeat picks across the series.' },
];

export default async function HomePage() {
  const drafts = await prisma.draft.findMany({ orderBy: { createdAt: 'desc' } });
  const featuredDrafts = drafts.slice(0, 4);
  const activeDrafts = drafts.filter((draft) => ['lobby', 'banning', 'picking', 'active'].includes(draft.status)).length;
  const completedDrafts = drafts.filter((draft) => draft.status === 'complete').length;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 sm:py-12 space-y-8">
      <section className="relative overflow-hidden rounded-[28px] border border-brand-600/40 bg-brand-800 px-6 py-10 sm:px-10 sm:py-14">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(217,119,6,0.18),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(56,189,248,0.16),transparent_40%)]" />
        <div className="absolute right-4 top-4 hidden lg:grid grid-cols-2 gap-3 w-72">
          <PreviewCard label="League Focus" value="Low-pressure competition" tone="gold" />
          <PreviewCard label="Live Drafts" value={String(activeDrafts)} tone="frost" />
          <PreviewCard label="Series Ready" value="Set-wide god lockouts" tone="ember" />
          <PreviewCard label="Completed" value={String(completedDrafts)} tone="brand" />
        </div>

        <div className="relative max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-gold-500/30 bg-gold-500/10 px-3 py-1 text-[11px] font-display font-bold uppercase tracking-[0.25em] text-gold-300">
            Smite 2 Amateur League
          </div>
          <h1 className="mt-5 font-display text-4xl sm:text-6xl font-bold uppercase tracking-[0.08em] text-gray-100 leading-none">
            Frank&apos;s Retirement Home
          </h1>
          <p className="mt-4 max-w-2xl text-base sm:text-lg text-gray-300">
            A low-skill friendly competitive league where captains can run bans and picks cleanly, spectators can follow live, and every set stays organized.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a href="https://discord.gg/HPAZmHmBpD" target="_blank" rel="noreferrer" className="btn-primary text-xs sm:text-sm">Join the League</a>
            <a href="https://discord.gg/HPAZmHmBpD" target="_blank" rel="noreferrer" className="btn-secondary text-xs sm:text-sm">Discord Info</a>
            <Link href="/admin" className="text-sm font-display font-semibold uppercase tracking-wider text-frost-300 hover:text-frost-200 self-center">
              Manage Drafts
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="card">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="font-display text-xl font-bold uppercase tracking-wider text-gray-100">League Overview</h2>
              <p className="text-sm text-gray-400 mt-1">Built for organized amateur play without adding admin overhead.</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-display font-bold text-gold-300">{drafts.length}</div>
              <div className="text-[11px] uppercase tracking-widest text-gray-500">Draft Rooms Created</div>
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <FeatureCard title="Live Control" body="Role-based links keep admin, captains, and spectators in their own lane." accent="frost" />
            <FeatureCard title="Clear Flow" body="Pending, lobby, bans, picks, and results are visible in one shared room." accent="gold" />
            <FeatureCard title="Set Discipline" body="Previously used gods stay locked, so each game pushes new strategies." accent="ember" />
          </div>
        </div>

        <div className="card">
          <h2 className="font-display text-xl font-bold uppercase tracking-wider text-gray-100">Draft Snapshot</h2>
          <div className="mt-4 space-y-3">
            <StatRow label="Active draft rooms" value={String(activeDrafts)} />
            <StatRow label="Completed drafts" value={String(completedDrafts)} />
            <StatRow label="Draft flow" value="Pending -> Lobby -> Ban -> Pick -> Complete" />
          </div>
        </div>
      </section>

      <section className="card">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-5">
          <div>
            <h2 className="font-display text-xl font-bold uppercase tracking-wider text-gray-100">How It Works</h2>
            <p className="text-sm text-gray-400 mt-1">Simple enough for new players, structured enough for real league nights.</p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {HOW_IT_WORKS.map((item, index) => (
            <div key={item.title} className="rounded-2xl border border-brand-600/30 bg-brand-900/60 p-5">
              <div className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand-700 text-sm font-display font-bold text-gold-300">
                {index + 1}
              </div>
              <h3 className="mt-4 font-display text-lg font-bold uppercase tracking-wider text-gray-100">{item.title}</h3>
              <p className="mt-2 text-sm text-gray-400">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="card">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
            <div>
              <h2 className="font-display text-xl font-bold uppercase tracking-wider text-gray-100">Draft Preview</h2>
              <p className="text-sm text-gray-400 mt-1">Jump straight into the latest rooms.</p>
            </div>
            <Link href="/admin" className="btn-secondary text-xs">Admin Panel</Link>
          </div>

          {featuredDrafts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-brand-600/40 bg-brand-900/50 px-5 py-10 text-center">
              <p className="text-gray-400">No drafts yet. Create the first room from the admin panel.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {featuredDrafts.map((draft) => {
                const statusClass = STATUS_COLORS[draft.status] ?? STATUS_COLORS.pending;
                const borderAccent = BORDER_ACCENT[draft.status] ?? 'border-gray-600/60';
                return (
                  <Link
                    key={draft.id}
                    href={`/draft/${draft.id}`}
                    className={`group flex items-center gap-4 rounded-2xl border border-brand-600/20 bg-brand-900/50 p-4 transition-all hover:bg-brand-900/80 hover:border-brand-500/40 ${borderAccent}`}
                  >
                    <div className="flex-1 min-w-0">
                      <h3 className="font-display font-bold text-lg text-gray-200 group-hover:text-frost-300 truncate">{draft.name}</h3>
                      <p className="text-[11px] text-gray-500 font-mono mt-1">
                        {new Date(draft.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
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

        <div id="join" className="card">
          <h2 className="font-display text-xl font-bold uppercase tracking-wider text-gray-100">Join the League</h2>
          <p className="mt-3 text-sm text-gray-400">
            If you want to play, captain, or help run match nights, start in Discord and get added to the current amateur division.
          </p>
          <div className="mt-5 rounded-2xl border border-gold-500/20 bg-gold-500/10 p-4">
            <div className="text-[11px] font-display font-bold uppercase tracking-[0.22em] text-gold-300">Best Next Step</div>
            <p className="mt-2 text-sm text-gray-300">Ask a league admin for the current Discord invite and your draft-room link.</p>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <a href="https://discord.gg/HPAZmHmBpD" target="_blank" rel="noreferrer" className="btn-primary text-xs sm:text-sm">Join Discord</a>
            <Link href="/admin" className="btn-secondary text-xs sm:text-sm">League Staff</Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function FeatureCard({ title, body, accent }) {
  const accentMap = {
    frost: 'border-frost-500/30 bg-frost-500/10 text-frost-300',
    gold: 'border-gold-500/30 bg-gold-500/10 text-gold-300',
    ember: 'border-ember-500/30 bg-ember-500/10 text-ember-300',
  };

  return (
    <div className="rounded-2xl border border-brand-600/30 bg-brand-900/60 p-4">
      <div className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-display font-bold uppercase tracking-wider ${accentMap[accent]}`}>
        {title}
      </div>
      <p className="mt-3 text-sm text-gray-400">{body}</p>
    </div>
  );
}

function PreviewCard({ label, value, tone }) {
  const toneMap = {
    brand: 'border-brand-500/30 bg-brand-900/80 text-gray-100',
    gold: 'border-gold-500/30 bg-gold-500/10 text-gold-200',
    frost: 'border-frost-500/30 bg-frost-500/10 text-frost-200',
    ember: 'border-ember-500/30 bg-ember-500/10 text-ember-200',
  };

  return (
    <div className={`rounded-2xl border p-4 ${toneMap[tone]}`}>
      <div className="text-[10px] font-display font-bold uppercase tracking-widest opacity-70">{label}</div>
      <div className="mt-2 font-display text-lg font-bold">{value}</div>
    </div>
  );
}

function StatRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-brand-600/30 bg-brand-900/60 px-4 py-3">
      <span className="text-sm text-gray-400">{label}</span>
      <span className="font-display text-sm font-bold uppercase tracking-wider text-gray-200">{value}</span>
    </div>
  );
}
