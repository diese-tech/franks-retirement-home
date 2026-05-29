'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({ error, reset }) {
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') {
      Sentry.captureException(error);
    }
  }, [error]);

  return (
    <html lang="en">
      <body style={{ background: '#0d0d0d', color: '#e8e8e8', fontFamily: 'monospace', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', margin: 0 }}>
        <div style={{ textAlign: 'center', padding: 24 }}>
          <p style={{ fontSize: 11, opacity: 0.5, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Critical error</p>
          <p style={{ fontSize: 22, marginBottom: 8 }}>FRH is having a moment</p>
          <p style={{ fontSize: 11, opacity: 0.4, marginBottom: 24 }}>Something went wrong at the application level.</p>
          <button
            onClick={reset}
            style={{ padding: '8px 16px', border: '2px solid #ffd400', background: 'transparent', color: '#ffd400', cursor: 'pointer', fontFamily: 'monospace', fontSize: 11 }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
