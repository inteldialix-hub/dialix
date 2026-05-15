'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { ToastProvider } from '@/components/dashboard/shared/ToastProvider';
import { DashboardErrorBoundary } from '@/components/dashboard/ErrorBoundary';
import '@/styles/dashboard.css';
import '@/styles/dashboard-home.css';

/**
 * Dashboard layout — wraps all /dashboard/* pages.
 * Protected route: redirects to /login if not authenticated.
 * Renders the sidebar on the left + content area on the right.
 */

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  // Show loading spinner while checking auth or redirecting
  if (isLoading || !isAuthenticated) {
    return (
      <>
        {/* Meta refresh as fallback redirect if JS redirect is blocked */}
        {!isLoading && !isAuthenticated && (
          <head><meta httpEquiv="refresh" content="1;url=/login" /></head>
        )}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            gap: '16px',
            background: 'var(--bg-base, #0F0F12)',
            color: 'var(--text-secondary, #9898A3)',
            fontFamily: 'Inter, sans-serif',
          }}
        >
          <div className="spinner" />
          {!isLoading && !isAuthenticated && (
            <a href="/login" style={{ color: '#5E6AD2', fontSize: '13px', textDecoration: 'none' }}>
              Redirecting to login... Click here if not redirected
            </a>
          )}
        </div>
      </>
    );
  }

  return (
    <ToastProvider>
      <div className="app-shell">
        <Sidebar />
        <main id="main-content" className="main-content" role="main">
          <DashboardErrorBoundary>
            {children}
          </DashboardErrorBoundary>
        </main>
      </div>
    </ToastProvider>
  );
}
