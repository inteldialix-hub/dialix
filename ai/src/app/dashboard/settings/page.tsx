'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Icon } from '@/components/dashboard/shared/Icon';

export default function SettingsPage() {
  const { client, token } = useAuth();
  const [apiStatus, setApiStatus] = useState<{ status?: string } | null>(null);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/health`).then(r => r.json()).then(d => setApiStatus(d)).catch(() => setApiStatus({ status: 'error' }));
  }, []);

  return (
    <div style={{ maxWidth: 680, padding: 20 }}>
      <div className="page-title-section" style={{ padding: '24px 0' }}>
        <h2>Settings</h2>
        <p>System information and account details</p>
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

      <div className="config-section" style={{ marginTop: '24px' }}>
        <div className="config-section-title"><Icon name="info" size={14} /> About</div>
        <div style={{ marginTop: '12px', fontSize: '13px', color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
          Dialix — AI-powered calling platform built on ElevenLabs Conversational AI.
        </div>
      </div>
    </div>
  );
}
