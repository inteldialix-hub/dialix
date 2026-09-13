/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps */
'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import '@/styles/dashboard.css';
import { FiPlus, FiPlay, FiPause, FiSquare, FiCopy, FiTrash2, FiChevronDown, FiChevronUp, FiPhoneCall, FiAlertTriangle } from 'react-icons/fi';

export default function CampaignsPage() {
  const { token, isAuthenticated } = useAuth();
  
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Wizard state
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [wizardData, setWizardData] = useState<any>({
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
      days: []
    },
    limits: {
      maxConcurrent: 1,
      maxCallsPerHour: 100,
      maxRetries: 0
    }
  });

  // Supporting data for wizard
  const [contacts, setContacts] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [phoneNumbers, setPhoneNumbers] = useState<any[]>([]);
  
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      fetchCampaigns();
    }
  }, [isAuthenticated]);

  const fetchCampaigns = async () => {
    try {
      setLoading(true);
      const res = await api('/campaigns', { token: token || undefined }).catch(() => []);
      setCampaigns(res.data || res || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  };

  const loadWizardData = async () => {
    try {
      const [cRes, aRes, pRes] = await Promise.all([
        api('/contacts', { token: token || undefined }).catch(() => []),
        api('/agents/all', { token: token || undefined }).catch(() => []),
        api('/phone-numbers', { token: token || undefined }).catch(() => [])
      ]);
      setContacts(cRes.contacts || cRes.data || cRes || []);
      setAgents(aRes.data || aRes || []);
      setPhoneNumbers(pRes.data || pRes || []);
    } catch (e) {
      console.error(e);
    }
  };

  const handleAction = async (id: string, action: string) => {
    try {
      await api(`/campaigns/${id}/${action}`, { method: 'POST', body: {}, token });
      fetchCampaigns();
    } catch (err: any) {
      alert(`Action failed: ${err.message}`);
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
      name: '', description: '', contactIds: [], agentId: '', phoneNumberId: '',
      schedule: { startDate: '', endDate: '', startTime: '09:00', endTime: '17:00', days: [] },
      limits: { maxConcurrent: 1, maxCallsPerHour: 100, maxRetries: 0 }
    });
  };

  const submitWizard = async () => {
    try {
      await api('/campaigns', { method: 'POST', body: wizardData, token });
      closeWizard();
      fetchCampaigns();
    } catch (err: any) {
      alert(`Create failed: ${err.message}`);
    }
  };

  const getStatusBadge = (status: string) => {
    const s = (status || '').toLowerCase();
    switch(s) {
      case 'draft': return <span className="px-2 py-1 text-xs rounded-md bg-gray-500/20 text-gray-400 border border-gray-500/30">DRAFT</span>;
      case 'scheduled': return <span className="px-2 py-1 text-xs rounded-md bg-blue-500/20 text-blue-400 border border-blue-500/30">SCHEDULED</span>;
      case 'running': return <span className="px-2 py-1 text-xs rounded-md bg-green-500/20 text-green-400 border border-green-500/30 animate-pulse">RUNNING</span>;
      case 'paused': return <span className="px-2 py-1 text-xs rounded-md bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">PAUSED</span>;
      case 'completed': return <span className="px-2 py-1 text-xs rounded-md bg-green-500/20 text-green-500 border border-green-500/30">COMPLETED</span>;
      case 'cancelled': case 'failed': return <span className="px-2 py-1 text-xs rounded-md bg-red-500/20 text-red-500 border border-red-500/30">{s.toUpperCase()}</span>;
      default: return <span>{status}</span>;
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6" style={{ minHeight: '100vh', backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)' }}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Campaigns</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Manage your automated outbound call campaigns.</p>
        </div>
        <button 
          onClick={openWizard}
          className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors"
          style={{ backgroundColor: 'var(--brand-accent)', color: '#fff' }}
        >
          <FiPlus /> New Campaign
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-lg text-sm bg-red-500/10 text-red-500 border border-red-500/20">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center p-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--brand-accent)]"></div>
        </div>
      ) : campaigns.length === 0 ? (
        <div className="p-12 text-center rounded-xl border border-[var(--border-default)] bg-[var(--bg-raised)]">
          <FiPhoneCall className="mx-auto h-12 w-12 mb-4 opacity-30" style={{ color: 'var(--text-tertiary)' }} />
          <p className="text-lg mb-2">No campaigns yet</p>
          <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>Create your first outbound campaign to start calling contacts.</p>
          <button onClick={openWizard} className="px-4 py-2 rounded-lg bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-sm">Create Campaign</button>
        </div>
      ) : (
        <div className="space-y-4">
          {campaigns.map(camp => (
            <div key={camp.id} className="rounded-xl border overflow-hidden transition-colors" style={{ backgroundColor: 'var(--bg-raised)', borderColor: 'var(--border-default)' }}>
              <div 
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-[var(--bg-hover)]"
                onClick={() => setExpandedId(expandedId === camp.id ? null : camp.id)}
              >
                <div className="flex items-center gap-4">
                  {getStatusBadge(camp.status)}
                  <div>
                    <h3 className="font-semibold">{camp.name}</h3>
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{camp.stats?.completed || 0} completed • {camp.stats?.answered || 0} answered</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {expandedId === camp.id ? <FiChevronUp /> : <FiChevronDown />}
                </div>
              </div>
              
              {expandedId === camp.id && (
                <div className="p-4 border-t border-[var(--border-subtle)] bg-[var(--bg-base)] space-y-4">
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="p-3 rounded bg-[var(--bg-raised)] border border-[var(--border-subtle)]">
                      <p className="text-xs text-[var(--text-secondary)]">Progress</p>
                      <p className="text-xl font-bold">{camp.stats?.completed || 0} / {camp.stats?.total || 0}</p>
                    </div>
                    <div className="p-3 rounded bg-[var(--bg-raised)] border border-[var(--border-subtle)]">
                      <p className="text-xs text-[var(--text-secondary)]">Answer Rate</p>
                      <p className="text-xl font-bold text-green-400">
                        {camp.stats?.total ? Math.round((camp.stats?.answered || 0) / camp.stats?.total * 100) : 0}%
                      </p>
                    </div>
                    <div className="p-3 rounded bg-[var(--bg-raised)] border border-[var(--border-subtle)]">
                      <p className="text-xs text-[var(--text-secondary)]">Failed</p>
                      <p className="text-xl font-bold text-red-400">{camp.stats?.failed || 0}</p>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    {['draft', 'paused', 'scheduled'].includes((camp.status || '').toLowerCase()) && (
                      <button onClick={(e) => { e.stopPropagation(); handleAction(camp.id, 'start'); }} className="flex items-center gap-1 px-3 py-1.5 rounded bg-green-500/10 text-green-400 text-sm hover:bg-green-500/20"><FiPlay /> Start</button>
                    )}
                    {(camp.status || '').toLowerCase() === 'running' && (
                      <button onClick={(e) => { e.stopPropagation(); handleAction(camp.id, 'pause'); }} className="flex items-center gap-1 px-3 py-1.5 rounded bg-yellow-500/10 text-yellow-400 text-sm hover:bg-yellow-500/20"><FiPause /> Pause</button>
                    )}
                    {['running', 'paused', 'scheduled'].includes((camp.status || '').toLowerCase()) && (
                      <button onClick={(e) => { e.stopPropagation(); handleAction(camp.id, 'cancel'); }} className="flex items-center gap-1 px-3 py-1.5 rounded bg-red-500/10 text-red-400 text-sm hover:bg-red-500/20"><FiSquare /> Cancel</button>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); handleAction(camp.id, 'duplicate'); }} className="flex items-center gap-1 px-3 py-1.5 rounded bg-[var(--bg-hover)] text-[var(--text-secondary)] text-sm border border-[var(--border-subtle)]"><FiCopy /> Duplicate</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Wizard Modal */}
      {isWizardOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
          <div className="my-auto w-full max-w-2xl bg-[var(--bg-raised)] border border-[var(--border-default)] rounded-xl shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-[var(--border-subtle)] flex justify-between items-center">
              <h2 className="text-lg font-bold">Create Campaign - Step {wizardStep} of 7</h2>
              <button onClick={closeWizard} className="text-[var(--text-secondary)] hover:text-white">&times;</button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {wizardStep === 1 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm mb-1 text-[var(--text-secondary)]">Campaign Name</label>
                    <input type="text" className="w-full px-3 py-2 rounded bg-[var(--bg-input)] border border-[var(--border-subtle)]" value={wizardData.name} onChange={e => setWizardData({...wizardData, name: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm mb-1 text-[var(--text-secondary)]">Description</label>
                    <textarea className="w-full px-3 py-2 rounded bg-[var(--bg-input)] border border-[var(--border-subtle)]" value={wizardData.description} onChange={e => setWizardData({...wizardData, description: e.target.value})} rows={3} />
                  </div>
                </div>
              )}

              {wizardStep === 2 && (
                <div>
                  <label className="block text-sm mb-2 text-[var(--text-secondary)]">Select Contacts</label>
                  <div className="space-y-2 max-h-60 overflow-y-auto p-2 border border-[var(--border-subtle)] rounded bg-[var(--bg-base)]">
                    {contacts.length === 0 ? <p className="text-sm text-[var(--text-tertiary)] p-2">No contacts found</p> : contacts.map(c => (
                      <label key={c.id} className="flex items-center gap-2 text-sm p-1">
                        <input type="checkbox" checked={wizardData.contactIds.includes(c.id)} onChange={(e) => {
                          const ids = e.target.checked ? [...wizardData.contactIds, c.id] : wizardData.contactIds.filter((id: string) => id !== c.id);
                          setWizardData({...wizardData, contactIds: ids});
                        }} />
                        {c.name || c.phone}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {wizardStep === 3 && (
                <div>
                  <label className="block text-sm mb-2 text-[var(--text-secondary)]">Select Agent</label>
                  <select className="w-full px-3 py-2 rounded bg-[var(--bg-input)] border border-[var(--border-subtle)]" value={wizardData.agentId} onChange={e => setWizardData({...wizardData, agentId: e.target.value})}>
                    <option value="">-- Select an Agent --</option>
                    {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
              )}

              {wizardStep === 4 && (
                <div>
                  <label className="block text-sm mb-2 text-[var(--text-secondary)]">Select Outbound Number</label>
                  <select className="w-full px-3 py-2 rounded bg-[var(--bg-input)] border border-[var(--border-subtle)]" value={wizardData.phoneNumberId} onChange={e => setWizardData({...wizardData, phoneNumberId: e.target.value})}>
                    <option value="">-- Select a Number --</option>
                    {phoneNumbers.map(n => <option key={n.id} value={n.id}>{n.number}</option>)}
                  </select>
                </div>
              )}

              {wizardStep === 5 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-xs mb-1">Start Date</label><input type="date" className="w-full px-3 py-1.5 rounded bg-[var(--bg-input)] border border-[var(--border-subtle)] text-sm" value={wizardData.schedule.startDate} onChange={e => setWizardData({...wizardData, schedule: {...wizardData.schedule, startDate: e.target.value}})} /></div>
                    <div><label className="block text-xs mb-1">End Date</label><input type="date" className="w-full px-3 py-1.5 rounded bg-[var(--bg-input)] border border-[var(--border-subtle)] text-sm" value={wizardData.schedule.endDate} onChange={e => setWizardData({...wizardData, schedule: {...wizardData.schedule, endDate: e.target.value}})} /></div>
                    <div><label className="block text-xs mb-1">Start Time</label><input type="time" className="w-full px-3 py-1.5 rounded bg-[var(--bg-input)] border border-[var(--border-subtle)] text-sm" value={wizardData.schedule.startTime} onChange={e => setWizardData({...wizardData, schedule: {...wizardData.schedule, startTime: e.target.value}})} /></div>
                    <div><label className="block text-xs mb-1">End Time</label><input type="time" className="w-full px-3 py-1.5 rounded bg-[var(--bg-input)] border border-[var(--border-subtle)] text-sm" value={wizardData.schedule.endTime} onChange={e => setWizardData({...wizardData, schedule: {...wizardData.schedule, endTime: e.target.value}})} /></div>
                  </div>
                  <div>
                    <label className="block text-xs mb-2">Calling Days</label>
                    <div className="flex flex-wrap gap-2">
                      {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(day => (
                        <label key={day} className="flex items-center gap-1 text-sm bg-[var(--bg-base)] px-2 py-1 rounded border border-[var(--border-subtle)]">
                          <input type="checkbox" checked={wizardData.schedule.days.includes(day)} onChange={e => {
                            const days = e.target.checked ? [...wizardData.schedule.days, day] : wizardData.schedule.days.filter((d: string) => d !== day);
                            setWizardData({...wizardData, schedule: {...wizardData.schedule, days}});
                          }} /> {day}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {wizardStep === 6 && (
                <div className="space-y-4">
                  <div><label className="block text-sm mb-1">Max Concurrent Calls</label><input type="number" min="1" className="w-full px-3 py-2 rounded bg-[var(--bg-input)] border border-[var(--border-subtle)]" value={wizardData.limits.maxConcurrent} onChange={e => setWizardData({...wizardData, limits: {...wizardData.limits, maxConcurrent: parseInt(e.target.value)}})} /></div>
                  <div><label className="block text-sm mb-1">Max Calls / Hour</label><input type="number" min="1" className="w-full px-3 py-2 rounded bg-[var(--bg-input)] border border-[var(--border-subtle)]" value={wizardData.limits.maxCallsPerHour} onChange={e => setWizardData({...wizardData, limits: {...wizardData.limits, maxCallsPerHour: parseInt(e.target.value)}})} /></div>
                  <div><label className="block text-sm mb-1">Max Retries on Failure</label><input type="number" min="0" className="w-full px-3 py-2 rounded bg-[var(--bg-input)] border border-[var(--border-subtle)]" value={wizardData.limits.maxRetries} onChange={e => setWizardData({...wizardData, limits: {...wizardData.limits, maxRetries: parseInt(e.target.value)}})} /></div>
                </div>
              )}

              {wizardStep === 7 && (
                <div className="space-y-4 text-sm bg-[var(--bg-base)] p-4 rounded border border-[var(--border-subtle)]">
                  <h3 className="font-bold border-b border-[var(--border-subtle)] pb-2 mb-2">Review Campaign</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <span className="text-[var(--text-secondary)]">Name:</span><span>{wizardData.name || '-'}</span>
                    <span className="text-[var(--text-secondary)]">Contacts:</span><span>{wizardData.contactIds.length} selected</span>
                    <span className="text-[var(--text-secondary)]">Agent:</span><span>{agents.find(a => a.id === wizardData.agentId)?.name || wizardData.agentId || '-'}</span>
                    <span className="text-[var(--text-secondary)]">Number:</span><span>{phoneNumbers.find(n => n.id === wizardData.phoneNumberId)?.number || wizardData.phoneNumberId || '-'}</span>
                    <span className="text-[var(--text-secondary)]">Schedule:</span><span>{wizardData.schedule.startDate} to {wizardData.schedule.endDate}</span>
                    <span className="text-[var(--text-secondary)]">Hours:</span><span>{wizardData.schedule.startTime} - {wizardData.schedule.endTime}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-[var(--border-subtle)] flex justify-between bg-[var(--bg-hover)] rounded-b-xl">
              <button 
                onClick={() => wizardStep > 1 ? setWizardStep(s => s - 1) : closeWizard()} 
                className="px-4 py-2 rounded bg-[var(--bg-input)] border border-[var(--border-subtle)] hover:bg-[var(--bg-raised)] transition-colors text-sm font-medium"
              >
                {wizardStep === 1 ? 'Cancel' : 'Back'}
              </button>
              
              {wizardStep < 7 ? (
                <button 
                  onClick={() => setWizardStep(s => s + 1)}
                  className="px-4 py-2 rounded font-medium text-sm transition-colors"
                  style={{ backgroundColor: 'var(--brand-accent)', color: '#fff' }}
                >
                  Next
                </button>
              ) : (
                <button 
                  onClick={submitWizard}
                  className="px-4 py-2 rounded font-medium text-sm transition-colors flex items-center gap-2"
                  style={{ backgroundColor: 'var(--green)', color: '#fff' }}
                >
                  Create Campaign
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

