'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/dashboard/shared/ToastProvider';
import { useTopBar } from '@/components/dashboard/TopBarContext';
import { Loader2, Plus, Phone, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';

interface PhoneNumber { id: string; label: string; phone_number: string; provider: string; assigned_agent_id?: string; }
interface Agent { agent_id: string; name: string; }

export default function PhoneNumbersPage() {
  const { token } = useAuth();
  const { addToast } = useToast();
  const { setTopBar } = useTopBar();
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PhoneNumber | null>(null);
  const [provider, setProvider] = useState('twilio');
  const [addLoading, setAddLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [pn, setPn] = useState('');
  const [sid, setSid] = useState('');
  const [at, setAt] = useState('');
  const [uri, setUri] = useState('');

  const loadData = useCallback(async () => {
    try {
      const [p, a] = await Promise.all([
        api<{ phoneNumbers: PhoneNumber[] }>('/phone-numbers', { token: token! }),
        api<{ agents: Agent[] }>('/agents', { token: token! }),
      ]);
      setPhoneNumbers(p.phoneNumbers || []);
      setAgents(a.agents || []);
    } catch (err) { 
      addToast(err instanceof Error ? err.message : 'Failed to load phone numbers', 'error'); 
    } finally { 
      setLoading(false); 
    }
  }, [token, addToast]);

  useEffect(() => { if (token) loadData(); }, [token, loadData]);

  const handleAssign = async (id: string, agentId: string) => {
    try {
      await api(`/phone-numbers/${id}/assign`, { token: token!, method: 'POST', body: { agent_id: agentId || null } });
      setPhoneNumbers(prev => prev.map(p => p.id === id ? { ...p, assigned_agent_id: agentId || undefined } : p));
      addToast(agentId ? 'Agent assigned to phone line' : 'Phone line unassigned', 'success');
    } catch (err) { 
      addToast(err instanceof Error ? err.message : 'Failed to assign agent', 'error'); 
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api(`/phone-numbers/${deleteTarget.id}`, { token: token!, method: 'DELETE' });
      setPhoneNumbers(prev => prev.filter(p => p.id !== deleteTarget.id));
      addToast(`Phone number "${deleteTarget.phone_number}" disconnected`, 'success');
      setDeleteTarget(null);
    } catch (err) { 
      addToast(err instanceof Error ? err.message : 'Failed to delete phone number', 'error'); 
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault(); 
    setAddLoading(true);
    setFormError(null);
    try {
      const ep = provider === 'twilio' ? '/phone-numbers/twilio' : '/phone-numbers/sip';
      const body = provider === 'twilio' 
        ? { label, phone_number: pn, account_sid: sid, auth_token: at } 
        : { label, phone_number: pn, termination_uri: uri };
      const r = await api<{ phoneNumber: PhoneNumber }>(ep, { token: token!, method: 'POST', body });
      addToast('Phone number connected successfully', 'success');
      setPhoneNumbers(prev => [...prev, r.phoneNumber]);
      setShowAdd(false); 
      setLabel(''); 
      setPn(''); 
      setSid(''); 
      setAt(''); 
      setUri('');
      setFormError(null);
    } catch (err) { 
      const msg = err instanceof Error ? err.message : 'Failed to connect phone number';
      setFormError(msg);
      addToast(msg, 'error'); 
    } finally { 
      setAddLoading(false); 
    }
  };

  useEffect(() => {
    setTopBar({
      title: 'Phone numbers',
      actions: (
        <button 
          onClick={() => setShowAdd(true)}
          disabled={loading}
          className={`bg-foreground text-background hover:bg-foreground/90 rounded-md px-4 py-2 text-sm font-medium flex items-center gap-2 ${loading ? 'opacity-50' : ''}`}
        >
          <Plus size={16} /> Connect number
        </button>
      )
    });
  }, [setTopBar, loading, setShowAdd]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-12 w-full rounded-md bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
      {phoneNumbers.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-12 flex flex-col items-center justify-center text-center">
          <Phone className="h-8 w-8 text-muted-foreground mb-3" />
          <h3 className="text-lg font-medium">No phone numbers connected</h3>
          <p className="text-sm text-muted-foreground mt-1 mb-4">Connect a Twilio number or SIP trunk to make and receive calls with your AI agents.</p>
          <button 
            onClick={() => setShowAdd(true)}
            className="bg-foreground text-background hover:bg-foreground/90 rounded-md px-4 py-2 text-sm font-medium flex items-center gap-2"
          >
            <Plus size={16} /> Connect number
          </button>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-x-auto">
          <table className="w-full text-left divide-y divide-border min-w-[640px]">
            <thead>
              <tr>
                <th scope="col" className="text-left font-medium text-muted-foreground px-4 py-3 text-sm">Label</th>
                <th scope="col" className="text-left font-medium text-muted-foreground px-4 py-3 text-sm">Phone number</th>
                <th scope="col" className="text-left font-medium text-muted-foreground px-4 py-3 text-sm">Provider</th>
                <th scope="col" className="text-left font-medium text-muted-foreground px-4 py-3 text-sm">Assigned agent</th>
                <th scope="col" className="text-right font-medium text-muted-foreground px-4 py-3 text-sm">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {phoneNumbers.map(p => (
                <tr key={p.id} className="hover:bg-accent/50 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium">{p.label}</td>
                  <td className="px-4 py-3 text-sm font-mono text-muted-foreground">{p.phone_number}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground">
                      {p.provider === 'twilio' ? 'Twilio' : 'SIP Trunk'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm" style={{ minWidth: '180px' }}>
                    <select 
                      className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                      value={p.assigned_agent_id || ''}
                      onChange={e => handleAssign(p.id, e.target.value)}
                    >
                      <option value="">Unassigned</option>
                      {agents.map(a => (
                        <option key={a.agent_id} value={a.agent_id}>{a.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-sm text-right">
                    <button 
                      className="text-muted-foreground hover:text-red-400 rounded-md p-1.5 transition-colors" 
                      onClick={() => setDeleteTarget(p)}
                      title="Disconnect line"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-6">
              <Phone size={18} />
              <h3 className="text-lg font-medium">Connect phone number</h3>
            </div>
            
            <div className="flex border-b border-border mb-6">
              <button 
                type="button"
                className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${provider === 'twilio' ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                onClick={() => setProvider('twilio')}
              >
                Twilio
              </button>
              <button 
                type="button"
                className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${provider === 'sip' ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                onClick={() => setProvider('sip')}
              >
                SIP Trunk
              </button>
            </div>

            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Label *</label>
                <input 
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring" 
                  placeholder="e.g. US Support Line"
                  value={label} 
                  onChange={e => setLabel(e.target.value)} 
                  required 
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Phone number (E.164) *</label>
                <input 
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring" 
                  placeholder="+1234567890" 
                  value={pn} 
                  onChange={e => setPn(e.target.value)} 
                  required 
                />
              </div>

              {provider === 'twilio' ? (
                <>
                  <div>
                    <label className="text-sm text-muted-foreground mb-1 block">Account SID *</label>
                    <input 
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring" 
                      placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxx"
                      value={sid} 
                      onChange={e => setSid(e.target.value)} 
                      required 
                    />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground mb-1 block">Auth token *</label>
                    <input 
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring" 
                      type="password" 
                      placeholder="••••••••••••••••••••••••••••••••"
                      value={at} 
                      onChange={e => setAt(e.target.value)} 
                      required 
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Termination URI *</label>
                  <input 
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring" 
                    placeholder="sip:carrier.example.com"
                    value={uri} 
                    onChange={e => setUri(e.target.value)} 
                    required 
                  />
                </div>
              )}

              {formError && (
                <div className="p-3 rounded-md bg-red-500/10 border border-red-500/25 text-red-400 text-xs leading-relaxed flex items-start gap-2">
                  <span className="font-bold flex-shrink-0">Error:</span>
                  <span className="flex-1">{formError}</span>
                </div>
              )}

              <div className="flex justify-end gap-3 mt-6 pt-2">
                <button 
                  type="button" 
                  className="text-muted-foreground hover:text-foreground hover:bg-accent rounded-md px-3 py-2 text-sm" 
                  onClick={() => setShowAdd(false)}
                  disabled={addLoading}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="bg-foreground text-background hover:bg-foreground/90 rounded-md px-4 py-2 text-sm font-medium flex items-center gap-2" 
                  disabled={addLoading}
                >
                  {addLoading && <Loader2 size={16} className="animate-spin" />}
                  {addLoading ? 'Connecting...' : 'Connect number'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-6">
            <h3 className="text-lg font-medium mb-2">Disconnect phone line</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Are you sure you want to disconnect "{deleteTarget.phone_number}" ({deleteTarget.label})? Any inbound calls routed to this line will stop connecting.
            </p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setDeleteTarget(null)}
                className="text-muted-foreground hover:text-foreground hover:bg-accent rounded-md px-4 py-2 text-sm font-medium"
              >
                Cancel
              </button>
              <button 
                onClick={confirmDelete}
                className="bg-red-600 text-white hover:bg-red-700 rounded-md px-4 py-2 text-sm font-medium flex items-center gap-2"
              >
                Disconnect line
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
