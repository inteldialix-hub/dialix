'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/dashboard/shared/ToastProvider';
import { Icon } from '@/components/dashboard/shared/Icon';
import { EmptyState } from '@/components/dashboard/shared/EmptyState';
import { SkeletonRows } from '@/components/dashboard/shared/SkeletonRows';
import { CustomSelect } from '@/components/dashboard/shared/CustomSelect';
import { api } from '@/lib/api';
import {
  FALLBACK_LLM_OPTIONS,
  FALLBACK_TTS_MODEL_OPTIONS,
  FALLBACK_LANGUAGE_OPTIONS,
  AGENT_PROVIDERS,
  VAPI_MODEL_PROVIDERS,
  VAPI_LLM_OPTIONS,
  VAPI_VOICE_PROVIDERS,
  VAPI_TRANSCRIBER_PROVIDERS,
} from '@/lib/constants';

/**
 * Agents list page + Create Agent modal.
 * Supports both ElevenLabs and Vapi providers.
 */

interface Agent {
  agent_id: string;
  name: string;
  language?: string;
  llm?: string;
  tags?: string[];
  provider?: string;
}

interface Voice {
  voice_id: string;
  name: string;
}

export default function AgentsPage() {
  const { token } = useAuth();
  const { addToast } = useToast();
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [voices, setVoices] = useState<Voice[]>([]);

  const loadAgents = useCallback(async () => {
    try {
      const data = await api<{ agents: Agent[] }>('/agents', { token: token! });
      setAgents(data.agents || []);
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to load agents', 'error');
    } finally {
      setLoading(false);
    }
  }, [token, addToast]);

  useEffect(() => {
    if (!token) return;
    loadAgents();
  }, [token, loadAgents]);

  const loadVoices = async () => {
    try {
      const data = await api<{ voices: Voice[] }>('/agents/voices', { token: token! });
      setVoices(data.voices || []);
    } catch {
      // non-critical
    }
  };

  const handleOpenCreate = () => {
    loadVoices();
    setShowCreate(true);
  };

  const iconColors = ['purple', 'blue', 'orange', 'green', 'pink', 'cyan', 'red', 'indigo'];

  if (loading) return <SkeletonRows count={5} />;

  return (
    <>
      <div className="page-title-section">
        <h2>Agents</h2>
        <p>Create and manage your AI calling agents</p>
      </div>

      <div style={{ padding: '0 40px 16px', display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn-primary" onClick={handleOpenCreate} style={{ marginLeft: 0 }}>
          <Icon name="plus" size={14} /> New Agent
        </button>
      </div>

      {agents.length === 0 ? (
        <EmptyState icon="bot" title="No agents yet" description="Create your first AI agent to start making calls." action="Create Agent" onAction={handleOpenCreate} />
      ) : (
        <div>
          <div className="agent-list-header">
            <span style={{ flex: 1 }}>Agent</span>
            <span style={{ width: 90 }}>Provider</span>
            <span style={{ width: 100 }}>Language</span>
            <span style={{ width: 140 }}>Model</span>
            <span style={{ width: 40 }} />
          </div>
          {agents.map((agent, i) => (
            <div key={agent.agent_id} className="agent-row" onClick={() => router.push(`/dashboard/agents/${agent.agent_id}`)}>
              <div className={`agent-icon ${iconColors[i % iconColors.length]}`}>
                <Icon name="bot" size={16} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span className="agent-name">{agent.name}</span>
                <span className="agent-id">{agent.agent_id.slice(0, 16)}...</span>
              </div>
              <div style={{ width: 90 }}>
                <span className={`provider-badge ${(agent.provider || 'elevenlabs') === 'vapi' ? 'provider-vapi' : 'provider-elevenlabs'}`}>
                  {(agent.provider || 'elevenlabs') === 'vapi' ? 'Vapi' : 'ElevenLabs'}
                </span>
              </div>
              <div style={{ width: 100 }}>
                <span className="agent-lang-badge">{(agent.language || 'en').toUpperCase()}</span>
              </div>
              <div style={{ width: 140 }}>
                <span className="agent-llm-badge">{agent.llm || 'GPT-4o Mini'}</span>
              </div>
              <div className="expand-arrow"><Icon name="chevron-right" size={14} /></div>
            </div>
          ))}
        </div>
      )}

      {/* Create Agent Modal */}
      {showCreate && (
        <CreateAgentModal
          token={token!}
          voices={voices}
          onClose={() => setShowCreate(false)}
          onCreated={(agent) => {
            setAgents(prev => [agent, ...prev]);
            setShowCreate(false);
          }}
        />
      )}
    </>
  );
}

// ── Create Agent Modal ───────────────────────────────────────
function CreateAgentModal({ token, voices, onClose, onCreated }: {
  token: string;
  voices: Voice[];
  onClose: () => void;
  onCreated: (agent: Agent) => void;
}) {
  const { addToast } = useToast();

  // Provider selection
  const [provider, setProvider] = useState<'elevenlabs' | 'vapi'>('elevenlabs');

  // Shared fields
  const [name, setName] = useState('');
  const [firstMessage, setFirstMessage] = useState('');
  const [language, setLanguage] = useState('en');
  const [temperature, setTemperature] = useState(0.7);
  const [prompt, setPrompt] = useState('');
  const [maxDuration, setMaxDuration] = useState(300);
  const [creating, setCreating] = useState(false);

  // ElevenLabs-specific
  const [llm, setLlm] = useState('gpt-4o-mini');
  const [ttsModel, setTtsModel] = useState('eleven_v3_conversational');
  const [voiceId, setVoiceId] = useState('');

  // Vapi-specific
  const [modelProvider, setModelProvider] = useState('openai');
  const [vapiLlm, setVapiLlm] = useState('gpt-4o-mini');
  const [voiceProvider, setVoiceProvider] = useState('11labs');
  const [vapiVoiceId, setVapiVoiceId] = useState('');
  const [transcriberProvider, setTranscriberProvider] = useState('deepgram');

  // When model provider changes, reset LLM to first available
  useEffect(() => {
    const options = VAPI_LLM_OPTIONS[modelProvider];
    if (options && options.length > 0) {
      setVapiLlm(options[0].value);
    }
  }, [modelProvider]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { addToast('Agent name is required', 'error'); return; }
    setCreating(true);

    try {
      const baseBody: Record<string, unknown> = {
        provider,
        name: name.trim(),
        first_message: firstMessage || `Hello! I'm ${name.trim()}. How can I help you today?`,
        language,
        temperature,
        prompt: prompt || `You are ${name.trim()}, a helpful AI assistant.`,
        max_duration_seconds: maxDuration,
      };

      if (provider === 'elevenlabs') {
        Object.assign(baseBody, {
          llm,
          tts_model_id: ttsModel,
          voice_id: voiceId || undefined,
        });
      } else {
        // Vapi
        Object.assign(baseBody, {
          model_provider: modelProvider,
          llm: vapiLlm,
          voice_provider: voiceProvider,
          voice_id: vapiVoiceId || undefined,
          transcriber_provider: transcriberProvider,
        });
      }

      const result = await api<{ agent: Agent }>('/agents', {
        token, method: 'POST',
        body: baseBody,
      });
      addToast(`Agent "${name}" created!`, 'success');
      onCreated(result.agent);
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to create agent', 'error');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', maxHeight: '85vh', overflow: 'auto' }}>
        <div className="modal-header">
          <Icon name="bot" size={16} /><span>Create New Agent</span>
          <div style={{ flex: 1 }} />
          <div className="btn-icon" onClick={onClose}><Icon name="x" size={14} /></div>
        </div>
        <form onSubmit={handleCreate}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Provider Selection */}
            <div className="admin-section-title" style={{ fontSize: '11px', marginBottom: '0' }}>Provider</div>
            <div className="form-group">
              <label className="form-label">Agent Provider</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {AGENT_PROVIDERS.map(p => (
                  <button
                    key={p.value}
                    type="button"
                    className={`btn-ghost ${provider === p.value ? 'provider-tab-active' : ''}`}
                    onClick={() => setProvider(p.value as 'elevenlabs' | 'vapi')}
                    style={{
                      flex: 1,
                      padding: '10px 16px',
                      border: provider === p.value ? '1px solid var(--brand-accent)' : '1px solid var(--border)',
                      borderRadius: '8px',
                      background: provider === p.value ? 'rgba(124, 58, 237, 0.1)' : 'transparent',
                      color: provider === p.value ? 'var(--brand-accent)' : 'var(--text-secondary)',
                      fontWeight: provider === p.value ? 600 : 400,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Identity */}
            <div className="admin-section-title" style={{ fontSize: '11px', marginBottom: '0' }}>Identity</div>
            <div className="form-group">
              <label className="form-label">Agent Name *</label>
              <input className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Sales Agent" required autoFocus />
            </div>
            <div className="form-group">
              <label className="form-label">First Message</label>
              <textarea className="form-input" value={firstMessage} onChange={e => setFirstMessage(e.target.value)} placeholder={`Hello! I'm ${name || 'Agent'}. How can I help?`} rows={2} style={{ resize: 'vertical' }} />
            </div>
            <div className="form-group">
              <label className="form-label">Language</label>
              <CustomSelect value={language} onChange={e => setLanguage(e.target.value)} options={FALLBACK_LANGUAGE_OPTIONS} placeholder="Select language" />
            </div>

            {/* AI Model */}
            <div className="admin-section-title" style={{ fontSize: '11px', marginBottom: '0' }}>AI Model</div>

            {provider === 'elevenlabs' ? (
              /* ── ElevenLabs Model Config ── */
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">LLM</label>
                    <CustomSelect value={llm} onChange={e => setLlm(e.target.value)} options={FALLBACK_LLM_OPTIONS} placeholder="Select LLM" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Temperature: {temperature.toFixed(2)}</label>
                    <input type="range" className="config-slider" min="0" max="1" step="0.05" value={temperature} onChange={e => setTemperature(parseFloat(e.target.value))} />
                  </div>
                </div>
              </>
            ) : (
              /* ── Vapi Model Config ── */
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Model Provider</label>
                    <CustomSelect value={modelProvider} onChange={e => setModelProvider(e.target.value)} options={VAPI_MODEL_PROVIDERS} placeholder="Select provider" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">LLM</label>
                    <CustomSelect
                      value={vapiLlm}
                      onChange={e => setVapiLlm(e.target.value)}
                      options={VAPI_LLM_OPTIONS[modelProvider] || []}
                      placeholder="Select model"
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Temperature: {temperature.toFixed(2)}</label>
                  <input type="range" className="config-slider" min="0" max="1" step="0.05" value={temperature} onChange={e => setTemperature(parseFloat(e.target.value))} />
                </div>
              </>
            )}

            <div className="form-group">
              <label className="form-label">System Prompt</label>
              <textarea className="form-input" value={prompt} onChange={e => setPrompt(e.target.value)} placeholder={`You are ${name || 'Agent'}, a helpful AI assistant.`} rows={4} style={{ resize: 'vertical' }} />
            </div>

            {/* Voice */}
            <div className="admin-section-title" style={{ fontSize: '11px', marginBottom: '0' }}>Voice</div>

            {provider === 'elevenlabs' ? (
              /* ── ElevenLabs Voice Config ── */
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">TTS Model</label>
                    <CustomSelect value={ttsModel} onChange={e => setTtsModel(e.target.value)} options={FALLBACK_TTS_MODEL_OPTIONS} placeholder="Select TTS model" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Max Duration (sec)</label>
                    <input className="form-input" type="number" value={maxDuration} onChange={e => setMaxDuration(parseInt(e.target.value))} min="30" max="3600" />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Voice</label>
                  <CustomSelect value={voiceId} onChange={e => setVoiceId(e.target.value)} options={[{ value: '', label: '(Default voice)' }, ...voices.map(v => ({ value: v.voice_id, label: v.name }))]} placeholder="Select voice" />
                </div>
              </>
            ) : (
              /* ── Vapi Voice Config ── */
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Voice Provider</label>
                    <CustomSelect value={voiceProvider} onChange={e => setVoiceProvider(e.target.value)} options={VAPI_VOICE_PROVIDERS} placeholder="Select voice provider" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Voice ID</label>
                    <input className="form-input" value={vapiVoiceId} onChange={e => setVapiVoiceId(e.target.value)} placeholder="e.g., rachel or voice ID" />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Transcriber</label>
                    <CustomSelect value={transcriberProvider} onChange={e => setTranscriberProvider(e.target.value)} options={VAPI_TRANSCRIBER_PROVIDERS} placeholder="Select transcriber" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Max Duration (sec)</label>
                    <input className="form-input" type="number" value={maxDuration} onChange={e => setMaxDuration(parseInt(e.target.value))} min="30" max="3600" />
                  </div>
                </div>
              </>
            )}
          </div>
          <div className="modal-footer" style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={creating || !name.trim()} style={{ marginLeft: 0 }}>
              {creating ? <><div className="spinner" /> Creating...</> : <><Icon name="plus" size={13} /> Create Agent</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
