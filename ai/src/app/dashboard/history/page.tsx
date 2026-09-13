'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/dashboard/shared/ToastProvider';
import { Icon } from '@/components/dashboard/shared/Icon';
import { EmptyState } from '@/components/EmptyState';
import { SkeletonRows } from '@/components/dashboard/shared/SkeletonRows';
import { ConfirmModal } from '@/components/dashboard/shared/ConfirmModal';
import { CustomSelect } from '@/components/dashboard/shared/CustomSelect';
import AudioPlayer from '@/components/AudioPlayer';
import { api } from '@/lib/api';

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

function statusColor(status?: string): string {
  if (!status) return 'unknown';
  const s = status.toLowerCase();
  if (s === 'done' || s === 'success' || s === 'successful') return 'success';
  if (s === 'failed' || s === 'error' || s === 'failure') return 'error';
  if (s === 'no_answer' || s === 'no answer') return 'warning';
  if (s === 'in-progress' || s === 'processing') return 'active';
  return 'unknown';
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
  const [activeTab, setActiveTab] = useState<'overview' | 'transcription' | 'client_data'>('overview');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // Audio player state (passed as props to AudioPlayer component)
  const [audioError, setAudioError] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioBlobUrl, setAudioBlobUrl] = useState<string | null>(null);

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
    // Reset audio state
    if (audioBlobUrl && audioBlobUrl.startsWith('blob:')) { URL.revokeObjectURL(audioBlobUrl); }
    setAudioError(false); setAudioLoading(false); setAudioBlobUrl(null);
    try {
      // Determine provider from selected agent
      const agentProvider = agents.find(a => a.agent_id === selectedAgent)?.provider || 'elevenlabs';
      const providerParam = agentProvider === 'vapi' ? '?provider=vapi' : '';
      const data = await api<ConversationDetail>(`/calls/conversation/${convId}${providerParam}`, { token: token! });
      setConvDetail(data);

      // Load audio via proxy for both ElevenLabs and Vapi
      loadAudio(convId, agentProvider);
    } catch (err) { addToast(err instanceof Error ? err.message : 'Failed to load conversation', 'error'); }
    finally { setDetailLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
        console.warn(`[Audio] Server returned ${resp.status}`);
        setAudioError(true);
        return;
      }
      const contentType = resp.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        // Server returned JSON error
        console.warn('[Audio] Got JSON instead of audio — recording not available');
        setAudioError(true);
        return;
      }
      const blob = await resp.blob();
      if (blob.size === 0) {
        console.warn('[Audio] Empty blob — no recording');
        setAudioError(true);
        return;
      }
      const url = URL.createObjectURL(blob);
      setAudioBlobUrl(url);
    } catch (err) {
      console.error('[Audio] Fetch error:', err);
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
    if (!search.trim()) return conversations;
    const q = search.toLowerCase();
    return conversations.filter(c =>
      c.conversation_id?.toLowerCase().includes(q) ||
      statusLabel(c).toLowerCase().includes(q)
    );
  }, [conversations, search]);

  /* ─── Get agent name ──────────────────────────────────────── */

  const agentName = useMemo(() => {
    const a = agents.find(a => a.agent_id === selectedAgent);
    return a?.name || 'Agent';
  }, [agents, selectedAgent]);

  /* ═══════════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════════ */

  return (
    <>
      <div className="analysis-layout">

        {/* ═══ LEFT PANEL — Conversation List ═══ */}
        <div className="analysis-left">
          <div className="analysis-left-header">
            <h2 className="analysis-title">Analysis</h2>
          </div>

          {/* Search */}
          <div className="analysis-search">
            <Icon name="search" size={14} />
            <input
              type="text"
              placeholder="Search conversations..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Agent selector */}
          <div className="analysis-agent-select" style={{ padding: '0 16px 16px 16px' }}>
            <CustomSelect
              value={selectedAgent}
              onChange={e => { setSelectedAgent(e.target.value); loadHistory(e.target.value); }}
              options={agents.map(a => ({ value: a.agent_id, label: a.name }))}
            />
          </div>

          {/* Conversation list */}
          <div className="analysis-list">
            {loading ? (
              <div style={{ padding: '16px' }}><SkeletonRows count={6} /></div>
            ) : filtered.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  icon="inbox"
                  title={search ? "No calls found" : "No conversations"}
                  description={search ? "No calls match your search query." : "No call recordings found for this agent yet."}
                />
              </div>
            ) : (
              filtered.map((conv) => {
                const isSelected = selectedConvId === conv.conversation_id;
                const sc = statusColor(conv.call_successful || conv.status);
                return (
                  <div
                    key={conv.conversation_id}
                    className={`analysis-list-item border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors duration-150 ${isSelected ? 'selected' : ''}`}
                    onClick={() => selectConversation(conv.conversation_id)}
                  >
                    <div className="analysis-list-item-main">
                      <span className="analysis-list-item-title">
                        {conv.conversation_id ? `${conv.conversation_id.slice(0, 24)}…` : 'Untitled'}
                      </span>
                      <span className="analysis-list-item-meta">
                        {relativeDate(conv.start_time_unix_secs)} · {fmtDuration(conv.call_duration_secs)}
                      </span>
                    </div>
                    <span className={`analysis-status-badge ${sc}`}>
                      {statusLabel(conv)}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ═══ CENTER PANEL — Conversation Detail ═══ */}
        <div className="analysis-center">
          {!selectedConvId ? (
            <div className="h-full flex items-center justify-center p-8">
              <EmptyState
                icon="message-square"
                title="Select a conversation"
                description="Choose a conversation from the list to view its details, transcription, and analysis."
              />
            </div>
          ) : detailLoading ? (
            <div className="analysis-center-loading">
              <div className="spinner" />
              <span>Loading conversation...</span>
            </div>
          ) : convDetail ? (
            <>
              {/* Conversation header */}
              <div className="analysis-detail-header">
                <h3>Conversation with {agentName}</h3>
                <span className="analysis-conv-id">
                  {convDetail.conversation_id}
                </span>
              </div>

              {/* ── Premium Audio Player ── */}
              <AudioPlayer
                src={audioBlobUrl}
                loading={audioLoading}
                error={audioError}
                duration={convDetail.metadata?.call_duration_secs}
                conversationId={convDetail.conversation_id}
                token={token!}
                provider={convDetail.provider}
              />

              {/* Tabs */}
              <div style={{ padding: '0 28px', marginTop: '16px', marginBottom: '8px' }}>
                <div className="tab-pill-group" role="tablist">
                  {(['overview', 'transcription', 'client_data'] as const).map(tab => (
                    <button
                      type="button"
                      role="tab"
                      aria-selected={activeTab === tab}
                      key={tab}
                      className={`tab-pill ${activeTab === tab ? 'tab-pill-active active' : ''}`}
                      onClick={() => setActiveTab(tab)}
                    >
                      {tab === 'overview' ? 'Overview' : tab === 'transcription' ? 'Transcription' : 'Client data'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tab content */}
              <div className="analysis-tab-content">
                {activeTab === 'overview' && <OverviewTab detail={convDetail} />}
                {activeTab === 'transcription' && <TranscriptionTab detail={convDetail} agentName={agentName} />}
                {activeTab === 'client_data' && <ClientDataTab detail={convDetail} />}
              </div>
            </>
          ) : null}
        </div>

        {/* ═══ RIGHT PANEL — Metadata Sidebar ═══ */}
        {convDetail && (
          <div className="analysis-right">
            <div className="analysis-right-header">
              <span>Metadata</span>
              <button className="btn-icon" onClick={() => { setSelectedConvId(null); setConvDetail(null); }}>
                <Icon name="x" size={14} />
              </button>
            </div>
            <MetadataSidebar detail={convDetail} onDelete={() => setDeleteTarget(convDetail.conversation_id)} />
          </div>
        )}
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
    </>
  );
}


/* ═══════════════════════════════════════════════════════════════
   OVERVIEW TAB
   ═══════════════════════════════════════════════════════════════ */

function OverviewTab({ detail }: { detail: ConversationDetail }) {
  const summary = detail.analysis?.transcript_summary;
  const callStatus = detail.analysis?.call_successful || detail.status || 'unknown';
  const sc = statusColor(callStatus);

  return (
    <div className="analysis-overview">
      {/* Summary */}
      {summary && (
        <div className="analysis-overview-section">
          <h4>Summary</h4>
          <p className="analysis-summary-text">{summary}</p>
        </div>
      )}

      {/* Call status */}
      <div className="analysis-overview-row">
        <span className="analysis-overview-label">Call status</span>
        <span className={`analysis-status-badge ${sc}`}>
          {callStatus === 'success' ? 'Successful' : callStatus === 'failure' ? 'Failed' : callStatus.charAt(0).toUpperCase() + callStatus.slice(1)}
        </span>
      </div>

      {/* Status */}
      <div className="analysis-overview-row">
        <span className="analysis-overview-label">Conversation status</span>
        <span className="analysis-overview-value">{detail.status || '—'}</span>
      </div>

      {/* Evaluation criteria */}
      {detail.analysis?.evaluation_criteria_results && Object.keys(detail.analysis.evaluation_criteria_results).length > 0 && (
        <div className="analysis-overview-section">
          <h4>Evaluation Criteria</h4>
          {Object.entries(detail.analysis.evaluation_criteria_results).map(([key, val]) => (
            <div key={key} className="analysis-overview-row">
              <span className="analysis-overview-label">{key}</span>
              <span className="analysis-overview-value">{String(val)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Data collection */}
      {detail.analysis?.data_collection_results && Object.keys(detail.analysis.data_collection_results).length > 0 && (
        <div className="analysis-overview-section">
          <h4>Data Collection</h4>
          {Object.entries(detail.analysis.data_collection_results).map(([key, val]) => (
            <div key={key} className="analysis-overview-row">
              <span className="analysis-overview-label">{key}</span>
              <span className="analysis-overview-value">{String(val)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Feedback */}
      {detail.metadata?.feedback && (
        <div className="analysis-overview-section">
          <h4>Feedback</h4>
          {detail.metadata.feedback.score !== undefined && (
            <div className="analysis-overview-row">
              <span className="analysis-overview-label">Rating</span>
              <span className="analysis-overview-value">{'⭐'.repeat(detail.metadata.feedback.score)}</span>
            </div>
          )}
          {detail.metadata.feedback.comment && (
            <div className="analysis-overview-row">
              <span className="analysis-overview-label">Comment</span>
              <span className="analysis-overview-value">{detail.metadata.feedback.comment}</span>
            </div>
          )}
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
      <div className="p-8">
        <EmptyState
          icon="message-square"
          title="No transcript available"
          description="No transcript entries were recorded for this conversation."
        />
      </div>
    );
  }

  return (
    <div className="analysis-transcript">
      {transcript.map((entry, i) => {
        const isAgent = entry.role === 'agent';
        const isSystem = entry.role === 'system' || entry.role === 'tool';
        const timeStr = entry.time_in_call_secs !== undefined
          ? fmtDuration(entry.time_in_call_secs) : '';

        if (isSystem) {
          return (
            <div key={i} className="transcript-system">
              <Icon name="terminal" size={12} />
              <span>{entry.tool_name || 'System'}: {entry.message || entry.tool_output || '—'}</span>
            </div>
          );
        }

        return (
          <div key={i} className={`transcript-bubble-row ${isAgent ? 'agent' : 'user'}`}>
            {isAgent && (
              <div className="transcript-bubble-avatar agent">
                <Icon name="bot" size={14} />
              </div>
            )}
            <div className="transcript-bubble-content">
              {isAgent && (
                <span className="transcript-bubble-name">{agentName}</span>
              )}
              <div className={`transcript-bubble ${isAgent ? 'agent' : 'user'}`}>
                <p>{entry.message}</p>
                {timeStr && <span className="transcript-bubble-time">{timeStr}</span>}
              </div>
              {/* Latency badges */}
              <div className="transcript-latency">
                {entry.llm_latency !== undefined && entry.llm_latency > 0 && (
                  <span className="latency-badge llm">LLM {entry.llm_latency}ms</span>
                )}
                {entry.tts_latency !== undefined && entry.tts_latency > 0 && (
                  <span className="latency-badge tts">TTS {entry.tts_latency}ms</span>
                )}
                {entry.asr_latency !== undefined && entry.asr_latency > 0 && (
                  <span className="latency-badge asr">ASR {entry.asr_latency}ms</span>
                )}
              </div>
            </div>
            {!isAgent && (
              <div className="transcript-bubble-avatar user">
                <Icon name="user" size={14} />
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
    <div className="analysis-client-data">
      {/* Dynamic Variables */}
      <div className="analysis-client-section">
        <h4>Dynamic Variables</h4>
        {Object.keys(dynVars).length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon="database"
              title="No dynamic variables"
              description="No dynamic variables were sent with this conversation."
            />
          </div>
        ) : (
          <div className="border border-white/[0.08] rounded-lg overflow-hidden ">
            <table className="w-full text-left border-collapse">
              <thead className="bg-white/[0.02] border-b border-white/[0.08]">
                <tr className="h-10">
                  <th className="py-2.5 px-4 text-xs font-semibold tracking-wider uppercase text-secondary">Variable Key</th>
                  <th className="py-2.5 px-4 text-xs font-semibold tracking-wider uppercase text-secondary">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {Object.entries(dynVars).map(([key, val]) => (
                  <tr key={key} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors duration-150">
                    <td className="py-3 px-4 text-xs font-mono text-secondary font-medium">{key}</td>
                    <td className={`py-3 px-4 text-xs font-mono ${!val ? 'text-gray-500 italic' : 'text-gray-200'}`}>
                      {val || 'EMPTY STRING'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Config Override */}
      {Object.keys(configOverride).length > 0 && (
        <div className="analysis-client-section">
          <h4>Configuration Override</h4>
          <pre className="analysis-client-json">
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

  return (
    <div className="analysis-metadata">
      {/* Provider badge */}
      {isVapi && (
        <div className="analysis-meta-row">
          <span className="analysis-meta-label">Provider</span>
          <span className="analysis-meta-value" style={{ color: 'var(--brand-accent)', fontWeight: 600 }}>Vapi</span>
        </div>
      )}
      <div className="analysis-meta-row">
        <span className="analysis-meta-label">Date</span>
        <span className="analysis-meta-value">{fmtDate(meta.start_time_unix_secs)}</span>
      </div>
      <div className="analysis-meta-row">
        <span className="analysis-meta-label">Status</span>
        <span className={`analysis-status-badge ${statusColor(detail.status)}`}>
          {detail.status || '—'}
        </span>
      </div>
      <div className="analysis-meta-row">
        <span className="analysis-meta-label">Duration</span>
        <span className="analysis-meta-value">{fmtDuration(meta.call_duration_secs)}</span>
      </div>
      {meta.endedReason && (
        <div className="analysis-meta-row">
          <span className="analysis-meta-label">Ended Reason</span>
          <span className="analysis-meta-value" style={{ fontSize: 11 }}>{meta.endedReason}</span>
        </div>
      )}
      {meta.type && (
        <div className="analysis-meta-row">
          <span className="analysis-meta-label">Call Type</span>
          <span className="analysis-meta-value">{meta.type}</span>
        </div>
      )}
      {meta.cost !== undefined && (
        <div className="analysis-meta-row">
          <span className="analysis-meta-label">Total Cost</span>
          <span className="analysis-meta-value">${typeof meta.cost === 'number' ? meta.cost.toFixed(4) : meta.cost}</span>
        </div>
      )}

      {/* Vapi cost breakdown */}
      {cb && (cb.llm || cb.tts || cb.stt || cb.transport || cb.vapi) ? (
        <div style={{ padding: '8px 0', borderTop: '1px solid var(--border-faint)', marginTop: 4 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-quaternary)', marginBottom: 6 }}>Cost Breakdown</div>
          {cb.llm ? <div className="analysis-meta-row"><span className="analysis-meta-label" style={{ fontSize: 11 }}>LLM</span><span className="analysis-meta-value">${cb.llm.toFixed(4)}</span></div> : null}
          {cb.tts ? <div className="analysis-meta-row"><span className="analysis-meta-label" style={{ fontSize: 11 }}>TTS</span><span className="analysis-meta-value">${cb.tts.toFixed(4)}</span></div> : null}
          {cb.stt ? <div className="analysis-meta-row"><span className="analysis-meta-label" style={{ fontSize: 11 }}>STT</span><span className="analysis-meta-value">${cb.stt.toFixed(4)}</span></div> : null}
          {cb.transport ? <div className="analysis-meta-row"><span className="analysis-meta-label" style={{ fontSize: 11 }}>Transport</span><span className="analysis-meta-value">${cb.transport.toFixed(4)}</span></div> : null}
          {cb.vapi ? <div className="analysis-meta-row"><span className="analysis-meta-label" style={{ fontSize: 11 }}>Vapi Fee</span><span className="analysis-meta-value">${cb.vapi.toFixed(4)}</span></div> : null}
        </div>
      ) : null}

      {charging?.developer_cost_in_credits_per_minute !== undefined && (
        <div className="analysis-meta-row">
          <span className="analysis-meta-label">Cost/min</span>
          <span className="analysis-meta-value">{charging.developer_cost_in_credits_per_minute} credits/min</span>
        </div>
      )}

      {/* Model / Voice / Transcriber config (Vapi) */}
      {meta.model && (
        <div style={{ padding: '8px 0', borderTop: '1px solid var(--border-faint)', marginTop: 4 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-quaternary)', marginBottom: 6 }}>Model Config</div>
          {meta.model.provider && <div className="analysis-meta-row"><span className="analysis-meta-label" style={{ fontSize: 11 }}>Provider</span><span className="analysis-meta-value">{meta.model.provider}</span></div>}
          {meta.model.model && <div className="analysis-meta-row"><span className="analysis-meta-label" style={{ fontSize: 11 }}>Model</span><span className="analysis-meta-value" style={{ fontSize: 11 }}>{meta.model.model}</span></div>}
          {meta.model.temperature !== null && meta.model.temperature !== undefined && <div className="analysis-meta-row"><span className="analysis-meta-label" style={{ fontSize: 11 }}>Temperature</span><span className="analysis-meta-value">{meta.model.temperature}</span></div>}
        </div>
      )}
      {meta.voice && (
        <div style={{ padding: '8px 0', borderTop: '1px solid var(--border-faint)', marginTop: 4 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-quaternary)', marginBottom: 6 }}>Voice Config</div>
          {meta.voice.provider && <div className="analysis-meta-row"><span className="analysis-meta-label" style={{ fontSize: 11 }}>Provider</span><span className="analysis-meta-value">{meta.voice.provider}</span></div>}
          {meta.voice.voiceId && <div className="analysis-meta-row"><span className="analysis-meta-label" style={{ fontSize: 11 }}>Voice ID</span><span className="analysis-meta-value mono" style={{ fontSize: 10 }}>{meta.voice.voiceId.slice(0, 16)}…</span></div>}
        </div>
      )}
      {meta.transcriber && (
        <div style={{ padding: '8px 0', borderTop: '1px solid var(--border-faint)', marginTop: 4 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-quaternary)', marginBottom: 6 }}>Transcriber</div>
          {meta.transcriber.provider && <div className="analysis-meta-row"><span className="analysis-meta-label" style={{ fontSize: 11 }}>Provider</span><span className="analysis-meta-value">{meta.transcriber.provider}</span></div>}
          {meta.transcriber.model && <div className="analysis-meta-row"><span className="analysis-meta-label" style={{ fontSize: 11 }}>Model</span><span className="analysis-meta-value">{meta.transcriber.model}</span></div>}
          {meta.transcriber.language && <div className="analysis-meta-row"><span className="analysis-meta-label" style={{ fontSize: 11 }}>Language</span><span className="analysis-meta-value">{meta.transcriber.language}</span></div>}
        </div>
      )}

      {meta.usage && (meta.usage.promptTokens || meta.usage.completionTokens || meta.usage.totalTokens) ? (
        <div style={{ padding: '8px 0', borderTop: '1px solid var(--border-faint)', marginTop: 4 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-quaternary)', marginBottom: 6 }}>Token Usage</div>
          {meta.usage.promptTokens !== undefined && <div className="analysis-meta-row"><span className="analysis-meta-label" style={{ fontSize: 11 }}>Prompt</span><span className="analysis-meta-value">{meta.usage.promptTokens}</span></div>}
          {meta.usage.completionTokens !== undefined && <div className="analysis-meta-row"><span className="analysis-meta-label" style={{ fontSize: 11 }}>Completion</span><span className="analysis-meta-value">{meta.usage.completionTokens}</span></div>}
          {meta.usage.totalTokens !== undefined && <div className="analysis-meta-row"><span className="analysis-meta-label" style={{ fontSize: 11 }}>Total</span><span className="analysis-meta-value">{meta.usage.totalTokens}</span></div>}
        </div>
      ) : null}

      <div className="analysis-meta-row">
        <span className="analysis-meta-label">Auth method</span>
        <span className="analysis-meta-value">{meta.authorization_method || '—'}</span>
      </div>
      <div className="analysis-meta-row">
        <span className="analysis-meta-label">Conversation ID</span>
        <span className="analysis-meta-value mono" title={detail.conversation_id}>{detail.conversation_id.slice(0, 20)}…</span>
      </div>
      <div className="analysis-meta-row">
        <span className="analysis-meta-label">Agent ID</span>
        <span className="analysis-meta-value mono" title={detail.agent_id}>{detail.agent_id.slice(0, 20)}…</span>
      </div>

      {/* Transcript message count & Latency */}
      {detail.transcript && detail.transcript.length > 0 && (
        <>
          <div className="analysis-meta-row">
            <span className="analysis-meta-label">Messages</span>
            <span className="analysis-meta-value">{detail.transcript.length}</span>
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
              <div style={{ padding: '8px 0', borderTop: '1px solid var(--border-faint)', marginTop: 4 }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-quaternary)', marginBottom: 6 }}>Avg Latency</div>
                {avgLlm ? <div className="analysis-meta-row"><span className="analysis-meta-label" style={{ fontSize: 11 }}>LLM</span><span className="analysis-meta-value">{avgLlm}ms</span></div> : null}
                {avgAsr ? <div className="analysis-meta-row"><span className="analysis-meta-label" style={{ fontSize: 11 }}>ASR</span><span className="analysis-meta-value">{avgAsr}ms</span></div> : null}
                {avgTts ? <div className="analysis-meta-row"><span className="analysis-meta-label" style={{ fontSize: 11 }}>TTS</span><span className="analysis-meta-value">{avgTts}ms</span></div> : null}
              </div>
            );
          })()}
        </>
      )}

      {/* Success Evaluation (Vapi) */}
      {detail.analysis?.successEvaluation && (
        <div className="analysis-meta-row">
          <span className="analysis-meta-label">Evaluation</span>
          <span className="analysis-meta-value" style={{ fontSize: 11 }}>{detail.analysis.successEvaluation}</span>
        </div>
      )}

      {/* Recording link (Vapi) */}
      {meta.recordingUrl && (
        <div className="analysis-meta-row">
          <span className="analysis-meta-label">Recording</span>
          <a href={meta.recordingUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: 'var(--brand-accent)' }}>Listen ↗</a>
        </div>
      )}

      {/* Delete button */}
      <div style={{ padding: '16px 0', borderTop: '1px solid var(--border-faint)', marginTop: '8px' }}>
        <button className="btn-danger" style={{ width: '100%', justifyContent: 'center' }} onClick={onDelete}>
          <Icon name="trash-2" size={14} />
          Delete conversation
        </button>
      </div>
    </div>
  );
}
