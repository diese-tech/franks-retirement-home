'use client';

import { useState } from 'react';
import Link from 'next/link';
import RetroWindow from '@/components/ui/RetroWindow';
import BrutalButton from '@/components/ui/BrutalButton';
import StatusBadge from '@/components/ui/StatusBadge';
import PortalTabBar from '@/components/ui/PortalTabBar';
import RightRailWidget from '@/components/ui/RightRailWidget';

const TABS = [
  { id: 'drafts', label: 'Drafts' },
  { id: 'how-it-works', label: 'How It Works' },
  { id: 'about', label: 'About' },
];

const HOW_IT_WORKS = [
  {
    num: '01',
    title: 'Admin Creates a Draft',
    body: 'Set the teams, generate the links, try not to lose them.',
  },
  {
    num: '02',
    title: 'Captains Ban & Pick',
    body: 'Six bans. Ten picks. Snake order. No pressure. (Some pressure.)',
  },
  {
    num: '03',
    title: 'Everyone Argues',
    body: 'Post-draft analysis in the Discord. Classic league behavior.',
  },
];

export default function HomepageClient({
  featuredDrafts,
  totalCount,
  activeDrafts,
  completedDrafts,
  playerCount,
  godCount,
}) {
  const [activeTab, setActiveTab] = useState('drafts');

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Portal header */}
      <div className="border-b-[3px] border-frh-yellow pb-6">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
          <div>
            <h1 className="font-display text-4xl sm:text-5xl font-bold uppercase text-frh-yellow leading-tight">
              Frank&apos;s Retirement Home
            </h1>
            <p className="mt-2 text-sm font-body text-frh-cream">
              Low skill. High commitment. Questionable picks.
            </p>
          </div>
          <div className="flex gap-3 shrink-0">
            <StatBox number={activeDrafts} label="Active Drafts" />
            <StatBox number={playerCount} label="Players" />
            <StatBox number={godCount} label="Gods" />
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <PortalTabBar tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />

      {/* Main + right rail */}
      <div className="mt-6 flex flex-col lg:flex-row gap-6">
        {/* Main content */}
        <div className="flex-1 min-w-0 space-y-4">
          {activeTab === 'drafts' && <DraftsTab drafts={featuredDrafts} />}
          {activeTab === 'how-it-works' && <HowItWorksTab />}
          {activeTab === 'about' && <AboutTab />}
        </div>

        {/* Right rail */}
        <div className="hidden lg:flex flex-col gap-4 w-56 shrink-0">
          <RightRailWidget title="QUICK LINKS">
            <div className="space-y-2">
              <a
                href="https://discord.gg/HPAZmHmBpD"
                target="_blank"
                rel="noreferrer"
                className="block text-frh-xp-blue hover:text-frh-yellow text-xs font-ui uppercase tracking-wide transition-colors"
              >
                → Join Discord
              </a>
              <Link
                href="/admin"
                className="block text-frh-xp-blue hover:text-frh-yellow text-xs font-ui uppercase tracking-wide transition-colors"
              >
                → Admin Panel
              </Link>
            </div>
          </RightRailWidget>

          <RightRailWidget title="WHAT IS FRH?">
            <p className="text-xs font-body text-frh-cream leading-relaxed">
              FRH is a beer-league Smite 2 draft site. Nobody knows the meta. That&apos;s the point.
            </p>
          </RightRailWidget>

          <RightRailWidget title="LEAGUE STATS">
            <div className="space-y-2">
              <StatRow label="Total Drafts" value={totalCount} color="text-frh-yellow" />
              <StatRow label="Active" value={activeDrafts} color="text-frh-lime" />
              <StatRow label="Completed" value={completedDrafts} color="text-gray-400" />
            </div>
          </RightRailWidget>
        </div>
      </div>
    </div>
  );
}

function StatBox({ number, label }) {
  return (
    <div className="border-2 border-gray-700 bg-brand-800 px-4 py-3 text-center shadow-[4px_4px_0px_rgba(0,0,0,0.5)]">
      <div className="font-mono text-2xl font-bold text-frh-yellow">{number}</div>
      <div className="text-[10px] font-ui uppercase tracking-widest text-gray-500 mt-0.5">{label}</div>
    </div>
  );
}

function StatRow({ label, value, color }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-[10px] font-ui uppercase tracking-wider text-gray-500">{label}</span>
      <span className={`font-mono text-sm ${color}`}>{value}</span>
    </div>
  );
}

function DraftsTab({ drafts }) {
  return (
    <RetroWindow title="ACTIVE SESSIONS">
      {drafts.length === 0 ? (
        <p className="text-sm font-body text-gray-500 text-center py-6">
          No active drafts. Create one or stare at this page.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left text-[10px] font-ui uppercase tracking-widest text-gray-500 pb-2 pr-4 font-normal">
                  Status
                </th>
                <th className="text-left text-[10px] font-ui uppercase tracking-widest text-gray-500 pb-2 pr-4 font-normal">
                  Draft Name
                </th>
                <th className="text-right text-[10px] font-ui uppercase tracking-widest text-gray-500 pb-2 font-normal">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {drafts.map((draft) => (
                <tr key={draft.id} className="border-b border-gray-800 last:border-0">
                  <td className="py-3 pr-4">
                    <StatusBadge status={draft.status} />
                  </td>
                  <td className="py-3 pr-4">
                    <span className="font-body text-sm text-gray-200">{draft.name}</span>
                    <span className="block font-mono text-[10px] text-gray-600 mt-0.5">
                      {new Date(draft.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  </td>
                  <td className="py-3 text-right">
                    <BrutalButton href={`/draft/${draft.id}`} variant="primary" size="sm">
                      View Draft
                    </BrutalButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </RetroWindow>
  );
}

function HowItWorksTab() {
  return (
    <div className="space-y-4">
      {HOW_IT_WORKS.map((step) => (
        <RetroWindow key={step.num} title={`${step.num} · ${step.title.toUpperCase()}`}>
          <p className="text-sm font-body text-gray-300">{step.body}</p>
        </RetroWindow>
      ))}
    </div>
  );
}

function AboutTab() {
  return (
    <RetroWindow title="ABOUT FRH">
      <div className="space-y-3">
        <p className="text-sm font-body text-gray-300">
          Frank&apos;s Retirement Home is a beer-league Smite 2 draft site for a friend group amateur
          league. Captains run bans and picks through role-based links, spectators can follow live,
          and every set stays organized.
        </p>
        <p className="text-sm font-body text-gray-300">
          No one knows the meta. That&apos;s the point.
        </p>
      </div>
    </RetroWindow>
  );
}
