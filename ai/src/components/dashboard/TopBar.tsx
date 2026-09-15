'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { 
  Search, Command, Globe, Code2, Play, Sparkles, ChevronDown, 
  ArrowLeft, Bot, MoreHorizontal, Check, Copy, X, Loader2,
  PhoneCall, ExternalLink, Settings2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { useTopBar } from './TopBarContext';

function getFallbackTitle(pathname: string): string {
  if (!pathname || pathname === '/dashboard') return 'Dashboard';
  if (pathname.startsWith('/dashboard/agents/')) return 'New agent';
  if (pathname.startsWith('/dashboard/agents')) return 'Agents';
  if (pathname.startsWith('/dashboard/contacts')) return 'Contacts';
  if (pathname.startsWith('/dashboard/campaigns')) return 'Campaigns';
  if (pathname.startsWith('/dashboard/phone-numbers')) return 'Phone Numbers';
  if (pathname.startsWith('/dashboard/history')) return 'Analysis';
  if (pathname.startsWith('/dashboard/billing')) return 'Billing';
  if (pathname.startsWith('/dashboard/audit-logs')) return 'Audit Logs';
  if (pathname.startsWith('/dashboard/settings')) return 'Settings';
  if (pathname.startsWith('/dashboard/admin/pricing')) return 'Pricing Plans';
  if (pathname.startsWith('/dashboard/admin')) return 'Admin Panel';
  return 'Dialix';
}

interface AgentSearchResult {
  agent_id: string;
  name: string;
  provider?: string;
  language?: string;
}

