"use client";

import { Reveal } from "@/components/motion";
import * as Accordion from "@radix-ui/react-accordion";
import { ChevronDown } from "lucide-react";

const faqs = [
  {
    q: "What is Dialix and how does it work?",
    a: "Dialix is an enterprise Voice AI platform that lets you build, deploy, and manage AI-powered phone agents. Our agents handle inbound and outbound calls using natural language processing, integrating with your existing tools and workflows.",
  },
  {
    q: "How long does it take to deploy a voice agent?",
    a: "Most enterprises go from pilot to production within 2-4 weeks. Our forward-deployed engineering team works alongside yours to configure, test, and launch agents tailored to your specific use case.",
  },
  {
    q: "Is Dialix secure and compliant?",
    a: "Yes. Dialix is certified across SOC 2, HIPAA, PCI DSS, and GDPR. We provide full encryption, detailed audit logs, role-based access controls, and region-based data hosting.",
  },
  {
    q: "Can Dialix integrate with my existing tools?",
    a: "Absolutely. Dialix integrates natively with Salesforce, HubSpot, Zendesk, Freshworks, Calendly, and dozens more. We also offer a REST API and webhook support for custom integrations.",
  },
  {
    q: "What languages does Dialix support?",
    a: "Dialix supports 30+ languages with native-quality pronunciation. Agents can switch languages mid-call and handle code-switching for multilingual customer bases.",
  },
  {
    q: "How is pricing structured?",
    a: "Pricing is based on usage — specifically the number of minutes handled by your AI agents. We offer starter, growth, and enterprise tiers with volume discounts. Contact sales for a custom quote.",
  },
];

export default function FAQSection() {
  return (
    <section id="faq" className="section-pad">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-[1fr_1.5fr] gap-12 lg:gap-20">
          {/* Left: heading */}
          <Reveal>
            <div className="lg:sticky lg:top-32 lg:self-start">
              <span className="eyebrow-badge mb-6 inline-flex">FAQ</span>
              <h2 className="text-4xl lg:text-5xl font-bold text-zinc-900 dark:text-white tracking-tight leading-[1.1] mt-4 mb-4">
                Frequently Asked Questions
              </h2>
              <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Everything you need to know about deploying enterprise Voice AI
                with Dialix.
              </p>
            </div>
          </Reveal>

          {/* Right: accordion */}
          <Reveal delay={0.15}>
            <Accordion.Root type="single" collapsible className="space-y-3">
              {faqs.map((faq, idx) => (
                <Accordion.Item
                  key={idx}
                  value={`faq-${idx}`}
                  className="group rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden data-[state=open]:border-purple-300/60 dark:data-[state=open]:border-purple-700/40 transition-colors"
                >
                  <Accordion.Trigger className="flex items-center justify-between w-full px-6 py-5 text-left text-base font-semibold text-zinc-900 dark:text-white hover:text-purple-700 dark:hover:text-purple-400 transition-colors cursor-pointer">
                    {faq.q}
                    <ChevronDown className="w-4 h-4 shrink-0 ml-4 text-zinc-400 dark:text-zinc-500 group-data-[state=open]:rotate-180 transition-transform duration-300" />
                  </Accordion.Trigger>
                  <Accordion.Content className="overflow-hidden data-[state=open]:animate-slideDown data-[state=closed]:animate-slideUp">
                    <div className="px-6 pb-5 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                      {faq.a}
                    </div>
                  </Accordion.Content>
                </Accordion.Item>
              ))}
            </Accordion.Root>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
