'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/dashboard/shared/ToastProvider';
import { SkeletonRows } from '@/components/dashboard/shared/SkeletonRows';
import { CustomSelect } from '@/components/dashboard/shared/CustomSelect';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Bot, Plus, CheckCircle, Cpu, Radio, Search, TrendingUp, TrendingDown, Minus, ChevronRight, X, Sparkles, ArrowLeft, PlusCircle, Phone } from 'lucide-react';
import { useTopBar } from '@/components/dashboard/TopBarContext';
import TestCallView from '@/components/dashboard/TestCallView';
import {
  FALLBACK_LLM_OPTIONS,
  FALLBACK_TTS_MODEL_OPTIONS,
  FALLBACK_LANGUAGE_OPTIONS,
  AGENT_PROVIDERS,
  VAPI_MODEL_PROVIDERS,
  VAPI_LLM_OPTIONS,
  VAPI_VOICE_PROVIDERS,
  VAPI_TRANSCRIBER_PROVIDERS,
  GEMINI_VOICES,
  GEMINI_MODELS,
} from '@/lib/constants';

interface Agent {
  agent_id: string;
  name: string;
  language?: string;
  llm?: string;
  tags?: string[];
  provider?: string;
  status?: string;
}

interface Voice {
  voice_id: string;
  name: string;
}

interface AgentTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  defaults: {
    first_message?: string;
    prompt?: string;
    temperature?: number;
    max_duration_seconds?: number;
    language?: string;
    llm?: string;
  };
}

