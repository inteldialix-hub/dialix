"use client";

import { Reveal, Stagger, MotionItem } from "@/components/motion";
import { Globe, Settings, Plug, BarChart3 } from "lucide-react";

const telephonyCards = [
  {
    icon: Globe,
    title: "Global Number Provisioning",
    description:
      "Provision local and toll-free numbers in 80+ countries. Assign, port, and manage numbers from one dashboard with instant activation.",
    accent: "from-purple-500/10 to-violet-500/10 dark:from-purple-500/20 dark:to-violet-500/20",
  },
  {
    icon: Settings,
    title: "Advanced Call Routing",
    description:
      "Intelligent routing with time-based, skill-based, and geographic rules. Failover, load balancing, and priority queues built in.",
    accent: "from-blue-500/10 to-cyan-500/10 dark:from-blue-500/20 dark:to-cyan-500/20",
  },
  {
    icon: Plug,
    title: "SIP Trunk Integration",
    description:
      "Connect your existing SIP infrastructure or use Dialix-managed trunks. Full codec support with sub-100ms latency worldwide.",
    accent: "from-emerald-500/10 to-teal-500/10 dark:from-emerald-500/20 dark:to-teal-500/20",
  },
  {
    icon: BarChart3,
    title: "Call Analytics & Quality",
    description:
      "Real-time call quality monitoring with MOS scoring, jitter analysis, and packet loss tracking. Automated alerting for quality drops.",
    accent: "from-amber-500/10 to-orange-500/10 dark:from-amber-500/20 dark:to-orange-500/20",
  },
];

export default function TelephonySection() {
  return (
    <section className="section-pad bg-purple-50/40 dark:bg-zinc-900/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header row */}
        <div className="grid lg:grid-cols-2 gap-6 lg:gap-16 mb-12">
          <Reveal>
            <span className="eyebrow-badge mb-6 inline-flex">
              Custom Telephony
            </span>
            <h2 className="text-4xl lg:text-5xl font-bold text-zinc-900 dark:text-white tracking-tight leading-[1.1] mt-4">
              Enterprise-Grade Telephony Infrastructure
            </h2>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="lg:pt-16">
              <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed mb-6">
                Dialix runs its own telephony network — no third-party
                dependencies, no shared infrastructure. Get carrier-grade
                reliability with full control over every call.
              </p>
            </div>
          </Reveal>
        </div>

        {/* Cards */}
        <Stagger className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {telephonyCards.map((card) => (
            <MotionItem key={card.title}>
              <div
                className={`group relative p-6 rounded-2xl bg-gradient-to-br ${card.accent} border border-zinc-200 dark:border-zinc-700/40 hover:border-purple-300 dark:hover:border-purple-600/40 transition-all duration-300 cursor-pointer h-full`}
              >
                <div className="w-10 h-10 rounded-xl bg-white dark:bg-zinc-800 shadow-sm flex items-center justify-center mb-4">
                  <card.icon className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>

                <h3 className="text-base font-semibold text-zinc-900 dark:text-white mb-2">
                  {card.title}
                </h3>

                <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  {card.description}
                </p>

                {/* Hover line */}
                <div className="absolute bottom-0 left-6 right-6 h-0.5 bg-purple-500/0 group-hover:bg-purple-500/40 rounded-full transition-all duration-500" />
              </div>
            </MotionItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
