"use client";

import { useState } from "react";
import { Reveal, motion } from "@/components/motion";
import { AnimatePresence } from "framer-motion";
import { Hammer, TestTube, Rocket, Brain, ChevronRight, Bell } from "lucide-react";

const steps = [
  {
    id: "build",
    number: "01",
    title: "Build",
    icon: Hammer,
    description:
      "Voice AI flows that follow business logic, not guesswork. Use the visual Flow Designer to define every step, connect APIs, and create agents that act with precision.",
    features: [
      "Visual flow builder with drag-and-drop nodes",
      "API integrations and webhooks",
      "Multi-language voice configuration",
    ],
  },
  {
    id: "evaluate",
    number: "02",
    title: "Evaluate",
    icon: TestTube,
    description:
      "Test agents in a sandbox before they go live. Simulate real calls, measure accuracy, and validate every conversation path against your success criteria.",
    features: [
      "AI sandbox for risk-free testing",
      "Conversation flow validation",
      "Performance scoring metrics",
    ],
  },
  {
    id: "launch",
    number: "03",
    title: "Launch",
    icon: Rocket,
    description:
      "Deploy across channels with one click. Assign phone numbers, configure routing rules, and go live with confidence — knowing every edge case is covered.",
    features: [
      "One-click deployment",
      "Custom telephony routing",
      "Real-time monitoring dashboard",
    ],
  },
  {
    id: "learn",
    number: "04",
    title: "Learn",
    icon: Brain,
    description:
      "Agents improve with every call. Use analytics and call recordings to identify gaps and continuously refine performance at scale.",
    features: [
      "Deep conversation analytics",
      "Automated improvement suggestions",
      "Continuous learning loops",
    ],
  },
];

export default function BellFramework() {
  const [activeStep, setActiveStep] = useState(0);
  const current = steps[activeStep];

  return (
    <section className="section-pad relative">
      <div className="absolute inset-0 dot-grid opacity-20" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <Reveal>
          <span className="eyebrow-badge mb-6 inline-flex">
            Dialix BELL Framework
          </span>
        </Reveal>

        <div className="grid lg:grid-cols-2 gap-6 lg:gap-16 mb-16">
          <Reveal>
            <h2 className="text-4xl lg:text-5xl font-bold text-zinc-900 dark:text-white tracking-tight leading-[1.1]">
              Discover{" "}
              <span className="text-gradient">BELL</span>
              {" "}
              <Bell className="inline w-8 h-8 text-purple-500 -mt-2" />
              <br />
              Your Proven Path to Reliable Voice AI
            </h2>
          </Reveal>

          <Reveal delay={0.1}>
            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed lg:pt-4">
              The Dialix BELL Framework connects every stage of the agent
              lifecycle — Build, Evaluate, Launch, Learn — into one repeatable
              process. Built into the Dialix platform, it helps enterprises
              deploy faster, reduce risk, and continuously improve performance at
              scale.
            </p>
          </Reveal>
        </div>

        {/* Divider */}
        <div className="w-full h-px bg-zinc-200 dark:bg-zinc-800 mb-12" />

        {/* Interactive accordion + visual */}
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-16">
          {/* Accordion */}
          <Reveal>
            <div className="space-y-1">
              {steps.map((step, idx) => (
                <button
                  key={step.id}
                  onClick={() => setActiveStep(idx)}
                  className={`w-full text-left px-5 py-4 rounded-xl transition-all duration-300 group ${
                    activeStep === idx
                      ? "bg-zinc-50 dark:bg-zinc-800/60"
                      : "hover:bg-zinc-50/60 dark:hover:bg-zinc-800/30"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <span
                      className={`text-sm font-mono font-bold transition-colors duration-300 ${
                        activeStep === idx
                          ? "text-purple-600 dark:text-purple-400"
                          : "text-zinc-500 dark:text-zinc-600"
                      }`}
                    >
                      {step.number}
                    </span>

                    <div
                      className={`w-1 h-6 rounded-full transition-all duration-300 ${
                        activeStep === idx
                          ? "bg-purple-600 dark:bg-purple-400"
                          : "bg-zinc-200 dark:bg-zinc-700"
                      }`}
                    />

                    <span
                      className={`text-lg font-semibold transition-colors duration-300 ${
                        activeStep === idx
                          ? "text-zinc-900 dark:text-white"
                          : "text-zinc-500 dark:text-zinc-500"
                      }`}
                    >
                      {step.title}
                    </span>

                    <ChevronRight
                      className={`w-4 h-4 ml-auto transition-all duration-300 ${
                        activeStep === idx
                          ? "text-purple-600 dark:text-purple-400 rotate-90"
                          : "text-zinc-400 dark:text-zinc-600"
                      }`}
                    />
                  </div>

                  <AnimatePresence>
                    {activeStep === idx && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
                        className="overflow-hidden"
                      >
                        <div className="pt-4 pl-[3.75rem]">
                          <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed mb-3">
                            {step.description}
                          </p>
                          <ul className="space-y-1.5">
                            {step.features.map((f) => (
                              <li
                                key={f}
                                className="text-xs text-zinc-500 dark:text-zinc-500 flex items-center gap-2"
                              >
                                <div className="w-1 h-1 rounded-full bg-purple-500" />
                                {f}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </button>
              ))}
            </div>
          </Reveal>

          {/* Flow diagram visualization */}
          <Reveal delay={0.2}>
            <div className="relative rounded-3xl overflow-hidden purple-gradient p-8 lg:p-10 min-h-[400px]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeStep}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -16 }}
                  transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
                  className="h-full"
                >
                  {/* Flow nodes */}
                  <div className="space-y-4">
                    <div className="bg-white/95 dark:bg-zinc-900/90 rounded-xl p-4 shadow-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-5 h-5 rounded bg-purple-600 flex items-center justify-center">
                          <current.icon className="w-3 h-3 text-white" />
                        </div>
                        <span className="text-xs font-semibold text-zinc-900 dark:text-white">
                          {current.title} Phase
                        </span>
                      </div>
                      <p className="text-xs text-zinc-600 dark:text-zinc-400">
                        {current.description.slice(0, 80)}...
                      </p>
                    </div>

                    {/* Connection line */}
                    <div className="flex justify-center">
                      <div className="w-px h-8 bg-white/30" />
                    </div>

                    {/* Sub-nodes */}
                    {current.features.map((feature, i) => (
                      <motion.div
                        key={feature}
                        initial={{ opacity: 0, x: i % 2 === 0 ? -20 : 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{
                          delay: 0.2 + i * 0.1,
                          duration: 0.4,
                          ease: [0.32, 0.72, 0, 1],
                        }}
                        className="bg-white/90 dark:bg-zinc-900/80 rounded-lg px-4 py-3 shadow-md flex items-center gap-3"
                      >
                        <div className="w-2 h-2 rounded-full bg-purple-400 shrink-0" />
                        <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                          {feature}
                        </span>
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
