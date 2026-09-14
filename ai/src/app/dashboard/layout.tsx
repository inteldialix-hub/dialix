'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { ToastProvider } from '@/components/dashboard/shared/ToastProvider';
import { DashboardErrorBoundary } from '@/components/dashboard/ErrorBoundary';

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
        {!isLoading && !isAuthenticated && (
          <head><meta httpEquiv="refresh" content="1;url=/login" /></head>
        )}
        <div className="flex flex-col items-center justify-center min-h-screen gap-4 bg-background text-muted-foreground">
          <div className="size-8 rounded-full border-2 border-muted-foreground border-t-transparent animate-spin" />
          {!isLoading && !isAuthenticated && (
            <a href="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Redirecting to login... Click here if not redirected
            </a>
          )}
        </div>
      </>
    );
  }

  return (
    <ToastProvider>
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <main id="main-content" className="flex-1 overflow-y-auto" role="main">
          <DashboardErrorBoundary>
            {children}
          </DashboardErrorBoundary>
        </main>
      </div>
    </ToastProvider>
  );
}
