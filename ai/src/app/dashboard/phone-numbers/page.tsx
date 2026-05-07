'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/dashboard/shared/ToastProvider';
import { Icon } from '@/components/dashboard/shared/Icon';
import { CustomSelect } from '@/components/dashboard/shared/CustomSelect';
import { EmptyState } from '@/components/dashboard/shared/EmptyState';
import { SkeletonRows } from '@/components/dashboard/shared/SkeletonRows';
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
    } catch (err) { addToast(err instanceof Error ? err.message : 'Failed', 'error'); }
    finally { setLoading(false); }
  }, [token, addToast]);

  useEffect(() => { if (token) loadData(); }, [token, loadData]);

  const handleAssign = async (id: string, agentId: string) => {
    try {
      await api(`/phone-numbers/${id}/assign`, { token: token!, method: 'POST', body: { agent_id: agentId || null } });
      setPhoneNumbers(prev => prev.map(p => p.id === id ? { ...p, assigned_agent_id: agentId || undefined } : p));
      addToast(agentId ? 'Assigned' : 'Unassigned', 'success');
    } catch (err) { addToast(err instanceof Error ? err.message : 'Failed', 'error'); }
  };

  const handleDelete = async (id: string) => {
    try {
      await api(`/phone-numbers/${id}`, { token: token!, method: 'DELETE' });
      setPhoneNumbers(prev => prev.filter(p => p.id !== id));
      addToast('Removed', 'success');
    } catch (err) { addToast(err instanceof Error ? err.message : 'Failed', 'error'); }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault(); setAddLoading(true);
    try {
      const ep = provider === 'twilio' ? '/phone-numbers/twilio' : '/phone-numbers/sip';
      const body = provider === 'twilio' ? { label, phone_number: pn, account_sid: sid, auth_token: at } : { label, phone_number: pn, termination_uri: uri };
      const r = await api<{ phoneNumber: PhoneNumber }>(ep, { token: token!, method: 'POST', body });
      addToast('Connected', 'success');
      setPhoneNumbers(prev => [...prev, r.phoneNumber]);
      setShowAdd(false); setLabel(''); setPn(''); setSid(''); setAt(''); setUri('');
    } catch (err) { addToast(err instanceof Error ? err.message : 'Failed', 'error'); }
    finally { setAddLoading(false); }
  };

  if (loading) return <SkeletonRows count={4} />;

  return (
    <>
      <div className="page-title-section"><h2>Phone Numbers</h2><p>Connect and manage your telephony numbers</p></div>
      <div style={{ padding: '0 40px 16px', display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn-primary" onClick={() => setShowAdd(true)} style={{ marginLeft: 0 }}><Icon name="plus" size={14} /> Add Number</button>
      </div>
      {phoneNumbers.length === 0 ? (
        <EmptyState icon="phone" title="No phone numbers" description="Connect a Twilio or SIP number." action="Add Number" onAction={() => setShowAdd(true)} />
      ) : (
        <div style={{ padding: '0 40px' }}>
          <table className="data-table"><thead><tr><th>Label</th><th>Phone Number</th><th>Provider</th><th>Assigned To</th><th>Actions</th></tr></thead>
            <tbody>{phoneNumbers.map(p => (
              <tr key={p.id}><td>{p.label}</td><td className="phone-cell">{p.phone_number}</td>
                <td><span className={`badge ${p.provider}`}>{p.provider === 'twilio' ? 'Twilio' : 'SIP'}</span></td>
                <td><CustomSelect small value={p.assigned_agent_id || ''} onChange={e => handleAssign(p.id, e.target.value)} options={[{ value: '', label: 'Unassigned' }, ...agents.map(a => ({ value: a.agent_id, label: a.name }))]} /></td>
                <td><div className="btn-icon danger" onClick={() => handleDelete(p.id)}><Icon name="trash-2" size={14} /></div></td>
              </tr>
            ))}</tbody></table>
        </div>
      )}
      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Add Phone Number</div>
            <div className="provider-toggle">
              <div className={`provider-tab ${provider === 'twilio' ? 'active' : ''}`} onClick={() => setProvider('twilio')}>Twilio</div>
              <div className={`provider-tab ${provider === 'sip' ? 'active' : ''}`} onClick={() => setProvider('sip')}>SIP Trunk</div>
            </div>
            <form onSubmit={handleAdd}>
              <div className="form-group"><label className="form-label">Label</label><input className="form-input" value={label} onChange={e => setLabel(e.target.value)} required /></div>
              <div className="form-group"><label className="form-label">Phone Number</label><input className="form-input" value={pn} onChange={e => setPn(e.target.value)} required /></div>
              {provider === 'twilio' ? (<><div className="form-group"><label className="form-label">Account SID</label><input className="form-input" value={sid} onChange={e => setSid(e.target.value)} required /></div><div className="form-group"><label className="form-label">Auth Token</label><input className="form-input" type="password" value={at} onChange={e => setAt(e.target.value)} required /></div></>) : (<div className="form-group"><label className="form-label">Termination URI</label><input className="form-input" value={uri} onChange={e => setUri(e.target.value)} required /></div>)}
              <div className="modal-actions"><button type="button" className="btn-ghost" onClick={() => setShowAdd(false)}>Cancel</button><button type="submit" className="btn-primary" disabled={addLoading} style={{ marginLeft: 0 }}>{addLoading ? 'Connecting...' : 'Connect'}</button></div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
