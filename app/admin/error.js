'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function AdminError({ error, reset }) {
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') {
      Sentry.captureException(error);
    }
  }, [error]);

  return (
    <div className="max-w-md mx-auto mt-20 text-center card">
      <h1 className="font-ui text-sm uppercase tracking-widest text-red-400 mb-2">Admin Panel Error</h1>
      <p className="text-sm text-frh-text-muted mb-4">
        Something went wrong loading this admin view. Your session may have expired.
      </p>
      <div className="flex gap-3 justify-center">
        <button onClick={reset} className="btn-secondary text-xs">Try again</button>
        <a href="/admin" className="btn-secondary text-xs">Reload admin</a>
      </div>
    </div>
  );
}
