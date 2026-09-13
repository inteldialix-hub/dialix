'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/dashboard/shared/ToastProvider';
import { Icon } from '@/components/dashboard/shared/Icon';
import { ConfirmModal } from '@/components/dashboard/shared/ConfirmModal';
import { api } from '@/lib/api';

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

  // Redirect non-admins
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
    <div className="page-body" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
      <div className="layout-container" style={{ padding: '40px', maxWidth: '1200px', margin: '0 auto', width: '100%', paddingBottom: '100px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
          <div>
            <h2 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
              Pricing Plans
            </h2>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
              Manage pricing tiers and assign plans to clients
            </p>
          </div>
          <button className="btn-primary" onClick={openCreateForm} style={{ gap: '6px' }}>
            <Icon name="plus" size={16} /> New Plan
          </button>
        </div>

        {/* Tab Switcher */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', padding: '3px', width: 'fit-content' }}>
          {(['plans', 'clients'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '8px 20px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '13px',
                fontWeight: 500,
                border: 'none',
                cursor: 'pointer',
                background: activeTab === tab ? 'var(--bg-raised)' : 'transparent',
                color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-tertiary)',
                transition: 'all 0.15s ease',
              }}
            >
              {tab === 'plans' ? 'Plans' : 'Client Assignments'}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-tertiary)' }}>Loading...</div>
        ) : activeTab === 'plans' ? (
          /* ── Plans Grid ── */
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
            {plans.map(plan => (
              <div
                key={plan.id}
                style={{
                  background: 'var(--bg-raised)',
                  border: `1px solid ${plan.is_default ? 'var(--brand-accent)' : 'var(--border-subtle)'}`,
                  borderRadius: 'var(--radius-lg)',
                  padding: '24px',
                  position: 'relative',
                  opacity: plan.is_active ? 1 : 0.5,
                }}
              >
                {plan.is_default === 1 && (
                  <div style={{
                    position: 'absolute', top: '-10px', left: '16px',
                    background: 'var(--brand-accent)', color: '#fff',
                    fontSize: '11px', fontWeight: 600, padding: '2px 10px',
                    borderRadius: '10px', letterSpacing: '0.04em',
                  }}>
                    DEFAULT
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)' }}>{plan.name}</h3>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button className="btn-icon" onClick={() => openEditForm(plan)} title="Edit">
                      <Icon name="pencil" size={14} />
                    </button>
                    <button className="btn-icon" onClick={() => setDeleteTargetPlan(plan)} title="Delete" style={{ color: 'var(--red)' }}>
                      <Icon name="trash-2" size={14} />
                    </button>
                  </div>
                </div>

                <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                  ${plan.price}<span style={{ fontSize: '14px', fontWeight: 400, color: 'var(--text-tertiary)' }}>/{plan.billing_period}</span>
                </div>

                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '16px' }}>
                  slug: {plan.slug} {!plan.is_active && '(inactive)'}
                </div>

                {/* Limits */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Agents</span>
                    <span style={{ fontWeight: 500 }}>{plan.max_agents === -1 ? 'Unlimited' : plan.max_agents}</span>
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Calls/mo</span>
                    <span style={{ fontWeight: 500 }}>{plan.max_calls_per_month === -1 ? 'Unlimited' : plan.max_calls_per_month.toLocaleString()}</span>
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Phone #s</span>
                    <span style={{ fontWeight: 500 }}>{plan.max_phone_numbers === -1 ? 'Unlimited' : plan.max_phone_numbers}</span>
                  </div>
                </div>

                {/* Features */}
                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
                  {Object.entries(plan.features).filter(([, v]) => v).map(([key]) => (
                    <div key={key} style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                      <Icon name="check" size={12} style={{ color: 'var(--green)' }} />
                      {AVAILABLE_FEATURES.find(f => f.key === key)?.label || key}
                    </div>
                  ))}
                </div>

                {/* Client count */}
                <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--text-quaternary)' }}>
                  {clients.filter(c => c.plan_id === plan.id).length} client(s) on this plan
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* ── Client Assignments Table ── */
          <div style={{ background: 'var(--bg-raised)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Client</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Current Plan</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Assign</th>
                </tr>
              </thead>
              <tbody>
                {clients.filter(c => !c.is_admin).map(client => (
                  <tr key={client.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '12px 16px', fontSize: '14px', color: 'var(--text-primary)', fontWeight: 500 }}>
                      {client.name}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                      {client.email}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {client.plan_name ? (
                        <span style={{
                          padding: '3px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 500,
                          background: 'rgba(94, 106, 210, 0.12)', color: 'var(--brand-accent)',
                        }}>
                          {client.plan_name} (${client.plan_price}/mo)
                        </span>
                      ) : (
                        <span style={{ fontSize: '12px', color: 'var(--text-quaternary)' }}>No plan</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <select
                        value={client.plan_id ?? ''}
                        onChange={e => handleAssignPlan(client.id, e.target.value ? Number(e.target.value) : null)}
                        style={{
                          padding: '6px 10px', fontSize: '13px',
                          background: 'var(--bg-input)', color: 'var(--text-primary)',
                          border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)',
                          cursor: 'pointer',
                        }}
                      >
                        <option value="">No plan</option>
                        {plans.filter(p => p.is_active).map(p => (
                          <option key={p.id} value={p.id}>{p.name} (${p.price})</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
                {clients.filter(c => !c.is_admin).length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '14px' }}>
                      No clients to display
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Create/Edit Plan Modal ── */}
        {showForm && (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(4px)',
          }}
            onClick={() => setShowForm(false)}
          >
            <div
              style={{
                background: 'var(--bg-raised)', borderRadius: 'var(--radius-xl)',
                border: '1px solid var(--border-subtle)', padding: '32px',
                width: '100%', maxWidth: '560px', maxHeight: '80vh', overflowY: 'auto',
                boxShadow: 'var(--shadow-lg)',
              }}
              onClick={e => e.stopPropagation()}
            >
              <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '24px' }}>
                {editingPlan ? 'Edit Plan' : 'Create New Plan'}
              </h3>

              {/* Name & Slug */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)' }}>Plan Name</label>
                  <input
                    className="form-input"
                    value={form.name}
                    onChange={e => {
                      setForm(prev => ({
                        ...prev,
                        name: e.target.value,
                        slug: editingPlan ? prev.slug : generateSlug(e.target.value),
                      }));
                    }}
                    placeholder="e.g. Professional"
                    style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-input)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '14px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)' }}>Slug</label>
                  <input
                    className="form-input"
                    value={form.slug}
                    onChange={e => setForm(prev => ({ ...prev, slug: e.target.value }))}
                    placeholder="e.g. professional"
                    disabled={!!editingPlan}
                    style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-input)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '14px', opacity: editingPlan ? 0.5 : 1 }}
                  />
                </div>
              </div>

              {/* Price & Billing */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)' }}>Price ($)</label>
                  <input
                    className="form-input"
                    type="number" min="0" step="1"
                    value={form.price}
                    onChange={e => setForm(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
                    style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-input)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '14px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)' }}>Billing Period</label>
                  <select
                    value={form.billing_period}
                    onChange={e => setForm(prev => ({ ...prev, billing_period: e.target.value }))}
                    style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-input)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '14px' }}
                  >
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
              </div>

              {/* Limits */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)' }}>Max Agents <span style={{ color: 'var(--text-quaternary)' }}>(-1 = ∞)</span></label>
                  <input className="form-input" type="number" value={form.max_agents} onChange={e => setForm(prev => ({ ...prev, max_agents: parseInt(e.target.value) }))}
                    style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-input)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '14px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)' }}>Calls/Month <span style={{ color: 'var(--text-quaternary)' }}>(-1 = ∞)</span></label>
                  <input className="form-input" type="number" value={form.max_calls_per_month} onChange={e => setForm(prev => ({ ...prev, max_calls_per_month: parseInt(e.target.value) }))}
                    style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-input)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '14px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)' }}>Phone Numbers <span style={{ color: 'var(--text-quaternary)' }}>(-1 = ∞)</span></label>
                  <input className="form-input" type="number" value={form.max_phone_numbers} onChange={e => setForm(prev => ({ ...prev, max_phone_numbers: parseInt(e.target.value) }))}
                    style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-input)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '14px' }} />
                </div>
              </div>

              {/* Features */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)' }}>Included Features</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                  {AVAILABLE_FEATURES.map(feat => (
                    <label
                      key={feat.key}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px',
                        borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '13px',
                        color: form.features[feat.key] ? 'var(--text-primary)' : 'var(--text-tertiary)',
                        background: form.features[feat.key] ? 'rgba(94, 106, 210, 0.08)' : 'transparent',
                        border: `1px solid ${form.features[feat.key] ? 'rgba(94, 106, 210, 0.2)' : 'transparent'}`,
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={!!form.features[feat.key]}
                        onChange={() => toggleFeature(feat.key)}
                        style={{ accentColor: 'var(--brand-accent)' }}
                      />
                      {feat.label}
                    </label>
                  ))}
                </div>
              </div>

              {/* Default checkbox */}
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px', fontSize: '13px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={!!form.is_default}
                  onChange={e => setForm(prev => ({ ...prev, is_default: e.target.checked ? 1 : 0 }))}
                  style={{ accentColor: 'var(--brand-accent)' }}
                />
                Set as default plan for new clients
              </label>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setShowForm(false)}
                  style={{ padding: '8px 20px', fontSize: '13px', fontWeight: 500, background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  className="btn-primary"
                  onClick={handleSave}
                  disabled={saving}
                  style={{ padding: '8px 20px' }}
                >
                  {saving ? 'Saving...' : (editingPlan ? 'Update Plan' : 'Create Plan')}
                </button>
              </div>
            </div>
          </div>
        )}

        {deleteTargetPlan && (
          <ConfirmModal
            title="Delete Pricing Plan"
            message={`Are you sure you want to permanently delete the "${deleteTargetPlan.name}" (${deleteTargetPlan.slug}) plan?`}
            confirmLabel="Delete Plan"
            onConfirm={confirmDeletePlan}
            onCancel={() => setDeleteTargetPlan(null)}
            danger={true}
          />
        )}
      </div>
    </div>
  );
}