export function TopBar() {
  const {
    title,
    subtitle,
    badge,
    backHref,
    isAgent,
    agentId,
    isDirty,
    isSaving,
    onPreview,
    onSave,
    onVars,
    onArchitect,
    actions,
    customLeft,
  } = useTopBar();

  const { token } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const effectiveIsAgent = isAgent || (pathname ? pathname.startsWith('/dashboard/agents/') : false);
  const displayTitle = title || (effectiveIsAgent ? 'New agent' : getFallbackTitle(pathname || ''));

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<AgentSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [allAgents, setAllAgents] = useState<AgentSearchResult[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // UI state
  const [showVarsModal, setShowVarsModal] = useState(false);
  const [showPublishMenu, setShowPublishMenu] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [copiedVar, setCopiedVar] = useState<string | null>(null);

  // Keyboard shortcut: Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        setShowSearchDropdown(true);
      }
      if (e.key === 'Escape') {
        setShowSearchDropdown(false);
        setShowPublishMenu(false);
        setShowMoreMenu(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowSearchDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch agents list for search
  const loadSearchAgents = async () => {
    if (!token || allAgents.length > 0) return;
    setIsSearching(true);
    try {
      const data = await api<{ agents: AgentSearchResult[] }>('/agents', { token });
      if (data?.agents) {
        setAllAgents(data.agents);
      }
    } catch {
      // Non-critical
    } finally {
      setIsSearching(false);
    }
  };

  // Filter agents based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(allAgents.slice(0, 6));
      return;
    }
    const q = searchQuery.toLowerCase().trim();
    const matches = allAgents.filter(a => 
      a.name.toLowerCase().includes(q) || 
      a.agent_id.toLowerCase().includes(q) ||
      (a.provider && a.provider.toLowerCase().includes(q))
    );
    setSearchResults(matches.slice(0, 8));
  }, [searchQuery, allAgents]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/dashboard/agents?q=${encodeURIComponent(searchQuery.trim())}`);
      setShowSearchDropdown(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedVar(text);
    setTimeout(() => setCopiedVar(null), 2000);
  };

  return (
    <>
      <header className="flex items-center justify-between gap-4 px-5 h-13 min-h-[52px] border-b border-border bg-background shrink-0 select-none z-30">
        {/* Left Section: Breadcrumb / Title / Agent Switcher */}
        <div className="flex items-center gap-2.5 min-w-0 shrink-0">
          {customLeft ? (
            customLeft
          ) : (
            <>
              {backHref && (
                <Link
                  href={backHref}
                  className="size-7 rounded-md border border-border bg-card/60 hover:bg-accent flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors shrink-0"
                  title="Back"
                >
                  <ArrowLeft className="size-3.5" />
                </Link>
              )}

              <div className="flex items-center gap-2 min-w-0">
                <div className="size-6 rounded border border-border bg-card flex items-center justify-center text-foreground/80 shrink-0">
                  <Bot className="size-3.5" />
                </div>

                <div className="flex items-center gap-1.5 min-w-0">
                  <h1 className="text-sm font-semibold text-foreground truncate max-w-[200px] sm:max-w-[300px]">
                    {displayTitle}
                  </h1>

                  {/* Optional dropdown / more options button */}
                  {effectiveIsAgent && (
                    <div className="relative">
                      <button
                        onClick={() => setShowMoreMenu(!showMoreMenu)}
                        className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                        title="Agent options"
                      >
                        <MoreHorizontal className="size-3.5" />
                      </button>

                      {showMoreMenu && (
                        <div className="absolute left-0 top-full mt-1.5 w-48 rounded-lg border border-border bg-card shadow-xl py-1 z-50 text-xs">
                          {agentId && (
                            <button
                              onClick={() => {
                                copyToClipboard(agentId);
                                setShowMoreMenu(false);
                              }}
                              className="w-full text-left px-3 py-2 text-foreground hover:bg-accent flex items-center justify-between"
                            >
                              <span>Copy Agent ID</span>
                              <Copy className="size-3 text-muted-foreground" />
                            </button>
                          )}
                          <Link
                            href="/dashboard/history"
                            onClick={() => setShowMoreMenu(false)}
                            className="w-full text-left px-3 py-2 text-foreground hover:bg-accent flex items-center justify-between"
                          >
                            <span>View Call Logs</span>
                            <ExternalLink className="size-3 text-muted-foreground" />
                          </Link>
                          <Link
                            href="/dashboard/settings"
                            onClick={() => setShowMoreMenu(false)}
                            className="w-full text-left px-3 py-2 text-foreground hover:bg-accent flex items-center justify-between"
                          >
                            <span>Workspace Settings</span>
                            <Settings2 className="size-3 text-muted-foreground" />
                          </Link>
                        </div>
                      )}
                    </div>
                  )}

                  {badge && (
                    <span className="hidden sm:inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium border border-border bg-muted/60 text-muted-foreground">
                      {badge}
                    </span>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Center: ElevenLabs-style Search Bar */}
        <div ref={searchContainerRef} className="relative flex-1 max-w-sm sm:max-w-md mx-2">
          <form onSubmit={handleSearchSubmit}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search agents..."
                value={searchQuery}
                onFocus={() => {
                  loadSearchAgents();
                  setShowSearchDropdown(true);
                }}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full h-8 rounded-md border border-border bg-card/90 px-8 py-1 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring focus:bg-card transition-all"
              />
              <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 hidden sm:inline-flex items-center gap-0.5 rounded border border-border/80 bg-background/80 px-1.5 py-0.5 text-[10px] text-muted-foreground font-mono">
                <Command className="size-2.5" />K
              </kbd>
            </div>
          </form>

          {/* Search Dropdown Popup */}
          {showSearchDropdown && (
            <div className="absolute left-0 right-0 top-full mt-1.5 rounded-lg border border-border bg-card shadow-2xl overflow-hidden z-50 text-xs">
              <div className="p-2 border-b border-border/60 text-[11px] text-muted-foreground font-medium flex items-center justify-between">
                <span>{searchQuery ? `Results for "${searchQuery}"` : 'Recent & Available Agents'}</span>
                {isSearching && <Loader2 className="size-3 animate-spin text-muted-foreground" />}
              </div>

              <div className="max-h-60 overflow-y-auto divide-y divide-border/40">
                {searchResults.length > 0 ? (
                  searchResults.map(agent => (
                    <button
                      key={agent.agent_id}
                      onClick={() => {
                        setShowSearchDropdown(false);
                        setSearchQuery('');
                        router.push(`/dashboard/agents/${agent.agent_id}`);
                      }}
                      className="w-full px-3 py-2.5 text-left hover:bg-accent flex items-center justify-between group transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="size-5 rounded bg-muted flex items-center justify-center text-foreground/70 shrink-0">
                          <Bot className="size-3" />
                        </div>
                        <div className="truncate">
                          <span className="font-medium text-foreground group-hover:text-foreground transition-colors block truncate">
                            {agent.name}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono truncate">
                            {agent.agent_id}
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-mono shrink-0 ml-2">
                        {agent.provider || 'ElevenLabs'}
                      </span>
                    </button>
                  ))
                ) : (
                  <div className="px-4 py-5 text-center text-muted-foreground text-xs">
                    {isSearching ? 'Loading agents...' : 'No agents found matching your query'}
                  </div>
                )}
              </div>

              <div className="p-2 border-t border-border/60 bg-muted/20 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Jump to agent</span>
                <Link
                  href="/dashboard/agents"
                  onClick={() => setShowSearchDropdown(false)}
                  className="hover:text-foreground underline underline-offset-2"
                >
                  View all agents →
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Right Section: Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {actions ? (
            actions
          ) : effectiveIsAgent ? (
            /* ElevenLabs-style Agent Top Bar Controls */
            <div className="flex items-center gap-1.5 sm:gap-2">
              {/* Language / Globe */}
              <button
                type="button"
                className="size-8 rounded-md border border-border bg-card/60 hover:bg-accent flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                title="Agent Language & Localization"
              >
                <Globe className="size-3.5" />
              </button>

              {/* { } Vars Button */}
              <button
                type="button"
                onClick={() => {
                  if (onVars) {
                    onVars();
                  } else {
                    setShowVarsModal(true);
                  }
                }}
                className="h-8 px-2.5 rounded-md border border-border bg-card/60 hover:bg-accent text-xs font-mono font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
                title="Dynamic Template Variables"
              >
                <Code2 className="size-3" />
                <span className="hidden sm:inline">Vars</span>
              </button>

              {/* Preview Button */}
              <button
                type="button"
                onClick={onPreview}
                className="h-8 px-2.5 sm:px-3 rounded-md border border-border bg-card/60 hover:bg-accent text-xs font-medium text-foreground transition-colors flex items-center gap-1.5 shadow-sm"
                title="Preview / Test Call"
              >
                <Play className="size-3 fill-foreground/20 text-foreground" />
                <span>Preview</span>
              </button>

              {/* Architect Button */}
              <button
                type="button"
                onClick={onArchitect}
                className="hidden md:flex h-8 px-2.5 rounded-md border border-border bg-card/60 hover:bg-accent text-xs font-medium text-muted-foreground hover:text-foreground transition-colors items-center gap-1.5"
                title="Workflow Architect"
              >
                <Sparkles className="size-3" />
                <span>Architect</span>
                <span className="text-[9px] font-semibold uppercase px-1 py-0.2 rounded bg-muted text-muted-foreground">Alpha</span>
              </button>

              {/* Publish / Save Button (ElevenLabs primary white pill) */}
              <div className="relative">
                <button
                  type="button"
                  onClick={onSave}
                  disabled={isSaving}
                  className={cn(
                    "h-8 px-3 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 shadow-sm",
                    isDirty
                      ? "bg-foreground text-background hover:bg-foreground/90 ring-1 ring-foreground"
                      : "bg-foreground text-background hover:bg-foreground/90",
                    isSaving && "opacity-80 cursor-not-allowed"
                  )}
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="size-3 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      {isDirty && <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" />}
                      <span>{isDirty ? 'Save changes' : 'Publish'}</span>
                      <ChevronDown
                        className="size-3 text-background/80 ml-0.5 cursor-pointer hover:opacity-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowPublishMenu(!showPublishMenu);
                        }}
                      />
                    </>
                  )}
                </button>

                {/* Publish dropdown options */}
                {showPublishMenu && (
                  <div className="absolute right-0 top-full mt-1.5 w-44 rounded-lg border border-border bg-card shadow-xl py-1 z-50 text-xs">
                    <button
                      onClick={() => {
                        setShowPublishMenu(false);
                        onSave?.();
                      }}
                      className="w-full text-left px-3 py-2 text-foreground hover:bg-accent flex items-center justify-between"
                    >
                      <span>Publish to Live</span>
                      <Check className="size-3 text-emerald-400" />
                    </button>
                    <button
                      onClick={() => {
                        setShowPublishMenu(false);
                        onSave?.();
                      }}
                      className="w-full text-left px-3 py-2 text-muted-foreground hover:text-foreground hover:bg-accent"
                    >
                      Save as Draft
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Default right-side profile / quick action */
            <div className="flex items-center gap-2">
              <Link
                href="/dashboard/agents"
                className="h-8 px-3 rounded-md bg-foreground text-background hover:bg-foreground/90 text-xs font-medium transition-colors hidden sm:flex items-center gap-1.5 shadow-sm"
              >
                <span>New agent</span>
              </Link>
            </div>
          )}
        </div>
      </header>

      {/* Variables Modal */}
      {showVarsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-lg border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Code2 className="size-4 text-foreground" />
                <h2 className="text-sm font-semibold text-foreground">Dynamic Prompt Variables</h2>
              </div>
              <button
                onClick={() => setShowVarsModal(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-accent"
              >
                <X className="size-4" />
              </button>
            </div>

            <p className="text-xs text-muted-foreground mt-3 mb-4">
              Insert these variables into your agent&apos;s system prompt or first message. They will automatically populate with recipient data during calls.
            </p>

            <div className="space-y-2 max-h-72 overflow-y-auto">
              {[
                { tag: '{{lead_name}}', desc: 'Full name of the contact / lead' },
                { tag: '{{first_name}}', desc: 'First name extracted from lead' },
                { tag: '{{phone_number}}', desc: 'Destination phone number in E.164' },
                { tag: '{{company}}', desc: 'Company or organization name' },
                { tag: '{{email}}', desc: 'Email address of the recipient' },
                { tag: '{{agent_name}}', desc: 'Current name of this agent' },
                { tag: '{{current_time}}', desc: 'Current local time of the recipient' },
                { tag: '{{campaign_goal}}', desc: 'Assigned outbound campaign goal' },
              ].map(v => (
                <div
                  key={v.tag}
                  className="flex items-center justify-between p-2.5 rounded-md border border-border bg-background hover:border-muted-foreground/40 transition-colors"
                >
                  <div>
                    <code className="text-xs font-mono text-foreground font-semibold bg-muted/60 px-1.5 py-0.5 rounded">
                      {v.tag}
                    </code>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{v.desc}</p>
                  </div>
                  <button
                    onClick={() => copyToClipboard(v.tag)}
                    className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded border border-border bg-card hover:bg-accent flex items-center gap-1 transition-colors"
                  >
                    {copiedVar === v.tag ? (
                      <>
                        <Check className="size-3 text-emerald-400" />
                        <span className="text-emerald-400">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="size-3" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-5 pt-3 border-t border-border flex justify-end">
              <button
                onClick={() => setShowVarsModal(false)}
                className="px-4 py-2 text-xs font-medium rounded-md bg-foreground text-background hover:bg-foreground/90 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
