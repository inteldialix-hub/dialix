'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/dashboard/shared/ToastProvider';
import { EmptyState } from '@/components/EmptyState';
import { SkeletonRows } from '@/components/dashboard/shared/SkeletonRows';
import { ConfirmModal } from '@/components/dashboard/shared/ConfirmModal';
import { CustomSelect } from '@/components/dashboard/shared/CustomSelect';
import AudioPlayer from '@/components/AudioPlayer';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Search, Bot, User, Terminal, Trash2, X, Inbox, MessageSquare, Database } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

/* ─── Types ─────────────────────────────────────────────────── */

interface Agent { agent_id: string; name: string; provider?: string; }

interface ConversationListItem {
  conversation_id: string;
  agent_id?: string;
  status?: string;
  call_successful?: string;
  start_time_unix_secs?: number;
  call_duration_secs?: number;
  message_count?: number;
  metadata?: Record<string, unknown>;
}

interface TranscriptEntry {
  role: string;
  message: string;
  time_in_call_secs?: number;
  tool_name?: string;
  tool_input?: string;
  tool_output?: string;
  latency?: number;
  tts_latency?: number;
  llm_latency?: number;
  asr_latency?: number;
}

interface ConversationDetail {
  id?: number;
  conversation_id: string;
  agent_id: string;
  status: string;
  provider?: string;
  transcript?: TranscriptEntry[];
  metadata?: {
    start_time_unix_secs?: number;
    call_duration_secs?: number;
    cost?: number;
    costBreakdown?: { transport?: number; stt?: number; llm?: number; tts?: number; vapi?: number };
    deletion_settings?: Record<string, unknown>;
    feedback?: { score?: number; comment?: string };
    authorization_method?: string;
    charging?: { dev_discount?: boolean; developer_cost_in_credits_per_minute?: number };
    endedReason?: string;
    type?: string;
    recordingUrl?: string;
    stereoRecordingUrl?: string;
    videoRecordingUrl?: string;
    model?: { provider?: string; model?: string; temperature?: number | null };
    voice?: { provider?: string; voiceId?: string };
    transcriber?: { provider?: string; model?: string; language?: string };
    usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number };
  };
  analysis?: {
    evaluation_criteria_results?: Record<string, unknown>;
    data_collection_results?: Record<string, unknown>;
    call_successful?: string;
    transcript_summary?: string;
    successEvaluation?: string;
    structuredData?: Record<string, unknown>;
    sentiment?: string;
    outcome?: string;
    qualification_score?: number;
    key_topics?: string[];
    analyzed_at?: string;
  };
  conversation_initiation_client_data?: {
    dynamic_variables?: Record<string, string>;
    conversation_config_override?: Record<string, unknown>;
    custom_llm_extra_body?: Record<string, unknown>;
  };
}

/* ─── Helpers ────────────────────────────────────────────────── */

