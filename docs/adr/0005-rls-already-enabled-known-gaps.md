# Row-level security is already enabled across FRH's Supabase schema

Status: accepted (documenting existing state, not a new decision)

While scoping the tournament bracket feature, we questioned whether RLS had been deliberately left off FRH's database. Querying the project directly showed the opposite: RLS is enabled on all 31 `public` tables, with no exceptions. 24 tables (`standings`, `matches`, `players`, `gods`, `seasons`, etc.) carry explicit public-read policies for genuinely public league data; the 8 sensitive tables (`admin_users`, `admin_audit_log`, `audit_logs`, `captain_tokens`, `captain_shortlists`, `division_role_mappings`, `operation_outbox`, `pending_actions`) have RLS enabled with zero policies, which is Postgres's default-deny for any role without `BYPASSRLS` — already the locked-down state you'd want for those tables.

This matters because `docs/s9-draft-architecture-plan.md` states "Supabase Realtime and RLS must not enter FRH" — worth being explicit that this is about the app's *own* authorization logic not depending on RLS/Realtime (FRH's Prisma layer does its own checks in API routes; the SSE polling pattern uses ordinary `SELECT`s, not `LISTEN/NOTIFY`). It is not a statement that RLS shouldn't exist at the database level as defense-in-depth against Supabase's always-on public REST API. Both are true at once: the app doesn't rely on RLS, and RLS is on anyway, and that's fine — confirmed the `postgres` role Prisma connects through has `rolbypassrls = true`, so none of this affects app behavior or risks locking out the app itself.

## Known gaps (not fixed by this ADR — documented for a future pass)

Supabase's own advisor lints surfaced three concrete, narrow items, independent of the bracket feature:

1. `registrations` has an anon `INSERT` policy with `WITH CHECK (true)` — fully open, so a direct call to Supabase's REST API could bypass the app's own validation/rate-limiting.
2. The `match-screenshots` storage bucket has a public `SELECT` policy broad enough to allow listing (enumerating all filenames), not just fetching by known URL.
3. Five functions (`complete_god_draft`, `submit_draft_pick`, `undo_last_pick`, `replace_match_report_stats`, `replace_standings`) have a mutable `search_path`, a minor hardening gap.

These are left for a separate, deliberate pass rather than folded into the bracket feature's scope.
