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
git clone https://github.com/diese-tech/smite2-draft-league.git
cd smite2-draft-league
npm install
```

### 2. Set Up Database

```bash
# Generate Prisma client
npx prisma generate

# Create database + tables
npx prisma db push

# Seed with sample data (65 gods, 20 players, 1 sample draft)
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

## Project Structure

```
smite2-draft-league/
├── app/                          # Next.js App Router pages
│   ├── layout.js                 # Root layout (nav, footer)
│   ├── page.js                   # Homepage (server component)
│   ├── globals.css               # Global styles + Tailwind
│   ├── admin/
│   │   ├── page.js               # Server: fetch data
│   │   └── AdminClient.js        # Client: tabbed CRUD dashboard
│   ├── draft/[id]/
│   │   ├── page.js               # Server: fetch draft + picks
│   │   └── DraftClient.js        # Client: live draft interface
│   └── api/                      # API Routes
│       ├── players/route.js      # GET list, POST create/update, DELETE
│       ├── gods/route.js         # GET list, POST create/update, DELETE
│       ├── drafts/route.js       # GET list, POST create/status, DELETE
│       └── draft-picks/route.js  # GET picks, POST add/update, DELETE
├── components/
│   ├── Nav.js                    # Navigation bar
│   └── Footer.js                 # Footer
├── lib/
│   ├── db.js                     # Prisma client singleton
│   ├── rules.js                  # Draft balance + penalty engine
│   └── constants.js              # Roles, statuses, color maps
├── prisma/
│   ├── schema.prisma             # Database schema
│   └── seed.mjs                  # Seed script (gods, players, draft)
├── .env.example                  # Template for env vars
├── package.json
├── tailwind.config.js
├── next.config.js
└── jsconfig.json
```

---

## Core Features

### Pages

| Route           | Description                                          |
| --------------- | ---------------------------------------------------- |
| `/`             | Homepage — draft listing with status badges          |
| `/draft/[id]`   | Live draft board — two teams, player pool, penalties |
| `/admin`        | Admin dashboard — CRUD for players, gods, drafts     |

### API Routes

| Endpoint            | Method | Description                              |
| ------------------- | ------ | ---------------------------------------- |
| `/api/players`      | GET    | List players (filterable by role)        |
| `/api/players`      | POST   | Create or update player                  |
| `/api/players`      | DELETE | Delete player by id                      |
| `/api/gods`         | GET    | List gods (filterable by role)           |
| `/api/gods`         | POST   | Create or update god                     |
| `/api/gods`         | DELETE | Delete god by id                         |
| `/api/drafts`       | GET    | List all drafts                          |
| `/api/drafts`       | POST   | Create draft or update status            |
| `/api/drafts`       | DELETE | Delete draft (cascades picks)            |
| `/api/draft-picks`  | GET    | Picks for a draft (with player + god)    |
| `/api/draft-picks`  | POST   | Add pick or update god selection         |
| `/api/draft-picks`  | DELETE | Remove pick or clear all picks           |

### Rules Engine

The balance system runs client-side via `lib/rules.js`:

- **Point Difference Penalty** — triggers when gap between teams is ≥ 3
- **Caution Warning** — fires when gap is exactly 2
- **Roster Imbalance** — warns if one team has 2+ more players

Adding a new rule is one function + one array push:

```js
function myNewRule(picksA, picksB, ptsA, ptsB) {
  // your logic
  if (violation) return { id: 'my-rule', severity: 'warning', ... };
  return null;
}

const RULES = [pointDifferenceRule, cautionRule, rosterImbalanceRule, myNewRule];
```

### Draft Tool

- Two-column layout: Team Alpha (blue) vs Team Bravo (red)
- Player pool with search + role filtering
- Assign players to teams with one click
- Select a god per player via dropdown
- Live point totals and difference counter
- Green/yellow/red balance indicator
- Animated penalty state with pulsing glow
- Reset with confirmation dialog

---

## Database Models

```
Player:    id, name, role, pointValue, createdAt
God:       id, name, role, godClass, createdAt
Draft:     id, name, status (pending/active/complete), createdAt, updatedAt
DraftPick: id, draftId, playerId, team (A/B), godId, pickOrder, createdAt
```

---

## Deployment to Production

### Option A: Vercel + Neon PostgreSQL (Recommended, Free Tier)

#### 1. Set Up PostgreSQL

Sign up at **https://neon.tech** (free tier: 500MB).

Create a database, copy the connection string.

#### 2. Update Prisma Schema

In `prisma/schema.prisma`, change:

```prisma
datasource db {
  provider = "postgresql"       // ← Change from "sqlite"
  url      = env("DATABASE_URL")
}
```

#### 3. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/diese-tech/smite2-draft-league.git
git push -u origin main
```

#### 4. Deploy on Vercel

1. Go to **https://vercel.com/new**
2. Import your GitHub repo
3. Add environment variables:
   ```
   DATABASE_URL=postgresql://user:pass@host/db?sslmode=require
   ```
4. Click **Deploy**

#### 5. Initialize Production Database

```bash
DATABASE_URL="your-neon-url" npx prisma db push
DATABASE_URL="your-neon-url" node prisma/seed.mjs
```

### Option B: Railway (One-Click)

1. Go to **https://railway.app**
2. New Project → Deploy from GitHub
3. Add a PostgreSQL plugin
4. Set env vars (Railway auto-sets `DATABASE_URL`)
5. Add build command: `npx prisma generate && npx prisma db push && next build`

### Option C: VPS / Self-Hosted

```bash
git clone <repo> && cd smite2-draft-league
cp .env.example .env
# Edit .env with your PostgreSQL URL

npm install
npx prisma generate
npx prisma db push
node prisma/seed.mjs
npm run build
npm start         # Runs on port 3000
```

---

## Customization

### Change Player Roles

Edit `lib/constants.js` → `PLAYER_ROLES` array.

### Add New Gods

Either use the Admin panel UI, or add entries to `prisma/seed.mjs`.

### Modify Penalty Threshold

Edit `lib/rules.js` → change `if (diff < 3)` to your desired value.

### Change God Roles / Classes

Edit `lib/constants.js` → `GOD_ROLES` and `GOD_CLASSES` arrays.

---

## Development Commands

```bash
npm run dev          # Start dev server (http://localhost:3000)
npm run build        # Production build
npm run start        # Start production server
npm run db:generate  # Regenerate Prisma client
npm run db:push      # Push schema changes to database
npm run db:seed      # Run seed script
npm run db:reset     # Wipe DB + re-seed
npm run db:studio    # Open Prisma Studio (visual DB editor)
```

---

## Tech Stack

| Layer     | Technology                      |
| --------- | ------------------------------- |
| Framework | Next.js 14 (App Router)         |
| Styling   | Tailwind CSS + custom variables |
| Database  | SQLite (dev) / PostgreSQL (prod)|
| ORM       | Prisma 5                        |
| Fonts     | Rajdhani, Exo 2, JetBrains Mono |
| Hosting   | Vercel / Railway / any Node host|

---

## License

MIT — use freely for your league.
