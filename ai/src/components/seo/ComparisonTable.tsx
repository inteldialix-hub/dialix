import { Check, X, Split } from 'lucide-react';
import type { ComparisonMatrix } from '@/data/seo/types';

interface ComparisonTableProps {
  matrix: ComparisonMatrix;
}

export function ComparisonTable({ matrix }: ComparisonTableProps) {
  if (!matrix || !matrix.rows || matrix.rows.length === 0) return null;

  const renderValue = (val: string | boolean, isDialix = false) => {
    if (typeof val === 'boolean') {
      return val ? (
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <Check className="w-4 h-4" />
        </span>
      ) : (
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
          <X className="w-4 h-4" />
        </span>
      );
    }
    return (
      <span className={`text-xs font-semibold ${isDialix ? 'text-emerald-400' : 'text-zinc-300'}`}>
        {val}
      </span>
    );
  };

  return (
    <div className="w-full my-10">
      <div className="flex items-center gap-2 mb-4">
        <Split className="w-4 h-4 text-emerald-400" />
        <h3 className="text-sm font-semibold tracking-wide uppercase text-zinc-400">
          Feature & Architectural Comparison Matrix
        </h3>
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/[0.08] bg-[#111317] shadow-xl">
        <table className="w-full text-left border-collapse text-xs min-w-[640px]">
          <thead>
            <tr className="border-b border-white/[0.08] bg-white/[0.02]">
              <th scope="col" className="py-3.5 px-4 font-semibold text-zinc-300 w-1/4">Capability / Feature</th>
              <th scope="col" className="py-3.5 px-4 font-semibold text-emerald-400 bg-emerald-500/[0.04] w-1/4">
                Dialix Voice AI
              </th>
              <th scope="col" className="py-3.5 px-4 font-semibold text-zinc-400 w-1/4">
                {matrix.competitorName}
              </th>
              <th scope="col" className="py-3.5 px-4 font-semibold text-zinc-400 w-1/4">Architectural Impact</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {matrix.rows.map((row, idx) => (
              <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                <td className="py-3 px-4 font-medium text-white">{row.feature}</td>
                <td className="py-3 px-4 bg-emerald-500/[0.02]">
                  {renderValue(row.dialixValue, true)}
                </td>
                <td className="py-3 px-4 text-zinc-400">
                  {renderValue(row.competitorValue, false)}
                </td>
                <td className="py-3 px-4 text-zinc-400 leading-relaxed">
                  {row.explanation}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
