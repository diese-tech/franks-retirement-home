'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function DraftError({ error, reset }) {
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') {
      Sentry.captureException(error);
    }
  }, [error]);

  return (
    <div className="max-w-md mx-auto mt-20 text-center card">
      <h1 className="font-ui text-sm uppercase tracking-widest text-red-400 mb-2">Draft Room Error</h1>
      <p className="text-sm text-frh-text-muted mb-4">
        The draft room hit an unexpected error. Reloading usually reconnects the live state.
      </p>
      <div className="flex gap-3 justify-center">
        <button onClick={reset} className="btn-secondary text-xs">Try again</button>
        <a href="/" className="btn-secondary text-xs">&larr; Back Home</a>
      </div>
    </div>
  );
}
