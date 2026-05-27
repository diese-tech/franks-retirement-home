'use client';

import { useState } from 'react';
import Link from 'next/link';
import { RetroWindow, BrutalButton, PixelBadge } from '@/components/ui';

const TYPE_COLORS = {
  announcement: 'blue',
  match_hype: 'orange',
  player_spotlight: 'lime',
  team_roast: 'purple',
  weekly_recap: 'yellow',
};

const TYPE_LABELS = {
  announcement: 'Announcement',
  match_hype: 'Match Hype',
  player_spotlight: 'Spotlight',
  team_roast: 'Team Roast',
  weekly_recap: 'Recap',
};

const VALID_TYPES = ['announcement', 'match_hype', 'player_spotlight', 'team_roast', 'weekly_recap'];

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function BulletinPostClient({ post: initialPost, isAdmin }) {
  const [post, setPost] = useState(initialPost);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(post.title);
  const [type, setType] = useState(post.type);
  const [body, setBody] = useState(post.body || '');
  const [excerpt, setExcerpt] = useState(post.excerpt || '');
  const [toast, setToast] = useState(null);
  const [saving, setSaving] = useState(false);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const guardAdmin = () => {
    if (!isAdmin) {
      showToast("Are you an editor? Hmm, didn't think so...");
      return true;
    }
    return false;
  };

  const handleSave = async () => {
    if (guardAdmin()) return;
    if (!title.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/bulletin-board/${post.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, type, body, excerpt: excerpt || undefined }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || 'Failed to save');
        setSaving(false);
        return;
      }
      const updated = await res.json();
      setPost(updated);
      setEditing(false);
      showToast('Saved!');
    } catch {
      showToast('Failed to save');
    }
    setSaving(false);
  };

  const handleStatusChange = async (newStatus) => {
    if (guardAdmin()) return;
    try {
      const res = await fetch(`/api/bulletin-board/${post.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        showToast('Failed to update status');
        return;
      }
      const updated = await res.json();
      setPost(updated);
      showToast(`Status changed to ${newStatus}`);
    } catch {
      showToast('Failed to update status');
    }
  };

  const handlePinToggle = async () => {
    if (guardAdmin()) return;
    try {
      const res = await fetch(`/api/bulletin-board/${post.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pinned: !post.pinned }),
      });
      if (!res.ok) {
        showToast('Failed to toggle pin');
        return;
      }
      const updated = await res.json();
      setPost(updated);
    } catch {
      showToast('Failed to toggle pin');
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-frh-ink border-2 border-frh-yellow px-4 py-2 font-mono text-xs text-frh-yellow shadow-[var(--shadow-hard)]">
          {toast}
        </div>
      )}

      {/* Back link */}
      <Link href="/bulletin-board" className="font-ui text-[10px] uppercase tracking-widest text-frh-text-muted hover:text-frh-yellow transition-colors mb-4 inline-block">
        &larr; Back to Bulletin Board
      </Link>

      {/* Admin controls */}
      {isAdmin && !editing && (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <BrutalButton size="sm" variant="secondary" onClick={() => { if (!guardAdmin()) setEditing(true); }}>
            Edit
          </BrutalButton>
          <button
            onClick={handlePinToggle}
            className={`font-ui text-[10px] uppercase px-3 py-1 border transition-colors ${
              post.pinned
                ? 'border-frh-yellow text-frh-yellow'
                : 'border-frh-border text-frh-text-muted hover:border-frh-yellow hover:text-frh-yellow'
            }`}
          >
            {post.pinned ? '&#9733; Pinned' : '&#9734; Pin'}
          </button>
          {post.status === 'draft' && (
            <button
              onClick={() => handleStatusChange('published')}
              className="font-ui text-[10px] uppercase px-3 py-1 border border-frh-lime text-frh-lime hover:bg-frh-lime hover:text-frh-ink transition-colors"
            >
              Publish
            </button>
          )}
          {post.status === 'published' && (
            <button
              onClick={() => handleStatusChange('archived')}
              className="font-ui text-[10px] uppercase px-3 py-1 border border-frh-orange text-frh-orange hover:bg-frh-orange hover:text-frh-ink transition-colors"
            >
              Archive
            </button>
          )}
          {post.status === 'archived' && (
            <button
              onClick={() => handleStatusChange('draft')}
              className="font-ui text-[10px] uppercase px-3 py-1 border border-frh-border text-frh-text-muted hover:text-frh-yellow transition-colors"
            >
              Revert to Draft
            </button>
          )}
          <PixelBadge label={post.status} color={post.status === 'published' ? 'lime' : post.status === 'draft' ? 'yellow' : 'gray'} />
        </div>
      )}

      {/* Edit form */}
      {editing && isAdmin ? (
        <RetroWindow title="Editing Post" titleBarColor="blue">
          <div className="space-y-3">
            <div>
              <label className="font-ui text-[10px] uppercase tracking-widest text-frh-text-muted block mb-1">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-frh-ink border border-frh-border px-2 py-1.5 font-mono text-xs text-frh-text focus:border-frh-yellow outline-none"
              />
            </div>
            <div>
              <label className="font-ui text-[10px] uppercase tracking-widest text-frh-text-muted block mb-1">Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full bg-frh-ink border border-frh-border px-2 py-1.5 font-mono text-xs text-frh-text focus:border-frh-yellow outline-none"
              >
                {VALID_TYPES.map((t) => (
                  <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="font-ui text-[10px] uppercase tracking-widest text-frh-text-muted block mb-1">Body</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={10}
                className="w-full bg-frh-ink border border-frh-border px-2 py-1.5 font-mono text-xs text-frh-text focus:border-frh-yellow outline-none resize-y"
              />
            </div>
            <div>
              <label className="font-ui text-[10px] uppercase tracking-widest text-frh-text-muted block mb-1">Excerpt</label>
              <input
                type="text"
                value={excerpt}
                onChange={(e) => setExcerpt(e.target.value)}
                className="w-full bg-frh-ink border border-frh-border px-2 py-1.5 font-mono text-xs text-frh-text focus:border-frh-yellow outline-none"
              />
            </div>
            <div className="flex items-center gap-2 pt-2">
              <BrutalButton size="sm" onClick={handleSave} disabled={saving || !title.trim()}>
                Save
              </BrutalButton>
              <button
                onClick={() => setEditing(false)}
                className="font-ui text-[10px] uppercase px-3 py-1 text-frh-text-muted hover:text-frh-text transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </RetroWindow>
      ) : (
        /* Post content */
        <RetroWindow title={TYPE_LABELS[post.type] || post.type} titleBarColor={TYPE_COLORS[post.type] === 'blue' ? 'blue' : TYPE_COLORS[post.type] === 'purple' ? 'purple' : 'yellow'}>
          <article>
            {/* Header */}
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <PixelBadge label={TYPE_LABELS[post.type] || post.type} color={TYPE_COLORS[post.type] || 'gray'} />
              {post.pinned && (
                <span className="font-ui text-[10px] text-frh-yellow uppercase tracking-widest">&#9733; Pinned</span>
              )}
              <span className="font-mono text-[10px] text-frh-text-muted ml-auto">
                {formatDate(post.publishedAt || post.createdAt)}
              </span>
            </div>

            <h1 className="font-ui text-base uppercase tracking-wide text-frh-text mb-1">
              {post.title}
            </h1>

            {post.createdBy && (
              <p className="font-mono text-[10px] text-frh-text-muted mb-4">
                by {post.createdBy}
              </p>
            )}

            {/* Body */}
            <div className="font-mono text-xs text-frh-text leading-relaxed whitespace-pre-wrap">
              {post.body}
            </div>

            {/* Related entities */}
            {(post.relatedTeam || post.relatedPlayer || post.relatedMatch || post.relatedDivision || post.relatedSeason) && (
              <div className="mt-6 pt-4 border-t border-frh-border flex items-center gap-2 flex-wrap">
                <span className="font-ui text-[10px] uppercase tracking-widest text-frh-text-muted">Related:</span>
                {post.relatedTeam && (
                  <Link
                    href={`/teams/${post.relatedTeam.id}`}
                    className="font-mono text-[10px] border border-frh-border px-1.5 py-0.5 text-frh-text-muted hover:text-frh-yellow hover:border-frh-yellow transition-colors"
                  >
                    {post.relatedTeam.tag || post.relatedTeam.name}
                  </Link>
                )}
                {post.relatedPlayer && (
                  <Link
                    href={`/players/${post.relatedPlayer.id}`}
                    className="font-mono text-[10px] border border-frh-border px-1.5 py-0.5 text-frh-text-muted hover:text-frh-yellow hover:border-frh-yellow transition-colors"
                  >
                    {post.relatedPlayer.name}
                  </Link>
                )}
                {post.relatedDivision && (
                  <span className="font-mono text-[10px] border border-frh-border px-1.5 py-0.5 text-frh-text-muted">
                    {post.relatedDivision.name}
                  </span>
                )}
                {post.relatedSeason && (
                  <span className="font-mono text-[10px] border border-frh-border px-1.5 py-0.5 text-frh-text-muted">
                    {post.relatedSeason.name}
                  </span>
                )}
              </div>
            )}
          </article>
        </RetroWindow>
      )}
    </div>
  );
}
