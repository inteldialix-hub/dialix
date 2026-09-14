'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/dashboard/shared/ToastProvider';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import {
  Phone, Users, Bot, Download, FileText, TrendingUp, TrendingDown, Minus,
  PieChart, Activity, CheckCircle, Timer, Star, MicOff, Webhook, Plus, Trash,
  Filter, RefreshCw, Radio, Server, MessageSquare, GitBranch, User, PhoneCall,
  Loader2
} from 'lucide-react';

ChartJS.register(ArcElement, Tooltip, Legend);

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
    error_message?: string;
    agent_name?: string;
    agent_id?: string;
  }>;
}

interface ActiveCall {
  id: number;
  agentId: string;
  conversationId: string;
  toNumber: string;
  status: string;
  duration: number;
  startedAt: string;
}

export default function DashboardPage() {
  const { token } = useAuth();
  const { addToast } = useToast();
  const [stats, setStats] = useState<Stats | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [webhooks, setWebhooks] = useState<WebhookSubscription[]>([]);
  const [activeCalls, setActiveCalls] = useState<ActiveCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportLoading, setExportLoading] = useState<'csv' | 'pdf' | null>(null);
  const [webhookLoading, setWebhookLoading] = useState(false);
  const [showWebhookForm, setShowWebhookForm] = useState(false);

  // Filter states
  const [filterAgent, setFilterAgent] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  useEffect(() => {
    if (!token) return;

    Promise.allSettled([
      api<Stats>('/stats', { token }),
      api<AnalyticsData>('/calls/analytics', { token }),
      api<{ subscriptions: WebhookSubscription[] }>('/webhooks', { token }),
      api<{ activeCalls: ActiveCall[] }>('/calls/active', { token })
    ])
      .then(([statsRes, analyticsRes, webhooksRes, activeCallsRes]) => {
        if (statsRes.status === 'fulfilled' && statsRes.value) {
          setStats(statsRes.value);
        }
        if (analyticsRes.status === 'fulfilled' && analyticsRes.value) {
          setAnalytics(analyticsRes.value);
        }
        if (webhooksRes.status === 'fulfilled' && webhooksRes.value?.subscriptions) {
          setWebhooks(webhooksRes.value.subscriptions);
        }
        if (activeCallsRes.status === 'fulfilled' && activeCallsRes.value?.activeCalls) {
          setActiveCalls(activeCallsRes.value.activeCalls);
        }
        setLoading(false);
      })
      .catch(() => {
        addToast('Failed to load dashboard data', 'error');
        setLoading(false);
      });

    const interval = setInterval(() => {
      api<{ activeCalls: ActiveCall[] }>('/calls/active', { token })
        .then(data => setActiveCalls(data.activeCalls || []))
        .catch(() => {});
    }, 5000);

    return () => clearInterval(interval);
  }, [token, addToast]);

  const formatDuration = (secs: number) => {
    if (!secs) return '0s';
    const m = Math.floor(secs / 60);
    const s = Math.round(secs % 60);
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
    } catch {
      addToast(`Failed to export ${format.toUpperCase()}`, 'error');
    }
    setExportLoading(null);
  };

  const handleCreateWebhook = async (e: React.FormEvent, event: string, url: string, secret: string) => {
    e.preventDefault();
    if (!token) return;

    setWebhookLoading(true);
    try {
      const newWebhook = await api<{ subscription: WebhookSubscription }>('/webhooks', {
        method: 'POST',
        token,
        body: { event, url, secret: secret || undefined },
      });

      if (newWebhook?.subscription) {
        setWebhooks(prev => [...prev, newWebhook.subscription]);
      }
      setShowWebhookForm(false);
      addToast('Webhook created successfully', 'success');
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to create webhook', 'error');
    } finally {
      setWebhookLoading(false);
    }
  };

  const handleDeleteWebhook = async (id: number) => {
    if (!token) return;

    try {
      await api(`/webhooks/${id}`, {
        method: 'DELETE',
        token,
      });

      setWebhooks(prev => prev.filter(w => w.id !== id));
      addToast('Webhook deleted successfully', 'success');
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to delete webhook', 'error');
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="h-8 w-48 rounded bg-muted animate-pulse mb-2" />
        <div className="h-4 w-64 rounded bg-muted animate-pulse mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-lg border border-border bg-card p-6 h-28 animate-pulse">
              <div className="h-4 w-24 rounded bg-muted mb-2" />
              <div className="h-8 w-16 rounded bg-muted" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const chartColors = [
    'rgba(16, 185, 129, 0.9)', // Emerald 500
    'rgba(20, 184, 166, 0.9)', // Teal 500
    'rgba(5, 150, 105, 0.9)',  // Emerald 600
    'rgba(13, 148, 136, 0.9)', // Teal 600
    'rgba(161, 161, 170, 0.9)',// Zinc 400
    'rgba(113, 113, 122, 0.9)',// Zinc 500
    'rgba(52, 211, 153, 0.9)', // Emerald 400
    'rgba(45, 212, 191, 0.9)', // Teal 400
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
      legend: { display: false },
      tooltip: {
        backgroundColor: '#18181b',
        titleColor: '#ffffff',
        bodyColor: '#a1a1aa',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        padding: 10,
        boxPadding: 4,
        usePointStyle: true,
      },
    },
  };

  const statCards = [
    { label: 'Total agents', value: stats?.totalAgents || 0 },
    { label: 'Total calls', value: analytics?.stats?.total_calls || stats?.totalCalls || 0 },
    { 
      label: 'Success rate', 
      value: analytics?.stats?.successful_calls && analytics?.stats?.total_calls 
        ? `${Math.round(((analytics.stats.successful_calls) / (analytics.stats.total_calls)) * 100) || 0}%` 
        : `${stats?.successRate || 0}%` 
    },
    { label: 'Avg duration', value: formatDuration(analytics?.stats?.avg_duration || stats?.avgDuration || 0) },
    { 
      label: 'Avg quality', 
      value: analytics?.stats?.avg_quality ? (analytics.stats.avg_quality).toFixed(1) : 'N/A' 
    },
  ];

  const filteredCalls = analytics?.recentCalls?.filter(call => {
    if (filterAgent && call.agent_name !== filterAgent && call.agent_id !== filterAgent) return false;
    if (filterStatus && call.status !== filterStatus) return false;
    if (filterDateFrom && new Date(call.created_at) < new Date(filterDateFrom)) return false;
    if (filterDateTo && new Date(call.created_at) > new Date(filterDateTo + 'T23:59:59Z')) return false;
    return true;
  }) || [];

  return (
    <div className="max-w-7xl mx-auto px-6 py-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Overview of your AI calling operations</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            className="text-muted-foreground hover:text-foreground hover:bg-accent rounded-md px-3 py-2 text-sm transition-colors flex items-center gap-2 border border-border"
            onClick={() => handleExport('csv')}
            disabled={exportLoading === 'csv'}
          >
            {exportLoading === 'csv' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Export CSV
          </button>
          <button
            className="text-muted-foreground hover:text-foreground hover:bg-accent rounded-md px-3 py-2 text-sm transition-colors flex items-center gap-2 border border-border"
            onClick={() => handleExport('pdf')}
            disabled={exportLoading === 'pdf'}
          >
            {exportLoading === 'pdf' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            Export PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mt-6">
        {statCards.map((card, i) => (
          <div key={i} className="rounded-lg border border-border bg-card p-6">
            <p className="text-sm text-muted-foreground">{card.label}</p>
            <p className="text-2xl font-semibold mt-1 font-mono tabular-nums">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {/* Calls by Agent */}
        <div className="rounded-lg border border-border bg-card p-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-4 flex items-center gap-2">
            <PieChart className="w-4 h-4" /> Calls by agent
          </h3>
          {(stats?.callsByAgent?.length ?? 0) > 0 ? (
            <div>
              <div className="relative h-[200px]">
                <Doughnut data={chartData} options={chartOptions} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4 pt-4 border-t border-border">
                {stats?.callsByAgent?.map((agent, i) => {
                  const color = chartColors[i % chartColors.length];
                  const totalAgentCalls = stats?.callsByAgent?.reduce((acc, a) => acc + (a.count || 0), 0) || 0;
                  const pct = totalAgentCalls > 0 ? Math.round((agent.count / totalAgentCalls) * 100) : 0;
                  return (
                    <div key={agent.name || i} className="flex items-center justify-between gap-2 px-3 py-2 rounded-md bg-muted/30 border border-border">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                        <span className="text-xs font-medium truncate" title={agent.name}>{agent.name}</span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0 text-xs font-mono tabular-nums">
                        <span className="font-semibold">{agent.count}</span>
                        <span className="text-muted-foreground">({pct}%)</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground text-sm">
              <PieChart className="w-8 h-8 mb-2 opacity-20" />
              <p>No call data yet</p>
            </div>
          )}
        </div>

        {/* Live Monitoring */}
        <div className="rounded-lg border border-border bg-card p-6 flex flex-col">
          <h3 className="text-sm font-medium text-muted-foreground mb-4 flex items-center gap-2">
            <Radio className="w-4 h-4 text-red-500" /> Active calls
            {activeCalls.length > 0 && (
              <span className="ml-auto inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-red-500/10 text-red-500">
                {activeCalls.length} active
              </span>
            )}
          </h3>
          <div className="flex-1 overflow-auto">
            {activeCalls.length > 0 ? (
              <div className="space-y-4">
                {activeCalls.map((call) => (
                  <div key={call.id} className="flex gap-4 items-start">
                    <div className="mt-1 relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">Agent {call.agentId.substring(0, 8)} on call with {call.toNumber}</p>
                      <p className="text-xs text-muted-foreground mt-1 capitalize">{call.status} • Started {new Date(call.startedAt).toLocaleTimeString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-muted-foreground text-sm">
                <MicOff className="w-8 h-8 mb-2 opacity-20" />
                <p>No active calls</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {/* Agent Performance Table */}
        <div className="rounded-lg border border-border bg-card">
          <div className="p-4 border-b border-border">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <Bot className="w-4 h-4 text-muted-foreground" /> Agent performance
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/20">
                  <th className="text-left text-muted-foreground font-medium px-4 py-3">Agent</th>
                  <th className="text-left text-muted-foreground font-medium px-4 py-3">Total calls</th>
                  <th className="text-left text-muted-foreground font-medium px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {stats?.callsByAgent && stats.callsByAgent.length > 0 ? (
                  stats.callsByAgent.map((agent, i) => (
                    <tr key={i} className="hover:bg-accent/50 transition-colors">
                      <td className="px-4 py-3 flex items-center gap-2">
                        <Bot className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium">{agent.name}</span>
                      </td>
                      <td className="px-4 py-3 font-mono tabular-nums">
                        {agent.count}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-emerald-500/10 text-emerald-400">
                          active
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground text-sm">
                      No agent data available
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Workflow Architecture */}
        <div className="rounded-lg border border-border bg-card">
          <div className="p-4 border-b border-border">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-muted-foreground" /> Workflow architecture
            </h3>
          </div>
          <div className="p-6 flex flex-col gap-4">
            {[
              { icon: User, label: 'Caller', desc: 'Initiates or receives the call' },
              { icon: PhoneCall, label: 'Twilio / SIP', desc: 'Telephony provider' },
              { icon: Server, label: 'Dialix API', desc: 'Core routing and logic' },
              { icon: Bot, label: 'AI Engine', desc: 'Speech-to-text & LLM' },
              { icon: MessageSquare, label: 'Response', desc: 'Text-to-speech generation' },
            ].map((node, i) => (
              <div key={node.label} className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-muted border border-border flex items-center justify-center flex-shrink-0">
                  <node.icon className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">{node.label}</p>
                  <p className="text-xs text-muted-foreground">{node.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        {/* Advanced Filters */}
        <div className="lg:col-span-1 rounded-lg border border-border bg-card p-6">
          <h3 className="text-sm font-medium flex items-center gap-2 mb-4">
            <Filter className="w-4 h-4 text-muted-foreground" /> Filters
          </h3>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Agent</label>
              <select 
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                value={filterAgent}
                onChange={(e) => setFilterAgent(e.target.value)}
              >
                <option value="">All agents</option>
                {stats?.callsByAgent?.map(agent => (
                  <option key={agent.name} value={agent.name}>{agent.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Status</label>
              <select 
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="">All statuses</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
                <option value="initiated">Initiated</option>
                <option value="in-progress">In progress</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">From date</label>
                <input 
                  type="date" 
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" 
                  value={filterDateFrom} 
                  onChange={e => setFilterDateFrom(e.target.value)} 
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">To date</label>
                <input 
                  type="date" 
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" 
                  value={filterDateTo} 
                  onChange={e => setFilterDateTo(e.target.value)} 
                />
              </div>
            </div>
            <button 
              className="w-full text-muted-foreground hover:text-foreground hover:bg-accent rounded-md px-3 py-2 text-sm transition-colors flex items-center justify-center gap-2 border border-border mt-2"
              onClick={() => {
                setFilterAgent('');
                setFilterStatus('');
                setFilterDateFrom('');
                setFilterDateTo('');
              }}
            >
              <RefreshCw className="w-4 h-4" /> Reset filters
            </button>
          </div>
        </div>

        {/* Recent Calls */}
        <div className="lg:col-span-2 rounded-lg border border-border bg-card">
          <div className="p-4 border-b border-border">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <Activity className="w-4 h-4 text-muted-foreground" /> Recent calls
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/20">
                  <th className="text-left text-muted-foreground font-medium px-4 py-3">Destination</th>
                  <th className="text-left text-muted-foreground font-medium px-4 py-3">Status</th>
                  <th className="text-left text-muted-foreground font-medium px-4 py-3">Duration</th>
                  <th className="text-left text-muted-foreground font-medium px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredCalls.length > 0 ? (
                  filteredCalls.map((call) => (
                    <tr key={call.id} className="hover:bg-accent/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-mono">{call.to_number}</div>
                        {call.lead_name && <div className="text-xs text-muted-foreground">{call.lead_name}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                          call.status === 'completed' ? "bg-emerald-500/10 text-emerald-400" :
                          call.status === 'failed' ? "bg-red-500/10 text-red-400" :
                          "bg-blue-500/10 text-blue-400"
                        )}>
                          {call.status}
                        </span>
                        {call.error_message && (
                          <div className="text-xs text-red-400 mt-1">{call.error_message}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono tabular-nums">
                        {call.duration > 0 ? formatDuration(call.duration) : '-'}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {new Date(call.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground text-sm">
                      No recent calls matching filters
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Webhooks Section */}
      <div className="rounded-lg border border-border bg-card mt-6">
        <div className="p-4 border-b border-border flex justify-between items-center">
          <h3 className="text-sm font-medium flex items-center gap-2">
            <Webhook className="w-4 h-4 text-muted-foreground" /> Webhook subscriptions
          </h3>
          <button
            className="bg-foreground text-background hover:bg-foreground/90 rounded-md px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-1"
            onClick={() => setShowWebhookForm(true)}
          >
            <Plus className="w-3.5 h-3.5" /> Add webhook
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                <th className="text-left text-muted-foreground font-medium px-4 py-3">Event</th>
                <th className="text-left text-muted-foreground font-medium px-4 py-3">URL</th>
                <th className="text-left text-muted-foreground font-medium px-4 py-3">Created</th>
                <th className="text-right text-muted-foreground font-medium px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {webhooks.length > 0 ? (
                webhooks.map((webhook) => (
                  <tr key={webhook.id} className="hover:bg-accent/50 transition-colors">
                    <td className="px-4 py-3 font-medium">{webhook.event}</td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{webhook.url}</td>
                    <td className="px-4 py-3 text-muted-foreground">{new Date(webhook.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-md p-1.5 transition-colors inline-flex"
                        onClick={() => handleDeleteWebhook(webhook.id)}
                      >
                        <Trash className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground text-sm">
                    No webhook subscriptions yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Webhook Modal */}
      {showWebhookForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-6">
            <h3 className="text-lg font-semibold tracking-tight mb-4">Add webhook</h3>
            <WebhookForm
              onSubmit={handleCreateWebhook}
              onCancel={() => setShowWebhookForm(false)}
              loading={webhookLoading}
            />
          </div>
        </div>
      )}
    </div>
  );
}

interface WebhookFormProps {
  onSubmit: (e: React.FormEvent, event: string, url: string, secret: string) => void;
  onCancel: () => void;
  loading: boolean;
}

function WebhookForm({ onSubmit, onCancel, loading }: WebhookFormProps) {
  const [event, setEvent] = useState('call.completed');
  const [url, setUrl] = useState('');
  const [secret, setSecret] = useState('');

  return (
    <form onSubmit={(e) => onSubmit(e, event, url, secret)} className="space-y-4">
      <div>
        <label className="text-sm font-medium mb-1.5 block">Event</label>
        <select
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          value={event}
          onChange={(e) => setEvent(e.target.value)}
        >
          <option value="call.completed">Call completed</option>
          <option value="call.failed">Call failed</option>
        </select>
      </div>
      <div>
        <label className="text-sm font-medium mb-1.5 block">Webhook URL</label>
        <input
          type="url"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://your-app.com/webhook"
          required
        />
      </div>
      <div>
        <label className="text-sm font-medium mb-1.5 block">Secret (Optional)</label>
        <input
          type="password"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          placeholder="HMAC secret"
        />
      </div>
      <div className="flex justify-end gap-3 mt-6">
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground hover:bg-accent rounded-md px-4 py-2 text-sm transition-colors"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="bg-foreground text-background hover:bg-foreground/90 rounded-md px-4 py-2 text-sm font-medium transition-colors flex items-center gap-2"
          disabled={loading}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          {loading ? 'Creating...' : 'Create webhook'}
        </button>
      </div>
    </form>
  );
}
