# FRH Supabase backups run on the home-lab cron, not inside the app

Status: accepted

FRH's Supabase project had no verified backup story. Rather than build backup logic into the Next.js app or its deploy pipeline, we extended the existing home-lab backup system (`diese-tech/lab-grid-lab`, originally built for the SAL platform) with a second, independent instance: `frh-supabase-restore`. It runs a weekly encrypted logical dump, verifies it by restoring into a scratch Postgres and comparing row counts before the archive is ever considered complete, and retains 91 days of history. It shares no config, secrets, cron lock, ports, or Docker network with the SAL instance, and runs on a different day (Thursday vs. Tuesday) so the two never contend for the host.

This was a deliberate trade-off over two other options. A Vercel/GitHub-Actions-based backup would live closer to FRH's own deploy but adds a second backup *system* to maintain instead of extending one that's already proven (weekly restore drills, checksum verification, encrypted-at-rest) for a sibling project. Relying on Supabase's own managed backups was rejected because — as the SAL audit found — backup/PITR availability is plan-dependent and was unverified/unavailable at the time; this gives FRH a recovery path independent of that.

See `diese-tech/lab-grid-lab` PR #16 (service definition) and issue #17 (deployment: installing tools, provisioning secrets, first backup, and installing the cron — none of which can be done from a repository, since it requires access to the actual home-lab host).
