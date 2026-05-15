"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Reveal, motion } from "@/components/motion";
import { BackgroundPaths } from "@/components/ui/background-paths";
import { OrganicBranches } from "@/components/ui/organic-branches";
import { HoverBorderGradient } from "@/components/ui/hover-border-gradient";
import { AnimatePresence } from "framer-motion";
import {
  Phone,
  Calendar,
  UserCheck,
  Headphones,
  ArrowRight,
  Sparkles,
  GitBranch,
  BookOpen,
  Zap,
  Settings,
  PhoneCall,
  AlignLeft,
  FileText,
  Upload,
  Globe,
  Link2,
  CalendarCheck,
  ArrowRightLeft,
  SlidersHorizontal,
  Plus,
  Info,
  CheckCircle2,
  MessageSquare,
  Building2,
  ShoppingBag,
  HeartPulse,
  Mic,
  PhoneOff,
  Volume2,
  Clock,
  Activity,
  Circle,
} from "lucide-react";

/* ─────────────────────── TAB DEFINITIONS ─────────────────────── */

const demoTabs = [
  { id: "use-case", label: "Use Case", icon: Sparkles },
  { id: "flow-designer", label: "Flow Designer", icon: GitBranch },
  { id: "knowledge-base", label: "Knowledge Base", icon: BookOpen },
  { id: "actions", label: "Actions", icon: Zap },
  { id: "test-calls", label: "Test Calls", icon: Phone },
] as const;

type TabId = (typeof demoTabs)[number]["id"];

/* ─────────────────────── DATA ─────────────────────── */

const useCases = [
  {
    id: "real-estate",
    industry: "Real Estate",
    icon: Building2,
    title: "Lead Qualification · Buyer",
    tags: ["#Real-Time Booking", "#Lead Qualification"],
    description:
      "Meet Paul, an AI assistant designed for real estate lead qualification. Paul's primary objective is to identify the preferences...",
    color: "text-red-500 bg-red-500/10",
  },
  {
    id: "ecommerce",
    industry: "E-Commerce",
    icon: ShoppingBag,
    title: "Customer Support · Restaurant",
    tags: ["#Real-Time Booking", "#Receptionist"],
    description:
      "Meet Laura, an AI assistant for Gourmet Table, a fine dining restaurant. Her primary role is to assist callers in scheduling...",
    color: "text-purple-500 bg-purple-500/10",
  },
  {
    id: "healthcare",
    industry: "Healthcare",
    icon: HeartPulse,
    title: "Healthcare Receptionist",
    tags: ["#Receptionist", "#Real-Time Booking"],
    description:
      "Meet Jessica, an AI assistant for your Healthcare company, dedicated to streamlining appointment scheduling and improving...",
    color: "text-purple-500 bg-purple-500/10",
  },
];

const flowSteps = [
  {
    icon: Settings,
    title: "Global Settings",
    preview:
      "Who You Are: You are Laura, the warm and charming voice of Gourmet Table, a fine dining...",
    color: "text-zinc-500",
  },
  {
    icon: PhoneCall,
    title: "Greeting Message",
    preview:
      'Hey there! You\'ve reached Gourmet Table! This is Laura, the reservation assistant. Just a head...',
    color: "text-amber-500",
  },
  {
    icon: AlignLeft,
    title: "Define Reason for Calling",
    preview:
      'After the custom greeting: "Hey there! You\'ve reached Gourmet Table—this is Laura, the...',
    color: "text-zinc-500",
  },
  {
    icon: AlignLeft,
    title: "Reason For Calling",
    preview:
      '"If they\'re looking for a reservation?" Then ask: "So... are we thinking date night? Or celebration...',
    color: "text-zinc-500",
  },
];

const faqEntries = [
  { q: "Can I change my time later?", a: "Yes, just call us in advance" },
  {
    q: "Do you allow walk-ins?",
    a: "Limited availability—reservations preferred",
  },
  {
    q: "Do you offer private dining?",
    a: "Yes, available upon request",
  },
];

