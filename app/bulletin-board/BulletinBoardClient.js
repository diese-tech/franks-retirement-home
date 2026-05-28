'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import useAuth from '@/app/components/useAuth';
import ReactionBar from './ReactionBar';
import CommentThread from './CommentThread';
import PostEditorModal from './PostEditorModal';
import SubmitModal from './SubmitModal';
import SuperlativesPanel from './SuperlativesPanel';

const TYPE_META = {
  announcement:     { icon: '📢', label: 'Announcements',     desc: 'League news and official updates' },
  match_hype:       { icon: '⚔️', label: 'Match Hype',        desc: 'Pre-game breakdowns and trash talk' },
  player_spotlight: { icon: '🌟', label: 'Player Spotlight',  desc: 'Standout performances and profiles' },
  team_roast:       { icon: '🔥', label: 'Team Roast',        desc: 'Certified drags and disrespect' },
  weekly_recap:     { icon: '📋', label: 'Weekly Recap',      desc: 'Round-up of the week that was' },
};

const ALL_TYPES = Object.keys(TYPE_META);

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function TypeBadge({ type }) {
  const meta = TYPE_META[type] ?? { icon: '📌', label: type };
  return (
    <span style={{
      fontFamily: 'Share Tech Mono, monospace', fontSize: 9, letterSpacing: '0.08em',
      textTransform: 'uppercase', padding: '1px 6px', border: '2px solid #141414',
      background: '#ffd400', color: '#141414', whiteSpace: 'nowrap',
    }}>
      {meta.icon} {meta.label}
    </span>
  );
}

