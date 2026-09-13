'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from 'next-themes';
import { useToast } from '@/components/dashboard/shared/ToastProvider';
import { api } from '@/lib/api';
import { Icon } from '@/components/dashboard/shared/Icon';
import { SkeletonRows } from '@/components/dashboard/shared/SkeletonRows';

type SettingsTab = 'account' | 'team' | 'api-keys' | 'webhooks' | 'telemetry';

// ── Data Interfaces ──
interface TeamMember {
  id: number;
  user_id?: string;
  email: string;
  name?: string;
  role: 'owner' | 'admin' | 'manager' | 'viewer';
  created_at: string;
}

interface TeamInvitation {
  id: number;
  email: string;
  role: 'owner' | 'admin' | 'manager' | 'viewer';
  token: string;
  expires_at: string;
  created_at: string;
}

interface ApiKeyItem {
  id: number;
  name: string;
  prefix: string;
  scopes: string[];
  last_used_at?: string;
  created_at: string;
}

interface WebhookItem {
  id: number;
  url: string;
  events: string[];
  description?: string;
  created_at: string;
}

interface SystemErrorItem {
  id: number;
  error_message: string;
  component_name?: string;
  error_source?: string;
  error_severity?: 'critical' | 'high' | 'medium' | 'low';
  stack_trace?: string;
  url?: string;
  route_path?: string;
  status: 'unresolved' | 'open' | 'assigned_to_agent' | 'in_investigation' | 'resolved';
  error_context?: Record<string, unknown>;
  created_at: string;
  resolved_at?: string;
}

