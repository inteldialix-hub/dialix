"use client";

import { Reveal, Stagger, MotionItem } from "@/components/motion";
import {
  Headphones,
  ShoppingBag,
  Building2,
  Home,
  Code2,
  Stethoscope,
  Laptop,
  Wifi,
  Play,
} from "lucide-react";

const industries = [
  {
    title: "BPO & Call Centers",
    description:
      "Reduce agent load and call handling time with AI agents that manage tier-1 support and overflow calls at scale.",
    icon: Headphones,
    gradient: "from-purple-600 to-violet-700",
  },
  {
    title: "Retail",
    description:
      "Automate order tracking, FAQs, and customer support to boost satisfaction and reduce wait times.",
    icon: ShoppingBag,
    gradient: "from-purple-600 to-fuchsia-700",
  },
  {
    title: "Financial Services",
    description:
      "Verify callers, process claims, and handle account requests securely with compliant, always-on voice AI.",
    icon: Building2,
    gradient: "from-violet-600 to-purple-800",
  },
  {
    title: "Real Estate",
    description:
      "Answer property inquiries, qualify leads, and schedule viewings instantly — even after hours.",
    icon: Home,
    gradient: "from-purple-700 to-indigo-800",
  },
  {
    title: "Technology",
    description:
      "Automate inbound inquiries, onboarding, and client updates so your team can focus on strategy.",
    icon: Code2,
    gradient: "from-indigo-600 to-purple-700",
  },
  {
    title: "Healthcare",
    description:
      "Provide 24/7 patient support, appointment scheduling, and call routing so staff can focus on care.",
    icon: Stethoscope,
    gradient: "from-purple-600 to-violet-800",
  },
  {
    title: "Software",
    description:
      "Qualify leads, schedule demos, and manage support calls automatically — scale smarter.",
    icon: Laptop,
    gradient: "from-violet-700 to-purple-800",
  },
  {
    title: "Telecom",
    description:
      "Handle activations, billing, and support calls with AI agents that integrate with your systems.",
    icon: Wifi,
    gradient: "from-purple-700 to-fuchsia-800",
  },
];

export default function IndustryAgents() {
  return (
    <section id="industries" className="section-pad section-alt">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal>
          <span className="eyebrow-badge mb-6 inline-flex">
            Production-Ready Agents
          </span>
        </Reveal>

        <div className="grid lg:grid-cols-2 gap-6 lg:gap-16 mb-12">
          <Reveal>
            <h2 className="text-4xl lg:text-5xl font-bold text-zinc-900 dark:text-white tracking-tight leading-[1.1]">
              Production-Ready Agents for{" "}
              <span className="text-gradient">Every Industry</span>
            </h2>
          </Reveal>

          <Reveal delay={0.1}>
            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed lg:pt-4">
              Whether it&apos;s scheduling, claims, or always-on support,
              Dialix automates the calls that slow teams down. Purpose-built
              for enterprise demands, our multilingual Voice AI agents integrate
              securely with your systems.
            </p>
          </Reveal>
        </div>

        {/* Industry grid */}
        <Stagger className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {industries.map((industry) => (
            <MotionItem key={industry.title}>
              <div className="group overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-700/40 bg-white dark:bg-zinc-900 shadow-sm hover:shadow-lg hover:shadow-purple-500/8 transition-all duration-400 cursor-pointer">
                {/* Gradient header */}
                <div
                  className={`relative h-36 bg-gradient-to-br ${industry.gradient} p-5`}
                >
                  <industry.icon className="w-7 h-7 text-white/80 absolute top-4 right-4" />

                  {/* Decorative pattern */}
                  <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-2 left-2 w-16 h-16 border border-white/30 rounded-full" />
                    <div className="absolute bottom-4 right-4 w-8 h-8 border border-white/20 rounded-lg rotate-12" />
                  </div>
                </div>

                {/* Content */}
                <div className="p-5">
                  <h3 className="text-base font-semibold text-zinc-900 dark:text-white mb-2">
                    {industry.title}
                  </h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed mb-4">
                    {industry.description}
                  </p>
                  <button type="button" className="w-full flex items-center justify-center gap-2 py-2.5 bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-xl text-sm font-medium text-zinc-700 dark:text-zinc-300 transition-colors group/btn">
                    <Play className="w-3.5 h-3.5 group-hover/btn:text-purple-600 dark:group-hover/btn:text-purple-400 transition-colors" />
                    Hear Demo
                  </button>
                </div>
              </div>
            </MotionItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
