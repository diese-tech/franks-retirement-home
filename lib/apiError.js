import * as Sentry from '@sentry/nextjs';

// reportServerError — small, reusable helper for server-side (app/api/**)
// error reporting. Mirrors the same production-only gate every React error
// boundary already uses (see app/error.js, app/global-error.js,
// app/admin/error.js, app/draft/[id]/error.js) so Sentry.captureException is
// only ever invoked in production; console.error always runs so errors are
// still visible locally/in CI logs. `context` should be a plain object of
// extra data (e.g. { route: '...' }) attached as Sentry's `extra`.
export function reportServerError(err, context = {}) {
  if (process.env.NODE_ENV === 'production') {
    Sentry.captureException(err, { extra: context });
  }
  console.error(`[${context.route ?? 'api'}]`, err);
}
