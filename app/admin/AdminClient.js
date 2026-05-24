'use client';

import { useState, useEffect } from 'react';
import { PLAYER_ROLES, GOD_ROLES, GOD_CLASSES, ROLE_COLORS } from '@/lib/constants';
import RoleFilter from '@/components/RoleFilter';
import { RetroWindow, BrutalButton, PixelBadge, StatusBadge } from '@/components/ui';

async function api(url, opts) { const r = await fetch(url, opts); return r.json(); }
function postJson(url, body) { return api(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); }
function del(url) { return api(url, { method: 'DELETE' }); }

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

export default function AdminClient({ initialPlayers, initialGods, initialDrafts }) {
  const [authed, setAuthed] = useState(false);
  const [players, setPlayers] = useState(initialPlayers);
  const [gods, setGods] = useState(initialGods);
  const [drafts, setDrafts] = useState(initialDrafts);
  const [tab, setTab] = useState('drafts');

  useEffect(() => {
    if (sessionStorage.getItem('frh_admin') !== '1') return;
    // Sanity-check the cookie is still valid. The sessionStorage flag is a
    // UI hint only — when ADMIN_AUTH_REQUIRED is on, the cookie may have
    // expired (12h TTL) while the flag persists.
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
      .catch(() => {
        if (!cancelled) setAuthed(true);
      });
    return () => { cancelled = true; };
  }, []);

  if (!authed) return <PasswordGate onAuthed={() => setAuthed(true)} />;

  const refreshPlayers = async () => setPlayers(await api('/api/players'));
  const refreshGods = async () => setGods(await api('/api/gods'));
  const refreshDrafts = async () => setDrafts(await api('/api/drafts'));

  const tabs = [
    { key: 'drafts',  label: 'Drafts',  count: drafts.length },
    { key: 'players', label: 'Players', count: players.length },
    { key: 'import',  label: 'Import',  count: null },
    { key: 'gods',    label: 'Gods',    count: gods.length },
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

        {tab === 'drafts'  && <DraftsPanel  drafts={drafts}   onRefresh={refreshDrafts} />}
        {tab === 'players' && <PlayersPanel players={players} onRefresh={refreshPlayers} />}
        {tab === 'import'  && <ImportPanel  onRefresh={refreshPlayers} />}
        {tab === 'gods'    && <GodsPanel    gods={gods}       onRefresh={refreshGods} />}
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
  // shareTarget is { id, name } only — keys are looked up on demand and
  // stored in keyCache so they never appear in the SSR payload.
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
      const keys = {
        adminKey: draft.adminKey,
        captainAKey: draft.captainAKey,
        captainBKey: draft.captainBKey,
      };
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
      // POST /api/drafts returns the row including keys (the caller IS the
      // admin who just created it). Cache them here so we don't have to
      // round-trip for the share modal we're about to open.
      setKeyCache((prev) => ({
        ...prev,
        [draft.id]: {
          adminKey: draft.adminKey,
          captainAKey: draft.captainAKey,
          captainBKey: draft.captainBKey,
        },
      }));
    }
    await onRefresh();
    if (draft.id) {
      setShareError('');
      setShareTarget({ id: draft.id, name: draft.name });
    }
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

  // Issue #14: the old "Reopen" button flipped status to 'picking' without
  // nulling any pick, leaving the draft in an unusable state. We now call
  // the atomic reopenLastPick action, which requires the per-draft adminKey.
  const reopenLastPick = async (d) => {
    const keys = keyCache[d.id] ?? await fetchKeys(d.id);
    if (!keys?.adminKey) {
      alert('Could not load admin key for this draft.');
      return;
    }
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
    if (!keys?.adminKey) {
      window.location.href = `/draft/${d.id}`;
      return;
    }
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
            <input placeholder="Division (e.g. Canes)" value={form.division} onChange={(e) => setForm({ ...form, division: e.target.value })} className="input-field" />
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

// ─── Import Panel ────────────────────────────────────

const ROLE_ALIASES = {
  solo: 'Solo', jungle: 'Jungle', mid: 'Mid', support: 'Support',
  carry: 'Carry', adc: 'Carry', fill: 'Fill',
};

function parseCSV(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  // Skip header row
  return lines.slice(1).map((line) => {
    // Simple CSV split respecting quoted fields
    const cols = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQ = !inQ; }
      else if (ch === ',' && !inQ) { cols.push(cur); cur = ''; }
      else { cur += ch; }
    }
    cols.push(cur);

    const rawName = (cols[6] || '').replace(/\(.*?\)/g, '').trim();
    const rawDiscord = (cols[8] || '').trim();
    const rawRole = (cols[14] || '').trim().toLowerCase();
    const role = ROLE_ALIASES[rawRole] || null;

    return { name: rawName, discordUsername: rawDiscord, role, _rawRole: cols[14]?.trim() };
  }).filter((r) => r.name);
}

function ImportPanel({ onRefresh }) {
  const [division, setDivision] = useState('');
  const [csvText, setCsvText] = useState('');
  const [rows, setRows] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  const parse = () => {
    const parsed = parseCSV(csvText);
    setRows(parsed);
    setResult(null);
  };

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
      division: division.trim() || null,
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
            placeholder="Division label (e.g. Canes, Walker, Rollator, Scooter)"
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
            <BrutalButton onClick={parse} disabled={!csvText.trim()} size="sm">Parse & Preview</BrutalButton>
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
                  <th className="text-left py-2 px-2">Role</th>
                  <th className="text-left py-2 px-2">Division</th>
                  <th className="text-left py-2 px-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className={`border-b border-brand-700/30 ${!r.role ? 'bg-yellow-500/5' : ''}`}>
                    <td className="py-1.5 px-2 font-display font-medium text-gray-300">{r.name}</td>
                    <td className="py-1.5 px-2 font-mono text-gray-500">{r.discordUsername || '—'}</td>
                    <td className="py-1.5 px-2">
                      {r.role
                        ? <span className={`text-[9px] font-display font-bold uppercase px-1.5 py-0.5 rounded ${ROLE_COLORS[r.role]}`}>{r.role}</span>
                        : (
                          <select value="" onChange={(e) => updateRow(i, 'role', e.target.value)} className="select-field text-[10px] py-0.5 px-1">
                            <option value="">Pick role…</option>
                            {PLAYER_ROLES.map((ro) => <option key={ro} value={ro}>{ro}</option>)}
                          </select>
                        )
                      }
                    </td>
                    <td className="py-1.5 px-2 text-gray-500">{division || <span className="text-gray-700">—</span>}</td>
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
