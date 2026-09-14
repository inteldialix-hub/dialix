'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/dashboard/shared/ToastProvider';
import { ConfirmModal } from '@/components/dashboard/shared/ConfirmModal';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Plus, Pencil, Trash2, Check } from 'lucide-react';

interface PricingPlan {
  id: number;
  name: string;
  slug: string;
  price: number;
  billing_period: string;
  max_agents: number;
  max_calls_per_month: number;
  max_phone_numbers: number;
  features: Record<string, boolean>;
  is_default: number;
  is_active: number;
  sort_order: number;
}

interface ClientWithPlan {
  id: number;
  name: string;
  email: string;
  is_admin: number;
  plan_id: number | null;
  plan_name: string | null;
  plan_slug: string | null;
  plan_price: number | null;
  billing_period: string | null;
  agents_count: number;
  numbers_count: number;
  created_at: string;
}

const AVAILABLE_FEATURES = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'basic_analytics', label: 'Basic Analytics' },
  { key: 'advanced_analytics', label: 'Advanced Analytics' },
  { key: 'webhooks', label: 'Webhooks' },
  { key: 'call_recording', label: 'Call Recording' },
  { key: 'priority_support', label: 'Priority Support' },
  { key: 'api_access', label: 'API Access' },
  { key: 'custom_integrations', label: 'Custom Integrations' },
  { key: 'sla', label: 'SLA Guarantee' },
];

const emptyPlan = {
  name: '',
  slug: '',
  price: 0,
  billing_period: 'month',
  max_agents: 1,
  max_calls_per_month: 100,
  max_phone_numbers: 1,
  features: {} as Record<string, boolean>,
  is_default: 0,
  is_active: 1,
  sort_order: 0,
};