const actionsData = [
  {
    icon: CalendarCheck,
    title: "Real-Time Booking",
    description:
      "Let the agent book a meeting or demo directly in your calendar, based on lead availability.",
    color: "bg-orange-500/10 text-orange-500",
  },
  {
    icon: ArrowRightLeft,
    title: "Warm Transfer",
    description:
      "Seamlessly transfer high-intent leads to a human agent or sales rep in real time.",
    color: "bg-green-500/10 text-green-500",
  },
  {
    icon: SlidersHorizontal,
    title: "IVR",
    description:
      "Extracts key preferences, like budget, location, and property type from their responses.",
    color: "bg-blue-500/10 text-blue-500",
  },
];

/* ─────────────────────── LIVE CALL SIMULATION ─────────────────────── */

const callTranscript = [
  { speaker: "agent", text: "Hey there! You've reached Gourmet Table. This is Laura, how can I help you today?" },
  { speaker: "caller", text: "Hi Laura! I'd like to book a table for two this Saturday evening." },
  { speaker: "agent", text: "Wonderful! I have availability at 7:00 PM and 8:30 PM. Any preference?" },
  { speaker: "caller", text: "Let's go with 7:00 PM please." },
  { speaker: "agent", text: "Perfect! I've reserved a table for two at 7:00 PM this Saturday. Can I get a name for the reservation?" },
  { speaker: "caller", text: "It's under Michael Chen." },
  { speaker: "agent", text: "All set, Michael! You're booked for Saturday at 7 PM. I'll send a confirmation to your phone. Is there anything else?" },
];

/* ─────────────────────── MAIN COMPONENT ─────────────────────── */

