# Bulletin Board System

## Purpose

The Bulletin Board is FRH's public-facing community/editorial system. It provides a "league newspaper" narrative layer for funny, roast-heavy community content grounded in real league data.

## Architecture

- Public-readable: all published posts visible to everyone
- Admin-editable: Discord admin role required for create/edit/manage
- Inline editing: admin controls are layered directly onto the public view
- No disconnected CMS: shared components for public and admin rendering

## Post Types

| Type | Purpose |
|------|---------|
| announcement | Official league announcements |
| match_hype | Pre-match hype and predictions |
| player_spotlight | Featured player highlights |
| team_roast | Weekly team roasts (all in good fun) |
| weekly_recap | End-of-week summaries |

## Post Lifecycle

```
draft -> published -> archived
```

- **Draft**: visible only to admins, work-in-progress
- **Published**: visible to everyone, sets publishedAt timestamp
- **Archived**: hidden from public, preserved for history

Posts are never auto-deleted. Archived posts remain in the database unless explicitly deleted by an admin.

## Data Model

The BulletinPost model supports:
- title, slug (auto-generated, unique)
- status (draft/published/archived)
- type (one of 5 post types)
- body (full content), excerpt (optional short preview)
- pinned (boolean), displayOrder (integer)
- Related entity linking: relatedPlayerId, relatedTeamId, relatedMatchId, relatedDivisionId, relatedSeasonId
- Audit: createdBy, updatedBy, publishedAt, createdAt, updatedAt

## Routes

### Pages
- `/bulletin-board` - List of all published posts (admins see all statuses)
- `/bulletin-board/[slug]` - Single post view with full content

### API
- `GET /api/bulletin-board` - List posts (public: published only, admin: filterable by status/type)
- `POST /api/bulletin-board` - Create post (admin only)
- `GET /api/bulletin-board/[id]` - Get single post
- `PATCH /api/bulletin-board/[id]` - Update post (admin only)
- `DELETE /api/bulletin-board/[id]` - Delete post (admin only)
- `GET /api/bulletin-board/templates` - Get post templates (admin only)

## Admin Authorization

Admin access uses Discord OAuth with role-based authorization:
- Requires `DISCORD_ADMIN_ROLE_ID` environment variable
- User must be authenticated via Discord OAuth
- User's Discord roles must include the configured admin role ID

Non-admin users attempting admin actions see: "Are you an editor? Hmm, didn't think so..."

## Homepage Integration

The homepage includes a "Latest from the Bulletin Board" section that:
- Displays up to 5 recent published posts
- Shows post type badge, title, excerpt, and publish date
- Links to /bulletin-board for the full list
- Only renders when published posts exist

## Templates

The template system provides pre-filled content structures for each post type. Templates include placeholder text and reference points for real league data. Available via the admin "New Post" workflow.