export default function AdminPricingPage() {
  const { token, client: me } = useAuth();
  const { addToast } = useToast();
  const router = useRouter();

  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [clients, setClients] = useState<ClientWithPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPlan, setEditingPlan] = useState<PricingPlan | null>(null);
  const [deleteTargetPlan, setDeleteTargetPlan] = useState<PricingPlan | null>(null);
  const [form, setForm] = useState(emptyPlan);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'plans' | 'clients'>('plans');

  useEffect(() => {
    if (me && !me.is_admin) router.replace('/dashboard');
  }, [me, router]);

  const fetchData = useCallback(async () => {
    if (!token) return;
    try {
      const [plansRes, clientsRes] = await Promise.all([
        api<{ plans: PricingPlan[] }>('/pricing/admin/plans', { token: token || undefined }),
        api<{ clients: ClientWithPlan[] }>('/pricing/admin/clients', { token: token || undefined }),
      ]);
      setPlans(plansRes.plans);
      setClients(clientsRes.clients);
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to load pricing data', 'error');
    } finally {
      setLoading(false);
    }
  }, [token, addToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openCreateForm = () => {
    setEditingPlan(null);
    setForm(emptyPlan);
    setShowForm(true);
  };

  const openEditForm = (plan: PricingPlan) => {
    setEditingPlan(plan);
    setForm({
      name: plan.name,
      slug: plan.slug,
      price: plan.price,
      billing_period: plan.billing_period,
      max_agents: plan.max_agents,
      max_calls_per_month: plan.max_calls_per_month,
      max_phone_numbers: plan.max_phone_numbers,
      features: { ...plan.features },
      is_default: plan.is_default,
      is_active: plan.is_active,
      sort_order: plan.sort_order,
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.slug) {
      addToast('Name and slug are required', 'error');
      return;
    }
    setSaving(true);
    try {
      if (editingPlan) {
        await api(`/pricing/admin/plans/${editingPlan.id}`, {
          method: 'PUT',
          token: token || undefined,
          body: form,
        });
        addToast('Plan updated', 'success');
      } else {
        await api('/pricing/admin/plans', {
          method: 'POST',
          token: token || undefined,
          body: form,
        });
        addToast('Plan created', 'success');
      }
      setShowForm(false);
      fetchData();
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to save plan', 'error');
    } finally {
      setSaving(false);
    }
  };

  const confirmDeletePlan = async () => {
    if (!deleteTargetPlan) return;
    try {
      await api(`/pricing/admin/plans/${deleteTargetPlan.id}`, { method: 'DELETE', token: token || undefined });
      addToast(`Plan "${deleteTargetPlan.name}" deleted`, 'success');
      setDeleteTargetPlan(null);
      fetchData();
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to delete plan', 'error');
    }
  };

  const handleAssignPlan = async (clientId: number, planId: number | null) => {
    try {
      await api(`/pricing/admin/clients/${clientId}/plan`, {
        method: 'PUT',
        token: token || undefined,
        body: { plan_id: planId },
      });
      addToast('Plan assigned', 'success');
      fetchData();
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to assign plan', 'error');
    }
  };

  const toggleFeature = (key: string) => {
    setForm(prev => ({
      ...prev,
      features: { ...prev.features, [key]: !prev.features[key] },
    }));
  };

  const generateSlug = (name: string) => {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  };

  if (!me?.is_admin) return null;

  return (
    <div className="max-w-7xl mx-auto px-6 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pricing plans</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage pricing tiers and assign plans to clients</p>
        </div>
        <button 
          className="bg-foreground text-background hover:bg-foreground/90 rounded-md px-4 py-2 text-sm font-medium flex items-center gap-2"
          onClick={openCreateForm}
        >
          <Plus className="size-4" /> New plan
        </button>
      </div>

      <div className="border-b border-border mb-6">
        <nav className="flex gap-6">
          <button 
            onClick={() => setActiveTab('plans')}
            className={cn(
              "pb-3 text-sm font-medium border-b-2 -mb-px transition-colors",
              activeTab === 'plans' ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            Plans
          </button>
          <button 
            onClick={() => setActiveTab('clients')}
            className={cn(
              "pb-3 text-sm font-medium border-b-2 -mb-px transition-colors",
              activeTab === 'clients' ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            Client assignments
          </button>
        </nav>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Loading...</div>
      ) : activeTab === 'plans' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans.map(plan => (
            <div 
              key={plan.id}
              className={cn(
                "rounded-lg border bg-card p-6 relative flex flex-col",
                plan.is_default ? "border-foreground/50 shadow-sm" : "border-border",
                !plan.is_active && "opacity-50"
              )}
            >
              {plan.is_default === 1 && (
                <div className="absolute -top-3 left-4 bg-foreground text-background px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">
                  Default
                </div>
              )}

              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-foreground">{plan.name}</h3>
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => openEditForm(plan)}
                    className="p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  >
                    <Pencil className="size-4" />
                  </button>
                  <button 
                    onClick={() => setDeleteTargetPlan(plan)}
                    className="p-1.5 rounded-md text-muted-foreground hover:bg-red-500/10 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>

              <div className="mb-1">
                <span className="text-3xl font-semibold font-mono tabular-nums text-foreground">${plan.price}</span>
                <span className="text-sm text-muted-foreground">/{plan.billing_period}</span>
              </div>
              <div className="text-xs text-muted-foreground mb-6">
                slug: {plan.slug} {!plan.is_active && '(inactive)'}
              </div>

              <div className="space-y-2 mb-6 flex-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Agents</span>
                  <span className="font-medium text-foreground">{plan.max_agents === -1 ? 'Unlimited' : plan.max_agents}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Calls/mo</span>
                  <span className="font-medium text-foreground">{plan.max_calls_per_month === -1 ? 'Unlimited' : plan.max_calls_per_month.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Phone #s</span>
                  <span className="font-medium text-foreground">{plan.max_phone_numbers === -1 ? 'Unlimited' : plan.max_phone_numbers}</span>
                </div>
              </div>

              <div className="border-t border-border pt-4 mb-4 space-y-2">
                {Object.entries(plan.features).filter(([, v]) => v).map(([key]) => (
                  <div key={key} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Check className="size-3.5 text-emerald-500 shrink-0" />
                    <span>{AVAILABLE_FEATURES.find(f => f.key === key)?.label || key}</span>
                  </div>
                ))}
              </div>

              <div className="text-xs text-muted-foreground/60 mt-auto">
                {clients.filter(c => c.plan_id === plan.id).length} client(s) on this plan
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="divide-y divide-border">
            <div className="grid grid-cols-4 gap-4 p-4 text-sm font-medium text-muted-foreground bg-muted/20">
              <div>Client</div>
              <div>Email</div>
              <div>Current plan</div>
              <div>Assign</div>
            </div>
            
            {clients.filter(c => !c.is_admin).length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">No clients to display</div>
            ) : (
              clients.filter(c => !c.is_admin).map(client => (
                <div key={client.id} className="grid grid-cols-4 gap-4 p-4 items-center text-sm hover:bg-muted/30 transition-colors">
                  <div className="font-medium text-foreground">{client.name}</div>
                  <div className="text-muted-foreground truncate">{client.email}</div>
                  <div>
                    {client.plan_name ? (
                      <span className="rounded-full bg-blue-500/10 text-blue-500 px-2.5 py-0.5 text-xs font-medium">
                        {client.plan_name} (${client.plan_price}/mo)
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-xs">No plan</span>
                    )}
                  </div>
                  <div>
                    <select
                      value={client.plan_id ?? ''}
                      onChange={e => handleAssignPlan(client.id, e.target.value ? Number(e.target.value) : null)}
                      className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-foreground/30 transition-colors"
                    >
                      <option value="">No plan</option>
                      {plans.filter(p => p.is_active).map(p => (
                        <option key={p.id} value={p.id}>{p.name} (${p.price})</option>
                      ))}
                    </select>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowForm(false)}>
          <div 
            className="w-full max-w-2xl rounded-lg border border-border bg-card p-6 shadow-xl max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold tracking-tight text-foreground mb-6">
              {editingPlan ? 'Edit plan' : 'Create new plan'}
            </h3>

            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Plan name</label>
                  <input
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    value={form.name}
                    onChange={e => {
                      setForm(prev => ({
                        ...prev,
                        name: e.target.value,
                        slug: editingPlan ? prev.slug : generateSlug(e.target.value),
                      }));
                    }}
                    placeholder="e.g. Professional"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Slug</label>
                  <input
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-50"
                    value={form.slug}
                    onChange={e => setForm(prev => ({ ...prev, slug: e.target.value }))}
                    placeholder="e.g. professional"
                    disabled={!!editingPlan}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Price ($)</label>
                  <input
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    type="number" min="0" step="1"
                    value={form.price}
                    onChange={e => setForm(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Billing period</label>
                  <select
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    value={form.billing_period}
                    onChange={e => setForm(prev => ({ ...prev, billing_period: e.target.value }))}
                  >
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Max agents <span className="text-muted-foreground font-normal">(-1 = ∞)</span></label>
                  <input 
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" 
                    type="number" 
                    value={form.max_agents} 
                    onChange={e => setForm(prev => ({ ...prev, max_agents: parseInt(e.target.value) }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Calls/mo <span className="text-muted-foreground font-normal">(-1 = ∞)</span></label>
                  <input 
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" 
                    type="number" 
                    value={form.max_calls_per_month} 
                    onChange={e => setForm(prev => ({ ...prev, max_calls_per_month: parseInt(e.target.value) }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Phone #s <span className="text-muted-foreground font-normal">(-1 = ∞)</span></label>
                  <input 
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" 
                    type="number" 
                    value={form.max_phone_numbers} 
                    onChange={e => setForm(prev => ({ ...prev, max_phone_numbers: parseInt(e.target.value) }))}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-medium text-foreground">Included features</label>
                <div className="grid grid-cols-2 gap-2">
                  {AVAILABLE_FEATURES.map(feat => (
                    <label
                      key={feat.key}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-md cursor-pointer border transition-colors text-sm",
                        form.features[feat.key] 
                          ? "border-foreground/30 bg-muted/30 text-foreground font-medium" 
                          : "border-border/50 text-muted-foreground hover:bg-muted/10"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={!!form.features[feat.key]}
                        onChange={() => toggleFeature(feat.key)}
                        className="rounded border-border bg-background text-foreground shrink-0 size-4"
                      />
                      {feat.label}
                    </label>
                  ))}
                </div>
              </div>

              <label className="flex items-center gap-3 text-sm text-foreground cursor-pointer p-2 hover:bg-muted/30 rounded-md transition-colors w-max">
                <input
                  type="checkbox"
                  checked={!!form.is_default}
                  onChange={e => setForm(prev => ({ ...prev, is_default: e.target.checked ? 1 : 0 }))}
                  className="rounded border-border bg-background text-foreground shrink-0 size-4"
                />
                Set as default plan for new clients
              </label>

              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <button
                  onClick={() => setShowForm(false)}
                  className="rounded-md px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted/50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-foreground text-background hover:bg-foreground/90 rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
                >
                  {saving ? 'Saving...' : (editingPlan ? 'Update plan' : 'Create plan')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteTargetPlan && (
        <ConfirmModal
          title="Delete pricing plan"
          message={`Are you sure you want to permanently delete the "${deleteTargetPlan.name}" (${deleteTargetPlan.slug}) plan?`}
          confirmLabel="Delete plan"
          onConfirm={confirmDeletePlan}
          onCancel={() => setDeleteTargetPlan(null)}
          danger={true}
        />
      )}
    </div>
  );
}
