'use client';

import { useState } from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';
import type { FaqItem } from '@/data/seo/types';

interface FaqAccordionProps {
  faqs: FaqItem[];
}

export function FaqAccordion({ faqs }: FaqAccordionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  if (!faqs || faqs.length === 0) return null;

  const toggle = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <div className="w-full my-12">
      <div className="flex items-center gap-2 mb-6">
        <HelpCircle className="w-4 h-4 text-emerald-400" />
        <h3 className="text-sm font-semibold tracking-wide uppercase text-zinc-400">
          Frequently Asked Questions & Technical Specifications
        </h3>
      </div>

      <div className="space-y-3">
        {faqs.map((faq, idx) => {
          const isOpen = openIndex === idx;

          return (
            <div
              key={idx}
              className="rounded-xl border border-white/[0.08] bg-[#111317] overflow-hidden transition-all duration-200"
            >
              <button
                type="button"
                onClick={() => toggle(idx)}
                className="w-full py-4 px-5 flex items-center justify-between text-left hover:bg-white/[0.02] transition-colors"
                aria-expanded={isOpen}
              >
                <span className="text-sm font-semibold text-white pr-4">
                  {faq.question}
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-zinc-400 shrink-0 transition-transform duration-200 ${
                    isOpen ? 'rotate-180 text-emerald-400' : ''
                  }`}
                />
              </button>

              {isOpen && (
                <div className="px-5 pb-5 pt-1 text-xs sm:text-sm text-zinc-400 leading-relaxed border-t border-white/[0.04]">
                  {faq.answer}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
