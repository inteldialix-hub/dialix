/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/dashboard/shared/ToastProvider';
import { Icon } from '@/components/dashboard/shared/Icon';
import { EmptyState } from '@/components/dashboard/shared/EmptyState';
import { ConfirmModal } from '@/components/dashboard/shared/ConfirmModal';
import { SkeletonRows } from '@/components/dashboard/shared/SkeletonRows';
import '@/styles/dashboard.css';

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
      maxCallsPerHour: 100,
      maxRetries: 0,
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
        maxCallsPerHour: 100,
        maxRetries: 0,
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
        max_concurrent: Number(wizardData.limits.maxConcurrent) || 1,
        max_calls_per_hour: Number(wizardData.limits.maxCallsPerHour) || 100,
        max_retries: Number(wizardData.limits.maxRetries) || 0,
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
        return <span className="badge draft">DRAFT</span>;
      case 'scheduled':
        return <span className="badge scheduled">SCHEDULED</span>;
      case 'running':
        return <span className="badge running">RUNNING</span>;
      case 'paused':
        return <span className="badge paused">PAUSED</span>;
      case 'completed':
        return <span className="badge completed">COMPLETED</span>;
      case 'cancelled':
      case 'failed':
        return <span className="badge danger">{s.toUpperCase()}</span>;
      default:
        return <span className="badge neutral">{status.toUpperCase()}</span>;
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

  // Top-level summary metrics across all campaigns
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
      label: 'Total Campaigns',
      value: totalCampaigns,
      icon: 'layers',
      trend: totalCampaigns > 0 ? 'up' : 'neutral',
      trendLabel: totalCampaigns > 0 ? `${totalCampaigns} Configured` : 'None',
    },
    {
      label: 'Active Dialers',
      value: activeDialers,
      icon: 'radio',
      trend: activeDialers > 0 ? 'up' : 'neutral',
      trendLabel: activeDialers > 0 ? `${activeDialers} Active` : 'Idle',
    },
    {
      label: 'Calls Dispatched',
      value: callsDispatched.toLocaleString(),
      icon: 'phone-outgoing',
      trend: callsDispatched > 0 ? 'up' : 'neutral',
      trendLabel: callsDispatched > 0 ? 'Dispatched' : 'Zero',
    },
    {
      label: 'Answer Rate',
      value: `${globalAnswerRate}%`,
      icon: 'check-circle',
      trend: globalAnswerRate >= 50 ? 'up' : globalAnswerRate > 0 ? 'neutral' : 'down',
      trendLabel: globalAnswerRate >= 50 ? 'Optimal' : globalAnswerRate > 0 ? 'Normal' : 'No Data',
    },
  ];

  return (
    <div className="page-body">
      <div className="page-content">
        <div className="page-title-section">
          <div>
            <h2>Campaigns</h2>
            <p>Automated outbound call sequences with smart retry algorithms</p>
          </div>
          <div className="page-actions">
            <button className="btn btn-primary" onClick={openWizard}>
              <Icon name="plus" size={14} /> New Campaign
            </button>
          </div>
        </div>

        {/* Top-Level Summary Metric Cards */}
        <div className="stat-card-grid" style={{ padding: '0 32px 24px' }}>
          {summaryCards.map((card, i) => (
            <div key={i} className="stat-card" style={{ animationDelay: `${i * 60}ms` }}>
              <div className="stat-card-header">
                <span className="stat-card-label">{card.label}</span>
                <div className="stat-card-icon"><Icon name={card.icon} size={16} /></div>
              </div>
              <div className="stat-card-value">{card.value}</div>
              <span className={`stat-card-trend ${card.trend}`}>
                <Icon name={card.trend === 'up' ? 'trending-up' : card.trend === 'down' ? 'trending-down' : 'minus'} size={11} />
                {card.trendLabel}
              </span>
            </div>
          ))}
        </div>

        {loading ? (
          <div style={{ padding: '24px 32px' }}>
            <SkeletonRows count={4} />
          </div>
        ) : !Array.isArray(campaigns) || campaigns.length === 0 ? (
          <div style={{ padding: '32px' }}>
            <EmptyState
              icon="megaphone"
              title="No campaigns yet"
              description="Create automated outbound campaigns to reach your contacts at scale."
              action="New Campaign"
              onAction={openWizard}
            />
          </div>
        ) : (
          <div style={{ padding: '0 32px 32px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {Array.isArray(campaigns) && campaigns.map((camp) => {
              const totalCount = calculateTotalContacts(camp);
              const completedCount = camp.stats?.completed ?? camp.calls_completed ?? 0;
              const answeredCount = camp.stats?.answered ?? camp.calls_answered ?? 0;
              const failedCount = camp.stats?.failed ?? camp.calls_failed ?? 0;
              const answerRate = totalCount > 0 ? Math.round((answeredCount / totalCount) * 100) : 0;
              const isExpanded = expandedId === camp.id;
              const s = (camp.status || '').toLowerCase();

              return (
                <div
                  key={camp.id}
                  style={{
                    background: 'rgba(18, 20, 24, 0.7)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.06), 0 4px 20px rgba(0, 0, 0, 0.2)',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                  }}
                >
                  <div
                    onClick={() => setExpandedId(isExpanded ? null : camp.id)}
                    style={{
                      padding: '18px 24px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      background: isExpanded ? 'rgba(255, 255, 255, 0.03)' : 'transparent',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      {getStatusBadge(camp.status)}
                      <div>
                        <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                          {camp.name}
                        </h3>
                        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '4px 0 0' }}>
                          {completedCount} completed • {answeredCount} answered ({answerRate}%)
                          {camp.description && ` • ${camp.description}`}
                        </p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--text-tertiary)' }}>
                      <Icon name={isExpanded ? 'chevron-up' : 'chevron-down'} size={18} />
                    </div>
                  </div>

                  {isExpanded && (
                    <div style={{ padding: '20px 24px', borderTop: '1px solid rgba(255, 255, 255, 0.06)', background: 'rgba(12, 14, 18, 0.7)' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '16px', marginBottom: '20px' }}>
                        <div style={{ padding: '16px', borderRadius: '10px', background: 'rgba(18, 20, 24, 0.7)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(255, 255, 255, 0.08)', boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.06), 0 4px 16px rgba(0, 0, 0, 0.2)' }}>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary, #94a3b8)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Progress</div>
                          <div style={{ fontSize: '22px', fontWeight: 700, color: '#ffffff', marginTop: '6px', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
                            {completedCount} <span style={{ fontSize: '13px', fontWeight: 400, color: 'var(--text-secondary, #94a3b8)' }}>/ {totalCount}</span>
                          </div>
                        </div>
                        <div style={{ padding: '16px', borderRadius: '10px', background: 'rgba(18, 20, 24, 0.7)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(255, 255, 255, 0.08)', boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.06), 0 4px 16px rgba(0, 0, 0, 0.2)' }}>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary, #94a3b8)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Answer Rate</div>
                          <div style={{ fontSize: '22px', fontWeight: 700, color: '#34d399', marginTop: '6px', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
                            {answerRate}%
                          </div>
                        </div>
                        <div style={{ padding: '16px', borderRadius: '10px', background: 'rgba(18, 20, 24, 0.7)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(255, 255, 255, 0.08)', boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.06), 0 4px 16px rgba(0, 0, 0, 0.2)' }}>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary, #94a3b8)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Failed / No Answer</div>
                          <div style={{ fontSize: '22px', fontWeight: 700, color: failedCount > 0 ? '#f87171' : 'var(--text-secondary, #94a3b8)', marginTop: '6px', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
                            {failedCount}
                          </div>
                        </div>
                        <div style={{ padding: '16px', borderRadius: '10px', background: 'rgba(18, 20, 24, 0.7)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(255, 255, 255, 0.08)', boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.06), 0 4px 16px rgba(0, 0, 0, 0.2)' }}>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary, #94a3b8)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Concurrency Limit</div>
                          <div style={{ fontSize: '22px', fontWeight: 700, color: '#ffffff', marginTop: '6px', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
                            {camp.max_concurrent || 1} <span style={{ fontSize: '13px', fontWeight: 400, color: 'var(--text-secondary, #94a3b8)' }}>line{(camp.max_concurrent || 1) > 1 ? 's' : ''}</span>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                        {['draft', 'paused', 'scheduled'].includes(s) && (
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={(e) => { e.stopPropagation(); handleAction(camp.id, 'start'); }}
                            disabled={actionLoading === `${camp.id}-start`}
                          >
                            <Icon name="play" size={13} /> Start Campaign
                          </button>
                        )}
                        {s === 'running' && (
                          <button
                            className="btn btn-sm btn-secondary"
                            onClick={(e) => { e.stopPropagation(); handleAction(camp.id, 'pause'); }}
                            disabled={actionLoading === `${camp.id}-pause`}
                          >
                            <Icon name="pause" size={13} /> Pause
                          </button>
                        )}
                        {['running', 'paused', 'scheduled'].includes(s) && (
                          <button
                            className="btn btn-sm btn-danger"
                            onClick={(e) => { e.stopPropagation(); setConfirmCancelTarget(camp); }}
                          >
                            <Icon name="square" size={13} /> Cancel Campaign
                          </button>
                        )}
                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={(e) => { e.stopPropagation(); handleAction(camp.id, 'duplicate'); }}
                          disabled={actionLoading === `${camp.id}-duplicate`}
                        >
                          <Icon name="copy" size={13} /> Duplicate
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Confirmation Modal for Cancel Campaign */}
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

      {/* New Campaign Wizard Modal */}
      {isWizardOpen && (
        <div className="modal-overlay" onClick={closeWizard}>
          <div
            className="modal-container"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '640px', width: '100%' }}
          >
            <div className="modal-header">
              <Icon name="megaphone" size={16} />
              <span>New Campaign — Step {wizardStep} of 6</span>
            </div>

            {/* Step indicator bar */}
            <div style={{ display: 'flex', gap: '4px', padding: '0 24px', margin: '12px 0 6px' }}>
              {[1, 2, 3, 4, 5, 6].map((st) => (
                <div
                  key={st}
                  style={{
                    flex: 1,
                    height: '3px',
                    borderRadius: '2px',
                    background: st <= wizardStep ? 'var(--brand-accent)' : 'var(--border-subtle)',
                    transition: 'background var(--transition)',
                  }}
                />
              ))}
            </div>

            <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              {wizardStep === 1 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Campaign Name *</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Q3 Sales Re-engagement"
                      value={wizardData.name}
                      onChange={(e) => setWizardData({ ...wizardData, name: e.target.value })}
                      autoFocus
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Description (Optional)</label>
                    <textarea
                      className="form-input"
                      placeholder="Objective or notes for this sequence..."
                      value={wizardData.description}
                      onChange={(e) => setWizardData({ ...wizardData, description: e.target.value })}
                      rows={3}
                      style={{ resize: 'vertical' }}
                    />
                  </div>
                </div>
              )}

              {wizardStep === 2 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label className="form-label">Select Target Contacts</label>
                    <span style={{ fontSize: '12px', color: 'var(--brand-accent)' }}>
                      {wizardData.contactIds.length} selected
                    </span>
                  </div>
                  <div
                    style={{
                      maxHeight: '260px',
                      overflowY: 'auto',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--bg-input)',
                      padding: '8px',
                    }}
                  >
                    {!Array.isArray(contacts) || contacts.length === 0 ? (
                      <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '13px' }}>
                        No contacts found. Please add contacts from the Contacts tab first.
                      </div>
                    ) : (
                      Array.isArray(contacts) && contacts.map((c) => {
                        const isChecked = wizardData.contactIds.includes(c.id);
                        const displayName = c.name || [c.first_name, c.last_name].filter(Boolean).join(' ') || c.phone;
                        return (
                          <label
                            key={c.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px',
                              padding: '8px 10px',
                              borderRadius: 'var(--radius-sm)',
                              cursor: 'pointer',
                              background: isChecked ? 'var(--bg-hover)' : 'transparent',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                const ids = e.target.checked
                                  ? [...wizardData.contactIds, c.id]
                                  : wizardData.contactIds.filter((id) => id !== c.id);
                                setWizardData({ ...wizardData, contactIds: ids });
                              }}
                            />
                            <span style={{ fontSize: '13px', color: 'var(--text-primary)', flex: 1 }}>{displayName}</span>
                            <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>{c.phone}</span>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {wizardStep === 3 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Calling Agent *</label>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                      Choose the AI agent that will handle these outbound calls.
                    </div>
                    <select
                      className="form-input"
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Outbound Phone Number *</label>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                      Select the verified telephony caller ID number.
                    </div>
                    <select
                      className="form-input"
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                    <div className="form-group">
                      <label className="form-label">Start Date</label>
                      <input
                        type="date"
                        className="form-input"
                        value={wizardData.schedule.startDate}
                        onChange={(e) =>
                          setWizardData({
                            ...wizardData,
                            schedule: { ...wizardData.schedule, startDate: e.target.value },
                          })
                        }
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">End Date</label>
                      <input
                        type="date"
                        className="form-input"
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

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                    <div className="form-group">
                      <label className="form-label">Daily Window Start</label>
                      <input
                        type="time"
                        className="form-input"
                        value={wizardData.schedule.startTime}
                        onChange={(e) =>
                          setWizardData({
                            ...wizardData,
                            schedule: { ...wizardData.schedule, startTime: e.target.value },
                          })
                        }
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Daily Window End</label>
                      <input
                        type="time"
                        className="form-input"
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

                  <div className="form-group">
                    <label className="form-label">Calling Days</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px' }}>
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
                            className={isSelected ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-secondary'}
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                    <div className="form-group">
                      <label className="form-label">Concurrent Call Lines</label>
                      <input
                        type="number"
                        min="1"
                        max="20"
                        className="form-input"
                        value={wizardData.limits.maxConcurrent}
                        onChange={(e) =>
                          setWizardData({
                            ...wizardData,
                            limits: { ...wizardData.limits, maxConcurrent: parseInt(e.target.value) || 1 },
                          })
                        }
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Max Calls / Hour</label>
                      <input
                        type="number"
                        min="1"
                        className="form-input"
                        value={wizardData.limits.maxCallsPerHour}
                        onChange={(e) =>
                          setWizardData({
                            ...wizardData,
                            limits: { ...wizardData.limits, maxCallsPerHour: parseInt(e.target.value) || 100 },
                          })
                        }
                      />
                    </div>
                  </div>

                  <div style={{ padding: '16px', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                    <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '10px' }}>
                      Sequence Summary
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '8px', fontSize: '12px' }}>
                      <span style={{ color: 'var(--text-tertiary)' }}>Name:</span>
                      <span style={{ color: 'var(--text-primary)' }}>{wizardData.name || '—'}</span>
                      <span style={{ color: 'var(--text-tertiary)' }}>Contacts:</span>
                      <span style={{ color: 'var(--text-primary)' }}>{wizardData.contactIds.length} target leads</span>
                      <span style={{ color: 'var(--text-tertiary)' }}>Agent:</span>
                      <span style={{ color: 'var(--text-primary)' }}>
                        {agents.find((a) => (a.agent_id || a.id) === wizardData.agentId)?.name || 'Not selected'}
                      </span>
                      <span style={{ color: 'var(--text-tertiary)' }}>Phone Number:</span>
                      <span style={{ color: 'var(--text-primary)' }}>
                        {phoneNumbers.find((n) => n.id === wizardData.phoneNumberId)?.phone_number ||
                          phoneNumbers.find((n) => n.id === wizardData.phoneNumberId)?.number ||
                          'Not selected'}
                      </span>
                      <span style={{ color: 'var(--text-tertiary)' }}>Calling Days:</span>
                      <span style={{ color: 'var(--text-primary)' }}>{wizardData.schedule.days.join(', ').toUpperCase()}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => (wizardStep > 1 ? setWizardStep((s) => s - 1) : closeWizard())}
              >
                {wizardStep === 1 ? 'Cancel' : 'Back'}
              </button>

              {wizardStep < 6 ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    if (wizardStep === 1 && !wizardData.name.trim()) {
                      addToast('Please enter a campaign name', 'error');
                      return;
                    }
                    setWizardStep((s) => s + 1);
                  }}
                >
                  Next Step
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary"
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

