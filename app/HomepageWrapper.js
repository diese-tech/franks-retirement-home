'use client';

import { useState, useCallback, useTransition } from 'react';
import { BrutalButton } from '@/components/ui';
import HomepageClient from '@/app/HomepageClient';

// ─── Editor toolbar (sticky, only visible when admin is logged in) ─────────────

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
    <div
      data-testid="editor-toolbar"
      style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'var(--frh-bg, #0a0a0a)',
        borderBottom: '2px solid #ffd400',
        padding: '8px 12px',
        display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8,
        minWidth: 0,
      }}
    >
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#ffd400', letterSpacing: '0.15em', whiteSpace: 'nowrap' }}>
        ★ EDITOR
      </span>

      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--frh-text-muted, #666)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }}>
        {isSaving      ? '⟳ Saving…'
         : isPublishing ? '⟳ Publishing…'
         : isResetting  ? '⟳ Resetting…'
         : isDirty      ? '● Unsaved'
         : savedAt      ? `✓ Saved ${fmtTime(savedAt)}`
         : 'No draft'}
      </span>

      {hasPublished && publishedAt && (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#4ade80', whiteSpace: 'nowrap' }}>
          ✓ {fmtTime(publishedAt)}
        </span>
      )}

      <div style={{ flex: 1, minWidth: 8 }} />

      <BrutalButton onClick={onSave}    disabled={isSaving || isPublishing} size="sm" variant="secondary" className="min-h-[36px]">
        {isSaving ? '…' : 'Save'}
      </BrutalButton>

      <BrutalButton onClick={onPublish} disabled={isSaving || isPublishing} size="sm" variant="primary" className="min-h-[36px]">
        {isPublishing ? '…' : 'Publish'}
      </BrutalButton>

      <BrutalButton onClick={onPreview} size="sm" variant="secondary" className="hidden sm:inline-flex min-h-[36px]">
        Preview ↗
      </BrutalButton>

      <BrutalButton onClick={onReset} disabled={isResetting || (!hasDraft)} size="sm" variant="danger" className="min-h-[36px]">
        {isResetting ? '…' : 'Reset'}
      </BrutalButton>
    </div>
  );
}

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

// ─── Main wrapper ─────────────────────────────────────────────────────────────

export default function HomepageWrapper({
  isAdmin,
  editableContent,
  // DB-driven props passed through to HomepageClient
  activeSeason, liveMatches, upcomingMatches, recentDrafts,
  divisionStandings, playerCount, godCount, matchCount, recentResults,
  // Editor metadata (admin only)
  hasDraft: initialHasDraft = false,
  hasPublished: initialHasPublished = false,
  publishedAt: initialPublishedAt = null,
  savedAt: initialSavedAt = null,
}) {
  const [content, setContent] = useState(editableContent);
  const [isEditing, setIsEditing] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [hasDraft, setHasDraft] = useState(initialHasDraft);
  const [hasPublished, setHasPublished] = useState(initialHasPublished);
  const [savedAt, setSavedAt] = useState(initialSavedAt);
  const [publishedAt, setPublishedAt] = useState(initialPublishedAt);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [toast, setToast] = useState(null);
  const [, startTransition] = useTransition();

  const showToast = (message, kind = 'success') => {
    setToast({ message, kind });
    setTimeout(() => setToast(null), 4000);
  };

  const handleContentChange = useCallback((field, value) => {
    startTransition(() => {
      setContent(prev => ({ ...prev, [field]: value }));
      setIsDirty(true);
    });
  }, []);

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

  const handlePublish = async () => {
    if (!confirm('Publish this draft? The public homepage will update immediately.')) return;
    setIsPublishing(true);
    try {
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

  const handleReset = async () => {
    if (!confirm('Reset to defaults? This will delete your draft. Published content is not affected.')) return;
    setIsResetting(true);
    try {
      const res = await fetch('/api/admin/homepage-content?target=draft', { method: 'DELETE' });
      if (!res.ok) throw new Error('Reset failed');
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

  const handlePreview = () => {
    window.open('/?preview=draft', '_blank');
  };

  const dbProps = {
    activeSeason, liveMatches, upcomingMatches, recentDrafts,
    divisionStandings, playerCount, godCount, matchCount, recentResults,
  };

  // Floating toggle shown to admins in all states
  const editToggle = isAdmin && (
    <button
      onClick={() => setIsEditing(e => !e)}
      title={isEditing ? 'Exit editor' : 'Edit homepage'}
      style={{
        position: 'fixed', bottom: 24, left: 24, zIndex: 10000,
        background: isEditing ? '#ffd400' : 'rgba(255,212,0,0.15)',
        border: '1px solid #ffd400',
        color: isEditing ? '#0a0a0a' : '#ffd400',
        fontFamily: 'var(--font-mono)', fontSize: 11,
        padding: '10px 16px', cursor: 'pointer',
        minHeight: 44, minWidth: 44,
        letterSpacing: '0.1em', whiteSpace: 'nowrap',
        transition: 'background 0.15s, color 0.15s',
      }}
    >
      {isEditing ? '✕ Exit Editor' : '✏ Edit'}
    </button>
  );

  if (!isAdmin || !isEditing) {
    return (
      <>
        <HomepageClient mode="public" editableContent={content} {...dbProps} />
        {editToggle}
      </>
    );
  }

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

      <HomepageClient
        mode="editor"
        editableContent={content}
        onContentChange={handleContentChange}
        {...dbProps}
      />

      {editToggle}

      {toast && (
        <Toast message={toast.message} kind={toast.kind} onDismiss={() => setToast(null)} />
      )}
    </div>
  );
}
