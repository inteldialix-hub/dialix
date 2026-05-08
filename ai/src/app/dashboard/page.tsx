'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/dashboard/shared/ToastProvider';
import { Icon } from '@/components/dashboard/shared/Icon';
import { SkeletonRows } from '@/components/dashboard/shared/SkeletonRows';
import { CustomSelect } from '@/components/dashboard/shared/CustomSelect';
import { api } from '@/lib/api';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend);

/**
 * Dashboard home — converted from frontend/app.js DashboardView (lines ~4022-4276).
 * Shows stats cards, calls-by-agent chart, recent activity, and call flow diagram.
 */

interface Stats {
  totalAgents: number;
  totalCalls: number;
  successRate: number;
  avgDuration: number;
  callsByAgent: Array<{ name: string; count: number }>;
  recentActivity: Array<{
    id?: string;
    agent_name: string;
    status: string;
    duration: number;
    to_number?: string;
    time: number;
  }>;
}

interface WebhookSubscription {
  id: number;
  event: string;
  url: string;
  secret?: string;
  created_at: string;
}

interface AnalyticsData {
  stats: {
    total_calls: number;
    successful_calls: number;
    avg_duration: number;
    avg_quality: number;
  };
  recentCalls: Array<{
    id: string;
    status: string;
    to_number: string;
    lead_name?: string;
    duration: number;
    quality_score?: number;
    created_at: string;
  }>;
}

