'use client';

import React, { useState, useRef, useEffect } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * CustomSelect — dark-themed dropdown replacement for native <select>.
 * Supports rich metadata: provider, context window, badges, descriptions.
 */

export interface SelectOption {
  value: string;
  label: string;
  /** Provider badge (e.g. "OpenAI", "Google") */
  provider?: string;
  /** Estimated first-token latency in milliseconds */
  latency_ms?: number | null;
  /** Max output tokens */
  max_tokens?: number | null;
  /** Max context window size */
  context_window?: number | null;
  /** Supports image input */
  supports_image?: boolean;
  /** Supports document input */
  supports_document?: boolean;
  /** Supports parallel tool calls */
  supports_parallel_tools?: boolean;
  /** Description text shown below the label */
  description?: string;
  /** Language count (for TTS models) */
  language_count?: number;
  /** Supported language IDs (for TTS model ↔ language filtering) */
  supported_language_ids?: string[];
  /** Mark this option as incompatible (grayed out but still selectable) */
  incompatible?: boolean;
  /** Reason why incompatible */
  incompatible_reason?: string;
}

interface CustomSelectProps {
  value: string;
  onChange: (e: { target: { value: string } }) => void;
  options: SelectOption[];
  placeholder?: string;
  small?: boolean;
  disabled?: boolean;
}