function PostCard({ post, reactions, commentCount, isAdmin, canEngage, onEdit }) {
  return (
    <div style={{ borderBottom: '1px solid #14141420', padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
        <TypeBadge type={post.type} />
        {post.pinned && <span style={{ fontFamily: 'VT323, monospace', fontSize: 11, color: '#CC3300' }}>📌 PINNED</span>}
        {isAdmin && (
          <button type="button" onClick={() => onEdit(post)}
            style={{ marginLeft: 'auto', fontSize: 9, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--frh-deep-blue)', fontFamily: 'Share Tech Mono, monospace' }}>
            edit
          </button>
        )}
      </div>
      <div style={{ fontFamily: 'Boogaloo, cursive', fontSize: 17, letterSpacing: '0.03em' }}>{post.title}</div>
      {post.excerpt && <div style={{ fontSize: 11, opacity: 0.75, lineHeight: 1.5, marginTop: 4 }}>{post.excerpt}</div>}
      <div style={{
        display: 'flex', gap: 12, alignItems: 'center', fontFamily: 'Share Tech Mono, monospace',
        fontSize: 9, letterSpacing: '0.06em', opacity: 0.55, textTransform: 'uppercase', flexWrap: 'wrap', marginTop: 6,
      }}>
        {post.createdById && <span>by {post.createdById}</span>}
        {post.relatedTeam && <span>· {post.relatedTeam.name}</span>}
        {post.relatedPlayer && <span>· {post.relatedPlayer.name}</span>}
        <span>· {formatDate(post.publishedAt ?? post.createdAt)}</span>
      </div>
      <ReactionBar postId={post.id} initialCounts={reactions} canReact={canEngage} />
      <CommentThread postId={post.id} initialCount={commentCount} canComment={canEngage} />
    </div>
  );
}

function CategoryRow({ type, count, lastPost }) {
  const meta = TYPE_META[type] ?? { icon: '📌', label: type, desc: '' };
  return (
    <div className="bb-cat">
      <div className="bb-cat__ico">{meta.icon}</div>
      <div className="bb-cat__name">
        <strong>{meta.label}</strong>
        <span>{meta.desc}</span>
      </div>
      <div className="bb-cat__count">{count}</div>
      <div className="bb-cat__last">{lastPost ? formatDate(lastPost.publishedAt ?? lastPost.createdAt) : '—'}</div>
    </div>
  );
}

export default function BulletinBoardClient({ posts, totalCount, reactionCounts = {}, commentCounts = {}, superlatives = [] }) {
  const router = useRouter();
  const { authState } = useAuth();
  const isAdmin = Boolean(authState && authState.isAdmin);
  const loggedIn = Boolean(authState && !authState.anonymous);

  const [editorPost, setEditorPost] = useState(undefined); // undefined=closed, null=new, obj=edit
  const [showSubmit, setShowSubmit] = useState(false);

  const dbError = posts === null;
  const publishedPosts = posts ?? [];

  const countByType = ALL_TYPES.reduce((acc, t) => { acc[t] = publishedPosts.filter((p) => p.type === t).length; return acc; }, {});
  const lastByType = ALL_TYPES.reduce((acc, t) => { acc[t] = publishedPosts.filter((p) => p.type === t)[0] ?? null; return acc; }, {});

  const featuredPost = publishedPosts.find((p) => p.pinned) ?? publishedPosts[0] ?? null;
  const listPosts = featuredPost ? publishedPosts.filter((p) => p.id !== featuredPost.id) : [];

  const closeEditor = () => setEditorPost(undefined);
  const onSaved = () => { closeEditor(); router.refresh(); };

  return (
    <div>
      <div className="frh-page-masthead">
        <div className="frh-page-masthead__title">📣 Bulletin Board</div>
        <div className="frh-page-masthead__sub">FRH Community · League announcements · Player spotlights</div>
        <div className="frh-page-masthead__stats">
          <div className="frh-statchip"><span className="frh-statchip__val">{publishedPosts.length}</span><span className="frh-statchip__lbl">Posts</span></div>
          <div className="frh-statchip"><span className="frh-statchip__val">{totalCount}</span><span className="frh-statchip__lbl">All Time</span></div>
          <div className="frh-statchip"><span className="frh-statchip__val">{ALL_TYPES.length}</span><span className="frh-statchip__lbl">Categories</span></div>
        </div>
      </div>

      <div className="frh-editorial-shell">
        {dbError && (
          <div style={{ textAlign: 'center', padding: '40px 0', fontFamily: 'Share Tech Mono, monospace', fontSize: 11, opacity: 0.6 }}>
            Board unavailable — database may be unreachable.{' '}
            <Link href="/" style={{ color: '#1040aa' }}>← Back to Home</Link>
          </div>
        )}

        {!dbError && (
          <>
            {/* Action row */}
            <div className="action-row">
              {isAdmin && (
                <>
                  <span className="admin-chip">Editor</span>
                  <button className="frh-btn frh-btn--primary" onClick={() => setEditorPost(null)}>+ New Post</button>
                </>
              )}
              <button className="frh-btn" onClick={() => setShowSubmit(true)}>📝 Submit a Post</button>
              {!loggedIn && (
                <span style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 9, opacity: 0.55 }}>
                  Log in to react, comment, and submit.
                </span>
              )}
            </div>

            <div className="bb-layout">
              <div>
                {/* Category index */}
                <div className="frh-panel" style={{ marginBottom: 16 }}>
                  <header className="frh-panel__titlebar frh-panel__titlebar--blue">
                    <div className="frh-panel__ttl"><span className="frh-panel__accent" />Categories</div>
                    <div className="frh-panel__chips"><span className="frh-panel__chip">_</span><span className="frh-panel__chip">&#9633;</span><span className="frh-panel__chip">&times;</span></div>
                  </header>
                  <div className="bb-cat-list">
                    {ALL_TYPES.map((type) => (
                      <CategoryRow key={type} type={type} count={countByType[type]} lastPost={lastByType[type]} />
                    ))}
                  </div>
                </div>

                {/* Featured post */}
                {featuredPost && (
                  <div className="thread" style={{ marginBottom: 16 }}>
                    <div className="thread__head">
                      <span>📌 Featured</span>
                      <span className="thread__head__title">{featuredPost.title}</span>
                      <TypeBadge type={featuredPost.type} />
                    </div>
                    <div className="thread__post">
                      <div className="thread__author">
                        <div style={{ width: 48, height: 48, background: '#1040aa', border: '2px solid #141414', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px', fontFamily: 'Boogaloo, cursive', fontSize: 20, color: '#fff' }}>
                          {(TYPE_META[featuredPost.type]?.icon) ?? '📌'}
                        </div>
                        <div className="thread__author__name">{featuredPost.createdById ?? 'FRH Staff'}</div>
                        <div className="thread__author__meta">{formatDate(featuredPost.publishedAt ?? featuredPost.createdAt)}</div>
                      </div>
                      <div className="thread__body">
                        {isAdmin && (
                          <button type="button" onClick={() => setEditorPost(featuredPost)}
                            style={{ float: 'right', fontSize: 9, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--frh-deep-blue)', fontFamily: 'Share Tech Mono, monospace' }}>
                            edit
                          </button>
                        )}
                        {featuredPost.body
                          ? featuredPost.body.split('\n').map((para, i) => <p key={i} style={{ marginBottom: 8 }}>{para}</p>)
                          : <p style={{ opacity: 0.55 }}>[No body text]</p>}
                        {featuredPost.relatedTeam && (
                          <div className="thread__sig">Re: {featuredPost.relatedTeam.name}{featuredPost.relatedPlayer && ` · ${featuredPost.relatedPlayer.name}`}</div>
                        )}
                        <ReactionBar postId={featuredPost.id} initialCounts={reactionCounts[featuredPost.id] || {}} canReact={loggedIn} />
                        <CommentThread postId={featuredPost.id} initialCount={commentCounts[featuredPost.id] || 0} canComment={loggedIn} />
                      </div>
                    </div>
                  </div>
                )}

                {/* Post list */}
                {listPosts.length > 0 && (
                  <div className="frh-panel">
                    <header className="frh-panel__titlebar frh-panel__titlebar--yellow">
                      <div className="frh-panel__ttl"><span className="frh-panel__accent" />Recent Posts
                        <span style={{ marginLeft: 'auto', fontSize: 11, opacity: 0.85, letterSpacing: '0.1em' }}>{listPosts.length}</span>
                      </div>
                      <div className="frh-panel__chips"><span className="frh-panel__chip">_</span><span className="frh-panel__chip">&#9633;</span><span className="frh-panel__chip">&times;</span></div>
                    </header>
                    <div className="frh-panel__body" style={{ padding: 0 }}>
                      {listPosts.map((post) => (
                        <PostCard key={post.id} post={post}
                          reactions={reactionCounts[post.id] || {}}
                          commentCount={commentCounts[post.id] || 0}
                          isAdmin={isAdmin} canEngage={loggedIn} onEdit={setEditorPost} />
                      ))}
                    </div>
                  </div>
                )}

                {publishedPosts.length === 0 && (
                  <div className="frh-panel">
                    <div className="frh-panel__body" style={{ textAlign: 'center', padding: '48px 20px' }}>
                      <div style={{ fontFamily: 'Boogaloo, cursive', fontSize: 24, marginBottom: 8 }}>📭 Nothing Here Yet</div>
                      <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 10, opacity: 0.6, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                        No published posts. {isAdmin ? 'Hit “New Post” to start.' : 'Check back soon.'}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Sidebar */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <SuperlativesPanel superlatives={superlatives} isAdmin={isAdmin} canSuggest={loggedIn} />

                <div className="frh-panel">
                  <header className="frh-panel__titlebar frh-panel__titlebar--red">
                    <div className="frh-panel__ttl"><span className="frh-panel__accent" />Board Rules</div>
                    <div className="frh-panel__chips"><span className="frh-panel__chip">_</span><span className="frh-panel__chip">&#9633;</span><span className="frh-panel__chip">&times;</span></div>
                  </header>
                  <div className="frh-panel__body" style={{ padding: '10px 12px' }}>
                    {['Keep it in the spirit of the league', 'No doxxing or real-life threats', 'Save the salt for post-game', 'Admins have final say', 'Cheers > clowning, usually'].map((rule, i) => (
                      <div key={i} style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 10, letterSpacing: '0.04em', padding: '5px 0 5px 12px', borderBottom: '1px dotted #14141420', position: 'relative' }}>
                        <span style={{ position: 'absolute', left: 0, color: '#CC3300' }}>▸</span>{rule}
                      </div>
                    ))}
                  </div>
                </div>

                <Link href="/" style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.5, textAlign: 'center' }}>
                  ← Back to Home
                </Link>
              </div>
            </div>
          </>
        )}
      </div>

      {editorPost !== undefined && (
        <PostEditorModal post={editorPost} onClose={closeEditor} onSaved={onSaved} />
      )}
      {showSubmit && <SubmitModal onClose={() => setShowSubmit(false)} />}
    </div>
  );
}
