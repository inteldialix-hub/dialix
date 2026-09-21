'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { TopBar } from '@/components/dashboard/TopBar';
import { TopBarProvider } from '@/components/dashboard/TopBarContext';
import { ToastProvider } from '@/components/dashboard/shared/ToastProvider';
import { DashboardErrorBoundary } from '@/components/dashboard/ErrorBoundary';

/**
 * Dashboard layout — wraps all /dashboard/* pages.
 * Protected route: redirects to /login if not authenticated.
 * Renders sidebar on left, top bar above content, and content area below.
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
      <TopBarProvider>
        <div className="flex min-h-screen bg-background dashboard-theme">
          <Sidebar />
          <div className="flex-1 flex flex-col overflow-hidden">
            <TopBar />
            <main id="main-content" className="flex-1 overflow-y-auto" role="main">
              <DashboardErrorBoundary>
                {children}
              </DashboardErrorBoundary>
            </main>
          </div>
        </div>
      </TopBarProvider>
    </ToastProvider>
  );
}
