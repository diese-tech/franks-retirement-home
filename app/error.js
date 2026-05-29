'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';
import Link from 'next/link';

export default function Error({ error, reset }) {
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') {
      Sentry.captureException(error);
    }
  }, [error]);

  return (
    <div style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24, fontFamily: 'Share Tech Mono, monospace' }}>
      <div style={{ fontSize: 11, opacity: 0.5, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        Something went wrong
      </div>
      <div style={{ fontFamily: 'Boogaloo, cursive', fontSize: 28 }}>
        Page Error
      </div>
      <p style={{ fontSize: 11, opacity: 0.4, maxWidth: 360, textAlign: 'center' }}>
        An unexpected error occurred. You can try reloading or go back to the home page.
      </p>
      <div style={{ display: 'flex', gap: 12 }}>
        <button
          onClick={reset}
          style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 11, padding: '8px 16px', border: '2px solid #141414', background: '#ffd400', cursor: 'pointer' }}
        >
          Try again
        </button>
        <Link href="/" style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 11, padding: '8px 16px', border: '2px solid #141414', background: 'transparent', textDecoration: 'none', color: 'inherit', display: 'inline-flex', alignItems: 'center' }}>
          ← Home
        </Link>
      </div>
    </div>
  );
}
