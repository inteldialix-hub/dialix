import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import CTABanner from '@/components/CTABanner';
import { Breadcrumbs } from './Breadcrumbs';
import { BenchmarkGrid } from './BenchmarkGrid';
import { CodeBlock } from './CodeBlock';
import { ComparisonTable } from './ComparisonTable';
import { FaqAccordion } from './FaqAccordion';
import type { ProgrammaticPageData } from '@/data/seo/types';
import {
  Sparkles,
  Layers,
  ArrowRight,
  Workflow,
  Cpu,
  Shield,
  CheckCircle2,
} from 'lucide-react';

interface ProgrammaticLayoutProps {
  data: ProgrammaticPageData;
}

export function ProgrammaticLayout({ data }: ProgrammaticLayoutProps) {
  return (
    <div className="min-h-screen bg-[#07090d] text-zinc-100 flex flex-col selection:bg-emerald-500/20 selection:text-emerald-300">
      <Header />

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
        {/* Breadcrumb Navigation */}
        <Breadcrumbs breadcrumbs={data.breadcrumbs} />

        {/* Hero Section */}
        <header className="mt-4 mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{data.badge}</span>
            <span className="text-zinc-600">|</span>
            <span className="text-zinc-400">{data.category}</span>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white mb-4 leading-tight">
            {data.h1}
          </h1>

          <p className="text-base sm:text-lg text-zinc-300 max-w-3xl leading-relaxed mb-8 font-normal">
            {data.tagline}
          </p>

          {/* GEO / AEO Inverted Pyramid Direct Answer Callout */}
          <div className="relative rounded-2xl p-6 sm:p-7 bg-gradient-to-br from-emerald-950/30 via-[#111317] to-[#0d0f12] border border-emerald-500/30 shadow-[0_0_40px_rgba(16,185,129,0.08)]">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                  Direct Answer & Executive Verdict (GEO / AEO)
                </span>
              </div>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Verified Benchmark
              </span>
            </div>
            <p className="text-sm sm:text-base text-zinc-100 leading-relaxed font-normal">
              {data.directAnswer}
            </p>

            {/* Entity metadata tags */}
            <div className="mt-4 pt-4 border-t border-white/[0.06] flex flex-wrap items-center gap-2 text-xs">
              <span className="text-zinc-500 font-medium">Core Entities:</span>
              <span className="px-2 py-0.5 rounded bg-white/[0.04] text-zinc-300 border border-white/[0.06]">
                {data.entities.primaryEntity}
              </span>
              {data.entities.relatedEntities.map((e, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 rounded bg-white/[0.03] text-zinc-400 border border-white/[0.04]"
                >
                  {e}
                </span>
              ))}
              {data.entities.protocols.map((p, idx) => (
                <span
                  key={`proto-${idx}`}
                  className="px-2 py-0.5 rounded bg-emerald-500/[0.06] text-emerald-400 border border-emerald-500/10"
                >
                  {p}
                </span>
              ))}
            </div>
          </div>
        </header>

        {/* Technical Architecture & Step Pipeline */}
        <section className="my-12">
          <div className="flex items-center gap-2 mb-2">
            <Workflow className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-semibold tracking-wide uppercase text-zinc-400">
              Technical Architecture & Event Pipeline
            </h2>
          </div>
          <p className="text-sm text-zinc-300 mb-6 leading-relaxed">
            {data.architecture.summary}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {data.architecture.steps.map((step) => (
              <div
                key={step.stepNumber}
                className="p-5 rounded-xl bg-[#111317] border border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] hover:border-white/[0.16] transition-all flex flex-col"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-bold flex items-center justify-center font-mono">
                    {step.stepNumber}
                  </span>
                  <span className="text-[10px] uppercase font-mono text-zinc-500 tracking-wider">
                    Pipeline Step
                  </span>
                </div>
                <h3 className="text-sm font-bold text-white mb-2 leading-snug">
                  {step.title}
                </h3>
                <p className="text-xs text-zinc-400 leading-relaxed mb-4 flex-1">
                  {step.description}
                </p>
                <div className="pt-3 border-t border-white/[0.04] text-[11px] font-mono text-emerald-400/90 truncate">
                  {step.technicalDetails}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Benchmarks Grid */}
        <BenchmarkGrid benchmarks={data.benchmarks} />

        {/* Code Example (if available) */}
        {data.codeExample && <CodeBlock example={data.codeExample} />}

        {/* Comparison Matrix (if available) */}
        {data.comparisonMatrix && (
          <ComparisonTable matrix={data.comparisonMatrix} />
        )}

        {/* FAQ Accordion */}
        <FaqAccordion faqs={data.faqs} />

        {/* Semantic Cluster / Related Pages */}
        {data.relatedPages && data.relatedPages.length > 0 && (
          <section className="my-14 pt-8 border-t border-white/[0.08]">
            <div className="flex items-center gap-2 mb-4">
              <Layers className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-semibold tracking-wide uppercase text-zinc-400">
                Related Telephony Integrations & Solutions
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.relatedPages.map((rel, idx) => {
                const prefix =
                  rel.type === 'solution'
                    ? '/solutions'
                    : rel.type === 'comparison'
                    ? '/compare'
                    : rel.type === 'template'
                    ? '/templates'
                    : '/integrations';
                const href = `${prefix}/${rel.slug}`;

                return (
                  <Link
                    key={idx}
                    href={href}
                    className="p-4 rounded-xl bg-[#111317] border border-white/[0.08] hover:border-emerald-500/40 hover:bg-white/[0.02] transition-all group flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400/80">
                          {rel.type}
                        </span>
                        <ArrowRight className="w-3.5 h-3.5 text-zinc-500 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all" />
                      </div>
                      <h4 className="text-sm font-bold text-white group-hover:text-emerald-300 transition-colors mb-1.5 line-clamp-1">
                        {rel.title}
                      </h4>
                      <p className="text-xs text-zinc-400 leading-normal line-clamp-2">
                        {rel.description}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* CTA Conversion Banner */}
        <div className="mt-16">
          <CTABanner />
        </div>
      </main>

      <Footer />
    </div>
  );
}