export default function AgentsPage() {
  const { token } = useAuth();
  const { addToast } = useToast();
  const { setTopBar } = useTopBar();
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [templates, setTemplates] = useState<AgentTemplate[]>([]);

  const [search, setSearch] = useState('');
  const [providerFilter, setProviderFilter] = useState('');

  // Quick test call state
  const [testCallAgent, setTestCallAgent] = useState<{ id: string; name: string; provider: string } | null>(null);
  const [showQuickPrompt, setShowQuickPrompt] = useState(false);
  const [quickLeadName, setQuickLeadName] = useState('Test User');
  const [showTestCall, setShowTestCall] = useState(false);


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

  const loadTemplates = async () => {
    try {
      const data = await api<{ templates: AgentTemplate[] }>('/agents/templates', { token: token! });
      setTemplates(data.templates || []);
    } catch {
      // non-critical — modal will work without templates
    }
  };

  const handleOpenCreate = useCallback(() => {
    loadVoices();
    loadTemplates();
    setShowCreate(true);
  }, []);

  useEffect(() => {
    setTopBar({
      title: 'Agents',
      subtitle: 'Create and manage your AI calling agents',
      actions: (
        <button 
          onClick={handleOpenCreate}
          className="h-8 px-3 rounded-md bg-foreground text-background hover:bg-foreground/90 text-xs font-semibold transition-all flex items-center gap-1.5 shadow-sm"
        >
          <Plus className="size-3.5" />
          <span>New agent</span>
        </button>
      ),
    });
  }, [setTopBar, handleOpenCreate]);

  const totalAgents = agents.length;
  const activeAgents = agents.filter(a => a.status !== 'unavailable' && a.status !== 'inactive').length;
  const elevenLabsAgents = agents.filter(a => (a.provider || 'elevenlabs').toLowerCase() === 'elevenlabs').length;
  const vapiAgents = agents.filter(a => (a.provider || '').toLowerCase() === 'vapi').length;

  const statCards = [
    {
      label: 'Total agents',
      value: totalAgents,
      icon: Bot,
      trend: totalAgents > 0 ? 'up' : 'neutral',
      trendLabel: totalAgents > 0 ? 'Active' : 'Ready',
    },
    {
      label: 'Active agents',
      value: activeAgents,
      icon: CheckCircle,
      trend: activeAgents > 0 ? 'up' : 'neutral',
      trendLabel: activeAgents > 0 ? 'Operational' : 'Idle',
    },
    {
      label: 'ElevenLabs',
      value: elevenLabsAgents,
      icon: Cpu,
      trend: 'neutral',
      trendLabel: 'Provider',
    },
    {
      label: 'Vapi',
      value: vapiAgents,
      icon: Radio,
      trend: 'neutral',
      trendLabel: 'Provider',
    },
  ];

  const providerOptions = [
    { value: '', label: 'All providers' },
    { value: 'elevenlabs', label: 'ElevenLabs' },
    { value: 'vapi', label: 'Vapi' },
  ];

  const filteredAgents = agents.filter((agent) => {
    const q = search.toLowerCase().trim();
    const matchesSearch = !q ||
      agent.name.toLowerCase().includes(q) ||
      agent.agent_id.toLowerCase().includes(q);
    const effectiveProvider = (agent.provider || 'elevenlabs').toLowerCase();
    const matchesProvider = !providerFilter || effectiveProvider === providerFilter.toLowerCase();
    return matchesSearch && matchesProvider;
  });

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-6">
        <SkeletonRows count={5} />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <div key={i} className="rounded-lg border border-border bg-card p-6 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{card.label}</span>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-2xl font-semibold font-mono tabular-nums">{card.value}</span>
                {card.trend && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    {card.trend === 'up' ? <TrendingUp className="h-3 w-3 text-emerald-400" /> : card.trend === 'down' ? <TrendingDown className="h-3 w-3 text-red-400" /> : <Minus className="h-3 w-3" />}
                    {card.trendLabel}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-lg border border-border bg-card mt-6 overflow-hidden">
        <div className="p-4 border-b border-border flex flex-col md:flex-row items-center justify-between gap-4">
          <h3 className="text-sm font-medium">All agents</h3>
          <div className="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto">
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                placeholder="Search agents..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-9 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div className="w-full md:w-44">
              <CustomSelect
                value={providerFilter}
                onChange={(e) => setProviderFilter(e.target.value)}
                options={providerOptions}
                small
              />
            </div>
          </div>
        </div>

        {agents.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <Bot className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-1">No agents yet</h3>
            <p className="text-sm text-muted-foreground mb-4">Create your first agent to start making calls.</p>
            <button
              onClick={handleOpenCreate}
              className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Create agent
            </button>
          </div>
        ) : filteredAgents.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <Bot className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-1">No matching agents</h3>
            <p className="text-sm text-muted-foreground">No agents match your current search query or provider filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left text-muted-foreground font-medium px-4 py-3">Name</th>
                  <th className="text-left text-muted-foreground font-medium px-4 py-3">Provider</th>
                  <th className="text-left text-muted-foreground font-medium px-4 py-3">Language</th>
                  <th className="text-left text-muted-foreground font-medium px-4 py-3">Model</th>
                  <th className="text-right text-muted-foreground font-medium px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredAgents.map((agent) => {
                  const p = (agent.provider || 'elevenlabs').toLowerCase();
                  const isActive = agent.status !== 'unavailable' && agent.status !== 'inactive';
                  return (
                    <tr key={agent.agent_id} className="hover:bg-accent/50 transition-colors group">
                      <td className="px-4 py-3">
                        <Link href={`/dashboard/agents/${agent.agent_id}`} className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
                            <Bot className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="font-medium flex items-center gap-2">
                              {agent.name}
                              {isActive && <div className="h-2 w-2 rounded-full bg-emerald-400" />}
                            </div>
                            <div className="text-xs text-muted-foreground font-mono mt-0.5">{agent.agent_id.slice(0, 16)}...</div>
                          </div>
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                          p === 'vapi' ? "bg-blue-500/10 text-blue-400" :
                          p === 'gemini' ? "bg-amber-500/10 text-amber-400" :
                          "bg-emerald-500/10 text-emerald-400"
                        )}>
                          {p === 'vapi' ? 'Vapi' : p === 'gemini' ? 'Gemini' : 'ElevenLabs'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground">
                          {(agent.language || 'en').toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {agent.llm || 'GPT-4o Mini'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setTestCallAgent({ id: agent.agent_id, name: agent.name, provider: agent.provider || 'elevenlabs' });
                              setQuickLeadName('Test User');
                              setShowQuickPrompt(true);
                            }}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                            title="Start test call with this agent"
                          >
                            <Phone className="size-3 text-emerald-400" />
                            <span>Test call</span>
                          </button>
                          <Link href={`/dashboard/agents/${agent.agent_id}`} className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-muted text-muted-foreground transition-colors">
                            <ChevronRight className="h-4 w-4" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quick Test Call Lead Name Prompt Modal */}
      {showQuickPrompt && testCallAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6 text-center shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
              <Phone className="size-6 text-emerald-500" />
            </div>
            <h2 className="text-base font-semibold mb-1">Test Call: {testCallAgent.name}</h2>
            <p className="text-xs text-muted-foreground mb-4">Enter the lead name for greeting (or start directly):</p>
            <input 
              autoFocus
              className="w-full rounded-md border border-border bg-background px-4 py-2.5 text-sm text-center mb-5 focus:outline-none focus:ring-1 focus:ring-ring"
              value={quickLeadName}
              onChange={e => setQuickLeadName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  setShowQuickPrompt(false);
                  setShowTestCall(true);
                }
              }}
              placeholder="e.g. John"
            />
            <div className="flex gap-2.5">
              <button 
                type="button"
                onClick={() => { setShowQuickPrompt(false); setTestCallAgent(null); }} 
                className="flex-1 text-xs font-medium border border-border hover:bg-accent rounded-md py-2 transition-colors"
              >
                Cancel
              </button>
              <button 
                type="button"
                onClick={() => { setShowQuickPrompt(false); setShowTestCall(true); }} 
                className="flex-1 text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-500 rounded-md py-2 transition-colors flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Phone className="size-3.5" /> Start Call
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full-screen Test Call View */}
      {showTestCall && testCallAgent && token && (
        <TestCallView
          agentId={testCallAgent.id}
          agentName={testCallAgent.name}
          leadName={quickLeadName || 'Test User'}
          token={token}
          provider={testCallAgent.provider as any}
          onClose={() => {
            setShowTestCall(false);
            setTestCallAgent(null);
          }}
        />
      )}

      {showCreate && (
        <CreateAgentModal
          token={token!}
          voices={voices}
          templates={templates}
          onClose={() => setShowCreate(false)}
          onCreated={(agent) => {
            setAgents(prev => [agent, ...prev]);
            setShowCreate(false);
          }}
        />
      )}
    </div>
  );
}

