'use client';

import { useState, useEffect } from 'react';
import { PLAYER_ROLES, GOD_ROLES, GOD_CLASSES, ROLE_COLORS } from '@/lib/constants';
import RoleFilter from '@/components/RoleFilter';
import { RetroWindow, BrutalButton, PixelBadge, StatusBadge } from '@/components/ui';

async function api(url, opts) { const r = await fetch(url, opts); return r.json(); }
function postJson(url, body) { return api(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); }
function del(url) { return api(url, { method: 'DELETE' }); }
function patchJson(url, body) { return api(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); }

function RoleBadge({ role, secondary = false }) {
  const colors = ROLE_COLORS[role] ?? 'bg-gray-500/15 text-gray-400';
  if (secondary) {
    const textColor = colors.split(' ').find(c => c.startsWith('text-')) ?? 'text-gray-500';
    return (
      <span className={`${textColor} font-mono text-[8px] uppercase border border-current px-1 opacity-60`}>
        {role}
      </span>
    );
  }
  return (
    <span className={`${colors} font-mono text-[10px] uppercase px-1.5 py-0.5`}>
      {role}
    </span>
  );
}

function PasswordGate({ onAuthed }) {
  const [pw, setPw] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const res = await fetch('/api/admin-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pw }),
    });
    if (res.ok) {
      sessionStorage.setItem('frh_admin', '1');
      onAuthed();
    } else {
      setError('Incorrect password');
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8">
      <RetroWindow title="AUTHENTICATION REQUIRED" titleBarColor="blue" className="w-full max-w-sm">
        <h1 className="font-ui text-sm uppercase tracking-widest text-frh-yellow mb-1">Admin Access</h1>
        <p className="text-sm text-gray-500 mb-6">Enter the admin password to continue.</p>
        <form onSubmit={submit} className="space-y-4">
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="Password"
            className="input-field w-full"
            autoFocus
          />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <BrutalButton type="submit" disabled={busy || !pw} className="w-full">
            {busy ? 'Checking...' : 'Enter the Compound'}
          </BrutalButton>
        </form>
      </RetroWindow>
    </div>
  );
}

