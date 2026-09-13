/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps */
'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import '@/styles/dashboard.css';
import { FiCheck, FiAlertCircle, FiCreditCard, FiClock } from 'react-icons/fi';

interface Plan {
  id: string;
  name: string;
  price: number;
  features: string[];
  maxAgents: number;
  maxCalls: number;
  maxNumbers: number;
}

interface CurrentPlan {
  planId: string;
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
  const [plans, setPlans] = useState<Plan[]>([]);
  const [currentPlan, setCurrentPlan] = useState<CurrentPlan | null>(null);
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistory[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      fetchBillingData();
    }
  }, [isAuthenticated]);

  const fetchBillingData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [plansRes, myPlanRes, historyRes] = await Promise.all([
        api('/pricing/plans', { token: token || undefined }).catch(() => []),
        api('/pricing/my-plan', { token: token || undefined }).catch(() => null),
        api('/paypal/billing-history', { token: token || undefined }).catch(() => [])
      ]);

      if (plansRes && (plansRes.data ? plansRes.data.length > 0 : plansRes.length > 0)) {
        setPlans(plansRes.data || plansRes);
      } else {
        // Fallback plans for UI purposes if API fails
        setPlans([
          { id: 'starter', name: 'Starter', price: 0, features: ['Basic features'], maxAgents: 1, maxCalls: 100, maxNumbers: 1 },
          { id: 'pro', name: 'Professional', price: 49, features: ['Advanced features', 'Priority support'], maxAgents: 5, maxCalls: 1000, maxNumbers: 5 },
          { id: 'business', name: 'Business', price: 149, features: ['All Pro features', 'Custom integrations'], maxAgents: 15, maxCalls: 5000, maxNumbers: 15 },
          { id: 'enterprise', name: 'Enterprise', price: 499, features: ['All Business features', 'Dedicated account manager'], maxAgents: 50, maxCalls: 20000, maxNumbers: 50 }
        ]);
      }

      if (myPlanRes) {
        setCurrentPlan(myPlanRes.data || myPlanRes);
      } else {
        setCurrentPlan({ planId: 'starter', status: 'active', renewalDate: new Date().toISOString() });
      }

      if (historyRes) {
        setPaymentHistory(historyRes.data || historyRes);
      }

    } catch (err: any) {
      setError(err.message || 'Failed to fetch billing data');
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async (planId: string) => {
    try {
      setActionLoading(planId);
      const res = await api('/paypal/create-subscription', { method: 'POST', body: { planId }, token });
      if (res && res.approvalUrl) {
        window.location.href = res.approvalUrl;
      }
    } catch (err: any) {
      alert(err.message || 'Failed to initiate upgrade');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancelSubscription = async () => {
    try {
      setActionLoading('cancel');
      await api('/paypal/cancel-subscription', { method: 'POST', body: {}, token });
      setShowCancelModal(false);
      fetchBillingData();
    } catch (err: any) {
      alert(err.message || 'Failed to cancel subscription');
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
      <div className="p-6 max-w-7xl mx-auto flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--brand-accent)]"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8" style={{ minHeight: '100vh', backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)' }}>
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Billing & Subscription</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Manage your plan, payments, and invoices.</p>
      </div>

      {error && (
        <div className="p-4 rounded-lg flex items-center gap-3" style={{ backgroundColor: 'var(--red-bg)', color: 'var(--red)' }}>
          <FiAlertCircle />
          <span>{error}</span>
        </div>
      )}

      {/* Current Plan Overview */}
      <div className="p-6 rounded-xl border" style={{ backgroundColor: 'var(--bg-raised)', borderColor: 'var(--border-default)' }}>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h2 className="text-lg font-semibold mb-2">Current Plan</h2>
            <div className="flex items-center gap-3">
              <span className="text-3xl font-bold" style={{ color: 'var(--brand-accent)' }}>
                {plans.find(p => p.id === currentPlan?.planId)?.name || 'Unknown'}
              </span>
              <span className="px-3 py-1 rounded-full text-sm font-medium border" 
                style={{ 
                  color: getStatusColor(currentPlan?.status || ''), 
                  borderColor: getStatusColor(currentPlan?.status || '') 
                }}>
                {currentPlan?.status?.toUpperCase() || 'UNKNOWN'}
              </span>
            </div>
            {currentPlan?.renewalDate && (
              <p className="text-sm mt-2 flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                <FiClock /> Renews on {new Date(currentPlan.renewalDate).toLocaleDateString()}
              </p>
            )}
          </div>
          
          {currentPlan?.planId !== 'starter' && currentPlan?.status !== 'cancelled' && (
            <button 
              onClick={() => setShowCancelModal(true)}
              className="px-4 py-2 rounded-lg border transition-colors text-sm font-medium"
              style={{ backgroundColor: 'var(--red-bg)', borderColor: 'var(--red)', color: 'var(--red)' }}
            >
              Cancel Subscription
            </button>
          )}
        </div>
      </div>

      {/* Plans Grid */}
      <div>
        <h2 className="text-xl font-bold mb-4">Available Plans</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map((plan) => {
            const isCurrent = plan.id === currentPlan?.planId;
            return (
              <div key={plan.id} className={`p-6 rounded-xl border flex flex-col ${isCurrent ? 'ring-2 ring-[var(--brand-accent)]' : ''}`}
                style={{ backgroundColor: 'var(--bg-raised)', borderColor: isCurrent ? 'var(--brand-accent)' : 'var(--border-default)' }}>
                <div className="mb-4">
                  <h3 className="text-xl font-bold">{plan.name}</h3>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-3xl font-bold">${plan.price}</span>
                    <span style={{ color: 'var(--text-secondary)' }}>/mo</span>
                  </div>
                </div>
                
                <div className="flex-1 space-y-4 mb-6 text-sm">
                  <div>
                    <strong style={{ color: 'var(--text-primary)' }}>Limits:</strong>
                    <ul className="mt-2 space-y-2" style={{ color: 'var(--text-secondary)' }}>
                      <li className="flex items-center gap-2"><FiCheck className="text-[var(--brand-accent)]"/> {plan.maxAgents} Agents max</li>
                      <li className="flex items-center gap-2"><FiCheck className="text-[var(--brand-accent)]"/> {plan.maxCalls.toLocaleString()} Calls/mo</li>
                      <li className="flex items-center gap-2"><FiCheck className="text-[var(--brand-accent)]"/> {plan.maxNumbers} Phone Numbers</li>
                    </ul>
                  </div>
                  <div>
                    <strong style={{ color: 'var(--text-primary)' }}>Features:</strong>
                    <ul className="mt-2 space-y-2" style={{ color: 'var(--text-secondary)' }}>
                      {plan.features.map((f, i) => (
                        <li key={i} className="flex items-center gap-2">
                          <FiCheck className="text-[var(--brand-accent)]"/> {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                
                <button
                  disabled={isCurrent || actionLoading !== null}
                  onClick={() => handleUpgrade(plan.id)}
                  className="w-full py-2.5 rounded-lg font-medium transition-colors border"
                  style={{ 
                    backgroundColor: isCurrent ? 'var(--bg-hover)' : 'var(--brand-accent)', 
                    borderColor: isCurrent ? 'var(--border-subtle)' : 'var(--brand-accent)',
                    color: isCurrent ? 'var(--text-secondary)' : '#fff',
                    opacity: actionLoading === plan.id ? 0.7 : 1
                  }}
                >
                  {actionLoading === plan.id ? 'Processing...' : isCurrent ? 'Current Plan' : 'Upgrade'}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Payment History */}
      <div>
        <h2 className="text-xl font-bold mb-4">Payment History</h2>
        {paymentHistory.length === 0 ? (
          <div className="p-8 text-center rounded-xl border" style={{ backgroundColor: 'var(--bg-raised)', borderColor: 'var(--border-default)' }}>
            <FiCreditCard className="mx-auto h-12 w-12 mb-4 opacity-30 text-[var(--text-tertiary)]" />
            <p className="text-lg" style={{ color: 'var(--text-secondary)' }}>You're on the free plan.</p>
            <p className="text-sm mt-1" style={{ color: 'var(--text-tertiary)' }}>Upgrade to unlock more features.</p>
          </div>
        ) : (
          <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: 'var(--bg-raised)', borderColor: 'var(--border-default)' }}>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-hover)', color: 'var(--text-secondary)' }} className="border-b border-[var(--border-subtle)]">
                    <th className="p-4 font-medium text-sm">Date</th>
                    <th className="p-4 font-medium text-sm">Amount</th>
                    <th className="p-4 font-medium text-sm">Status</th>
                    <th className="p-4 font-medium text-sm">Payment ID</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                  {paymentHistory.map((hist) => (
                    <tr key={hist.id} className="hover:bg-[var(--bg-hover)] transition-colors">
                      <td className="p-4 text-sm" style={{ color: 'var(--text-secondary)' }}>{new Date(hist.date).toLocaleDateString()}</td>
                      <td className="p-4 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>${hist.amount.toFixed(2)}</td>
                      <td className="p-4 text-sm">
                        <span style={{ color: getStatusColor(hist.status) }}>{hist.status}</span>
                      </td>
                      <td className="p-4 text-sm font-mono" style={{ color: 'var(--text-tertiary)' }}>{hist.paymentId}</td>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="p-6 rounded-xl border max-w-md w-full shadow-xl" style={{ backgroundColor: 'var(--bg-raised)', borderColor: 'var(--border-default)' }}>
            <h3 className="text-xl font-bold mb-2">Cancel Subscription?</h3>
            <p className="mb-6" style={{ color: 'var(--text-secondary)' }}>
              Are you sure you want to cancel? You will lose access to premium features at the end of your current billing cycle.
            </p>
            <div className="flex gap-4 justify-end">
              <button 
                onClick={() => setShowCancelModal(false)}
                className="px-4 py-2 rounded-lg border"
                style={{ backgroundColor: 'var(--bg-hover)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
              >
                Keep Plan
              </button>
              <button 
                onClick={handleCancelSubscription}
                disabled={actionLoading === 'cancel'}
                className="px-4 py-2 rounded-lg font-medium"
                style={{ backgroundColor: 'var(--red)', color: '#fff' }}
              >
                {actionLoading === 'cancel' ? 'Cancelling...' : 'Yes, Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

