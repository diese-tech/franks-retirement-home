'use client';

import { useState, useCallback, useTransition } from 'react';
import { RetroWindow, BrutalButton } from '@/components/ui';
import HomepageClient from '@/app/HomepageClient';

// ─── Toolbar ──────────────────────────────────────────────────────────────────

function EditorToolbar({
  hasDraft, hasPublished, savedAt, publishedAt,
  isDirty, isSaving, isPublishing, isResetting,
  onSave, onPublish, onReset, onPreview,
}) {
  const fmtTime = (iso) => {
    if (!iso) return null;
    try {
      return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    } catch { return null; }
  };

  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 100,
      background: 'var(--frh-bg, #0a0a0a)',
      borderBottom: '2px solid #ffd400',
      padding: '10px 16px',
      display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10,
    }}>
      {/* Brand */}
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#ffd400', letterSpacing: '0.15em', whiteSpace: 'nowrap' }}>
        ★ HOMEPAGE EDITOR
      </span>

      <div style={{ flex: 1 }} />

      {/* Status text */}
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--frh-text-muted, #666)', whiteSpace: 'nowrap' }}>
        {isSaving    ? '⟳ Saving…'
         : isPublishing ? '⟳ Publishing…'
         : isResetting  ? '⟳ Resetting…'
         : isDirty      ? '● Unsaved changes'
         : savedAt      ? `✓ Draft saved ${fmtTime(savedAt)}`
         : 'No draft — showing defaults'}
      </span>

      {hasPublished && publishedAt && (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#4ade80', whiteSpace: 'nowrap' }}>
          ✓ Published {fmtTime(publishedAt)}
        </span>
      )}

      {/* Actions */}
      <BrutalButton onClick={onSave}    disabled={isSaving || isPublishing} size="sm" variant="secondary">
        {isSaving ? 'Saving…' : 'Save Draft'}
      </BrutalButton>

      <BrutalButton onClick={onPublish} disabled={isSaving || isPublishing} size="sm" variant="primary">
        {isPublishing ? 'Publishing…' : 'Publish'}
      </BrutalButton>

      <BrutalButton onClick={onPreview} size="sm" variant="secondary">
        Preview Public ↗
      </BrutalButton>

      <BrutalButton onClick={onReset}   disabled={isResetting || (!hasDraft)} size="sm" variant="danger">
        {isResetting ? 'Resetting…' : 'Reset to Default'}
      </BrutalButton>
    </div>
  );
}


// ─── Toast notifications ──────────────────────────────────────────────────────

function Toast({ message, kind = 'success', onDismiss }) {
  const colors = {
    success: { bg: 'rgba(74,222,128,0.12)', border: '#4ade80', text: '#4ade80' },
    error:   { bg: 'rgba(248,113,113,0.12)', border: '#f87171', text: '#f87171' },
    info:    { bg: 'rgba(255,212,0,0.10)',   border: '#ffd400', text: '#ffd400' },
  };
  const c = colors[kind] ?? colors.info;
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
      background: c.bg, border: `1px solid ${c.border}`, color: c.text,
      fontFamily: 'var(--font-mono)', fontSize: 12, padding: '10px 16px',
      display: 'flex', alignItems: 'center', gap: 12, maxWidth: 380,
      boxShadow: `0 0 20px ${c.border}33`,
    }}>
      <span style={{ flex: 1 }}>{message}</span>
      <button onClick={onDismiss} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 14, lineHeight: 1 }}>✕</button>
    </div>
  );
}

// ─── Password gate (reuses admin session from parent dashboard) ───────────────

function PasswordGate({ onAuthed }) {
  const [pw, setPw] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    const res = await fetch('/api/admin-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pw }),
    });
    if (res.ok) { sessionStorage.setItem('frh_admin', '1'); onAuthed(); }
    else { setError('Incorrect password'); setBusy(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8">
      <RetroWindow title="AUTHENTICATION REQUIRED" titleBarColor="blue" className="w-full max-w-sm">
        <h1 className="font-ui text-sm uppercase tracking-widest text-frh-yellow mb-1">Admin Access</h1>
        <p className="text-sm text-gray-500 mb-6">Enter the admin password to continue.</p>
        <form onSubmit={submit} className="space-y-4">
          <input type="password" value={pw} onChange={e => setPw(e.target.value)}
            placeholder="Password" className="input-field w-full" autoFocus />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <BrutalButton type="submit" disabled={busy || !pw} className="w-full">
            {busy ? 'Checking…' : 'Enter the Compound'}
          </BrutalButton>
        </form>
      </RetroWindow>
    </div>
  );
}


// ─── Main editor component ────────────────────────────────────────────────────

