'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/dashboard/shared/ToastProvider';
import { Icon } from '@/components/dashboard/shared/Icon';
import { CustomSelect } from '@/components/dashboard/shared/CustomSelect';
import { EmptyState } from '@/components/dashboard/shared/EmptyState';
import { ConfirmModal } from '@/components/dashboard/shared/ConfirmModal';
import { SkeletonRows } from '@/components/dashboard/shared/SkeletonRows';
import { Loader2 } from 'lucide-react';
import { api } from '@/lib/api';

interface PhoneNumber { id: string; label: string; phone_number: string; provider: string; assigned_agent_id?: string; }
interface Agent { agent_id: string; name: string; }

export default function PhoneNumbersPage() {
  const { token } = useAuth();
  const { addToast } = useToast();
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PhoneNumber | null>(null);
  const [provider, setProvider] = useState('twilio');
  const [addLoading, setAddLoading] = useState(false);
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
    } catch (err) { 
      addToast(err instanceof Error ? err.message : 'Failed to connect phone number', 'error'); 
    } finally { 
      setAddLoading(false); 
    }
  };

  if (loading) return <SkeletonRows count={4} />;

  return (
    <div className="dashboard-content">
      <div className="page-title-section mb-6">
        <div>
          <h1 className="page-title">Phone Numbers</h1>
          <p className="page-subtitle">Connect and configure inbound and outbound telephony lines</p>
        </div>
        <div>
          <button className="btn-primary flex items-center gap-2" onClick={() => setShowAdd(true)}>
            <Icon name="plus" size={14} /> Connect Number
          </button>
        </div>
      </div>

      {phoneNumbers.length === 0 ? (
        <EmptyState 
          icon="phone" 
          title="No phone numbers connected" 
          description="Connect a Twilio number or SIP trunk to make and receive calls with your AI agents." 
          action="Connect Number" 
          onAction={() => setShowAdd(true)} 
        />
      ) : (
        <div className="table-responsive bg-raised border border-default rounded-xl overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th>Label</th>
                <th>Phone Number</th>
                <th>Provider</th>
                <th>Assigned Agent</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {phoneNumbers.map(p => (
                <tr key={p.id}>
                  <td className="font-medium text-white">{p.label}</td>
                  <td className="phone-cell font-mono text-xs text-gray-200">{p.phone_number}</td>
                  <td>
                    <span className={`badge ${p.provider}`}>
                      {p.provider === 'twilio' ? 'Twilio' : 'SIP Trunk'}
                    </span>
                  </td>
                  <td style={{ minWidth: '180px' }}>
                    <CustomSelect 
                      small 
                      value={p.assigned_agent_id || ''} 
                      onChange={e => handleAssign(p.id, e.target.value)} 
                      options={[
                        { value: '', label: 'Unassigned' }, 
                        ...agents.map(a => ({ value: a.agent_id, label: a.name }))
                      ]} 
                    />
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button 
                      className="btn-icon danger cursor-pointer inline-flex items-center justify-center p-1.5 rounded-md hover:bg-red-500/20 text-red-400 transition-colors" 
                      onClick={() => setDeleteTarget(p)}
                      title="Disconnect Line"
                    >
                      <Icon name="trash-2" size={14} />
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
        <div className="modal-overlay" onClick={() => !addLoading && setShowAdd(false)}>
          <div className="modal-container" onClick={e => e.stopPropagation()} style={{ maxWidth: '460px' }}>
            <div className="modal-header">
              <Icon name="phone" size={16} />
              <span>Connect Phone Number</span>
            </div>
            
            <div className="provider-toggle my-4">
              <div 
                className={`provider-tab ${provider === 'twilio' ? 'active' : ''}`} 
                onClick={() => setProvider('twilio')}
              >
                Twilio
              </div>
              <div 
                className={`provider-tab ${provider === 'sip' ? 'active' : ''}`} 
                onClick={() => setProvider('sip')}
              >
                SIP Trunk
              </div>
            </div>

            <form onSubmit={handleAdd}>
              <div className="modal-body space-y-4">
                <div className="form-group">
                  <label className="form-label text-xs text-gray-400 mb-1 block">Label *</label>
                  <input 
                    className="form-input w-full" 
                    placeholder="e.g. US Support Line"
                    value={label} 
                    onChange={e => setLabel(e.target.value)} 
                    required 
                  />
                </div>
                <div className="form-group">
                  <label className="form-label text-xs text-gray-400 mb-1 block">Phone Number (E.164) *</label>
                  <input 
                    className="form-input w-full font-mono text-sm" 
                    placeholder="+1234567890" 
                    value={pn} 
                    onChange={e => setPn(e.target.value)} 
                    required 
                  />
                </div>

                {provider === 'twilio' ? (
                  <>
                    <div className="form-group">
                      <label className="form-label text-xs text-gray-400 mb-1 block">Account SID *</label>
                      <input 
                        className="form-input w-full font-mono text-xs" 
                        placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxx"
                        value={sid} 
                        onChange={e => setSid(e.target.value)} 
                        required 
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label text-xs text-gray-400 mb-1 block">Auth Token *</label>
                      <input 
                        className="form-input w-full font-mono text-xs" 
                        type="password" 
                        placeholder="••••••••••••••••••••••••••••••••"
                        value={at} 
                        onChange={e => setAt(e.target.value)} 
                        required 
                      />
                    </div>
                  </>
                ) : (
                  <div className="form-group">
                    <label className="form-label text-xs text-gray-400 mb-1 block">Termination URI *</label>
                    <input 
                      className="form-input w-full font-mono text-xs" 
                      placeholder="sip:carrier.example.com"
                      value={uri} 
                      onChange={e => setUri(e.target.value)} 
                      required 
                    />
                  </div>
                )}
              </div>

              <div className="modal-footer flex justify-end gap-3 mt-6">
                <button 
                  type="button" 
                  className="btn-ghost" 
                  onClick={() => setShowAdd(false)}
                  disabled={addLoading}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn-primary flex items-center gap-2" 
                  disabled={addLoading} 
                  style={{ marginLeft: 0 }}
                >
                  {addLoading && <Loader2 size={14} className="animate-spin" />}
                  {addLoading ? 'Connecting...' : 'Connect Number'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <ConfirmModal
          title="Disconnect Phone Line"
          message={`Are you sure you want to disconnect "${deleteTarget.phone_number}" (${deleteTarget.label})? Any inbound calls routed to this line will stop connecting.`}
          confirmLabel="Disconnect Line"
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
          danger={true}
        />
      )}
    </div>
  );
}
