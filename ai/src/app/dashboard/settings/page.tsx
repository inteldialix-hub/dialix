'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from 'next-themes';
import { api } from '@/lib/api';
import { Icon } from '@/components/dashboard/shared/Icon';

export default function SettingsPage() {
  const { client, token } = useAuth();
  const { theme, setTheme } = useTheme();
  const [apiStatus, setApiStatus] = useState<{ status?: string } | null>(null);

  // Change password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/health`).then(r => r.json()).then(d => setApiStatus(d)).catch(() => setApiStatus({ status: 'error' }));
  }, []);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (newPassword !== confirmNewPassword) {
      setPasswordError('New passwords do not match');
      return;
    }
    if (newPassword.length < 12) {
      setPasswordError('New password must be at least 12 characters with uppercase, lowercase, number, and symbol');
      return;
    }

    setPasswordLoading(true);
    try {
      await api('/auth/change-password', {
        method: 'POST',
        token: token || undefined,
        body: { current_password: currentPassword, new_password: newPassword },
      });
      setPasswordSuccess('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setPasswordLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    background: 'var(--bg-input)',
    border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    fontSize: '13px',
  };

  return (
    <div style={{ maxWidth: 680, padding: 20 }}>
      <div className="page-title-section" style={{ padding: '24px 0' }}>
        <h2>Settings</h2>
        <p>System information, account details, and preferences</p>
      </div>

      <div className="config-section">
        <div className="config-section-title"><Icon name="server" size={14} /> System Status</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '12px' }}>
          <span className={`status-dot ${apiStatus?.status === 'ok' ? 'active' : 'unavailable'}`} />
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            API Server: {apiStatus?.status === 'ok' ? 'Connected' : apiStatus ? 'Error' : 'Checking...'}
          </span>
        </div>
      </div>

      <div className="config-section" style={{ marginTop: '24px' }}>
        <div className="config-section-title"><Icon name="user" size={14} /> Account</div>
        <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '13px' }}><span style={{ color: 'var(--text-tertiary)', width: '80px', display: 'inline-block' }}>Name:</span> {client?.name || '—'}</div>
          <div style={{ fontSize: '13px' }}><span style={{ color: 'var(--text-tertiary)', width: '80px', display: 'inline-block' }}>Email:</span> {client?.email || '—'}</div>
          <div style={{ fontSize: '13px' }}><span style={{ color: 'var(--text-tertiary)', width: '80px', display: 'inline-block' }}>Role:</span> {client?.is_admin ? 'Admin' : 'Client'}</div>
        </div>
      </div>

      {/* Theme preference */}
      <div className="config-section" style={{ marginTop: '24px' }}>
        <div className="config-section-title"><Icon name="sun" size={14} /> Appearance</div>
        <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
          {(['dark', 'light', 'system'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTheme(t)}
              style={{
                padding: '6px 14px',
                fontSize: '12px',
                fontWeight: 500,
                borderRadius: 'var(--radius-md)',
                border: theme === t ? '1px solid var(--brand-accent)' : '1px solid var(--border-default)',
                background: theme === t ? 'var(--brand-accent)' : 'var(--bg-input)',
                color: theme === t ? '#fff' : 'var(--text-secondary)',
                cursor: 'pointer',
                textTransform: 'capitalize',
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Change Password */}
      <div className="config-section" style={{ marginTop: '24px' }}>
        <div className="config-section-title"><Icon name="lock" size={14} /> Change Password</div>
        <form onSubmit={handleChangePassword} style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '360px' }}>
          {passwordError && (
            <div style={{ padding: '8px 12px', borderRadius: 'var(--radius-md)', background: 'var(--red-bg)', color: 'var(--red)', fontSize: '12px', border: '1px solid rgba(248,113,113,0.15)' }}>
              {passwordError}
            </div>
          )}
          {passwordSuccess && (
            <div style={{ padding: '8px 12px', borderRadius: 'var(--radius-md)', background: 'rgba(74,222,128,0.1)', color: '#4ade80', fontSize: '12px', border: '1px solid rgba(74,222,128,0.15)' }}>
              {passwordSuccess}
            </div>
          )}
          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', color: 'var(--text-tertiary)' }}>Current Password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              style={inputStyle}
              autoComplete="current-password"
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', color: 'var(--text-tertiary)' }}>New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              placeholder="Min 12 chars (A-z, 0-9, symbol)"
              style={inputStyle}
              autoComplete="new-password"
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', color: 'var(--text-tertiary)' }}>Confirm New Password</label>
            <input
              type="password"
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
              required
              style={inputStyle}
              autoComplete="new-password"
            />
          </div>
          <button
            type="submit"
            disabled={passwordLoading}
            className="btn-primary"
            style={{ alignSelf: 'flex-start', padding: '8px 16px', fontSize: '13px', fontWeight: 500, marginLeft: 0 }}
          >
            {passwordLoading ? 'Changing...' : 'Change Password'}
          </button>
        </form>
      </div>

      <div className="config-section" style={{ marginTop: '24px' }}>
        <div className="config-section-title"><Icon name="info" size={14} /> About</div>
        <div style={{ marginTop: '12px', fontSize: '13px', color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
          Dialix — AI-powered calling platform built on ElevenLabs Conversational AI.
        </div>
      </div>
    </div>
  );
}
