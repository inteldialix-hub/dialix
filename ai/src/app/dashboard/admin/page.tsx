'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/dashboard/shared/ToastProvider';
import { CustomSelect } from '@/components/dashboard/shared/CustomSelect';
import { EmptyState } from '@/components/dashboard/shared/EmptyState';
import { SkeletonRows } from '@/components/dashboard/shared/SkeletonRows';
import { ConfirmModal } from '@/components/dashboard/shared/ConfirmModal';
import { api } from '@/lib/api';
import { FEATURE_KEYS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { useTopBar } from '@/components/dashboard/TopBarContext';
import { Users, Bot, UserPlus, ChevronDown, ChevronRight, Trash2, Settings, Lock, Unlock, UserMinus, EyeOff, Edit3, Eye, Check, Plus } from 'lucide-react';

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
  const [expandedFeatureAgent, setExpandedFeatureAgent] = useState<{ clientId: number; agentId: string } | null>(null);
  const { setTopBar } = useTopBar();

  useEffect(() => {
    setTopBar({
      title: 'Admin panel',
    });
  }, [setTopBar]);

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

  const handleToggleFeature = async (clientId: number, agentId: string, featureKey: string) => {
    const agents = clientAgentMap[clientId] || [];
    const ag = agents.find(a => a.agent_id === agentId);
    const current = ag?.allowed_features || {};
    const newFeatures: Record<string, boolean> = { ...current };
    if (newFeatures[featureKey] === false) {
      delete newFeatures[featureKey];
    } else {
      newFeatures[featureKey] = false;
    }
    const hasDisabled = Object.values(newFeatures).some(v => v === false);
    const finalFeatures = hasDisabled ? newFeatures : null;

    try {
      await api(`/admin/clients/${clientId}/agents/${agentId}`, {
        token: token!, method: 'PATCH',
        body: { allowed_features: finalFeatures },
      });
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

  if (loading) return (
    <div className="max-w-7xl mx-auto px-6 py-6">
      <SkeletonRows count={3} />
    </div>
  );

  const getAvailable = (cId: number) => { const assigned = (clientAgentMap[cId] || []).map(a => a.agent_id); return allAgents.filter(a => !assigned.includes(a.agent_id)); };

  const tabs = [
    { id: 'clients', label: `Clients (${clients.length})` },
    { id: 'agents', label: `Agents (${allAgents.length})` },
  ];

  return (
    <div className="max-w-7xl mx-auto px-6 py-6">
      <div className="border-b border-border mb-6">
        <nav className="flex gap-6">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={cn(
                "pb-3 text-sm font-medium border-b-2 -mb-px transition-colors",
                tab === t.id ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
              )}>{t.label}</button>
          ))}
        </nav>
      </div>

      <div className="space-y-6">
        {tab === 'clients' && (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-foreground">Client management</h2>
              <button 
                className="bg-foreground text-background hover:bg-foreground/90 rounded-md px-4 py-2 text-sm font-medium flex items-center gap-2"
                onClick={() => setShowCreateClient(!showCreateClient)}
              >
                <UserPlus className="size-4" />
                {showCreateClient ? 'Cancel' : 'New client'}
              </button>
            </div>

            {showCreateClient && (
              <div className="rounded-lg border border-border bg-card p-6">
                <h3 className="text-sm font-medium text-foreground mb-4">Create new client</h3>
                <form onSubmit={handleCreateClient} className="space-y-4">
                  <div className="flex gap-4">
                    <div className="flex-1 space-y-1">
                      <label className="text-sm text-muted-foreground">Name</label>
                      <input className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" value={newName} onChange={e => setNewName(e.target.value)} required />
                    </div>
                    <div className="flex-1 space-y-1">
                      <label className="text-sm text-muted-foreground">Email</label>
                      <input className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} required />
                    </div>
                  </div>
                  <div className="w-1/2 space-y-1">
                    <label className="text-sm text-muted-foreground">Password</label>
                    <input className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={12} />
                    <p className="text-xs text-muted-foreground mt-1">Min 12 characters • Uppercase • Lowercase • Number • Symbol</p>
                  </div>
                  <div className="flex justify-end gap-3 pt-2">
                    <button type="button" className="rounded-md px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted/50" onClick={() => setShowCreateClient(false)}>Cancel</button>
                    <button type="submit" className="bg-foreground text-background hover:bg-foreground/90 rounded-md px-4 py-2 text-sm font-medium">Create client</button>
                  </div>
                </form>
              </div>
            )}

            <div className="rounded-lg border border-border bg-card overflow-hidden">
              {clients.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">No clients found.</div>
              ) : (
                <div className="divide-y divide-border">
                  <div className="grid grid-cols-[2fr_2fr_1fr_1fr_auto] gap-4 p-4 text-sm font-medium text-muted-foreground bg-muted/20">
                    <div>Name</div>
                    <div>Email</div>
                    <div>Role</div>
                    <div>Agents</div>
                    <div className="text-right w-16">Actions</div>
                  </div>
                  {clients.map(c => (
                    <div key={c.id} className="divide-y divide-border">
                      <div 
                        className={cn("grid grid-cols-[2fr_2fr_1fr_1fr_auto] gap-4 p-4 items-center text-sm cursor-pointer hover:bg-muted/30 transition-colors", selectedClient === c.id && "bg-muted/20")}
                        onClick={() => setSelectedClient(selectedClient === c.id ? null : c.id)}
                      >
                        <div className="font-medium text-foreground">{c.name}</div>
                        <div className="text-muted-foreground truncate">{c.email}</div>
                        <div>
                          {c.is_admin ? (
                            <span className="rounded-full bg-blue-500/10 text-blue-500 px-2 py-0.5 text-xs font-medium">Admin</span>
                          ) : (
                            <span className="rounded-full bg-muted text-muted-foreground px-2 py-0.5 text-xs font-medium">Client</span>
                          )}
                        </div>
                        <div className="text-muted-foreground">{c.agent_count} assigned</div>
                        <div className="flex items-center justify-end gap-2 w-16">
                          <ChevronRight className={cn("size-4 text-muted-foreground transition-transform", selectedClient === c.id && "rotate-90")} />
                          {!c.is_admin && (
                            <button 
                              className="text-muted-foreground hover:text-red-400 p-1 rounded transition-colors"
                              onClick={e => { e.stopPropagation(); setDeleteClientTarget(c); }}
                              title="Delete Client"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          )}
                        </div>
                      </div>
                      
                      {selectedClient === c.id && (
                        <div className="bg-muted/10 p-6 border-l-2 border-l-foreground/30">
                          {(clientAgentMap[c.id] || []).length > 0 && (
                            <div className="mb-6">
                              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Assigned agents</h4>
                              <div className="rounded-lg border border-border bg-card overflow-hidden">
                                <div className="divide-y divide-border">
                                  <div className="grid grid-cols-[2fr_2fr_1fr_1fr_auto] gap-4 p-3 text-xs font-medium text-muted-foreground bg-muted/20">
                                    <div>Agent name</div>
                                    <div>Agent ID</div>
                                    <div>Provider</div>
                                    <div>Permissions</div>
                                    <div className="text-right">Actions</div>
                                  </div>
                                  {(clientAgentMap[c.id] || []).map(ag => {
                                    const isFeatureExpanded = expandedFeatureAgent?.clientId === c.id && expandedFeatureAgent?.agentId === ag.agent_id;
                                    const disabledCount = ag.allowed_features ? Object.values(ag.allowed_features).filter(v => v === false).length : 0;
                                    return (
                                      <div key={ag.agent_id} className="divide-y divide-border">
                                        <div className="grid grid-cols-[2fr_2fr_1fr_1fr_auto] gap-4 p-3 items-center text-sm hover:bg-muted/30 transition-colors">
                                          <div className="flex items-center gap-2">
                                            <div className="size-2 rounded-full bg-emerald-500" />
                                            <span className="font-medium text-foreground">{ag.agent_name}</span>
                                            {disabledCount > 0 && (
                                              <span className="flex items-center gap-1 rounded-full bg-red-500/10 text-red-400 px-2 py-0.5 text-[10px] font-semibold">
                                                <EyeOff className="size-3" />
                                                {disabledCount} hidden
                                              </span>
                                            )}
                                          </div>
                                          <div className="font-mono text-xs text-muted-foreground truncate" title={ag.agent_id}>
                                            {ag.agent_id.slice(0, 12)}...
                                          </div>
                                          <div>
                                            <span className="rounded-full bg-muted text-muted-foreground px-2 py-0.5 text-xs font-medium">
                                              {ag.provider === 'vapi' ? 'Vapi' : 'ElevenLabs'}
                                            </span>
                                          </div>
                                          <div>
                                            <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", ag.can_edit ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500")}>
                                              {ag.can_edit ? <Edit3 className="size-3" /> : <Eye className="size-3" />}
                                              {ag.can_edit ? 'Full access' : 'View only'}
                                            </span>
                                          </div>
                                          <div className="flex items-center justify-end gap-2">
                                            <button
                                              className={cn("p-1.5 rounded-md text-muted-foreground hover:bg-muted transition-colors", isFeatureExpanded && "bg-muted text-foreground")}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setExpandedFeatureAgent(isFeatureExpanded ? null : { clientId: c.id, agentId: ag.agent_id });
                                              }}
                                              title="Manage visible features"
                                            >
                                              <Settings className="size-4" />
                                            </button>
                                            <button
                                              className="p-1.5 rounded-md text-muted-foreground hover:bg-muted transition-colors"
                                              onClick={(e) => { e.stopPropagation(); handleTogglePermission(c.id, ag.agent_id, ag.can_edit); }}
                                              title={ag.can_edit ? 'Switch to View Only' : 'Switch to Full Access'}
                                            >
                                              {ag.can_edit ? <Lock className="size-4" /> : <Unlock className="size-4" />}
                                            </button>
                                            <button
                                              className="p-1.5 rounded-md text-muted-foreground hover:bg-red-500/10 hover:text-red-400 transition-colors"
                                              onClick={(e) => { e.stopPropagation(); handleUnassign(c.id, ag.agent_id); }}
                                              title="Remove agent"
                                            >
                                              <UserMinus className="size-4" />
                                            </button>
                                          </div>
                                        </div>

                                        {isFeatureExpanded && (
                                          <div className="bg-background/50 p-4 border-l-2 border-l-border">
                                            <div className="mb-4 flex items-center justify-between">
                                              <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Client dashboard features</h5>
                                              <span className="text-xs text-muted-foreground">Toggle what the client can see</span>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                              {FEATURE_KEYS.map(f => {
                                                const isEnabled = !ag.allowed_features || ag.allowed_features[f.key] !== false;
                                                return (
                                                  <div
                                                    key={f.key}
                                                    onClick={() => handleToggleFeature(c.id, ag.agent_id, f.key)}
                                                    className={cn(
                                                      "flex items-center gap-3 p-3 rounded-lg cursor-pointer border transition-colors",
                                                      isEnabled ? "border-border bg-card hover:bg-muted/50" : "border-red-500/20 bg-red-500/5 hover:bg-red-500/10"
                                                    )}
                                                  >
                                                    <button 
                                                      className={cn("relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0",
                                                        isEnabled ? "bg-foreground" : "bg-muted")}
                                                    >
                                                      <span className={cn("inline-block size-4 rounded-full bg-background transition-transform",
                                                        isEnabled ? "translate-x-4" : "translate-x-0.5")} />
                                                    </button>
                                                    <div className={cn("flex items-center gap-2 flex-1 text-sm font-medium", isEnabled ? "text-foreground" : "text-red-400 line-through")}>
                                                      <span>{f.label}</span>
                                                    </div>
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          )}

                          <div className="rounded-lg border border-border bg-card p-4">
                            <h4 className="text-sm font-medium text-foreground mb-3">Assign new agent</h4>
                            {getAvailable(c.id).length === 0 ? (
                              <div className="text-sm text-muted-foreground italic">All available agents have been assigned to this client.</div>
                            ) : (
                              <div className="flex flex-wrap items-end gap-3">
                                <div className="flex-1 min-w-[200px]">
                                  <label className="text-xs text-muted-foreground block mb-1">Agent</label>
                                  <CustomSelect 
                                    value={selectedAgentToAssign} 
                                    onChange={e => setSelectedAgentToAssign(e.target.value)} 
                                    options={[{ value: '', label: 'Select an agent...' }, ...getAvailable(c.id).map(a => ({ value: a.agent_id, label: `${a.name} (${a.agent_id.slice(0, 12)}...)` }))]} 
                                  />
                                </div>
                                <div className="w-40 shrink-0">
                                  <label className="text-xs text-muted-foreground block mb-1">Permissions</label>
                                  <CustomSelect 
                                    value={assignPerm} 
                                    onChange={e => setAssignPerm(e.target.value)} 
                                    options={[{ value: 'edit', label: 'Full Access' }, { value: 'view', label: 'View Only' }]} 
                                  />
                                </div>
                                <button 
                                  className="bg-foreground text-background hover:bg-foreground/90 rounded-md px-4 py-2 text-sm font-medium flex items-center gap-2 h-10 shrink-0 disabled:opacity-50"
                                  onClick={() => handleAssignAgent(c.id)}
                                  disabled={!selectedAgentToAssign}
                                >
                                  <Plus className="size-4" /> Assign agent
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {tab === 'agents' && (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-foreground">System agents</h2>
            </div>
            
            {allAgents.length === 0 ? (
              <EmptyState icon={Bot} title="No agents" description="Create an agent from the Agents page first." />
            ) : (
              <div className="rounded-lg border border-border bg-card overflow-hidden">
                <div className="divide-y divide-border">
                  <div className="grid grid-cols-[2fr_1fr_1fr_auto] gap-4 p-4 text-sm font-medium text-muted-foreground bg-muted/20">
                    <div>Name</div>
                    <div>Agent ID</div>
                    <div>Provider</div>
                    <div className="text-right w-20">Actions</div>
                  </div>
                  {allAgents.map((a) => (
                    <div key={a.agent_id} className="grid grid-cols-[2fr_1fr_1fr_auto] gap-4 p-4 items-center text-sm hover:bg-muted/30 transition-colors">
                      <div className="font-medium text-foreground">{a.name}</div>
                      <div className="font-mono text-xs text-muted-foreground">{a.agent_id}</div>
                      <div>
                        <span className="rounded-full bg-muted text-muted-foreground px-2 py-0.5 text-xs font-medium">
                          {a.provider === 'vapi' ? 'Vapi' : 'ElevenLabs'}
                        </span>
                      </div>
                      <div className="flex items-center justify-end gap-2 w-20">
                        <button
                          className="p-1.5 rounded-md text-muted-foreground hover:bg-muted transition-colors"
                          onClick={() => router.push(`/dashboard/agents/${a.agent_id}`)}
                          title="Configure Agent"
                        >
                          <Settings className="size-4" />
                        </button>
                        <button
                          className="p-1.5 rounded-md text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          onClick={() => setDeleteAgentTarget(a)}
                          title="Delete Agent"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {deleteClientTarget && (
        <ConfirmModal 
          title="Delete client" 
          message={`Delete "${deleteClientTarget.name}" and remove all assignments?`} 
          confirmLabel="Delete client" 
          onConfirm={() => handleDeleteClient(deleteClientTarget.id)} 
          onCancel={() => setDeleteClientTarget(null)} 
          danger 
        />
      )}
      
      {deleteAgentTarget && (
        <ConfirmModal 
          title="Delete agent" 
          message={`Delete "${deleteAgentTarget.name}"? This will remove it from ${deleteAgentTarget.provider === 'vapi' ? 'Vapi' : 'ElevenLabs'}.`} 
          confirmLabel="Delete agent" 
          requireType={deleteAgentTarget.name} 
          onConfirm={() => handleDeleteAgent(deleteAgentTarget.agent_id)} 
          onCancel={() => setDeleteAgentTarget(null)} 
          danger 
        />
      )}
    </div>
  );
}
