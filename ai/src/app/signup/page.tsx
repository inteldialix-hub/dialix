'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';

interface InvitationDetails {
  valid: boolean;
  email?: string;
  role?: string;
  organization_name?: string;
  error?: string;
}

function SignupContent() {
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get('invite') || '';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [inviteInfo, setInviteInfo] = useState<InvitationDetails | null>(null);

  const { signup, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace('/dashboard');
    }
  }, [isLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!inviteToken) return;

    let mounted = true;
    api<InvitationDetails>(`/team/invitation/${inviteToken}`)
      .then((data) => {
        if (!mounted) return;
        if (data.valid && data.email) {
          setInviteInfo(data);
          setEmail(data.email);
        } else {
          setError(data.error || 'Invitation link is invalid or has expired');
        }
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : 'Invalid invitation');
      });

    return () => {
      mounted = false;
    };
  }, [inviteToken]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 12) {
      setError('Password must be at least 12 characters with uppercase, lowercase, number, and symbol');
      return;
    }

    setLoading(true);
    try {
      await signup(name, email, password, inviteToken || undefined);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  if (isLoading) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-8 shadow-lg">
        <div className="mx-auto flex size-10 items-center justify-center rounded-lg bg-foreground">
          <span className="text-lg font-bold text-background">D</span>
        </div>
        <h1 className="mt-4 text-xl font-semibold text-center">
          {inviteInfo ? 'Join the Team' : 'Create account'}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground text-center">
          {inviteInfo ? `Invited by ${inviteInfo.organization_name}` : 'Get started with Dialix'}
        </p>

        <div className="mt-6">
          {inviteInfo && (
            <div className="rounded-md bg-blue-500/10 border border-blue-500/20 px-4 py-3 text-sm text-blue-400 mb-4 flex items-center gap-2.5">
              Team Invite: Joining {inviteInfo.organization_name} as {inviteInfo.role}.
            </div>
          )}

          {error && (
            <div className="rounded-md bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400 mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Name</label>
              <input
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                required
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Email</label>
              <input
                className={`w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring ${inviteInfo?.email ? 'opacity-60 cursor-not-allowed' : ''}`}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                readOnly={Boolean(inviteInfo?.email)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Password</label>
              <input
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 12 characters (A-z, 0-9, symbol)"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Confirm Password</label>
              <input
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-md bg-foreground text-background py-2.5 text-sm font-medium hover:bg-foreground/90 disabled:opacity-50 transition-colors"
              disabled={loading}
            >
              {loading ? 'Creating account...' : (inviteInfo ? 'Accept Invitation & Join' : 'Create Account')}
            </button>
          </form>
        </div>

        <div className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-foreground">Sign in</Link>
        </div>
        <div className="mt-4 text-center">
          <Link href="/" className="text-xs text-muted-foreground">← Back to website</Link>
        </div>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <SignupContent />
    </Suspense>
  );
}
