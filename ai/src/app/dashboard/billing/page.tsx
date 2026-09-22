/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps */
'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/dashboard/shared/ToastProvider';
import { Loader2, Check, AlertCircle, CreditCard, Clock, Bot, PhoneCall, Phone, Activity, TrendingUp, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

import { useTopBar } from '@/components/dashboard/TopBarContext';

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
  const { setTopBar } = useTopBar();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [currentPlan, setCurrentPlan] = useState<CurrentPlan | null>(null);
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistory[]>([]);
  const [usageStats, setUsageStats] = useState<{ totalAgents?: number; totalCalls?: number; totalNumbers?: number } | null>(null);
  const [usage, setUsage] = useState<any>(null);
  const [usageHistory, setUsageHistory] = useState<any[]>([]);  
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);

  useEffect(() => {
    setTopBar({
      title: 'Billing & subscription',
    });
  }, [setTopBar]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchBillingData();
    }
  }, [isAuthenticated, token]);

  const fetchBillingData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [plansRes, myPlanRes, historyRes, statsRes, usageRes, usageHistoryRes] = await Promise.all([
        api('/pricing/plans', { token: token || undefined }).catch(() => null),
        api('/pricing/my-plan', { token: token || undefined }).catch(() => null),
        api('/paypal/billing-history', { token: token || undefined }).catch(() => null),
        api<any>('/stats', { token: token || undefined }).catch(() => null),
        api<any>('/stats/usage', { token: token || undefined }).catch(() => null),
        api<any>('/stats/usage/history', { token: token || undefined }).catch(() => null)
      ]);

      if (statsRes) setUsageStats(statsRes);
      if (usageRes?.usage) setUsage(usageRes.usage);
      if (usageHistoryRes && Array.isArray(usageHistoryRes)) setUsageHistory(usageHistoryRes);

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

  const getStatusColorClass = (status: string) => {
    switch(status.toLowerCase()) {
      case 'active': return 'bg-emerald-500/10 text-emerald-400';
      case 'suspended': return 'bg-yellow-500/10 text-yellow-400';
      case 'cancelled': return 'bg-red-500/10 text-red-400';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="flex flex-col items-center justify-center p-16 rounded-lg border border-border bg-card">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">Loading billing information...</p>
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
    <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
      {error && (
        <div className="p-4 rounded-lg flex items-center gap-3 bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Usage & Telemetry Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-lg border border-border bg-card p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">AI agents capacity</span>
            <Bot size={16} className="text-muted-foreground" />
          </div>
          <div className="text-2xl font-semibold font-mono tabular-nums mb-2">
            {usageStats?.totalAgents ?? 1}
            <span className="text-sm font-normal text-muted-foreground ml-1">
              / {activePlanDetails.maxAgents === 999999 ? 'Unlimited' : activePlanDetails.maxAgents}
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted mb-2 overflow-hidden">
            <div 
              className="h-2 rounded-full bg-emerald-500 transition-all duration-300"
              style={{ width: `${Math.min(100, Math.max(5, activePlanDetails.maxAgents === 999999 ? 10 : Math.round(((usageStats?.totalAgents ?? 1) / activePlanDetails.maxAgents) * 100)))}%` }}
            />
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Activity size={12} />
            {activePlanDetails.maxAgents === 999999 ? 'Unlimited' : `${Math.round(((usageStats?.totalAgents ?? 1) / activePlanDetails.maxAgents) * 100)}% used`}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Monthly calls quota</span>
            <PhoneCall size={16} className="text-muted-foreground" />
          </div>
          <div className="text-2xl font-semibold font-mono tabular-nums mb-2">
            {(usageStats?.totalCalls ?? 0).toLocaleString()}
            <span className="text-sm font-normal text-muted-foreground ml-1">
              / {activePlanDetails.maxCalls === 999999 ? 'Unlimited' : activePlanDetails.maxCalls.toLocaleString()}
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted mb-2 overflow-hidden">
            <div 
              className="h-2 rounded-full bg-emerald-500 transition-all duration-300"
              style={{ width: `${Math.min(100, Math.max(5, activePlanDetails.maxCalls === 999999 ? 10 : Math.round(((usageStats?.totalCalls ?? 0) / activePlanDetails.maxCalls) * 100)))}%` }}
            />
          </div>
          <div className="flex items-center gap-1 text-xs text-emerald-400">
            <TrendingUp size={12} />
            {activePlanDetails.maxCalls === 999999 ? 'Unlimited' : 'Quota active'}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Phone numbers</span>
            <Phone size={16} className="text-muted-foreground" />
          </div>
          <div className="text-2xl font-semibold font-mono tabular-nums mb-2">
            {usageStats?.totalNumbers ?? 1}
            <span className="text-sm font-normal text-muted-foreground ml-1">
              / {activePlanDetails.maxNumbers === 999999 ? 'Unlimited' : activePlanDetails.maxNumbers}
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted mb-2 overflow-hidden">
            <div 
              className="h-2 rounded-full bg-emerald-500 transition-all duration-300"
              style={{ width: `${Math.min(100, Math.max(5, activePlanDetails.maxNumbers === 999999 ? 10 : Math.round(((usageStats?.totalNumbers ?? 1) / activePlanDetails.maxNumbers) * 100)))}%` }}
            />
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Check size={12} /> Provisioned
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Active plan cost</span>
            <CreditCard size={16} className="text-muted-foreground" />
          </div>
          <div className="text-2xl font-semibold font-mono tabular-nums mb-2">
            ${activePlanDetails.price}
            <span className="text-sm font-normal text-muted-foreground ml-1">/mo</span>
          </div>
          <div className="text-sm text-muted-foreground mb-3 truncate">
            {currentPlan?.name || activePlanDetails.name} tier
          </div>
          <div className="flex items-center gap-1 text-xs text-emerald-400">
            <CheckCircle size={12} />
            {currentPlan?.status || 'Active'}
          </div>
        </div>
      </div>

      {/* Current Plan Overview */}
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="text-sm text-muted-foreground mb-1">Active subscription</div>
            <div className="flex items-center gap-3">
              <span className="text-2xl font-semibold tracking-tight">
                {currentPlan?.name || plans.find(p => p.id === currentPlan?.planId || p.slug === currentPlan?.planId)?.name || 'Starter'}
              </span>
              <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", getStatusColorClass(currentPlan?.status || 'active'))}>
                {currentPlan?.status || 'Active'}
              </span>
            </div>
            {currentPlan?.renewalDate && (
              <p className="text-sm mt-2 flex items-center gap-1.5 text-muted-foreground">
                <Clock size={14} /> Next renewal on {new Date(currentPlan.renewalDate).toLocaleDateString()}
              </p>
            )}
          </div>
          
          {currentPlan?.planId !== 'starter' && currentPlan?.slug !== 'starter' && currentPlan?.status !== 'cancelled' && (
            <button 
              onClick={() => setShowCancelModal(true)}
              className="bg-red-600 text-white hover:bg-red-700 rounded-md px-4 py-2 text-sm font-medium"
            >
              Cancel subscription
            </button>
          )}
        </div>
      </div>

      {/* Current Usage */}
      <div>
        <h2 className="text-lg font-medium tracking-tight mb-4">Current Usage ({usage?.period || new Date().toISOString().substring(0, 7)})</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="rounded-lg border border-border bg-card p-6">
            <div className="text-sm text-muted-foreground mb-2">Calls Used</div>
            <div className="text-2xl font-semibold font-mono tabular-nums mb-2">
              {(usage?.totalCalls ?? 0).toLocaleString()}
              <span className="text-sm font-normal text-muted-foreground ml-1">
                / {activePlanDetails.maxCalls === 999999 || activePlanDetails.maxCalls < 0 ? 'Unlimited' : activePlanDetails.maxCalls.toLocaleString()}
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted mb-2 overflow-hidden">
              <div 
                className="h-2 rounded-full bg-blue-500 transition-all duration-300"
                style={{ width: `${Math.min(100, Math.max(0, activePlanDetails.maxCalls === 999999 || activePlanDetails.maxCalls < 0 ? 0 : Math.round(((usage?.totalCalls ?? 0) / activePlanDetails.maxCalls) * 100)))}%` }}
              />
            </div>
          </div>
          <div className="rounded-lg border border-border bg-card p-6">
            <div className="text-sm text-muted-foreground mb-2">Connected Minutes</div>
            <div className="text-2xl font-semibold font-mono tabular-nums mb-2">
              {Math.round(usage?.totalMinutes ?? 0).toLocaleString()} <span className="text-sm font-normal text-muted-foreground ml-1">min</span>
            </div>
          </div>
          <div className="rounded-lg border border-border bg-card p-6">
            <div className="text-sm text-muted-foreground mb-2">Estimated Usage Cost</div>
            <div className="text-2xl font-semibold font-mono tabular-nums mb-2">
              ${Number(usage?.totalCost ?? 0).toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      {/* Usage History Table */}
      {usageHistory.length > 0 && (
        <div>
          <h2 className="text-lg font-medium tracking-tight mb-4">Monthly Usage History</h2>
          <div className="rounded-lg border border-border bg-card overflow-x-auto">
            <table className="w-full text-left divide-y divide-border min-w-[640px]">
              <thead>
                <tr>
                  <th scope="col" className="text-left font-medium text-muted-foreground px-4 py-3 text-sm">Period</th>
                  <th scope="col" className="text-left font-medium text-muted-foreground px-4 py-3 text-sm">Calls</th>
                  <th scope="col" className="text-left font-medium text-muted-foreground px-4 py-3 text-sm">Minutes</th>
                  <th scope="col" className="text-left font-medium text-muted-foreground px-4 py-3 text-sm">AI Cost</th>
                  <th scope="col" className="text-left font-medium text-muted-foreground px-4 py-3 text-sm">Telephony Cost</th>
                  <th scope="col" className="text-left font-medium text-muted-foreground px-4 py-3 text-sm">Total Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {usageHistory.map((hist, idx) => (
                  <tr key={idx} className="hover:bg-accent/50 transition-colors">
                    <td className="px-4 py-3 text-sm">{hist.period}</td>
                    <td className="px-4 py-3 text-sm font-mono">{hist.totalCalls.toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm font-mono">{Math.round(hist.totalMinutes).toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm font-mono text-muted-foreground">${Number(hist.aiCost || 0).toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm font-mono text-muted-foreground">${Number(hist.telephonyCost || 0).toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm font-mono font-medium">${Number(hist.totalCost || 0).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Plans Grid */}
      <div>
        <h2 className="text-lg font-medium tracking-tight mb-4">Available plans</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {plans.map((plan) => {
            const isCurrent = plan.id === currentPlan?.planId || plan.slug === currentPlan?.planId || plan.slug === currentPlan?.slug;
            return (
              <div 
                key={plan.id} 
                className={cn("rounded-lg border border-border bg-card p-6 flex flex-col", isCurrent && "ring-2 ring-foreground")}
              >
                <div className="mb-4">
                  <div className="flex justify-between items-center mb-1">
                    <h3 className="text-base font-medium">{plan.name}</h3>
                    {isCurrent && (
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground">
                        Current
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-3xl font-bold font-mono tabular-nums">${plan.price}</span>
                    <span className="text-sm text-muted-foreground">/mo</span>
                  </div>
                </div>
                
                <div className="flex-1 space-y-4 mb-6 text-sm">
                  <div className="pt-4 border-t border-border">
                    <span className="font-medium block mb-2">Usage limits</span>
                    <ul className="space-y-2 text-muted-foreground">
                      <li className="flex items-center gap-2">
                        <Check className="text-foreground shrink-0" size={16} /> 
                        <span>{plan.maxAgents === 999999 || plan.maxAgents < 0 ? 'Unlimited' : plan.maxAgents} AI Agent{plan.maxAgents === 1 ? '' : 's'}</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="text-foreground shrink-0" size={16} /> 
                        <span>{plan.maxCalls === 999999 || plan.maxCalls < 0 ? 'Unlimited' : plan.maxCalls.toLocaleString()} Calls/mo</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="text-foreground shrink-0" size={16} /> 
                        <span>{plan.maxNumbers === 999999 || plan.maxNumbers < 0 ? 'Unlimited' : plan.maxNumbers} Phone Number{plan.maxNumbers === 1 ? '' : 's'}</span>
                      </li>
                    </ul>
                  </div>

                  {plan.features.length > 0 && (
                    <div className="pt-4 border-t border-border">
                      <span className="font-medium block mb-2">Key features</span>
                      <ul className="space-y-2 text-muted-foreground">
                        {plan.features.map((f, i) => (
                          <li key={i} className="flex items-center gap-2">
                            <Check className="text-foreground shrink-0" size={16} /> 
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
                  className={cn("w-full rounded-md px-4 py-2 text-sm font-medium flex items-center justify-center gap-2", 
                    isCurrent ? "bg-muted text-muted-foreground cursor-default" : "bg-foreground text-background hover:bg-foreground/90"
                  )}
                >
                  {actionLoading === plan.id ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Redirecting...</span>
                    </>
                  ) : isCurrent ? (
                    'Current plan'
                  ) : (
                    'Select plan'
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Payment History */}
      <div>
        <h2 className="text-lg font-medium tracking-tight mb-4">Payment history</h2>
        {paymentHistory.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-12 flex flex-col items-center justify-center text-center">
            <CreditCard className="h-8 w-8 text-muted-foreground mb-3" />
            <h3 className="text-lg font-medium">No billing transactions</h3>
            <p className="text-sm text-muted-foreground mt-1">You do not have any invoices or past payments on record yet.</p>
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-card overflow-x-auto">
            <table className="w-full text-left divide-y divide-border min-w-[640px]">
              <thead>
                <tr>
                  <th scope="col" className="text-left font-medium text-muted-foreground px-4 py-3 text-sm">Date</th>
                  <th scope="col" className="text-left font-medium text-muted-foreground px-4 py-3 text-sm">Amount</th>
                  <th scope="col" className="text-left font-medium text-muted-foreground px-4 py-3 text-sm">Status</th>
                  <th scope="col" className="text-left font-medium text-muted-foreground px-4 py-3 text-sm">Reference ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paymentHistory.map((hist) => (
                  <tr key={hist.id} className="hover:bg-accent/50 transition-colors">
                    <td className="px-4 py-3 text-sm">{hist.date ? new Date(hist.date).toLocaleDateString() : '—'}</td>
                    <td className="px-4 py-3 text-sm font-mono tabular-nums">${Number(hist.amount || 0).toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", getStatusColorClass(hist.status))}>
                        {hist.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-muted-foreground">{hist.paymentId || hist.id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-6">
            <h3 className="text-lg font-medium mb-2">Cancel subscription</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Are you sure you want to cancel your current subscription? You will retain access to your plan features until the end of your current billing period.
            </p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setShowCancelModal(false)}
                className="text-muted-foreground hover:text-foreground hover:bg-accent rounded-md px-4 py-2 text-sm font-medium"
                disabled={actionLoading === 'cancel'}
              >
                Keep subscription
              </button>
              <button 
                onClick={handleCancelSubscription}
                className="bg-red-600 text-white hover:bg-red-700 rounded-md px-4 py-2 text-sm font-medium flex items-center gap-2"
                disabled={actionLoading === 'cancel'}
              >
                {actionLoading === 'cancel' && <Loader2 size={16} className="animate-spin" />}
                Cancel subscription
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