/** Format a number like 128000 → "128K" or 1000000 → "1M" */
function formatTokens(n: number | null | undefined): string {
  if (!n) return '';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1)}K`;
  return String(n);
}

/** Map provider name to a color hue */
function providerColor(provider?: string): string {
  switch (provider) {
    case 'OpenAI': return 'var(--green, #10b981)';
    case 'Anthropic': return 'var(--orange, #f59e0b)';
    case 'Google': return 'var(--blue, #3b82f6)';
    case 'ElevenLabs': return 'var(--purple, #8b5cf6)';
    case 'DeepSeek': return 'var(--cyan, #06b6d4)';
    default: return 'var(--text-quaternary)';
  }
}

export function CustomSelect({
  value,
  onChange,
  options,
  placeholder = 'Select...',
  small = false,
  disabled = false,
}: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  // Check if any option has rich metadata
  const hasRichMeta = options.some(o => o.provider || o.context_window || o.description || o.language_count || o.latency_ms);

  const selectedOption = options.find(o => o.value === value);
  const displayLabel = selectedOption?.label || placeholder;

  const filtered = search
    ? options.filter(o =>
        o.label.toLowerCase().includes(search.toLowerCase()) ||
        (o.provider || '').toLowerCase().includes(search.toLowerCase())
      )
    : options;

  // Focus search input when dropdown opens
  useEffect(() => {
    if (open) {
      // Small timeout to ensure input is rendered before focusing
      const timeoutId = setTimeout(() => {
        searchRef.current?.focus();
      }, 50);
      return () => clearTimeout(timeoutId);
    }
  }, [open]);

  return (
    <DropdownMenu.Root modal={false} open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (!isOpen) {
        // Delay clearing search slightly for smoother close animation
        setTimeout(() => setSearch(''), 200);
      }
    }}>
      <DropdownMenu.Trigger asChild disabled={disabled}>
        <div className={cn(
          "flex items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-sm cursor-pointer hover:border-muted-foreground/50 transition-colors",
          small && "py-1.5 text-xs",
          disabled && "opacity-50 cursor-not-allowed",
          open && "border-ring"
        )}>
          <span className="flex items-center gap-1.5 min-w-0 truncate">
            {selectedOption?.provider && (
              <span className="size-2 rounded-full shrink-0" style={{ background: providerColor(selectedOption.provider) }} />
            )}
            <span className={cn("truncate", !selectedOption && "text-muted-foreground")}>{displayLabel}</span>
            {selectedOption?.latency_ms != null && selectedOption.latency_ms > 0 && (
              <span className={cn(
                "text-[10px] px-1.5 py-0.5 rounded-full",
                selectedOption.latency_ms <= 250 ? 'bg-green-500/10 text-green-500' : selectedOption.latency_ms <= 500 ? 'bg-yellow-500/10 text-yellow-500' : 'bg-red-500/10 text-red-500'
              )}>~{selectedOption.latency_ms}ms</span>
            )}
            {selectedOption?.context_window && (
              <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{formatTokens(selectedOption.context_window)} ctx</span>
            )}
          </span>
          <ChevronDown className={cn("size-3.5 text-muted-foreground shrink-0 transition-transform", open && "rotate-180")} />
        </div>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="z-50 rounded-md border border-border bg-card shadow-lg overflow-hidden max-h-72 overflow-y-auto"
          align="start"
          sideOffset={6}
          style={{ width: 'var(--radix-dropdown-menu-trigger-width)' }}
          onCloseAutoFocus={(e) => {
            // Prevent focusing body on close
            e.preventDefault();
          }}
        >
          {/* Search within dropdown */}
          {options.length > 6 && (
            <div className="p-2 border-b border-border" onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
              <input
                ref={searchRef}
                className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none"
                placeholder="Search..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          )}

          {filtered.map(opt => {
            const isSelected = opt.value === value;
            const ctxStr = formatTokens(opt.context_window);
            const maxTokStr = formatTokens(opt.max_tokens);
            const isIncompat = !!opt.incompatible;

            return (
              <DropdownMenu.Item
                key={opt.value}
                className={cn(
                  "px-3 py-2 text-sm cursor-pointer outline-none",
                  "hover:bg-accent focus:bg-accent",
                  isSelected && "bg-accent font-medium",
                  isIncompat && "opacity-50"
                )}
                onSelect={(e) => {
                  e.preventDefault(); // allow us to handle state
                  onChange({ target: { value: opt.value } });
                  setOpen(false);
                }}
              >
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5">
                    {opt.provider && (
                      <span className="size-2 rounded-full shrink-0" style={{ background: providerColor(opt.provider) }} />
                    )}
                    <span className="truncate">{opt.label}</span>
                    {opt.latency_ms != null && opt.latency_ms > 0 && (
                      <span className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded-full",
                        opt.latency_ms <= 250 ? 'bg-green-500/10 text-green-500' : opt.latency_ms <= 500 ? 'bg-yellow-500/10 text-yellow-500' : 'bg-red-500/10 text-red-500'
                      )} title={`Estimated first-token latency`}>
                        ~{opt.latency_ms}ms
                      </span>
                    )}
                    {opt.provider && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded border" style={{ color: providerColor(opt.provider), borderColor: providerColor(opt.provider) }}>
                        {opt.provider}
                      </span>
                    )}
                  </div>

                  {/* Metadata badges row */}
                  {hasRichMeta && (
                    <div className="flex flex-wrap items-center gap-1 mt-1">
                      {ctxStr && <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded" title="Context window">{ctxStr} ctx</span>}
                      {maxTokStr && <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded" title="Max output tokens">{maxTokStr} out</span>}
                      {opt.supports_image && <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded" title="Image input">🖼️</span>}
                      {opt.supports_document && <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded" title="Document input">📄</span>}
                      {opt.supports_parallel_tools && <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded" title="Parallel tools">⚡</span>}
                      {opt.language_count != null && opt.language_count > 0 && (
                        <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded" title="Supported languages">{opt.language_count} lang{opt.language_count !== 1 ? 's' : ''}</span>
                      )}
                      {isIncompat && opt.incompatible_reason && (
                        <span className="text-[10px] text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded">{opt.incompatible_reason}</span>
                      )}
                      {opt.description && <span className="text-xs text-muted-foreground w-full truncate block mt-0.5">{opt.description}</span>}
                    </div>
                  )}
                </div>
              </DropdownMenu.Item>
            );
          })}

          {filtered.length === 0 && (
            <div className="py-3 text-center text-xs text-muted-foreground">No matches</div>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
