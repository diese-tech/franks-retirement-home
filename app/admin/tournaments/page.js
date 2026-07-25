'use client';

// List + create screen for the Tournament admin editor (docs/adr/0006 — the
// admin editor is its own route tree under /admin, split from the public
// /tournaments viewer). Unlike the public list, this shows every Tournament
// regardless of status (draft included) since setup happens here.
//
// This page talks directly to the admin API (workstream B,
// app/api/admin/tournaments/route.js) rather than reading via Prisma in a
// server component: the create form needs client interactivity in the same
// file as the list, and this repo's admin sub-panels (e.g. the change
// requests / superlatives panels in app/admin/AdminClient.js) already follow
// the "client component fetches its own API route" pattern for exactly this
// shape of screen. GET on the collection route isn't spelled out in the
// Phase 1 contract explicitly, but every sibling admin collection route in
// this codebase (drafts, player-drafts, change-requests, superlatives) pairs
// GET-list with POST-create on the same route file, so this assumes B does
// the same here.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { RetroWindow, BrutalButton, PixelBadge } from '@/components/ui';
import PasswordGate from '../PasswordGate';

const STATUS_COLOR = { draft: 'gray', live: 'lime', completed: 'cream' };

// Mirrors app/api/admin/tournaments/route.js's MAX_PARTICIPANTS — kept in
// sync manually since this is a client bundle and that constant lives in a
// server route module. The server is still the source of truth; this is
// only used for the live hint below.
const MAX_PARTICIPANTS = 128;

// Mirrors lib/bracketEngine.js's generateBracket() validation, reimplemented
// here (rather than imported) so this client bundle doesn't pull in that
// module's Node `crypto` import. Only used for a live hint in the create
// form — the server is still the source of truth for this check.
function isPowerOfTwo(n) {
  return Number.isInteger(n) && n >= 2 && (n & (n - 1)) === 0;
}

function nextPowerOfTwo(n) {
  let p = 2;
  while (p < n) p *= 2;
  return p;
}

