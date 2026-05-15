"use client";

import { Reveal, Stagger, MotionItem } from "@/components/motion";
import { Clock, Shield, Server, Heart, Brain } from "lucide-react";

const complianceBadges = ["SOC 2", "HIPAA", "PCI DSS", "GDPR"];

export default function EnterpriseBenefits() {
  return (
    <section className="section-pad bg-purple-50/40 dark:bg-zinc-900/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <Reveal>
            <span className="eyebrow-badge mb-6 inline-flex">
              Enterprise Benefits
            </span>
          </Reveal>
          <Reveal delay={0.1}>
            <h2 className="text-4xl lg:text-5xl font-bold text-zinc-900 dark:text-white tracking-tight mb-4">
              Why Leading Teams Choose Dialix
            </h2>
          </Reveal>
          <Reveal delay={0.2}>
            <p className="text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto leading-relaxed">
              Enterprises choose Dialix to deploy Voice AI with speed,
              precision, and trust. Our forward-deployed engineers, in-house
              telephony, and global compliance framework deliver reliability
              from first call to full scale.
            </p>
          </Reveal>
        </div>

        {/* Bento grid */}
        <Stagger className="grid md:grid-cols-2 gap-5">
          {/* Card 1 - ROI */}
          <MotionItem>
            <div className="card-bezel h-full">
              <div className="card-bezel-inner p-6 lg:p-8 h-full">
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center shrink-0">
                    <Clock className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-1">
                      From Idea to ROI in Weeks
                    </h3>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                      Forward-Deployed Engineers launch agents in weeks, not
                      months — taking Voice AI from pilot to production fast,
                      with measurable ROI in the first 60 days.
                    </p>
                  </div>
                </div>

                {/* Mini chart */}
                <div className="mt-6 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl p-4">
                  <div className="flex items-end gap-1.5 h-16">
                    {[20, 35, 45, 55, 70, 85, 95].map((height, i) => (
                      <div
                        key={i}
                        className="flex-1 bg-purple-300/60 dark:bg-purple-600/40 rounded-t-sm hover:bg-purple-400 dark:hover:bg-purple-500/60 transition-colors cursor-pointer"
                        style={{ height: `${height}%` }}
                      />
                    ))}
                  </div>
                  <div className="flex justify-between mt-2 text-[10px] font-mono text-zinc-400">
                    <span>Week 1</span>
                    <span>Week 8</span>
                  </div>
                </div>
              </div>
            </div>
          </MotionItem>

          {/* Card 2 - Security */}
          <MotionItem>
            <div className="card-bezel h-full">
              <div className="card-bezel-inner p-6 lg:p-8 h-full">
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center shrink-0">
                    <Shield className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-1">
                      Certified Security & Compliance
                    </h3>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                      Infrastructure certified across SOC 2, HIPAA, PCI DSS,
                      and GDPR — with full encryption, audit logs, and
                      region-based hosting built into every release.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2.5 mt-6">
                  {complianceBadges.map((badge) => (
                    <div
                      key={badge}
                      className="flex items-center gap-2 px-4 py-2.5 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-200 dark:border-zinc-700"
                    >
                      <Shield className="w-3.5 h-3.5 text-purple-500" />
                      <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 tracking-wide">
                        {badge}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </MotionItem>

          {/* Card 3 - Reliability */}
          <MotionItem>
            <div className="card-bezel h-full">
              <div className="card-bezel-inner p-6 h-full">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center shrink-0">
                    <Server className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-1">
                      Enterprise Reliability
                    </h3>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                      Multi-cloud redundancy, instant failover, and
                      round-the-clock monitoring — keeping every call connected
                      and every customer heard.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </MotionItem>

          {/* Card 4 - CX */}
          <MotionItem>
            <div className="card-bezel h-full">
              <div className="card-bezel-inner p-6 h-full">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center shrink-0">
                    <Heart className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-1">
                      Designed for Exceptional CX
                    </h3>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                      Every interaction personal and human. Customers want
                      resolution — we deliver it from start to finish.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </MotionItem>

          {/* Card 5 - Full width */}
          <MotionItem className="md:col-span-2">
            <div className="card-bezel">
              <div className="card-bezel-inner p-6 lg:p-8">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center shrink-0">
                    <Brain className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-1">
                      Guardrailed AI Responses
                    </h3>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-2xl">
                      Dialix agents follow defined logic and approved
                      knowledge sources — ensuring compliant, brand-safe replies
                      and zero off-script or hallucinated responses.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </MotionItem>
        </Stagger>
      </div>
    </section>
  );
}
