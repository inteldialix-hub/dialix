'use client';

import React, { useState, useRef, useEffect } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';

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
        <div className={`custom-select ${small ? 'small' : ''} ${disabled ? 'disabled' : ''} ${open ? 'is-open' : ''}`}>
          <div className="custom-select-trigger">
            <span className={selectedOption ? '' : 'placeholder'} style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
              {selectedOption?.provider && (
                <span className="cs-provider-dot" style={{ background: providerColor(selectedOption.provider) }} />
              )}
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayLabel}</span>
              {selectedOption?.latency_ms != null && selectedOption.latency_ms > 0 && (
                <span className={`cs-latency-badge ${selectedOption.latency_ms <= 250 ? 'cs-latency-fast' : selectedOption.latency_ms <= 500 ? 'cs-latency-med' : 'cs-latency-slow'}`}>~{selectedOption.latency_ms}ms</span>
              )}
              {selectedOption?.context_window && (
                <span className="cs-badge cs-badge-ctx">{formatTokens(selectedOption.context_window)} ctx</span>
              )}
            </span>
            <svg
              width="10"
              height="10"
              viewBox="0 0 10 10"
              style={{
                transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.15s ease',
                opacity: 0.4,
                flexShrink: 0,
              }}
            >
              <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
            </svg>
          </div>
        </div>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className={`custom-select-dropdown ${hasRichMeta ? 'rich' : ''}`}
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
            <div className="cs-search-wrap" onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
              <input
                ref={searchRef}
                className="cs-search"
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

            let latencyClass = '';
            if (opt.latency_ms) {
              if (opt.latency_ms <= 250) latencyClass = 'cs-latency-fast';
              else if (opt.latency_ms <= 500) latencyClass = 'cs-latency-med';
              else latencyClass = 'cs-latency-slow';
            }

            return (
              <DropdownMenu.Item
                key={opt.value}
                className={`custom-select-option ${isSelected ? 'selected' : ''} ${hasRichMeta ? 'rich' : ''} ${isIncompat ? 'incompatible' : ''}`}
                onSelect={(e) => {
                  e.preventDefault(); // allow us to handle state
                  onChange({ target: { value: opt.value } });
                  setOpen(false);
                }}
              >
                <div className="cs-opt-main">
                  <div className="cs-opt-label-row">
                    {opt.provider && (
                      <span className="cs-provider-dot" style={{ background: providerColor(opt.provider) }} />
                    )}
                    <span className="cs-opt-label">{opt.label}</span>
                    {opt.latency_ms != null && opt.latency_ms > 0 && (
                      <span className={`cs-latency-badge ${latencyClass}`} title={`Estimated first-token latency`}>
                        ~{opt.latency_ms}ms
                      </span>
                    )}
                    {opt.provider && (
                      <span className="cs-provider-tag" style={{ color: providerColor(opt.provider), borderColor: providerColor(opt.provider) }}>
                        {opt.provider}
                      </span>
                    )}
                  </div>

                  {/* Metadata badges row */}
                  {hasRichMeta && (
                    <div className="cs-opt-meta">
                      {ctxStr && <span className="cs-badge" title="Context window">{ctxStr} ctx</span>}
                      {maxTokStr && <span className="cs-badge" title="Max output tokens">{maxTokStr} out</span>}
                      {opt.supports_image && <span className="cs-badge cs-badge-cap" title="Image input">🖼️</span>}
                      {opt.supports_document && <span className="cs-badge cs-badge-cap" title="Document input">📄</span>}
                      {opt.supports_parallel_tools && <span className="cs-badge cs-badge-cap" title="Parallel tools">⚡</span>}
                      {opt.language_count != null && opt.language_count > 0 && (
                        <span className="cs-badge" title="Supported languages">{opt.language_count} lang{opt.language_count !== 1 ? 's' : ''}</span>
                      )}
                      {isIncompat && opt.incompatible_reason && (
                        <span className="cs-badge cs-badge-warn">{opt.incompatible_reason}</span>
                      )}
                      {opt.description && <span className="cs-opt-desc">{opt.description}</span>}
                    </div>
                  )}
                </div>
              </DropdownMenu.Item>
            );
          })}

          {filtered.length === 0 && (
            <div style={{ padding: '12px 14px', fontSize: 12, color: 'var(--text-quaternary)', textAlign: 'center' }}>No matches</div>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
