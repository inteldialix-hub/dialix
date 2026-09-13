'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('App-level error caught:', error);
  }, [error]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base, #0a0a0f)', color: 'var(--text-primary, #fff)', textAlign: 'center', padding: 24 }}>
      <h1 style={{ fontSize: 48, fontWeight: 800, margin: 0, color: 'var(--red, #ef4444)' }}>Something went wrong</h1>
      <p style={{ color: 'var(--text-secondary, #94a3b8)', maxWidth: 460, margin: '12px auto 24px' }}>
        An unexpected application error occurred. Our automated telemetry system has recorded this event.
      </p>
      <div style={{ display: 'flex', gap: 12 }}>
        <button
          type="button"
          onClick={() => reset()}
          style={{
            padding: '10px 20px',
            borderRadius: 8,
            background: 'var(--brand-accent, #6366f1)',
            color: '#fff',
            border: 'none',
            fontSize: 14,
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          Try Again
        </button>
        <Link
          href="/dashboard"
          style={{
            padding: '10px 20px',
            borderRadius: 8,
            background: 'var(--bg-secondary, #1e1e2d)',
            color: 'var(--text-primary, #fff)',
            textDecoration: 'none',
            fontSize: 14,
            fontWeight: 500,
            border: '1px solid var(--border-default, #2a2a3c)',
          }}
        >
          Dashboard
        </Link>
      </div>
    </div>
  );
}
