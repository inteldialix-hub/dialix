"use client";

import { useState, useEffect } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Reveal, Stagger, MotionItem } from "@/components/motion";
import { HoverBorderGradient } from "@/components/ui/hover-border-gradient";
import * as Accordion from "@radix-ui/react-accordion";
import {
  Check,
  X,
  ArrowRight,
  Sparkles,
  ChevronDown,
  Zap,
  Shield,
  Phone,
  BarChart3,
  Webhook,
  Mic,
  Headphones,
  Code2,
  Puzzle,
  FileCheck,
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

interface PricingPlan {
  id: number;
  name: string;
  slug: string;
  price: number;
  billing_period: string;
  max_agents: number;
  max_calls_per_month: number;
  max_phone_numbers: number;
  features: Record<string, boolean>;
  is_default: number;
  sort_order: number;
}

const FEATURE_META: Record<string, { label: string; icon: React.ReactNode }> = {
  dashboard: { label: "Dashboard Access", icon: <BarChart3 className="w-4 h-4" /> },
  basic_analytics: { label: "Basic Analytics", icon: <BarChart3 className="w-4 h-4" /> },
  advanced_analytics: { label: "Advanced Analytics", icon: <BarChart3 className="w-4 h-4" /> },
  webhooks: { label: "Webhooks & Automations", icon: <Webhook className="w-4 h-4" /> },
  call_recording: { label: "Call Recording", icon: <Mic className="w-4 h-4" /> },
  priority_support: { label: "Priority Support", icon: <Headphones className="w-4 h-4" /> },
  api_access: { label: "Full API Access", icon: <Code2 className="w-4 h-4" /> },
  custom_integrations: { label: "Custom Integrations", icon: <Puzzle className="w-4 h-4" /> },
  sla: { label: "SLA Guarantee", icon: <FileCheck className="w-4 h-4" /> },
};

const ALL_FEATURE_KEYS = Object.keys(FEATURE_META);

const faqs = [
  {
    q: "Can I change my plan later?",
    a: "Absolutely. You can upgrade or downgrade your plan at any time from your dashboard. Changes take effect immediately, and billing is prorated.",
  },
  {
    q: "What happens if I exceed my plan limits?",
    a: "We'll notify you when you're approaching your limits. You can upgrade anytime, or we can discuss custom overages for your use case.",
  },
  {
    q: "Is there a free trial?",
    a: "Yes! The Starter plan is free forever with 1 agent and 100 calls/month. No credit card required to get started.",
  },
  {
    q: "What payment methods do you accept?",
    a: "We accept all major credit cards (Visa, Mastercard, Amex), as well as bank transfers and invoicing for Enterprise customers.",
  },
  {
    q: "Do you offer annual billing discounts?",
    a: "Yes. Annual plans receive a 20% discount compared to monthly billing. Contact us for custom enterprise agreements.",
  },
  {
    q: "Can I get a custom plan for my team?",
    a: "Of course. Enterprise plans are fully customizable — unlimited agents, custom SLAs, dedicated support, and tailored integrations. Talk to our team.",
  },
];

function formatLimit(val: number): string {
  if (val === -1) return "Unlimited";
  return val.toLocaleString();
}

export default function PricingPageClient() {
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/api/pricing/plans`)
      .then((r) => r.json())
      .then((d) => setPlans(d.plans || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const getAnnualPrice = (price: number) => Math.round(price * 0.8);

  const getDisplayPrice = (plan: PricingPlan) => {
    if (plan.price === 0) return 0;
    return billing === "annual" ? getAnnualPrice(plan.price) : plan.price;
  };

  const isPopular = (plan: PricingPlan) => plan.slug === "professional" || plan.slug === "business";

  return (
    <>
      <Header />

      {/* Hero */}
      <section className="relative pt-32 pb-16 lg:pt-40 lg:pb-20 overflow-hidden">
        {/* Background gradient orbs */}
        <div className="absolute top-0 left-1/4 w-[600px] h-[400px] bg-purple-600/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[300px] bg-violet-500/8 rounded-full blur-[100px] pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="text-center">
            <Reveal>
              <span className="eyebrow-badge mb-6 inline-flex items-center gap-1.5">
                <Sparkles className="w-3 h-3" />
                Simple Pricing
              </span>
            </Reveal>
            <Reveal delay={0.1}>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-zinc-900 dark:text-white tracking-tight mb-5">
                Plans that scale with{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-500 via-violet-500 to-purple-600">
                  your business
                </span>
              </h1>
            </Reveal>
            <Reveal delay={0.2}>
              <p className="text-lg text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto leading-relaxed mb-10">
                Start free. Upgrade when you need more agents, calls, or advanced features.
                No hidden fees. No surprises.
              </p>
            </Reveal>

            {/* Billing toggle */}
            <Reveal delay={0.3}>
              <div className="inline-flex items-center gap-3 rounded-full bg-zinc-100 dark:bg-zinc-800/80 p-1.5 border border-zinc-200 dark:border-zinc-700/60">
                <button
                  onClick={() => setBilling("monthly")}
                  className={`px-5 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                    billing === "monthly"
                      ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm"
                      : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
                  }`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setBilling("annual")}
                  className={`px-5 py-2 rounded-full text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
                    billing === "annual"
                      ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm"
                      : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
                  }`}
                >
                  Annual
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/50">
                    Save 20%
                  </span>
                </button>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="pb-24 lg:pb-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {loading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="card-bezel animate-pulse">
                  <div className="card-bezel-inner p-8 h-[480px]" />
                </div>
              ))}
            </div>
          ) : (
            <Stagger className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 items-start">
              {plans.map((plan) => {
                const popular = isPopular(plan);
                return (
                  <MotionItem key={plan.id}>
                    <div
                      className={`relative rounded-[1.5rem] p-[1px] ${
                        popular
                          ? "bg-gradient-to-b from-purple-500 via-violet-500 to-purple-700 shadow-xl shadow-purple-500/20"
                          : "card-bezel"
                      }`}
                    >
                      {/* Popular badge */}
                      {popular && (
                        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-10">
                          <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-purple-600 text-white shadow-lg shadow-purple-500/30">
                            <Zap className="w-3 h-3" />
                            Most Popular
                          </span>
                        </div>
                      )}

                      <div
                        className={`rounded-[calc(1.5rem-1px)] p-8 h-full ${
                          popular
                            ? "bg-zinc-900 dark:bg-zinc-900"
                            : "card-bezel-inner"
                        }`}
                      >
                        {/* Plan name */}
                        <div className="mb-6">
                          <h3
                            className={`text-lg font-semibold mb-1 ${
                              popular ? "text-white" : "text-zinc-900 dark:text-white"
                            }`}
                          >
                            {plan.name}
                          </h3>
                          {plan.is_default === 1 && (
                            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/50">
                              Free Forever
                            </span>
                          )}
                        </div>

                        {/* Price */}
                        <div className="mb-6">
                          <div className="flex items-baseline gap-1">
                            <span
                              className={`text-4xl font-bold tracking-tight ${
                                popular ? "text-white" : "text-zinc-900 dark:text-white"
                              }`}
                            >
                              ${getDisplayPrice(plan)}
                            </span>
                            <span
                              className={`text-sm ${
                                popular ? "text-zinc-400" : "text-zinc-500 dark:text-zinc-400"
                              }`}
                            >
                              /mo
                            </span>
                          </div>
                          {billing === "annual" && plan.price > 0 && (
                            <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-1">
                              <span className="line-through">${plan.price}/mo</span>{" "}
                              billed annually
                            </p>
                          )}
                        </div>

                        {/* Limits */}
                        <div
                          className={`space-y-2.5 mb-6 pb-6 border-b ${
                            popular
                              ? "border-zinc-700/60"
                              : "border-zinc-200 dark:border-zinc-800"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <Phone
                              className={`w-4 h-4 ${
                                popular
                                  ? "text-purple-400"
                                  : "text-purple-500 dark:text-purple-400"
                              }`}
                            />
                            <span
                              className={`text-sm ${
                                popular ? "text-zinc-300" : "text-zinc-600 dark:text-zinc-300"
                              }`}
                            >
                              <strong>{formatLimit(plan.max_agents)}</strong> agent
                              {plan.max_agents !== 1 ? "s" : ""}
                            </span>
                          </div>
                          <div className="flex items-center gap-2.5">
                            <BarChart3
                              className={`w-4 h-4 ${
                                popular
                                  ? "text-purple-400"
                                  : "text-purple-500 dark:text-purple-400"
                              }`}
                            />
                            <span
                              className={`text-sm ${
                                popular ? "text-zinc-300" : "text-zinc-600 dark:text-zinc-300"
                              }`}
                            >
                              <strong>{formatLimit(plan.max_calls_per_month)}</strong> calls/mo
                            </span>
                          </div>
                          <div className="flex items-center gap-2.5">
                            <Shield
                              className={`w-4 h-4 ${
                                popular
                                  ? "text-purple-400"
                                  : "text-purple-500 dark:text-purple-400"
                              }`}
                            />
                            <span
                              className={`text-sm ${
                                popular ? "text-zinc-300" : "text-zinc-600 dark:text-zinc-300"
                              }`}
                            >
                              <strong>{formatLimit(plan.max_phone_numbers)}</strong> phone number
                              {plan.max_phone_numbers !== 1 ? "s" : ""}
                            </span>
                          </div>
                        </div>

                        {/* Features */}
                        <ul className="space-y-2.5 mb-8">
                          {ALL_FEATURE_KEYS.map((key) => {
                            const has = plan.features[key];
                            const meta = FEATURE_META[key];
                            return (
                              <li
                                key={key}
                                className={`flex items-center gap-2.5 text-sm ${
                                  has
                                    ? popular
                                      ? "text-zinc-200"
                                      : "text-zinc-700 dark:text-zinc-300"
                                    : "text-zinc-300 dark:text-zinc-600 line-through"
                                }`}
                              >
                                {has ? (
                                  <Check
                                    className={`w-4 h-4 shrink-0 ${
                                      popular
                                        ? "text-emerald-400"
                                        : "text-emerald-500 dark:text-emerald-400"
                                    }`}
                                  />
                                ) : (
                                  <X className="w-4 h-4 shrink-0 text-zinc-300 dark:text-zinc-600" />
                                )}
                                {meta.label}
                              </li>
                            );
                          })}
                        </ul>

                        {/* CTA */}
                        {popular ? (
                          <a href="/signup">
                            <HoverBorderGradient
                              containerClassName="w-full rounded-xl"
                              className="flex items-center justify-center gap-2 text-sm font-semibold w-full py-3 bg-purple-600 text-white"
                              duration={2}
                            >
                              Get Started
                              <ArrowRight className="w-4 h-4" />
                            </HoverBorderGradient>
                          </a>
                        ) : plan.slug === "enterprise" ? (
                          <a
                            href="mailto:contact@dialix.ai"
                            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                          >
                            Contact Sales
                            <ArrowRight className="w-4 h-4" />
                          </a>
                        ) : (
                          <a
                            href="/signup"
                            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                          >
                            {plan.price === 0 ? "Start Free" : "Get Started"}
                            <ArrowRight className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    </div>
                  </MotionItem>
                );
              })}
            </Stagger>
          )}
        </div>
      </section>

      {/* Feature Comparison Table */}
      <section className="section-pad section-alt">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <Reveal>
              <span className="eyebrow-badge mb-6 inline-flex">Compare Plans</span>
            </Reveal>
            <Reveal delay={0.1}>
              <h2 className="text-3xl lg:text-4xl font-bold text-zinc-900 dark:text-white tracking-tight mb-4">
                Everything included at a glance
              </h2>
            </Reveal>
          </div>

          <Reveal delay={0.2}>
            <div className="overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800">
                    <th className="text-left py-4 px-6 font-semibold text-zinc-500 dark:text-zinc-400 w-[220px]">
                      Feature
                    </th>
                    {plans.map((p) => (
                      <th
                        key={p.id}
                        className="text-center py-4 px-4 font-semibold text-zinc-900 dark:text-white"
                      >
                        {p.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                  <tr>
                    <td className="py-3 px-6 text-zinc-600 dark:text-zinc-400">Agents</td>
                    {plans.map((p) => (
                      <td key={p.id} className="py-3 px-4 text-center font-medium text-zinc-900 dark:text-white">
                        {formatLimit(p.max_agents)}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-3 px-6 text-zinc-600 dark:text-zinc-400">Calls / month</td>
                    {plans.map((p) => (
                      <td key={p.id} className="py-3 px-4 text-center font-medium text-zinc-900 dark:text-white">
                        {formatLimit(p.max_calls_per_month)}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-3 px-6 text-zinc-600 dark:text-zinc-400">Phone Numbers</td>
                    {plans.map((p) => (
                      <td key={p.id} className="py-3 px-4 text-center font-medium text-zinc-900 dark:text-white">
                        {formatLimit(p.max_phone_numbers)}
                      </td>
                    ))}
                  </tr>
                  {ALL_FEATURE_KEYS.map((key) => (
                    <tr key={key}>
                      <td className="py-3 px-6 text-zinc-600 dark:text-zinc-400">
                        {FEATURE_META[key].label}
                      </td>
                      {plans.map((p) => (
                        <td key={p.id} className="py-3 px-4 text-center">
                          {p.features[key] ? (
                            <Check className="w-4 h-4 text-emerald-500 dark:text-emerald-400 mx-auto" />
                          ) : (
                            <X className="w-4 h-4 text-zinc-300 dark:text-zinc-600 mx-auto" />
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Reveal>
        </div>
      </section>

      {/* FAQ */}
      <section className="section-pad">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-[1fr_1.5fr] gap-12 lg:gap-20">
            <Reveal>
              <div className="lg:sticky lg:top-32 lg:self-start">
                <span className="eyebrow-badge mb-6 inline-flex">FAQ</span>
                <h2 className="text-4xl lg:text-5xl font-bold text-zinc-900 dark:text-white tracking-tight leading-[1.1] mt-4 mb-4">
                  Pricing Questions
                </h2>
                <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  Everything you need to know about our plans, billing, and upgrades.
                </p>
              </div>
            </Reveal>

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

      {/* CTA */}
      <section className="py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="relative rounded-3xl overflow-hidden cta-gradient py-16 lg:py-20 px-8 lg:px-16 text-center">
              <div className="absolute inset-0 opacity-10">
                <div
                  className="absolute inset-0"
                  style={{
                    backgroundImage:
                      "radial-gradient(circle, rgba(255,255,255,0.2) 1px, transparent 1px)",
                    backgroundSize: "28px 28px",
                  }}
                />
              </div>
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[200px] bg-white/10 rounded-full blur-3xl pointer-events-none" />

              <div className="relative">
                <h2 className="text-3xl lg:text-5xl font-bold text-white tracking-tight mb-4">
                  Ready to get started?
                </h2>
                <p className="text-white/70 max-w-lg mx-auto leading-relaxed mb-8">
                  Deploy your first AI voice agent in minutes. Start with the free plan — no credit card required.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-4">
                  <a href="/signup">
                    <HoverBorderGradient
                      containerClassName="rounded-full bg-white/10 border-white/20 hover:bg-white/20"
                      className="flex items-center gap-2 text-sm font-semibold px-8 py-3 bg-white text-purple-700"
                      duration={1.5}
                    >
                      <span>Start Free Trial</span>
                      <ArrowRight className="w-4 h-4" />
                    </HoverBorderGradient>
                  </a>
                  <a
                    href="mailto:contact@dialix.ai"
                    className="btn-pill bg-white/10 text-white font-medium px-8 py-3.5 hover:bg-white/20 border border-white/20 transition-colors"
                  >
                    Talk to Sales
                  </a>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <Footer />
    </>
  );
}
