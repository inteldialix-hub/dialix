'use client';

import { useState } from 'react';
import { Check, Copy, Terminal } from 'lucide-react';
import type { CodeExample } from '@/data/seo/types';

interface CodeBlockProps {
  example: CodeExample;
}

export function CodeBlock({ example }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(example.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback if clipboard API is restricted
      setCopied(false);
    }
  };

  return (
    <div className="w-full my-8 rounded-xl overflow-hidden border border-white/[0.08] bg-[#0c0e12] shadow-2xl">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-white/[0.03] border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-medium text-zinc-300 font-mono">
            {example.filename}
          </span>
          <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-400/90 bg-emerald-500/10 rounded-full border border-emerald-500/20">
            {example.language}
          </span>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-zinc-300 hover:text-white bg-white/[0.05] hover:bg-white/[0.1] rounded-md border border-white/[0.08] transition-all duration-150 active:scale-95"
          aria-label={copied ? 'Code copied' : 'Copy code to clipboard'}
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code content */}
      <div className="p-4 overflow-x-auto">
        <pre className="text-xs leading-relaxed font-mono text-zinc-200">
          <code>{example.code}</code>
        </pre>
      </div>

      {/* Explanation caption */}
      {example.explanation && (
        <div className="px-4 py-2.5 bg-white/[0.02] border-t border-white/[0.06] text-xs text-zinc-400">
          <span className="font-semibold text-zinc-300">Implementation Note: </span>
          {example.explanation}
        </div>
      )}
    </div>
  );
}