function CreateAgentModal({ token, voices, templates, onClose, onCreated }: {
  token: string;
  voices: Voice[];
  templates: AgentTemplate[];
  onClose: () => void;
  onCreated: (agent: Agent) => void;
}) {
  const { addToast } = useToast();

  const [step, setStep] = useState<'template' | 'configure'>('template');
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [provider, setProvider] = useState<'elevenlabs' | 'vapi' | 'gemini'>('elevenlabs');

  const [name, setName] = useState('');
  const [firstMessage, setFirstMessage] = useState('');
  const [language, setLanguage] = useState('en');
  const [temperature, setTemperature] = useState(0.7);
  const [prompt, setPrompt] = useState('');
  const [maxDuration, setMaxDuration] = useState(300);
  const [creating, setCreating] = useState(false);

  const [llm, setLlm] = useState('gpt-4o-mini');
  const [customLlm, setCustomLlm] = useState('');
  const [isCustomLlm, setIsCustomLlm] = useState(false);

  const [ttsModel, setTtsModel] = useState('eleven_v3_conversational');
  const [voiceId, setVoiceId] = useState('');

  const [modelProvider, setModelProvider] = useState('openai');
  const [vapiLlm, setVapiLlm] = useState('gpt-4o-mini');
  const [customVapiLlm, setCustomVapiLlm] = useState('');
  const [isCustomVapiLlm, setIsCustomVapiLlm] = useState(false);

  const [voiceProvider, setVoiceProvider] = useState('11labs');
  const [vapiVoiceId, setVapiVoiceId] = useState('');
  const [transcriberProvider, setTranscriberProvider] = useState('deepgram');

  const [geminiVoice, setGeminiVoice] = useState('Kore');
  const [geminiModel, setGeminiModel] = useState('models/gemini-3.8-flash');
  const [customGeminiModel, setCustomGeminiModel] = useState('');
  const [isCustomGeminiModel, setIsCustomGeminiModel] = useState(false);
  const [geminiThinkingLevel, setGeminiThinkingLevel] = useState('none');

  // Dynamic discovery from /api/agents/models
  const [dynamicLLMs, setDynamicLLMs] = useState<{ value: string; label: string; provider?: string }[]>([]);
  const [dynamicTTSModels, setDynamicTTSModels] = useState<{ value: string; label: string; badge?: string }[]>([]);
  const [dynamicGeminiModels, setDynamicGeminiModels] = useState<{ value: string; label: string }[]>([]);
  const [dynamicVapiCatalog, setDynamicVapiCatalog] = useState<{ providers: { value: string; label: string }[]; models: Record<string, { value: string; label: string }[]> } | null>(null);

  useEffect(() => {
    if (!token) return;
    api<any>('/agents/models', { token })
      .then(res => {
        if (res?.llms?.length) setDynamicLLMs(res.llms);
        if (res?.models?.length) {
          setDynamicTTSModels(res.models.map((m: any) => ({
            value: m.model_id || m.value,
            label: m.name ? `${m.name}${m.badge ? ` — ${m.badge}` : ''}` : m.label,
          })));
        }
        if (res?.gemini?.models?.length) setDynamicGeminiModels(res.gemini.models);
        if (res?.vapi) setDynamicVapiCatalog(res.vapi);
      })
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    const providerModels = (dynamicVapiCatalog?.models?.[modelProvider]) || VAPI_LLM_OPTIONS[modelProvider];
    if (providerModels && providerModels.length > 0 && !isCustomVapiLlm) {
      setVapiLlm(providerModels[0].value);
    }
  }, [modelProvider, dynamicVapiCatalog, isCustomVapiLlm]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { addToast('Agent name is required', 'error'); return; }
    setCreating(true);

    try {
      const finalElevenLlm = isCustomLlm && customLlm.trim() ? customLlm.trim() : llm;
      const finalGeminiModel = isCustomGeminiModel && customGeminiModel.trim() ? customGeminiModel.trim() : geminiModel;
      const finalVapiLlm = isCustomVapiLlm && customVapiLlm.trim() ? customVapiLlm.trim() : vapiLlm;

      const baseBody: Record<string, unknown> = {
        provider,
        name: name.trim(),
        first_message: firstMessage || `Hello! I'm ${name.trim()}. How can I help you today?`,
        language,
        temperature,
        prompt: prompt || `You are ${name.trim()}, a helpful AI assistant.`,
        max_duration_seconds: maxDuration,
        ...(selectedTemplate && selectedTemplate !== 'custom' ? { template: selectedTemplate } : {}),
      };

      if (provider === 'elevenlabs') {
        Object.assign(baseBody, {
          llm: finalElevenLlm,
          tts_model_id: ttsModel,
          voice_id: voiceId || undefined,
        });
      } else if (provider === 'gemini') {
        Object.assign(baseBody, {
          gemini_voice: geminiVoice,
          gemini_model: finalGeminiModel,
          thinking_level: geminiThinkingLevel,
        });
      } else {
        Object.assign(baseBody, {
          model_provider: modelProvider,
          llm: finalVapiLlm,
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

  const handlePickTemplate = (tplId: string) => {
    setSelectedTemplate(tplId);
    if (tplId !== 'custom') {
      const tpl = templates.find(t => t.id === tplId);
      if (tpl) {
        const d = tpl.defaults;
        if (d.first_message !== undefined) setFirstMessage(d.first_message);
        if (d.prompt !== undefined) setPrompt(d.prompt);
        if (d.temperature !== undefined) setTemperature(d.temperature);
        if (d.max_duration_seconds !== undefined) setMaxDuration(d.max_duration_seconds);
        if (d.language !== undefined) setLanguage(d.language);
        if (d.llm !== undefined) {
          setLlm(d.llm);
          setVapiLlm(d.llm);
        }
        if (!name.trim()) setName(tpl.name);
      }
    }
    setStep('configure');
  };

  // Step 1: Template Picker
  if (step === 'template') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={onClose}>
        <div 
          className="w-full max-w-3xl max-h-[85vh] overflow-auto rounded-lg border border-border bg-card p-0 shadow-lg flex flex-col"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-border p-4">
            <div className="flex items-center gap-2 font-medium">
              <Sparkles className="h-4 w-4" />
              Choose a template
            </div>
            <button onClick={onClose} className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
          
          <div className="p-6 flex-1 overflow-auto flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Start from a ready-made template or build your own from scratch.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <button
                type="button"
                onClick={() => handlePickTemplate('custom')}
                className="flex flex-col items-start gap-2 rounded-lg border border-dashed border-border bg-transparent p-4 text-left transition-colors hover:bg-accent hover:text-accent-foreground min-h-[130px]"
              >
                <div className="flex items-center gap-2">
                  <PlusCircle className="h-5 w-5" />
                  <span className="font-medium text-sm">Custom / Blank</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  Configure everything yourself from scratch.
                </span>
              </button>

              {templates.map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handlePickTemplate(t.id)}
                  className="flex flex-col items-start gap-2 rounded-lg border border-border bg-card p-4 text-left transition-colors hover:bg-accent hover:text-accent-foreground min-h-[130px]"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{t.name}</span>
                  </div>
                  <span className="text-[10px] uppercase tracking-wider text-primary font-medium">
                    {t.category}
                  </span>
                  <span className="text-xs text-muted-foreground line-clamp-3">
                    {t.description}
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div className="border-t border-border p-4 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Step 2: Configure Form
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={onClose}>
      <div 
        className="w-full max-w-2xl max-h-[85vh] overflow-auto rounded-lg border border-border bg-card p-0 shadow-lg flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border p-4">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setStep('template')} 
              className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              title="Back to templates"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2 font-medium">
              <Bot className="h-4 w-4" />
              Create new agent
              {selectedTemplate && selectedTemplate !== 'custom' && (
                <span className="ml-2 inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                  {templates.find(t => t.id === selectedTemplate)?.name || 'Template'}
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleCreate} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-6 flex-1 overflow-auto flex flex-col gap-6">
            
            {/* Provider */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Provider</h4>
              <div className="flex items-center gap-2 rounded-md border border-border p-1 bg-muted/50">
                {AGENT_PROVIDERS.map(p => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setProvider(p.value as 'elevenlabs' | 'vapi' | 'gemini')}
                    className={cn(
                      "flex-1 rounded px-3 py-1.5 text-sm font-medium transition-colors",
                      provider === p.value 
                        ? "bg-background text-foreground shadow-sm" 
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Identity */}
            <div className="space-y-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Identity</h4>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Agent name *</label>
                  <input 
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring" 
                    value={name} 
                    onChange={e => setName(e.target.value)} 
                    placeholder="e.g., Sales agent" 
                    required 
                    autoFocus 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">First message</label>
                  <textarea 
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring min-h-[80px]" 
                    value={firstMessage} 
                    onChange={e => setFirstMessage(e.target.value)} 
                    placeholder={`Hello! I'm ${name || 'Agent'}. How can I help?`}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Language</label>
                  <CustomSelect value={language} onChange={e => setLanguage(e.target.value)} options={FALLBACK_LANGUAGE_OPTIONS} placeholder="Select language" />
                </div>
              </div>
            </div>

            {/* AI Model */}
            <div className="space-y-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">AI model</h4>
              
              {provider === 'gemini' ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Model</label>
                      <CustomSelect 
                        value={isCustomGeminiModel ? '__custom__' : geminiModel} 
                        onChange={e => {
                          if (e.target.value === '__custom__') {
                            setIsCustomGeminiModel(true);
                          } else {
                            setIsCustomGeminiModel(false);
                            setGeminiModel(e.target.value);
                          }
                        }} 
                        options={[
                          ...(dynamicGeminiModels.length ? dynamicGeminiModels : GEMINI_MODELS),
                          { value: '__custom__', label: 'Custom model (type below)...' }
                        ]} 
                        placeholder="Select model" 
                      />
                      {isCustomGeminiModel && (
                        <input
                          type="text"
                          placeholder="e.g. models/gemini-2.5-flash-native-audio-latest"
                          value={customGeminiModel}
                          onChange={e => setCustomGeminiModel(e.target.value)}
                          className="w-full mt-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                          autoFocus
                        />
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Temperature: {temperature.toFixed(2)}</label>
                    <input type="range" className="w-full accent-primary" min="0" max="2" step="0.05" value={temperature} onChange={e => setTemperature(parseFloat(e.target.value))} />
                    <div className="text-[10px] text-muted-foreground">Recommended: 1.0 for Gemini</div>
                  </div>
                </>
              ) : provider === 'elevenlabs' ? (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">LLM</label>
                    <CustomSelect 
                      value={isCustomLlm ? '__custom__' : llm} 
                      onChange={e => {
                        if (e.target.value === '__custom__') {
                          setIsCustomLlm(true);
                        } else {
                          setIsCustomLlm(false);
                          setLlm(e.target.value);
                        }
                      }} 
                      options={[
                        ...(dynamicLLMs.length ? dynamicLLMs : FALLBACK_LLM_OPTIONS),
                        { value: '__custom__', label: 'Custom model (type below)...' }
                      ]} 
                      placeholder="Select LLM" 
                    />
                    {isCustomLlm && (
                      <input
                        type="text"
                        placeholder="e.g. gpt-4.5-preview or custom model ID"
                        value={customLlm}
                        onChange={e => setCustomLlm(e.target.value)}
                        className="w-full mt-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                        autoFocus
                      />
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Temperature: {temperature.toFixed(2)}</label>
                    <input type="range" className="w-full accent-primary" min="0" max="1" step="0.05" value={temperature} onChange={e => setTemperature(parseFloat(e.target.value))} />
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Model provider</label>
                      <CustomSelect 
                        value={modelProvider} 
                        onChange={e => setModelProvider(e.target.value)} 
                        options={dynamicVapiCatalog?.providers || VAPI_MODEL_PROVIDERS} 
                        placeholder="Select provider" 
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">LLM</label>
                      <CustomSelect
                        value={isCustomVapiLlm ? '__custom__' : vapiLlm}
                        onChange={e => {
                          if (e.target.value === '__custom__') {
                            setIsCustomVapiLlm(true);
                          } else {
                            setIsCustomVapiLlm(false);
                            setVapiLlm(e.target.value);
                          }
                        }}
                        options={[
                          ...((dynamicVapiCatalog?.models?.[modelProvider]) || VAPI_LLM_OPTIONS[modelProvider] || []),
                          { value: '__custom__', label: 'Custom model (type below)...' }
                        ]}
                        placeholder="Select model"
                      />
                      {isCustomVapiLlm && (
                        <input
                          type="text"
                          placeholder="e.g. claude-3-7-sonnet-20250219 or gpt-4.5"
                          value={customVapiLlm}
                          onChange={e => setCustomVapiLlm(e.target.value)}
                          className="w-full mt-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                          autoFocus
                        />
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Temperature: {temperature.toFixed(2)}</label>
                    <input type="range" className="w-full accent-primary" min="0" max="1" step="0.05" value={temperature} onChange={e => setTemperature(parseFloat(e.target.value))} />
                  </div>
                </>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium">System prompt</label>
                <textarea 
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring min-h-[120px]" 
                  value={prompt} 
                  onChange={e => setPrompt(e.target.value)} 
                  placeholder={`You are ${name || 'Agent'}, a helpful AI assistant.`}
                />
              </div>
            </div>

            {/* Voice */}
            <div className="space-y-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Voice</h4>
              
              {provider === 'gemini' ? (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Voice</label>
                    <CustomSelect value={geminiVoice} onChange={e => setGeminiVoice(e.target.value)} options={GEMINI_VOICES} placeholder="Select voice" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Max duration (sec)</label>
                    <input className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring" type="number" value={maxDuration} onChange={e => setMaxDuration(parseInt(e.target.value))} min="30" max="3600" />
                  </div>
                </div>
              ) : provider === 'elevenlabs' ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">TTS model</label>
                      <CustomSelect value={ttsModel} onChange={e => setTtsModel(e.target.value)} options={dynamicTTSModels.length ? dynamicTTSModels : FALLBACK_TTS_MODEL_OPTIONS} placeholder="Select TTS model" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Max duration (sec)</label>
                      <input className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring" type="number" value={maxDuration} onChange={e => setMaxDuration(parseInt(e.target.value))} min="30" max="3600" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Voice</label>
                    <CustomSelect value={voiceId} onChange={e => setVoiceId(e.target.value)} options={[{ value: '', label: '(Default voice)' }, ...voices.map(v => ({ value: v.voice_id, label: v.name }))]} placeholder="Select voice" />
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Voice provider</label>
                      <CustomSelect value={voiceProvider} onChange={e => setVoiceProvider(e.target.value)} options={VAPI_VOICE_PROVIDERS} placeholder="Select voice provider" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Voice ID</label>
                      <input className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring" value={vapiVoiceId} onChange={e => setVapiVoiceId(e.target.value)} placeholder="e.g., rachel or voice ID" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Transcriber</label>
                      <CustomSelect value={transcriberProvider} onChange={e => setTranscriberProvider(e.target.value)} options={VAPI_TRANSCRIBER_PROVIDERS} placeholder="Select transcriber" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Max duration (sec)</label>
                      <input className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring" type="number" value={maxDuration} onChange={e => setMaxDuration(parseInt(e.target.value))} min="30" max="3600" />
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
          
          <div className="border-t border-border p-4 flex justify-end gap-3 bg-muted/20">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating || !name.trim()}
              className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:pointer-events-none"
            >
              {creating ? (
                "Creating..."
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Create agent
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
