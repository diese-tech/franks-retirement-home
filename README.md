# Smite 2 Draft League — Competitive Smite 2 Draft Platform

A full-stack competitive draft tool for Smite 2 leagues built with
Next.js 14, Prisma ORM, SQLite/PostgreSQL, and Tailwind CSS.

---

## Quick Start (5 minutes)

### Prerequisites

- **Node.js 18+** — https://nodejs.org
- **npm** (comes with Node)

### 1. Clone & Install

```bash
git clone https://github.com/diese-tech/franks-retirement-home.git
cd franks-retirement-home
npm install
```

### 2. Set Up Database

```bash
npx prisma generate
npx prisma db push
node prisma/seed.mjs
```

### 3. Run Development Server

```bash
npm run dev
```

Open **http://localhost:3000** — your draft league is live!

### One-Line Setup (alternative)

```bash
npm run setup    # install + generate + push + seed
npm run dev
```

---

## Multi-Captain Draft System

### How It Works

Each draft session has three shareable URLs generated automatically at creation time:

| Link         | Access level                                |
| ------------ | ------------------------------------------- |
| Admin link   | Full control — team assembly, overrides     |
| Captain A    | Team Alpha pick/ban/swap control            |
| Captain B    | Team Bravo pick/ban/swap control            |
| Spectator    | No key needed — read-only, watches live     |

Copy all links from the **Share** button in the Admin Dashboard.

### Draft Flow

```
pending → lobby → banning → picking → complete
```

| Status    | Who acts                   | What happens                                          |
| --------- | -------------------------- | ----------------------------------------------------- |
| `pending` | Admin only                 | Assemble Team A (5 players) and Team B (5 players)    |
| `lobby`   | Admin + captains           | Captains can swap players; click **Ready Up** to start|
| `banning` | Captains take turns        | 6 bans total (A→B→A→B→A→B), 3 per team               |
| `picking` | Captains take turns (snake)| 10 god picks (A→B→B→A→A→B→B→A→A→B), 5 per team       |
| `complete`| Read-only for all          | Final rosters, balance score, banned gods summary     |

**Auto-transitions:** banning→picking fires when 6th ban is submitted; picking→complete fires when 10th god is assigned. No admin action required.

### Running a Draft (Step by Step)

1. **Admin** creates a draft in `/admin` → clicks **Share** → copies all 4 links
2. **Admin** goes to the draft room (Admin Link), assembles 5v5 teams from the player pool
3. **Admin** clicks **Open Lobby** (requires exactly 5 per team)
4. **Admin** shares Captain A/B links with team captains
5. **Captains** join via their links. Each sees their team roster and a **Swap** button (replace a player with a free agent before bans start)
6. Both captains click **Ready Up** → draft auto-advances to ban phase
7. **Ban phase:** captains take turns banning gods from the god pool
8. **Pick phase:** captains select a god for each of their 5 players in snake order
9. Draft auto-completes when all 10 picks are assigned

### Real-Time Sync

The draft room uses **Server-Sent Events (SSE)** at `/api/drafts/[id]/stream`. All connected clients (both captains + any spectators) receive live state updates within ~1.5 seconds of any action.

> **Vercel note:** Standard Vercel Hobby functions time out after 10 seconds. The browser `EventSource` API automatically reconnects, so the stream resumes within 1–2 seconds of a reconnect. For seamless SSE with no reconnect gaps, deploy to a Node.js host (Railway, Render, VPS) or use Vercel Pro (60s function timeout).

### In-Draft Chat

A chat panel is available to all roles (admin, both captains, spectators) once the lobby opens. Messages are color-coded by team. Chat is not available in `pending` status.

---

## Project Structure

```
franks-retirement-home/
├── app/
│   ├── layout.js
│   ├── page.js                       # Homepage — draft listing
│   ├── globals.css
│   ├── admin/
│   │   ├── page.js
│   │   └── AdminClient.js            # Tabbed CRUD dashboard + share modal
│   ├── draft/[id]/
│   │   ├── page.js                   # Server: role detection + state load
│   │   ├── DraftClient.js            # Client: SSE subscription + view routing
│   │   ├── views/
│   │   │   ├── PendingView.js        # Admin team assembly UI
│   │   │   ├── LobbyView.js          # Captain swap + ready up
│   │   │   ├── BanView.js            # Ban phase god grid
│   │   │   ├── PickView.js           # Pick phase with snake order
│   │   │   └── CompleteView.js       # Final roster recap
│   │   └── components/
│   │       └── ChatPanel.js          # Real-time chat
│   └── api/
│       ├── players/route.js
│       ├── gods/route.js
│       ├── drafts/route.js           # Create (generates 3 keys), status update
│       ├── draft-picks/route.js
│       └── drafts/[id]/
│           ├── state/route.js        # GET full state (keys stripped)
│           ├── stream/route.js       # SSE — polls DB every 1.5s
│           ├── ready/route.js        # Captain ready-up
│           ├── ban/route.js          # Submit ban (with turn enforcement)
│           ├── pick/route.js         # Assign god (with turn + ban check)
│           ├── swap/route.js         # Lobby player swap
│           └── chat/route.js         # Send chat message
├── lib/
│   ├── db.js                         # Prisma singleton
│   ├── rules.js                      # Balance + penalty engine
│   ├── constants.js                  # Roles, statuses, color maps
│   ├── draftOrder.js                 # BAN_ORDER, PICK_ORDER sequences
│   ├── draftAuth.js                  # resolveRole() — key → role mapping
│   └── draftState.js                 # buildDraftState() — shared state builder
├── prisma/
│   ├── schema.prisma
│   └── seed.mjs
└── .env.example
```

---

## API Routes

### Core (existing)

