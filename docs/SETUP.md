# FRH — Environment Setup Guide

This is the canonical starting point for anyone setting up Frank's Retirement Home locally or deploying it to production for the first time.

**For the Prisma migration workflow specifically, see `docs/PRISMA_WORKFLOW.md`.**
**For deployment and CI/CD specifics, see `docs/DEPLOYMENT_NOTES.md`.**

---

## Prerequisites

- Node.js 20+
- npm 9+
- A [Supabase](https://supabase.com) account (free tier is sufficient)
- A [Vercel](https://vercel.com) account (for production deployment)
- A [Discord application](https://discord.com/developers/applications) with OAuth configured (for captain/admin auth)
- A [Google AI Studio](https://aistudio.google.com) API key (for OCR screenshot extraction)

---

## 1. Clone and install

```bash
git clone https://github.com/diese-tech/franks-retirement-home.git
cd franks-retirement-home
npm install
```

---

## 2. Supabase project setup

### Create a project

1. Go to [supabase.com](https://supabase.com) → New project
2. Choose a region (pick closest to your Vercel deployment — `us-east-1` recommended)
3. Set a strong database password — save it, you'll need it for connection strings
4. Wait for the project to finish provisioning (~1 minute)

### Get your connection strings

In the Supabase dashboard: **Project → Settings → Database → Connection string**

You need two strings:

| Tab | Mode | Port | Use for |
|---|---|---|---|
| **Transaction** | Supavisor pooled | 6543 | `DATABASE_URL` — runtime app |
| **Session** | Supavisor direct | 5432 | `DIRECT_URL` — Prisma CLI migrations |

Both follow this format:
```
postgresql://postgres.PROJECT-REF:PASSWORD@aws-0-REGION.pooler.supabase.com:PORT/postgres
```

Replace `PROJECT-REF`, `PASSWORD`, `REGION`, and `PORT` with your actual values.

> **Why two URLs?** The pooled Transaction URL (6543) is optimised for short-lived serverless connections. Prisma's migration CLI needs a persistent session connection (5432) to issue DDL statements reliably. Using the pooled URL for migrations causes intermittent failures.

---

## 3. Environment variables

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in every value. Minimum required for local development:

```bash
# Database
DATABASE_URL="postgresql://postgres.PROJECT-REF:PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres"
DIRECT_URL="postgresql://postgres.PROJECT-REF:PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres"

# Admin auth
ADMIN_PASSWORD="choose-a-local-password"
ADMIN_SESSION_SECRET="any-string-at-least-16-chars"

# Discord OAuth (can be deferred — app works without it, Discord login returns 503)
DISCORD_CLIENT_ID="..."
DISCORD_CLIENT_SECRET="..."
DISCORD_GUILD_ID="..."
DISCORD_SESSION_SECRET="any-string-at-least-16-chars"
DISCORD_ADMIN_ROLE_ID="..."
DISCORD_HOSPICE_CAPTAIN_ROLE_ID="..."
DISCORD_REHABILITATION_CAPTAIN_ROLE_ID="..."
DISCORD_HOSPICE_PLAYER_ROLE_IDS="..."
DISCORD_REHABILITATION_PLAYER_ROLE_IDS="..."
DISCORD_TEAM_ROLE_MAP_JSON='{}'

# OAuth callback base URL
NEXTAUTH_URL="http://localhost:3000"

# OCR (optional locally — screenshot upload fails gracefully without it)
GEMINI_API_KEY="..."
```

See `.env.example` for full documentation of every variable.

---

## 4. Apply migrations and seed

```bash
# Apply all Prisma migrations and seed the database
npm run db:reset
```

This runs `prisma migrate reset --force` (applies all migrations) followed by `prisma/seed.mjs` which inserts:
- Season 9 with Hospice and Rehabilitation divisions
- 10 teams (4 Hospice, 6 Rehabilitation) with deterministic IDs
- 20 players across roles
- 83 gods
- 1 sample standalone draft

> **Note:** `db:reset` drops and recreates all tables. Only run this on a local or development database — never against the shared production Supabase project.

---

## 5. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The admin dashboard is at [http://localhost:3000/admin](http://localhost:3000/admin).

---

## 6. Activate Season 9

The seed creates Season 9 with `status: 'upcoming'`. To make the homepage show live data, activate it:

**Option A — Prisma Studio (GUI):**
```bash
npm run db:studio
```
Open the `Season` table, edit the `s9` row, set `status` to `active`, save.

**Option B — Node one-liner (Windows-compatible):**
```bash
node -e "const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.season.update({where:{slug:'s9'},data:{status:'active'}}).then(r=>console.log('Updated:',r.name)).finally(()=>p.\$disconnect())"
```

---

## 7. Discord OAuth setup (optional for local dev)

If you want Discord login to work locally:

1. Go to [Discord Developer Portal](https://discord.com/developers/applications) → your application → OAuth2
2. Add redirect URI: `http://localhost:3000/api/auth/discord/callback`
3. Fill in `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, and `DISCORD_GUILD_ID` in `.env.local`
4. Enable Developer Mode in Discord (Settings → Advanced → Developer Mode)
5. Copy role IDs from your server (Server Settings → Roles → right-click → Copy Role ID)
6. Fill in the remaining `DISCORD_*` variables

If Discord env vars are missing, OAuth routes return HTTP 503 but the rest of the app (including the key-based captain auth) continues to work normally.

### DISCORD_TEAM_ROLE_MAP_JSON

Maps FRH team IDs to Discord role IDs. Team IDs are deterministic (set in `prisma/seed.mjs`):

```json
{
  "team-galactic-stingers":  "YOUR_DISCORD_ROLE_ID",
  "team-caustic-crusaders":  "YOUR_DISCORD_ROLE_ID",
  "team-death-dealers":      "YOUR_DISCORD_ROLE_ID",
  "team-wheezys-mafia":      "YOUR_DISCORD_ROLE_ID",
  "team-ruined-order":       "YOUR_DISCORD_ROLE_ID",
  "team-kappa-corp":         "YOUR_DISCORD_ROLE_ID",
  "team-exile-extinction":   "YOUR_DISCORD_ROLE_ID",
  "team-valhalla-vikings":   "YOUR_DISCORD_ROLE_ID",
  "team-babas-kitchen":      "YOUR_DISCORD_ROLE_ID",
  "team-cyberpunk-otters":   "YOUR_DISCORD_ROLE_ID"
}
```

---

## 8. Production deployment (Vercel)

### Connect to Vercel

```bash
# Or use the Vercel dashboard to import the GitHub repo
npx vercel link
```

### Set environment variables in Vercel

Go to **Vercel → Project → Settings → Environment Variables** and add every variable from `.env.example`. Use your **production** Supabase connection strings.

Key production-only settings:
```bash
ADMIN_AUTH_REQUIRED="true"     # Enforces session cookie auth on all admin endpoints
NEXTAUTH_URL="https://your-vercel-domain.vercel.app"
NODE_ENV="production"          # Set automatically by Vercel
```

Generate secrets with:
```bash
# macOS/Linux
openssl rand -base64 48

# Windows PowerShell
[Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Maximum 256 }))
```

### Add Discord redirect URI for production

In Discord Developer Portal → OAuth2 → Redirects, add:
```
https://your-vercel-domain.vercel.app/api/auth/discord/callback
```

### GitHub Actions secrets

For the automated migration job in `.github/workflows/ci.yml`, add these secrets in **GitHub → Settings → Secrets and variables → Actions**:

| Secret | Value |
|---|---|
| `DATABASE_URL` | Your Supabase Transaction-mode URL (port 6543) |
| `DIRECT_URL` | Your Supabase Session-mode URL (port 5432) |

The CI `migrate` job runs `prisma migrate deploy` automatically on every push to `main`.

---

## 9. npm scripts reference

```bash
npm run dev              # Next.js dev server
npm run build            # Production build
npm run lint             # ESLint
npm run test             # All unit + API tests
npm run verify:env       # Validate env var format (no DB connection)
npm run verify:draft     # lint + test + build — run before every deploy

npm run db:generate      # prisma generate (after schema changes)
npm run db:migrate:dev   # Create a migration from schema changes (local only)
npm run db:migrate:deploy # Apply pending migrations to production
npm run db:seed          # Seed gods, players, season, teams
npm run db:reset         # Drop + re-migrate + re-seed (local only)
npm run db:studio        # Prisma Studio GUI
```

---

## 10. Verify your setup

```bash
# Confirm DB connectivity and migration state
npx prisma migrate status

# Confirm seed data
node -e "const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();Promise.all([p.season.count(),p.team.count(),p.player.count(),p.god.count()]).then(([s,t,pl,g])=>console.log({seasons:s,teams:t,players:pl,gods:g})).finally(()=>p.\$disconnect())"

# Confirm the dev server starts without errors
npm run dev
```

Expected output from the count query after a fresh seed:
```json
{ seasons: 1, teams: 10, players: 20, gods: 83 }
```

---

## Troubleshooting

### P2021: "The table does not exist in the current database"

This error means Prisma is trying to query a table that does not exist. Common causes:

1. **Migrations have not been deployed.** Run `npx prisma migrate status` to check. If pending, run:
   ```bash
   npx prisma migrate deploy
   ```

2. **DATABASE_URL points to the wrong Supabase project.** Extract the project-ref from your URL (the part after `postgres.` in the username) and confirm it matches the project in your Supabase dashboard.

3. **The database was created with `db push` and later switched to migrations.** This causes drift. See `docs/PRISMA_WORKFLOW.md` for recovery steps.

4. **Verify with the DB check script:**
   ```bash
   node scripts/verify-db.mjs
   ```
   This will show which tables are accessible and which are missing.

5. **Quick diagnosis:**
   ```bash
   # Check migration state
   npx prisma migrate status

   # Verify env vars point to correct project (no DB connection needed)
   npm run verify:env
   ```

### `prisma migrate deploy` fails with "drift detected"

This means `prisma db push` was previously used against the database, leaving schema state that the `_prisma_migrations` table doesn't know about. See `docs/PRISMA_WORKFLOW.md` → "Recovering from drift" for the resolution steps.

### Connection timeout during migrations

Ensure you're using `DIRECT_URL` (port 5432, Session mode) for migration commands. The Transaction mode pooler (port 6543) does not support the persistent connections that `prisma migrate` requires.

### `ADMIN_AUTH_REQUIRED` is `true` but the dashboard 401s immediately

Your `ADMIN_SESSION_SECRET` may have changed. Clear the `frh_admin_session` cookie in your browser and log in again at `/admin`.

### Discord OAuth returns 503

Discord env vars are not fully configured. This is expected in local environments where Discord isn't set up. Key-based captain auth continues to work normally.