export default function DashboardPage() {
  const { token } = useAuth();
  const { addToast } = useToast();
  const [stats, setStats] = useState<Stats | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [webhooks, setWebhooks] = useState<WebhookSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportLoading, setExportLoading] = useState<'csv' | 'pdf' | null>(null);
  const [webhookLoading, setWebhookLoading] = useState(false);
  const [showWebhookForm, setShowWebhookForm] = useState(false);

  useEffect(() => {
    if (!token) return;

    // Load dashboard data
    Promise.all([
      api<Stats>('/stats', { token }),
      api<AnalyticsData>('/calls/analytics', { token }),
      api<{ subscriptions: WebhookSubscription[] }>('/webhooks', { token })
    ])
      .then(([statsData, analyticsData, webhooksData]) => {
        setStats(statsData);
        setAnalytics(analyticsData);
        setWebhooks(webhooksData.subscriptions || []);
        setLoading(false);
      })
      .catch(() => {
        addToast('Failed to load dashboard data', 'error');
        setLoading(false);
      });
  }, [token, addToast]);

  const formatDuration = (secs: number) => {
    if (!secs) return '0s';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  const handleExport = async (format: 'csv' | 'pdf') => {
    if (!token) return;

    setExportLoading(format);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/calls/export/${format}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `call-analytics.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      addToast(`${format.toUpperCase()} export completed`, 'success');
    } catch (err) {
      addToast(`Failed to export ${format.toUpperCase()}`, 'error');
    }
    setExportLoading(null);
  };

  const handleCreateWebhook = async (event: string, url: string, secret: string) => {
    if (!token) return;

    setWebhookLoading(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/webhooks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ event, url, secret: secret || undefined }),
      });

      if (!response.ok) {
        throw new Error('Failed to create webhook');
      }

      const newWebhook = await response.json();
      setWebhooks(prev => [...prev, newWebhook.subscription]);
      setShowWebhookForm(false);
      addToast('Webhook created successfully', 'success');
    } catch (err) {
      addToast('Failed to create webhook', 'error');
    } finally {
      setWebhookLoading(false);
    }
  };

  const handleDeleteWebhook = async (id: number) => {
    if (!token) return;

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/webhooks/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete webhook');
      }

      setWebhooks(prev => prev.filter(w => w.id !== id));
      addToast('Webhook deleted successfully', 'success');
    } catch (err) {
      addToast('Failed to delete webhook', 'error');
    }
  };

  if (loading) {
    return (
      <div className="loading-overlay">
        <div className="skeleton skeleton-title" />
        <div className="skeleton skeleton-text" style={{ width: 280, marginBottom: 16 }} />
        <div className="loading-skeleton-grid">
          {[...Array(4)].map((_, i) => <div key={i} className="skeleton skeleton-card" />)}
        </div>
      </div>
    );
  }

  const chartColors = [
    'rgba(16, 185, 129, 0.9)', /* Emerald 500 */
    'rgba(20, 184, 166, 0.9)', /* Teal 500 */
    'rgba(5, 150, 105, 0.9)',  /* Emerald 600 */
    'rgba(13, 148, 136, 0.9)', /* Teal 600 */
    'rgba(161, 161, 170, 0.9)',/* Zinc 400 */
    'rgba(113, 113, 122, 0.9)',/* Zinc 500 */
    'rgba(52, 211, 153, 0.9)', /* Emerald 400 */
    'rgba(45, 212, 191, 0.9)', /* Teal 400 */
  ];

  const chartData = {
    labels: stats?.callsByAgent?.map(a => a.name) || [],
    datasets: [{
      data: stats?.callsByAgent?.map(a => a.count) || [],
      backgroundColor: chartColors.slice(0, stats?.callsByAgent?.length || 0),
      borderWidth: 0,
      hoverOffset: 6,
    }],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '72%',
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: { color: '#a1a1aa', font: { family: 'Outfit, sans-serif', size: 11, weight: 500 }, padding: 16, usePointStyle: true, pointStyleWidth: 10 },
      },
    },
  };

  const statCards = [
    { label: 'Total Agents', value: stats?.totalAgents || 0, icon: 'bot', trend: null },
    { label: 'Total Calls', value: analytics?.stats?.total_calls || stats?.totalCalls || 0, icon: 'phone-call', trend: (analytics?.stats?.total_calls || 0) > 0 ? 'up' : 'neutral' },
    { label: 'Success Rate', value: analytics?.stats?.successful_calls && analytics?.stats?.total_calls ? `${Math.round(((analytics.stats?.successful_calls ?? 0) / (analytics.stats?.total_calls ?? 1)) * 100) || 0}%` : `${stats?.successRate || 0}%`, icon: 'check-circle', trend: (analytics?.stats?.successful_calls || 0) / (analytics?.stats?.total_calls || 1) * 100 >= 70 ? 'up' : (analytics?.stats?.successful_calls || 0) / (analytics?.stats?.total_calls || 1) * 100 >= 40 ? 'neutral' : 'down' },
    { label: 'Avg Duration', value: formatDuration(analytics?.stats?.avg_duration || stats?.avgDuration || 0), icon: 'timer', trend: 'neutral' },
    { label: 'Avg Quality', value: analytics?.stats?.avg_quality ? ((analytics.stats?.avg_quality ?? 0) as number).toFixed(1) : 'N/A', icon: 'star', trend: (analytics?.stats?.avg_quality || 0) >= 4.0 ? 'up' : (analytics?.stats?.avg_quality || 0) >= 3.0 ? 'neutral' : 'down' },
  ];

  return (
    <div className="page-body">
      <div className="page-content" style={{ paddingBottom: '100px' }}>
        <div className="page-title-section" style={{ padding: '32px 0 24px' }}>
          <div>
            <h2 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>Dashboard</h2>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Overview of your AI calling operations</p>
          </div>
          <div className="page-actions">
            <button
              className="btn btn-secondary"
              onClick={() => handleExport('csv')}
              disabled={exportLoading === 'csv'}
            >
              <Icon name={exportLoading === 'csv' ? 'loader' : 'download'} size={14} />
              {exportLoading === 'csv' ? 'Exporting...' : 'Export CSV'}
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => handleExport('pdf')}
              disabled={exportLoading === 'pdf'}
            >
              <Icon name={exportLoading === 'pdf' ? 'loader' : 'file-text'} size={14} />
              {exportLoading === 'pdf' ? 'Exporting...' : 'Export PDF'}
            </button>
          </div>
        </div>

        {/* Stat Cards */}
      <div className="dashboard-grid">
        {statCards.map((card, i) => (
          <div key={i} className="stat-card" style={{ animationDelay: `${i * 60}ms` }}>
            <div className="stat-card-header">
              <span className="stat-card-label">{card.label}</span>
              <div className="stat-card-icon"><Icon name={card.icon} size={16} /></div>
            </div>
            <div className="stat-card-value">{card.value}</div>
            {card.trend && (
              <span className={`stat-card-trend ${card.trend}`}>
                <Icon name={card.trend === 'up' ? 'trending-up' : card.trend === 'down' ? 'trending-down' : 'minus'} size={11} />
                {card.trend === 'up' ? 'Good' : card.trend === 'down' ? 'Low' : 'Stable'}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Panels Row */}
      <div className="dashboard-row">
        <div className="dashboard-panel">
          <div className="dashboard-panel-header">
            <span className="dashboard-panel-title"><Icon name="pie-chart" size={14} /> Calls by Agent</span>
          </div>
          <div className="dashboard-panel-body">
            {(stats?.callsByAgent?.length ?? 0) > 0 ? (
              <div className="chart-container"><Doughnut data={chartData} options={chartOptions} /></div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-quaternary)', fontSize: '13px' }}>No call data yet</div>
            )}
          </div>
        </div>

        <div className="dashboard-panel">
          <div className="dashboard-panel-header">
            <span className="dashboard-panel-title"><Icon name="activity" size={14} /> Recent Calls</span>
          </div>
          <div className="dashboard-panel-body">
            {(analytics?.recentCalls?.length ?? 0) > 0 ? (
              <div className="activity-feed">
                {analytics?.recentCalls?.map((call, i) => (
                  <div key={call.id} className="activity-item" style={{ animationDelay: `${i * 40}ms` }}>
                    <div className="activity-dot-col">
                      <span className={`activity-dot ${call.status === 'completed' ? 'success' : call.status === 'failed' ? 'failed' : 'info'}`} />
                      {i < (analytics?.recentCalls?.length ?? 0) - 1 && <div className="activity-line" />}
                    </div>
                    <div className="activity-content">
                      <div className="activity-title">
                        Call to {call.to_number}
                        {call.lead_name && <span className="lead-name"> ({call.lead_name})</span>}
                      </div>
                      <div className="activity-meta">
                        <span>{call.status}</span>
                        {call.duration > 0 && <span>• {formatDuration(call.duration)}</span>}
                        {call.quality_score && <span>• Quality: {call.quality_score.toFixed(1)}</span>}
                      </div>
                    </div>
                    <div className="activity-time">{new Date(call.created_at).toLocaleDateString()}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-quaternary)', fontSize: '13px' }}>No recent calls</div>
            )}
          </div>
        </div>
      </div>

      {/* Agent Performance & Call Flow */}
      <div className="dashboard-row">
        <div className="dashboard-panel" style={{ flex: 2 }}>
          <div className="dashboard-panel-header">
            <span className="dashboard-panel-title"><Icon name="bot" size={14} /> Agent Performance Overview</span>
          </div>
          <div className="dashboard-panel-body" style={{ padding: 0 }}>
            {stats?.callsByAgent && stats.callsByAgent.length > 0 ? (
              <table className="data-table" style={{ margin: 0, width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ background: 'var(--bg-overlay)' }}>
                  <tr>
                    <th style={{ padding: '12px 24px', fontWeight: 500, color: 'var(--text-secondary)', textAlign: 'left', borderBottom: '1px solid var(--border-default)' }}>Agent Name</th>
                    <th style={{ padding: '12px 24px', fontWeight: 500, color: 'var(--text-secondary)', textAlign: 'left', borderBottom: '1px solid var(--border-default)' }}>Total Calls</th>
                    <th style={{ padding: '12px 24px', fontWeight: 500, color: 'var(--text-secondary)', textAlign: 'left', borderBottom: '1px solid var(--border-default)' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.callsByAgent.map((agent, i) => (
                    <tr key={i} className="hover:bg-zinc-800/30" style={{ transition: 'background 0.2s', borderBottom: '1px solid var(--border-faint)' }}>
                      <td style={{ padding: '16px 24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span className="agent-icon indigo" style={{ width: 32, height: 32 }}><Icon name="bot" size={16} /></span>
                          <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>{agent.name}</span>
                        </div>
                      </td>
                      <td style={{ padding: '16px 24px', color: 'var(--text-secondary)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Icon name="phone-call" size={14} style={{ color: 'var(--text-tertiary)' }} />
                          {agent.count} handled
                        </div>
                      </td>
                      <td style={{ padding: '16px 24px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--green)' }}>
                          <span className="status-dot active" style={{ width: 8, height: 8 }} /> Active
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-quaternary)', fontSize: '13px' }}>No agent data available</div>
            )}
          </div>
        </div>

        <div className="dashboard-panel" style={{ flex: 1 }}>
          <div className="dashboard-panel-header">
            <span className="dashboard-panel-title"><Icon name="git-branch" size={14} /> Workflow Architecture</span>
          </div>
          <div className="dashboard-panel-body">
            <div className="call-flow">
              {[
                { icon: 'user', label: 'Caller', bg: 'var(--brand-accent-muted)', color: 'var(--brand-accent)' },
                { icon: 'phone', label: 'Twilio/SIP', bg: 'rgba(251,146,60,0.15)', color: 'var(--orange)' },
                { icon: 'server', label: 'Dialix API', bg: 'rgba(74,222,128,0.15)', color: 'var(--green)' },
                { icon: 'brain', label: 'AI Engine', bg: 'rgba(139,92,246,0.15)', color: '#A78BFA' },
                { icon: 'message-square', label: 'Response', bg: 'rgba(34,211,238,0.15)', color: '#22D3EE' },
              ].map((node, i, arr) => (
                <React.Fragment key={node.label}>
                  <div className="call-flow-node">
                    <div className="call-flow-node-icon" style={{ background: node.bg, color: node.color }}>
                      <Icon name={node.icon} size={16} />
                    </div>
                    <span className="call-flow-node-label">{node.label}</span>
                  </div>
                  {i < arr.length - 1 && (
                    <div className="call-flow-arrow">
                      <div className="flow-line"><div className="flow-dot" style={{ animationDelay: `${i * 0.4}s` }} /></div>
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Webhooks Management */}
      <div className="dashboard-row">
        <div className="dashboard-panel">
          <div className="dashboard-panel-header">
            <div className="dashboard-panel-title">
              <Icon name="webhook" size={14} /> Webhook Subscriptions
            </div>
            <button
              className="btn btn-sm btn-primary"
              onClick={() => setShowWebhookForm(!showWebhookForm)}
            >
              <Icon name="plus" size={12} />
              Add Webhook
            </button>
          </div>
          <div className="dashboard-panel-body">
            {showWebhookForm && (
              <WebhookForm
                onSubmit={handleCreateWebhook}
                onCancel={() => setShowWebhookForm(false)}
                loading={webhookLoading}
              />
            )}

            {webhooks.length > 0 ? (
              <div className="webhooks-list">
                {webhooks.map((webhook) => (
                  <div key={webhook.id} className="webhook-item">
                    <div className="webhook-info">
                      <div className="webhook-event">{webhook.event}</div>
                      <div className="webhook-url">{webhook.url}</div>
                      <div className="webhook-meta">
                        Created {new Date(webhook.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => handleDeleteWebhook(webhook.id)}
                    >
                      <Icon name="trash" size={12} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-quaternary)', fontSize: '13px' }}>
                No webhook subscriptions yet
              </div>
            )}
          </div>
        </div>

        <div className="dashboard-panel">
          <div className="dashboard-panel-header">
            <span className="dashboard-panel-title"><Icon name="filter" size={14} /> Advanced Filters</span>
          </div>
          <div className="dashboard-panel-body">
            <div className="filters-section">
              <div className="filter-group">
                <label>Agent</label>
                <CustomSelect
                  value={""}
                  onChange={() => {}}
                  options={[
                    { value: '', label: 'All Agents' },
                    ...(stats?.callsByAgent.map(agent => ({ value: agent.name, label: agent.name })) || [])
                  ]}
                />
              </div>

              <div className="filter-group">
                <label>Status</label>
                <CustomSelect
                  value={""}
                  onChange={() => {}}
                  options={[
                    { value: '', label: 'All Statuses' },
                    { value: 'completed', label: 'Completed' },
                    { value: 'failed', label: 'Failed' },
                    { value: 'initiated', label: 'Initiated' }
                  ]}
                />
              </div>

              <div className="filter-group">
                <label>Date Range</label>
                <div className="date-range">
                  <input type="date" className="form-input" placeholder="From" />
                  <input type="date" className="form-input" placeholder="To" />
                </div>
              </div>

              <button className="btn btn-primary" style={{ width: '100%', marginTop: '12px' }}>
                <Icon name="search" size={14} />
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
    </div>
  );
}

interface WebhookFormProps {
  onSubmit: (event: string, url: string, secret: string) => void;
  onCancel: () => void;
  loading: boolean;
}

function WebhookForm({ onSubmit, onCancel, loading }: WebhookFormProps) {
  const [event, setEvent] = useState('call.completed');
  const [url, setUrl] = useState('');
  const [secret, setSecret] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (event && url) {
      onSubmit(event, url, secret);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="webhook-form">
      <div className="form-row">
        <div className="form-group">
          <label>Event</label>
          <CustomSelect
            value={event}
            onChange={(e) => setEvent(e.target.value)}
            options={[
              { value: 'call.completed', label: 'Call Completed' },
              { value: 'call.failed', label: 'Call Failed' }
            ]}
          />
        </div>
        <div className="form-group">
          <label>Webhook URL</label>
          <input
            type="url"
            className="form-input"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://your-app.com/webhook"
            required
          />
        </div>
      </div>
      <div className="form-group">
        <label>Secret (Optional)</label>
        <input
          type="password"
          className="form-input"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          placeholder="HMAC secret for signature verification"
        />
      </div>
      <div className="form-actions">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? <Icon name="loader" size={12} /> : <Icon name="plus" size={12} />}
          {loading ? 'Creating...' : 'Create Webhook'}
        </button>
      </div>
    </form>
  );
}
