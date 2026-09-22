'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from 'next-themes';
import { useToast } from '@/components/dashboard/shared/ToastProvider';
import { api } from '@/lib/api';
import { SkeletonRows } from '@/components/dashboard/shared/SkeletonRows';
import { ConfirmModal } from '@/components/dashboard/shared/ConfirmModal';
import { cn } from '@/lib/utils';
import { 
  Shield, Users, Key, Webhook, Activity, Server, User as UserIcon, Sun, Lock, 
  Info, UserPlus, Trash2, Mail, Copy, Plus, Globe, Radio, Send, AlertTriangle, 
  CheckCircle, Cpu, Check, ChevronDown, ChevronUp, RefreshCw, X, Bell, EyeOff
} from 'lucide-react';
import { useTopBar } from '@/components/dashboard/TopBarContext';

type SettingsTab = 'account' | 'notifications' | 'privacy' | 'team' | 'api-keys' | 'webhooks' | 'telemetry';

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

interface WebhookDelivery {
  id: number;
  event_type: string;
  status: string;
  http_status: number | null;
  latency_ms: number | null;
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
  const { setTopBar } = useTopBar();

  const [activeTab, setActiveTab] = useState<SettingsTab>('account');
  const [apiStatus, setApiStatus] = useState<{ status?: string; timestamp?: string } | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    onConfirm: () => void;
    danger?: boolean;
  } | null>(null);

  // ── Account & Password State ──
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  // ── Notification State ──
  const [notificationPrefs, setNotificationPrefs] = useState({
    call_failure: true,
    daily_digest: false,
    campaign_completion: true,
    payment_alerts: true,
  });
  const [savingNotifications, setSavingNotifications] = useState(false);

  // ── Privacy State ──
  const [retentionDays, setRetentionDays] = useState('90');
  const [savingRetention, setSavingRetention] = useState(false);
  const [exportingData, setExportingData] = useState(false);

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
  const [webhookDeliveries, setWebhookDeliveries] = useState<Record<number, WebhookDelivery[]>>({});
  const [expandedWebhookId, setExpandedWebhookId] = useState<number | null>(null);

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

  useEffect(() => {
    if (client) {
      if ((client as any).notification_preferences) {
        try {
          const prefs = typeof (client as any).notification_preferences === 'string' 
            ? JSON.parse((client as any).notification_preferences) 
            : (client as any).notification_preferences;
          setNotificationPrefs(prev => ({ ...prev, ...prefs }));
        } catch(e) {}
      }
      if ((client as any).recording_retention_days) {
        setRetentionDays((client as any).recording_retention_days.toString());
      }
    }
  }, [client]);

  const handleSaveNotifications = async () => {
    setSavingNotifications(true);
    try {
      await api('/auth/profile', {
        method: 'PATCH',
        token: token!,
        body: { notification_preferences: notificationPrefs }
      });
      addToast('Notification preferences saved', 'success');
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to save preferences', 'error');
    } finally {
      setSavingNotifications(false);
    }
  };

  const handleSaveRetention = async (days: string) => {
    setRetentionDays(days);
    setSavingRetention(true);
    try {
      await api('/auth/profile', {
        method: 'PATCH',
        token: token!,
        body: { recording_retention_days: parseInt(days, 10) }
      });
      addToast('Retention period updated', 'success');
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to update retention', 'error');
    } finally {
      setSavingRetention(false);
    }
  };

  const handleExportData = async () => {
    setExportingData(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/auth/export`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to export data');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'dialix_data_export.json';
      a.click();
      window.URL.revokeObjectURL(url);
      addToast('Data export complete', 'success');
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to export data', 'error');
    } finally {
      setExportingData(false);
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

  const handleRemoveMember = (id: number, nameOrEmail: string) => {
    setConfirmAction({
      title: 'Remove Team Member',
      message: `Are you sure you want to remove ${nameOrEmail} from the team?`,
      confirmLabel: 'Remove Member',
      danger: true,
      onConfirm: async () => {
        setConfirmAction(null);
        try {
          await api(`/team/members/${id}`, { method: 'DELETE', token: token! });
          addToast('Member removed from team', 'success');
          loadTeam();
        } catch (err) {
          addToast(err instanceof Error ? err.message : 'Failed to remove member', 'error');
        }
      }
    });
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

  const handleRevokeApiKey = (id: number, name: string) => {
    setConfirmAction({
      title: 'Revoke API Key',
      message: `Revoke API key "${name}"? Any systems using it will immediately lose access.`,
      confirmLabel: 'Revoke Key',
      danger: true,
      onConfirm: async () => {
        setConfirmAction(null);
        try {
          await api(`/api-keys/${id}`, { method: 'DELETE', token: token! });
          addToast('API key revoked', 'success');
          loadApiKeys();
        } catch (err) {
          addToast(err instanceof Error ? err.message : 'Failed to revoke API key', 'error');
        }
      }
    });
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

  const handleDeleteWebhook = (id: number) => {
    setConfirmAction({
      title: 'Delete Webhook Endpoint',
      message: 'Delete this webhook endpoint? Dialix will immediately stop sending event notifications to this URL.',
      confirmLabel: 'Delete Webhook',
      danger: true,
      onConfirm: async () => {
        setConfirmAction(null);
        try {
          await api(`/webhooks/${id}`, { method: 'DELETE', token: token! });
          addToast('Webhook deleted', 'success');
          loadWebhooks();
        } catch (err) {
          addToast(err instanceof Error ? err.message : 'Failed to delete webhook', 'error');
        }
      }
    });
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

  const loadDeliveries = async (id: number) => {
    try {
      const res = await api<{ deliveries: WebhookDelivery[] }>(`/webhooks/${id}/deliveries`, { token: token! });
      setWebhookDeliveries(prev => ({ ...prev, [id]: res.deliveries || [] }));
    } catch (err) {
      addToast('Failed to load webhook deliveries', 'error');
    }
  };

  const handleRetryDelivery = async (webhookId: number, deliveryId: number) => {
    try {
      await api(`/webhooks/${webhookId}/deliveries/${deliveryId}/retry`, { method: 'POST', token: token! });
      addToast('Delivery queued for retry', 'success');
      loadDeliveries(webhookId);
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to retry delivery', 'error');
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

  const filteredErrors = errorsList.filter(e => {
    if (telemetryFilter === 'all') return true;
    if (telemetryFilter === 'open') return e.status === 'open' || e.status === 'unresolved';
    if (telemetryFilter === 'assigned_to_agent') return e.status === 'assigned_to_agent' || e.status === 'in_investigation';
    return e.status === telemetryFilter;
  });

  const tabs = [
    { id: 'account' as const, label: 'Account & Security', icon: Shield },
    { id: 'notifications' as const, label: 'Notifications', icon: Bell },
    { id: 'privacy' as const, label: 'Privacy & Data', icon: EyeOff },
    { id: 'team' as const, label: 'Team Management', icon: Users },
    { id: 'api-keys' as const, label: 'API Keys', icon: Key },
    { id: 'webhooks' as const, label: 'Webhooks', icon: Webhook },
    { id: 'telemetry' as const, label: 'System Health & Bugs', icon: Activity },
  ];

  useEffect(() => {
    setTopBar({
      title: 'Settings',
    });
  }, [setTopBar]);

  return (
    <div className="max-w-7xl mx-auto px-6 py-6">
      <div className="border-b border-border mb-6">
        <nav className="flex gap-6">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "pb-3 text-sm font-medium transition-colors border-b-2 -mb-px flex items-center gap-2",
                  activeTab === tab.id
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            )
          })}
        </nav>
      </div>

      {activeTab === 'account' && (
        <div className="flex flex-col gap-6 max-w-4xl">
          <div className="rounded-lg border border-border bg-card">
            <div className="px-6 py-4 border-b border-border flex items-center gap-2">
              <Server size={16} className="text-muted-foreground" />
              <h3 className="font-medium text-sm">System Status</h3>
            </div>
            <div className="p-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className={cn(
                  "block w-2.5 h-2.5 rounded-full",
                  apiStatus?.status === 'ok' ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-red-500"
                )} />
                <span className="text-sm text-muted-foreground">
                  Backend Cluster: <strong className="text-foreground">{apiStatus?.status === 'ok' ? 'Operational & Connected' : apiStatus ? 'Degraded / Error' : 'Checking...'}</strong>
                </span>
              </div>
              <span className="text-xs text-muted-foreground">
                {apiStatus?.timestamp ? `Checked ${new Date(apiStatus.timestamp).toLocaleTimeString()}` : ''}
              </span>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card">
            <div className="px-6 py-4 border-b border-border flex items-center gap-2">
              <UserIcon size={16} className="text-muted-foreground" />
              <h3 className="font-medium text-sm">Account Profile</h3>
            </div>
            <div className="p-6 divide-y divide-border">
              <div className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
                <div>
                  <p className="text-sm font-medium">Full Name</p>
                  <p className="text-sm text-muted-foreground">The name associated with your account</p>
                </div>
                <div className="text-sm font-medium">{client?.name || 'Administrator'}</div>
              </div>
              <div className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
                <div>
                  <p className="text-sm font-medium">Email Address</p>
                  <p className="text-sm text-muted-foreground">The email used for login and notifications</p>
                </div>
                <div className="text-sm font-medium">{client?.email || '—'}</div>
              </div>
              <div className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
                <div>
                  <p className="text-sm font-medium">Access Role</p>
                  <p className="text-sm text-muted-foreground">Your permissions level in this workspace</p>
                </div>
                <div className="text-sm font-medium text-emerald-500">{client?.is_admin ? 'Super Admin' : 'Workspace Owner'}</div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card">
            <div className="px-6 py-4 border-b border-border flex items-center gap-2">
              <Sun size={16} className="text-muted-foreground" />
              <h3 className="font-medium text-sm">Appearance</h3>
            </div>
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Theme Preference</p>
                  <p className="text-sm text-muted-foreground">Choose how the dashboard looks</p>
                </div>
                <div className="flex gap-2">
                  {(['dark', 'light', 'system'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => setTheme(t)}
                      className={cn(
                        "px-4 py-2 text-sm rounded-md capitalize transition-colors border",
                        theme === t 
                          ? "bg-foreground text-background border-foreground" 
                          : "bg-transparent text-muted-foreground border-border hover:border-foreground"
                      )}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card">
            <div className="px-6 py-4 border-b border-border flex items-center gap-2">
              <Lock size={16} className="text-muted-foreground" />
              <h3 className="font-medium text-sm">Security & Password</h3>
            </div>
            <div className="p-6">
              <form onSubmit={handleChangePassword} className="flex flex-col gap-4 max-w-sm">
                {passwordError && (
                  <div className="px-3 py-2 text-sm rounded-md bg-red-500/10 text-red-400 border border-red-500/20">
                    {passwordError}
                  </div>
                )}
                {passwordSuccess && (
                  <div className="px-3 py-2 text-sm rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    {passwordSuccess}
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-foreground">Current Password</label>
                  <input
                    type="password"
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    value={currentPassword}
                    onChange={e => setCurrentPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-foreground">New Password</label>
                  <input
                    type="password"
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    placeholder="Min 12 chars (A-z, 0-9, symbol)"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-foreground">Confirm New Password</label>
                  <input
                    type="password"
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    value={confirmNewPassword}
                    onChange={e => setConfirmNewPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                  />
                </div>
                <button
                  type="submit"
                  disabled={passwordLoading}
                  className="bg-foreground text-background hover:bg-foreground/90 rounded-md px-4 py-2 text-sm font-medium self-start mt-2"
                >
                  {passwordLoading ? 'Changing...' : 'Update Password'}
                </button>
              </form>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card">
            <div className="px-6 py-4 border-b border-border flex items-center gap-2">
              <Info size={16} className="text-muted-foreground" />
              <h3 className="font-medium text-sm">Platform Specifications</h3>
            </div>
            <div className="p-6">
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground font-medium">Dialix Voice Cloud v3.0</strong> — Multi-provider AI dialing engine supporting ElevenLabs Conversational AI, Vapi Voice WebSockets, and Google Gemini Live.
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-red-500/30 bg-card">
            <div className="px-6 py-4 border-b border-red-500/20 flex items-center gap-2">
              <AlertTriangle size={16} className="text-red-500" />
              <h3 className="font-medium text-sm text-red-400">Danger Zone</h3>
            </div>
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Delete Account</p>
                  <p className="text-sm text-muted-foreground">Permanently remove your account and all associated data. This action cannot be undone.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setConfirmAction({
                    title: 'Delete Account Permanently',
                    message: 'This will permanently delete your account, all contacts, campaigns, call history, and settings. This action is irreversible.',
                    confirmLabel: 'Yes, Delete Everything',
                    danger: true,
                    onConfirm: async () => {
                      const deletePassword = prompt('Enter your password to confirm account deletion:');
                      if (!deletePassword) return;
                      try {
                        await api('/auth/me', {
                          method: 'DELETE',
                          token: token!,
                          body: { password: deletePassword },
                        });
                        addToast('Account deleted successfully', 'success');
                        localStorage.removeItem('dialix_token');
                        localStorage.removeItem('dialix_client');
                        window.location.href = '/';
                      } catch (err) {
                        addToast(err instanceof Error ? err.message : 'Failed to delete account', 'error');
                      }
                      setConfirmAction(null);
                    },
                  })}
                  className="bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30 rounded-md px-4 py-2 text-sm font-medium transition-colors flex-shrink-0"
                >
                  Delete Account
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'notifications' && (
        <div className="flex flex-col gap-6 max-w-4xl">
          <div className="rounded-lg border border-border bg-card">
            <div className="px-6 py-4 border-b border-border flex items-center gap-2">
              <Bell size={16} className="text-muted-foreground" />
              <h3 className="font-medium text-sm">Notification Preferences</h3>
            </div>
            <div className="p-6 flex flex-col gap-6">
              {[
                { id: 'call_failure', label: 'Email on call failure', desc: 'Get notified immediately if a call fails unexpectedly' },
                { id: 'daily_digest', label: 'Daily digest', desc: 'Receive a daily summary of all call and campaign activity' },
                { id: 'campaign_completion', label: 'Campaign completion', desc: 'Get notified when an outbound campaign finishes' },
                { id: 'payment_alerts', label: 'Payment alerts', desc: 'Receive updates about billing and subscription renewals' }
              ].map(opt => (
                <div key={opt.id} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{opt.label}</p>
                    <p className="text-sm text-muted-foreground">{opt.desc}</p>
                  </div>
                  <button
                    onClick={() => setNotificationPrefs(p => ({ ...p, [opt.id]: !p[opt.id as keyof typeof p] }))}
                    className={cn(
                      "w-11 h-6 rounded-full transition-colors relative flex items-center px-1",
                      notificationPrefs[opt.id as keyof typeof notificationPrefs] ? "bg-foreground" : "bg-muted"
                    )}
                  >
                    <span className={cn(
                      "w-4 h-4 rounded-full bg-background transition-transform",
                      notificationPrefs[opt.id as keyof typeof notificationPrefs] ? "translate-x-5" : "translate-x-0"
                    )} />
                  </button>
                </div>
              ))}
              <div className="pt-4 border-t border-border">
                <button
                  onClick={handleSaveNotifications}
                  disabled={savingNotifications}
                  className="bg-foreground text-background hover:bg-foreground/90 rounded-md px-4 py-2 text-sm font-medium"
                >
                  {savingNotifications ? 'Saving...' : 'Save Preferences'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'privacy' && (
        <div className="flex flex-col gap-6 max-w-4xl">
          <div className="rounded-lg border border-border bg-card">
            <div className="px-6 py-4 border-b border-border flex items-center gap-2">
              <EyeOff size={16} className="text-muted-foreground" />
              <h3 className="font-medium text-sm">Data Retention Policy</h3>
            </div>
            <div className="p-6">
              <div className="flex flex-col gap-4">
                <div>
                  <p className="text-sm font-medium mb-1">Call Recording & Transcript Retention</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Choose how long we should store your call recordings and transcripts. 
                    Data older than this period will be automatically and permanently deleted.
                  </p>
                  <select
                    value={retentionDays}
                    onChange={(e) => setRetentionDays(e.target.value)}
                    className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring w-64"
                  >
                    <option value="30">30 days</option>
                    <option value="60">60 days</option>
                    <option value="90">90 days (Default)</option>
                    <option value="180">180 days</option>
                    <option value="365">365 days</option>
                  </select>
                </div>
                <div className="pt-2">
                  <button
                    onClick={() => handleSaveRetention(retentionDays)}
                    disabled={savingRetention}
                    className="bg-foreground text-background hover:bg-foreground/90 rounded-md px-4 py-2 text-sm font-medium"
                  >
                    {savingRetention ? 'Saving...' : 'Update Retention'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card">
            <div className="px-6 py-4 border-b border-border flex items-center gap-2">
              <Globe size={16} className="text-muted-foreground" />
              <h3 className="font-medium text-sm">GDPR Data Rights</h3>
            </div>
            <div className="p-6 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Export Your Data</p>
                  <p className="text-sm text-muted-foreground">Download a machine-readable JSON file containing all your account data, contacts, and call logs.</p>
                </div>
                <button
                  onClick={handleExportData}
                  disabled={exportingData}
                  className="bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 rounded-md px-4 py-2 text-sm font-medium transition-colors flex-shrink-0"
                >
                  {exportingData ? 'Preparing...' : 'Export Data'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'team' && (
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Organization Members</h2>
              <p className="text-sm text-muted-foreground">Invite collaborators, assign roles, and manage permissions.</p>
            </div>
            <button
              type="button"
              className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 text-sm font-medium inline-flex items-center gap-2"
              onClick={() => { setShowInviteModal(true); setLastInviteLink(''); }}
            >
              <UserPlus size={16} /> Invite Colleague
            </button>
          </div>

          <div className="rounded-lg border border-border bg-card">
            <div className="px-6 py-4 border-b border-border flex items-center gap-2">
              <Users size={16} className="text-muted-foreground" />
              <h3 className="font-medium text-sm">Active Members ({members.length})</h3>
            </div>
            
            {loadingTeam ? (
              <div className="p-6"><SkeletonRows count={3} /></div>
            ) : members.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">No team members found.</div>
            ) : (
              <div className="divide-y divide-border">
                {members.map(member => (
                  <div key={member.id} className="flex items-center justify-between p-6">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold">
                        {(member.name || member.email || 'U')[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{member.name || member.email.split('@')[0]}</p>
                        <p className="text-xs text-muted-foreground">{member.email} • Joined {new Date(member.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      {member.role === 'owner' ? (
                        <span className="bg-primary/10 text-primary rounded-full px-3 py-1 text-xs font-medium">Owner</span>
                      ) : (
                        <select
                          className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring w-32"
                          value={member.role}
                          onChange={e => handleChangeRole(member.id, e.target.value as 'admin' | 'manager' | 'viewer')}
                        >
                          <option value="admin">Admin</option>
                          <option value="manager">Manager</option>
                          <option value="viewer">Viewer</option>
                        </select>
                      )}

                      {member.role !== 'owner' && (
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-red-500 rounded-md p-2 transition-colors"
                          onClick={() => handleRemoveMember(member.id, member.name || member.email)}
                          title="Remove member"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {invitations.length > 0 && (
            <div className="rounded-lg border border-border bg-card mt-2">
              <div className="px-6 py-4 border-b border-border flex items-center gap-2">
                <Mail size={16} className="text-muted-foreground" />
                <h3 className="font-medium text-sm">Pending Invitations ({invitations.length})</h3>
              </div>
              
              <div className="divide-y divide-border">
                {invitations.map(inv => (
                  <div key={inv.id} className="flex items-center justify-between p-6">
                    <div>
                      <p className="text-sm font-medium">{inv.email}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Role: <strong className="capitalize text-foreground font-medium">{inv.role}</strong> • Expires {new Date(inv.expires_at).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-foreground hover:bg-accent rounded-md px-3 py-1.5 text-xs font-medium inline-flex items-center gap-1.5 border border-border"
                        onClick={() => copyToClipboard(`${window.location.origin}/invite/${inv.token}`, 'Invitation URL copied!')}
                      >
                        <Copy size={12} /> Copy Link
                      </button>
                      <button
                        type="button"
                        className="text-red-500 hover:text-red-600 hover:bg-red-500/10 rounded-md px-3 py-1.5 text-xs font-medium"
                        onClick={() => handleRevokeInvitation(inv.id)}
                      >
                        Revoke
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {showInviteModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
              <div className="w-full max-w-md rounded-lg border border-border bg-card p-6" onClick={e => e.stopPropagation()}>
                <h2 className="text-lg font-semibold mb-6">Invite Team Member</h2>
                
                <form onSubmit={handleSendInvite} className="flex flex-col gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5 text-foreground">Email Address</label>
                    <input
                      type="email"
                      required
                      placeholder="colleague@company.com"
                      value={inviteEmail}
                      onChange={e => setInviteEmail(e.target.value)}
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                      autoFocus
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-1.5 text-foreground">Role & Privileges</label>
                    <select
                      value={inviteRole}
                      onChange={e => setInviteRole(e.target.value as 'admin' | 'manager' | 'viewer')}
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      <option value="viewer">Viewer — Read-only access to analytics & logs</option>
                      <option value="manager">Manager — Manage agents and launch campaigns</option>
                      <option value="admin">Admin — Full management including API keys & billing</option>
                    </select>
                  </div>

                  {lastInviteLink && (
                    <div className="mt-2 p-3 bg-emerald-500/10 rounded-md border border-emerald-500/20">
                      <p className="text-xs font-semibold text-emerald-500 mb-2">Invitation Generated!</p>
                      <div className="flex gap-2">
                        <input 
                          readOnly 
                          value={lastInviteLink} 
                          className="flex-1 rounded-md border border-emerald-500/30 bg-background/50 px-2 py-1 text-xs text-emerald-500 focus:outline-none" 
                        />
                        <button
                          type="button"
                          className="bg-emerald-500 text-white hover:bg-emerald-600 rounded-md px-3 py-1 text-xs font-medium"
                          onClick={() => copyToClipboard(lastInviteLink)}
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-border">
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground hover:bg-accent rounded-md px-4 py-2 text-sm font-medium"
                      onClick={() => setShowInviteModal(false)}
                    >
                      Close
                    </button>
                    <button
                      type="submit"
                      disabled={inviting || !inviteEmail.trim()}
                      className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
                    >
                      {inviting ? 'Sending...' : 'Send Invitation'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'api-keys' && (
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Developer API Keys</h2>
              <p className="text-sm text-muted-foreground">Authenticate external scripts, CRMs, Zapier, and backend pipelines.</p>
            </div>
            <button
              type="button"
              className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 text-sm font-medium inline-flex items-center gap-2"
              onClick={() => { setShowCreateKeyModal(true); setCreatedFullKey(null); }}
            >
              <Plus size={16} /> Create API Key
            </button>
          </div>

          <div className="rounded-lg border border-border bg-card">
            <div className="px-6 py-4 border-b border-border flex items-center gap-2">
              <Key size={16} className="text-muted-foreground" />
              <h3 className="font-medium text-sm">Active Credentials ({apiKeys.length})</h3>
            </div>
            
            {loadingKeys ? (
              <div className="p-6"><SkeletonRows count={3} /></div>
            ) : apiKeys.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No API keys generated yet. Create one to authenticate programmatic API requests.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {apiKeys.map(k => (
                  <div key={k.id} className="flex items-center justify-between p-6 hover:bg-accent/30 transition-colors">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-sm font-semibold">{k.name}</span>
                        <code className="text-xs px-2 py-0.5 rounded-md bg-muted text-muted-foreground font-mono">
                          {k.prefix}••••••••
                        </code>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap mt-2">
                        {(Array.isArray(k.scopes) ? k.scopes : []).map(sc => (
                          <span key={sc} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium uppercase tracking-wide">
                            {sc}
                          </span>
                        ))}
                        <span className="text-xs text-muted-foreground ml-2">
                          Created {new Date(k.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="text-red-500 hover:text-red-600 hover:bg-red-500/10 border border-red-500/20 rounded-md px-4 py-2 text-sm font-medium transition-colors"
                      onClick={() => handleRevokeApiKey(k.id, k.name)}
                    >
                      Revoke Key
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {showCreateKeyModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
              <div className="w-full max-w-md rounded-lg border border-border bg-card p-6" onClick={e => e.stopPropagation()}>
                <h2 className="text-lg font-semibold mb-6">Generate New API Key</h2>

                {createdFullKey ? (
                  <div className="flex flex-col gap-4">
                    <div className="p-4 rounded-md bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 text-sm">
                      <strong className="font-semibold">Important:</strong> Copy this secret key now. For your security, it will not be displayed again.
                    </div>
                    <div className="flex gap-2">
                      <input
                        readOnly
                        value={createdFullKey}
                        className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm font-mono text-foreground focus:outline-none"
                      />
                      <button
                        type="button"
                        className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 text-sm font-medium inline-flex items-center gap-2"
                        onClick={() => copyToClipboard(createdFullKey, 'Secret API key copied!')}
                      >
                        <Copy size={14} /> Copy
                      </button>
                    </div>
                    <div className="flex justify-end mt-4 pt-4 border-t border-border">
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-foreground hover:bg-accent rounded-md px-4 py-2 text-sm font-medium"
                        onClick={() => { setShowCreateKeyModal(false); setCreatedFullKey(null); }}
                      >
                        Done
                      </button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleCreateApiKey} className="flex flex-col gap-5">
                    <div>
                      <label className="block text-sm font-medium mb-1.5 text-foreground">Key Label / Identifier</label>
                      <input
                        placeholder="e.g. Zapier Lead Trigger, Production Worker"
                        value={newKeyName}
                        onChange={e => setNewKeyName(e.target.value)}
                        required
                        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                        autoFocus
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2 text-foreground">Granted Permissions (Scopes)</label>
                      <div className="grid grid-cols-1 gap-2">
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
                            className="flex items-center gap-3 p-2 rounded-md border border-border bg-background hover:bg-accent/50 cursor-pointer transition-colors"
                          >
                            <input
                              type="checkbox"
                              className="rounded border-border bg-background text-primary focus:ring-primary"
                              checked={selectedScopes.includes(sc.id)}
                              onChange={e => {
                                if (e.target.checked) setSelectedScopes(p => [...p, sc.id]);
                                else setSelectedScopes(p => p.filter(x => x !== sc.id));
                              }}
                            />
                            <span className="text-sm">{sc.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-border">
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-foreground hover:bg-accent rounded-md px-4 py-2 text-sm font-medium"
                        onClick={() => setShowCreateKeyModal(false)}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={creatingKey || !newKeyName.trim()}
                        className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
                      >
                        {creatingKey ? 'Generating...' : 'Generate Secret Key'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'webhooks' && (
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Outbound Webhooks</h2>
              <p className="text-sm text-muted-foreground">Deliver live event notifications to your server or webhook receivers.</p>
            </div>
            <button
              type="button"
              className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 text-sm font-medium inline-flex items-center gap-2"
              onClick={() => setShowCreateWebhookModal(true)}
            >
              <Plus size={16} /> Add Webhook Endpoint
            </button>
          </div>

          <div className="rounded-lg border border-border bg-card">
            <div className="px-6 py-4 border-b border-border flex items-center gap-2">
              <Globe size={16} className="text-muted-foreground" />
              <h3 className="font-medium text-sm">Registered Endpoints ({webhooks.length})</h3>
            </div>
            
            {loadingWebhooks ? (
              <div className="p-6"><SkeletonRows count={3} /></div>
            ) : webhooks.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No webhook endpoints registered. Add your webhook URL to receive real-time call and campaign updates.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {webhooks.map(wh => {
                  const testRes = webhookTestResults[wh.id];
                  const deliveries = webhookDeliveries[wh.id] || [];
                  const isExpanded = expandedWebhookId === wh.id;

                  return (
                    <div key={wh.id} className="p-6 flex flex-col gap-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 overflow-hidden">
                          <Radio size={18} className="text-primary flex-shrink-0" />
                          <code className="text-sm font-semibold truncate bg-muted px-2 py-1 rounded-md">{wh.url}</code>
                        </div>

                        <div className="flex items-center gap-3 flex-shrink-0">
                          {testRes && (
                            <span className={cn(
                              "text-xs px-2.5 py-1 rounded-full font-medium tracking-wide",
                              testRes.success ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                            )}>
                              {testRes.success ? `HTTP ${testRes.status} • ${testRes.latency_ms}ms` : `HTTP ${testRes.status || 'ERR'}`}
                            </span>
                          )}

                          <button
                            type="button"
                            className="text-muted-foreground hover:text-foreground hover:bg-accent rounded-md px-3 py-1.5 text-xs font-medium inline-flex items-center gap-1.5 border border-border"
                            onClick={() => handleTestWebhook(wh.id)}
                            disabled={testingWebhookId === wh.id}
                          >
                            <Send size={12} className={testingWebhookId === wh.id ? 'animate-pulse' : ''} />
                            {testingWebhookId === wh.id ? 'Pinging...' : 'Send Test Ping'}
                          </button>

                          <button
                            type="button"
                            className="text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-md p-2 transition-colors"
                            onClick={() => handleDeleteWebhook(wh.id)}
                            title="Delete webhook"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>

                      {wh.description && (
                        <div className="text-sm text-muted-foreground">{wh.description}</div>
                      )}

                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-muted-foreground font-medium mr-1">Events:</span>
                        {(Array.isArray(wh.events) ? wh.events : []).map(ev => (
                          <span
                            key={ev}
                            className="text-[10px] px-2 py-0.5 rounded-md bg-accent text-foreground font-mono"
                          >
                            {ev}
                          </span>
                        ))}
                      </div>

                      <div className="mt-2 border-t border-border pt-3">
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-foreground text-xs font-medium inline-flex items-center gap-1.5 transition-colors"
                          onClick={() => {
                            if (isExpanded) {
                              setExpandedWebhookId(null);
                            } else {
                              setExpandedWebhookId(wh.id);
                              loadDeliveries(wh.id);
                            }
                          }}
                        >
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          {isExpanded ? 'Hide Delivery History' : 'View Delivery History'}
                        </button>

                        {isExpanded && (
                          <div className="mt-3 bg-card border border-border rounded-md overflow-hidden">
                            {deliveries.length === 0 ? (
                              <div className="p-4 text-center text-xs text-muted-foreground">No recent deliveries found for this webhook.</div>
                            ) : (
                              <div className="divide-y divide-border">
                                {deliveries.map(d => (
                                  <div key={d.id} className="p-3 flex items-center justify-between gap-4 hover:bg-accent/30 transition-colors">
                                    <div className="flex flex-col gap-1">
                                      <div className="flex items-center gap-2">
                                        <span className={cn(
                                          "px-2 py-0.5 text-[10px] font-medium rounded-full uppercase tracking-wider",
                                          d.status === 'success' ? "bg-emerald-500/10 text-emerald-500" :
                                          d.status === 'failed' ? "bg-red-500/10 text-red-500" :
                                          "bg-yellow-500/10 text-yellow-500"
                                        )}>
                                          {d.status}
                                        </span>
                                        <span className="text-xs font-mono font-medium">{d.event_type}</span>
                                      </div>
                                      <span className="text-[11px] text-muted-foreground">{new Date(d.created_at).toLocaleString()}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      {d.http_status && (
                                        <span className="text-[11px] text-muted-foreground font-mono">
                                          HTTP {d.http_status}
                                        </span>
                                      )}
                                      {d.latency_ms && (
                                        <span className="text-[11px] text-muted-foreground">
                                          {d.latency_ms}ms
                                        </span>
                                      )}
                                      {d.status === 'failed' && (
                                        <button
                                          type="button"
                                          className="bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded border border-border px-2 py-1 text-[10px] font-medium"
                                          onClick={() => handleRetryDelivery(wh.id, d.id)}
                                        >
                                          Retry
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {showCreateWebhookModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
              <div className="w-full max-w-lg rounded-lg border border-border bg-card p-6" onClick={e => e.stopPropagation()}>
                <h2 className="text-lg font-semibold mb-6">Register Webhook Endpoint</h2>
                
                <form onSubmit={handleCreateWebhook} className="flex flex-col gap-5">
                  <div>
                    <label className="block text-sm font-medium mb-1.5 text-foreground">Destination URL</label>
                    <input
                      type="url"
                      placeholder="https://api.yourdomain.com/webhooks/dialix"
                      value={webhookUrl}
                      onChange={e => setWebhookUrl(e.target.value)}
                      required
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1.5 text-foreground">Description (optional)</label>
                    <input
                      placeholder="e.g. CRM Call Logger"
                      value={webhookDesc}
                      onChange={e => setWebhookDesc(e.target.value)}
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1.5 text-foreground">Signing Secret (optional)</label>
                    <input
                      placeholder="whsec_..."
                      value={webhookSecret}
                      onChange={e => setWebhookSecret(e.target.value)}
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="block text-sm font-medium text-foreground">Event Subscriptions</label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="text-xs text-primary hover:underline font-medium"
                          onClick={() => setWebhookEvents(availableEvents)}
                        >
                          Select All
                        </button>
                        <span className="text-muted-foreground text-xs">|</span>
                        <button
                          type="button"
                          className="text-xs text-muted-foreground hover:text-foreground hover:underline font-medium"
                          onClick={() => setWebhookEvents([])}
                        >
                          Clear
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1">
                      {availableEvents.map(ev => (
                        <label
                          key={ev}
                          className="flex items-center gap-2.5 p-2 rounded-md border border-border bg-background hover:bg-accent/50 cursor-pointer transition-colors"
                        >
                          <input
                            type="checkbox"
                            className="rounded border-border bg-background text-primary focus:ring-primary"
                            checked={webhookEvents.includes(ev)}
                            onChange={e => {
                              if (e.target.checked) setWebhookEvents(p => [...p, ev]);
                              else setWebhookEvents(p => p.filter(x => x !== ev));
                            }}
                          />
                          <span className="text-xs font-mono">{ev}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-border">
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground hover:bg-accent rounded-md px-4 py-2 text-sm font-medium"
                      onClick={() => setShowCreateWebhookModal(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={creatingWebhook || !webhookUrl.trim() || webhookEvents.length === 0}
                      className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
                    >
                      {creatingWebhook ? 'Registering...' : 'Register Endpoint'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'telemetry' && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-lg border border-border bg-card p-6">
              <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-2">Total Captured</div>
              <div className="text-3xl font-semibold font-mono tabular-nums">{telemetrySummary.total}</div>
            </div>
            <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-6">
              <div className="text-xs text-red-500 uppercase tracking-wider font-medium mb-2">Unresolved Errors</div>
              <div className="text-3xl font-semibold font-mono tabular-nums text-red-500">{telemetrySummary.open}</div>
            </div>
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-6">
              <div className="text-xs text-emerald-500 uppercase tracking-wider font-medium mb-2">Resolved / Mitigated</div>
              <div className="text-3xl font-semibold font-mono tabular-nums text-emerald-500">{telemetrySummary.resolved}</div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex gap-2 bg-muted/50 p-1 rounded-lg border border-border">
              {(['all', 'open', 'assigned_to_agent', 'resolved'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setTelemetryFilter(f)}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-colors",
                    telemetryFilter === f
                      ? "bg-background text-foreground shadow-sm border border-border"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/50 border border-transparent"
                  )}
                >
                  {f.replace(/_/g, ' ')}
                </button>
              ))}
            </div>

            <button
              type="button"
              className="text-muted-foreground hover:text-foreground hover:bg-accent rounded-md px-3 py-1.5 text-xs font-medium inline-flex items-center gap-2 border border-border transition-colors"
              onClick={loadTelemetry}
              disabled={loadingTelemetry}
            >
              <RefreshCw size={14} className={loadingTelemetry ? 'animate-spin' : ''} />
              Refresh Feed
            </button>
          </div>

          <div className="rounded-lg border border-border bg-card">
            <div className="px-6 py-4 border-b border-border flex items-center gap-2">
              <AlertTriangle size={16} className="text-muted-foreground" />
              <h3 className="font-medium text-sm">Telemetry Incident Feed ({filteredErrors.length})</h3>
            </div>
            
            {loadingTelemetry ? (
              <div className="p-6"><SkeletonRows count={4} /></div>
            ) : filteredErrors.length === 0 ? (
              <div className="p-12 flex flex-col items-center justify-center text-center">
                <CheckCircle size={32} className="text-emerald-500 mb-4" />
                <h4 className="text-base font-semibold text-foreground mb-1">System Healthy</h4>
                <p className="text-sm text-muted-foreground">No errors matching the active filter.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filteredErrors.map(err => {
                  const isExpanded = expandedErrorId === err.id;
                  const severityClass = 
                    err.error_severity === 'critical' ? 'bg-red-500/10 text-red-500 border-red-500/20' : 
                    err.error_severity === 'high' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' : 
                    'bg-blue-500/10 text-blue-400 border-blue-500/20';

                  const statusClass = 
                    err.status === 'resolved' ? 'bg-emerald-500/10 text-emerald-400' : 
                    err.status === 'assigned_to_agent' ? 'bg-primary/10 text-primary' : 
                    'bg-red-500/10 text-red-400';

                  return (
                    <div key={err.id} className="p-6 flex flex-col gap-4">
                      <div className="flex items-start justify-between gap-6">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2 flex-wrap">
                            <span className={cn("text-[10px] uppercase font-bold px-2 py-0.5 rounded border tracking-wide", severityClass)}>
                              {err.error_severity || 'HIGH'}
                            </span>
                            <span className="text-xs text-muted-foreground font-mono bg-muted px-2 py-0.5 rounded">
                              src: {err.component_name || err.error_source || 'runtime'}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(err.created_at).toLocaleString()}
                            </span>
                          </div>
                          <h4 className="text-sm font-semibold text-foreground break-words leading-relaxed">
                            {err.error_message}
                          </h4>
                          {(err.url || err.route_path) && (
                            <p className="text-xs text-muted-foreground font-mono mt-2">
                              Path: {err.url || err.route_path}
                            </p>
                          )}
                        </div>

                        <div className="flex flex-col items-end gap-3 flex-shrink-0">
                          <span className={cn("text-xs px-2.5 py-1 rounded-full font-medium capitalize whitespace-nowrap", statusClass)}>
                            {err.status.replace(/_/g, ' ')}
                          </span>

                          {err.status !== 'resolved' && (
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                className="text-muted-foreground hover:text-foreground hover:bg-accent rounded-md px-3 py-1.5 text-xs font-medium inline-flex items-center gap-1.5 border border-border transition-colors disabled:opacity-50"
                                onClick={() => handleDispatchAgentFix(err.id)}
                                disabled={dispatchingId === err.id || err.status === 'assigned_to_agent'}
                                title="Write error into agent_bug_inbox.json for autonomous coding fixes"
                              >
                                <Cpu size={14} />
                                {err.status === 'assigned_to_agent' ? 'In Bug Inbox' : 'Dispatch AI Fix'}
                              </button>

                              <button
                                type="button"
                                className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-3 py-1.5 text-xs font-medium inline-flex items-center gap-1.5 transition-colors disabled:opacity-50"
                                onClick={() => handleResolveError(err.id)}
                                disabled={resolvingId === err.id}
                              >
                                <Check size={14} />
                                Resolve
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {(err.stack_trace || err.error_context) && (
                        <div className="mt-2">
                          <button
                            type="button"
                            className="text-muted-foreground hover:text-foreground text-xs font-medium inline-flex items-center gap-1.5 transition-colors"
                            onClick={() => setExpandedErrorId(isExpanded ? null : err.id)}
                          >
                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            {isExpanded ? 'Hide Trace & Context' : 'View Stack Trace & Diagnostics'}
                          </button>

                          {isExpanded && (
                            <div className="mt-3 flex flex-col gap-3">
                              {err.stack_trace && (
                                <div className="rounded-md bg-zinc-950 border border-border/50 overflow-hidden">
                                  <div className="bg-zinc-900/50 px-3 py-1.5 border-b border-border/50 text-xs font-medium text-muted-foreground">Stack Trace</div>
                                  <pre className="p-3 text-[11px] text-red-400 font-mono overflow-x-auto max-h-64 whitespace-pre-wrap break-words">
                                    {err.stack_trace}
                                  </pre>
                                </div>
                              )}
                              {err.error_context && (
                                <div className="rounded-md bg-zinc-950 border border-border/50 overflow-hidden">
                                  <div className="bg-zinc-900/50 px-3 py-1.5 border-b border-border/50 text-xs font-medium text-muted-foreground">Error Context</div>
                                  <pre className="p-3 text-[11px] text-muted-foreground font-mono overflow-x-auto whitespace-pre-wrap break-words">
                                    {JSON.stringify(err.error_context, null, 2)}
                                  </pre>
                                </div>
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

      {confirmAction && (
        <ConfirmModal
          title={confirmAction.title}
          message={confirmAction.message}
          confirmLabel={confirmAction.confirmLabel}
          onConfirm={confirmAction.onConfirm}
          onCancel={() => setConfirmAction(null)}
          danger={confirmAction.danger ?? true}
        />
      )}
    </div>
  );
}
