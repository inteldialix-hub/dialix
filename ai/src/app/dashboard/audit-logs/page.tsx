/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps */
'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import '@/styles/dashboard.css';
import { FiSearch, FiFilter, FiChevronLeft, FiChevronRight, FiClock } from 'react-icons/fi';

interface AuditLog {
  id: string;
  timestamp: string;
  actorEmail: string;
  action: string;
  resourceType: string;
  details: any;
}

export default function AuditLogsPage() {
  const { token, isAuthenticated } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
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
      
      const response = await api(`/audit?${queryParams}`, { token });
      if (response) {
        setLogs(response.logs || response.data || (Array.isArray(response) ? response : []));
        setTotalPages(response.totalPages || 1);
      } else {
        setLogs([]);
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

  const getActionColor = (action: string) => {
    const act = action.toLowerCase();
    if (act.includes('create')) return 'var(--green)';
    if (act.includes('update')) return 'var(--brand-accent)';
    if (act.includes('delete')) return 'var(--red)';
    return 'var(--text-secondary)';
  };

  const getActionBg = (action: string) => {
    const act = action.toLowerCase();
    if (act.includes('create')) return 'var(--green-bg)';
    if (act.includes('update')) return 'rgba(56, 189, 248, 0.1)';
    if (act.includes('delete')) return 'var(--red-bg)';
    return 'var(--bg-hover)';
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6" style={{ minHeight: '100vh', backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)' }}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Audit Logs</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Track all system activities and changes.</p>
        </div>
      </div>

      {/* Filters */}
      <div className="p-4 rounded-xl border flex flex-col md:flex-row gap-4" style={{ backgroundColor: 'var(--bg-raised)', borderColor: 'var(--border-default)' }}>
        <form onSubmit={handleSearch} className="flex-1 flex gap-2">
          <div className="relative flex-1">
            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search logs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border focus:outline-none focus:ring-1 transition-colors"
              style={{ backgroundColor: 'var(--bg-input)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
            />
          </div>
          <button type="submit" className="px-4 py-2 rounded-lg font-medium transition-colors border" style={{ backgroundColor: 'var(--bg-hover)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}>
            Search
          </button>
        </form>
        
        <div className="flex items-center gap-2">
          <FiFilter className="text-gray-400" />
          <select
            value={actionType}
            onChange={(e) => { setActionType(e.target.value); setPage(1); }}
            className="px-4 py-2 rounded-lg border focus:outline-none appearance-none"
            style={{ backgroundColor: 'var(--bg-input)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
          >
            <option value="ALL">All Actions</option>
            <option value="CREATE">Create</option>
            <option value="UPDATE">Update</option>
            <option value="DELETE">Delete</option>
            <option value="LOGIN">Login</option>
          </select>
        </div>
      </div>

      {/* Content */}
      <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: 'var(--bg-raised)', borderColor: 'var(--border-default)' }}>
        {loading ? (
          <div className="p-12 text-center" style={{ color: 'var(--text-secondary)' }}>
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-current mx-auto mb-4"></div>
            Loading audit logs...
          </div>
        ) : error ? (
          <div className="p-12 text-center" style={{ color: 'var(--red)' }}>
            <p>{error}</p>
            <button onClick={fetchLogs} className="mt-4 px-4 py-2 rounded-lg border" style={{ backgroundColor: 'var(--bg-hover)', borderColor: 'var(--border-subtle)' }}>
              Retry
            </button>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center" style={{ color: 'var(--text-tertiary)' }}>
            <FiClock className="mx-auto h-12 w-12 mb-4 opacity-50" />
            <p className="text-lg">No audit logs found</p>
            <p className="text-sm mt-1">Adjust your filters to see more results.</p>
          </div>
        ) : (
          <div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-hover)', color: 'var(--text-secondary)' }} className="border-b border-[var(--border-subtle)]">
                    <th className="p-4 font-medium text-sm">Timestamp</th>
                    <th className="p-4 font-medium text-sm">Actor</th>
                    <th className="p-4 font-medium text-sm">Action</th>
                    <th className="p-4 font-medium text-sm">Resource</th>
                    <th className="p-4 font-medium text-sm">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ divideColor: 'var(--border-subtle)' }}>
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-[var(--bg-hover)] transition-colors">
                      <td className="p-4 text-sm whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="p-4 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                        {log.actorEmail}
                      </td>
                      <td className="p-4 text-sm">
                        <span 
                          className="px-2.5 py-1 rounded-full text-xs font-semibold"
                          style={{ color: getActionColor(log.action), backgroundColor: getActionBg(log.action) }}
                        >
                          {log.action}
                        </span>
                      </td>
                      <td className="p-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
                        {log.resourceType}
                      </td>
                      <td className="p-4 text-sm max-w-xs truncate" style={{ color: 'var(--text-tertiary)' }} title={JSON.stringify(log.details)}>
                        {JSON.stringify(log.details)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Pagination */}
            <div className="p-4 border-t flex justify-between items-center" style={{ borderColor: 'var(--border-subtle)' }}>
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Page {page} of {totalPages}
              </span>
              <div className="flex gap-2">
                <button 
                  disabled={page === 1}
                  onClick={() => setPage(p => p - 1)}
                  className="p-2 rounded border disabled:opacity-50"
                  style={{ backgroundColor: 'var(--bg-input)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
                >
                  <FiChevronLeft />
                </button>
                <button 
                  disabled={page === totalPages}
                  onClick={() => setPage(p => p + 1)}
                  className="p-2 rounded border disabled:opacity-50"
                  style={{ backgroundColor: 'var(--bg-input)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
                >
                  <FiChevronRight />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