export default function HomepageEditorClient({
  initialContent,
  hasDraft: initialHasDraft,
  hasPublished: initialHasPublished,
  publishedAt: initialPublishedAt,
  savedAt: initialSavedAt,
  // DB-driven homepage props passed through to HomepageClient
  activeSeason, liveMatches, upcomingMatches, recentDrafts,
  divisionStandings, playerCount, matchCount,
}) {
  const [authed, setAuthed] = useState(() => {
    if (typeof window !== 'undefined') return sessionStorage.getItem('frh_admin') === '1';
    return false;
  });

  // Validate session on mount
  useState(() => {
    if (typeof window === 'undefined') return;
    if (sessionStorage.getItem('frh_admin') !== '1') return;
    fetch('/api/admin-auth').then(r => {
      if (r.status === 401) { sessionStorage.removeItem('frh_admin'); setAuthed(false); }
      else setAuthed(true);
    }).catch(() => setAuthed(true));
  });

  const [content, setContent] = useState(initialContent);
  const [isDirty, setIsDirty] = useState(false);
  const [hasDraft, setHasDraft] = useState(initialHasDraft);
  const [hasPublished, setHasPublished] = useState(initialHasPublished);
  const [savedAt, setSavedAt] = useState(initialSavedAt);
  const [publishedAt, setPublishedAt] = useState(initialPublishedAt);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [toast, setToast] = useState(null); // { message, kind }
  const [, startTransition] = useTransition();

  const showToast = (message, kind = 'success') => {
    setToast({ message, kind });
    setTimeout(() => setToast(null), 4000);
  };

  // ── Content change handler ────────────────────────────────────────────────
  const handleContentChange = useCallback((field, value) => {
    startTransition(() => {
      setContent(prev => ({ ...prev, [field]: value }));
      setIsDirty(true);
    });
  }, []);

  // ── Save Draft ────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/admin/homepage-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save', ...content }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Save failed');
      setIsDirty(false);
      setHasDraft(true);
      setSavedAt(data.draft?.savedAt ?? new Date().toISOString());
      showToast('Draft saved', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Publish ───────────────────────────────────────────────────────────────
  const handlePublish = async () => {
    if (!confirm('Publish this draft? The public homepage will update immediately.')) return;
    setIsPublishing(true);
    try {
      // Save draft first to ensure consistency, then publish
      const saveRes = await fetch('/api/admin/homepage-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save', ...content }),
      });
      if (!saveRes.ok) {
        const d = await saveRes.json();
        throw new Error(d.error ?? 'Save before publish failed');
      }

      const pubRes = await fetch('/api/admin/homepage-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'publish', ...content }),
      });
      const pubData = await pubRes.json();
      if (!pubRes.ok) throw new Error(pubData.error ?? 'Publish failed');

      setIsDirty(false);
      setHasDraft(true);
      setHasPublished(true);
      setSavedAt(new Date().toISOString());
      setPublishedAt(pubData.published?.publishedAt ?? new Date().toISOString());
      showToast('Published! Public homepage updated.', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setIsPublishing(false);
    }
  };

  // ── Reset to Default ──────────────────────────────────────────────────────
  const handleReset = async () => {
    if (!confirm('Reset to defaults? This will delete your draft. Published content is not affected.')) return;
    setIsResetting(true);
    try {
      const res = await fetch('/api/admin/homepage-content?target=draft', { method: 'DELETE' });
      if (!res.ok) throw new Error('Reset failed');
      // Re-import defaults dynamically to avoid circular dep issues
      const { HOMEPAGE_DEFAULTS } = await import('@/lib/homepageDefaults');
      setContent({ ...HOMEPAGE_DEFAULTS });
      setIsDirty(false);
      setHasDraft(false);
      setSavedAt(null);
      showToast('Reset to defaults. Draft deleted.', 'info');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setIsResetting(false);
    }
  };

  // ── Preview ───────────────────────────────────────────────────────────────
  const handlePreview = () => {
    window.open('/?preview=draft', '_blank');
  };

  if (!authed) return <PasswordGate onAuthed={() => setAuthed(true)} />;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--frh-bg, #0a0a0a)' }}>
      <EditorToolbar
        hasDraft={hasDraft}
        hasPublished={hasPublished}
        savedAt={savedAt}
        publishedAt={publishedAt}
        isDirty={isDirty}
        isSaving={isSaving}
        isPublishing={isPublishing}
        isResetting={isResetting}
        onSave={handleSave}
        onPublish={handlePublish}
        onPreview={handlePreview}
        onReset={handleReset}
      />

      {/* Editor mode banner */}
      <div style={{
        background: 'rgba(255,212,0,0.06)',
        borderBottom: '1px solid rgba(255,212,0,0.2)',
        padding: '6px 16px',
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        color: 'rgba(255,212,0,0.7)',
        letterSpacing: '0.1em',
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
      }}>
        <span>★ ADMIN EDITOR MODE</span>
        <span style={{ opacity: 0.5 }}>·</span>
        <span>Click any text field to edit inline</span>
        <span style={{ opacity: 0.5 }}>·</span>
        <span>Use ▲▼ to reorder, ✕ to remove, + to add items</span>
        <span style={{ opacity: 0.5 }}>·</span>
        <span>Toggle 👁 VISIBLE / 🚫 HIDDEN to show/hide sections</span>
        {isDirty && (
          <>
            <span style={{ opacity: 0.5 }}>·</span>
            <span style={{ color: '#ffd400', fontWeight: 700 }}>Unsaved changes</span>
          </>
        )}
      </div>

      {/* The actual homepage rendered in editor mode */}
      <HomepageClient
        mode="editor"
        editableContent={content}
        onContentChange={handleContentChange}
        activeSeason={activeSeason}
        liveMatches={liveMatches}
        upcomingMatches={upcomingMatches}
        recentDrafts={recentDrafts}
        divisionStandings={divisionStandings}
        playerCount={playerCount}
        matchCount={matchCount}
      />

      {/* Toast */}
      {toast && (
        <Toast message={toast.message} kind={toast.kind} onDismiss={() => setToast(null)} />
      )}
    </div>
  );
}