export default function HeroSection() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabId>("use-case");
  const [selectedUseCase, setSelectedUseCase] = useState("real-estate");
  const [flowMode, setFlowMode] = useState<"flow" | "prompt">("flow");

  return (
    <section className="relative min-h-[100dvh] hero-gradient overflow-hidden">
      <BackgroundPaths />
      <OrganicBranches />
      <div className="absolute inset-0 dot-grid opacity-40 dark:opacity-20 pointer-events-none" aria-hidden="true" />
      <div className="absolute inset-0 grid-lines opacity-30 dark:opacity-10 pointer-events-none" aria-hidden="true" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 lg:pt-32 pb-20">
        {/* Eyebrow */}
        <Reveal>
          <div className="flex items-center gap-3 mb-8">
            <span className="eyebrow-badge">
              <Sparkles className="w-3 h-3 mr-1.5 text-purple-500" />
              Enterprise Voice AI
            </span>
          </div>
        </Reveal>

        {/* Heading */}
        <Reveal delay={0.1}>
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-zinc-900 dark:text-white max-w-4xl leading-[1.05]">
            AI Voice Agents for{" "}
            <span className="text-gradient">Enterprise-Scale</span> Phone
            Automation
          </h1>
        </Reveal>

        {/* Subtext */}
        <Reveal delay={0.2}>
          <p className="mt-6 text-lg lg:text-xl text-zinc-600 dark:text-zinc-400 max-w-2xl leading-relaxed">
            Deploy human-like voice AI agents that handle thousands of calls
            simultaneously. Build, evaluate, launch, and learn — all from one
            platform.
          </p>
        </Reveal>

        {/* CTAs */}
        <Reveal delay={0.3}>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <a href="/signup">
              <HoverBorderGradient
                containerClassName="rounded-full"
                className="flex items-center gap-2 text-sm font-semibold px-8 py-3"
                duration={1.5}
              >
                <span>Start Now</span>
                <ArrowRight className="w-4 h-4" />
              </HoverBorderGradient>
            </a>

            <a href="mailto:contact@dialix.ai" className="btn-pill-accent text-base px-8 py-3.5">
              Contact Sales
            </a>
          </div>
        </Reveal>

        {/* ═══ EMBEDDED DASHBOARD DEMO — LINEAR STYLE ═══ */}
        <Reveal delay={0.4}>
          <div className="mt-16">
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 backdrop-blur-xl shadow-2xl shadow-purple-500/5 overflow-hidden">
              {/* Window title bar */}
              <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/80 dark:bg-zinc-900/80">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" />
                    <div className="w-2.5 h-2.5 rounded-full bg-[#FFBD2E]" />
                    <div className="w-2.5 h-2.5 rounded-full bg-[#28C840]" />
                  </div>
                  <span className="text-[11px] font-medium text-zinc-400 dark:text-zinc-600 ml-3 font-mono">
                    dialix.ai/dashboard
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 text-[10px] font-mono text-zinc-400 dark:text-zinc-500">
                    <span>⌘K</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/20">
                    <Circle className="w-1.5 h-1.5 fill-green-500 text-green-500" />
                    <span className="text-[10px] font-semibold text-green-600 dark:text-green-400 tracking-wide">
                      LIVE
                    </span>
                  </div>
                </div>
              </div>

              {/* App layout: sidebar + content */}
              <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] min-h-[440px]">
                {/* ─── Left sidebar ─── */}
                <div className="border-r border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/50 py-3 px-2 hidden md:block">
                  {/* Workspace */}
                  <div className="flex items-center gap-2 px-2.5 py-1.5 mb-3">
                    <div className="w-5 h-5 rounded bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center">
                      <Sparkles className="w-3 h-3 text-white" />
                    </div>
                    <span className="text-[12px] font-semibold text-zinc-900 dark:text-white tracking-tight">Dialix</span>
                  </div>

                  <div className="space-y-0.5">
                    {demoTabs.map((tab, idx) => {
                      const isActive = activeTab === tab.id;
                      return (
                        <button
                          key={tab.id}
                          onClick={() => setActiveTab(tab.id)}
                          className={`
                            w-full flex items-center justify-between gap-2 px-2.5 py-[7px] rounded-lg text-[12px] font-medium transition-all duration-150
                            ${
                              isActive
                                ? "bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-300"
                                : "text-zinc-500 dark:text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/50"
                            }
                          `}
                        >
                          <span className="flex items-center gap-2">
                            <tab.icon className={`w-3.5 h-3.5 ${isActive ? "text-purple-500" : ""}`} />
                            {tab.label}
                          </span>
                          <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${isActive ? "text-purple-400 bg-purple-100 dark:bg-purple-500/20" : "text-zinc-300 dark:text-zinc-700"}`}>
                            {idx + 1}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Sidebar bottom */}
                  <div className="mt-6 pt-3 border-t border-zinc-100 dark:border-zinc-800/60 px-1">
                    <div className="flex items-center gap-2 px-2 py-1.5 text-[11px] text-zinc-400 dark:text-zinc-600">
                      <Activity className="w-3 h-3 text-green-500" />
                      <span>3 agents online</span>
                    </div>
                  </div>
                </div>

                {/* ─── Mobile tab bar (shown below md) ─── */}
                <div className="flex md:hidden items-center gap-1 px-3 py-2 border-b border-zinc-100 dark:border-zinc-800 overflow-x-auto">
                  {demoTabs.map((tab) => {
                    const isActive = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`
                          flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium whitespace-nowrap transition-all
                          ${isActive
                            ? "bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-300"
                            : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                          }
                        `}
                      >
                        <tab.icon className="w-3.5 h-3.5" />
                        {tab.label}
                      </button>
                    );
                  })}
                </div>

                {/* ─── Main content area ─── */}
                <div className="min-h-[440px] flex flex-col">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeTab}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.15, ease: [0.32, 0.72, 0, 1] }}
                      className="flex-1"
                    >
                      {activeTab === "use-case" && (
                        <UseCaseTab
                          selected={selectedUseCase}
                          onSelect={setSelectedUseCase}
                        />
                      )}
                      {activeTab === "flow-designer" && (
                        <FlowDesignerTab
                          mode={flowMode}
                          onModeChange={setFlowMode}
                        />
                      )}
                      {activeTab === "knowledge-base" && <KnowledgeBaseTab />}
                      {activeTab === "actions" && <ActionsTab />}
                      {activeTab === "test-calls" && <TestCallsTab />}
                    </motion.div>
                  </AnimatePresence>

                  {/* Bottom bar */}
                  <div className="flex items-center justify-between px-5 py-2 border-t border-zinc-100 dark:border-zinc-800/60 bg-zinc-50/40 dark:bg-zinc-900/40">
                    <div className="flex items-center gap-2 text-[10px] text-zinc-400 dark:text-zinc-600 font-mono">
                      <Info className="w-3 h-3" />
                      Interactive demo
                    </div>
                    <a href="/signup" className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-semibold rounded-md transition-colors inline-block">
                      Try the Full Platform →
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ═══════════════════════ TAB: USE CASE ═══════════════════════ */

function UseCaseTab({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (id: string) => void;
}) {
  const activeUseCase = useCases.find((uc) => uc.id === selected) || useCases[0];

  return (
    <div className="flex flex-col h-full">
      {/* Content header */}
      <div className="px-5 pt-5 pb-3 border-b border-zinc-100 dark:border-zinc-800/60">
        <h3 className="text-[15px] font-semibold text-zinc-900 dark:text-white">
          Voice Agent Templates
        </h3>
        <p className="text-[11px] text-zinc-500 dark:text-zinc-500 mt-0.5">
          Choose a template to see how Dialix AI agents handle real conversations.
        </p>
      </div>

      {/* List of use cases */}
      <div className="flex-1">
        {useCases.map((uc, idx) => {
          const isSelected = selected === uc.id;
          return (
            <button
              key={uc.id}
              onClick={() => onSelect(uc.id)}
              className={`
                w-full flex items-center gap-3 px-5 py-3.5 text-left transition-all duration-100 border-b border-zinc-50 dark:border-zinc-800/40
                ${
                  isSelected
                    ? "bg-purple-50/70 dark:bg-purple-500/5 border-l-2 border-l-purple-500"
                    : "hover:bg-zinc-50 dark:hover:bg-zinc-900/60 border-l-2 border-l-transparent"
                }
              `}
            >
              {/* Icon */}
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  isSelected
                    ? "bg-purple-100 dark:bg-purple-500/20"
                    : "bg-zinc-100 dark:bg-zinc-800"
                }`}
              >
                <uc.icon className={`w-4 h-4 ${isSelected ? "text-purple-600 dark:text-purple-400" : "text-zinc-400"}`} />
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-[12px] font-semibold truncate ${isSelected ? "text-purple-700 dark:text-purple-300" : "text-zinc-900 dark:text-white"}`}>
                    {uc.title}
                  </span>
                  <span className="text-[9px] font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-600 shrink-0">
                    {uc.industry}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-500 truncate mt-0.5">
                  {uc.description}
                </p>
              </div>

              {/* Tags */}
              <div className="hidden lg:flex items-center gap-1 shrink-0">
                {uc.tags.slice(0, 2).map((tag) => (
                  <span
                    key={tag}
                    className="text-[9px] font-medium text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-500/10 px-1.5 py-0.5 rounded"
                  >
                    {tag}
                  </span>
                ))}
              </div>

              {/* Arrow */}
              <ArrowRight className={`w-3.5 h-3.5 shrink-0 transition-opacity ${isSelected ? "text-purple-500 opacity-100" : "text-zinc-300 opacity-0 group-hover:opacity-100"}`} />
            </button>
          );
        })}

        {/* Detail preview */}
        <div className="p-5">
          <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-100 dark:border-zinc-800/60">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-md bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center">
                <MessageSquare className="w-3 h-3 text-purple-500" />
              </div>
              <h4 className="text-[12px] font-semibold text-zinc-900 dark:text-white">
                {activeUseCase.title}
              </h4>
              <span className="text-[9px] font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-500/10 px-1.5 py-0.5 rounded-full uppercase tracking-wider ml-auto">
                Ready
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-500 leading-relaxed">
              {activeUseCase.description}
            </p>
            <div className="flex items-center gap-2 mt-3">
              {activeUseCase.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-[9px] font-medium text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-500/10 px-2 py-0.5 rounded"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════ TAB: FLOW DESIGNER ═══════════════════════ */

function FlowDesignerTab({
  mode,
  onModeChange,
}: {
  mode: "flow" | "prompt";
  onModeChange: (m: "flow" | "prompt") => void;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] min-h-[400px]">
      {/* Left sidebar */}
      <div className="p-5 border-r border-zinc-100 dark:border-zinc-800">
        <div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 mb-1">
          ✦ Flow Preview
        </div>
        <h4 className="text-lg font-bold text-zinc-900 dark:text-white mb-1">
          Customer Support
        </h4>
        <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed mb-5">
          This agent follows a predefined logic flow to simulate real
          conversations.
        </p>

        <div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 mb-3">
          Select a Mode
        </div>

        <button
          onClick={() => onModeChange("flow")}
          className={`w-full text-left p-3 rounded-xl mb-2 border transition-all ${
            mode === "flow"
              ? "border-purple-300 dark:border-purple-600 bg-purple-50 dark:bg-purple-500/10"
              : "border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
          }`}
        >
          <div className="flex items-center gap-2 mb-0.5">
            <div className="w-5 h-5 rounded bg-blue-500 flex items-center justify-center">
              <GitBranch className="w-3 h-3 text-white" />
            </div>
            <span className="text-sm font-semibold text-zinc-900 dark:text-white">
              Flow View
            </span>
          </div>
          <p className="text-[11px] text-zinc-400 pl-7">
            View the logic of this use case visually.
          </p>
        </button>

        <button
          onClick={() => onModeChange("prompt")}
          className={`w-full text-left p-3 rounded-xl border transition-all ${
            mode === "prompt"
              ? "border-purple-300 dark:border-purple-600 bg-purple-50 dark:bg-purple-500/10"
              : "border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
          }`}
        >
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-green-500 flex items-center justify-center">
              <AlignLeft className="w-3 h-3 text-white" />
            </div>
            <span className="text-sm font-semibold text-zinc-900 dark:text-white">
              Prompt View
            </span>
          </div>
          <p className="text-[11px] text-zinc-400 pl-7">
            View this use case&apos;s logic as a natural language prompt.
          </p>
        </button>
      </div>

      {/* Right side — flow steps */}
      <div className="p-5 space-y-3">
        {flowSteps.map((step, i) => (
          <div key={step.title} className="flex items-start gap-3">
            <div className="flex flex-col items-center pt-1">
              <div className="w-8 h-8 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 flex items-center justify-center">
                <step.icon className={`w-4 h-4 ${step.color}`} />
              </div>
              {i < flowSteps.length - 1 && (
                <div className="w-px h-6 bg-zinc-200 dark:bg-zinc-700 mt-1" />
              )}
            </div>

            <div className="flex-1 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30">
              <h5 className="text-sm font-semibold text-zinc-900 dark:text-white mb-1">
                {step.title}
              </h5>
              <p className="text-xs text-zinc-400 dark:text-zinc-500 leading-relaxed line-clamp-2">
                {step.preview}
              </p>
            </div>
          </div>
        ))}

        <div className="flex justify-end pt-2">
          <button className="flex items-center gap-1.5 text-xs font-semibold text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
            Explore the agent&apos;s knowledge base
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════ TAB: KNOWLEDGE BASE ═══════════════════════ */

function KnowledgeBaseTab() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] min-h-[400px]">
      <div className="p-5 border-r border-zinc-100 dark:border-zinc-800">
        <div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 mb-1">
          📄 Knowledge Base
        </div>
        <h4 className="text-lg font-bold text-zinc-900 dark:text-white mb-1">
          Customer Support
        </h4>
        <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed mb-5">
          This agent can answer questions using trusted internal documents or
          URLs.
        </p>

        <div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 mb-3">
          Upload Files
        </div>

        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2 p-2.5 rounded-lg border border-purple-200 dark:border-purple-700 bg-purple-50/50 dark:bg-purple-500/5">
            <FileText className="w-4 h-4 text-purple-500" />
            <span className="text-xs font-medium text-zinc-900 dark:text-white">
              Attached PDF
            </span>
          </div>
          <div className="p-2.5 rounded-lg border border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/20">
            <div className="h-3 w-24 bg-zinc-200/60 dark:bg-zinc-700/40 rounded" />
          </div>
          <div className="p-2.5 rounded-lg border border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/20">
            <div className="h-3 w-28 bg-zinc-200/60 dark:bg-zinc-700/40 rounded" />
          </div>
        </div>

        <button className="flex items-center gap-1.5 text-xs font-semibold text-green-600 dark:text-green-400 hover:underline">
          <Plus className="w-3 h-3" />
          Add Content
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      <div className="p-5">
        <div className="text-xs font-mono font-semibold text-purple-600 dark:text-purple-400 mb-4 uppercase tracking-wide">
          CUSTOMER_SUPPORT_FAQ.PDF
        </div>

        <div className="space-y-3 mb-8">
          {faqEntries.map((entry) => (
            <div
              key={entry.q}
              className="text-sm text-zinc-600 dark:text-zinc-400"
            >
              {entry.q} →{" "}
              <span className="text-zinc-500 dark:text-zinc-500">
                {entry.a}
              </span>
            </div>
          ))}
        </div>

        <div className="space-y-2 mt-auto">
          <button className="flex items-center gap-2 text-xs text-purple-600 dark:text-purple-400 hover:underline">
            <Upload className="w-3.5 h-3.5" /> Upload File
          </button>
          <button className="flex items-center gap-2 text-xs text-purple-600 dark:text-purple-400 hover:underline">
            <Globe className="w-3.5 h-3.5" /> Import from Website
          </button>
          <button className="flex items-center gap-2 text-xs text-purple-600 dark:text-purple-400 hover:underline">
            <Link2 className="w-3.5 h-3.5" /> Connect CRM
          </button>
          <span className="inline-block mt-1 text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 px-2 py-0.5 rounded-full">
            Only available in full platform
          </span>
        </div>

        <div className="flex justify-end pt-4">
          <button className="flex items-center gap-1.5 text-xs font-semibold text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
            See available actions
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════ TAB: ACTIONS ═══════════════════════ */

function ActionsTab() {
  return (
    <div className="flex flex-col h-full">
      {/* Content header */}
      <div className="px-5 pt-5 pb-3 border-b border-zinc-100 dark:border-zinc-800/60">
        <h3 className="text-[15px] font-semibold text-zinc-900 dark:text-white">
          Actions
        </h3>
        <p className="text-[11px] text-zinc-500 dark:text-zinc-500 mt-0.5">
          This agent can perform real-time actions as part of the conversation.
        </p>
      </div>

      {/* Action list */}
      <div className="flex-1">
        {actionsData.map((action) => (
          <div
            key={action.title}
            className="flex items-center gap-3 px-5 py-3 border-b border-zinc-50 dark:border-zinc-800/40 hover:bg-zinc-50 dark:hover:bg-zinc-900/60 transition-colors"
          >
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${action.color}`}
            >
              <action.icon className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-semibold text-zinc-900 dark:text-white">
                {action.title}
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-500 truncate">
                {action.description}
              </p>
            </div>
            <span className="text-[9px] font-semibold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-500/10 px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0">
              Enabled
            </span>
          </div>
        ))}

        {/* Custom actions promo */}
        <div className="p-5">
          <div className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-r from-purple-50 to-violet-50 dark:from-purple-500/5 dark:to-violet-500/5 border border-purple-100 dark:border-purple-500/10">
            <div className="flex items-center gap-0.5 shrink-0">
              {["⚡", "📊", "💬", "🔗", "📧"].map((emoji, i) => (
                <span
                  key={`emoji-${emoji}`}
                  className="w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center text-[10px]"
                >
                  {emoji}
                </span>
              ))}
              <span className="w-6 h-6 rounded-full bg-purple-200 dark:bg-purple-500/30 flex items-center justify-center text-[9px] font-bold text-purple-600 dark:text-purple-300">
                +13
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-[12px] font-semibold text-zinc-900 dark:text-white">Create Custom Action</h4>
              <p className="text-[10px] text-zinc-500 truncate">
                Build your own actions using APIs, CRMs, and business logic.
              </p>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-purple-400 shrink-0" />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════ TAB: TEST CALLS (LIVE SIM) ═══════════════════════ */