function fmtDuration(secs?: number): string {
  if (!secs && secs !== 0) return '—';
  const s = Math.round(Number(secs));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function fmtDate(unix?: number): string {
  if (!unix) return '—';
  const ts = unix > 1e12 ? unix : unix * 1000;
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function relativeDate(unix?: number): string {
  if (!unix) return '—';
  const ts = unix > 1e12 ? unix : unix * 1000;
  const now = Date.now();
  const diff = now - ts;
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 60) return 'Last month';
  return `${Math.floor(days / 30)} months ago`;
}

function getStatusColorClass(status?: string): string {
  if (!status) return 'bg-muted text-muted-foreground';
  const s = status.toLowerCase();
  if (s === 'done' || s === 'success' || s === 'successful') return 'bg-emerald-500/10 text-emerald-400';
  if (s === 'failed' || s === 'error' || s === 'failure') return 'bg-red-500/10 text-red-400';
  if (s === 'no_answer' || s === 'no answer') return 'bg-yellow-500/10 text-yellow-400';
  if (s === 'in-progress' || s === 'processing') return 'bg-blue-500/10 text-blue-400';
  return 'bg-muted text-muted-foreground';
}

function statusLabel(item: ConversationListItem): string {
  const callStatus = item.call_successful || item.status || 'unknown';
  const s = callStatus.toLowerCase();
  if (s === 'done' || s === 'success') return 'Successful';
  if (s === 'failed' || s === 'error' || s === 'failure') return 'Error';
  if (s === 'no_answer' || s === 'no answer') return 'No answer';
  if (s === 'processing') return 'Processing';
  if (s === 'in-progress') return 'In Progress';
  return callStatus.charAt(0).toUpperCase() + callStatus.slice(1);
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════ */

export default function AnalysisPage() {
  const { token } = useAuth();
  const { addToast } = useToast();

  // Data state
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState('');
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [convDetail, setConvDetail] = useState<ConversationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [activeTab, setActiveTab] = useState<'overview' | 'transcription' | 'client_data'>('overview');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // Audio player state
  const [audioError, setAudioError] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioBlobUrl, setAudioBlobUrl] = useState<string | null>(null);

  // Analysis state
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const runAnalysis = async () => {
    if (!convDetail?.id) return;
    setIsAnalyzing(true);
    try {
      const res = await api<any>(`/calls/${convDetail.id}/analyze`, {
        method: 'POST',
        token: token!
      });
      if (res.success && res.data) {
        setConvDetail(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            analysis: {
              ...prev.analysis,
              transcript_summary: res.data.summary,
              sentiment: res.data.sentiment,
              outcome: res.data.outcome,
              qualification_score: res.data.qualification_score,
              key_topics: res.data.key_topics ? JSON.parse(res.data.key_topics) : null,
              analyzed_at: res.data.analyzed_at
            }
          };
        });
        addToast('Analysis completed', 'success');
      }
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to analyze', 'error');
    } finally {
      setIsAnalyzing(false);
    }
  };

  /* ─── Load agents ─────────────────────────────────────────── */

  const loadHistory = useCallback(async (agentId: string) => {
    setLoading(true);
    setSelectedConvId(null);
    setConvDetail(null);
    try {
      const data = await api<{ conversations: ConversationListItem[] }>(`/calls/history/${agentId}`, { token: token! });
      setConversations(data.conversations || []);
    } catch (err) { addToast(err instanceof Error ? err.message : 'Failed to load conversations', 'error'); }
    finally { setLoading(false); }
  }, [token, addToast]);

  const loadAgents = useCallback(async () => {
    try {
      const data = await api<{ agents: Agent[] }>('/agents', { token: token! });
      setAgents(data.agents || []);
      if (data.agents?.length) {
        setSelectedAgent(data.agents[0].agent_id);
        await loadHistory(data.agents[0].agent_id);
      } else {
        setLoading(false);
      }
    } catch (err) { addToast(err instanceof Error ? err.message : 'Failed', 'error'); setLoading(false); }
  }, [token, addToast, loadHistory]);

  useEffect(() => { if (token) loadAgents(); }, [token, loadAgents]);

  /* ─── Load conversation detail ────────────────────────────── */

  const loadConversation = useCallback(async (convId: string) => {
    setDetailLoading(true);
    setActiveTab('overview');
    if (audioBlobUrl && audioBlobUrl.startsWith('blob:')) { URL.revokeObjectURL(audioBlobUrl); }
    setAudioError(false); setAudioLoading(false); setAudioBlobUrl(null);
    try {
      const agentProvider = agents.find(a => a.agent_id === selectedAgent)?.provider || 'elevenlabs';
      const providerParam = agentProvider === 'vapi' ? '?provider=vapi' : '';
      const data = await api<ConversationDetail>(`/calls/conversation/${convId}${providerParam}`, { token: token! });
      setConvDetail(data);
      loadAudio(convId, agentProvider);
    } catch (err) { addToast(err instanceof Error ? err.message : 'Failed to load conversation', 'error'); }
    finally { setDetailLoading(false); }
  }, [token, addToast, audioBlobUrl, agents, selectedAgent]);

  const loadAudio = useCallback(async (convId: string, provider: string) => {
    setAudioLoading(true);
    setAudioError(false);
    try {
      const providerParam = provider === 'vapi' ? '?provider=vapi' : '';
      const resp = await fetch(`${API_BASE}/api/calls/conversation/${convId}/audio${providerParam}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!resp.ok) {
        setAudioError(true);
        return;
      }
      const contentType = resp.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        setAudioError(true);
        return;
      }
      const blob = await resp.blob();
      if (blob.size === 0) {
        setAudioError(true);
        return;
      }
      const url = URL.createObjectURL(blob);
      setAudioBlobUrl(url);
    } catch (err) {
      setAudioError(true);
    } finally {
      setAudioLoading(false);
    }
  }, [token]);

  const selectConversation = useCallback((convId: string) => {
    setSelectedConvId(convId);
    loadConversation(convId);
  }, [loadConversation]);

  /* ─── Delete conversation ─────────────────────────────────── */

  const handleDelete = async (convId: string) => {
    try {
      await api(`/admin/conversations/${convId}`, { token: token!, method: 'DELETE' });
      setConversations(prev => prev.filter(c => c.conversation_id !== convId));
      if (selectedConvId === convId) { setSelectedConvId(null); setConvDetail(null); }
      setDeleteTarget(null);
      addToast('Conversation deleted', 'success');
    } catch (err) { addToast(err instanceof Error ? err.message : 'Failed to delete', 'error'); setDeleteTarget(null); }
  };

  /* ─── Filtered conversations ──────────────────────────────── */

  const filtered = useMemo(() => {
    let result = conversations;
    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter(c => {
        const s = (c.call_successful || c.status || '').toLowerCase();
        if (statusFilter === 'success') return s === 'done' || s === 'success' || s === 'successful';
        if (statusFilter === 'failed') return s === 'failed' || s === 'error' || s === 'failure';
        if (statusFilter === 'processing') return s === 'processing' || s === 'in-progress';
        return true;
      });
    }
    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(c =>
        c.conversation_id?.toLowerCase().includes(q) ||
        statusLabel(c).toLowerCase().includes(q)
      );
    }
    return result;
  }, [conversations, search, statusFilter]);

  const agentName = useMemo(() => {
    const a = agents.find(a => a.agent_id === selectedAgent);
    return a?.name || 'Agent';
  }, [agents, selectedAgent]);

  return (
    <div className="flex h-[calc(100vh-64px)] w-full">
      {/* ═══ LEFT PANEL — Conversation List ═══ */}
      <div className={cn("w-full md:w-[340px] flex-shrink-0 flex flex-col border-r border-border bg-background transition-all", selectedConvId ? "hidden md:flex" : "flex")}>
        <div className="p-4 border-b border-border">
          <h2 className="text-lg font-semibold tracking-tight mb-4">Analysis</h2>
          <div className="flex flex-col gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
              <input
                type="text"
                placeholder="Search conversations..."
                className="w-full rounded-md border border-border bg-background pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <CustomSelect
              value={selectedAgent}
              onChange={e => { setSelectedAgent(e.target.value); loadHistory(e.target.value); }}
              options={agents.map(a => ({ value: a.agent_id, label: a.name }))}
            />
            <div className="flex gap-2">
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="all">All statuses</option>
                <option value="success">Successful</option>
                <option value="failed">Failed</option>
                <option value="processing">Processing</option>
              </select>
              <button
                type="button"
                onClick={() => {
                  const csv = ['ID,Status,Duration (s),Date'].concat(
                    filtered.map(c => `${c.conversation_id},${statusLabel(c)},${c.call_duration_secs || 0},${c.start_time_unix_secs ? new Date(c.start_time_unix_secs * 1000).toISOString() : ''}`)
                  ).join('\n');
                  const blob = new Blob([csv], { type: 'text/csv' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url; a.download = `call-history-${agentName}.csv`; a.click();
                  URL.revokeObjectURL(url);
                  addToast('CSV exported', 'success');
                }}
                className="rounded-md border border-border bg-background px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                title="Export CSV"
              >
                CSV
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4"><SkeletonRows count={6} /></div>
          ) : filtered.length === 0 ? (
            <div className="p-4">
              <EmptyState
                icon={Inbox}
                title={search ? "No calls found" : "No conversations"}
                description={search ? "No calls match your search query." : "No call recordings found for this agent yet."}
              />
            </div>
          ) : (
            filtered.map((conv) => {
              const isSelected = selectedConvId === conv.conversation_id;
              const scClass = getStatusColorClass(conv.call_successful || conv.status);
              return (
                <div
                  key={conv.conversation_id}
                  className={cn(
                    "flex flex-col gap-1 p-3 border-b border-border cursor-pointer transition-colors",
                    isSelected ? "bg-accent" : "hover:bg-accent/50"
                  )}
                  onClick={() => selectConversation(conv.conversation_id)}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground truncate">
                      {conv.conversation_id ? `${conv.conversation_id.slice(0, 24)}…` : 'Untitled'}
                    </span>
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase", scClass)}>
                      {statusLabel(conv)}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {relativeDate(conv.start_time_unix_secs)} · {fmtDuration(conv.call_duration_secs)}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ═══ CENTER PANEL — Conversation Detail ═══ */}
      <div className={cn("flex-1 flex flex-col overflow-hidden bg-background", selectedConvId ? "flex" : "hidden md:flex")}>
        {!selectedConvId ? (
          <div className="h-full flex items-center justify-center p-8">
            <EmptyState
              icon={MessageSquare}
              title="Select a conversation"
              description="Choose a conversation from the list to view its details, transcription, and analysis."
            />
          </div>
        ) : detailLoading ? (
          <div className="h-full flex items-center justify-center">
            <span className="text-sm text-muted-foreground">Loading conversation...</span>
          </div>
        ) : convDetail ? (
          <div className="flex flex-col lg:flex-row h-full">
            <div className="flex-1 flex flex-col overflow-y-auto">
              <div className="p-4 md:p-6 border-b border-border">
                <div className="flex items-center gap-3 mb-4 md:hidden">
                  <button 
                    onClick={() => { setSelectedConvId(null); setConvDetail(null); }}
                    className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                  >
                    <span className="font-medium">← Back to list</span>
                  </button>
                </div>
                <h3 className="text-xl font-semibold tracking-tight mb-1">Conversation with {agentName}</h3>
                <span className="text-sm text-muted-foreground font-mono truncate block max-w-full">{convDetail.conversation_id}</span>
                
                <div className="mt-6">
                  <AudioPlayer
                    src={audioBlobUrl}
                    loading={audioLoading}
                    error={audioError}
                    duration={convDetail.metadata?.call_duration_secs}
                    conversationId={convDetail.conversation_id}
                    token={token!}
                    provider={convDetail.provider}
                  />
                </div>

                <div className="border-b border-border mt-8 overflow-x-auto">
                  <nav className="flex gap-6 min-w-max">
                    {(['overview', 'transcription', 'client_data'] as const).map(tab => (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={cn(
                          "pb-3 text-sm font-medium transition-colors border-b-2 -mb-px capitalize",
                          activeTab === tab
                            ? "border-foreground text-foreground"
                            : "border-transparent text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {tab.replace('_', ' ')}
                      </button>
                    ))}
                  </nav>
                </div>
              </div>

              <div className="p-4 md:p-6 flex-1 overflow-y-auto">
                {activeTab === 'overview' && <OverviewTab detail={convDetail} onRunAnalysis={runAnalysis} isAnalyzing={isAnalyzing} />}
                {activeTab === 'transcription' && <TranscriptionTab detail={convDetail} agentName={agentName} />}
                {activeTab === 'client_data' && <ClientDataTab detail={convDetail} />}
              </div>
            </div>

            {/* Right Panel Metadata */}
            <div className="w-full lg:w-[300px] border-t lg:border-t-0 lg:border-l border-border bg-card overflow-y-auto flex-shrink-0">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <span className="font-semibold text-sm">Metadata</span>
                <button className="text-muted-foreground hover:text-foreground hidden lg:block" onClick={() => { setSelectedConvId(null); setConvDetail(null); }}>
                  <X size={16} />
                </button>
              </div>
              <MetadataSidebar detail={convDetail} onDelete={() => setDeleteTarget(convDetail.conversation_id)} />
            </div>
          </div>
        ) : null}
      </div>

      {deleteTarget && (
        <ConfirmModal
          title="Delete Conversation"
          message="This will permanently delete this conversation. This cannot be undone."
          confirmLabel="Delete"
          onConfirm={() => handleDelete(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
          danger
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   OVERVIEW TAB
   ═══════════════════════════════════════════════════════════════ */

function OverviewTab({ detail, onRunAnalysis, isAnalyzing }: { detail: ConversationDetail; onRunAnalysis: () => void; isAnalyzing: boolean }) {
  const summary = detail.analysis?.transcript_summary;
  const callStatus = detail.analysis?.call_successful || detail.status || 'unknown';
  const scClass = getStatusColorClass(callStatus);

  return (
    <div className="flex flex-col gap-8 max-w-3xl">
      <div className="flex justify-between items-start">
        {summary ? (
          <div className="flex-1">
            <h4 className="text-sm font-semibold mb-2">Summary</h4>
            <p className="text-sm text-muted-foreground leading-relaxed">{summary}</p>
            {detail.analysis?.analyzed_at && (
              <span className="text-[10px] text-muted-foreground mt-2 block">
                Analyzed at: {new Date(detail.analysis.analyzed_at).toLocaleString()}
              </span>
            )}
          </div>
        ) : (
          <div className="flex-1">
            <h4 className="text-sm font-semibold mb-2">Summary</h4>
            <p className="text-sm text-muted-foreground italic">No summary available.</p>
          </div>
        )}
        
        {detail.id && !detail.analysis?.analyzed_at && (
          <button 
            onClick={onRunAnalysis}
            disabled={isAnalyzing}
            className="ml-4 flex-shrink-0 bg-primary/10 hover:bg-primary/20 text-primary px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
          >
            {isAnalyzing ? 'Analyzing...' : 'Run Analysis'}
          </button>
        )}
      </div>

      {(detail.analysis?.sentiment || detail.analysis?.outcome || detail.analysis?.qualification_score !== undefined) && (
        <div>
          <h4 className="text-sm font-semibold mb-3">AI Analysis</h4>
          <div className="grid grid-cols-3 gap-4">
            {detail.analysis?.sentiment && (
              <div className="rounded-lg border border-border bg-card p-4">
                <span className="block text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wider">Sentiment</span>
                <span className="font-medium capitalize">{detail.analysis.sentiment}</span>
              </div>
            )}
            {detail.analysis?.outcome && (
              <div className="rounded-lg border border-border bg-card p-4">
                <span className="block text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wider">Outcome</span>
                <span className="font-medium capitalize">{detail.analysis.outcome.replace('_', ' ')}</span>
              </div>
            )}
            {detail.analysis?.qualification_score !== undefined && (
              <div className="rounded-lg border border-border bg-card p-4">
                <span className="block text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wider">Score</span>
                <span className="font-medium">{detail.analysis.qualification_score}/100</span>
              </div>
            )}
          </div>
          {detail.analysis?.key_topics && detail.analysis.key_topics.length > 0 && (
             <div className="mt-4">
               <span className="block text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Key Topics</span>
               <div className="flex gap-2 flex-wrap">
                 {detail.analysis.key_topics.map((t: string) => (
                   <span key={t} className="bg-accent text-accent-foreground px-2 py-1 rounded-md text-xs">{t}</span>
                 ))}
               </div>
             </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <span className="block text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wider">Call status</span>
          <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium uppercase inline-block", scClass)}>
            {callStatus === 'success' ? 'Successful' : callStatus === 'failure' ? 'Failed' : callStatus}
          </span>
        </div>
        <div>
          <span className="block text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wider">Conversation status</span>
          <span className="text-sm">{detail.status || '—'}</span>
        </div>
      </div>

      {detail.analysis?.evaluation_criteria_results && Object.keys(detail.analysis.evaluation_criteria_results).length > 0 && (
        <div>
          <h4 className="text-sm font-semibold mb-3">Evaluation Criteria</h4>
          <div className="rounded-lg border border-border bg-card divide-y divide-border">
            {Object.entries(detail.analysis.evaluation_criteria_results).map(([key, val]) => (
              <div key={key} className="flex justify-between items-center p-3 text-sm">
                <span className="text-muted-foreground">{key}</span>
                <span className="font-medium">{String(val)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {detail.analysis?.data_collection_results && Object.keys(detail.analysis.data_collection_results).length > 0 && (
        <div>
          <h4 className="text-sm font-semibold mb-3">Data Collection</h4>
          <div className="rounded-lg border border-border bg-card divide-y divide-border">
            {Object.entries(detail.analysis.data_collection_results).map(([key, val]) => (
              <div key={key} className="flex justify-between items-center p-3 text-sm">
                <span className="text-muted-foreground">{key}</span>
                <span className="font-medium">{String(val)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {detail.metadata?.feedback && (
        <div>
          <h4 className="text-sm font-semibold mb-3">Feedback</h4>
          <div className="rounded-lg border border-border bg-card divide-y divide-border">
            {detail.metadata.feedback.score !== undefined && (
              <div className="flex justify-between items-center p-3 text-sm">
                <span className="text-muted-foreground">Rating</span>
                <span>{'⭐'.repeat(detail.metadata.feedback.score)}</span>
              </div>
            )}
            {detail.metadata.feedback.comment && (
              <div className="flex justify-between items-center p-3 text-sm">
                <span className="text-muted-foreground">Comment</span>
                <span>{detail.metadata.feedback.comment}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   TRANSCRIPTION TAB
   ═══════════════════════════════════════════════════════════════ */

function TranscriptionTab({ detail, agentName }: { detail: ConversationDetail; agentName: string }) {
  const transcript = (detail.transcript || []).filter(e => e.message?.trim());

  if (transcript.length === 0) {
    return (
      <EmptyState
        icon={MessageSquare}
        title="No transcript available"
        description="No transcript entries were recorded for this conversation."
      />
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      {transcript.map((entry, i) => {
        const isAgent = entry.role === 'agent';
        const isSystem = entry.role === 'system' || entry.role === 'tool';
        const timeStr = entry.time_in_call_secs !== undefined ? fmtDuration(entry.time_in_call_secs) : '';

        if (isSystem) {
          return (
            <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground font-mono bg-accent/30 p-2 rounded-md mx-auto my-2">
              <Terminal size={12} />
              <span>{entry.tool_name || 'System'}: {entry.message || entry.tool_output || '—'}</span>
            </div>
          );
        }

        return (
          <div key={i} className={cn("flex gap-4 w-full", isAgent ? "justify-start" : "justify-end")}>
            {isAgent && (
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                <Bot size={16} className="text-primary" />
              </div>
            )}
            
            <div className={cn("flex flex-col gap-1 max-w-[80%]", isAgent ? "items-start" : "items-end")}>
              {isAgent && <span className="text-xs text-muted-foreground ml-1">{agentName}</span>}
              
              <div className={cn(
                "px-4 py-2.5 text-sm",
                isAgent 
                  ? "bg-card border border-border rounded-2xl rounded-tl-sm" 
                  : "bg-accent rounded-2xl rounded-tr-sm text-foreground"
              )}>
                <p className="whitespace-pre-wrap">{entry.message}</p>
              </div>
              
              <div className="flex items-center gap-2 mt-1 px-1 flex-wrap">
                {timeStr && <span className="text-xs text-muted-foreground font-mono">{timeStr}</span>}
                
                {entry.llm_latency !== undefined && entry.llm_latency > 0 && (
                  <span className="bg-blue-500/10 text-blue-400 rounded-full px-2 py-0.5 text-[10px] font-mono">LLM {entry.llm_latency}ms</span>
                )}
                {entry.tts_latency !== undefined && entry.tts_latency > 0 && (
                  <span className="bg-emerald-500/10 text-emerald-400 rounded-full px-2 py-0.5 text-[10px] font-mono">TTS {entry.tts_latency}ms</span>
                )}
                {entry.asr_latency !== undefined && entry.asr_latency > 0 && (
                  <span className="bg-yellow-500/10 text-yellow-400 rounded-full px-2 py-0.5 text-[10px] font-mono">ASR {entry.asr_latency}ms</span>
                )}
              </div>
            </div>

            {!isAgent && (
              <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center flex-shrink-0 mt-1">
                <User size={16} className="text-foreground" />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   CLIENT DATA TAB
   ═══════════════════════════════════════════════════════════════ */

function ClientDataTab({ detail }: { detail: ConversationDetail }) {
  const initData = detail.conversation_initiation_client_data;
  const dynVars = initData?.dynamic_variables || {};
  const configOverride = initData?.conversation_config_override || {};

  return (
    <div className="flex flex-col gap-8 max-w-3xl">
      <div>
        <h4 className="text-sm font-semibold mb-3">Dynamic Variables</h4>
        {Object.keys(dynVars).length === 0 ? (
          <EmptyState
            icon={Database}
            title="No dynamic variables"
            description="No dynamic variables were sent with this conversation."
          />
        ) : (
          <div className="rounded-lg border border-border bg-card">
            <table className="w-full text-left">
              <thead className="border-b border-border bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Variable Key</th>
                  <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {Object.entries(dynVars).map(([key, val]) => (
                  <tr key={key} className="hover:bg-accent/50 transition-colors">
                    <td className="px-4 py-3 text-sm font-mono">{key}</td>
                    <td className={cn("px-4 py-3 text-sm font-mono", !val && "text-muted-foreground italic")}>
                      {val || 'EMPTY STRING'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {Object.keys(configOverride).length > 0 && (
        <div>
          <h4 className="text-sm font-semibold mb-3">Configuration Override</h4>
          <pre className="rounded-lg border border-border bg-card p-4 text-xs font-mono overflow-x-auto text-foreground">
            {JSON.stringify(configOverride, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   METADATA SIDEBAR
   ═══════════════════════════════════════════════════════════════ */

function MetadataSidebar({ detail, onDelete }: { detail: ConversationDetail; onDelete: () => void }) {
  const meta = detail.metadata || {};
  const charging = meta.charging;
  const isVapi = detail.provider === 'vapi' || meta.authorization_method === 'vapi';
  const cb = meta.costBreakdown;

  const renderRow = (label: string, value: React.ReactNode, valueClass?: string) => (
    <div className="flex justify-between items-start py-2 text-sm">
      <span className="text-muted-foreground mr-4">{label}</span>
      <span className={cn("text-right word-break-all", valueClass)}>{value}</span>
    </div>
  );

  return (
    <div className="p-4 flex flex-col gap-4">
      <div className="divide-y divide-border">
        {isVapi && renderRow('Provider', 'Vapi', 'text-primary font-medium')}
        {renderRow('Date', fmtDate(meta.start_time_unix_secs))}
        {renderRow('Status', (
          <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium uppercase", getStatusColorClass(detail.status))}>
            {detail.status || '—'}
          </span>
        ))}
        {renderRow('Duration', fmtDuration(meta.call_duration_secs))}
        {meta.endedReason && renderRow('Ended Reason', meta.endedReason, 'text-xs')}
        {meta.type && renderRow('Call Type', meta.type)}
        {meta.cost !== undefined && renderRow('Total Cost', `$${typeof meta.cost === 'number' ? meta.cost.toFixed(4) : meta.cost}`)}
      </div>

      {cb && (cb.llm || cb.tts || cb.stt || cb.transport || cb.vapi) && (
        <div>
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Cost Breakdown</div>
          <div className="divide-y divide-border">
            {cb.llm && renderRow('LLM', `$${cb.llm.toFixed(4)}`, 'text-xs')}
            {cb.tts && renderRow('TTS', `$${cb.tts.toFixed(4)}`, 'text-xs')}
            {cb.stt && renderRow('STT', `$${cb.stt.toFixed(4)}`, 'text-xs')}
            {cb.transport && renderRow('Transport', `$${cb.transport.toFixed(4)}`, 'text-xs')}
            {cb.vapi && renderRow('Vapi Fee', `$${cb.vapi.toFixed(4)}`, 'text-xs')}
          </div>
        </div>
      )}

      {charging?.developer_cost_in_credits_per_minute !== undefined && (
        <div className="divide-y divide-border">
          {renderRow('Cost/min', `${charging.developer_cost_in_credits_per_minute} credits/min`)}
        </div>
      )}

      {meta.model && (
        <div>
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Model Config</div>
          <div className="divide-y divide-border">
            {meta.model.provider && renderRow('Provider', meta.model.provider, 'text-xs')}
            {meta.model.model && renderRow('Model', meta.model.model, 'text-xs')}
            {meta.model.temperature !== null && meta.model.temperature !== undefined && renderRow('Temperature', meta.model.temperature, 'text-xs')}
          </div>
        </div>
      )}

      {meta.voice && (
        <div>
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Voice Config</div>
          <div className="divide-y divide-border">
            {meta.voice.provider && renderRow('Provider', meta.voice.provider, 'text-xs')}
            {meta.voice.voiceId && renderRow('Voice ID', `${meta.voice.voiceId.slice(0, 16)}…`, 'text-xs font-mono')}
          </div>
        </div>
      )}

      {meta.transcriber && (
        <div>
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Transcriber</div>
          <div className="divide-y divide-border">
            {meta.transcriber.provider && renderRow('Provider', meta.transcriber.provider, 'text-xs')}
            {meta.transcriber.model && renderRow('Model', meta.transcriber.model, 'text-xs')}
            {meta.transcriber.language && renderRow('Language', meta.transcriber.language, 'text-xs')}
          </div>
        </div>
      )}

      {(meta.usage?.promptTokens || meta.usage?.completionTokens || meta.usage?.totalTokens) && (
        <div>
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Token Usage</div>
          <div className="divide-y divide-border">
            {meta.usage.promptTokens !== undefined && renderRow('Prompt', meta.usage.promptTokens, 'text-xs')}
            {meta.usage.completionTokens !== undefined && renderRow('Completion', meta.usage.completionTokens, 'text-xs')}
            {meta.usage.totalTokens !== undefined && renderRow('Total', meta.usage.totalTokens, 'text-xs')}
          </div>
        </div>
      )}

      <div className="divide-y divide-border mt-4">
        {renderRow('Auth method', meta.authorization_method || '—')}
        {renderRow('Conversation ID', <span className="font-mono text-xs" title={detail.conversation_id}>{detail.conversation_id.slice(0, 20)}…</span>)}
        {renderRow('Agent ID', <span className="font-mono text-xs" title={detail.agent_id}>{detail.agent_id.slice(0, 20)}…</span>)}
      </div>

      {detail.transcript && detail.transcript.length > 0 && (
        <div>
          <div className="divide-y divide-border">
            {renderRow('Messages', detail.transcript.length)}
          </div>
          {(() => {
            const llms = detail.transcript.map(t => t.llm_latency).filter(l => l !== undefined && l > 0) as number[];
            const asrs = detail.transcript.map(t => t.asr_latency).filter(l => l !== undefined && l > 0) as number[];
            const ttss = detail.transcript.map(t => t.tts_latency).filter(l => l !== undefined && l > 0) as number[];
            
            const avgLlm = llms.length ? Math.round(llms.reduce((a, b) => a + b, 0) / llms.length) : null;
            const avgAsr = asrs.length ? Math.round(asrs.reduce((a, b) => a + b, 0) / asrs.length) : null;
            const avgTts = ttss.length ? Math.round(ttss.reduce((a, b) => a + b, 0) / ttss.length) : null;

            if (!avgLlm && !avgAsr && !avgTts) return null;

            return (
              <div className="mt-4">
                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Avg Latency</div>
                <div className="divide-y divide-border">
                  {avgLlm && renderRow('LLM', `${avgLlm}ms`, 'text-xs')}
                  {avgAsr && renderRow('ASR', `${avgAsr}ms`, 'text-xs')}
                  {avgTts && renderRow('TTS', `${avgTts}ms`, 'text-xs')}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {detail.analysis?.successEvaluation && (
        <div className="divide-y divide-border mt-2">
          {renderRow('Evaluation', detail.analysis.successEvaluation, 'text-xs')}
        </div>
      )}

      {meta.recordingUrl && (
        <div className="divide-y divide-border mt-2">
          {renderRow('Recording', <a href={meta.recordingUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-xs">Listen ↗</a>)}
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-border">
        <button 
          className="w-full bg-red-600 text-white hover:bg-red-700 rounded-md px-4 py-2 text-sm font-medium inline-flex items-center justify-center gap-2"
          onClick={onDelete}
        >
          <Trash2 size={16} /> Delete conversation
        </button>
      </div>
    </div>
  );
}
