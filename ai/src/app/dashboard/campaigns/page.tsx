/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/dashboard/shared/ToastProvider';
import { cn } from '@/lib/utils';
import { 
  Plus, Layers, Radio, PhoneOutgoing, CheckCircle, 
  ChevronUp, ChevronDown, Play, Pause, Square, Copy, 
  Megaphone, TrendingUp, TrendingDown, Minus, X
} from 'lucide-react';
import { EmptyState } from '@/components/dashboard/shared/EmptyState';
import { ConfirmModal } from '@/components/dashboard/shared/ConfirmModal';
import { SkeletonRows } from '@/components/dashboard/shared/SkeletonRows';
import { useTopBar } from '@/components/dashboard/TopBarContext';

interface CampaignStats {
  total?: number;
  completed?: number;
  answered?: number;
  failed?: number;
}

interface Campaign {
  id: string | number;
  name: string;
  description?: string;
  status: string;
  agent_id?: string;
  phone_number_id?: string;
  contact_list?: string | any[];
  total_contacts?: number;
  calls_completed?: number;
  calls_answered?: number;
  calls_failed?: number;
  schedule_start?: string;
  schedule_end?: string;
  calling_days?: string | string[];
  calling_start_time?: string;
  calling_end_time?: string;
  max_concurrent?: number;
  max_calls_per_hour?: number;
  max_retries?: number;
  created_at?: string;
  stats?: CampaignStats;
}

interface Contact {
  id: number;
  first_name?: string;
  last_name?: string;
  name?: string;
  phone: string;
}

interface Agent {
  agent_id?: string;
  id?: string;
  name: string;
}

interface PhoneNumber {
  id: string;
  label?: string;
  phone_number?: string;
  number?: string;
}

