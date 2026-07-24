# Tournament viewer pages are their own route tree; the admin editor lives under /admin

Status: accepted

Viewer-facing pages are `/tournaments` (an index of published — `live` or `completed` — tournaments, newest first) and `/tournaments/[id]` (a single tournament's bracket). The admin editor lives at `/admin/tournaments/[id]`, not nested under `/tournaments/[id]/admin`.

The alternative was a single "current tournament" route, but that breaks the moment two tournaments exist at once — e.g. one just completed and stays visible per ADR-0003 while admin is already setting up the next — and per-tournament URLs are exactly what makes a finished bracket linkable/archivable. Splitting the admin editor out under `/admin` (rather than nesting it beside the viewer) follows the codebase's existing convention: `app/admin` is already where every other admin surface lives, so a reader looking for "where do I manage X" only has one place to check.