export default function TournamentsListPage() {
  const router = useRouter();
  const [tournaments, setTournaments] = useState(null); // null = loading
  const [needsAuth, setNeedsAuth] = useState(false);
  const [loadError, setLoadError] = useState('');

  const [name, setName] = useState('');
  const [namesText, setNamesText] = useState('');
  const [createErr, setCreateErr] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoadError('');
    try {
      const res = await fetch('/api/admin/tournaments', { credentials: 'same-origin' });
      if (res.status === 401) { setNeedsAuth(true); return; }
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setLoadError(data?.error || `Failed to load tournaments (${res.status})`);
        return;
      }
      setTournaments(Array.isArray(data) ? data : (data?.tournaments ?? []));
    } catch {
      setLoadError('Could not reach the server. Is the API up?');
    }
  };

  useEffect(() => { load(); }, []);

  const namesEntered = namesText
    .split('\n')
    .map((n) => n.trim())
    .filter((n) => n.length > 0);
  const participantCountValid =
    namesEntered.length >= 2 && namesEntered.length <= MAX_PARTICIPANTS && isPowerOfTwo(namesEntered.length);

  const create = async () => {
    setCreateErr('');
    const participantNames = namesEntered;

    if (!name.trim()) { setCreateErr('Name is required.'); return; }
    if (participantNames.length < 2) { setCreateErr('Enter at least two participant names, one per line.'); return; }

    setBusy(true);
    try {
      const res = await fetch('/api/admin/tournaments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ name: name.trim(), participantNames }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setCreateErr(data?.error || `Could not create tournament (${res.status})`);
        return;
      }
      const created = data?.tournament ?? data;
      if (created?.id) {
        router.push(`/admin/tournaments/${created.id}`);
      } else {
        setName('');
        setNamesText('');
        await load();
      }
    } catch {
      setCreateErr('Could not reach the server. Is the API up?');
    } finally {
      setBusy(false);
    }
  };

  if (needsAuth) return <PasswordGate />;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <Link href="/admin" className="text-xs text-gray-500 hover:text-frh-yellow font-ui uppercase tracking-wide">&larr; Admin</Link>
      </div>

      <RetroWindow title="TOURNAMENTS" titleBarColor="yellow">
        {loadError && (
          <div className="border-2 border-red-700 bg-red-900/20 p-3 mb-4">
            <p className="font-mono text-xs text-red-300">{loadError}</p>
            <button onClick={load} className="font-ui text-[10px] uppercase text-frh-yellow underline mt-1">Retry</button>
          </div>
        )}

        {tournaments === null && !loadError && (
          <p className="font-mono text-xs text-gray-500">Loading tournaments&hellip;</p>
        )}

        {tournaments !== null && tournaments.length === 0 && (
          <p className="font-mono text-xs text-gray-500 mb-2">No tournaments yet. Create one below.</p>
        )}

        {tournaments !== null && tournaments.length > 0 && (
          <div className="space-y-2 mb-2">
            {tournaments.map((t) => (
              <Link
                key={t.id}
                href={`/admin/tournaments/${t.id}`}
                className="flex items-center justify-between gap-3 border-2 border-frh-border p-3 hover:border-frh-yellow transition-colors"
              >
                <div className="min-w-0">
                  <p className="font-ui text-sm text-frh-text truncate">{t.name}</p>
                  <p className="font-mono text-[10px] text-gray-500">
                    {(t.participants?.length ?? t.participantCount ?? null) !== null
                      ? `${t.participants?.length ?? t.participantCount} participants · `
                      : ''}
                    {t.createdAt ? new Date(t.createdAt).toLocaleDateString() : ''}
                  </p>
                </div>
                <PixelBadge label={t.status} color={STATUS_COLOR[t.status] ?? 'gray'} />
              </Link>
            ))}
          </div>
        )}
      </RetroWindow>

      <RetroWindow title="CREATE TOURNAMENT" titleBarColor="blue">
        <div className="space-y-3">
          <div>
            <label className="block text-[10px] font-ui uppercase text-gray-600 mb-1">Name</label>
            <input
              className="input-field w-full"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Season 4 Gauntlet"
            />
          </div>
          <div>
            <label className="block text-[10px] font-ui uppercase text-gray-600 mb-1">
              Participant names (one per line — pad with literal &quot;BYE&quot; entries to reach a power of 2)
            </label>
            <textarea
              className="input-field w-full font-mono text-xs"
              rows={8}
              value={namesText}
              onChange={(e) => setNamesText(e.target.value)}
              placeholder={'Team Alpha\nTeam Bravo\nTeam Charlie\nBYE'}
            />
            {namesEntered.length === 1 && (
              <p className="font-mono text-[10px] text-gray-500 mt-1">Enter at least two participant names.</p>
            )}
            {namesEntered.length >= 2 && (
              participantCountValid ? (
                <p className="font-mono text-[10px] text-frh-lime mt-1">
                  {namesEntered.length} participants — ready.
                </p>
              ) : namesEntered.length > MAX_PARTICIPANTS ? (
                <p className="font-mono text-[10px] text-red-400 mt-1">
                  {namesEntered.length} participants — exceeds the {MAX_PARTICIPANTS}-participant maximum. Remove {namesEntered.length - MAX_PARTICIPANTS} to continue.
                </p>
              ) : (
                <p className="font-mono text-[10px] text-orange-400 mt-1">
                  {namesEntered.length} participants — not a power of 2. Add {nextPowerOfTwo(namesEntered.length) - namesEntered.length} more
                  {' '}(e.g. &quot;BYE&quot;) to reach {nextPowerOfTwo(namesEntered.length)}, or remove some.
                </p>
              )
            )}
          </div>
          {createErr && <p className="font-mono text-xs text-red-400">{createErr}</p>}
          <BrutalButton onClick={create} disabled={busy || !name.trim() || !participantCountValid}>
            {busy ? 'Creating…' : 'Create Tournament'}
          </BrutalButton>
        </div>
      </RetroWindow>
    </div>
  );
}