| Endpoint           | Method | Description                         |
| ------------------ | ------ | ----------------------------------- |
| `/api/players`     | GET    | List players (filterable by role)   |
| `/api/players`     | POST   | Create or update player             |
| `/api/players`     | DELETE | Delete player (guarded: live draft) |
| `/api/gods`        | GET    | List gods (filterable by role)      |
| `/api/gods`        | POST   | Create or update god                |
| `/api/gods`        | DELETE | Delete god (guarded: live draft)    |
| `/api/drafts`      | GET    | List all drafts (includes keys)     |
| `/api/drafts`      | POST   | Create draft (auto-generates 3 keys) or update status |
| `/api/drafts`      | DELETE | Delete draft (cascades all picks, bans, chat) |
| `/api/draft-picks` | GET    | Picks for a draft                   |
| `/api/draft-picks` | POST   | Add pick or update god              |
| `/api/draft-picks` | DELETE | Remove pick or clear all            |

### Draft-Specific (new)

| Endpoint                      | Method | Body                        | Description                        |
| ----------------------------- | ------ | --------------------------- | ---------------------------------- |
| `/api/drafts/[id]/state`      | GET    | —                           | Full state (keys stripped) for client refresh |
| `/api/drafts/[id]/stream`     | GET    | —                           | SSE stream — fires on version change |
| `/api/drafts/[id]/ready`      | POST   | `{ key }`                   | Captain marks ready                |
| `/api/drafts/[id]/ban`        | POST   | `{ key, godId }`            | Submit ban (turn-enforced)         |
| `/api/drafts/[id]/pick`       | POST   | `{ key, pickId, godId }`    | Assign god to player (turn-enforced)|
| `/api/drafts/[id]/swap`       | POST   | `{ key, outPlayerId, inPlayerId }` | Swap player during lobby    |
| `/api/drafts/[id]/chat`       | POST   | `{ key?, message }`         | Send chat message                  |

---

## Database Schema

```
Player:    id, name, role (Solo|Jungle|Mid|Support|Carry), pointValue, createdAt
God:       id, name, role (Warrior|Assassin|Mage|Guardian|Hunter), godClass, createdAt
Draft:     id, name, status, captainAKey, captainBKey, adminKey,
           captainAReady, captainBReady, version, createdAt, updatedAt
DraftPick: id, draftId, playerId, team (A|B), godId?, pickOrder, createdAt
DraftBan:  id, draftId, godId, team (A|B), banOrder, createdAt
DraftChat: id, draftId, team (A|B|admin|spectator), senderName, message, createdAt
```

---

## Deployment to Production (Vercel + Neon)

### 1. Set Up Neon PostgreSQL

Sign up at **https://neon.tech** (free tier: 500MB storage).
Create a database and copy the connection string.

### 2. Update Prisma Provider

In `prisma/schema.prisma`:

```prisma
datasource db {
  provider = "postgresql"    // ← change from "sqlite"
  url      = env("DATABASE_URL")
}
```

### 3. Push Schema to Neon

```bash
DATABASE_URL="postgresql://user:pass@host/db?sslmode=require" npx prisma db push
DATABASE_URL="postgresql://user:pass@host/db?sslmode=require" node prisma/seed.mjs
```

### 4. Deploy to Vercel

1. Push to GitHub
2. Go to **https://vercel.com/new** → Import repo
3. Add environment variable:
   ```
   DATABASE_URL=postgresql://user:pass@host/db?sslmode=require
   ```
4. Set build command (if needed): `npx prisma generate && next build`
5. Click **Deploy**

### Vercel SSE Behavior

| Plan    | Function timeout | SSE behavior                           |
| ------- | ---------------- | -------------------------------------- |
| Hobby   | 10s              | EventSource reconnects every ~10s; 1-2s gap between reconnects |
| Pro     | 60s              | Reconnects every ~60s; seamless for most use cases |
| Node host (Railway etc.) | No limit | Persistent connections, no reconnect gaps |

The app works correctly on Hobby — `EventSource` auto-reconnects and receives a full state push on reconnect.

### Option B: Railway (Node.js, persistent SSE)

1. Go to **https://railway.app** → New Project → Deploy from GitHub
2. Add PostgreSQL plugin (Railway auto-sets `DATABASE_URL`)
3. Add build command: `npx prisma generate && npx prisma db push && next build`

---

## Customization

### Change Penalty Threshold

`lib/rules.js` → `if (diff < 3)` → change `3` to your desired point gap.

### Add New Gods

Use the Admin panel UI or add to `prisma/seed.mjs`.

### Modify Ban/Pick Order

`lib/draftOrder.js` → edit `BAN_ORDER` or `PICK_ORDER` arrays.

### Change Balance Rules

`lib/rules.js` → add a function + push it into the `RULES` array.

---

## Development Commands

```bash
npm run dev          # Dev server — http://localhost:3000
npm run build        # Production build
npm run start        # Production server
npm run db:generate  # Regenerate Prisma client
npm run db:push      # Push schema to DB
npm run db:seed      # Seed gods, players, sample draft
npm run db:reset     # Wipe + re-seed (dev only)
npm run db:studio    # Prisma Studio (visual DB editor)
```

---

## Tech Stack

| Layer     | Technology                              |
| --------- | --------------------------------------- |
| Framework | Next.js 14 (App Router, plain JS)       |
| Styling   | Tailwind CSS + custom design tokens     |
| Database  | SQLite (dev) / PostgreSQL (prod)        |
| ORM       | Prisma 5                                |
| Real-time | Server-Sent Events (polling-based SSE)  |
| Auth      | URL key tokens (no login system)        |
| Fonts     | Rajdhani, Exo 2, JetBrains Mono         |
| Hosting   | Vercel / Railway / any Node.js host     |

---

## License

MIT — use freely for your league.
