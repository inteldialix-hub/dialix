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

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    background: 'var(--bg-input)',
    border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    fontSize: '14px',
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)', fontFamily: 'var(--font-sans)', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '420px', padding: '40px', background: 'var(--bg-raised)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-lg)', animation: 'panelEnter 400ms cubic-bezier(0.16, 1, 0.3, 1)' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <svg width="36" height="36" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="signup-grad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#5E6AD2" />
                <stop offset="100%" stopColor="#8B5CF6" />
              </linearGradient>
            </defs>
            <rect width="32" height="32" rx="8" fill="url(#signup-grad)" />
            <path d="M16 6L26 16L16 26L6 16L16 6Z" fill="white" fillOpacity="0.95" />
            <path d="M16 10L22 16L16 22L10 16L16 10Z" fill="url(#signup-grad)" fillOpacity="0.6" />
          </svg>
          <h1 style={{ fontSize: '22px', fontWeight: 700, marginTop: '16px', color: 'var(--text-primary)' }}>
            {inviteInfo ? 'Join the Team' : 'Create account'}
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--text-tertiary)', marginTop: '6px' }}>
            {inviteInfo ? `Invited by ${inviteInfo.organization_name}` : 'Get started with Dialix'}
          </p>
        </div>

        {/* Team Invite Banner */}
        {inviteInfo && (
          <div style={{
            padding: '12px 14px',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(99, 102, 241, 0.1)',
            border: '1px solid rgba(99, 102, 241, 0.25)',
            marginBottom: '20px',
            fontSize: '13px',
            color: 'var(--brand-accent)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}>
            <span style={{ fontSize: '18px' }}>🤝</span>
            <div>
              <strong>Team Invite:</strong> Joining <strong>{inviteInfo.organization_name}</strong> as <strong>{inviteInfo.role}</strong>.
            </div>
          </div>
        )}

        {error && (
          <div style={{ padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'var(--red-bg)', color: 'var(--red)', fontSize: '13px', marginBottom: '16px', border: '1px solid rgba(248,113,113,0.15)' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>Name</label>
            <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" required autoFocus style={inputStyle} />
          </div>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>Email</label>
            <input
              className="form-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
              readOnly={Boolean(inviteInfo?.email)}
              style={{
                ...inputStyle,
                ...(inviteInfo?.email ? { opacity: 0.8, cursor: 'not-allowed' } : {}),
              }}
            />
          </div>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>Password</label>
            <input className="form-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 12 characters (A-z, 0-9, symbol)" required style={inputStyle} />
          </div>
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>Confirm Password</label>
            <input className="form-input" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" required style={inputStyle} />
          </div>

          <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: '14px', fontWeight: 600, marginLeft: 0 }}>
            {loading ? 'Creating account...' : (inviteInfo ? 'Accept Invitation & Join' : 'Create Account')}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '13px', color: 'var(--text-tertiary)' }}>
          Already have an account?{' '}
          <Link href="/login" style={{ color: 'var(--brand-accent)', fontWeight: 500 }}>Sign in</Link>
        </div>
        <div style={{ textAlign: 'center', marginTop: '10px' }}>
          <Link href="/" style={{ fontSize: '12px', color: 'var(--text-quaternary)' }}>← Back to website</Link>
        </div>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: 'var(--bg-base)' }} />}>
      <SignupContent />
    </Suspense>
  );
}
