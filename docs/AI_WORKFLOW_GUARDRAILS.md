# AI Workflow Guardrails

Review this document before implementation, debugging, refactoring, migrations, or production fixes in this repository.

## Core Rule

Move fast, but move surgically. Prefer the smallest safe change that solves the measured problem. Avoid broad rewrites, speculative refactors, or unrelated cleanup.

## Repo-Specific Focus

- Isolate realtime draft and match state.
- Make draft actions idempotent under reconnects, retries, and duplicate events.
- Avoid giant synchronous operations in draft orchestration.
- Keep SSE/realtime fan-out bounded and observable.
- Prefer queue or event-driven boundaries where work can grow.
- Minimize blast radius during ruleset, role, or match-operation changes.

## Required Before Changing Code

- Identify the specific problem and files likely involved.
- Name the expected impact and rollback path.
- Check whether the change affects public traffic, background jobs, auth, user data, data integrity, or production operations.
- Avoid touching unrelated files.

## Architecture Defaults

- Prefer queue-based async processing over synchronous fan-out.
- Prefer append-only events or buffers over hot-row mutation.
- Prefer current-state projections over live aggregation queries.
- Prefer indexed lookups over raw-table scans.
- Prefer batching over per-item work where load can grow.
- Prefer idempotent and retry-safe jobs.

## Change Review Checklist

Before finalizing a change, answer what changed, why it is safe, what could break, how to roll back, and what validation proves the change.