function TestCallsTab() {
  const [callState, setCallState] = useState<"idle" | "ringing" | "active" | "ended">("idle");
  const [transcriptIdx, setTranscriptIdx] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const transcriptRef = useRef<NodeJS.Timeout | null>(null);
  const ringingRef = useRef<NodeJS.Timeout | null>(null);
  const endingRef = useRef<NodeJS.Timeout | null>(null);

  // Deterministic delays per transcript index (avoids Math.random hydration mismatch)
  const transcriptDelays = [2700, 2500, 2900, 2600, 2800, 2400, 2700];

  const startCall = () => {
    setCallState("ringing");
    setTranscriptIdx(0);
    setElapsed(0);

    ringingRef.current = setTimeout(() => {
      setCallState("active");
      // Start timer
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
      // Start transcript progression
      let idx = 0;
      const advanceTranscript = () => {
        if (idx < callTranscript.length - 1) {
          idx++;
          setTranscriptIdx(idx);
          const delay = transcriptDelays[idx % transcriptDelays.length];
          transcriptRef.current = setTimeout(advanceTranscript, delay);
        } else {
          endingRef.current = setTimeout(() => {
            setCallState("ended");
            if (timerRef.current) clearInterval(timerRef.current);
          }, 2000);
        }
      };
      transcriptRef.current = setTimeout(advanceTranscript, 2500);
    }, 1500);
  };

  const clearAllTimers = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (transcriptRef.current) clearTimeout(transcriptRef.current);
    if (ringingRef.current) clearTimeout(ringingRef.current);
    if (endingRef.current) clearTimeout(endingRef.current);
  };

  const endCall = () => {
    setCallState("ended");
    clearAllTimers();
  };

  const resetCall = () => {
    setCallState("idle");
    setTranscriptIdx(0);
    setElapsed(0);
  };

  useEffect(() => {
    return clearAllTimers;
  }, []);

  const formatTime = (s: number) =>
    `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  if (callState === "idle") {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[380px]">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center mb-5 shadow-lg shadow-purple-500/20">
          <Phone className="w-7 h-7 text-white" />
        </div>
        <h3 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">
          Test Your Agent Live
        </h3>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 text-center max-w-md mb-6">
          Make a simulated call to test how your Voice AI agent performs. Watch the live transcript unfold in real time.
        </p>

        <div className="flex items-center gap-3 mb-6">
          {["Lead Qualification", "Customer Support", "Appointment"].map(
            (label) => (
              <span
                key={label}
                className="text-[11px] font-medium text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-500/10 px-3 py-1 rounded-full"
              >
                {label}
              </span>
            )
          )}
        </div>

        <button
          onClick={startCall}
          className="flex items-center gap-2 px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-lg shadow-purple-500/20"
        >
          <Phone className="w-4 h-4" />
          Start Test Call
        </button>

        <div className="flex items-center gap-2 mt-4">
          <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
          <span className="text-xs text-zinc-400">
            No phone number required · Browser-based
          </span>
        </div>
      </div>
    );
  }

  if (callState === "ringing") {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[380px]">
        <motion.div
          animate={{ scale: [1, 1.15, 1] }}
          transition={{ repeat: Infinity, duration: 1.2 }}
          className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mb-5"
        >
          <div className="w-14 h-14 rounded-full bg-green-500 flex items-center justify-center shadow-lg shadow-green-500/30">
            <Phone className="w-6 h-6 text-white" />
          </div>
        </motion.div>
        <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-1">
          Connecting...
        </h3>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Dialing Gourmet Table AI Agent
        </p>
        <div className="flex items-center gap-1 mt-3">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ repeat: Infinity, duration: 1, delay: i * 0.3 }}
              className="w-2 h-2 rounded-full bg-green-500"
            />
          ))}
        </div>
      </div>
    );
  }

  if (callState === "ended") {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[380px]">
        <div className="w-16 h-16 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-5">
          <PhoneOff className="w-7 h-7 text-zinc-400" />
        </div>
        <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-1">
          Call Ended
        </h3>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">
          Duration: {formatTime(elapsed)}
        </p>
        <div className="grid grid-cols-3 gap-4 my-4">
          <div className="text-center p-3 rounded-xl bg-green-50 dark:bg-green-500/5 border border-green-100 dark:border-green-500/10">
            <div className="text-lg font-bold text-green-600">98%</div>
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Accuracy</div>
          </div>
          <div className="text-center p-3 rounded-xl bg-blue-50 dark:bg-blue-500/5 border border-blue-100 dark:border-blue-500/10">
            <div className="text-lg font-bold text-blue-600">0.2s</div>
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Latency</div>
          </div>
          <div className="text-center p-3 rounded-xl bg-purple-50 dark:bg-purple-500/5 border border-purple-100 dark:border-purple-500/10">
            <div className="text-lg font-bold text-purple-600">A+</div>
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Sentiment</div>
          </div>
        </div>
        <button
          onClick={resetCall}
          className="flex items-center gap-2 px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-xl transition-colors mt-2"
        >
          Try Again
        </button>
      </div>
    );
  }

  // Active call
  return (
    <div className="grid grid-cols-1 md:grid-cols-[1fr_240px] min-h-[380px]">
      {/* Transcript area */}
      <div className="p-5 border-r border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xs font-semibold text-red-500 uppercase tracking-wider">REC</span>
            <span className="text-xs text-zinc-400">{formatTime(elapsed)}</span>
          </div>
          <div className="flex items-center gap-2">
            <WaveformBars />
            <Volume2 className="w-4 h-4 text-zinc-400" />
          </div>
        </div>

        <div className="space-y-3 max-h-[300px] overflow-y-auto">
          {callTranscript.slice(0, transcriptIdx + 1).map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: msg.speaker === "agent" ? -10 : 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
              className={`flex ${msg.speaker === "caller" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                  msg.speaker === "agent"
                    ? "bg-purple-50 dark:bg-purple-500/10 text-zinc-800 dark:text-zinc-200 rounded-bl-md"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 rounded-br-md"
                }`}
              >
                <div className="text-[10px] font-semibold text-zinc-400 mb-0.5 uppercase">
                  {msg.speaker === "agent" ? "🤖 Laura (AI)" : "👤 Caller"}
                </div>
                {msg.text}
              </div>
            </motion.div>
          ))}

          {/* Typing indicator */}
          {transcriptIdx < callTranscript.length - 1 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex justify-start"
            >
              <div className="px-4 py-3 rounded-2xl bg-purple-50 dark:bg-purple-500/10 rounded-bl-md">
                <div className="flex items-center gap-1">
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      animate={{ y: [0, -4, 0] }}
                      transition={{ repeat: Infinity, duration: 0.6, delay: i * 0.15 }}
                      className="w-1.5 h-1.5 rounded-full bg-purple-400"
                    />
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Right panel — call info */}
      <div className="p-4 flex flex-col">
        <div className="text-center mb-4">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center mx-auto mb-2 shadow-lg shadow-purple-500/20">
            <Headphones className="w-5 h-5 text-white" />
          </div>
          <h4 className="text-sm font-bold text-zinc-900 dark:text-white">Laura</h4>
          <p className="text-[10px] text-zinc-500">Gourmet Table Agent</p>
        </div>

        <div className="space-y-2 text-xs flex-1">
          <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/50">
            <span className="text-zinc-500">Status</span>
            <span className="text-green-500 font-semibold">Active</span>
          </div>
          <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/50">
            <span className="text-zinc-500">Duration</span>
            <span className="font-mono text-zinc-700 dark:text-zinc-300">{formatTime(elapsed)}</span>
          </div>
          <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/50">
            <span className="text-zinc-500">Sentiment</span>
            <span className="text-green-500 font-semibold">Positive 😊</span>
          </div>
          <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/50">
            <span className="text-zinc-500">Language</span>
            <span className="text-zinc-700 dark:text-zinc-300">English</span>
          </div>
          <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/50">
            <span className="text-zinc-500">Latency</span>
            <span className="text-zinc-700 dark:text-zinc-300">187ms</span>
          </div>
        </div>

        <button
          onClick={endCall}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold rounded-xl transition-colors mt-3"
        >
          <PhoneOff className="w-4 h-4" />
          End Call
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────── WAVEFORM BARS ─────────────────────── */

function WaveformBars() {
  return (
    <div className="flex items-center gap-[2px] h-4">
      {[3, 5, 2, 6, 4, 3, 5, 2, 4, 3].map((h, i) => (
        <motion.div
          key={i}
          animate={{ scaleY: [0.3, 1, 0.3] }}
          transition={{
            repeat: Infinity,
            duration: 0.6 + (i * 0.07),
            delay: i * 0.08,
          }}
          className="w-[2px] bg-purple-500 rounded-full origin-bottom"
          style={{ height: `${h * 2.5}px` }}
        />
      ))}
    </div>
  );
}