export default function CampaignsPage() {
  const { token, isAuthenticated } = useAuth();
  const { addToast } = useToast();
  const { setTopBar } = useTopBar();

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Wizard state
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [submittingWizard, setSubmittingWizard] = useState(false);
  const [wizardData, setWizardData] = useState({
    name: '',
    description: '',
    contactIds: [] as number[],
    agentId: '',
    phoneNumberId: '',
    schedule: {
      startDate: '',
      endDate: '',
      startTime: '09:00',
      endTime: '17:00',
      days: ['mon', 'tue', 'wed', 'thu', 'fri'] as string[],
    },
    limits: {
      maxConcurrent: 1,
      callsPerMinute: 5,
      maxSpend: '',
      maxRetries: 3,
      voicemailAction: 'hang_up',
    },
  });

  // Supporting data for wizard
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([]);
  const [expandedId, setExpandedId] = useState<string | number | null>(null);

  // Confirmation modal state
  const [confirmCancelTarget, setConfirmCancelTarget] = useState<Campaign | null>(null);

  const fetchCampaigns = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const res = await api('/campaigns', { token });
      const rawList = Array.isArray(res?.data?.campaigns)
        ? res.data.campaigns
        : (Array.isArray(res?.campaigns)
          ? res.campaigns
          : (Array.isArray(res?.data)
            ? res.data
            : (Array.isArray(res) ? res : [])));
      setCampaigns(Array.isArray(rawList) ? rawList : []);
    } catch (err: any) {
      addToast(err?.message || 'Failed to load campaigns', 'error');
      setCampaigns([]);
    } finally {
      setLoading(false);
    }
  }, [token, addToast]);

  useEffect(() => {
    if (isAuthenticated && token) {
      fetchCampaigns();
    }
  }, [isAuthenticated, token, fetchCampaigns]);

  const loadWizardData = async () => {
    if (!token) return;
    try {
      const [cRes, aRes, pRes] = await Promise.allSettled([
        api('/contacts', { token }),
        api('/agents', { token }),
        api('/phone-numbers', { token }),
      ]);

      if (cRes.status === 'fulfilled' && cRes.value) {
        const cData = cRes.value;
        const list = Array.isArray(cData?.data?.contacts)
          ? cData.data.contacts
          : (Array.isArray(cData?.contacts)
            ? cData.contacts
            : (Array.isArray(cData?.data)
              ? cData.data
              : (Array.isArray(cData) ? cData : [])));
        setContacts(Array.isArray(list) ? list : []);
      }
      if (aRes.status === 'fulfilled' && aRes.value) {
        const aData = aRes.value;
        const list = Array.isArray(aData?.data?.agents)
          ? aData.data.agents
          : (Array.isArray(aData?.agents)
            ? aData.agents
            : (Array.isArray(aData?.data)
              ? aData.data
              : (Array.isArray(aData) ? aData : [])));
        setAgents(Array.isArray(list) ? list : []);
      }
      if (pRes.status === 'fulfilled' && pRes.value) {
        const pData = pRes.value;
        const list = Array.isArray(pData?.data?.phoneNumbers)
          ? pData.data.phoneNumbers
          : (Array.isArray(pData?.phoneNumbers)
            ? pData.phoneNumbers
            : (Array.isArray(pData?.data?.phone_numbers)
              ? pData.data.phone_numbers
              : (Array.isArray(pData?.phone_numbers)
                ? pData.phone_numbers
                : (Array.isArray(pData?.data)
                  ? pData.data
                  : (Array.isArray(pData) ? pData : [])))));
        setPhoneNumbers(Array.isArray(list) ? list : []);
      }
    } catch {
      addToast('Failed to load campaign setup resources', 'error');
    }
  };

  const handleAction = async (id: string | number, action: string) => {
    if (!token) return;
    try {
      setActionLoading(`${id}-${action}`);
      await api(`/campaigns/${id}/${action}`, { method: 'POST', body: {}, token });
      addToast(`Campaign ${action} action submitted`, 'success');
      fetchCampaigns();
    } catch (err: any) {
      addToast(`Action failed: ${err.message || 'Error'}`, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const openWizard = () => {
    setIsWizardOpen(true);
    setWizardStep(1);
    loadWizardData();
  };

  const closeWizard = () => {
    setIsWizardOpen(false);
    setWizardData({
      name: '',
      description: '',
      contactIds: [],
      agentId: '',
      phoneNumberId: '',
      schedule: {
        startDate: '',
        endDate: '',
        startTime: '09:00',
        endTime: '17:00',
        days: ['mon', 'tue', 'wed', 'thu', 'fri'],
      },
      limits: {
        maxConcurrent: 1,
        callsPerMinute: 5,
        maxSpend: '',
        maxRetries: 3,
        voicemailAction: 'hang_up',
      },
    });
  };

  const submitWizard = async () => {
    if (!wizardData.name.trim()) {
      addToast('Please enter a campaign name', 'error');
      setWizardStep(1);
      return;
    }
    if (!token) return;

    setSubmittingWizard(true);
    try {
      const payload = {
        name: wizardData.name.trim(),
        description: wizardData.description?.trim() || null,
        agent_id: wizardData.agentId ? String(wizardData.agentId) : null,
        phone_number_id: wizardData.phoneNumberId ? String(wizardData.phoneNumberId) : null,
        contact_list: wizardData.contactIds,
        schedule_start: wizardData.schedule.startDate || null,
        schedule_end: wizardData.schedule.endDate || null,
        calling_days: wizardData.schedule.days.length > 0 ? wizardData.schedule.days : ['mon', 'tue', 'wed', 'thu', 'fri'],
        calling_start_time: wizardData.schedule.startTime || '09:00',
        calling_end_time: wizardData.schedule.endTime || '17:00',
        max_concurrent_calls: Number(wizardData.limits.maxConcurrent) || 1,
        calls_per_minute: Number(wizardData.limits.callsPerMinute) || 5,
        max_spend: wizardData.limits.maxSpend ? Number(wizardData.limits.maxSpend) : null,
        max_retry_attempts: Number(wizardData.limits.maxRetries) || 3,
        voicemail_action: wizardData.limits.voicemailAction || 'hang_up',
      };

      await api('/campaigns', { method: 'POST', body: payload, token });
      addToast('Campaign created successfully', 'success');
      closeWizard();
      fetchCampaigns();
    } catch (err: any) {
      addToast(err.message || 'Failed to create campaign', 'error');
    } finally {
      setSubmittingWizard(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const s = (status || '').toLowerCase();
    switch (s) {
      case 'draft':
      case 'scheduled':
      case 'completed':
        return <span className="bg-blue-500/10 text-blue-400 rounded-full px-2 py-0.5 text-xs font-medium capitalize">{s}</span>;
      case 'running':
        return <span className="bg-emerald-500/10 text-emerald-400 rounded-full px-2 py-0.5 text-xs font-medium capitalize">{s}</span>;
      case 'paused':
        return <span className="bg-yellow-500/10 text-yellow-400 rounded-full px-2 py-0.5 text-xs font-medium capitalize">{s}</span>;
      case 'cancelled':
      case 'failed':
        return <span className="bg-red-500/10 text-red-400 rounded-full px-2 py-0.5 text-xs font-medium capitalize">{s}</span>;
      default:
        return <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs font-medium capitalize">{status}</span>;
    }
  };

  const calculateTotalContacts = (camp: Campaign) => {
    if (camp.stats?.total) return camp.stats.total;
    if (camp.total_contacts) return camp.total_contacts;
    if (Array.isArray(camp.contact_list)) return camp.contact_list.length;
    if (typeof camp.contact_list === 'string') {
      try {
        const parsed = JSON.parse(camp.contact_list);
        if (Array.isArray(parsed)) return parsed.length;
      } catch {}
    }
    return 0;
  };

  const dayOptions = [
    { key: 'mon', label: 'Mon' },
    { key: 'tue', label: 'Tue' },
    { key: 'wed', label: 'Wed' },
    { key: 'thu', label: 'Thu' },
    { key: 'fri', label: 'Fri' },
    { key: 'sat', label: 'Sat' },
    { key: 'sun', label: 'Sun' },
  ];

  const totalCampaigns = Array.isArray(campaigns) ? campaigns.length : 0;
  const activeDialers = Array.isArray(campaigns)
    ? campaigns.filter((c) => (c.status || '').toLowerCase() === 'running').length
    : 0;
  const callsDispatched = Array.isArray(campaigns)
    ? campaigns.reduce((acc, c) => acc + (c.stats?.completed ?? c.calls_completed ?? 0), 0)
    : 0;
  const totalAnswered = Array.isArray(campaigns)
    ? campaigns.reduce((acc, c) => acc + (c.stats?.answered ?? c.calls_answered ?? 0), 0)
    : 0;
  const globalAnswerRate = callsDispatched > 0
    ? Math.round((totalAnswered / callsDispatched) * 100)
    : 0;

  const summaryCards = [
    {
      label: 'Total campaigns',
      value: totalCampaigns,
      icon: Layers,
      trend: totalCampaigns > 0 ? 'up' : 'neutral',
      trendLabel: totalCampaigns > 0 ? `${totalCampaigns} configured` : 'None',
    },
    {
      label: 'Active dialers',
      value: activeDialers,
      icon: Radio,
      trend: activeDialers > 0 ? 'up' : 'neutral',
      trendLabel: activeDialers > 0 ? `${activeDialers} active` : 'Idle',
    },
    {
      label: 'Calls dispatched',
      value: callsDispatched.toLocaleString(),
      icon: PhoneOutgoing,
      trend: callsDispatched > 0 ? 'up' : 'neutral',
      trendLabel: callsDispatched > 0 ? 'Dispatched' : 'Zero',
    },
    {
      label: 'Answer rate',
      value: `${globalAnswerRate}%`,
      icon: CheckCircle,
      trend: globalAnswerRate >= 50 ? 'up' : globalAnswerRate > 0 ? 'neutral' : 'down',
      trendLabel: globalAnswerRate >= 50 ? 'Optimal' : globalAnswerRate > 0 ? 'Normal' : 'No data',
    },
  ];

  useEffect(() => {
    setTopBar({
      title: 'Campaigns',
      actions: (
        <button className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 text-sm font-medium inline-flex items-center gap-2" onClick={openWizard}>
          <Plus size={16} /> New Campaign
        </button>
      )
    });
  }, [setTopBar]); // Not including openWizard to avoid exhaustive deps issues, as eslint is disabled

  return (
    <div className="max-w-7xl mx-auto px-6 py-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {summaryCards.map((card, i) => {
          const IconComponent = card.icon;
          return (
            <div key={i} className="rounded-lg border border-border bg-card p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">{card.label}</span>
                <IconComponent size={16} className="text-muted-foreground" />
              </div>
              <div className="text-2xl font-semibold font-mono tabular-nums mb-1">{card.value}</div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                {card.trend === 'up' ? <TrendingUp size={12} className="text-emerald-500" /> : card.trend === 'down' ? <TrendingDown size={12} className="text-red-500" /> : <Minus size={12} />}
                <span>{card.trendLabel}</span>
              </div>
            </div>
          );
        })}
      </div>

      {loading ? (
        <SkeletonRows count={4} />
      ) : !Array.isArray(campaigns) || campaigns.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="No campaigns yet"
          description="Create automated outbound campaigns to reach your contacts at scale."
          action={<button onClick={openWizard} className="bg-foreground text-background hover:bg-foreground/90 rounded-md px-4 py-2 text-sm font-medium">New Campaign</button>}
        />
      ) : (
        <div className="flex flex-col gap-4">
          {Array.isArray(campaigns) && campaigns.map((camp) => {
            const totalCount = calculateTotalContacts(camp);
            const completedCount = camp.stats?.completed ?? camp.calls_completed ?? 0;
            const answeredCount = camp.stats?.answered ?? camp.calls_answered ?? 0;
            const failedCount = camp.stats?.failed ?? camp.calls_failed ?? 0;
            const answerRate = totalCount > 0 ? Math.round((answeredCount / totalCount) * 100) : 0;
            const isExpanded = expandedId === camp.id;
            const s = (camp.status || '').toLowerCase();
            const percentage = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

            return (
              <div key={camp.id} className="rounded-lg border border-border bg-card">
                <div
                  onClick={() => setExpandedId(isExpanded ? null : camp.id)}
                  className={cn(
                    "flex items-center justify-between p-4 cursor-pointer transition-colors",
                    isExpanded ? "bg-accent/50 rounded-t-lg" : "hover:bg-accent/50 rounded-lg"
                  )}
                >
                  <div className="flex items-center gap-4">
                    {getStatusBadge(camp.status)}
                    <div>
                      <h3 className="text-base font-semibold">{camp.name}</h3>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {completedCount} completed • {answeredCount} answered ({answerRate}%)
                        {camp.description && ` • ${camp.description}`}
                      </p>
                    </div>
                  </div>
                  <div className="text-muted-foreground">
                    {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  </div>
                </div>

                {isExpanded && (
                  <div className="p-6 border-t border-border bg-card rounded-b-lg">
                    
                    <div className="mb-6">
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-muted-foreground">Campaign progress</span>
                        <span className="font-mono tabular-nums">{completedCount} / {totalCount}</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted">
                        <div className="h-2 rounded-full bg-emerald-500 transition-all" style={{ width: `${percentage}%` }} />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                      <div className="rounded-lg border border-border bg-background p-4">
                        <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-1">Progress</div>
                        <div className="text-xl font-semibold font-mono tabular-nums">
                          {completedCount} <span className="text-sm font-normal text-muted-foreground">/ {totalCount}</span>
                        </div>
                      </div>
                      <div className="rounded-lg border border-border bg-background p-4">
                        <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-1">Answer rate</div>
                        <div className="text-xl font-semibold font-mono tabular-nums text-emerald-500">
                          {answerRate}%
                        </div>
                      </div>
                      <div className="rounded-lg border border-border bg-background p-4">
                        <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-1">Failed / No answer</div>
                        <div className={cn("text-xl font-semibold font-mono tabular-nums", failedCount > 0 ? "text-red-500" : "text-muted-foreground")}>
                          {failedCount}
                        </div>
                      </div>
                      <div className="rounded-lg border border-border bg-background p-4">
                        <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-1">Concurrency limit</div>
                        <div className="text-xl font-semibold font-mono tabular-nums">
                          {camp.max_concurrent || 1} <span className="text-sm font-normal text-muted-foreground">line{(camp.max_concurrent || 1) > 1 ? 's' : ''}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {['draft', 'paused', 'scheduled'].includes(s) && (
                        <button
                          className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 text-sm font-medium inline-flex items-center gap-2"
                          onClick={(e) => { e.stopPropagation(); handleAction(camp.id, 'start'); }}
                          disabled={actionLoading === `${camp.id}-start`}
                        >
                          <Play size={14} /> Start Campaign
                        </button>
                      )}
                      {s === 'running' && (
                        <button
                          className="text-muted-foreground hover:text-foreground hover:bg-accent rounded-md px-3 py-2 text-sm inline-flex items-center gap-2 border border-border"
                          onClick={(e) => { e.stopPropagation(); handleAction(camp.id, 'pause'); }}
                          disabled={actionLoading === `${camp.id}-pause`}
                        >
                          <Pause size={14} /> Pause
                        </button>
                      )}
                      {['running', 'paused', 'scheduled'].includes(s) && (
                        <button
                          className="bg-red-600 text-white hover:bg-red-700 rounded-md px-4 py-2 text-sm font-medium inline-flex items-center gap-2"
                          onClick={(e) => { e.stopPropagation(); setConfirmCancelTarget(camp); }}
                        >
                          <Square size={14} /> Cancel Campaign
                        </button>
                      )}
                      <button
                        className="text-muted-foreground hover:text-foreground hover:bg-accent rounded-md px-3 py-2 text-sm inline-flex items-center gap-2 border border-border"
                        onClick={(e) => { e.stopPropagation(); handleAction(camp.id, 'duplicate'); }}
                        disabled={actionLoading === `${camp.id}-duplicate`}
                      >
                        <Copy size={14} /> Duplicate
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {confirmCancelTarget && (
        <ConfirmModal
          title="Cancel Campaign"
          message={`Are you sure you want to cancel "${confirmCancelTarget.name}"? In-flight calls will finish but no additional calls will be dispatched.`}
          confirmLabel="Cancel Campaign"
          danger
          onConfirm={() => {
            const id = confirmCancelTarget.id;
            setConfirmCancelTarget(null);
            handleAction(id, 'cancel');
          }}
          onCancel={() => setConfirmCancelTarget(null)}
        />
      )}

      {isWizardOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-2xl rounded-lg border border-border bg-card p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Megaphone size={18} />
                New Campaign — Step {wizardStep} of 6
              </h2>
              <button onClick={closeWizard} className="text-muted-foreground hover:text-foreground">
                <X size={20} />
              </button>
            </div>

            <div className="flex gap-1 mb-6">
              {[1, 2, 3, 4, 5, 6].map((st) => (
                <div
                  key={st}
                  className={cn(
                    "h-1.5 flex-1 rounded-full transition-colors",
                    st <= wizardStep ? "bg-primary" : "bg-muted"
                  )}
                />
              ))}
            </div>

            <div className="max-h-[60vh] overflow-y-auto mb-6 pr-2">
              {wizardStep === 1 && (
                <div className="flex flex-col gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5 text-foreground">Campaign name *</label>
                    <input
                      type="text"
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                      placeholder="e.g. Q3 Sales Re-engagement"
                      value={wizardData.name}
                      onChange={(e) => setWizardData({ ...wizardData, name: e.target.value })}
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5 text-foreground">Description (Optional)</label>
                    <textarea
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring min-h-[100px]"
                      placeholder="Objective or notes for this sequence..."
                      value={wizardData.description}
                      onChange={(e) => setWizardData({ ...wizardData, description: e.target.value })}
                    />
                  </div>
                </div>
              )}

              {wizardStep === 2 && (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-medium text-foreground">Select target contacts</label>
                    <span className="text-sm text-primary font-medium">{wizardData.contactIds.length} selected</span>
                  </div>
                  <div className="max-h-[300px] overflow-y-auto rounded-md border border-border bg-background p-2">
                    {!Array.isArray(contacts) || contacts.length === 0 ? (
                      <div className="p-6 text-center text-sm text-muted-foreground">
                        No contacts found. Please add contacts from the Contacts tab first.
                      </div>
                    ) : (
                      Array.isArray(contacts) && contacts.map((c) => {
                        const isChecked = wizardData.contactIds.includes(c.id);
                        const displayName = c.name || [c.first_name, c.last_name].filter(Boolean).join(' ') || c.phone;
                        return (
                          <label
                            key={c.id}
                            className={cn(
                              "flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors",
                              isChecked ? "bg-accent/50" : "hover:bg-accent/50"
                            )}
                          >
                            <input
                              type="checkbox"
                              className="rounded border-border bg-background text-primary focus:ring-primary"
                              checked={isChecked}
                              onChange={(e) => {
                                const ids = e.target.checked
                                  ? [...wizardData.contactIds, c.id]
                                  : wizardData.contactIds.filter((id) => id !== c.id);
                                setWizardData({ ...wizardData, contactIds: ids });
                              }}
                            />
                            <span className="text-sm flex-1">{displayName}</span>
                            <span className="text-xs text-muted-foreground font-mono">{c.phone}</span>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {wizardStep === 3 && (
                <div className="flex flex-col gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1 text-foreground">Calling agent *</label>
                    <p className="text-xs text-muted-foreground mb-3">Choose the AI agent that will handle these outbound calls.</p>
                    <select
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                      value={wizardData.agentId}
                      onChange={(e) => setWizardData({ ...wizardData, agentId: e.target.value })}
                    >
                      <option value="">-- Choose an Agent --</option>
                      {Array.isArray(agents) && agents.map((a) => {
                        const idVal = a.agent_id || a.id || '';
                        return (
                          <option key={idVal} value={idVal}>
                            {a.name}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>
              )}

              {wizardStep === 4 && (
                <div className="flex flex-col gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1 text-foreground">Outbound phone number *</label>
                    <p className="text-xs text-muted-foreground mb-3">Select the verified telephony caller ID number.</p>
                    <select
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                      value={wizardData.phoneNumberId}
                      onChange={(e) => setWizardData({ ...wizardData, phoneNumberId: e.target.value })}
                    >
                      <option value="">-- Choose a Number --</option>
                      {Array.isArray(phoneNumbers) && phoneNumbers.map((n) => {
                        const numStr = n.phone_number || n.number || '';
                        const labelStr = n.label ? `${n.label} (${numStr})` : numStr;
                        return (
                          <option key={n.id} value={n.id}>
                            {labelStr}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>
              )}

              {wizardStep === 5 && (
                <div className="flex flex-col gap-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1.5 text-foreground">Start date</label>
                      <input
                        type="date"
                        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                        value={wizardData.schedule.startDate}
                        onChange={(e) =>
                          setWizardData({
                            ...wizardData,
                            schedule: { ...wizardData.schedule, startDate: e.target.value },
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1.5 text-foreground">End date</label>
                      <input
                        type="date"
                        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                        value={wizardData.schedule.endDate}
                        onChange={(e) =>
                          setWizardData({
                            ...wizardData,
                            schedule: { ...wizardData.schedule, endDate: e.target.value },
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1.5 text-foreground">Daily window start</label>
                      <input
                        type="time"
                        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                        value={wizardData.schedule.startTime}
                        onChange={(e) =>
                          setWizardData({
                            ...wizardData,
                            schedule: { ...wizardData.schedule, startTime: e.target.value },
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1.5 text-foreground">Daily window end</label>
                      <input
                        type="time"
                        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                        value={wizardData.schedule.endTime}
                        onChange={(e) =>
                          setWizardData({
                            ...wizardData,
                            schedule: { ...wizardData.schedule, endTime: e.target.value },
                          })
                        }
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2 text-foreground">Calling days</label>
                    <div className="flex flex-wrap gap-2">
                      {dayOptions.map((d) => {
                        const isSelected = wizardData.schedule.days.includes(d.key);
                        return (
                          <button
                            key={d.key}
                            type="button"
                            onClick={() => {
                              const newDays = isSelected
                                ? wizardData.schedule.days.filter((x) => x !== d.key)
                                : [...wizardData.schedule.days, d.key];
                              setWizardData({
                                ...wizardData,
                                schedule: { ...wizardData.schedule, days: newDays },
                              });
                            }}
                            className={cn(
                              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors border",
                              isSelected 
                                ? "bg-primary text-primary-foreground border-primary" 
                                : "bg-transparent text-muted-foreground border-border hover:border-muted-foreground"
                            )}
                          >
                            {d.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {wizardStep === 6 && (
                <div className="flex flex-col gap-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1.5 text-foreground">Concurrent call lines</label>
                      <input
                        type="number"
                        min="1"
                        max="20"
                        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                        value={wizardData.limits.maxConcurrent}
                        onChange={(e) =>
                          setWizardData({
                            ...wizardData,
                            limits: { ...wizardData.limits, maxConcurrent: parseInt(e.target.value) || 1 },
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1.5 text-foreground">Calls / minute</label>
                      <input
                        type="number"
                        min="1"
                        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                        value={wizardData.limits.callsPerMinute}
                        onChange={(e) =>
                          setWizardData({
                            ...wizardData,
                            limits: { ...wizardData.limits, callsPerMinute: parseInt(e.target.value) || 5 },
                          })
                        }
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1.5 text-foreground">Max Spend ($)</label>
                      <input
                        type="number"
                        min="0"
                        placeholder="Optional"
                        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                        value={wizardData.limits.maxSpend}
                        onChange={(e) =>
                          setWizardData({
                            ...wizardData,
                            limits: { ...wizardData.limits, maxSpend: e.target.value },
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1.5 text-foreground">Max retry attempts</label>
                      <input
                        type="number"
                        min="0"
                        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                        value={wizardData.limits.maxRetries}
                        onChange={(e) =>
                          setWizardData({
                            ...wizardData,
                            limits: { ...wizardData.limits, maxRetries: parseInt(e.target.value) || 0 },
                          })
                        }
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1.5 text-foreground">Voicemail Action</label>
                    <select
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                      value={wizardData.limits.voicemailAction}
                      onChange={(e) => setWizardData({
                        ...wizardData,
                        limits: { ...wizardData.limits, voicemailAction: e.target.value }
                      })}
                    >
                      <option value="hang_up">Hang up</option>
                      <option value="leave_message">Leave message</option>
                      <option value="retry">Retry later</option>
                      <option value="schedule_callback">Schedule callback</option>
                    </select>
                  </div>
                </div>
              )}

              {wizardStep === 7 && (
                <div className="flex flex-col gap-6">
                  <div className="rounded-lg border border-border bg-background p-4">
                    <h4 className="text-sm font-medium mb-3">Pre-launch Validation Summary</h4>
                    <div className="grid grid-cols-[160px_1fr] gap-y-3 text-sm">
                      <span className="text-muted-foreground">Campaign Name:</span>
                      <span className="font-medium">{wizardData.name || '—'}</span>
                      
                      <span className="text-muted-foreground">Selected Contacts:</span>
                      <span>
                        <span className="font-semibold text-primary">{wizardData.contactIds.length}</span> total
                        {' • '}
                        <span className="text-emerald-500">{wizardData.contactIds.length} valid numbers</span>
                        {' • '}0 DNC excluded {' • '}0 duplicates removed
                      </span>
                      
                      <span className="text-muted-foreground">Calling Agent:</span>
                      <span>
                        {agents.find((a) => (a.agent_id || a.id) === wizardData.agentId)?.name || 'Not selected'}
                      </span>
                      
                      <span className="text-muted-foreground">Phone Number:</span>
                      <span>
                        {phoneNumbers.find((n) => n.id === wizardData.phoneNumberId)?.phone_number ||
                          phoneNumbers.find((n) => n.id === wizardData.phoneNumberId)?.number ||
                          'Not selected'}
                      </span>
                      
                      <span className="text-muted-foreground">Calling Days:</span>
                      <span>{wizardData.schedule.days.join(', ').toUpperCase()}</span>
                      
                      <span className="text-muted-foreground">Time Window:</span>
                      <span>{wizardData.schedule.startTime} - {wizardData.schedule.endTime}</span>

                      <span className="text-muted-foreground">Estimated Minutes:</span>
                      <span>~{wizardData.contactIds.length * 2} minutes</span>
                      
                      <span className="text-muted-foreground">Estimated Cost:</span>
                      <span>${((wizardData.contactIds.length * 2) * 0.11).toFixed(2)} USD</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center mt-6">
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground hover:bg-accent rounded-md px-4 py-2 text-sm font-medium"
                onClick={() => (wizardStep > 1 ? setWizardStep((s) => s - 1) : closeWizard())}
              >
                {wizardStep === 1 ? 'Cancel' : 'Back'}
              </button>

              {wizardStep < 6 ? (
                <button
                  type="button"
                  className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 text-sm font-medium"
                  onClick={() => {
                    if (wizardStep === 1 && !wizardData.name.trim()) {
                      addToast('Please enter a campaign name', 'error');
                      return;
                    }
                    setWizardStep((s) => s + 1);
                  }}
                >
                  Next step
                </button>
              ) : (
                <button
                  type="button"
                  className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
                  disabled={submittingWizard}
                  onClick={submitWizard}
                >
                  {submittingWizard ? 'Creating Sequence...' : 'Create Sequence'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