export default function SettingsPage() {
  const { client, token } = useAuth();
  const { theme, setTheme } = useTheme();
  const { addToast } = useToast();

  const [activeTab, setActiveTab] = useState<SettingsTab>('account');
  const [apiStatus, setApiStatus] = useState<{ status?: string; timestamp?: string } | null>(null);

  // ── Account & Password State ──
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  // ── Team Management State ──
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<TeamInvitation[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'manager' | 'viewer'>('viewer');
  const [inviting, setInviting] = useState(false);
  const [lastInviteLink, setLastInviteLink] = useState('');

  // ── API Keys State ──
  const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>([]);
  const [loadingKeys, setLoadingKeys] = useState(false);
  const [showCreateKeyModal, setShowCreateKeyModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [selectedScopes, setSelectedScopes] = useState<string[]>([
    'calls:read',
    'calls:write',
    'agents:read',
    'agents:write',
  ]);
  const [creatingKey, setCreatingKey] = useState(false);
  const [createdFullKey, setCreatedFullKey] = useState<string | null>(null);

  // ── Webhooks State ──
  const [webhooks, setWebhooks] = useState<WebhookItem[]>([]);
  const [availableEvents, setAvailableEvents] = useState<string[]>([]);
  const [loadingWebhooks, setLoadingWebhooks] = useState(false);
  const [showCreateWebhookModal, setShowCreateWebhookModal] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookDesc, setWebhookDesc] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [webhookEvents, setWebhookEvents] = useState<string[]>([]);
  const [creatingWebhook, setCreatingWebhook] = useState(false);
  const [testingWebhookId, setTestingWebhookId] = useState<number | null>(null);
  const [webhookTestResults, setWebhookTestResults] = useState<Record<number, { success: boolean; status: number; latency_ms: number; error?: string }>>({});

  // ── Telemetry & Bug Monitor State ──
  const [errorsList, setErrorsList] = useState<SystemErrorItem[]>([]);
  const [telemetrySummary, setTelemetrySummary] = useState<{ total: number; open: number; resolved: number }>({ total: 0, open: 0, resolved: 0 });
  const [loadingTelemetry, setLoadingTelemetry] = useState(false);
  const [telemetryFilter, setTelemetryFilter] = useState<'all' | 'open' | 'assigned_to_agent' | 'resolved'>('all');
  const [expandedErrorId, setExpandedErrorId] = useState<number | null>(null);
  const [dispatchingId, setDispatchingId] = useState<number | null>(null);
  const [resolvingId, setResolvingId] = useState<number | null>(null);

  // ── Initial API Health Check ──
  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/health`)
      .then(r => r.json())
      .then(d => setApiStatus(d))
      .catch(() => setApiStatus({ status: 'error' }));
  }, []);

  // ── Data Fetching Handlers ──
  const loadTeam = useCallback(async () => {
    if (!token) return;
    setLoadingTeam(true);
    try {
      const data = await api<{ team: TeamMember[]; invitations: TeamInvitation[] }>('/team', { token });
      setMembers(data.team || []);
      setInvitations(data.invitations || []);
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to load team members', 'error');
    } finally {
      setLoadingTeam(false);
    }
  }, [token, addToast]);

  const loadApiKeys = useCallback(async () => {
    if (!token) return;
    setLoadingKeys(true);
    try {
      const data = await api<{ keys: ApiKeyItem[] }>('/api-keys', { token });
      setApiKeys(data.keys || []);
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to load API keys', 'error');
    } finally {
      setLoadingKeys(false);
    }
  }, [token, addToast]);

  const loadWebhooks = useCallback(async () => {
    if (!token) return;
    setLoadingWebhooks(true);
    try {
      const [whData, evData] = await Promise.allSettled([
        api<{ webhooks: WebhookItem[] }>('/webhooks', { token }),
        api<{ events: string[] }>('/webhooks/events', { token }),
      ]);
      if (whData.status === 'fulfilled') setWebhooks(whData.value.webhooks || []);
      if (evData.status === 'fulfilled') {
        const events = evData.value.events || [];
        setAvailableEvents(events);
        if (webhookEvents.length === 0) setWebhookEvents(events);
      }
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to load webhooks', 'error');
    } finally {
      setLoadingWebhooks(false);
    }
  }, [token, addToast, webhookEvents.length]);

  const loadTelemetry = useCallback(async () => {
    if (!token) return;
    setLoadingTelemetry(true);
    try {
      const data = await api<{ errors: SystemErrorItem[]; summary: { total: number; open: number; resolved: number } }>('/telemetry/errors', { token });
      const errs = data.errors || [];
      setErrorsList(errs);
      const total = errs.length;
      const open = errs.filter(e => e.status === 'unresolved' || e.status === 'open').length;
      const resolved = errs.filter(e => e.status === 'resolved').length;
      setTelemetrySummary(data.summary || { total, open, resolved });
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to load telemetry', 'error');
    } finally {
      setLoadingTelemetry(false);
    }
  }, [token, addToast]);

  // Trigger loads on tab switch
  useEffect(() => {
    if (activeTab === 'team') loadTeam();
    else if (activeTab === 'api-keys') loadApiKeys();
    else if (activeTab === 'webhooks') loadWebhooks();
    else if (activeTab === 'telemetry') loadTelemetry();
  }, [activeTab, loadTeam, loadApiKeys, loadWebhooks, loadTelemetry]);

  // ── Action Handlers ──
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
      addToast('Password changed successfully', 'success');
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      const res = await api<{ message: string; invite_url: string }>('/team/invite', {
        method: 'POST',
        token: token!,
        body: { email: inviteEmail.trim(), role: inviteRole },
      });
      addToast('Invitation sent successfully!', 'success');
      setLastInviteLink(res.invite_url || '');
      setInviteEmail('');
      loadTeam();
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to send invitation', 'error');
    } finally {
      setInviting(false);
    }
  };

  const handleRevokeInvitation = async (id: number) => {
    try {
      await api(`/team/invitations/${id}`, { method: 'DELETE', token: token! });
      addToast('Invitation revoked', 'success');
      loadTeam();
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to revoke invitation', 'error');
    }
  };

  const handleRemoveMember = async (id: number, nameOrEmail: string) => {
    if (!confirm(`Are you sure you want to remove ${nameOrEmail} from the team?`)) return;
    try {
      await api(`/team/members/${id}`, { method: 'DELETE', token: token! });
      addToast('Member removed from team', 'success');
      loadTeam();
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to remove member', 'error');
    }
  };

  const handleChangeRole = async (id: number, role: 'admin' | 'manager' | 'viewer') => {
    try {
      await api(`/team/members/${id}/role`, {
        method: 'PATCH',
        token: token!,
        body: { role },
      });
      addToast('Role updated', 'success');
      loadTeam();
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to update role', 'error');
    }
  };

  const handleCreateApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;
    setCreatingKey(true);
    try {
      const res = await api<{ message: string; key: string }>('/api-keys', {
        method: 'POST',
        token: token!,
        body: { name: newKeyName.trim(), scopes: selectedScopes },
      });
      setCreatedFullKey(res.key);
      setNewKeyName('');
      loadApiKeys();
      addToast('API key generated successfully!', 'success');
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to create API key', 'error');
    } finally {
      setCreatingKey(false);
    }
  };

  const handleRevokeApiKey = async (id: number, name: string) => {
    if (!confirm(`Revoke API key "${name}"? Any systems using it will immediately lose access.`)) return;
    try {
      await api(`/api-keys/${id}`, { method: 'DELETE', token: token! });
      addToast('API key revoked', 'success');
      loadApiKeys();
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to revoke API key', 'error');
    }
  };

  const handleCreateWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!webhookUrl.trim() || webhookEvents.length === 0) return;
    setCreatingWebhook(true);
    try {
      await api('/webhooks', {
        method: 'POST',
        token: token!,
        body: {
          url: webhookUrl.trim(),
          events: webhookEvents,
          description: webhookDesc.trim(),
          secret: webhookSecret.trim() || undefined,
        },
      });
      addToast('Webhook endpoint added!', 'success');
      setShowCreateWebhookModal(false);
      setWebhookUrl('');
      setWebhookDesc('');
      setWebhookSecret('');
      loadWebhooks();
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to register webhook', 'error');
    } finally {
      setCreatingWebhook(false);
    }
  };

  const handleDeleteWebhook = async (id: number) => {
    if (!confirm('Delete this webhook endpoint?')) return;
    try {
      await api(`/webhooks/${id}`, { method: 'DELETE', token: token! });
      addToast('Webhook deleted', 'success');
      loadWebhooks();
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to delete webhook', 'error');
    }
  };

  const handleTestWebhook = async (id: number) => {
    setTestingWebhookId(id);
    try {
      const res = await api<{ success: boolean; status: number; latency_ms: number; error?: string }>(`/webhooks/${id}/test`, {
        method: 'POST',
        token: token!,
      });
      setWebhookTestResults(prev => ({ ...prev, [id]: res }));
      if (res.success) {
        addToast(`Ping successful (HTTP ${res.status} • ${res.latency_ms}ms)`, 'success');
      } else {
        addToast(`Ping returned HTTP ${res.status || 'failed'}: ${res.error || 'Server error'}`, 'error');
      }
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Ping test failed', 'error');
    } finally {
      setTestingWebhookId(null);
    }
  };

  const handleResolveError = async (id: number) => {
    setResolvingId(id);
    try {
      await api(`/telemetry/errors/${id}/resolve`, { method: 'POST', token: token! });
      addToast('Error marked as resolved', 'success');
      loadTelemetry();
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to resolve error', 'error');
    } finally {
      setResolvingId(null);
    }
  };

  const handleDispatchAgentFix = async (id: number) => {
    setDispatchingId(id);
    try {
      await api(`/telemetry/errors/${id}/dispatch`, { method: 'POST', token: token! });
      addToast('Dispatched to AI Bug Inbox! Worker assigned.', 'success');
      loadTelemetry();
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to dispatch fix', 'error');
    } finally {
      setDispatchingId(null);
    }
  };

  const copyToClipboard = (text: string, label = 'Copied to clipboard!') => {
    navigator.clipboard.writeText(text);
    addToast(label, 'success');
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

  const filteredErrors = errorsList.filter(e => {
    if (telemetryFilter === 'all') return true;
    if (telemetryFilter === 'open') return e.status === 'open' || e.status === 'unresolved';
    if (telemetryFilter === 'assigned_to_agent') return e.status === 'assigned_to_agent' || e.status === 'in_investigation';
    return e.status === telemetryFilter;
  });

  return (
    <div style={{ maxWidth: 960, padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Page Title */}
      <div>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
          Settings & Infrastructure
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 4 }}>
          Manage your organization, team members, developer API keys, outbound webhooks, and AI bug diagnostics.
        </p>
      </div>

      {/* Settings Navigation Tabs */}
      <div className="config-tabs" style={{ margin: 0 }}>
        {[
          { id: 'account' as const, label: 'Account & Security', icon: 'shield' },
          { id: 'team' as const, label: 'Team Management', icon: 'users' },
          { id: 'api-keys' as const, label: 'API Keys', icon: 'key' },
          { id: 'webhooks' as const, label: 'Webhooks', icon: 'webhook' },
          { id: 'telemetry' as const, label: 'System Health & Bugs', icon: 'activity' },
        ].map(tab => (
          <div
            key={tab.id}
            className={`config-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
            style={{ cursor: 'pointer' }}
          >
            <Icon name={tab.icon} size={14} /> {tab.label}
          </div>
        ))}
      </div>

      {/* ── TAB 1: Account & Security ── */}
      {activeTab === 'account' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* System Status */}
          <div className="config-section">
            <div className="config-section-title"><Icon name="server" size={14} /> System Status</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className={`status-dot ${apiStatus?.status === 'ok' ? 'active' : 'unavailable'}`} />
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  Backend Cluster: <strong>{apiStatus?.status === 'ok' ? 'Operational & Connected' : apiStatus ? 'Degraded / Error' : 'Checking...'}</strong>
                </span>
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-quaternary)' }}>
                {apiStatus?.timestamp ? `Checked ${new Date(apiStatus.timestamp).toLocaleTimeString()}` : ''}
              </span>
            </div>
          </div>

          {/* Account Details */}
          <div className="config-section">
            <div className="config-section-title"><Icon name="user" size={14} /> Account Profile</div>
            <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
              <div style={{ padding: '12px 14px', borderRadius: 'var(--radius-md)', background: 'var(--bg-secondary)', border: '1px solid var(--border-default)' }}>
                <div style={{ fontSize: 11, color: 'var(--text-quaternary)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 4 }}>Full Name</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{client?.name || 'Administrator'}</div>
              </div>
              <div style={{ padding: '12px 14px', borderRadius: 'var(--radius-md)', background: 'var(--bg-secondary)', border: '1px solid var(--border-default)' }}>
                <div style={{ fontSize: 11, color: 'var(--text-quaternary)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 4 }}>Email Address</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{client?.email || '—'}</div>
              </div>
              <div style={{ padding: '12px 14px', borderRadius: 'var(--radius-md)', background: 'var(--bg-secondary)', border: '1px solid var(--border-default)' }}>
                <div style={{ fontSize: 11, color: 'var(--text-quaternary)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 4 }}>Access Role</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--brand-accent)' }}>{client?.is_admin ? 'Super Admin' : 'Workspace Owner'}</div>
              </div>
            </div>
          </div>

          {/* Theme Preference */}
          <div className="config-section">
            <div className="config-section-title"><Icon name="sun" size={14} /> Appearance Theme</div>
            <div style={{ marginTop: 12, display: 'flex', gap: 10 }}>
              {(['dark', 'light', 'system'] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTheme(t)}
                  style={{
                    padding: '8px 18px',
                    fontSize: 13,
                    fontWeight: 500,
                    borderRadius: 'var(--radius-md)',
                    border: theme === t ? '1px solid var(--brand-accent)' : '1px solid var(--border-default)',
                    background: theme === t ? 'var(--brand-accent)' : 'var(--bg-secondary)',
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
          <div className="config-section">
            <div className="config-section-title"><Icon name="lock" size={14} /> Security & Password</div>
            <form onSubmit={handleChangePassword} style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 380 }}>
              {passwordError && (
                <div style={{ padding: '8px 12px', borderRadius: 'var(--radius-md)', background: 'rgba(239,68,68,0.1)', color: 'var(--red)', fontSize: 12, border: '1px solid rgba(239,68,68,0.2)' }}>
                  {passwordError}
                </div>
              )}
              {passwordSuccess && (
                <div style={{ padding: '8px 12px', borderRadius: 'var(--radius-md)', background: 'rgba(74,222,128,0.1)', color: '#4ade80', fontSize: 12, border: '1px solid rgba(74,222,128,0.15)' }}>
                  {passwordSuccess}
                </div>
              )}
              <div>
                <label style={{ display: 'block', marginBottom: 4, fontSize: 12, color: 'var(--text-tertiary)' }}>Current Password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  required
                  style={inputStyle}
                  autoComplete="current-password"
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 4, fontSize: 12, color: 'var(--text-tertiary)' }}>New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  required
                  placeholder="Min 12 chars (A-z, 0-9, symbol)"
                  style={inputStyle}
                  autoComplete="new-password"
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 4, fontSize: 12, color: 'var(--text-tertiary)' }}>Confirm New Password</label>
                <input
                  type="password"
                  value={confirmNewPassword}
                  onChange={e => setConfirmNewPassword(e.target.value)}
                  required
                  style={inputStyle}
                  autoComplete="new-password"
                />
              </div>
              <button
                type="submit"
                disabled={passwordLoading}
                className="btn-primary"
                style={{ alignSelf: 'flex-start', padding: '8px 18px', fontSize: 13, fontWeight: 500, margin: '6px 0 0 0' }}
              >
                {passwordLoading ? 'Changing...' : 'Update Password'}
              </button>
            </form>
          </div>

          {/* About Box */}
          <div className="config-section">
            <div className="config-section-title"><Icon name="info" size={14} /> Platform Specifications</div>
            <div style={{ marginTop: 10, fontSize: 13, color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
              <strong>Dialix Voice Cloud v3.0</strong> — Multi-provider AI dialing engine supporting ElevenLabs Conversational AI, Vapi Voice WebSockets, and Google Gemini Live.
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: Team Management ── */}
      {activeTab === 'team' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Header Action */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>Organization Members</div>
              <div style={{ fontSize: 12, color: 'var(--text-quaternary)' }}>Invite collaborators, assign roles, and manage permissions.</div>
            </div>
            <button
              type="button"
              className="btn-primary"
              onClick={() => { setShowInviteModal(true); setLastInviteLink(''); }}
              style={{ padding: '8px 16px', fontSize: 12, margin: 0 }}
            >
              <Icon name="user-plus" size={13} /> Invite Colleague
            </button>
          </div>

          {/* Members List */}
          <div className="config-section">
            <div className="config-section-title"><Icon name="users" size={14} /> Active Members ({members.length})</div>

            {loadingTeam ? (
              <SkeletonRows count={3} />
            ) : members.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-tertiary)' }}>No team members found.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
                {members.map(member => (
                  <div
                    key={member.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-default)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(99,102,241,0.15)', color: 'var(--brand-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 13 }}>
                        {(member.name || member.email || 'U')[0].toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                          {member.name || member.email.split('@')[0]}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-quaternary)' }}>
                          {member.email} • Joined {new Date(member.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      {member.role === 'owner' ? (
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 12, background: 'rgba(99,102,241,0.15)', color: 'var(--brand-accent)' }}>
                          Owner
                        </span>
                      ) : (
                        <select
                          className="form-input"
                          value={member.role}
                          onChange={e => handleChangeRole(member.id, e.target.value as 'admin' | 'manager' | 'viewer')}
                          style={{ padding: '4px 8px', fontSize: 12, width: 110 }}
                        >
                          <option value="admin">Admin</option>
                          <option value="manager">Manager</option>
                          <option value="viewer">Viewer</option>
                        </select>
                      )}

                      {member.role !== 'owner' && (
                        <button
                          type="button"
                          className="btn-ghost"
                          onClick={() => handleRemoveMember(member.id, member.name || member.email)}
                          style={{ color: 'var(--red)', padding: '4px 8px' }}
                          title="Remove member"
                        >
                          <Icon name="trash-2" size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pending Invitations */}
          {invitations.length > 0 && (
            <div className="config-section">
              <div className="config-section-title"><Icon name="mail" size={14} /> Pending Invitations ({invitations.length})</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
                {invitations.map(inv => (
                  <div
                    key={inv.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-default)',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{inv.email}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-quaternary)' }}>
                        Role: <strong style={{ textTransform: 'capitalize' }}>{inv.role}</strong> • Expires {new Date(inv.expires_at).toLocaleDateString()}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button
                        type="button"
                        className="btn-ghost"
                        onClick={() => copyToClipboard(`${window.location.origin}/invite/${inv.token}`, 'Invitation URL copied!')}
                        style={{ fontSize: 11, padding: '4px 8px', border: '1px solid var(--border-default)' }}
                      >
                        <Icon name="copy" size={11} /> Copy Link
                      </button>
                      <button
                        type="button"
                        className="btn-ghost"
                        onClick={() => handleRevokeInvitation(inv.id)}
                        style={{ color: 'var(--red)', fontSize: 11, padding: '4px 8px' }}
                      >
                        Revoke
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Invite Modal */}
          {showInviteModal && (
            <div className="modal-overlay" onClick={() => setShowInviteModal(false)}>
              <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
                <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>Invite Team Member</div>
                  <form onSubmit={handleSendInvite} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Email Address</label>
                      <input
                        type="email"
                        required
                        placeholder="colleague@company.com"
                        value={inviteEmail}
                        onChange={e => setInviteEmail(e.target.value)}
                        style={inputStyle}
                        autoFocus
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Role & Privileges</label>
                      <select
                        value={inviteRole}
                        onChange={e => setInviteRole(e.target.value as 'admin' | 'manager' | 'viewer')}
                        style={inputStyle}
                      >
                        <option value="viewer">Viewer — Read-only access to analytics & logs</option>
                        <option value="manager">Manager — Manage agents and launch campaigns</option>
                        <option value="admin">Admin — Full management including API keys & billing</option>
                      </select>
                    </div>

                    {lastInviteLink && (
                      <div style={{ marginTop: 8, padding: 12, background: 'rgba(52,211,153,0.1)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(52,211,153,0.2)' }}>
                        <div style={{ fontSize: 11, color: 'var(--green)', fontWeight: 600, marginBottom: 4 }}>Invitation Generated!</div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <input readOnly value={lastInviteLink} style={{ ...inputStyle, fontSize: 11, background: 'var(--bg-secondary)' }} />
                          <button
                            type="button"
                            className="btn-primary"
                            onClick={() => copyToClipboard(lastInviteLink)}
                            style={{ padding: '4px 10px', fontSize: 11, margin: 0 }}
                          >
                            Copy
                          </button>
                        </div>
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                      <button
                        type="button"
                        className="btn-ghost"
                        onClick={() => setShowInviteModal(false)}
                        style={{ padding: '8px 14px', fontSize: 12 }}
                      >
                        Close
                      </button>
                      <button
                        type="submit"
                        disabled={inviting || !inviteEmail.trim()}
                        className="btn-primary"
                        style={{ padding: '8px 16px', fontSize: 12, margin: 0 }}
                      >
                        {inviting ? 'Sending...' : 'Send Invitation'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 3: API Keys ── */}
      {activeTab === 'api-keys' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Header Action */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>Developer API Keys</div>
              <div style={{ fontSize: 12, color: 'var(--text-quaternary)' }}>Authenticate external scripts, CRMs, Zapier, and backend pipelines.</div>
            </div>
            <button
              type="button"
              className="btn-primary"
              onClick={() => { setShowCreateKeyModal(true); setCreatedFullKey(null); }}
              style={{ padding: '8px 16px', fontSize: 12, margin: 0 }}
            >
              <Icon name="plus" size={13} /> Create API Key
            </button>
          </div>

          {/* API Keys List */}
          <div className="config-section">
            <div className="config-section-title"><Icon name="key" size={14} /> Active Credentials ({apiKeys.length})</div>

            {loadingKeys ? (
              <SkeletonRows count={3} />
            ) : apiKeys.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-tertiary)' }}>
                No API keys generated yet. Create one to authenticate programmatic API requests.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
                {apiKeys.map(k => (
                  <div
                    key={k.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '14px 18px',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-default)',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{k.name}</span>
                        <code style={{ fontSize: 12, padding: '2px 8px', borderRadius: 4, background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                          {k.prefix}••••••••
                        </code>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        {(Array.isArray(k.scopes) ? k.scopes : []).map(sc => (
                          <span key={sc} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(99,102,241,0.1)', color: 'var(--brand-accent)', fontWeight: 500 }}>
                            {sc}
                          </span>
                        ))}
                        <span style={{ fontSize: 11, color: 'var(--text-quaternary)', marginLeft: 6 }}>
                          Created {new Date(k.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => handleRevokeApiKey(k.id, k.name)}
                      style={{ color: 'var(--red)', padding: '6px 12px', fontSize: 12, border: '1px solid rgba(239,68,68,0.2)' }}
                    >
                      Revoke Key
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Create Key Modal */}
          {showCreateKeyModal && (
            <div className="modal-overlay" onClick={() => setShowCreateKeyModal(false)}>
              <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
                <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>Generate New API Key</div>

                  {createdFullKey ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      <div style={{ padding: 12, borderRadius: 'var(--radius-md)', background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.25)', color: '#fbbf24', fontSize: 12 }}>
                        <strong>Important:</strong> Copy this secret key now. For your security, it will not be displayed again.
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input
                          readOnly
                          value={createdFullKey}
                          style={{ ...inputStyle, fontFamily: 'var(--font-mono)', fontSize: 13, background: 'var(--bg-secondary)' }}
                        />
                        <button
                          type="button"
                          className="btn-primary"
                          onClick={() => copyToClipboard(createdFullKey, 'Secret API key copied!')}
                          style={{ padding: '8px 16px', fontSize: 12, margin: 0 }}
                        >
                          <Icon name="copy" size={13} /> Copy
                        </button>
                      </div>
                      <button
                        type="button"
                        className="btn-ghost"
                        onClick={() => { setShowCreateKeyModal(false); setCreatedFullKey(null); }}
                        style={{ alignSelf: 'flex-end', padding: '6px 16px', fontSize: 12 }}
                      >
                        Done
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleCreateApiKey} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      <div>
                        <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Key Label / Identifier</label>
                        <input
                          placeholder="e.g. Zapier Lead Trigger, Production Worker"
                          value={newKeyName}
                          onChange={e => setNewKeyName(e.target.value)}
                          required
                          style={inputStyle}
                          autoFocus
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>Granted Permissions (Scopes)</label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                          {[
                            { id: 'calls:read', label: 'calls:read (View call logs)' },
                            { id: 'calls:write', label: 'calls:write (Initiate calls)' },
                            { id: 'agents:read', label: 'agents:read (List agents)' },
                            { id: 'agents:write', label: 'agents:write (Modify agents)' },
                            { id: 'campaigns:read', label: 'campaigns:read (View campaigns)' },
                            { id: 'campaigns:write', label: 'campaigns:write (Launch campaigns)' },
                          ].map(sc => (
                            <label
                              key={sc.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                fontSize: 12,
                                color: 'var(--text-secondary)',
                                padding: '6px 10px',
                                borderRadius: 6,
                                background: 'var(--bg-secondary)',
                                border: '1px solid var(--border-default)',
                                cursor: 'pointer',
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={selectedScopes.includes(sc.id)}
                                onChange={e => {
                                  if (e.target.checked) setSelectedScopes(p => [...p, sc.id]);
                                  else setSelectedScopes(p => p.filter(x => x !== sc.id));
                                }}
                              />
                              <span>{sc.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
                        <button
                          type="button"
                          className="btn-ghost"
                          onClick={() => setShowCreateKeyModal(false)}
                          style={{ padding: '8px 14px', fontSize: 12 }}
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={creatingKey || !newKeyName.trim()}
                          className="btn-primary"
                          style={{ padding: '8px 16px', fontSize: 12, margin: 0 }}
                        >
                          {creatingKey ? 'Generating...' : 'Generate Secret Key'}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 4: Webhooks ── */}
      {activeTab === 'webhooks' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Header Action */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>Outbound Webhooks</div>
              <div style={{ fontSize: 12, color: 'var(--text-quaternary)' }}>Deliver live event notifications to your server or webhook receivers.</div>
            </div>
            <button
              type="button"
              className="btn-primary"
              onClick={() => setShowCreateWebhookModal(true)}
              style={{ padding: '8px 16px', fontSize: 12, margin: 0 }}
            >
              <Icon name="plus" size={13} /> Add Webhook Endpoint
            </button>
          </div>

          {/* Webhooks List */}
          <div className="config-section">
            <div className="config-section-title"><Icon name="globe" size={14} /> Registered Endpoints ({webhooks.length})</div>

            {loadingWebhooks ? (
              <SkeletonRows count={3} />
            ) : webhooks.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-tertiary)' }}>
                No webhook endpoints registered. Add your webhook URL to receive real-time call and campaign updates.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
                {webhooks.map(wh => {
                  const testRes = webhookTestResults[wh.id];
                  return (
                    <div
                      key={wh.id}
                      style={{
                        padding: '16px 20px',
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-default)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 12,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Icon name="radio" size={16} style={{ color: 'var(--brand-accent)' }} />
                          <code style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{wh.url}</code>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {testRes && (
                            <span
                              style={{
                                fontSize: 11,
                                padding: '3px 8px',
                                borderRadius: 12,
                                background: testRes.success ? 'rgba(52,211,153,0.1)' : 'rgba(239,68,68,0.1)',
                                color: testRes.success ? 'var(--green)' : 'var(--red)',
                                fontWeight: 600,
                              }}
                            >
                              {testRes.success ? `HTTP ${testRes.status} • ${testRes.latency_ms}ms` : `HTTP ${testRes.status || 'ERR'}`}
                            </span>
                          )}

                          <button
                            type="button"
                            className="btn-ghost"
                            onClick={() => handleTestWebhook(wh.id)}
                            disabled={testingWebhookId === wh.id}
                            style={{ fontSize: 11, padding: '4px 10px', border: '1px solid var(--border-default)' }}
                          >
                            <Icon name="send" size={11} style={{ animation: testingWebhookId === wh.id ? 'spin 1s linear infinite' : 'none' }} />
                            {testingWebhookId === wh.id ? 'Pinging...' : 'Send Test Ping'}
                          </button>

                          <button
                            type="button"
                            className="btn-ghost"
                            onClick={() => handleDeleteWebhook(wh.id)}
                            style={{ color: 'var(--red)', padding: '4px 8px' }}
                            title="Delete webhook"
                          >
                            <Icon name="trash-2" size={14} />
                          </button>
                        </div>
                      </div>

                      {wh.description && (
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{wh.description}</div>
                      )}

                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 11, color: 'var(--text-quaternary)' }}>Events:</span>
                        {(Array.isArray(wh.events) ? wh.events : []).map(ev => (
                          <span
                            key={ev}
                            style={{
                              fontSize: 10,
                              padding: '2px 6px',
                              borderRadius: 4,
                              background: 'var(--bg-tertiary)',
                              color: 'var(--text-secondary)',
                              fontWeight: 500,
                              fontFamily: 'var(--font-mono)',
                            }}
                          >
                            {ev}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Add Webhook Modal */}
          {showCreateWebhookModal && (
            <div className="modal-overlay" onClick={() => setShowCreateWebhookModal(false)}>
              <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 540 }}>
                <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>Register Webhook Endpoint</div>
                  <form onSubmit={handleCreateWebhook} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Destination URL</label>
                      <input
                        type="url"
                        placeholder="https://api.yourdomain.com/webhooks/dialix"
                        value={webhookUrl}
                        onChange={e => setWebhookUrl(e.target.value)}
                        required
                        style={inputStyle}
                        autoFocus
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Description (optional)</label>
                      <input
                        placeholder="e.g. CRM Call Logger"
                        value={webhookDesc}
                        onChange={e => setWebhookDesc(e.target.value)}
                        style={inputStyle}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Signing Secret (optional)</label>
                      <input
                        placeholder="whsec_..."
                        value={webhookSecret}
                        onChange={e => setWebhookSecret(e.target.value)}
                        style={inputStyle}
                      />
                    </div>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Event Subscriptions</label>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            type="button"
                            className="btn-ghost"
                            onClick={() => setWebhookEvents(availableEvents)}
                            style={{ fontSize: 11, padding: '2px 6px' }}
                          >
                            Select All
                          </button>
                          <button
                            type="button"
                            className="btn-ghost"
                            onClick={() => setWebhookEvents([])}
                            style={{ fontSize: 11, padding: '2px 6px' }}
                          >
                            Clear
                          </button>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                        {availableEvents.map(ev => (
                          <label
                            key={ev}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              fontSize: 12,
                              color: 'var(--text-secondary)',
                              padding: '6px 8px',
                              borderRadius: 4,
                              background: 'var(--bg-secondary)',
                              border: '1px solid var(--border-default)',
                              cursor: 'pointer',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={webhookEvents.includes(ev)}
                              onChange={e => {
                                if (e.target.checked) setWebhookEvents(p => [...p, ev]);
                                else setWebhookEvents(p => p.filter(x => x !== ev));
                              }}
                            />
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{ev}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
                      <button
                        type="button"
                        className="btn-ghost"
                        onClick={() => setShowCreateWebhookModal(false)}
                        style={{ padding: '8px 14px', fontSize: 12 }}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={creatingWebhook || !webhookUrl.trim() || webhookEvents.length === 0}
                        className="btn-primary"
                        style={{ padding: '8px 16px', fontSize: 12, margin: 0 }}
                      >
                        {creatingWebhook ? 'Registering...' : 'Register Endpoint'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 5: System Health & Bug Monitor ── */}
      {activeTab === 'telemetry' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Summary KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            <div style={{ padding: '16px 18px', borderRadius: 'var(--radius-md)', background: 'var(--bg-secondary)', border: '1px solid var(--border-default)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-quaternary)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 6 }}>Total Captured</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>{telemetrySummary.total}</div>
            </div>
            <div style={{ padding: '16px 18px', borderRadius: 'var(--radius-md)', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <div style={{ fontSize: 11, color: 'var(--red)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 6 }}>Unresolved Errors</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--red)' }}>{telemetrySummary.open}</div>
            </div>
            <div style={{ padding: '16px 18px', borderRadius: 'var(--radius-md)', background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.2)' }}>
              <div style={{ fontSize: 11, color: 'var(--green)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 6 }}>Resolved / Mitigated</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--green)' }}>{telemetrySummary.resolved}</div>
            </div>
          </div>

          {/* Filter & Refresh Controls */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['all', 'open', 'assigned_to_agent', 'resolved'] as const).map(f => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setTelemetryFilter(f)}
                  style={{
                    padding: '6px 12px',
                    fontSize: 12,
                    borderRadius: 'var(--radius-md)',
                    border: telemetryFilter === f ? '1px solid var(--brand-accent)' : '1px solid var(--border-default)',
                    background: telemetryFilter === f ? 'var(--brand-accent)' : 'var(--bg-secondary)',
                    color: telemetryFilter === f ? '#fff' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    textTransform: 'capitalize',
                  }}
                >
                  {f.replace(/_/g, ' ')}
                </button>
              ))}
            </div>

            <button
              type="button"
              className="btn-ghost"
              onClick={loadTelemetry}
              disabled={loadingTelemetry}
              style={{ fontSize: 11, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 6, border: '1px solid var(--border-default)' }}
            >
              <Icon name="refresh-cw" size={12} style={{ animation: loadingTelemetry ? 'spin 1s linear infinite' : 'none' }} />
              Refresh Feed
            </button>
          </div>

          {/* Error Log Entries */}
          <div className="config-section">
            <div className="config-section-title"><Icon name="alert-triangle" size={14} /> Telemetry Incident Feed ({filteredErrors.length})</div>

            {loadingTelemetry ? (
              <SkeletonRows count={4} />
            ) : filteredErrors.length === 0 ? (
              <div style={{ padding: 36, textAlign: 'center', color: 'var(--text-tertiary)' }}>
                <Icon name="check-circle" size={28} style={{ color: 'var(--green)', display: 'inline-block', marginBottom: 8 }} />
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>System Healthy</div>
                <div style={{ fontSize: 12, color: 'var(--text-quaternary)', marginTop: 2 }}>No errors matching the active filter.</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
                {filteredErrors.map(err => {
                  const isExpanded = expandedErrorId === err.id;
                  const severityColor = err.error_severity === 'critical' ? 'var(--red)' : err.error_severity === 'high' ? 'var(--orange)' : '#818cf8';

                  return (
                    <div
                      key={err.id}
                      style={{
                        padding: '14px 18px',
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-default)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 10,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <span style={{ fontSize: 10, textTransform: 'uppercase', fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: `${severityColor}22`, color: severityColor }}>
                              {err.error_severity || 'HIGH'}
                            </span>
                            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>
                              source: {err.component_name || err.error_source || 'runtime'}
                            </span>
                            <span style={{ fontSize: 11, color: 'var(--text-quaternary)' }}>
                              • {new Date(err.created_at).toLocaleString()}
                            </span>
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', wordBreak: 'break-word' }}>
                            {err.error_message}
                          </div>
                          {(err.url || err.route_path) && (
                            <div style={{ fontSize: 11, color: 'var(--text-quaternary)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                              Path: {err.url || err.route_path}
                            </div>
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                          <span
                            style={{
                              fontSize: 11,
                              padding: '2px 8px',
                              borderRadius: 12,
                              background: err.status === 'resolved' ? 'rgba(52,211,153,0.1)' : err.status === 'assigned_to_agent' ? 'rgba(99,102,241,0.1)' : 'rgba(239,68,68,0.1)',
                              color: err.status === 'resolved' ? 'var(--green)' : err.status === 'assigned_to_agent' ? 'var(--brand-accent)' : 'var(--red)',
                              fontWeight: 600,
                            }}
                          >
                            {err.status.replace(/_/g, ' ')}
                          </span>

                          {err.status !== 'resolved' && (
                            <>
                              <button
                                type="button"
                                className="btn-ghost"
                                onClick={() => handleDispatchAgentFix(err.id)}
                                disabled={dispatchingId === err.id || err.status === 'assigned_to_agent'}
                                style={{ fontSize: 11, padding: '4px 10px', border: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', gap: 4 }}
                                title="Write error into agent_bug_inbox.json for autonomous coding fixes"
                              >
                                <Icon name="cpu" size={11} />
                                {err.status === 'assigned_to_agent' ? 'In Bug Inbox' : 'Dispatch AI Fix'}
                              </button>

                              <button
                                type="button"
                                className="btn-primary"
                                onClick={() => handleResolveError(err.id)}
                                disabled={resolvingId === err.id}
                                style={{ fontSize: 11, padding: '4px 10px', margin: 0 }}
                              >
                                <Icon name="check" size={11} />
                                Resolve
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Stack Trace / Context Accordion Toggle */}
                      {(err.stack_trace || err.error_context) && (
                        <div>
                          <button
                            type="button"
                            className="btn-ghost"
                            onClick={() => setExpandedErrorId(isExpanded ? null : err.id)}
                            style={{ fontSize: 11, padding: '2px 6px', display: 'flex', alignItems: 'center', gap: 4 }}
                          >
                            <Icon name={isExpanded ? 'chevron-up' : 'chevron-down'} size={12} />
                            {isExpanded ? 'Hide Trace & Context' : 'View Stack Trace & Diagnostics'}
                          </button>

                          {isExpanded && (
                            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                              {err.stack_trace && (
                                <pre style={{ margin: 0, padding: 12, borderRadius: 6, background: 'var(--bg-primary)', color: 'var(--red)', fontSize: 11, fontFamily: 'var(--font-mono)', overflowX: 'auto', maxHeight: 200 }}>
                                  {err.stack_trace}
                                </pre>
                              )}
                              {err.error_context && (
                                <pre style={{ margin: 0, padding: 10, borderRadius: 6, background: 'var(--bg-primary)', color: 'var(--text-secondary)', fontSize: 11, fontFamily: 'var(--font-mono)', overflowX: 'auto' }}>
                                  {JSON.stringify(err.error_context, null, 2)}
                                </pre>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
