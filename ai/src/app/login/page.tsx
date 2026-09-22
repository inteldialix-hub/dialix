'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  // If already logged in, redirect to dashboard
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace('/dashboard');
    }
  }, [isLoading, isAuthenticated, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  if (isLoading) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-8 shadow-lg">
        {/* Logo */}
        <div className="mx-auto flex size-10 items-center justify-center rounded-lg bg-foreground">
          <span className="text-lg font-bold text-background">D</span>
        </div>
        
        <h1 className="mt-4 text-xl font-semibold text-center">Welcome back</h1>
        <p className="mt-1 text-sm text-muted-foreground text-center">Sign in to your Dialix account</p>

        {/* Error */}
        {error && (
          <div id="login-error" className="rounded-md bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400 mb-4 mt-6">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className={error ? "space-y-4" : "mt-6 space-y-4"}>
          <div>
            <label htmlFor="email-input" className="block text-sm font-medium text-foreground mb-1.5">
              Email
            </label>
            <input
              id="email-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
              autoFocus
              aria-invalid={!!error}
              aria-describedby={error ? "login-error" : undefined}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <div>
            <label htmlFor="password-input" className="block text-sm font-medium text-foreground mb-1.5">
              Password
            </label>
            <input
              id="password-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              aria-invalid={!!error}
              aria-describedby={error ? "login-error" : undefined}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-foreground text-background py-2.5 text-sm font-medium hover:bg-foreground/90 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        {/* Links */}
        <div className="text-center mt-6 text-sm text-muted-foreground">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="text-foreground font-medium hover:text-foreground transition-colors">
            Create one
          </Link>
        </div>
        <div className="text-center mt-2">
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- intentional full reload to reset Lenis scroll state */}
          <a href="/" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            ← Back to website
          </a>
        </div>
      </div>
    </div>
  );
}
