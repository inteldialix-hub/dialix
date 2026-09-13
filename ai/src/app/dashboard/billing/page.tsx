/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps */
'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/dashboard/shared/ToastProvider';
import { ConfirmModal } from '@/components/dashboard/shared/ConfirmModal';
import { EmptyState } from '@/components/dashboard/shared/EmptyState';
import { Icon } from '@/components/dashboard/shared/Icon';
import { FiCheck, FiAlertCircle, FiCreditCard, FiClock } from 'react-icons/fi';
import { Loader2 } from 'lucide-react';
import '@/styles/dashboard.css';

interface Plan {
  id: string;
  slug?: string;
  name: string;
  price: number;
  features: string[];
  maxAgents: number;
  maxCalls: number;
  maxNumbers: number;
}

interface CurrentPlan {
  planId: string;
  name?: string;
  slug?: string;
  status: string;
  renewalDate: string;
}

interface PaymentHistory {
  id: string;
  date: string;
  amount: number;
  status: string;
  paymentId: string;
}

export default function BillingPage() {
  const { token, isAuthenticated } = useAuth();
  const { addToast } = useToast();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [currentPlan, setCurrentPlan] = useState<CurrentPlan | null>(null);
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistory[]>([]);
  const [usageStats, setUsageStats] = useState<{ totalAgents?: number; totalCalls?: number; totalNumbers?: number } | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      fetchBillingData();
    }
  }, [isAuthenticated, token]);

  const fetchBillingData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [plansRes, myPlanRes, historyRes, statsRes] = await Promise.all([
        api('/pricing/plans', { token: token || undefined }).catch(() => null),
        api('/pricing/my-plan', { token: token || undefined }).catch(() => null),
        api('/paypal/billing-history', { token: token || undefined }).catch(() => null),
        api<any>('/stats', { token: token || undefined }).catch(() => null)
      ]);

      if (statsRes) {
        setUsageStats(statsRes);
      }

      const rawPlans = plansRes?.plans || plansRes?.data || (Array.isArray(plansRes) ? plansRes : []);
      if (rawPlans.length > 0) {
        setPlans(rawPlans.map((p: any) => ({
          id: p.slug || String(p.id),
          slug: p.slug || String(p.id),
          name: p.name,
          price: typeof p.price === 'string' ? parseFloat(p.price) : Number(p.price || 0),
          features: Array.isArray(p.features) ? p.features : (typeof p.features === 'string' ? (() => { try { return JSON.parse(p.features); } catch { return []; } })() : []),
          maxAgents: p.max_agents ?? p.maxAgents ?? 1,
          maxCalls: p.max_calls_per_month ?? p.maxCalls ?? 100,
          maxNumbers: p.max_phone_numbers ?? p.maxNumbers ?? 1,
        })));
      } else {
        // Fallback plans for UI purposes if API fails
        setPlans([
          { id: 'starter', slug: 'starter', name: 'Starter', price: 0, features: ['1 AI Agent', '100 Calls/mo', '1 Phone Number'], maxAgents: 1, maxCalls: 100, maxNumbers: 1 },
          { id: 'professional', slug: 'professional', name: 'Professional', price: 49, features: ['5 AI Agents', '1,000 Calls/mo', '5 Phone Numbers', 'Priority support'], maxAgents: 5, maxCalls: 1000, maxNumbers: 5 },
          { id: 'business', slug: 'business', name: 'Business', price: 149, features: ['20 AI Agents', '5,000 Calls/mo', '20 Phone Numbers', 'Custom integrations'], maxAgents: 20, maxCalls: 5000, maxNumbers: 20 },
          { id: 'enterprise', slug: 'enterprise', name: 'Enterprise', price: 499, features: ['Unlimited Agents', 'Unlimited Calls', 'Unlimited Numbers', 'Dedicated account manager'], maxAgents: 999999, maxCalls: 999999, maxNumbers: 999999 }
        ]);
      }

      if (myPlanRes?.plan) {
        const p = myPlanRes.plan;
        setCurrentPlan({
          planId: p.slug || String(p.id),
          name: p.name,
          slug: p.slug,
          status: 'Active',
          renewalDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        });
      } else if (myPlanRes?.name) {
        setCurrentPlan({
          planId: myPlanRes.slug || String(myPlanRes.id || 'starter'),
          name: myPlanRes.name,
          slug: myPlanRes.slug,
          status: myPlanRes.status || 'Active',
          renewalDate: myPlanRes.renewalDate || new Date().toISOString()
        });
      } else {
        setCurrentPlan({ planId: 'starter', name: 'Starter', slug: 'starter', status: 'Active', renewalDate: new Date().toISOString() });
      }

      const rawHistory = historyRes?.payments || historyRes?.data || (Array.isArray(historyRes) ? historyRes : []);
      setPaymentHistory(rawHistory);

    } catch (err: any) {
      setError(err.message || 'Failed to fetch billing data');
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async (planId: string) => {
    try {
      setActionLoading(planId);
      const res = await api('/paypal/create-subscription', {
        method: 'POST',
        body: { plan_slug: planId, planId },
        token: token || undefined
      });
      const approvalUrl = res?.approvalUrl || res?.approval_url || res?.data?.approval_url;
      if (approvalUrl) {
        window.location.href = approvalUrl;
      } else {
        addToast(res?.error || 'PayPal checkout URL not generated. Please configure PayPal credentials in settings.', 'error');
      }
    } catch (err: any) {
      addToast(err.message || 'Failed to initiate upgrade', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancelSubscription = async () => {
    try {
      setActionLoading('cancel');
      await api('/paypal/cancel-subscription', { method: 'POST', body: {}, token: token || undefined });
      addToast('Subscription cancelled successfully', 'info');
      setShowCancelModal(false);
      fetchBillingData();
    } catch (err: any) {
      addToast(err.message || 'Failed to cancel subscription', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch(status.toLowerCase()) {
      case 'active': return 'var(--green)';
      case 'suspended': return 'var(--yellow)';
      case 'cancelled': return 'var(--red)';
      default: return 'var(--text-secondary)';
    }
  };

  if (loading) {
    return (
      <div className="dashboard-content">
        <div className="page-title-section mb-6">
          <div>
            <h1 className="page-title">Billing & Subscription</h1>
            <p className="page-subtitle">Manage your plan, limits, payments, and invoices</p>
          </div>
        </div>
        <div className="p-16 text-center bg-[rgba(18,20,24,0.7)] backdrop-blur-md border border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] rounded-xl">
          <Loader2 className="mx-auto h-8 w-8 text-accent animate-spin mb-3" />
          <p className="text-sm text-gray-400">Loading billing information...</p>
        </div>
      </div>
    );
  }

  const activePlanDetails = plans.find(
    (p) => p.id === currentPlan?.planId || p.slug === currentPlan?.planId || p.slug === currentPlan?.slug
  ) || plans[0] || {
    id: 'starter',
    name: 'Starter',
    price: 0,
    features: ['1 AI Agent', '100 Calls/mo', '1 Phone Number'],
    maxAgents: 1,
    maxCalls: 100,
    maxNumbers: 1,
  };

  return (
    <div className="dashboard-content">
      <div className="page-title-section mb-6">
        <div>
          <h1 className="page-title">Billing & Subscription</h1>
          <p className="page-subtitle">Manage your plan, usage limits, payments, and invoices</p>
        </div>
      </div>

      {error && (
        <div className="p-4 mb-6 rounded-lg flex items-center gap-3 bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <FiAlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Usage & Telemetry Metrics Grid */}
      <div className="stat-card-grid mb-8">
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">AI Agents Capacity</span>
            <div className="stat-card-icon"><Icon name="bot" size={16} /></div>
          </div>
          <div>
            <div className="stat-card-value">
              {usageStats?.totalAgents ?? 1}{' '}
              <span className="text-xs font-normal text-gray-400">
                / {activePlanDetails.maxAgents === 999999 ? 'Unlimited' : activePlanDetails.maxAgents}
              </span>
            </div>
            <div className="w-full bg-white/[0.06] rounded-full h-1.5 mt-2 mb-3 overflow-hidden">
              <div 
                className="bg-indigo-500 h-full rounded-full transition-all duration-300"
                style={{ 
                  width: `${Math.min(100, Math.max(5, activePlanDetails.maxAgents === 999999 ? 10 : Math.round(((usageStats?.totalAgents ?? 1) / activePlanDetails.maxAgents) * 100)))}%` 
                }}
              />
            </div>
          </div>
          <span className="stat-card-trend neutral">
            <Icon name="activity" size={11} />
            {activePlanDetails.maxAgents === 999999 ? 'Unlimited' : `${Math.round(((usageStats?.totalAgents ?? 1) / activePlanDetails.maxAgents) * 100)}% Used`}
          </span>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">Monthly Calls Quota</span>
            <div className="stat-card-icon"><Icon name="phone-call" size={16} /></div>
          </div>
          <div>
            <div className="stat-card-value">
              {(usageStats?.totalCalls ?? 0).toLocaleString()}{' '}
              <span className="text-xs font-normal text-gray-400">
                / {activePlanDetails.maxCalls === 999999 ? 'Unlimited' : activePlanDetails.maxCalls.toLocaleString()}
              </span>
            </div>
            <div className="w-full bg-white/[0.06] rounded-full h-1.5 mt-2 mb-3 overflow-hidden">
              <div 
                className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                style={{ 
                  width: `${Math.min(100, Math.max(5, activePlanDetails.maxCalls === 999999 ? 10 : Math.round(((usageStats?.totalCalls ?? 0) / activePlanDetails.maxCalls) * 100)))}%` 
                }}
              />
            </div>
          </div>
          <span className="stat-card-trend up">
            <Icon name="trending-up" size={11} />
            {activePlanDetails.maxCalls === 999999 ? 'Unlimited' : 'Quota Active'}
          </span>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">Phone Numbers</span>
            <div className="stat-card-icon"><Icon name="phone" size={16} /></div>
          </div>
          <div>
            <div className="stat-card-value">
              {usageStats?.totalNumbers ?? 1}{' '}
              <span className="text-xs font-normal text-gray-400">
                / {activePlanDetails.maxNumbers === 999999 ? 'Unlimited' : activePlanDetails.maxNumbers}
              </span>
            </div>
            <div className="w-full bg-white/[0.06] rounded-full h-1.5 mt-2 mb-3 overflow-hidden">
              <div 
                className="bg-indigo-500 h-full rounded-full transition-all duration-300"
                style={{ 
                  width: `${Math.min(100, Math.max(5, activePlanDetails.maxNumbers === 999999 ? 10 : Math.round(((usageStats?.totalNumbers ?? 1) / activePlanDetails.maxNumbers) * 100)))}%` 
                }}
              />
            </div>
          </div>
          <span className="stat-card-trend neutral">
            <Icon name="check" size={11} />
            Provisioned
          </span>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">Active Plan Cost</span>
            <div className="stat-card-icon"><Icon name="credit-card" size={16} /></div>
          </div>
          <div>
            <div className="stat-card-value">
              ${activePlanDetails.price}{' '}
              <span className="text-xs font-normal text-gray-400">/mo</span>
            </div>
            <div className="text-xs text-gray-400 mt-2 mb-3 truncate">
              {currentPlan?.name || activePlanDetails.name} Tier
            </div>
          </div>
          <span className="stat-card-trend up">
            <Icon name="check-circle" size={11} />
            {currentPlan?.status?.toUpperCase() || 'ACTIVE'}
          </span>
        </div>
      </div>

      {/* Current Plan Overview */}
      <div className="p-6 mb-8 rounded-xl border border-white/[0.08] bg-[rgba(18,20,24,0.7)] backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_4px_20px_rgba(0,0,0,0.2)]">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Active Subscription</div>
            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold text-white">
                {currentPlan?.name || plans.find(p => p.id === currentPlan?.planId || p.slug === currentPlan?.planId)?.name || 'Starter'}
              </span>
              <span 
                className="px-2.5 py-0.5 rounded-full text-xs font-semibold border"
                style={{ 
                  color: getStatusColor(currentPlan?.status || 'active'), 
                  borderColor: getStatusColor(currentPlan?.status || 'active'),
                  backgroundColor: 'rgba(255,255,255,0.04)'
                }}
              >
                {currentPlan?.status?.toUpperCase() || 'ACTIVE'}
              </span>
            </div>
            {currentPlan?.renewalDate && (
              <p className="text-xs mt-2 flex items-center gap-1.5 text-gray-400">
                <FiClock size={13} /> Next renewal on {new Date(currentPlan.renewalDate).toLocaleDateString()}
              </p>
            )}
          </div>
          
          {currentPlan?.planId !== 'starter' && currentPlan?.slug !== 'starter' && currentPlan?.status !== 'cancelled' && (
            <button 
              onClick={() => setShowCancelModal(true)}
              className="btn-danger text-xs font-medium"
            >
              Cancel Subscription
            </button>
          )}
        </div>
      </div>

      {/* Plans Grid */}
      <div className="mb-10">
        <h2 className="text-base font-semibold text-white mb-4">Available Plans</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {plans.map((plan) => {
            const isCurrent = plan.id === currentPlan?.planId || plan.slug === currentPlan?.planId || plan.slug === currentPlan?.slug;
            return (
              <div 
                key={plan.id} 
                className={`p-6 rounded-xl border flex flex-col transition-all duration-200 bg-[rgba(18,20,24,0.7)] backdrop-blur-md ${
                  isCurrent 
                    ? 'border-accent shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_0_20px_rgba(94,106,210,0.25)]' 
                    : 'border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_4px_20px_rgba(0,0,0,0.2)] hover:border-white/[0.16] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_8px_30px_rgba(0,0,0,0.3)]'
                }`}
              >
                <div className="mb-4">
                  <div className="flex justify-between items-center mb-1">
                    <h3 className="text-base font-semibold text-white">{plan.name}</h3>
                    {isCurrent && (
                      <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-accent/20 text-accent border border-accent/30">
                        Current
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-white">${plan.price}</span>
                    <span className="text-xs text-gray-400">/month</span>
                  </div>
                </div>
                
                <div className="flex-1 space-y-4 mb-6 text-xs">
                  <div className="pt-3 border-t border-white/[0.08]">
                    <span className="font-semibold text-gray-300 block mb-2">Usage Limits</span>
                    <ul className="space-y-2 text-gray-400">
                      <li className="flex items-center gap-2">
                        <FiCheck className="text-accent shrink-0" size={14} /> 
                        <span>{plan.maxAgents === 999999 || plan.maxAgents < 0 ? 'Unlimited' : plan.maxAgents} AI Agent{plan.maxAgents === 1 ? '' : 's'}</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <FiCheck className="text-accent shrink-0" size={14} /> 
                        <span>{plan.maxCalls === 999999 || plan.maxCalls < 0 ? 'Unlimited' : plan.maxCalls.toLocaleString()} Calls/mo</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <FiCheck className="text-accent shrink-0" size={14} /> 
                        <span>{plan.maxNumbers === 999999 || plan.maxNumbers < 0 ? 'Unlimited' : plan.maxNumbers} Phone Number{plan.maxNumbers === 1 ? '' : 's'}</span>
                      </li>
                    </ul>
                  </div>

                  {plan.features.length > 0 && (
                    <div className="pt-3 border-t border-white/[0.08]">
                      <span className="font-semibold text-gray-300 block mb-2">Key Features</span>
                      <ul className="space-y-2 text-gray-400">
                        {plan.features.map((f, i) => (
                          <li key={i} className="flex items-center gap-2">
                            <FiCheck className="text-accent shrink-0" size={14} /> 
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                
                <button
                  disabled={isCurrent || actionLoading !== null}
                  onClick={() => handleUpgrade(plan.id)}
                  className={`w-full py-2 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2 ${
                    isCurrent 
                      ? 'bg-white/[0.04] text-gray-400 border border-white/[0.08] cursor-default' 
                      : 'btn-primary'
                  }`}
                >
                  {actionLoading === plan.id ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Redirecting...</span>
                    </>
                  ) : isCurrent ? (
                    'Current Plan'
                  ) : (
                    'Select Plan'
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Payment History */}
      <div className="mb-6">
        <h2 className="text-base font-semibold text-white mb-4">Payment History</h2>
        {paymentHistory.length === 0 ? (
          <div className="p-8 rounded-xl border border-white/[0.08] bg-[rgba(18,20,24,0.7)] backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
            <EmptyState
              icon="credit-card"
              title="No billing transactions"
              description="You do not have any invoices or past payments on record yet."
            />
          </div>
        ) : (
          <div className="rounded-xl border border-white/[0.08] bg-[rgba(18,20,24,0.7)] backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_4px_20px_rgba(0,0,0,0.2)] overflow-hidden">
            <div className="table-responsive">
              <table className="w-full text-left">
                <thead className="bg-white/[0.02] border-b border-white/[0.08] text-gray-400 text-xs font-medium">
                  <tr>
                    <th className="p-4">Date</th>
                    <th className="p-4">Amount</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 font-mono">Reference ID</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {paymentHistory.map((hist) => (
                    <tr key={hist.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="p-4 text-xs text-gray-300">{hist.date ? new Date(hist.date).toLocaleDateString() : '—'}</td>
                      <td className="p-4 text-xs font-medium text-white">${Number(hist.amount || 0).toFixed(2)}</td>
                      <td className="p-4 text-xs">
                        <span 
                          className="px-2 py-0.5 rounded text-[11px] font-medium border"
                          style={{ 
                            color: getStatusColor(hist.status),
                            borderColor: getStatusColor(hist.status),
                            backgroundColor: 'rgba(255,255,255,0.02)'
                          }}
                        >
                          {hist.status}
                        </span>
                      </td>
                      <td className="p-4 text-xs font-mono text-gray-400">{hist.paymentId || hist.id}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Cancel Modal */}
      {showCancelModal && (
        <ConfirmModal
          title="Cancel Subscription"
          message="Are you sure you want to cancel your current subscription? You will retain access to your plan features until the end of your current billing period."
          confirmLabel="Cancel Subscription"
          onConfirm={handleCancelSubscription}
          onCancel={() => setShowCancelModal(false)}
          danger={true}
        />
      )}
    </div>
  );
}

