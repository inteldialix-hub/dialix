'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/dashboard/shared/ToastProvider';
import { Icon } from '@/components/dashboard/shared/Icon';
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
  sort_order: number;
}

const FEATURE_LABELS: Record<string, string> = {
  dashboard: 'Dashboard Access',
  basic_analytics: 'Basic Analytics',
  advanced_analytics: 'Advanced Analytics',
  webhooks: 'Webhooks',
  call_recording: 'Call Recording',
  priority_support: 'Priority Support',
  api_access: 'API Access',
  custom_integrations: 'Custom Integrations',
  sla: 'SLA Guarantee',
};

export default function BillingPage() {
  const { token } = useAuth();
  const { addToast } = useToast();

  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [currentPlan, setCurrentPlan] = useState<PricingPlan | null>(null);
  const [isDefault, setIsDefault] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!token) return;
    try {
      const [plansRes, myPlanRes] = await Promise.all([
        api<{ plans: PricingPlan[] }>('/pricing/plans', { token: token || undefined }),
        api<{ plan: PricingPlan | null; is_default: boolean }>('/pricing/my-plan', { token: token || undefined }),
      ]);
      setPlans(plansRes.plans);
      setCurrentPlan(myPlanRes.plan);
      setIsDefault(myPlanRes.is_default);
    } catch {
      addToast('Failed to load billing info', 'error');
    } finally {
      setLoading(false);
    }
  }, [token, addToast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className="page-body" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'var(--text-tertiary)', fontSize: '14px' }}>Loading billing info...</div>
      </div>
    );
  }

  return (
    <div className="page-body" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
      <div className="layout-container" style={{ padding: '40px', maxWidth: '1100px', margin: '0 auto', width: '100%', paddingBottom: '100px' }}>

        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
            Billing & Plan
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
            View your current plan and available upgrades
          </p>
        </div>

        {/* Current Plan Banner */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(94, 106, 210, 0.12) 0%, rgba(139, 92, 246, 0.08) 100%)',
          border: '1px solid rgba(94, 106, 210, 0.2)',
          borderRadius: 'var(--radius-xl)',
          padding: '28px 32px',
          marginBottom: '32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
        }}>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--brand-accent)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
              Current Plan
            </div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {currentPlan?.name || 'No Plan Assigned'}
            </div>
            {currentPlan && (
              <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                ${currentPlan.price}/{currentPlan.billing_period}
                {isDefault && <span style={{ marginLeft: '8px', fontSize: '11px', color: 'var(--text-quaternary)' }}>(Default)</span>}
              </div>
            )}
          </div>
          {currentPlan && (
            <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {currentPlan.max_agents === -1 ? '∞' : currentPlan.max_agents}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px' }}>Agents</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {currentPlan.max_calls_per_month === -1 ? '∞' : currentPlan.max_calls_per_month.toLocaleString()}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px' }}>Calls/mo</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {currentPlan.max_phone_numbers === -1 ? '∞' : currentPlan.max_phone_numbers}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px' }}>Phone #s</div>
              </div>
            </div>
          )}
        </div>

        {/* All Plans Grid */}
        <div style={{ marginBottom: '16px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>Available Plans</h3>
          <p style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>Contact your administrator to change your plan</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '16px' }}>
          {plans.map(plan => {
            const isCurrent = currentPlan?.id === plan.id || (isDefault && plan.is_default);
            return (
              <div
                key={plan.id}
                style={{
                  background: 'var(--bg-raised)',
                  border: `1.5px solid ${isCurrent ? 'var(--brand-accent)' : 'var(--border-subtle)'}`,
                  borderRadius: 'var(--radius-lg)',
                  padding: '24px',
                  position: 'relative',
                  transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                }}
              >
                {isCurrent && (
                  <div style={{
                    position: 'absolute', top: '-10px', right: '16px',
                    background: 'var(--brand-accent)', color: '#fff',
                    fontSize: '11px', fontWeight: 600, padding: '2px 10px',
                    borderRadius: '10px', letterSpacing: '0.04em',
                  }}>
                    YOUR PLAN
                  </div>
                )}

                <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
                  {plan.name}
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <span style={{ fontSize: '32px', fontWeight: 700, color: 'var(--text-primary)' }}>${plan.price}</span>
                  <span style={{ fontSize: '14px', color: 'var(--text-tertiary)' }}>/{plan.billing_period}</span>
                </div>

                {/* Limits */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Icon name="bot" size={14} style={{ color: 'var(--text-tertiary)' }} />
                    {plan.max_agents === -1 ? 'Unlimited' : plan.max_agents} agents
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Icon name="phone" size={14} style={{ color: 'var(--text-tertiary)' }} />
                    {plan.max_calls_per_month === -1 ? 'Unlimited' : plan.max_calls_per_month.toLocaleString()} calls/mo
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Icon name="hash" size={14} style={{ color: 'var(--text-tertiary)' }} />
                    {plan.max_phone_numbers === -1 ? 'Unlimited' : plan.max_phone_numbers} phone numbers
                  </div>
                </div>

                {/* Feature List */}
                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {Object.entries(plan.features).filter(([, v]) => v).map(([key]) => (
                    <div key={key} style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Icon name="check" size={14} style={{ color: '#34d399', flexShrink: 0 }} />
                      {FEATURE_LABELS[key] || key}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
