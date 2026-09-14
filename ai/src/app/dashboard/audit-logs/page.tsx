/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps */
'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Search, ShieldAlert, Loader2, ChevronLeft, ChevronRight, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

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
      return 'bg-emerald-500/10 text-emerald-400';
    }
    if (act.includes('update') || act.includes('edit') || act.includes('assign')) {
      return 'bg-blue-500/10 text-blue-400';
    }
    if (act.includes('delete') || act.includes('remove') || act.includes('cancel')) {
      return 'bg-red-500/10 text-red-400';
    }
    return 'bg-muted text-muted-foreground';
  };

  const actionOptions = [
    { value: 'ALL', label: 'All actions' },
    { value: 'CREATE', label: 'Create' },
    { value: 'UPDATE', label: 'Update' },
    { value: 'DELETE', label: 'Delete' },
    { value: 'LOGIN', label: 'Login' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Audit logs</h1>
        <p className="text-sm text-muted-foreground mt-1">Track security events, data changes, and administrative actions</p>
      </div>

      {/* Filters */}
      <div className="rounded-lg border border-border bg-card p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
        <form onSubmit={handleSearch} className="flex-1 w-full flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" size={16} />
            <input
              type="text"
              placeholder="Search by action, email, or resource..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring pl-9"
            />
          </div>
          <button type="submit" className="text-muted-foreground hover:text-foreground hover:bg-accent rounded-md px-4 py-2 text-sm border border-border">
            Search
          </button>
        </form>
        
        <div className="w-full md:w-52">
          <select
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            value={actionType}
            onChange={(e) => {
              setActionType(e.target.value);
              setPage(1);
            }}
          >
            {actionOptions.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Content */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-4">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-10 w-full rounded-md bg-muted animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="p-12 text-center text-red-400">
            <ShieldAlert className="mx-auto h-8 w-8 mb-2 opacity-80" />
            <p className="text-sm">{error}</p>
            <button onClick={fetchLogs} className="mt-4 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md px-3 py-2 text-sm border border-border">
              Retry
            </button>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center text-center">
            <Shield className="h-8 w-8 text-muted-foreground mb-3" />
            <h3 className="text-lg font-medium">No audit logs found</h3>
            <p className="text-sm text-muted-foreground mt-1">{search || actionType !== 'ALL' ? "No activity logs match your search filter." : "Audit log entries will record here as actions occur across the organization."}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left divide-y divide-border">
              <thead>
                <tr>
                  <th className="text-left font-medium text-muted-foreground px-4 py-3 text-sm">Timestamp</th>
                  <th className="text-left font-medium text-muted-foreground px-4 py-3 text-sm">Actor</th>
                  <th className="text-left font-medium text-muted-foreground px-4 py-3 text-sm">Action</th>
                  <th className="text-left font-medium text-muted-foreground px-4 py-3 text-sm">Resource</th>
                  <th className="text-left font-medium text-muted-foreground px-4 py-3 text-sm">Event details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {logs.map((log) => {
                  const timeStr = formatTimestamp(log.timestamp || log.created_at);
                  const actor = log.actorEmail || log.actor_email || 'System';
                  const resource = log.resourceType || log.resource_type || '—';
                  const detailsStr = formatDetails(log.details);

                  return (
                    <tr key={log.id} className="hover:bg-accent/50 transition-colors">
                      <td className="px-4 py-3 text-sm font-mono text-muted-foreground whitespace-nowrap">
                        {timeStr}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium">
                        {actor}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span 
                          className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", getActionBadgeClass(log.action))}
                        >
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {resource}
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-muted-foreground max-w-sm truncate" title={typeof log.details === 'object' ? JSON.stringify(log.details) : String(log.details)}>
                        {detailsStr}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/20">
                <p className="text-sm text-muted-foreground">
                  Showing page {page} of {totalPages} ({total} records)
                </p>
                <div className="flex gap-1">
                  <button 
                    disabled={page === 1}
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    className="text-muted-foreground hover:text-foreground hover:bg-accent rounded-md px-3 py-1.5 text-sm flex items-center gap-1 disabled:opacity-50"
                  >
                    <ChevronLeft size={16} /> Previous
                  </button>
                  <button 
                    disabled={page === totalPages}
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    className="text-muted-foreground hover:text-foreground hover:bg-accent rounded-md px-3 py-1.5 text-sm flex items-center gap-1 disabled:opacity-50"
                  >
                    Next <ChevronRight size={16} />
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
