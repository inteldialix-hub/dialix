"use client";

import { ContainerScroll, CardSticky } from "@/components/ui/cards-stack";
import { Reveal } from "@/components/motion";
import {
  MessageSquare,
  Plug,
  Settings,
  Rocket,
  BarChart3,
} from "lucide-react";

const steps = [
  {
    number: "01",
    title: "Design Your Agent",
    description:
      "Define your agent's personality, voice, language, and conversation flow using our no-code builder. Choose from 20+ voice models across 30 languages — each tuned for natural, human-grade dialogue.",
    icon: MessageSquare,
    accent: "bg-gradient-to-br from-purple-500 to-violet-600",
    stat: { value: "5 min", label: "Average Setup Time" },
  },
  {
    number: "02",
    title: "Connect Your Stack",
    description:
      "Plug Dialix into your CRM, helpdesk, calendar, and telephony tools. With 200+ native integrations and webhook support, your AI agent fits seamlessly into your existing workflow — zero rip-and-replace.",
    icon: Plug,
    accent: "bg-gradient-to-br from-blue-500 to-cyan-600",
    stat: { value: "200+", label: "Native Integrations" },
  },
  {
    number: "03",
    title: "Configure & Train",
    description:
      "Upload your knowledge base, set guardrails, define escalation paths, and test conversations in our sandbox. Your agent learns your product, policies, and brand voice — with zero hallucination risk.",
    icon: Settings,
    accent: "bg-gradient-to-br from-emerald-500 to-teal-600",
    stat: { value: "0%", label: "Hallucination Rate" },
  },
  {
    number: "04",
    title: "Launch & Scale",
    description:
      "Deploy across inbound and outbound phone, SMS, WhatsApp, and web channels. Handle 1 or 10,000 concurrent calls with the same enterprise-grade reliability, automatic scaling, and sub-200ms latency.",
    icon: Rocket,
    accent: "bg-gradient-to-br from-amber-500 to-orange-600",
    stat: { value: "10K+", label: "Concurrent Calls" },
  },
  {
    number: "05",
    title: "Measure & Optimize",
    description:
      "Track every conversation with real-time analytics. Measure resolution rates, customer sentiment, call duration, and conversion metrics. Continuously improve your agent with data-driven insights.",
    icon: BarChart3,
    accent: "bg-gradient-to-br from-pink-500 to-rose-600",
    stat: { value: "95%", label: "Resolution Rate" },
  },
];

export default function ScrollProcessSection() {
  return (
    <section className="section-pad">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 lg:gap-12 items-start">
          {/* Sticky left column */}
          <div className="lg:sticky lg:top-32 lg:h-fit mb-12 lg:mb-0 flex flex-col items-center text-center lg:items-start lg:text-left">
            <Reveal>
              <span className="eyebrow-badge mb-6 inline-flex">
                How It Works
              </span>
            </Reveal>
            <Reveal delay={0.1}>
              <h2 className="text-4xl lg:text-5xl font-bold text-zinc-900 dark:text-white tracking-tight leading-[1.1] mb-4">
                From Zero to{" "}
                <span className="text-gradient">Production</span> in Days
              </h2>
            </Reveal>
            <Reveal delay={0.2}>
              <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-md mb-8">
                Deploy enterprise-grade Voice AI without writing a single line
                of code. Dialix handles the infrastructure, compliance,
                and scaling — you focus on results.
              </p>
            </Reveal>
            <Reveal delay={0.3}>
              <div className="flex items-center gap-6">
                <div>
                  <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                    5 Steps
                  </div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    To Production
                  </div>
                </div>
                <div className="w-px h-10 bg-zinc-200 dark:bg-zinc-700" />
                <div>
                  <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                    &lt; 1 Week
                  </div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Average Deploy
                  </div>
                </div>
              </div>
            </Reveal>
          </div>

          {/* Scrolling card stack */}
          <ContainerScroll className="space-y-6">
            {steps.map((step, index) => (
              <CardSticky
                key={step.number}
                index={index}
                incrementY={24}
                incrementZ={5}
                className="card-bezel"
              >
                <div className="card-bezel-inner p-6 lg:p-8">
                  {/* Header row */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-xl ${step.accent} flex items-center justify-center shadow-lg`}
                      >
                        <step.icon className="w-5 h-5 text-white" />
                      </div>
                      <span className="text-sm font-mono font-bold text-purple-600 dark:text-purple-400">
                        {step.number}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-purple-600 dark:text-purple-400">
                        {step.stat.value}
                      </div>
                      <div className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500">
                        {step.stat.label}
                      </div>
                    </div>
                  </div>

                  {/* Content */}
                  <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">
                    {step.title}
                  </h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    {step.description}
                  </p>

                  {/* Progress bar */}
                  <div className="mt-5 h-1 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-purple-500 to-violet-500 rounded-full transition-all duration-500"
                      style={{ width: `${(index + 1) * 20}%` }}
                    />
                  </div>
                </div>
              </CardSticky>
            ))}
          </ContainerScroll>
        </div>
      </div>
    </section>
  );
}
