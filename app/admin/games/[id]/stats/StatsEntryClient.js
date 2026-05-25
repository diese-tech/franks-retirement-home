'use client';

import { useState } from 'react';
import Link from 'next/link';
import { RetroWindow, BrutalButton, PixelBadge } from '@/components/ui';
import { PLAYER_ROLES, ROLE_COLORS } from '@/lib/constants';

const STAT_FIELDS = ['kills', 'deaths', 'assists', 'damage', 'healing', 'gold'];

function emptyForm(playerId, teamId, role) {
  return { playerId, teamId, role: role ?? '', godId: '', kills: '', deaths: '', assists: '', damage: '', healing: '', gold: '', notes: '' };
}

function StatRow({ stat }) {
  return (
    <tr className="border-b border-brand-700/30 hover:bg-brand-700/10 transition-colors">
      <td className="py-2 px-2 font-display font-medium text-sm text-gray-300">{stat.player?.name}</td>
      <td className="py-2 px-2 text-[10px] text-gray-500">{stat.team?.tag}</td>
      <td className="py-2 px-2 text-xs text-gray-400">{stat.god?.name ?? '—'}</td>
      <td className="py-2 px-2 text-center font-mono text-xs text-green-400">{stat.kills}</td>
      <td className="py-2 px-2 text-center font-mono text-xs text-red-400">{stat.deaths}</td>
      <td className="py-2 px-2 text-center font-mono text-xs text-blue-400">{stat.assists}</td>
      <td className="py-2 px-2 text-center font-mono text-xs text-gray-400 hidden sm:table-cell">{stat.damage.toLocaleString()}</td>
      <td className="py-2 px-2 text-center font-mono text-xs text-gray-400 hidden sm:table-cell">{stat.gold.toLocaleString()}</td>
    </tr>
  );
}

