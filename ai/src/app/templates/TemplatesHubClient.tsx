'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import CTABanner from '@/components/CTABanner';
import { Breadcrumbs } from '@/components/seo/Breadcrumbs';
import type { ProgrammaticPageData } from '@/data/seo/types';
import { Search, ArrowRight, Layers, Sparkles, Workflow, Terminal } from 'lucide-react';

interface TemplatesHubClientProps {
  templates: ProgrammaticPageData[];
}

export default function TemplatesHubClient({ templates }: TemplatesHubClientProps) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const categories = useMemo(() => {
    const cats = new Set(templates.map((t) => t.category));
    return ['All', ...Array.from(cats)];
  }, [templates]);

  const filtered = useMemo(() => {
    return templates.filter((item) => {
      const matchesSearch =
        item.title.toLowerCase().includes(search.toLowerCase()) ||
        item.tagline.toLowerCase().includes(search.toLowerCase()) ||
        item.entities.primaryEntity.toLowerCase().includes(search.toLowerCase());

      const matchesCat =
        selectedCategory === 'All' || item.category === selectedCategory;

      return matchesSearch && matchesCat;
    });
  }, [templates, search, selectedCategory]);

  const breadcrumbs = [
    { name: 'Templates', url: '/templates' },
  ];

  return (
    <div className="min-h-screen bg-[#07090d] text-zinc-100 flex flex-col selection:bg-emerald-500/20 selection:text-emerald-300">
      <Header />

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
        <Breadcrumbs breadcrumbs={breadcrumbs} />

        <header className="mt-4 mb-10 text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            <span>80+ Turnkey Workflow Blueprints</span>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white mb-4 leading-tight">
            Production-Ready Voice AI Workflow Blueprints
          </h1>

          <p className="text-base sm:text-lg text-zinc-300 leading-relaxed font-normal">
            Clone and deploy pre-architected voice solutions in under 5 minutes. Every blueprint includes verified prompt templates, tool-calling schemas, telephony carrier configurations, and post-call automation hooks.
          </p>

          {/* Search Bar */}
          <div className="mt-8 relative max-w-xl mx-auto">
            <div className="relative">
              <Search className="w-4 h-4 text-zinc-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search 80+ blueprints (e.g. n8n ElevenLabs, Zapier HubSpot, Stripe Payment)..."
                className="w-full pl-11 pr-4 py-3 text-sm rounded-xl bg-[#111317] border border-white/[0.1] focus:border-emerald-500/60 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-white placeholder-zinc-500 shadow-xl transition-all"
              />
            </div>
          </div>

          {/* Category Filter Pills */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            {categories.map((cat) => {
              const isActive = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  type="button"
                  className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-150 ${
                    isActive
                      ? 'bg-emerald-500 text-black font-semibold shadow-lg shadow-emerald-500/20'
                      : 'bg-[#111317] text-zinc-400 border border-white/[0.08] hover:text-white hover:border-white/[0.16]'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </header>

        {/* Templates Grid */}
        <section className="my-10">
          <div className="flex items-center justify-between mb-6">
            <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Showing {filtered.length} of {templates.length} Blueprints
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-16 rounded-2xl bg-[#111317] border border-white/[0.08]">
              <Layers className="w-8 h-8 text-zinc-500 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-white mb-1">No blueprints found</h3>
              <p className="text-xs text-zinc-400">Try adjusting your search query or filter category.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filtered.map((item) => (
                <Link
                  key={item.slug}
                  href={`/templates/${item.slug}`}
                  className="p-5 rounded-xl bg-[#111317] border border-white/[0.08] hover:border-emerald-500/40 hover:bg-white/[0.02] transition-all duration-200 group flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {item.badge}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-zinc-500 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all" />
                    </div>

                    <h3 className="text-base font-bold text-white group-hover:text-emerald-300 transition-colors mb-2">
                      {item.title}
                    </h3>

                    <p className="text-xs text-zinc-400 leading-relaxed line-clamp-2 mb-4">
                      {item.tagline}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-white/[0.04] flex items-center justify-between text-[11px] text-zinc-500 font-mono">
                    <span className="truncate max-w-[140px]">{item.category}</span>
                    <span className="text-emerald-400 font-medium">&lt; 5m Deploy</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <div className="mt-16">
          <CTABanner />
        </div>
      </main>

      <Footer />
    </div>
  );
}
