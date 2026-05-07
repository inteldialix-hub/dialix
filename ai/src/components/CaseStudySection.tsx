"use client";

import { useState } from "react";
import { Reveal, motion } from "@/components/motion";
import { AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  MapPin,
  Building2,
  Users,
  Star,
} from "lucide-react";

const caseStudies = [
  {
    company: "Freshworks",
    badges: ["Smart IVR", "Ticket Creation", "User Verification"],
    description:
      "Through a strategic partnership, Freshworks and Dialix now offer real-time Voice AI inside Freshcaller, Freshdesk, and Freshservice, allowing businesses to automate up to 65% of routine voice requests — from routing and verification to FAQs and after-hours ticket creation.",
    stats: [
      { value: "65%", label: "Routine Calls Automated" },
      { value: "75%", label: "Reduction in Wait Times" },
      { value: "2×", label: "Increased Response Rate" },
      { value: "60%", label: "Less Agent Workload" },
    ],
    location: "Global",
    industry: "SaaS & Telecom",
    size: "5K-10K",
  },
  {
    company: "Medbelle",
    badges: ["Appointment Booking", "Patient Routing", "Follow-ups"],
    description:
      "Medbelle integrated Dialix to automate appointment scheduling and patient follow-ups, achieving a 60% boost in scheduling efficiency while maintaining HIPAA-compliant operations across all patient interactions.",
    stats: [
      { value: "+60%", label: "Scheduling Efficiency" },
      { value: "24/7", label: "Patient Availability" },
      { value: "40%", label: "Reduced No-Shows" },
      { value: "95%", label: "Patient Satisfaction" },
    ],
    location: "Europe",
    industry: "Healthcare",
    size: "500-1K",
  },
  {
    company: "TechFlow",
    badges: ["Lead Qualification", "Demo Scheduling", "Onboarding"],
    description:
      "TechFlow deployed Dialix AI agents to handle inbound sales inquiries, qualifying leads and booking demos automatically. This freed their sales team to focus on high-value conversations and closing deals.",
    stats: [
      { value: "3×", label: "More Demos Booked" },
      { value: "50%", label: "Faster Lead Response" },
      { value: "80%", label: "Qualification Accuracy" },
      { value: "35%", label: "Revenue Increase" },
    ],
    location: "North America",
    industry: "Software",
    size: "200-500",
  },
];

export default function CaseStudySection() {
  const [current, setCurrent] = useState(0);

  const next = () =>
    setCurrent((prev) => (prev + 1) % caseStudies.length);
  const prev = () =>
    setCurrent(
      (prev) => (prev - 1 + caseStudies.length) % caseStudies.length
    );

  const study = caseStudies[current];

  return (
    <section id="case-studies" className="section-pad">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-6">
          <Reveal>
            <span className="eyebrow-badge mb-6 inline-flex">
              Success Stories
            </span>
          </Reveal>
          <Reveal delay={0.05}>
            <h2 className="text-4xl lg:text-5xl font-bold text-zinc-900 dark:text-white tracking-tight mb-4">
              Real Results, Real Impact
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="text-zinc-600 dark:text-zinc-400 max-w-xl mx-auto leading-relaxed">
              Unlock measurable impact with AI voice agents. Dialix helps you
              save time, reduce costs, and improve customer experience — without
              trade-offs.
            </p>
          </Reveal>
        </div>

        {/* G2 badges row */}
        <Reveal>
          <div className="flex items-center justify-center gap-4 mb-12">
            {["Leader", "Momentum", "Best Results", "Easiest Setup"].map(
              (badge) => (
                <div
                  key={badge}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-50 dark:bg-orange-950/30 border border-orange-200/60 dark:border-orange-800/30"
                >
                  <Star className="w-3 h-3 text-orange-500 fill-orange-500" />
                  <span className="text-[10px] font-semibold text-orange-700 dark:text-orange-400 uppercase tracking-wider">
                    {badge}
                  </span>
                </div>
              )
            )}
          </div>
        </Reveal>

        {/* Carousel */}
        <Reveal>
          <div className="relative">
            {/* Nav arrows */}
            <button
              onClick={prev}
              aria-label="Previous case study"
              className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-10 w-10 h-10 rounded-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shadow-md flex items-center justify-center hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={next}
              aria-label="Next case study"
              className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10 w-10 h-10 rounded-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shadow-md flex items-center justify-center hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            {/* Card */}
            <div className="card-bezel overflow-hidden">
              <div className="card-bezel-inner overflow-hidden">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={current}
                    initial={{ opacity: 0, x: 60 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -60 }}
                    transition={{
                      duration: 0.5,
                      ease: [0.32, 0.72, 0, 1],
                    }}
                    className="grid lg:grid-cols-2"
                  >
                    {/* Text side */}
                    <div className="p-8 lg:p-10">
                      {/* Badges */}
                      <div className="flex flex-wrap gap-2 mb-6">
                        {study.badges.map((badge) => (
                          <span
                            key={badge}
                            className="text-[10px] font-semibold uppercase tracking-wider px-3 py-1 rounded-full border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400"
                          >
                            {badge}
                          </span>
                        ))}
                      </div>

                      <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed mb-8">
                        {study.description}
                      </p>

                      {/* Stats */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                        {study.stats.map((stat) => (
                          <div key={stat.label}>
                            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400 mb-1">
                              {stat.value}
                            </div>
                            <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-500">
                              {stat.label}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Image side */}
                    <div className="relative bg-gradient-to-br from-purple-100 to-violet-100 dark:from-purple-900/30 dark:to-violet-900/20 min-h-[300px] lg:min-h-0 flex items-center justify-center">
                      {/* Company logo placeholder */}
                      <div className="text-center">
                        <div className="w-24 h-24 mx-auto rounded-2xl bg-white dark:bg-zinc-800 shadow-lg flex items-center justify-center mb-4">
                          <span className="text-2xl font-bold text-zinc-700 dark:text-zinc-300">
                            {study.company.slice(0, 2)}
                          </span>
                        </div>
                        <span className="text-lg font-bold text-zinc-700 dark:text-zinc-300">
                          {study.company}
                        </span>
                      </div>

                      {/* Metadata bar */}
                      <div className="absolute bottom-0 left-0 right-0 glass-effect border-t border-white/30 dark:border-zinc-700/40 px-6 py-3 flex items-center gap-6">
                        <div className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">
                          <MapPin className="w-3 h-3" />
                          {study.location}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">
                          <Building2 className="w-3 h-3" />
                          {study.industry}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">
                          <Users className="w-3 h-3" />
                          {study.size}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>

            {/* Dot indicators */}
            <div className="flex items-center justify-center gap-2 mt-6">
              {caseStudies.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrent(idx)}
                  aria-label={`Go to case study ${idx + 1}: ${caseStudies[idx].company}`}
                  aria-current={idx === current ? "true" : undefined}
                  className={`w-2 h-2 rounded-full transition-all duration-300 ${
                    idx === current
                      ? "w-6 bg-purple-600 dark:bg-purple-400"
                      : "bg-zinc-300 dark:bg-zinc-600 hover:bg-zinc-400"
                  }`}
                />
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