export default function StatsEntryClient({ game, gods }) {
  const match = game.match;
  const [stats, setStats] = useState(game.statLines ?? []);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const allMembers = [
    ...(match.homeTeam?.members ?? []).map((m) => ({ ...m, teamId: match.homeTeamId, teamTag: match.homeTeam.tag })),
    ...(match.awayTeam?.members ?? []).map((m) => ({ ...m, teamId: match.awayTeamId, teamTag: match.awayTeam.tag })),
  ];

  const openForm = (member) => {
    const existing = stats.find((s) => s.playerId === member.player.id);
    if (existing) {
      setForm({
        playerId: existing.playerId,
        teamId: existing.teamId,
        role: existing.role ?? member.player.role ?? '',
        godId: existing.godId ?? '',
        kills: String(existing.kills),
        deaths: String(existing.deaths),
        assists: String(existing.assists),
        damage: String(existing.damage),
        healing: String(existing.healing),
        gold: String(existing.gold),
        notes: existing.notes ?? '',
      });
    } else {
      setForm(emptyForm(member.player.id, member.teamId, member.player.role));
    }
    setErr('');
  };

  const save = async () => {
    if (!form?.playerId) return;
    setErr('');
    setBusy(true);
    const res = await fetch(`/api/games/${game.id}/stats`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) { setErr(data.error ?? 'Failed to save'); return; }
    // merge into local stats
    setStats((prev) => {
      const next = prev.filter((s) => s.playerId !== form.playerId);
      return [...next, data];
    });
    setForm(null);
  };

  const remove = async (playerId) => {
    if (!confirm('Remove this stat line?')) return;
    const res = await fetch(`/api/games/${game.id}/stats?playerId=${playerId}`, { method: 'DELETE' });
    if (res.ok) setStats((prev) => prev.filter((s) => s.playerId !== playerId));
  };

  const hasStats = (playerId) => stats.some((s) => s.playerId === playerId);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <Link href="/admin" className="text-xs text-gray-500 hover:text-frh-yellow font-ui uppercase tracking-wide">← Admin</Link>
      </div>

      <RetroWindow title={`GAME ${game.gameNumber} STATS — ${match.homeTeam?.tag ?? '?'} vs ${match.awayTeam?.tag ?? '?'}`} titleBarColor="yellow">
        <div className="flex items-center gap-3 mb-4">
          <span className="font-ui text-xs text-gray-400">Week {match.week} · {match.homeTeam?.name} vs {match.awayTeam?.name}</span>
          {game.winnerTeamId && (
            <PixelBadge
              label={`Winner: ${game.winnerTeamId === match.homeTeamId ? match.homeTeam?.tag : match.awayTeam?.tag}`}
              color="lime"
            />
          )}
        </div>

        {/* Existing stats */}
        {stats.length > 0 && (
          <div className="mb-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] font-ui uppercase tracking-widest text-gray-600 border-b border-brand-700">
                  <th className="text-left py-1.5 px-2">Player</th>
                  <th className="text-left py-1.5 px-2">Team</th>
                  <th className="text-left py-1.5 px-2">God</th>
                  <th className="text-center py-1.5 px-2">K</th>
                  <th className="text-center py-1.5 px-2">D</th>
                  <th className="text-center py-1.5 px-2">A</th>
                  <th className="text-center py-1.5 px-2 hidden sm:table-cell">Dmg</th>
                  <th className="text-center py-1.5 px-2 hidden sm:table-cell">Gold</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((s) => <StatRow key={s.id} stat={s} />)}
              </tbody>
            </table>
          </div>
        )}

        {/* Player roster buttons */}
        <div className="mb-4">
          <p className="text-[10px] font-ui uppercase text-gray-600 mb-2">Select a player to enter/edit stats:</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {allMembers.map((m) => (
              <button
                key={m.player.id}
                onClick={() => openForm(m)}
                className={[
                  'flex items-center gap-2 px-2 py-2 border-2 text-left transition-colors',
                  form?.playerId === m.player.id
                    ? 'border-frh-yellow bg-frh-yellow/10'
                    : hasStats(m.player.id)
                    ? 'border-green-600/50 hover:border-frh-yellow/50'
                    : 'border-brand-700 hover:border-brand-500',
                ].join(' ')}
              >
                <div className="flex-1 min-w-0">
                  <div className="font-display font-medium text-xs text-gray-300 truncate">{m.player.name}</div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className={`text-[9px] font-display font-bold uppercase px-1 py-0.5 rounded ${ROLE_COLORS[m.player.role] ?? 'bg-gray-700 text-gray-300'}`}>{m.player.role}</span>
                    <span className="text-[9px] text-gray-600">{m.teamTag}</span>
                  </div>
                </div>
                {hasStats(m.player.id) && <span className="text-[9px] text-green-400 font-ui shrink-0">✓</span>}
              </button>
            ))}
          </div>
          {allMembers.length === 0 && (
            <p className="text-xs text-yellow-500">No team members assigned. Add members in the Teams tab first.</p>
          )}
        </div>

        {/* Stat entry form */}
        {form && (
          <RetroWindow title="ENTER STATS" titleBarColor="blue" className="animate-fade-in">
            {err && <p className="text-xs text-red-400 mb-2">{err}</p>}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
              <div>
                <label className="block text-[10px] font-ui uppercase text-gray-600 mb-1">God</label>
                <select
                  value={form.godId}
                  onChange={(e) => setForm({ ...form, godId: e.target.value })}
                  className="select-field w-full"
                >
                  <option value="">— no god —</option>
                  {gods.map((g) => <option key={g.id} value={g.id}>{g.name} ({g.role})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-ui uppercase text-gray-600 mb-1">Role played</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="select-field w-full"
                >
                  <option value="">—</option>
                  {PLAYER_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              {STAT_FIELDS.map((f) => (
                <div key={f}>
                  <label className="block text-[10px] font-ui uppercase text-gray-600 mb-1">{f}</label>
                  <input
                    type="number"
                    min="0"
                    value={form[f]}
                    onChange={(e) => setForm({ ...form, [f]: e.target.value })}
                    className="input-field w-full"
                    placeholder="0"
                  />
                </div>
              ))}
              <div className="sm:col-span-3">
                <label className="block text-[10px] font-ui uppercase text-gray-600 mb-1">Notes (optional)</label>
                <input
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="input-field w-full"
                  placeholder="Any notes…"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <BrutalButton onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save Stats'}</BrutalButton>
              <BrutalButton onClick={() => remove(form.playerId)} variant="danger" size="sm" disabled={!hasStats(form.playerId)}>Remove</BrutalButton>
              <BrutalButton onClick={() => setForm(null)} variant="secondary" size="sm">Cancel</BrutalButton>
            </div>
          </RetroWindow>
        )}
      </RetroWindow>
    </div>
  );
}
