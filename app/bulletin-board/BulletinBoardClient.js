'use client';

import { useState } from 'react';
import { RetroWindow, BrutalButton, PixelBadge } from '@/components/ui';
import Link from 'next/link';

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

const STATUS_TABS = ['all', 'draft', 'published', 'archived'];

const VALID_TYPES = ['announcement', 'match_hype', 'player_spotlight', 'team_roast', 'weekly_recap'];

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function PostCard({ post, isAdmin, onEdit, onStatusChange, onDelete }) {
  const excerpt = post.excerpt || (post.body ? post.body.slice(0, 150) : '');

  return (
    <div className="border-2 border-frh-border bg-frh-surface p-4 shadow-[var(--shadow-hard)]">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <PixelBadge label={TYPE_LABELS[post.type] || post.type} color={TYPE_COLORS[post.type] || 'gray'} />
          {post.pinned && (
            <span className="font-ui text-[10px] text-frh-yellow uppercase tracking-widest">&#9733; Pinned</span>
          )}
          {isAdmin && post.status !== 'published' && (
            <PixelBadge label={post.status} color={post.status === 'draft' ? 'yellow' : 'gray'} />
          )}
        </div>
        <span className="font-mono text-[10px] text-frh-text-muted whitespace-nowrap">
          {formatDate(post.publishedAt || post.createdAt)}
        </span>
      </div>

      <Link href={`/bulletin-board/${post.slug}`} className="block mt-2">
        <h3 className="font-ui text-sm uppercase tracking-wide text-frh-text hover:text-frh-yellow transition-colors">
          {post.title}
        </h3>
      </Link>

      {excerpt && (
        <p className="mt-1 font-mono text-xs text-frh-text-muted line-clamp-2">{excerpt}</p>
      )}

      <div className="flex items-center gap-2 mt-3 flex-wrap">
        {post.relatedTeam && (
          <span className="font-mono text-[10px] border border-frh-border px-1.5 py-0.5 text-frh-text-muted">
            {post.relatedTeam.tag || post.relatedTeam.name}
          </span>
        )}
        {post.relatedPlayer && (
          <span className="font-mono text-[10px] border border-frh-border px-1.5 py-0.5 text-frh-text-muted">
            {post.relatedPlayer.name}
          </span>
        )}

        {isAdmin && (
          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={() => onEdit(post)}
              className="font-ui text-[10px] uppercase px-2 py-0.5 border border-frh-border text-frh-text-muted hover:text-frh-yellow hover:border-frh-yellow transition-colors"
            >
              Edit
            </button>
            {post.status === 'draft' && (
              <button
                onClick={() => onStatusChange(post.id, 'published')}
                className="font-ui text-[10px] uppercase px-2 py-0.5 border border-frh-lime text-frh-lime hover:bg-frh-lime hover:text-frh-ink transition-colors"
              >
                Publish
              </button>
            )}
            {post.status === 'published' && (
              <button
                onClick={() => onStatusChange(post.id, 'archived')}
                className="font-ui text-[10px] uppercase px-2 py-0.5 border border-frh-orange text-frh-orange hover:bg-frh-orange hover:text-frh-ink transition-colors"
              >
                Archive
              </button>
            )}
            {post.status === 'archived' && (
              <button
                onClick={() => onStatusChange(post.id, 'draft')}
                className="font-ui text-[10px] uppercase px-2 py-0.5 border border-frh-border text-frh-text-muted hover:text-frh-yellow transition-colors"
              >
                Revert
              </button>
            )}
            <button
              onClick={() => onDelete(post.id)}
              className="font-ui text-[10px] uppercase px-2 py-0.5 border border-red-500 text-red-500 hover:bg-red-500 hover:text-white transition-colors"
            >
              Del
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function NewPostForm({ onSubmit, onCancel }) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState('announcement');
  const [body, setBody] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (status) => {
    if (!title.trim()) return;
    setSubmitting(true);
    await onSubmit({ title, type, body, excerpt: excerpt || undefined, status });
    setSubmitting(false);
  };

  return (
    <RetroWindow title="New Post" titleBarColor="yellow">
      <div className="space-y-3">
        <div>
          <label className="font-ui text-[10px] uppercase tracking-widest text-frh-text-muted block mb-1">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-frh-ink border border-frh-border px-2 py-1.5 font-mono text-xs text-frh-text focus:border-frh-yellow outline-none"
            placeholder="Post title..."
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
            rows={6}
            className="w-full bg-frh-ink border border-frh-border px-2 py-1.5 font-mono text-xs text-frh-text focus:border-frh-yellow outline-none resize-y"
            placeholder="Post content..."
          />
        </div>
        <div>
          <label className="font-ui text-[10px] uppercase tracking-widest text-frh-text-muted block mb-1">Excerpt (optional)</label>
          <input
            type="text"
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
            className="w-full bg-frh-ink border border-frh-border px-2 py-1.5 font-mono text-xs text-frh-text focus:border-frh-yellow outline-none"
            placeholder="Short preview text..."
          />
        </div>
        <div className="flex items-center gap-2 pt-2">
          <BrutalButton size="sm" onClick={() => handleSubmit('draft')} disabled={submitting || !title.trim()}>
            Save Draft
          </BrutalButton>
          <BrutalButton size="sm" variant="secondary" onClick={() => handleSubmit('published')} disabled={submitting || !title.trim()}>
            Publish
          </BrutalButton>
          <button
            onClick={onCancel}
            className="font-ui text-[10px] uppercase px-3 py-1 text-frh-text-muted hover:text-frh-text transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </RetroWindow>
  );
}

function EditPostForm({ post, onSubmit, onCancel }) {
  const [title, setTitle] = useState(post.title);
  const [type, setType] = useState(post.type);
  const [body, setBody] = useState(post.body || '');
  const [excerpt, setExcerpt] = useState(post.excerpt || '');
  const [submitting, setSubmitting] = useState(false);

  const handleSave = async () => {
    if (!title.trim()) return;
    setSubmitting(true);
    await onSubmit(post.id, { title, type, body, excerpt: excerpt || undefined });
    setSubmitting(false);
  };

  return (
    <RetroWindow title={`Edit: ${post.title}`} titleBarColor="blue">
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
            rows={6}
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
          <BrutalButton size="sm" onClick={handleSave} disabled={submitting || !title.trim()}>
            Save
          </BrutalButton>
          <button
            onClick={onCancel}
            className="font-ui text-[10px] uppercase px-3 py-1 text-frh-text-muted hover:text-frh-text transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </RetroWindow>
  );
}

export default function BulletinBoardClient({ initialPosts, isAdmin }) {
  const [posts, setPosts] = useState(initialPosts || []);
  const [activeTab, setActiveTab] = useState('all');
  const [showNewForm, setShowNewForm] = useState(false);
  const [editingPost, setEditingPost] = useState(null);
  const [toast, setToast] = useState(null);

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

  const filteredPosts = activeTab === 'all'
    ? posts
    : posts.filter((p) => p.status === activeTab);

  const counts = {
    all: posts.length,
    draft: posts.filter((p) => p.status === 'draft').length,
    published: posts.filter((p) => p.status === 'published').length,
    archived: posts.filter((p) => p.status === 'archived').length,
  };

  const handleCreate = async (data) => {
    if (guardAdmin()) return;
    try {
      const res = await fetch('/api/bulletin-board', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || 'Failed to create post');
        return;
      }
      const newPost = await res.json();
      setPosts((prev) => [newPost, ...prev]);
      setShowNewForm(false);
      showToast('Post created!');
    } catch {
      showToast('Failed to create post');
    }
  };

  const handleEdit = (post) => {
    if (guardAdmin()) return;
    setEditingPost(post);
  };

  const handleUpdate = async (id, data) => {
    if (guardAdmin()) return;
    try {
      const res = await fetch(`/api/bulletin-board/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || 'Failed to update post');
        return;
      }
      const updated = await res.json();
      setPosts((prev) => prev.map((p) => (p.id === id ? updated : p)));
      setEditingPost(null);
      showToast('Post updated!');
    } catch {
      showToast('Failed to update post');
    }
  };

  const handleStatusChange = async (id, status) => {
    if (guardAdmin()) return;
    try {
      const res = await fetch(`/api/bulletin-board/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        showToast('Failed to update status');
        return;
      }
      const updated = await res.json();
      setPosts((prev) => prev.map((p) => (p.id === id ? updated : p)));
    } catch {
      showToast('Failed to update status');
    }
  };

  const handleDelete = async (id) => {
    if (guardAdmin()) return;
    if (!confirm('Delete this post permanently?')) return;
    try {
      const res = await fetch(`/api/bulletin-board/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        showToast('Failed to delete post');
        return;
      }
      setPosts((prev) => prev.filter((p) => p.id !== id));
      showToast('Post deleted');
    } catch {
      showToast('Failed to delete post');
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-frh-ink border-2 border-frh-yellow px-4 py-2 font-mono text-xs text-frh-yellow shadow-[var(--shadow-hard)]">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-ui text-lg uppercase tracking-widest text-frh-text">Bulletin Board</h1>
        {isAdmin && (
          <BrutalButton size="sm" onClick={() => { if (!guardAdmin()) setShowNewForm(true); }}>
            + New Post
          </BrutalButton>
        )}
      </div>

      {/* Admin status tabs */}
      {isAdmin && (
        <div className="flex items-center gap-1 mb-4 border-b border-frh-border pb-2">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`font-ui text-[10px] uppercase tracking-widest px-3 py-1 border transition-colors ${
                activeTab === tab
                  ? 'border-frh-yellow text-frh-yellow bg-frh-yellow/10'
                  : 'border-transparent text-frh-text-muted hover:text-frh-text'
              }`}
            >
              {tab} ({counts[tab]})
            </button>
          ))}
        </div>
      )}

      {/* New Post Form */}
      {showNewForm && isAdmin && (
        <div className="mb-6">
          <NewPostForm onSubmit={handleCreate} onCancel={() => setShowNewForm(false)} />
        </div>
      )}

      {/* Edit Form */}
      {editingPost && isAdmin && (
        <div className="mb-6">
          <EditPostForm post={editingPost} onSubmit={handleUpdate} onCancel={() => setEditingPost(null)} />
        </div>
      )}

      {/* Posts list */}
      {filteredPosts.length === 0 ? (
        <RetroWindow title="No Posts" titleBarColor="gray">
          <p className="font-mono text-xs text-frh-text-muted text-center py-4">
            {isAdmin ? 'No posts match the current filter. Create one!' : 'Nothing posted yet. Check back soon.'}
          </p>
        </RetroWindow>
      ) : (
        <div className="space-y-3">
          {filteredPosts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              isAdmin={isAdmin}
              onEdit={handleEdit}
              onStatusChange={handleStatusChange}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
