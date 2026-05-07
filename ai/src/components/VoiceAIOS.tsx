"use client";

import { useState } from "react";
import { Reveal, motion } from "@/components/motion";
import { AnimatePresence } from "framer-motion";
import {
  Users,
  Phone,
  TestTube,
  Monitor,
  SlidersHorizontal,
  MessageSquare,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";

const features = [
  {
    id: "multi-agent",
    icon: Users,
    title: "Multi-Agent System",
    description:
      "Architect modular voice flows with a flexible, API-connected builder. Subflows act as specialized agents that handle tasks independently — giving your team full control over complex logic at scale.",
    nodes: [
      { label: "Greeting Message", type: "start", color: "bg-emerald-500" },
      { label: "Onboarding Agent", type: "agent", color: "bg-purple-500" },
      { label: "Verification Agent", type: "agent", color: "bg-purple-500" },
      { label: "FAQ Agent", type: "process", color: "bg-blue-500" },
      { label: "Billing Agent", type: "process", color: "bg-amber-500" },
      { label: "End Call", type: "end", color: "bg-red-400" },
    ],
  },
  {
    id: "telephony",
    icon: Phone,
    title: "Custom Telephony",
    description:
      "Run your own telephony infrastructure with global number provisioning, SIP trunking, and carrier-grade reliability — no third-party dependencies.",
    nodes: [
      { label: "Number Provisioning", type: "start", color: "bg-emerald-500" },
      { label: "SIP Configuration", type: "agent", color: "bg-purple-500" },
      { label: "Call Routing", type: "process", color: "bg-blue-500" },
      { label: "Quality Monitor", type: "process", color: "bg-amber-500" },
    ],
  },
  {
    id: "sandbox",
    icon: TestTube,
    title: "AI Sandbox for Testing",
    description:
      "Test every conversation path before going live. Simulate edge cases, validate responses, and certify agent behavior against compliance standards.",
    nodes: [
      { label: "Test Scenario", type: "start", color: "bg-emerald-500" },
      { label: "Conversation Sim", type: "agent", color: "bg-purple-500" },
      { label: "Accuracy Check", type: "process", color: "bg-blue-500" },
      { label: "Certification", type: "end", color: "bg-emerald-500" },
    ],
  },
  {
    id: "monitoring",
    icon: Monitor,
    title: "Real-Time Monitoring",
    description:
      "Track live calls, agent performance, and system health from a single dashboard. Get instant alerts for anomalies and resolution bottlenecks.",
    nodes: [
      { label: "Live Dashboard", type: "start", color: "bg-emerald-500" },
      { label: "Performance KPIs", type: "agent", color: "bg-purple-500" },
      { label: "Alert Rules", type: "process", color: "bg-amber-500" },
      { label: "Incident Response", type: "end", color: "bg-red-400" },
    ],
  },
  {
    id: "fine-tuning",
    icon: SlidersHorizontal,
    title: "Data Fine-Tuning",
    description:
      "Refine agent behavior using call data and analytics. Adjust prompts, retrain models, and optimize conversation flows with feedback loops.",
    nodes: [
      { label: "Call Analytics", type: "start", color: "bg-emerald-500" },
      { label: "Model Training", type: "agent", color: "bg-purple-500" },
      { label: "A/B Testing", type: "process", color: "bg-blue-500" },
      { label: "Deploy Update", type: "end", color: "bg-emerald-500" },
    ],
  },
];

export default function VoiceAIOS() {
  const [activeFeature, setActiveFeature] = useState(0);
  const current = features[activeFeature];

  return (
    <section id="platform" className="section-pad bg-zinc-50/50 dark:bg-zinc-900/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <Reveal>
          <span className="eyebrow-badge mb-6 inline-flex">
            End-to-End Solution
          </span>
        </Reveal>

        <div className="grid lg:grid-cols-2 gap-6 lg:gap-16 mb-16">
          <Reveal>
            <h2 className="text-4xl lg:text-5xl font-bold text-zinc-900 dark:text-white tracking-tight leading-[1.1]">
              The Complete{" "}
              <span className="text-gradient">Voice AI OS</span>
            </h2>
          </Reveal>

          <Reveal delay={0.1}>
            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed lg:pt-4">
              Automate, manage, and scale thousands of calls from one unified
              Voice AI Operating System. With Dialix, you design, launch, and
              operate Voice AI Agents end-to-end, with configurable agent
              workflows, enterprise telephony, and deep analytics.
            </p>
          </Reveal>
        </div>

        <div className="w-full h-px bg-zinc-200 dark:bg-zinc-800 mb-12" />

        {/* Feature accordion + flowchart */}
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-16">
          {/* Feature list */}
          <Reveal>
            <div className="space-y-1">
              {features.map((feature, idx) => (
                <div key={feature.id}>
                  <button
                    onClick={() => setActiveFeature(idx)}
                    className={`w-full text-left px-5 py-4 rounded-xl transition-all duration-300 group ${
                      activeFeature === idx
                        ? "bg-white dark:bg-zinc-800/60 shadow-sm"
                        : "hover:bg-white/60 dark:hover:bg-zinc-800/30"
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors duration-300 ${
                          activeFeature === idx
                            ? "bg-purple-100 dark:bg-purple-900/40"
                            : "bg-zinc-100 dark:bg-zinc-800"
                        }`}
                      >
                        <feature.icon
                          className={`w-4 h-4 transition-colors duration-300 ${
                            activeFeature === idx
                              ? "text-purple-600 dark:text-purple-400"
                              : "text-zinc-500 dark:text-zinc-500"
                          }`}
                        />
                      </div>

                      <span
                        className={`text-base font-semibold transition-colors duration-300 ${
                          activeFeature === idx
                            ? "text-zinc-900 dark:text-white"
                            : "text-zinc-500 dark:text-zinc-500"
                        }`}
                      >
                        {feature.title}
                      </span>
                    </div>
                  </button>

                  <AnimatePresence>
                    {activeFeature === idx && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{
                          duration: 0.4,
                          ease: [0.32, 0.72, 0, 1],
                        }}
                        className="overflow-hidden"
                      >
                        <p className="px-5 pb-3 pl-[4.25rem] text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                          {feature.description}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </Reveal>

          {/* Flowchart visualization */}
          <Reveal delay={0.2}>
            <div className="relative bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-8 min-h-[440px] overflow-hidden">
              {/* Dot grid bg */}
              <div className="absolute inset-0 dot-grid opacity-30" />

              <AnimatePresence mode="wait">
                <motion.div
                  key={activeFeature}
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.02 }}
                  transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
                  className="relative h-full"
                >
                  {/* Title */}
                  <div className="flex items-center gap-2 mb-6">
                    <current.icon className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    <span className="text-sm font-semibold text-zinc-900 dark:text-white">
                      {current.title}
                    </span>
                  </div>

                  {/* Nodes */}
                  <div className="space-y-3">
                    {current.nodes.map((node, i) => (
                      <motion.div
                        key={node.label}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          delay: 0.15 + i * 0.08,
                          duration: 0.4,
                          ease: [0.32, 0.72, 0, 1],
                        }}
                      >
                        {/* Connection */}
                        {i > 0 && (
                          <div className="flex items-center gap-2 py-1 pl-5">
                            <div className="w-px h-4 bg-zinc-400 dark:bg-zinc-700" />
                          </div>
                        )}

                        <div className="flex items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border border-zinc-200 dark:border-zinc-700">
                          <div
                            className={`w-6 h-6 rounded-md ${node.color} flex items-center justify-center shrink-0`}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                          </div>
                          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                            {node.label}
                          </span>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
