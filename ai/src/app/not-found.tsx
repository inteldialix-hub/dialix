import Link from 'next/link';

export default function NotFound() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base, #0a0a0f)', color: 'var(--text-primary, #fff)', textAlign: 'center', padding: 24 }}>
      <h1 style={{ fontSize: 64, fontWeight: 800, margin: 0, color: 'var(--brand-accent, #6366f1)' }}>404</h1>
      <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 8 }}>Page Not Found</h2>
      <p style={{ color: 'var(--text-secondary, #94a3b8)', maxWidth: 400, margin: '8px auto 24px' }}>
        The page you are looking for does not exist or has been moved.
      </p>
      <Link
        href="/dashboard"
        style={{
          padding: '10px 20px',
          borderRadius: 8,
          background: 'var(--brand-accent, #6366f1)',
          color: '#fff',
          textDecoration: 'none',
          fontSize: 14,
          fontWeight: 500,
        }}
      >
        Return to Dashboard
      </Link>
    </div>
  );
}
