"use client";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { motion } from "framer-motion";
import {
  Briefcase,
  MapPin,
  Code2,
  Palette,
  Megaphone,
  Users,
  Heart,
  Zap,
  Globe,
  Coffee,
} from "lucide-react";

const openPositions = [
  {
    title: "Senior Full-Stack Engineer",
    team: "Engineering",
    location: "Remote (EU/UK)",
    type: "Full-time",
    icon: Code2,
    description:
      "Build and scale the Dialix platform — from the React/Next.js dashboard to the Node.js/Express API that orchestrates real-time voice conversations.",
  },
  {
    title: "AI/ML Engineer — Voice",
    team: "Engineering",
    location: "Remote",
    type: "Full-time",
    icon: Zap,
    description:
      "Optimize our voice AI pipeline: latency reduction, TTS model selection, prompt engineering, and real-time conversation quality analysis.",
  },
  {
    title: "Product Designer",
    team: "Design",
    location: "Remote (UK preferred)",
    type: "Full-time",
    icon: Palette,
    description:
      "Design beautiful, functional interfaces for our Dashboard, Agent Builder, and Analytics tools. Work closely with engineering on design systems.",
  },
  {
    title: "Developer Advocate",
    team: "Go-to-Market",
    location: "Remote",
    type: "Full-time",
    icon: Megaphone,
    description:
      "Create tutorials, documentation, and demo applications. Help developers integrate Dialix via our API and webhooks. Represent us at conferences.",
  },
  {
    title: "Customer Success Manager",
    team: "Operations",
    location: "London, UK",
    type: "Full-time",
    icon: Users,
    description:
      "Onboard enterprise clients, help them deploy voice agents, and ensure they get maximum value from the platform.",
  },
];

const perks = [
  { icon: Globe, title: "Remote First", description: "Work from anywhere in the world" },
  { icon: Heart, title: "Health & Wellness", description: "Comprehensive health coverage" },
  { icon: Coffee, title: "Learning Budget", description: "£1,500/year for courses & conferences" },
  { icon: Zap, title: "Latest Tools", description: "Top-tier hardware and software" },
];

export default function CareersPageClient() {
  return (
    <>
      <Header />
      <main className="min-h-screen">
        {/* Hero */}
        <section className="relative overflow-hidden hero-gradient">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="max-w-2xl mx-auto text-center"
            >
              <span className="eyebrow-badge mb-6 inline-flex">CAREERS</span>
              <h1 className="text-4xl md:text-5xl font-bold text-zinc-900 dark:text-white mb-4">
                Build the Future of
                <br />
                <span className="text-gradient">Voice AI</span>
              </h1>
              <p className="text-lg text-zinc-600 dark:text-zinc-400">
                We&apos;re a small team solving a massive problem — making
                enterprise phone operations intelligent, automated, and
                delightful.
              </p>
            </motion.div>
          </div>
          <div className="absolute inset-0 dot-grid opacity-40 pointer-events-none" />
        </section>

        {/* Perks */}
        <section className="section-pad-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {perks.map((perk, i) => (
                <motion.div
                  key={perk.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08, duration: 0.5 }}
                  className="card-bezel"
                >
                  <div className="card-bezel-inner p-6 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center mx-auto mb-3">
                      <perk.icon className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-white mb-1">
                      {perk.title}
                    </h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {perk.description}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Open Positions */}
        <section className="section-pad">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <span className="eyebrow-badge mb-4 inline-flex">
                OPEN POSITIONS
              </span>
              <h2 className="text-3xl md:text-4xl font-bold text-zinc-900 dark:text-white">
                Join Our Team
              </h2>
            </div>

            <div className="space-y-4">
              {openPositions.map((position, i) => (
                <motion.div
                  key={position.title}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08, duration: 0.5 }}
                  className="card-bezel group cursor-pointer"
                >
                  <div className="card-bezel-inner p-6 lg:p-8">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center flex-shrink-0">
                        <position.icon className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base font-semibold text-zinc-900 dark:text-white mb-1 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                          {position.title}
                        </h3>
                        <div className="flex items-center gap-3 mb-3 flex-wrap">
                          <span className="text-xs text-zinc-500 flex items-center gap-1">
                            <Briefcase className="w-3 h-3" /> {position.team}
                          </span>
                          <span className="text-xs text-zinc-500 flex items-center gap-1">
                            <MapPin className="w-3 h-3" /> {position.location}
                          </span>
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                            {position.type}
                          </span>
                        </div>
                        <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                          {position.description}
                        </p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Apply CTA */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="text-center mt-12"
            >
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
                Don&apos;t see a role that fits? We&apos;re always looking for
                talented people.
              </p>
              <a
                href="mailto:careers@dialix.ai"
                className="btn-pill-primary text-sm px-8 py-3 inline-flex items-center gap-2"
              >
                Send Your Resume
              </a>
            </motion.div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
