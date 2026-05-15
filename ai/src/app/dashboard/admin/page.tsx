'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/dashboard/shared/ToastProvider';
import { Icon } from '@/components/dashboard/shared/Icon';
import { CustomSelect } from '@/components/dashboard/shared/CustomSelect';
import { EmptyState } from '@/components/dashboard/shared/EmptyState';
import { SkeletonRows } from '@/components/dashboard/shared/SkeletonRows';
import { ConfirmModal } from '@/components/dashboard/shared/ConfirmModal';
import { api } from '@/lib/api';
import { FEATURE_KEYS } from '@/lib/constants';

interface Client { id: number; name: string; email: string; is_admin: boolean; agent_count: number; }
interface Agent { agent_id: string; name: string; tags?: string[]; provider?: string; }
interface AssignedAgent { agent_id: string; agent_name: string; can_edit: boolean; allowed_features?: Record<string, boolean> | null; provider?: string; }

export default function AdminPage() {
  const { token, client: me } = useAuth();
  const { addToast } = useToast();
  const router = useRouter();
  const [tab, setTab] = useState('clients');
  const [clients, setClients] = useState<Client[]>([]);
  const [allAgents, setAllAgents] = useState<Agent[]>([]);
  const [clientAgentMap, setClientAgentMap] = useState<Record<number, AssignedAgent[]>>({});
  const [loading, setLoading] = useState(true);
  const [showCreateClient, setShowCreateClient] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [selectedClient, setSelectedClient] = useState<number | null>(null);
  const [selectedAgentToAssign, setSelectedAgentToAssign] = useState('');
  const [assignPerm, setAssignPerm] = useState('edit');
  const [deleteClientTarget, setDeleteClientTarget] = useState<Client | null>(null);
  const [deleteAgentTarget, setDeleteAgentTarget] = useState<Agent | null>(null);
  // Feature toggle: which agent's feature panel is expanded
  const [expandedFeatureAgent, setExpandedFeatureAgent] = useState<{ clientId: number; agentId: string } | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [cData, aData] = await Promise.all([
        api<{ clients: Client[] }>('/admin/clients', { token: token! }),
        api<{ agents: Agent[] }>('/agents/all', { token: token! }).catch(() => ({ agents: [] as Agent[] })),
      ]);
      setClients(cData.clients || []);
      setAllAgents(aData.agents || []);
      const map: Record<number, AssignedAgent[]> = {};
      for (const c of (cData.clients || [])) {
        try { const r = await api<{ agents: AssignedAgent[] }>(`/admin/clients/${c.id}/agents`, { token: token! }); map[c.id] = r.agents || []; }
        catch { map[c.id] = []; }
      }
      setClientAgentMap(map);
    } catch (err) { addToast(err instanceof Error ? err.message : 'Failed', 'error'); }
    finally { setLoading(false); }
  }, [token, addToast]);

  useEffect(() => {
    if (!me?.is_admin) { router.replace('/dashboard'); return; }
    if (token) loadData();
  }, [token, me, router, loadData]);

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api('/admin/clients', { token: token!, method: 'POST', body: { name: newName, email: newEmail, password: newPassword } });
      addToast('Client created', 'success');
      setShowCreateClient(false); setNewName(''); setNewEmail(''); setNewPassword('');
      loadData();
    } catch (err: unknown) {
      // Extract Zod validation issues if present
      const msg = err instanceof Error ? err.message : 'Failed';
      addToast(msg, 'error');
    }
  };

  const handleDeleteClient = async (id: number) => {
    try { await api(`/admin/clients/${id}`, { token: token!, method: 'DELETE' }); addToast('Deleted', 'success'); setDeleteClientTarget(null); loadData(); }
    catch (err) { addToast(err instanceof Error ? err.message : 'Failed', 'error'); }
  };

  const handleDeleteAgent = async (agentId: string) => {
    try { await api(`/agents/${agentId}`, { token: token!, method: 'DELETE' }); addToast('Agent deleted', 'success'); setDeleteAgentTarget(null); loadData(); }
    catch (err) { addToast(err instanceof Error ? err.message : 'Failed', 'error'); }
  };

  const handleAssignAgent = async (clientId: number) => {
    if (!selectedAgentToAssign) return;
    const agent = allAgents.find(a => a.agent_id === selectedAgentToAssign);
    try { await api(`/admin/clients/${clientId}/agents`, { token: token!, method: 'POST', body: { agent_id: selectedAgentToAssign, agent_name: agent?.name || 'Agent', can_edit: assignPerm === 'edit' ? 1 : 0, provider: agent?.provider || 'elevenlabs' } }); addToast('Assigned', 'success'); setSelectedAgentToAssign(''); loadData(); }
    catch (err) { addToast(err instanceof Error ? err.message : 'Failed', 'error'); }
  };

  const handleUnassign = async (clientId: number, agentId: string) => {
    try { await api(`/admin/clients/${clientId}/agents/${agentId}`, { token: token!, method: 'DELETE' }); addToast('Removed', 'success'); loadData(); }
    catch (err) { addToast(err instanceof Error ? err.message : 'Failed', 'error'); }
  };

  /** Toggle a single feature flag for a client's agent — matches old dashboard logic exactly */
  const handleToggleFeature = async (clientId: number, agentId: string, featureKey: string) => {
    const agents = clientAgentMap[clientId] || [];
    const ag = agents.find(a => a.agent_id === agentId);
    const current = ag?.allowed_features || {};
    const newFeatures: Record<string, boolean> = { ...current };
    if (newFeatures[featureKey] === false) {
      delete newFeatures[featureKey]; // removing = enabled
    } else {
      newFeatures[featureKey] = false; // explicitly disabled
    }
    const hasDisabled = Object.values(newFeatures).some(v => v === false);
    const finalFeatures = hasDisabled ? newFeatures : null;

    try {
      await api(`/admin/clients/${clientId}/agents/${agentId}`, {
        token: token!, method: 'PATCH',
        body: { allowed_features: finalFeatures },
      });
      // Update local state without full reload
      setClientAgentMap(prev => ({
        ...prev,
        [clientId]: prev[clientId].map(a =>
          a.agent_id === agentId ? { ...a, allowed_features: finalFeatures } : a
        ),
      }));
      const isNowEnabled = finalFeatures === null || finalFeatures[featureKey] !== false;
      addToast(`${featureKey}: ${isNowEnabled ? 'Enabled' : 'Disabled'}`, 'success');
    } catch (err) { addToast(err instanceof Error ? err.message : 'Failed', 'error'); }
  };

  /** Toggle can_edit permission */
  const handleTogglePermission = async (clientId: number, agentId: string, currentCanEdit: boolean) => {
    const newVal = currentCanEdit ? 0 : 1;
    try {
      await api(`/admin/clients/${clientId}/agents/${agentId}`, {
        token: token!, method: 'PATCH',
        body: { can_edit: newVal },
      });
      addToast(newVal ? 'Changed to Full Access' : 'Changed to View Only', 'success');
      loadData();
    } catch (err) { addToast(err instanceof Error ? err.message : 'Failed', 'error'); }
  };

  if (loading) return <SkeletonRows count={3} />;

  const getAvailable = (cId: number) => { const assigned = (clientAgentMap[cId] || []).map(a => a.agent_id); return allAgents.filter(a => !assigned.includes(a.agent_id)); };

  return (
    <div className="page-body" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
      <div className="layout-container" style={{ padding: '40px', maxWidth: '1200px', margin: '0 auto', width: '100%', flexShrink: 0, paddingBottom: '100px' }}>
        <div className="page-title-section" style={{ marginBottom: '32px', padding: '0' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>Admin Panel</h2>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Manage clients, platform permissions, and agent assignments</p>
        </div>

        <div className="config-panel" style={{ padding: '0', border: '1px solid var(--border-default)', background: 'var(--bg-raised)', borderRadius: '12px', width: '100%' }}>
          <div className="analysis-tabs" style={{ padding: '0 24px', borderBottom: '1px solid var(--border-default)', marginBottom: '24px' }}>
            <div className={`analysis-tab ${tab === 'clients' ? 'active' : ''}`} onClick={() => setTab('clients')}><Icon name="users" size={14} style={{ display: 'inline', marginRight: '6px' }} /> Clients ({clients.length})</div>
            <div className={`analysis-tab ${tab === 'agents' ? 'active' : ''}`} onClick={() => setTab('agents')}><Icon name="bot" size={14} style={{ display: 'inline', marginRight: '6px' }} /> Agents ({allAgents.length})</div>
          </div>

          <div style={{ padding: '0 24px 24px' }}>
            {tab === 'clients' && (<>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div style={{ fontSize: '16px', fontWeight: 500, color: 'var(--text-primary)' }}>Client Management</div>
                <button className="btn-primary" onClick={() => setShowCreateClient(!showCreateClient)}>
                  <Icon name="user-plus" size={13} /> {showCreateClient ? 'Cancel' : 'New Client'}
                </button>
              </div>

              {showCreateClient && (
                <div className="admin-section" style={{ marginBottom: '24px', padding: '20px', background: 'var(--bg-overlay)', border: '1px solid var(--border-default)', borderRadius: '8px' }}>
                  <div className="admin-section-title" style={{ marginBottom: '16px', fontSize: '14px', fontWeight: 600 }}>Create New Client</div>
                  <form onSubmit={handleCreateClient} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'flex', gap: '16px' }}>
                      <div className="form-group" style={{ flex: 1 }}><label className="form-label">Name</label><input className="form-input" value={newName} onChange={e => setNewName(e.target.value)} required /></div>
                      <div className="form-group" style={{ flex: 1 }}><label className="form-label">Email</label><input className="form-input" type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} required /></div>
                    </div>
                    <div className="form-group" style={{ maxWidth: '50%' }}>
                      <label className="form-label">Password</label>
                      <input className="form-input" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={12} />
                      <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '6px', lineHeight: '1.5' }}>
                        Min 12 characters • Uppercase • Lowercase • Number • Symbol
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '8px' }}>
                      <button type="button" className="btn-ghost" onClick={() => setShowCreateClient(false)}>Cancel</button>
                      <button type="submit" className="btn-primary">Create Client</button>
                    </div>
                  </form>
                </div>
              )}

              <div style={{ borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-default)' }}>
                <table className="data-table" style={{ margin: 0 }}>
                  <thead style={{ background: 'var(--bg-overlay)' }}>
                    <tr>
                      <th style={{ padding: '12px 16px', fontWeight: 500, color: 'var(--text-secondary)' }}>Name</th>
                      <th style={{ padding: '12px 16px', fontWeight: 500, color: 'var(--text-secondary)' }}>Email</th>
                      <th style={{ padding: '12px 16px', fontWeight: 500, color: 'var(--text-secondary)' }}>Role</th>
                      <th style={{ padding: '12px 16px', fontWeight: 500, color: 'var(--text-secondary)' }}>Agents</th>
                      <th style={{ padding: '12px 16px', fontWeight: 500, color: 'var(--text-secondary)', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clients.length === 0 ? (
                      <tr><td colSpan={5} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-tertiary)' }}>No clients found.</td></tr>
                    ) : clients.map(c => (
                    <React.Fragment key={c.id}>
                      <tr onClick={() => setSelectedClient(selectedClient === c.id ? null : c.id)} style={{ cursor: 'pointer', transition: 'background 0.2s', background: selectedClient === c.id ? 'var(--bg-overlay)' : 'transparent' }} className="hover:bg-zinc-800/30">
                        <td style={{ padding: '16px' }}><div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{c.name}</div></td>
                        <td className="phone-cell" style={{ padding: '16px', color: 'var(--text-secondary)' }}>{c.email}</td>
                        <td style={{ padding: '16px' }}>{c.is_admin ? <span className="badge sip" style={{ background: 'rgba(124,58,237,0.15)', color: '#a78bfa' }}>Admin</span> : <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', background: 'var(--bg-input)', padding: '4px 8px', borderRadius: '4px' }}>Client</span>}</td>
                        <td style={{ padding: '16px', fontSize: '13px', color: 'var(--text-secondary)' }}>{c.agent_count} assigned</td>
                        <td style={{ padding: '16px' }}>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'flex-end' }}>
                            <Icon name={selectedClient === c.id ? 'chevron-down' : 'chevron-right'} size={16} style={{ color: 'var(--text-tertiary)', transition: 'transform 0.2s' }} />
                            {!c.is_admin && (
                              <div className="btn-icon danger" onClick={e => { e.stopPropagation(); setDeleteClientTarget(c); }} title="Delete Client">
                                <Icon name="trash-2" size={14} />
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                      {selectedClient === c.id && (
                        <tr><td colSpan={5} style={{ padding: 0 }}>
                          <div style={{ padding: '24px', background: 'var(--bg-input)', borderTop: '1px solid var(--border-default)', borderBottom: '1px solid var(--border-default)' }}>
                            
                            {/* ——— Assigned Agents List ——— */}
                            {(clientAgentMap[c.id] || []).length > 0 && (
                              <div style={{ marginBottom: '24px' }}>
                                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Assigned Agents</div>
                                <div style={{ borderRadius: '8px', overflow: 'auto', border: '1px solid var(--border-default)' }}>
                                  <table className="data-table" style={{ margin: 0, width: '100%', borderCollapse: 'collapse' }}>
                                    <thead style={{ background: 'var(--bg-overlay)' }}>
                                      <tr>
                                        <th style={{ padding: '12px 16px', fontWeight: 500, color: 'var(--text-secondary)', textAlign: 'left' }}>Agent Name</th>
                                        <th style={{ padding: '12px 16px', fontWeight: 500, color: 'var(--text-secondary)', textAlign: 'left' }}>Agent ID</th>
                                        <th style={{ padding: '12px 16px', fontWeight: 500, color: 'var(--text-secondary)', textAlign: 'left' }}>Provider</th>
                                        <th style={{ padding: '12px 16px', fontWeight: 500, color: 'var(--text-secondary)', textAlign: 'left' }}>Permissions</th>
                                        <th style={{ padding: '12px 16px', fontWeight: 500, color: 'var(--text-secondary)', textAlign: 'right', whiteSpace: 'nowrap' }}>Actions</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {(clientAgentMap[c.id] || []).map(ag => {
                                        const isFeatureExpanded = expandedFeatureAgent?.clientId === c.id && expandedFeatureAgent?.agentId === ag.agent_id;
                                        const disabledCount = ag.allowed_features ? Object.values(ag.allowed_features).filter(v => v === false).length : 0;
                                        return (
                                          <React.Fragment key={ag.agent_id}>
                                            <tr className="hover:bg-zinc-800/30" style={{ borderTop: '1px solid var(--border-default)', transition: 'background 0.2s' }}>
                                              <td style={{ padding: '16px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                                  <span className="status-dot active" style={{ width: 8, height: 8, flexShrink: 0 }} />
                                                  <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{ag.agent_name}</span>
                                                  {disabledCount > 0 && (
                                                    <span style={{
                                                      display: 'inline-flex', alignItems: 'center', gap: '3px',
                                                      fontSize: '10px', fontWeight: 600, padding: '2px 6px',
                                                      borderRadius: '4px', background: 'rgba(239,68,68,0.1)', color: '#ef4444',
                                                      whiteSpace: 'nowrap', flexShrink: 0,
                                                    }}>
                                                      <Icon name="eye-off" size={10} />
                                                      {disabledCount} hidden
                                                    </span>
                                                  )}
                                                </div>
                                              </td>
                                              <td style={{ padding: '16px', fontSize: '12px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {ag.agent_id.slice(0, 12)}...
                                              </td>
                                              <td style={{ padding: '16px' }}>
                                                <span className={`provider-badge provider-${ag.provider || 'elevenlabs'}`}>{ag.provider === 'vapi' ? 'Vapi' : 'ElevenLabs'}</span>
                                              </td>
                                              <td style={{ padding: '16px' }}>
                                                <span style={{
                                                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                                                  fontSize: '11px', fontWeight: 600, padding: '4px 8px',
                                                  borderRadius: '6px', textTransform: 'uppercase', letterSpacing: '0.03em',
                                                  background: ag.can_edit ? 'rgba(74,222,128,0.1)' : 'rgba(251,191,36,0.1)',
                                                  color: ag.can_edit ? 'var(--green)' : '#fbbf24',
                                                }}>
                                                  <Icon name={ag.can_edit ? 'edit-3' : 'eye'} size={12} />
                                                  {ag.can_edit ? 'Full Access' : 'View Only'}
                                                </span>
                                              </td>
                                              <td style={{ padding: '16px', whiteSpace: 'nowrap' }}>
                                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                                                  <button
                                                    className={`btn-icon ${isFeatureExpanded ? 'active' : ''}`}
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      setExpandedFeatureAgent(isFeatureExpanded ? null : { clientId: c.id, agentId: ag.agent_id });
                                                    }}
                                                    title="Manage visible features"
                                                  >
                                                    <Icon name="settings" size={14} />
                                                  </button>
                                                  <button
                                                    className="btn-icon"
                                                    onClick={(e) => { e.stopPropagation(); handleTogglePermission(c.id, ag.agent_id, ag.can_edit); }}
                                                    title={ag.can_edit ? 'Switch to View Only' : 'Switch to Full Access'}
                                                  >
                                                    <Icon name={ag.can_edit ? 'lock' : 'unlock'} size={14} />
                                                  </button>
                                                  <button
                                                    className="btn-icon danger"
                                                    onClick={(e) => { e.stopPropagation(); handleUnassign(c.id, ag.agent_id); }}
                                                    title="Remove agent"
                                                  >
                                                    <Icon name="user-minus" size={14} />
                                                  </button>
                                                </div>
                                              </td>
                                            </tr>
                                            
                                            {/* Feature Toggles Panel */}
                                            {isFeatureExpanded && (
                                              <tr>
                                                <td colSpan={5} style={{ padding: 0 }}>
                                                  <div style={{ padding: '20px 24px', background: 'var(--bg-base)', borderTop: '1px solid var(--border-default)' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                                      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                        Client Dashboard Features
                                                      </div>
                                                      <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                                                        Toggle what the client can see and interact with
                                                      </div>
                                                    </div>
                                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '8px' }}>
                                                      {FEATURE_KEYS.map(f => {
                                                        const isEnabled = !ag.allowed_features || ag.allowed_features[f.key] !== false;
                                                        return (
                                                          <div
                                                            key={f.key}
                                                            onClick={() => handleToggleFeature(c.id, ag.agent_id, f.key)}
                                                            style={{
                                                              display: 'flex', alignItems: 'center', gap: '10px',
                                                              padding: '8px 12px', borderRadius: '8px', cursor: 'pointer',
                                                              border: `1px solid ${isEnabled ? 'var(--border-default)' : 'rgba(239,68,68,0.2)'}`,
                                                              background: isEnabled ? 'var(--bg-overlay)' : 'rgba(239,68,68,0.04)',
                                                              transition: 'all 0.15s ease',
                                                            }}
                                                            className="hover:border-zinc-500"
                                                          >
                                                            {/* Toggle Switch */}
                                                            <div style={{
                                                              width: '32px', height: '18px', borderRadius: '10px',
                                                              background: isEnabled ? 'var(--brand-accent)' : 'var(--border-subtle)',
                                                              position: 'relative', transition: 'background 0.2s ease',
                                                              flexShrink: 0,
                                                            }}>
                                                              <div style={{
                                                                width: '14px', height: '14px', borderRadius: '50%',
                                                                background: '#fff', position: 'absolute', top: '2px',
                                                                left: isEnabled ? '16px' : '2px',
                                                                transition: 'left 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                                                boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
                                                              }} />
                                                            </div>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                                                              <Icon name={f.icon} size={14} style={{ color: isEnabled ? 'var(--text-secondary)' : '#ef4444', opacity: isEnabled ? 1 : 0.6 }} />
                                                              <span style={{
                                                                fontSize: '13px', fontWeight: 500,
                                                                color: isEnabled ? 'var(--text-primary)' : '#ef4444',
                                                                textDecoration: isEnabled ? 'none' : 'line-through',
                                                              }}>
                                                                {f.label}
                                                              </span>
                                                            </div>
                                                          </div>
                                                        );
                                                      })}
                                                    </div>
                                                  </div>
                                                </td>
                                              </tr>
                                            )}
                                          </React.Fragment>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}

                            {/* ——— Add Agent ——— */}
                            <div style={{ padding: '16px', background: 'var(--bg-overlay)', borderRadius: '8px', border: '1px solid var(--border-default)' }}>
                              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px' }}>Assign New Agent</div>
                              {getAvailable(c.id).length === 0 ? (
                                <div style={{ fontSize: '13px', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>All available agents have been assigned to this client.</div>
                              ) : (
                                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap', position: 'relative', zIndex: 50 }}>
                                  <div style={{ flex: '1 1 200px', position: 'relative', zIndex: 51 }}>
                                    <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>Agent</label>
                                    <CustomSelect value={selectedAgentToAssign} onChange={e => setSelectedAgentToAssign(e.target.value)} options={[{ value: '', label: 'Select an agent...' }, ...getAvailable(c.id).map(a => ({ value: a.agent_id, label: `${a.name} (${a.agent_id.slice(0, 12)}...)` }))]} />
                                  </div>
                                  <div style={{ flex: '0 0 160px', position: 'relative', zIndex: 50 }}>
                                    <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>Permissions</label>
                                    <CustomSelect value={assignPerm} onChange={e => setAssignPerm(e.target.value)} options={[{ value: 'edit', label: 'Full Access' }, { value: 'view', label: 'View Only' }]} />
                                  </div>
                                  <button className="btn-primary" style={{ flex: '0 0 auto', whiteSpace: 'nowrap', height: '40px', padding: '0 20px' }} onClick={() => handleAssignAgent(c.id)} disabled={!selectedAgentToAssign}>
                                    <Icon name="plus" size={14} /> Assign Agent
                                  </button>
                                </div>
                              )}
                            </div>

                          </div>
                        </td></tr>
                      )}
                    </React.Fragment>
                  ))}
                  </tbody>
                </table>
              </div>
            </>)}

            {tab === 'agents' && (<>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div style={{ fontSize: '16px', fontWeight: 500, color: 'var(--text-primary)' }}>System Agents</div>
              </div>
              
              {allAgents.length === 0 ? <EmptyState icon="bot" title="No Agents" description="Create an agent from the Agents page first." /> : (
                <div style={{ borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-default)' }}>
                  <table className="data-table" style={{ margin: 0, width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ background: 'var(--bg-overlay)' }}>
                      <tr>
                        <th style={{ padding: '12px 16px', fontWeight: 500, color: 'var(--text-secondary)' }}>Name</th>
                        <th style={{ padding: '12px 16px', fontWeight: 500, color: 'var(--text-secondary)' }}>Agent ID</th>
                        <th style={{ padding: '12px 16px', fontWeight: 500, color: 'var(--text-secondary)' }}>Provider</th>
                        <th style={{ padding: '12px 16px', fontWeight: 500, color: 'var(--text-secondary)', textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allAgents.map((a) => (
                        <tr key={a.agent_id} className="hover:bg-zinc-800/30" style={{ transition: 'background 0.2s' }}>
                          <td style={{ padding: '16px' }}>
                            <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{a.name}</div>
                          </td>
                          <td style={{ padding: '16px', fontSize: '13px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                            {a.agent_id}
                          </td>
                          <td style={{ padding: '16px' }}>
                            <span className={`provider-badge provider-${a.provider || 'elevenlabs'}`}>{a.provider === 'vapi' ? 'Vapi' : 'ElevenLabs'}</span>
                          </td>
                          <td style={{ padding: '16px' }}>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'flex-end' }}>
                              <button
                                className="btn-icon"
                                onClick={() => router.push(`/dashboard/agents/${a.agent_id}`)}
                                title="Configure Agent"
                              >
                                <Icon name="settings" size={14} />
                              </button>
                              <button
                                className="btn-icon danger"
                                onClick={() => setDeleteAgentTarget(a)}
                                title="Delete Agent"
                              >
                                <Icon name="trash-2" size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>)}
          </div>
        </div>

        {deleteClientTarget && <ConfirmModal title="Delete Client" message={`Delete "${deleteClientTarget.name}" and remove all assignments?`} confirmLabel="Delete Client" onConfirm={() => handleDeleteClient(deleteClientTarget.id)} onCancel={() => setDeleteClientTarget(null)} danger />}
        {deleteAgentTarget && <ConfirmModal title="Delete Agent" message={`Delete "${deleteAgentTarget.name}"? This will remove it from ${deleteAgentTarget.provider === 'vapi' ? 'Vapi' : 'ElevenLabs'}.`} confirmLabel="Delete Agent" requireType={deleteAgentTarget.name} onConfirm={() => handleDeleteAgent(deleteAgentTarget.agent_id)} onCancel={() => setDeleteAgentTarget(null)} danger />}
      </div>
    </div>
  );
}
