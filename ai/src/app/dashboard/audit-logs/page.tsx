/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps */
'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { CustomSelect } from '@/components/dashboard/shared/CustomSelect';
import { EmptyState } from '@/components/dashboard/shared/EmptyState';
import { SkeletonRows } from '@/components/dashboard/shared/SkeletonRows';
import { Search, ShieldAlert, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import '@/styles/dashboard.css';

interface AuditLog {
  id: string;
  timestamp?: string;
  created_at?: string;
  actorEmail?: string;
  actor_email?: string;
  action: string;
  resourceType?: string;
  resource_type?: string;
  details: any;
}

export default function AuditLogsPage() {
  const { token, isAuthenticated } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  
  // Filters
  const [search, setSearch] = useState('');
  const [actionType, setActionType] = useState('ALL');
  
  useEffect(() => {
    if (isAuthenticated) {
      fetchLogs();
    }
  }, [isAuthenticated, page, actionType]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: '15',
        ...(actionType !== 'ALL' && { action: actionType }),
        ...(search && { search })
      });
      
      const response = await api(`/audit?${queryParams}`, { token: token || undefined });
      if (response) {
        const rawLogs = response.logs || response.data || (Array.isArray(response) ? response : []);
        setLogs(rawLogs);
        setTotalPages(response.totalPages || Math.ceil((response.total || rawLogs.length) / 15) || 1);
        setTotal(response.total || rawLogs.length);
      } else {
        setLogs([]);
        setTotal(0);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch audit logs');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchLogs();
  };

  const formatTimestamp = (raw?: string) => {
    if (!raw) return '—';
    try {
      const d = new Date(raw);
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return '—';
    }
  };

  const formatDetails = (details: any) => {
    if (!details) return '—';
    if (typeof details === 'string') {
      try {
        const parsed = JSON.parse(details);
        return typeof parsed === 'object' ? Object.entries(parsed).map(([k, v]) => `${k}: ${v}`).join(', ') : details;
      } catch {
        return details;
      }
    }
    if (typeof details === 'object') {
      const entries = Object.entries(details).filter(([, v]) => v !== undefined && v !== null && v !== '');
      if (entries.length === 0) return '—';
      return entries.slice(0, 3).map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join(', ');
    }
    return String(details);
  };

  const getActionBadgeClass = (action: string) => {
    const act = (action || '').toLowerCase();
    if (act.includes('create') || act.includes('add') || act.includes('register')) {
      return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    }
    if (act.includes('update') || act.includes('edit') || act.includes('assign')) {
      return 'bg-sky-500/15 text-sky-400 border-sky-500/30';
    }
    if (act.includes('delete') || act.includes('remove') || act.includes('cancel')) {
      return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
    }
    if (act.includes('login') || act.includes('auth')) {
      return 'bg-purple-500/15 text-purple-400 border-purple-500/30';
    }
    return 'bg-white/10 text-gray-300 border-white/10';
  };

  const actionOptions = [
    { value: 'ALL', label: 'All Actions' },
    { value: 'CREATE', label: 'Create' },
    { value: 'UPDATE', label: 'Update' },
    { value: 'DELETE', label: 'Delete' },
    { value: 'LOGIN', label: 'Login' },
  ];

  return (
    <div className="dashboard-content">
      <div className="page-title-section mb-6">
        <div>
          <h1 className="page-title">Audit Logs</h1>
          <p className="page-subtitle">Track security events, data changes, and administrative actions</p>
        </div>
      </div>

      {/* Filters */}
      <div className="p-4 mb-6 rounded-xl border border-default bg-raised flex flex-col md:flex-row gap-4 items-center justify-between">
        <form onSubmit={handleSearch} className="flex-1 w-full flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Search by action, email, or resource..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="form-input pl-9 w-full bg-input text-xs"
            />
          </div>
          <button type="submit" className="btn-secondary text-xs">
            Search
          </button>
        </form>
        
        <div className="w-full md:w-52">
          <CustomSelect
            value={actionType}
            onChange={(e) => {
              setActionType(e.target.value);
              setPage(1);
            }}
            options={actionOptions}
            small
          />
        </div>
      </div>

      {/* Content */}
      <div className="rounded-xl border border-default bg-raised overflow-hidden">
        {loading ? (
          <div className="p-8">
            <SkeletonRows count={5} />
          </div>
        ) : error ? (
          <div className="p-12 text-center text-red-400">
            <ShieldAlert className="mx-auto h-8 w-8 mb-2 opacity-80" />
            <p className="text-sm">{error}</p>
            <button onClick={fetchLogs} className="btn-secondary mt-4 text-xs">
              Retry
            </button>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-10">
            <EmptyState
              icon="shield"
              title="No audit logs found"
              description={search || actionType !== 'ALL' ? "No activity logs match your search filter." : "Audit log entries will record here as actions occur across the organization."}
            />
          </div>
        ) : (
          <div>
            <div className="table-responsive">
              <table className="w-full text-left">
                <thead className="bg-base border-b border-default text-gray-400 text-xs font-medium">
                  <tr>
                    <th className="p-4">Timestamp</th>
                    <th className="p-4">Actor</th>
                    <th className="p-4">Action</th>
                    <th className="p-4">Resource</th>
                    <th className="p-4">Event Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-default">
                  {logs.map((log) => {
                    const timeStr = formatTimestamp(log.timestamp || log.created_at);
                    const actor = log.actorEmail || log.actor_email || 'System';
                    const resource = log.resourceType || log.resource_type || '—';
                    const detailsStr = formatDetails(log.details);

                    return (
                      <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="p-4 text-xs font-mono text-gray-400 whitespace-nowrap">
                          {timeStr}
                        </td>
                        <td className="p-4 text-xs font-medium text-white">
                          {actor}
                        </td>
                        <td className="p-4 text-xs">
                          <span 
                            className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${getActionBadgeClass(log.action)}`}
                          >
                            {log.action}
                          </span>
                        </td>
                        <td className="p-4 text-xs text-gray-300">
                          {resource}
                        </td>
                        <td className="p-4 text-xs font-mono text-gray-400 max-w-sm truncate" title={typeof log.details === 'object' ? JSON.stringify(log.details) : String(log.details)}>
                          {detailsStr}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="p-4 border-t border-default flex justify-between items-center bg-base text-xs text-gray-400">
                <span>
                  Page <span className="text-white font-medium">{page}</span> of <span className="text-white font-medium">{totalPages}</span> ({total} records)
                </span>
                <div className="flex gap-2 items-center">
                  <button 
                    disabled={page === 1}
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    className="btn-secondary py-1 px-2.5 text-xs flex items-center gap-1"
                  >
                    <ChevronLeft size={14} /> Previous
                  </button>
                  <button 
                    disabled={page === totalPages}
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    className="btn-secondary py-1 px-2.5 text-xs flex items-center gap-1"
                  >
                    Next <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