export default function AdminClient({ initialPlayers, initialGods, initialDrafts, initialSeasons = [], initialTeams = [], initialMatches = [], initialPlayerDrafts = [], initialSubmissions = [], overview = {} }) {
  const [authed, setAuthed] = useState(false);
  const [players, setPlayers] = useState(initialPlayers);
  const [gods, setGods] = useState(initialGods);
  const [drafts, setDrafts] = useState(initialDrafts);
  const [seasons, setSeasons] = useState(initialSeasons);
  const [teams, setTeams] = useState(initialTeams);
  const [matches, setMatches] = useState(initialMatches);
  const [playerDrafts, setPlayerDrafts] = useState(initialPlayerDrafts);
  const [submissions, setSubmissions] = useState(initialSubmissions);
  const [tab, setTab] = useState('drafts');

  useEffect(() => {
    if (sessionStorage.getItem('frh_admin') !== '1') return;
    let cancelled = false;
    fetch('/api/admin-auth', { method: 'GET' })
      .then((res) => {
        if (cancelled) return;
        if (res.status === 401) {
          sessionStorage.removeItem('frh_admin');
          setAuthed(false);
        } else {
          setAuthed(true);
        }
      })
      .catch(() => { if (!cancelled) setAuthed(true); });
    return () => { cancelled = true; };
  }, []);

  if (!authed) return <PasswordGate onAuthed={() => setAuthed(true)} />;

  const refreshPlayers = async () => setPlayers(await api('/api/players'));
  const refreshGods    = async () => setGods(await api('/api/gods'));
  const refreshDrafts  = async () => setDrafts(await api('/api/drafts'));
  const refreshSeasons = async () => setSeasons(await api('/api/seasons'));
  const refreshTeams   = async () => {
    const data = await api('/api/teams');
    setTeams(Array.isArray(data) ? data : []);
  };
  const refreshMatches = async () => {
    const data = await api('/api/matches');
    setMatches(Array.isArray(data) ? data : []);
  };
  const refreshPlayerDrafts = async () => {
    const data = await api('/api/player-drafts');
    setPlayerDrafts(Array.isArray(data) ? data : []);
  };
  const refreshSubmissions = async () => {
    const data = await api('/api/submissions?status=open');
    setSubmissions(Array.isArray(data) ? data : []);
  };

  const tabs = [
    { key: 'drafts',       label: 'Drafts',        count: drafts.length },
    { key: 'players',      label: 'Players',        count: players.length },
    { key: 'teams',        label: 'Teams',          count: teams.length },
    { key: 'matches',      label: 'Schedule',       count: matches.length },
    { key: 'playerDraft',  label: 'Player Draft',   count: playerDrafts.length },
    { key: 'review',       label: 'Review Queue',   count: submissions.length || null },
    { key: 'import',       label: 'Import',         count: null },
    { key: 'gods',         label: 'Gods',           count: gods.length },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <RetroWindow title="FRANK'S COMMAND CENTER v1.0" titleBarColor="yellow">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6 border-b-2 border-brand-700 pb-4">
          <div>
            <h1 className="font-ui text-xl uppercase tracking-widest text-frh-yellow mb-1">Admin Dashboard</h1>
            <p className="text-sm text-gray-500">Manage players, gods, and draft sessions.</p>
          </div>
          <PixelBadge label="Admin Session Active" color="lime" />
        </div>

        {/* Overview stat-card row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-4">
          {[
            { label: 'Live Matches',  value: overview.liveMatchCount ?? 0, urgent: (overview.liveMatchCount ?? 0) > 0, color: 'text-green-400' },
            { label: 'Pending Review', value: overview.pendingSubCount ?? 0, urgent: (overview.pendingSubCount ?? 0) > 0, color: 'text-orange-400' },
            { label: 'Players',       value: overview.playerCount ?? 0, urgent: false, color: 'text-frh-yellow' },
            { label: 'Teams',         value: overview.teamCount ?? 0, urgent: false, color: 'text-frh-yellow' },
            { label: 'Gods',          value: overview.godCount ?? 0, urgent: false, color: 'text-frh-yellow' },
            { label: overview.seasonName ? `${overview.seasonName} · Wk ${overview.currentWeek ?? '?'}` : 'No Active Season',
              value: null, urgent: false, color: 'text-gray-500' },
          ].map((stat) => (
            <div key={stat.label} className={`border-2 px-3 py-2 text-center ${stat.urgent ? 'border-orange-500/50 bg-orange-500/5' : 'border-brand-700 bg-brand-900/30'}`}>
              {stat.value !== null
                ? <div className={`font-mono text-lg font-bold ${stat.color}`}>{stat.value}</div>
                : null
              }
              <div className={`font-ui text-[9px] uppercase tracking-widest mt-0.5 ${stat.urgent ? 'text-orange-400' : 'text-gray-600'}`}>{stat.label}</div>
            </div>
          ))}
        </div>

        <div className="mb-6 overflow-x-auto border-2 border-brand-700 bg-brand-950/50">
          <div className="flex min-w-max bg-brand-900">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={[
                  'px-4 py-3 font-ui text-xs uppercase transition-colors border-r border-brand-700 last:border-r-0',
                  tab === t.key
                    ? 'bg-brand-800 text-frh-yellow border-b-[3px] border-b-frh-yellow'
                    : 'bg-brand-700 text-gray-400 border-b-[3px] border-b-transparent hover:text-frh-cream',
                ].join(' ')}
              >
                {t.label}
                {t.count !== null && <span className="ml-2 font-mono text-[10px] opacity-60">{t.count}</span>}
              </button>
            ))}
          </div>
        </div>

        {tab === 'drafts'      && <DraftsPanel      drafts={drafts}   onRefresh={refreshDrafts} />}
        {tab === 'players'     && <PlayersPanel     players={players} onRefresh={refreshPlayers} />}
        {tab === 'teams'       && <TeamsPanel       teams={teams} players={players} seasons={seasons} onRefreshTeams={refreshTeams} onRefreshSeasons={refreshSeasons} />}
        {tab === 'matches'     && <MatchesPanel     matches={matches} seasons={seasons} teams={teams} onRefresh={refreshMatches} />}
        {tab === 'playerDraft' && <PlayerDraftPanel playerDrafts={playerDrafts} seasons={seasons} teams={teams} onRefresh={refreshPlayerDrafts} />}
        {tab === 'review'      && <ReviewQueuePanel submissions={submissions} onRefresh={refreshSubmissions} />}
        {tab === 'import'      && <ImportPanel      onRefresh={refreshPlayers} />}
        {tab === 'gods'        && <GodsPanel        gods={gods}       onRefresh={refreshGods} />}
      </RetroWindow>
    </div>
  );
}

// ─── Share Modal ─────────────────────────────────────

function ShareModal({ draftId, draftName, draftKeys, loading, error, onClose }) {
  const [copied, setCopied] = useState(null);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const links = [
    { label: 'Admin Link',    key: 'adminKey',    description: 'Full override access' },
    { label: 'Captain A',     key: 'captainAKey', description: 'Team Alpha captain' },
    { label: 'Captain B',     key: 'captainBKey', description: 'Team Bravo captain' },
    { label: 'Spectator',     key: null,          description: 'Read-only, no key needed' },
  ];

  const getUrl = (keyField) => {
    if (!keyField) return `${origin}/draft/${draftId}`;
    const val = draftKeys?.[keyField];
    if (!val) return null;
    return `${origin}/draft/${draftId}?key=${val}`;
  };

  const copy = async (keyField) => {
    const url = getUrl(keyField);
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(keyField ?? 'spectator');
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <RetroWindow title="SHARE DRAFT LINKS" titleBarColor="blue" className="w-full max-w-lg">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h2 className="font-ui text-sm uppercase tracking-widest text-frh-yellow">Share Links</h2>
            <p className="text-xs text-gray-500 mt-0.5">{draftName}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-xl leading-none">✕</button>
        </div>

        {loading && (
          <p className="text-xs text-gray-500 text-center py-6">Loading share links…</p>
        )}
        {error && (
          <p className="text-xs text-red-400 text-center py-3">{error}</p>
        )}

        {!loading && (
          <div className="space-y-3">
            {links.map(({ label, key, description }) => {
              const url = getUrl(key);
              const wasCopied = copied === (key ?? 'spectator');
              return (
                <div key={label} className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 bg-brand-900/60 border-2 border-brand-700">
                  <div className="flex-1 min-w-0">
                    <div className="font-ui text-xs uppercase tracking-wide text-gray-300">{label}</div>
                    <div className="text-[10px] text-gray-600">{description}</div>
                    {url
                      ? <div className="text-[10px] font-mono text-frh-cream/80 truncate mt-0.5 bg-brand-950 px-2 py-1 border border-brand-700">{url}</div>
                      : <div className="text-[10px] text-gray-700 mt-0.5">No key assigned (legacy draft)</div>
                    }
                  </div>
                  <BrutalButton
                    onClick={() => copy(key)}
                    disabled={!url}
                    variant={wasCopied ? 'secondary' : 'primary'}
                    size="sm"
                    className="shrink-0"
                  >
                    {wasCopied ? 'Copied!' : 'Copy'}
                  </BrutalButton>
                </div>
              );
            })}
          </div>
        )}

        <p className="text-[10px] text-gray-600 mt-4 text-center">
          Share Admin, Captain A, and Captain B links privately. The spectator link is safe to post publicly.
        </p>
      </RetroWindow>
    </div>
  );
}

// ─── Drafts Panel ────────────────────────────────────

function DraftsPanel({ drafts, onRefresh }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [shareTarget, setShareTarget] = useState(null);
  const [keyCache, setKeyCache] = useState({});
  const [shareError, setShareError] = useState('');

  const fetchKeys = async (id) => {
    if (keyCache[id]) return keyCache[id];
    try {
      const res = await fetch(`/api/drafts/admin?id=${id}`);
      if (!res.ok) {
        if (res.status === 401) {
          setShareError('Admin session expired. Please refresh the page and log in again.');
        } else {
          setShareError('Could not load draft links.');
        }
        return null;
      }
      const draft = await res.json();
      const keys = { adminKey: draft.adminKey, captainAKey: draft.captainAKey, captainBKey: draft.captainBKey };
      setKeyCache((prev) => ({ ...prev, [id]: keys }));
      return keys;
    } catch {
      setShareError('Could not load draft links.');
      return null;
    }
  };

  const create = async () => {
    setBusy(true);
    const draft = await postJson('/api/drafts', { name: name.trim() || `Draft ${drafts.length + 1}` });
    setName('');
    if (draft.id) {
      setKeyCache((prev) => ({
        ...prev,
        [draft.id]: { adminKey: draft.adminKey, captainAKey: draft.captainAKey, captainBKey: draft.captainBKey },
      }));
    }
    await onRefresh();
    if (draft.id) { setShareError(''); setShareTarget({ id: draft.id, name: draft.name }); }
    setBusy(false);
  };

  const remove = async (id) => {
    if (!confirm('Delete this draft and all picks?')) return;
    await del(`/api/drafts?id=${id}`);
    onRefresh();
  };

  const setStatus = async (id, status) => {
    const result = await postJson('/api/drafts', { id, status });
    if (result.error) { alert(result.error); return; }
    onRefresh();
  };

  const reopenLastPick = async (d) => {
    const keys = keyCache[d.id] ?? await fetchKeys(d.id);
    if (!keys?.adminKey) { alert('Could not load admin key for this draft.'); return; }
    const res = await fetch(`/api/drafts/${d.id}/admin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: keys.adminKey, action: 'reopenLastPick' }),
    });
    const data = await res.json();
    if (!res.ok) { alert(data.error || 'Reopen failed'); return; }
    onRefresh();
  };

  const openShare = async (d) => {
    setShareError('');
    setShareTarget({ id: d.id, name: d.name });
    if (!keyCache[d.id]) await fetchKeys(d.id);
  };

  const openAdminDraft = async (d) => {
    const keys = keyCache[d.id] ?? await fetchKeys(d.id);
    if (!keys?.adminKey) { window.location.href = `/draft/${d.id}`; return; }
    window.location.href = `/draft/${d.id}?key=${keys.adminKey}`;
  };

  return (
    <>
      {shareTarget && (
        <ShareModal
          draftId={shareTarget.id}
          draftName={shareTarget.name}
          draftKeys={keyCache[shareTarget.id]}
          loading={!keyCache[shareTarget.id] && !shareError}
          error={shareError}
          onClose={() => { setShareTarget(null); setShareError(''); }}
        />
      )}
      <RetroWindow title="DRAFT CONTROL">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h2 className="font-ui text-sm uppercase tracking-widest text-frh-yellow">Drafts</h2>
          <PixelBadge label={`${drafts.length} sessions`} color="cream" />
        </div>
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <input
            placeholder="New draft name…"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && create()}
            className="input-field flex-1"
          />
          <BrutalButton onClick={create} disabled={busy} className="shrink-0">
            {busy ? 'Creating…' : 'Create Draft'}
          </BrutalButton>
        </div>
        <div className="space-y-2">
          {drafts.length === 0
            ? <p className="text-sm text-gray-600 text-center py-6">No drafts. Create one or go home.</p>
            : drafts.map((d) => (
              <div key={d.id} className="flex flex-col md:flex-row md:items-center gap-3 px-3 py-3 bg-brand-950/40 border-2 border-brand-700 hover:border-frh-yellow/60 transition-all">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-ui text-sm text-gray-300 truncate">{d.name}</span>
                    <StatusBadge status={d.status} />
                  </div>
                  <span className="text-[10px] text-gray-600 font-mono">{new Date(d.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  <BrutalButton onClick={() => openAdminDraft(d)} variant="secondary" size="sm">Open</BrutalButton>
                  <BrutalButton onClick={() => openShare(d)} variant="secondary" size="sm">Share</BrutalButton>
                  {d.status === 'pending' && (
                    <BrutalButton onClick={() => setStatus(d.id, 'lobby')} size="sm">Open Lobby</BrutalButton>
                  )}
                  {d.status === 'complete' && (
                    <BrutalButton onClick={() => reopenLastPick(d)} variant="secondary" size="sm">Reopen</BrutalButton>
                  )}
                  <BrutalButton onClick={() => remove(d.id)} variant="danger" size="sm">Delete</BrutalButton>
                </div>
              </div>
            ))}
        </div>
      </RetroWindow>
    </>
  );
}

// ─── Players Panel ───────────────────────────────────

function PlayersPanel({ players, onRefresh }) {
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ name: '', role: 'Mid', discordUsername: '', division: '' });
  const [filterDiv, setFilterDiv] = useState('All');
  const [busy, setBusy] = useState(false);

  const reset = () => { setForm({ name: '', role: 'Mid', discordUsername: '', division: '' }); setEditId(null); setShowForm(false); };

  const submit = async () => {
    if (!form.name.trim()) return;
    setBusy(true);
    await postJson('/api/players', editId ? { id: editId, ...form } : form);
    reset();
    await onRefresh();
    setBusy(false);
  };

  const edit = (p) => {
    setForm({ name: p.name, role: p.role, discordUsername: p.discordUsername || '', division: p.division || '' });
    setEditId(p.id);
    setShowForm(true);
  };

  const remove = async (id) => {
    if (!confirm('Delete this player?')) return;
    const result = await del(`/api/players?id=${id}`);
    if (result.error) { alert(result.error); return; }
    onRefresh();
  };

  const divisions = ['All', ...Array.from(new Set(players.map((p) => p.division).filter(Boolean))).sort()];
  const filtered = filterDiv === 'All' ? players : players.filter((p) => p.division === filterDiv);

  return (
    <RetroWindow title="PLAYER DATABASE">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-ui text-sm uppercase tracking-widest text-frh-yellow">Players ({players.length})</h2>
        <BrutalButton onClick={() => { reset(); setShowForm(!showForm); }} size="sm">{showForm ? 'Cancel' : '+ Add Player'}</BrutalButton>
      </div>

      {showForm && (
        <RetroWindow title={editId ? 'EDIT PLAYER' : 'NEW PLAYER'} titleBarColor="blue" className="mb-4 animate-fade-in">
          <input placeholder="IGN / Player name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-field" />
          <div className="grid grid-cols-2 gap-3">
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="select-field">
              {PLAYER_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <input placeholder="Division (e.g. Hospice)" value={form.division} onChange={(e) => setForm({ ...form, division: e.target.value })} className="input-field" />
          </div>
          <input placeholder="Discord username" value={form.discordUsername} onChange={(e) => setForm({ ...form, discordUsername: e.target.value })} className="input-field" />
          <BrutalButton onClick={submit} disabled={busy || !form.name.trim()} className="w-full">{busy ? 'Saving...' : editId ? 'Update Player' : 'Add Player'}</BrutalButton>
        </RetroWindow>
      )}

      {divisions.length > 1 && (
        <div className="mb-3">
          <RoleFilter options={divisions} value={filterDiv} onChange={setFilterDiv} />
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] font-ui uppercase tracking-widest text-gray-500 border-b border-brand-600/30">
              <th className="text-left py-2 px-2">Name</th>
              <th className="text-left py-2 px-2">Discord</th>
              <th className="text-left py-2 px-2">Role</th>
              <th className="text-left py-2 px-2">Division</th>
              <th className="text-right py-2 px-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className="border-b border-brand-700/30 hover:bg-brand-700/20 transition-colors">
                <td className="py-2 px-2 font-display font-medium text-gray-300">{p.name}</td>
                <td className="py-2 px-2 text-xs text-gray-500 font-mono">{p.discordUsername || <span className="text-gray-700">—</span>}</td>
                <td className="py-2 px-2"><span className={`text-[9px] font-display font-bold uppercase px-1.5 py-0.5 rounded ${ROLE_COLORS[p.role]}`}>{p.role}</span></td>
                <td className="py-2 px-2 text-xs text-gray-500">{p.division || <span className="text-gray-700">—</span>}</td>
                <td className="py-2 px-2 text-right">
                  <div className="flex justify-end gap-2">
                    <BrutalButton onClick={() => edit(p)} variant="secondary" size="sm">Edit</BrutalButton>
                    <BrutalButton onClick={() => remove(p.id)} variant="danger" size="sm">Delete</BrutalButton>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </RetroWindow>
  );
}

// ─── Teams Panel ─────────────────────────────────────

function TeamsPanel({ teams, players, seasons, onRefreshTeams }) {
  const [selectedDivisionId, setSelectedDivisionId] = useState('');
  const [expandedTeamId, setExpandedTeamId] = useState(null);
  const [teamForm, setTeamForm] = useState({ name: '', tag: '' });
  const [memberForm, setMemberForm] = useState({ playerId: '', role: 'Mid', isCaptain: false, isSub: false });
  const [busy, setBusy] = useState(false);

  // Flat list of all divisions across seasons for the selector
  const allDivisions = seasons.flatMap((s) =>
    s.divisions.map((d) => ({ ...d, seasonName: s.name, label: `${s.name} — ${d.name}` }))
  );

  const selectedDivision = allDivisions.find((d) => d.id === selectedDivisionId);
  const filteredTeams = selectedDivisionId
    ? teams.filter((t) => t.divisionId === selectedDivisionId)
    : teams;

  // Players in the same division as the selected division
  const divisionPlayers = selectedDivision
    ? players.filter((p) => p.division === selectedDivision.name)
    : players;

  const createTeam = async () => {
    if (!teamForm.name.trim() || !teamForm.tag.trim() || !selectedDivisionId) return;
    setBusy(true);
    await postJson('/api/teams', { name: teamForm.name.trim(), tag: teamForm.tag.trim(), divisionId: selectedDivisionId });
    setTeamForm({ name: '', tag: '' });
    await onRefreshTeams();
    setBusy(false);
  };

  const deleteTeam = async (id) => {
    if (!confirm('Delete this team and all its members?')) return;
    await del(`/api/teams/${id}`);
    if (expandedTeamId === id) setExpandedTeamId(null);
    onRefreshTeams();
  };

  const addMember = async (teamId) => {
    if (!memberForm.playerId) return;
    setBusy(true);
    const res = await postJson(`/api/teams/${teamId}/members`, memberForm);
    if (res.error) { alert(res.error); setBusy(false); return; }
    setMemberForm({ playerId: '', role: 'Mid', isCaptain: false, isSub: false });
    await onRefreshTeams();
    setBusy(false);
  };

  const removeMember = async (teamId, memberId) => {
    if (!confirm('Remove this player from the team?')) return;
    await del(`/api/teams/${teamId}/members/${memberId}`);
    onRefreshTeams();
  };

  const toggleFlag = async (teamId, memberId, field, currentValue) => {
    await patchJson(`/api/teams/${teamId}/members/${memberId}`, { [field]: !currentValue });
    onRefreshTeams();
  };

  // Players already on the expanded team (to exclude from add-member dropdown)
  const expandedTeam = teams.find((t) => t.id === expandedTeamId);
  const assignedPlayerIds = new Set(expandedTeam?.members.map((m) => m.playerId) ?? []);
  const availablePlayers = divisionPlayers.filter((p) => !assignedPlayerIds.has(p.id));

  return (
    <RetroWindow title="TEAM ROSTER MANAGEMENT">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h2 className="font-ui text-sm uppercase tracking-widest text-frh-yellow">Teams</h2>
        <PixelBadge label={`${teams.length} total`} color="cream" />
      </div>

      {/* Division selector */}
      <div className="mb-4">
        <label className="block text-[10px] font-ui uppercase tracking-widest text-gray-500 mb-1">Filter by Division</label>
        <select
          value={selectedDivisionId}
          onChange={(e) => { setSelectedDivisionId(e.target.value); setExpandedTeamId(null); }}
          className="select-field w-full sm:w-auto"
        >
          <option value="">All divisions</option>
          {allDivisions.map((d) => (
            <option key={d.id} value={d.id}>{d.label}</option>
          ))}
        </select>
      </div>

      {/* New team form — only shown when a division is selected */}
      {selectedDivisionId && (
        <RetroWindow title="NEW TEAM" titleBarColor="blue" className="mb-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              placeholder="Team name"
              value={teamForm.name}
              onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })}
              className="input-field flex-1"
            />
            <input
              placeholder="Tag (e.g. FRH)"
              value={teamForm.tag}
              onChange={(e) => setTeamForm({ ...teamForm, tag: e.target.value })}
              className="input-field w-32"
            />
            <BrutalButton
              onClick={createTeam}
              disabled={busy || !teamForm.name.trim() || !teamForm.tag.trim()}
              className="shrink-0"
            >
              {busy ? 'Creating…' : 'Create Team'}
            </BrutalButton>
          </div>
        </RetroWindow>
      )}

      {/* Team list */}
      {filteredTeams.length === 0 ? (
        <p className="text-sm text-gray-600 text-center py-6">
          {selectedDivisionId ? 'No teams in this division yet.' : 'No teams. Select a division and create one.'}
        </p>
      ) : (
        <div className="space-y-2">
          {filteredTeams.map((team) => {
            const isExpanded = expandedTeamId === team.id;
            return (
              <div key={team.id} className="border-2 border-brand-700 hover:border-frh-yellow/40 transition-all">
                {/* Team header row */}
                <div className="flex items-center gap-3 px-3 py-3 bg-brand-950/40">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-ui text-sm text-gray-200">{team.name}</span>
                      <span className="font-mono text-[10px] text-gray-600 border border-brand-600 px-1">[{team.tag}]</span>
                      {team.division && (
                        <span className="text-[10px] text-gray-500">{team.division.name}</span>
                      )}
                    </div>
                    <span className="text-[10px] text-gray-600">{team.members.length} member{team.members.length !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <BrutalButton
                      onClick={() => setExpandedTeamId(isExpanded ? null : team.id)}
                      variant="secondary"
                      size="sm"
                    >
                      {isExpanded ? 'Collapse' : 'Manage'}
                    </BrutalButton>
                    <BrutalButton onClick={() => deleteTeam(team.id)} variant="danger" size="sm">Delete</BrutalButton>
                  </div>
                </div>

                {/* Expanded member management */}
                {isExpanded && (
                  <div className="border-t-2 border-brand-700 p-3 bg-brand-900/30">
                    {/* Current members */}
                    {team.members.length === 0 ? (
                      <p className="text-xs text-gray-600 mb-3">No members yet.</p>
                    ) : (
                      <div className="mb-3 space-y-1">
                        {team.members.map((m) => (
                          <div key={m.id} className="flex items-center gap-2 py-1.5 px-2 bg-brand-950/60 border border-brand-700">
                            <span className="font-display font-medium text-sm text-gray-300 flex-1">{m.player.name}</span>
                            <span className={`text-[9px] font-display font-bold uppercase px-1.5 py-0.5 rounded ${ROLE_COLORS[m.role] ?? 'bg-gray-700 text-gray-300'}`}>{m.role}</span>
                            <button
                              onClick={() => toggleFlag(team.id, m.id, 'isCaptain', m.isCaptain)}
                              className={`text-[9px] font-ui uppercase px-1.5 py-0.5 border transition-colors ${
                                m.isCaptain ? 'border-frh-yellow text-frh-yellow' : 'border-brand-600 text-gray-600 hover:border-gray-400'
                              }`}
                              title="Toggle captain"
                            >
                              C
                            </button>
                            <button
                              onClick={() => toggleFlag(team.id, m.id, 'isSub', m.isSub)}
                              className={`text-[9px] font-ui uppercase px-1.5 py-0.5 border transition-colors ${
                                m.isSub ? 'border-blue-400 text-blue-400' : 'border-brand-600 text-gray-600 hover:border-gray-400'
                              }`}
                              title="Toggle sub"
                            >
                              S
                            </button>
                            <BrutalButton onClick={() => removeMember(team.id, m.id)} variant="danger" size="sm">Remove</BrutalButton>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add member form */}
                    <div className="flex flex-wrap gap-2 items-end">
                      <div className="flex-1 min-w-[140px]">
                        <label className="block text-[10px] font-ui uppercase text-gray-600 mb-1">Player</label>
                        <select
                          value={memberForm.playerId}
                          onChange={(e) => setMemberForm({ ...memberForm, playerId: e.target.value })}
                          className="select-field w-full"
                        >
                          <option value="">Select player…</option>
                          {availablePlayers.map((p) => (
                            <option key={p.id} value={p.id}>{p.name} ({p.role})</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-ui uppercase text-gray-600 mb-1">Role</label>
                        <select
                          value={memberForm.role}
                          onChange={(e) => setMemberForm({ ...memberForm, role: e.target.value })}
                          className="select-field"
                        >
                          {PLAYER_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </div>
                      <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer pb-1">
                        <input type="checkbox" checked={memberForm.isCaptain} onChange={(e) => setMemberForm({ ...memberForm, isCaptain: e.target.checked })} className="accent-frh-yellow" />
                        Captain
                      </label>
                      <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer pb-1">
                        <input type="checkbox" checked={memberForm.isSub} onChange={(e) => setMemberForm({ ...memberForm, isSub: e.target.checked })} className="accent-blue-400" />
                        Sub
                      </label>
                      <BrutalButton
                        onClick={() => addMember(team.id)}
                        disabled={busy || !memberForm.playerId}
                        size="sm"
                        className="pb-1"
                      >
                        {busy ? 'Adding…' : 'Add Member'}
                      </BrutalButton>
                    </div>
                    {availablePlayers.length === 0 && divisionPlayers.length > 0 && (
                      <p className="text-[10px] text-gray-600 mt-2">All division players are already on this team.</p>
                    )}
                    {selectedDivision && divisionPlayers.length === 0 && (
                      <p className="text-[10px] text-yellow-600 mt-2">No players tagged &ldquo;{selectedDivision.name}&rdquo; found. Set player divisions in the Players tab first.</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </RetroWindow>
  );
}

// ─── Matches Panel ───────────────────────────────────

const STATUS_BADGE = {
  scheduled: 'blue',
  live: 'lime',
  completed: 'purple',
  postponed: 'orange',
};

function MatchesPanel({ matches, seasons, teams, onRefresh }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [form, setForm] = useState({
    seasonId: '',
    divisionId: '',
    homeTeamId: '',
    awayTeamId: '',
    week: '',
    format: 'BO1',
    scheduledAt: '',
  });

  const activeSeason = seasons.find((s) => s.status === 'active') ?? seasons[0];
  const selectedDivision = activeSeason?.divisions?.find((d) => d.id === form.divisionId);
  const divisionTeams = teams.filter((t) => t.division?.id === form.divisionId);

  const createMatch = async () => {
    setErr('');
    if (!form.seasonId || !form.divisionId || !form.homeTeamId || !form.awayTeamId || !form.week) {
      setErr('Season, division, both teams, and week are required.');
      return;
    }
    setBusy(true);
    const res = await postJson('/api/matches', {
      seasonId: form.seasonId,
      divisionId: form.divisionId,
      homeTeamId: form.homeTeamId,
      awayTeamId: form.awayTeamId,
      week: parseInt(form.week, 10),
      format: form.format,
      scheduledAt: form.scheduledAt || null,
    });
    setBusy(false);
    if (res.error) { setErr(res.error); return; }
    setForm({ seasonId: form.seasonId, divisionId: form.divisionId, homeTeamId: '', awayTeamId: '', week: form.week, format: 'BO1', scheduledAt: '' });
    await onRefresh();
  };

  const updateStatus = async (matchId, status) => {
    await patchJson(`/api/matches/${matchId}`, { status });
    await onRefresh();
  };

  const openDraft = async (matchId, gameId) => {
    const res = await postJson(`/api/matches/${matchId}/games/${gameId}/draft`, {});
    if (res.error && res.error !== 'Draft already exists for this game') {
      alert(res.error);
      return;
    }
    const draftId = res.id ?? res.draftId;
    if (draftId) window.open(`/draft/${draftId}`, '_blank');
    await onRefresh();
  };

  const deleteMatch = async (matchId) => {
    if (!confirm('Delete this match and all its games?')) return;
    await del(`/api/matches/${matchId}`);
    await onRefresh();
  };

  const groupedByWeek = matches.reduce((acc, m) => {
    const w = m.week ?? 0;
    if (!acc[w]) acc[w] = [];
    acc[w].push(m);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Create match form */}
      <RetroWindow title="SCHEDULE A MATCH">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-[10px] font-ui uppercase text-gray-600 mb-1">Season</label>
            <select
              value={form.seasonId}
              onChange={(e) => setForm({ ...form, seasonId: e.target.value, divisionId: '', homeTeamId: '', awayTeamId: '' })}
              className="select-field w-full"
            >
              <option value="">Select season…</option>
              {seasons.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-ui uppercase text-gray-600 mb-1">Division</label>
            <select
              value={form.divisionId}
              onChange={(e) => setForm({ ...form, divisionId: e.target.value, homeTeamId: '', awayTeamId: '' })}
              className="select-field w-full"
              disabled={!form.seasonId}
            >
              <option value="">Select division…</option>
              {seasons.find((s) => s.id === form.seasonId)?.divisions?.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-ui uppercase text-gray-600 mb-1">Home Team</label>
            <select
              value={form.homeTeamId}
              onChange={(e) => setForm({ ...form, homeTeamId: e.target.value })}
              className="select-field w-full"
              disabled={!form.divisionId}
            >
              <option value="">Select team…</option>
              {divisionTeams.filter((t) => t.id !== form.awayTeamId).map((t) => (
                <option key={t.id} value={t.id}>{t.name} [{t.tag}]</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-ui uppercase text-gray-600 mb-1">Away Team</label>
            <select
              value={form.awayTeamId}
              onChange={(e) => setForm({ ...form, awayTeamId: e.target.value })}
              className="select-field w-full"
              disabled={!form.divisionId}
            >
              <option value="">Select team…</option>
              {divisionTeams.filter((t) => t.id !== form.homeTeamId).map((t) => (
                <option key={t.id} value={t.id}>{t.name} [{t.tag}]</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-ui uppercase text-gray-600 mb-1">Week</label>
            <input
              type="number"
              min="1"
              value={form.week}
              onChange={(e) => setForm({ ...form, week: e.target.value })}
              className="input-field w-full"
              placeholder="1"
            />
          </div>
          <div>
            <label className="block text-[10px] font-ui uppercase text-gray-600 mb-1">Format</label>
            <select value={form.format} onChange={(e) => setForm({ ...form, format: e.target.value })} className="select-field w-full">
              <option value="BO1">BO1</option>
              <option value="BO3">BO3</option>
              <option value="BO5">BO5</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-[10px] font-ui uppercase text-gray-600 mb-1">Scheduled Date/Time (optional)</label>
            <input
              type="datetime-local"
              value={form.scheduledAt}
              onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
              className="input-field w-full"
            />
          </div>
        </div>
        {err && <p className="text-xs text-red-400 mb-2">{err}</p>}
        <BrutalButton onClick={createMatch} disabled={busy}>
          {busy ? 'Scheduling…' : 'Schedule Match'}
        </BrutalButton>
        {selectedDivision && (
          <p className="text-[10px] text-gray-600 mt-2">
            {divisionTeams.length} team{divisionTeams.length !== 1 ? 's' : ''} in {selectedDivision.name}
          </p>
        )}
      </RetroWindow>

      {/* Match list by week */}
      {matches.length === 0 ? (
        <p className="text-sm text-gray-600 text-center py-4">No matches scheduled yet.</p>
      ) : (
        Object.keys(groupedByWeek).sort((a, b) => a - b).map((week) => (
          <RetroWindow key={week} title={`WEEK ${week}`}>
            <div className="space-y-3">
              {groupedByWeek[week].map((match) => (
                <div key={match.id} className="border-2 border-brand-700 hover:border-frh-yellow/40 transition-all">
                  <div className="flex flex-wrap items-center gap-3 px-3 py-3 bg-brand-950/40">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-ui text-sm text-gray-200">
                          {match.homeTeam?.name} <span className="text-gray-600 text-xs">vs</span> {match.awayTeam?.name}
                        </span>
                        <PixelBadge label={match.format} color="purple" />
                        <PixelBadge label={match.status} color={STATUS_BADGE[match.status] ?? 'blue'} />
                      </div>
                      {match.scheduledAt && (
                        <span className="text-[10px] text-gray-600">{new Date(match.scheduledAt).toLocaleString()}</span>
                      )}
                    </div>
                    <div className="flex gap-2 shrink-0 flex-wrap">
                      <select
                        defaultValue={match.status}
                        onChange={(e) => updateStatus(match.id, e.target.value)}
                        className="select-field text-xs py-1 h-8"
                      >
                        {['scheduled', 'live', 'completed', 'postponed'].map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                      <BrutalButton onClick={() => deleteMatch(match.id)} variant="danger" size="sm">Delete</BrutalButton>
                    </div>
                  </div>

                  {/* Games list with draft + stats buttons */}
                  {match.games?.length > 0 && (
                    <div className="border-t-2 border-brand-700 px-3 py-2 bg-brand-900/20 flex flex-wrap gap-3">
                      {match.games.map((game) => (
                        <div key={game.id} className="flex items-center gap-2">
                          <span className="text-[10px] font-ui text-gray-500">G{game.gameNumber}</span>
                          {game.draft ? (
                            <a
                              href={`/draft/${game.draft.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] font-ui text-frh-yellow underline"
                            >
                              Draft ({game.draft.status})
                            </a>
                          ) : (
                            <BrutalButton
                              onClick={() => openDraft(match.id, game.id)}
                              size="sm"
                              className="text-[10px] py-0.5 px-2"
                            >
                              Open Draft
                            </BrutalButton>
                          )}
                          <a
                            href={`/admin/games/${game.id}/stats`}
                            className="text-[10px] font-ui text-gray-400 hover:text-frh-yellow underline transition-colors"
                          >
                            Stats
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </RetroWindow>
        ))
      )}
    </div>
  );
}

// ─── Import Panel ────────────────────────────────────

const ROLE_ALIASES = {
  solo: 'Solo', jungle: 'Jungle', mid: 'Mid', support: 'Support',
  carry: 'Carry', adc: 'Carry', fill: 'Fill',
};

function parseCSV(text) {
  const lines = text.trim().split('\n');
  // Stop at the Captains section header or trailing blank rows
  const stopIdx = lines.findIndex(l => l.split(',')[0].trim().toLowerCase() === 'captains');
  const playerLines = stopIdx >= 0 ? lines.slice(0, stopIdx) : lines;

  return playerLines
    .filter(l => l.split(',')[0].trim()) // skip blank rows
    .map((line) => {
      const cols = [];
      let cur = '', inQ = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') { inQ = !inQ; }
        else if (ch === ',' && !inQ) { cols.push(cur); cur = ''; }
        else { cur += ch; }
      }
      cols.push(cur);

      const name = (cols[0] || '').trim();
      const discordUsername = (cols[2] || '').trim() || null;
      const timezone = (cols[7] || '').trim() || null;
      const rawRole = (cols[8] || '').trim().toLowerCase();
      const role = ROLE_ALIASES[rawRole] || null;
      const secondaryRoles = (cols[9] || '').split(',')
        .map(r => ROLE_ALIASES[r.trim().toLowerCase()])
        .filter(Boolean);
      // Normalize division: first word before space/comma/parenthesis
      const rawDiv = (cols[12] || '').trim();
      const division = rawDiv.split(/[\s,(]/)[0] || null;

      return { name, discordUsername, timezone, role, secondaryRoles, division, _rawRole: cols[8]?.trim() };
    })
    .filter(r => r.name);
}

function ImportPanel({ onRefresh }) {
  const [division, setDivision] = useState('');
  const [csvText, setCsvText] = useState('');
  const [rows, setRows] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  const parse = () => { setRows(parseCSV(csvText)); setResult(null); };

  const updateRow = (i, field, value) => {
    setRows((prev) => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r));
  };

  const ready = rows?.filter((r) => r.role) ?? [];
  const invalid = rows?.filter((r) => !r.role) ?? [];

  const importAll = async () => {
    if (!ready.length) return;
    setBusy(true);
    const payload = ready.map((r) => ({
      name: r.name,
      role: r.role,
      discordUsername: r.discordUsername || null,
      division: r.division || division.trim() || null,
      timezone: r.timezone || null,
      secondaryRoles: r.secondaryRoles || [],
    }));
    const res = await postJson('/api/players/import', { players: payload });
    setResult(res);
    await onRefresh();
    setBusy(false);
  };

  const reset = () => { setCsvText(''); setRows(null); setResult(null); setDivision(''); };

  return (
    <div className="space-y-4">
      <RetroWindow title="BULK IMPORT - PASTE CSV DATA">
        <h2 className="font-ui text-sm uppercase tracking-widest text-frh-yellow mb-1">CSV Import</h2>
        <p className="text-xs text-gray-500 mb-4">
          Paste a sign-up sheet CSV below. Each import batch can be tagged with a division. Run multiple imports for multiple divisions.
        </p>

        <div className="space-y-3">
          <input
            placeholder="Division label (e.g. Hospice, Rehabilitation)"
            value={division}
            onChange={(e) => setDivision(e.target.value)}
            className="input-field"
          />
          <textarea
            placeholder="Paste CSV text here…"
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            rows={6}
            className="input-field font-mono text-xs w-full resize-y"
          />
          <div className="flex gap-2">
            <BrutalButton onClick={parse} disabled={!csvText.trim()} size="sm">Parse &amp; Preview</BrutalButton>
            {rows && <BrutalButton onClick={reset} variant="secondary" size="sm">Reset</BrutalButton>}
          </div>
        </div>
      </RetroWindow>

      {result && (
        <RetroWindow title="IMPORT COMPLETE">
          <div className="text-sm font-display font-bold text-green-400 mb-1">Import Complete</div>
          <div className="flex gap-6 text-xs text-gray-400">
            <span><span className="text-green-400 font-bold">{result.imported}</span> new players added</span>
            <span><span className="text-blue-400 font-bold">{result.updated}</span> existing players updated</span>
            {result.errors?.length > 0 && <span><span className="text-red-400 font-bold">{result.errors.length}</span> errors</span>}
          </div>
        </RetroWindow>
      )}

      {rows && !result && (
        <RetroWindow title="IMPORT PREVIEW">
          <div className="flex items-center justify-between mb-3">
            <div>
              <span className="font-display font-bold text-sm text-gray-200">{rows.length} rows parsed</span>
              {invalid.length > 0 && (
                <span className="ml-3 text-xs text-yellow-400">{invalid.length} need a role assigned</span>
              )}
            </div>
            <BrutalButton onClick={importAll} disabled={busy || !ready.length} size="sm">
              {busy ? 'Importing…' : `Import ${ready.length} players`}
            </BrutalButton>
          </div>

          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-brand-800">
                <tr className="text-[10px] font-ui uppercase tracking-widest text-gray-500 border-b border-brand-600/30">
                  <th className="text-left py-2 px-2">IGN</th>
                  <th className="text-left py-2 px-2">Discord</th>
                  <th className="text-left py-2 px-2">Roles</th>
                  <th className="text-left py-2 px-2">Division</th>
                  <th className="text-left py-2 px-2">TZ</th>
                  <th className="text-left py-2 px-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className={`border-b border-brand-700/30 ${!r.role ? 'bg-yellow-500/5' : ''}`}>
                    <td className="py-1.5 px-2 font-display font-medium text-gray-300">{r.name}</td>
                    <td className="py-1.5 px-2 font-mono text-gray-500">{r.discordUsername || '—'}</td>
                    <td className="py-1.5 px-2">
                      <div className="flex flex-wrap gap-1 items-center">
                        {r.role
                          ? <RoleBadge role={r.role} />
                          : (
                            <select value="" onChange={(e) => updateRow(i, 'role', e.target.value)} className="select-field text-[10px] py-0.5 px-1">
                              <option value="">Pick role…</option>
                              {PLAYER_ROLES.map((ro) => <option key={ro} value={ro}>{ro}</option>)}
                            </select>
                          )
                        }
                        {(r.secondaryRoles ?? []).map(sr => <RoleBadge key={sr} role={sr} secondary />)}
                      </div>
                    </td>
                    <td className="py-1.5 px-2 text-gray-500">{r.division || division || <span className="text-gray-700">—</span>}</td>
                    <td className="py-1.5 px-2 font-mono text-[9px] text-gray-600 max-w-[80px] truncate">{r.timezone ? r.timezone.replace('Standard Time', '').replace('Daylight Time', '').trim() : '—'}</td>
                    <td className="py-1.5 px-2">
                      {r.role
                        ? <span className="text-[9px] text-green-400 font-display font-bold uppercase">Ready</span>
                        : <span className="text-[9px] text-yellow-400 font-display font-bold uppercase">Needs role</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </RetroWindow>
      )}
    </div>
  );
}

// ─── Player Draft Panel ──────────────────────────────

function PlayerCard({ player, onPick, disabled }) {
  return (
    <button
      onClick={onPick}
      disabled={disabled}
      className="text-left w-full border-2 border-brand-700 hover:border-frh-yellow bg-brand-950/40 hover:bg-brand-900/60 transition-all p-2 disabled:opacity-40 disabled:cursor-not-allowed"
    >
      <p className="font-mono text-xs text-gray-200 truncate mb-1.5">{player.name}</p>
      <div className="flex flex-wrap gap-1 items-center">
        <RoleBadge role={player.role} />
        {(player.secondaryRoles ?? []).map(r => <RoleBadge key={r} role={r} secondary />)}
      </div>
      {player.timezone && (
        <p className="font-mono text-[9px] text-gray-600 mt-1 truncate">
          {player.timezone.replace('Standard Time', '').replace('Daylight Time', '').trim()}
        </p>
      )}
    </button>
  );
}

function PlayerDraftBoard({ draftId, divisionId, teams }) {
  const [state, setState] = useState(null);
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    const es = new EventSource(`/api/player-drafts/${draftId}/stream`);
    es.addEventListener('state', (e) => setState(JSON.parse(e.data)));
    es.addEventListener('error', () => es.close());
    return () => es.close();
  }, [draftId]);

  if (!state) return <p className="text-xs text-gray-600 py-4 text-center">Connecting to draft stream…</p>;

  const { draft, eligiblePlayers = [], picks = [], currentTeamId, secondsRemaining } = state;
  const divTeams = teams.filter(t => t.divisionId === divisionId);
  const currentTeam = divTeams.find(t => t.id === currentTeamId);

  const picksByTeam = {};
  for (const p of picks) {
    if (!picksByTeam[p.teamId]) picksByTeam[p.teamId] = [];
    picksByTeam[p.teamId].push(p);
  }

  const doPick = async (playerId) => {
    if (!currentTeamId || picking) return;
    setPicking(true);
    const res = await postJson(`/api/player-drafts/${draftId}/pick`, { playerId, teamId: currentTeamId });
    setPicking(false);
    if (res.error) alert(res.error);
  };

  return (
    <div className="space-y-4 pt-3 border-t border-brand-700">
      {/* Current turn banner */}
      <div className={`px-3 py-2 border-2 ${draft.status === 'active' ? 'border-frh-yellow/50 bg-frh-yellow/5' : 'border-brand-700'}`}>
        <p className="font-mono text-xs text-gray-300">
          {draft.status === 'active' && currentTeam ? (
            <>Pick <span className="text-frh-yellow font-bold">{draft.currentPickIndex + 1}</span> — <span className="text-frh-yellow">{currentTeam.name}</span> is on the clock{secondsRemaining !== null && secondsRemaining !== undefined ? <span className="text-gray-500"> ({secondsRemaining}s)</span> : ''}</>
          ) : (
            <span className="capitalize text-gray-500">{draft.status}</span>
          )}
        </p>
      </div>

      {/* Team columns */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {divTeams.map(team => (
          <div key={team.id} className={`border-2 p-2 min-h-[60px] ${team.id === currentTeamId ? 'border-frh-yellow' : 'border-brand-700'}`}>
            <p className="font-ui text-[10px] uppercase text-gray-500 mb-2">{team.tag}</p>
            <div className="space-y-1">
              {(picksByTeam[team.id] ?? []).map(p => (
                <div key={p.id} className="flex items-center gap-1.5">
                  <RoleBadge role={p.player.role} />
                  <span className="font-mono text-[10px] text-gray-300 truncate">{p.player.name}</span>
                </div>
              ))}
              {!(picksByTeam[team.id]?.length) && (
                <p className="text-[9px] text-gray-700">No picks yet</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Available player cards */}
      {draft.status === 'active' && (
        <div>
          <p className="font-ui text-[10px] uppercase tracking-widest text-gray-500 mb-2">
            Available — {eligiblePlayers.length} players
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
            {eligiblePlayers.map(p => (
              <PlayerCard key={p.id} player={p} onPick={() => doPick(p.id)} disabled={picking || !currentTeamId || draft.status !== 'active'} />
            ))}
          </div>
          {eligiblePlayers.length === 0 && (
            <p className="text-xs text-gray-600 text-center py-4">All players have been drafted.</p>
          )}
        </div>
      )}
    </div>
  );
}

const SUBMISSION_STATUS_COLOR = {
  pending: 'blue',
  in_review: 'purple',
  approved: 'lime',
  rejected: 'orange',
  superseded: 'cream',
};

function PlayerDraftPanel({ playerDrafts, seasons, teams, onRefresh }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [form, setForm] = useState({ seasonId: '', divisionId: '', name: '', rounds: 5, pickTimerSeconds: 120 });
  const [boardId, setBoardId] = useState(null);

  const allDivisions = seasons.flatMap((s) =>
    s.divisions.map((d) => ({ ...d, seasonName: s.name, label: `${s.name} — ${d.name}` }))
  );

  const create = async () => {
    setErr('');
    if (!form.seasonId || !form.divisionId) { setErr('Season and division are required.'); return; }
    setBusy(true);
    const res = await postJson('/api/player-drafts', {
      seasonId: form.seasonId,
      divisionId: form.divisionId,
      name: form.name.trim() || undefined,
      rounds: parseInt(form.rounds, 10) || 5,
      pickTimerSeconds: parseInt(form.pickTimerSeconds, 10) || 0,
    });
    setBusy(false);
    if (res.error) { setErr(res.error); return; }
    setForm({ seasonId: form.seasonId, divisionId: form.divisionId, name: '', rounds: 5, pickTimerSeconds: 120 });
    await onRefresh();
  };

  const act = async (id, action, extra = {}) => {
    const res = await patchJson(`/api/player-drafts/${id}`, { action, ...extra });
    if (res.error) { alert(res.error); return; }
    await onRefresh();
  };

  const complete = async (id) => {
    if (!confirm('Complete this draft and create TeamMember rows? This cannot be undone.')) return;
    const res = await postJson(`/api/player-drafts/${id}/complete`, {});
    if (res.error) { alert(res.error); return; }
    alert(`Draft completed. ${res.teamMembersCreated} members created, ${res.teamMembersUpdated} updated.`);
    await onRefresh();
  };

  const STATUS_COLOR = { pending: 'blue', active: 'lime', paused: 'purple', complete: 'cream' };

  return (
    <div className="space-y-6">
      <RetroWindow title="CREATE PLAYER DRAFT">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-[10px] font-ui uppercase text-gray-600 mb-1">Season</label>
            <select
              value={form.seasonId}
              onChange={(e) => setForm({ ...form, seasonId: e.target.value, divisionId: '' })}
              className="select-field w-full"
            >
              <option value="">Select season…</option>
              {seasons.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-ui uppercase text-gray-600 mb-1">Division</label>
            <select
              value={form.divisionId}
              onChange={(e) => setForm({ ...form, divisionId: e.target.value })}
              className="select-field w-full"
              disabled={!form.seasonId}
            >
              <option value="">Select division…</option>
              {allDivisions.filter((d) => d.seasonId === form.seasonId).map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-ui uppercase text-gray-600 mb-1">Draft Name (optional)</label>
            <input
              placeholder="e.g. S9 Hospice Player Draft"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="input-field w-full"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-ui uppercase text-gray-600 mb-1">Rounds</label>
              <input
                type="number"
                min="1"
                max="20"
                value={form.rounds}
                onChange={(e) => setForm({ ...form, rounds: e.target.value })}
                className="input-field w-full"
              />
            </div>
            <div>
              <label className="block text-[10px] font-ui uppercase text-gray-600 mb-1">Timer (sec, 0=off)</label>
              <input
                type="number"
                min="0"
                value={form.pickTimerSeconds}
                onChange={(e) => setForm({ ...form, pickTimerSeconds: e.target.value })}
                className="input-field w-full"
              />
            </div>
          </div>
        </div>
        {err && <p className="text-xs text-red-400 mb-2">{err}</p>}
        <BrutalButton onClick={create} disabled={busy}>
          {busy ? 'Creating…' : 'Create Draft Room'}
        </BrutalButton>
      </RetroWindow>

      {playerDrafts.length === 0 ? (
        <p className="text-sm text-gray-600 text-center py-4">No player drafts yet.</p>
      ) : (
        <RetroWindow title="PLAYER DRAFTS">
          <div className="space-y-3">
            {playerDrafts.map((pd) => {
              const divTeams = teams.filter((t) => t.divisionId === pd.divisionId);
              return (
                <div key={pd.id} className="border-2 border-brand-700 hover:border-frh-yellow/40 transition-all">
                  <div className="flex flex-wrap items-center gap-3 px-3 py-3 bg-brand-950/40">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-ui text-sm text-gray-200">{pd.name}</span>
                        <PixelBadge label={pd.status} color={STATUS_COLOR[pd.status] ?? 'blue'} />
                        <span className="text-[10px] text-gray-500">
                          {pd.season?.name} / {pd.division?.name}
                        </span>
                      </div>
                      <span className="text-[10px] text-gray-600">
                        {pd.picks?.length ?? 0} picks · {pd.rounds} rounds · {divTeams.length} teams
                        {pd.pickTimerSeconds > 0 ? ` · ${pd.pickTimerSeconds}s timer` : ' · no timer'}
                      </span>
                    </div>
                    <div className="flex gap-2 shrink-0 flex-wrap">
                      <a
                        href={`/api/player-drafts/${pd.id}/stream`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hidden"
                      />
                      {pd.status === 'pending' && (
                        <BrutalButton
                          onClick={() => act(pd.id, 'start')}
                          size="sm"
                          disabled={divTeams.length === 0}
                        >
                          Start
                        </BrutalButton>
                      )}
                      {pd.status === 'active' && (
                        <>
                          <BrutalButton onClick={() => act(pd.id, 'pause')} variant="secondary" size="sm">Pause</BrutalButton>
                          <BrutalButton onClick={() => act(pd.id, 'skip')} variant="secondary" size="sm">Skip Turn</BrutalButton>
                          <BrutalButton onClick={() => act(pd.id, 'undo')} variant="secondary" size="sm">Undo Pick</BrutalButton>
                          <BrutalButton onClick={() => complete(pd.id)} size="sm">Complete</BrutalButton>
                        </>
                      )}
                      {pd.status === 'paused' && (
                        <BrutalButton onClick={() => act(pd.id, 'resume')} size="sm">Resume</BrutalButton>
                      )}
                    </div>
                  </div>
                  {(pd.status === 'active' || pd.status === 'paused') && (
                    <button
                      onClick={() => setBoardId(boardId === pd.id ? null : pd.id)}
                      className="ml-auto font-mono text-[10px] text-frh-yellow underline hover:text-frh-orange"
                    >
                      {boardId === pd.id ? 'Hide Board' : 'View Board'}
                    </button>
                  )}
                  {pd.status === 'pending' && divTeams.length === 0 && (
                    <div className="px-3 py-2 border-t border-brand-700 bg-brand-900/20">
                      <p className="text-[10px] text-yellow-500">
                        No teams found in {pd.division?.name}. Add teams in the Teams tab before starting.
                      </p>
                    </div>
                  )}
                  {boardId === pd.id && (
                    <div className="px-3 pb-3">
                      <PlayerDraftBoard draftId={pd.id} divisionId={pd.divisionId} teams={teams} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </RetroWindow>
      )}
    </div>
  );
}

// ─── Review Queue Panel ───────────────────────────────

function ReviewQueuePanel({ submissions, onRefresh }) {
  const [busy, setBusy] = useState({});
  const [rejectId, setRejectId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [recomputing, setRecomputing] = useState(false);
  const [recomputedAt, setRecomputedAt] = useState(null);

  const recomputeStandings = async () => {
    setRecomputing(true);
    try {
      const res = await fetch('/api/standings/recompute', { method: 'POST' });
      const data = await res.json();
      if (data.ok) setRecomputedAt(new Date(data.recomputedAt).toLocaleTimeString());
      else alert(data.error ?? 'Recompute failed');
    } catch {
      alert('Recompute failed');
    } finally {
      setRecomputing(false);
    }
  };

  const act = async (id, action, extra = {}) => {
    setBusy((b) => ({ ...b, [id]: true }));
    const res = await patchJson(`/api/submissions/${id}`, { action, ...extra });
    setBusy((b) => ({ ...b, [id]: false }));
    if (res.error) { alert(res.error); return; }
    await onRefresh();
  };

  const startReject = (id) => { setRejectId(id); setRejectReason(''); };

  const confirmReject = async () => {
    if (!rejectReason.trim()) return;
    await act(rejectId, 'reject', { rejectionReason: rejectReason.trim() });
    setRejectId(null);
    setRejectReason('');
  };

  return (
    <div className="space-y-4">
      {rejectId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
          <RetroWindow title="REJECT SUBMISSION" titleBarColor="blue" className="w-full max-w-md">
            <p className="text-sm text-gray-400 mb-3">Provide a rejection reason. Captains will see this.</p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              placeholder="e.g. Score not matching VOD, please resubmit with screenshot."
              className="input-field w-full mb-3"
            />
            <div className="flex gap-2">
              <BrutalButton onClick={confirmReject} disabled={!rejectReason.trim()} variant="danger">Confirm Reject</BrutalButton>
              <BrutalButton onClick={() => setRejectId(null)} variant="secondary">Cancel</BrutalButton>
            </div>
          </RetroWindow>
        </div>
      )}

      <RetroWindow title="MATCH RESULT REVIEW QUEUE">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-ui text-sm uppercase tracking-widest text-frh-yellow">Open Submissions</h2>
          <div className="flex items-center gap-2 flex-wrap">
            <PixelBadge label={`${submissions.length} open`} color={submissions.length > 0 ? 'orange' : 'cream'} />
            <BrutalButton onClick={onRefresh} variant="secondary" size="sm">Refresh</BrutalButton>
            <BrutalButton onClick={recomputeStandings} disabled={recomputing} variant="secondary" size="sm">
              {recomputing ? 'Working…' : 'Recompute Standings'}
            </BrutalButton>
            {recomputedAt && (
              <span className="font-mono text-[10px] text-frh-lime">Flushed {recomputedAt}</span>
            )}
          </div>
        </div>

        {submissions.length === 0 ? (
          <p className="text-sm text-gray-600 text-center py-6">No pending submissions. Queue is clear.</p>
        ) : (
          <div className="space-y-4">
            {submissions.map((sub) => (
              <div key={sub.id} className="border-2 border-brand-700 hover:border-frh-yellow/40 transition-all">
                <div className="px-3 py-3 bg-brand-950/40">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-ui text-xs text-gray-400">
                          Week {sub.match?.week} · {sub.match?.homeTeam?.tag} vs {sub.match?.awayTeam?.tag}
                        </span>
                        {sub.game && (
                          <span className="text-[10px] text-gray-500">G{sub.game.gameNumber}</span>
                        )}
                        <PixelBadge label={sub.status} color={SUBMISSION_STATUS_COLOR[sub.status] ?? 'blue'} />
                      </div>
                      {sub.reportedWinnerTeamId && (
                        <p className="text-xs text-gray-300">
                          Reported winner: <span className="text-frh-yellow font-display font-bold">{
                            sub.match?.homeTeam?.id === sub.reportedWinnerTeamId
                              ? sub.match?.homeTeam?.name
                              : sub.match?.awayTeam?.name
                          }</span>
                        </p>
                      )}
                      {sub.notes && (
                        <p className="text-xs text-gray-500 mt-1 italic">&ldquo;{sub.notes}&rdquo;</p>
                      )}
                      {sub.attachments?.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {sub.attachments.map((att) => (
                            <a
                              key={att.id}
                              href={att.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] font-ui uppercase text-frh-yellow underline border border-brand-600 px-2 py-0.5"
                            >
                              {att.kind}
                            </a>
                          ))}
                        </div>
                      )}
                      <p className="text-[10px] text-gray-600 mt-1 font-mono">{new Date(sub.createdAt).toLocaleString()}</p>
                    </div>
                    <div className="flex flex-col gap-2 shrink-0">
                      {sub.status === 'pending' && (
                        <BrutalButton
                          onClick={() => act(sub.id, 'in_review')}
                          disabled={busy[sub.id]}
                          variant="secondary"
                          size="sm"
                        >
                          Mark In Review
                        </BrutalButton>
                      )}
                      <BrutalButton
                        onClick={() => act(sub.id, 'approve')}
                        disabled={busy[sub.id]}
                        size="sm"
                      >
                        {busy[sub.id] ? 'Working…' : 'Approve'}
                      </BrutalButton>
                      <BrutalButton
                        onClick={() => startReject(sub.id)}
                        disabled={busy[sub.id]}
                        variant="danger"
                        size="sm"
                      >
                        Reject
                      </BrutalButton>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </RetroWindow>
    </div>
  );
}

// ─── Gods Panel ──────────────────────────────────────

function GodsPanel({ gods, onRefresh }) {
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ name: '', role: 'Mage', godClass: 'Magical' });
  const [filterRole, setFilterRole] = useState('All');
  const [busy, setBusy] = useState(false);

  const reset = () => { setForm({ name: '', role: 'Mage', godClass: 'Magical' }); setEditId(null); setShowForm(false); };

  const submit = async () => {
    if (!form.name.trim()) return;
    setBusy(true);
    await postJson('/api/gods', editId ? { id: editId, ...form } : form);
    reset();
    await onRefresh();
    setBusy(false);
  };

  const edit = (g) => { setForm({ name: g.name, role: g.role, godClass: g.godClass }); setEditId(g.id); setShowForm(true); };

  const remove = async (id) => {
    if (!confirm('Delete this god?')) return;
    const result = await del(`/api/gods?id=${id}`);
    if (result.error) { alert(result.error); return; }
    onRefresh();
  };

  const filtered = filterRole === 'All' ? gods : gods.filter((g) => g.role === filterRole);

  return (
    <RetroWindow title="GOD DATABASE">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-ui text-sm uppercase tracking-widest text-frh-yellow">Gods ({gods.length})</h2>
        <BrutalButton onClick={() => { reset(); setShowForm(!showForm); }} size="sm">{showForm ? 'Cancel' : '+ Add God'}</BrutalButton>
      </div>

      {showForm && (
        <RetroWindow title={editId ? 'EDIT GOD' : 'NEW GOD'} titleBarColor="purple" className="mb-4 animate-fade-in">
          <input placeholder="God name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-field" />
          <div className="grid grid-cols-2 gap-3">
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="select-field">
              {GOD_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <select value={form.godClass} onChange={(e) => setForm({ ...form, godClass: e.target.value })} className="select-field">
              {GOD_CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <BrutalButton onClick={submit} disabled={busy || !form.name.trim()} className="w-full">{busy ? 'Saving...' : editId ? 'Update God' : 'Add God'}</BrutalButton>
        </RetroWindow>
      )}

      <div className="mb-3">
        <RoleFilter options={['All', ...GOD_ROLES]} value={filterRole} onChange={setFilterRole} />
      </div>

      <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-brand-800">
            <tr className="text-[10px] font-ui uppercase tracking-widest text-gray-500 border-b border-brand-600/30">
              <th className="text-left py-2 px-2">Name</th>
              <th className="text-left py-2 px-2">Role</th>
              <th className="text-left py-2 px-2">Class</th>
              <th className="text-right py-2 px-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((g) => (
              <tr key={g.id} className="border-b border-brand-700/30 hover:bg-brand-700/20 transition-colors">
                <td className="py-2 px-2 font-display font-medium text-gray-300">{g.name}</td>
                <td className="py-2 px-2 text-gray-500">{g.role}</td>
                <td className="py-2 px-2 text-gray-500">{g.godClass}</td>
                <td className="py-2 px-2 text-right">
                  <div className="flex justify-end gap-2"><BrutalButton onClick={() => edit(g)} variant="secondary" size="sm">Edit</BrutalButton><BrutalButton onClick={() => remove(g.id)} variant="danger" size="sm">Delete</BrutalButton></div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </RetroWindow>
  );
}
