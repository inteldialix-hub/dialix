import { Activity, Zap, ShieldCheck, Globe, CheckCircle2 } from 'lucide-react';
import type { BenchmarkItem } from '@/data/seo/types';

interface BenchmarkGridProps {
  benchmarks: BenchmarkItem[];
}

export function BenchmarkGrid({ benchmarks }: BenchmarkGridProps) {
  if (!benchmarks || benchmarks.length === 0) return null;

  return (
    <div className="w-full my-8">
      <div className="flex items-center gap-2 mb-4">
        <Activity className="w-4 h-4 text-emerald-400" />
        <h3 className="text-sm font-semibold tracking-wide uppercase text-zinc-400">
          Verified Telephony & AI Benchmarks
        </h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {benchmarks.map((item, idx) => (
          <div
            key={idx}
            className="p-5 rounded-xl bg-[#111317] border border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] hover:border-white/[0.16] transition-all duration-200 group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-zinc-400">
                {item.label}
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-500/80 group-hover:scale-125 transition-transform" />
            </div>
            <div className="text-2xl font-bold tracking-tight text-white mb-2">
              {item.value}
            </div>
            <p className="text-xs text-zinc-400 leading-normal flex items-start gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
              <span>{item.comparisonNote}</span>
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
