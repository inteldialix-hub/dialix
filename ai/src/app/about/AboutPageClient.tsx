"use client";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { motion } from "framer-motion";
import {
  Bot,
  Phone,
  BarChart3,
  Webhook,
  Shield,
  Zap,
  Globe,
  Users,
  Target,
  Sparkles,
} from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.6, ease: [0.32, 0.72, 0, 1] as [number, number, number, number] },
  }),
};

const platformFeatures = [
  {
    icon: Bot,
    title: "AI Voice Agents",
    description:
      "Create intelligent conversational agents powered by ElevenLabs and GPT-4. Configure voice, personality, language, and behavior — all from a no-code interface.",
  },
  {
    icon: Phone,
    title: "Phone Number Management",
    description:
      "Provision and manage phone numbers across regions. Assign numbers to agents for inbound and outbound calling with full telephony control.",
  },
  {
    icon: BarChart3,
    title: "Call Analytics & Transcription",
    description:
      "Review every conversation with full transcripts, audio playback, quality scores, latency metrics, and evaluation criteria — all in real time.",
  },
  {
    icon: Webhook,
    title: "Webhooks & API",
    description:
      "Integrate Dialix into your existing stack. Receive real-time call events via webhooks, export data as CSV/PDF, and build custom workflows.",
  },
];

const values = [
  {
    icon: Target,
    title: "Built for Enterprise",
    description:
      "We design every feature with enterprise reliability in mind — from sub-100ms latency to 99.99% uptime and SOC 2 compliance.",
  },
  {
    icon: Sparkles,
    title: "AI That Sounds Human",
    description:
      "Our agents use state-of-the-art text-to-speech and natural language models to deliver conversations indistinguishable from human agents.",
  },
  {
    icon: Globe,
    title: "Multilingual by Default",
    description:
      "Deploy agents in 29+ languages. Each agent can be configured with its own language, voice, and cultural context.",
  },
  {
    icon: Shield,
    title: "Security First",
    description:
      "End-to-end encryption, role-based access, audit logging, and compliance with GDPR, HIPAA, and PCI DSS standards.",
  },
];

export default function AboutPageClient() {
  return (
    <>
      <Header />
      <main className="min-h-screen">
        {/* Hero */}
        <section className="relative overflow-hidden hero-gradient">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-36">
            <motion.div
              initial="hidden"
              animate="visible"
              className="max-w-3xl mx-auto text-center"
            >
              <motion.span
                variants={fadeUp}
                custom={0}
                className="eyebrow-badge mb-6 inline-flex"
              >
                ABOUT DIALIX
              </motion.span>
              <motion.h1
                variants={fadeUp}
                custom={1}
                className="text-4xl md:text-5xl lg:text-6xl font-bold text-zinc-900 dark:text-white mb-6"
              >
                The Voice AI Platform
                <br />
                <span className="text-gradient">Built for Scale</span>
              </motion.h1>
              <motion.p
                variants={fadeUp}
                custom={2}
                className="text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-2xl mx-auto"
              >
                Dialix empowers businesses to deploy AI-powered phone agents
                that handle thousands of simultaneous conversations — qualifying
                leads, scheduling appointments, and delivering support 24/7.
              </motion.p>
            </motion.div>
          </div>
          {/* Dot grid overlay */}
          <div className="absolute inset-0 dot-grid opacity-40 pointer-events-none" />
        </section>

        {/* Mission */}
        <section className="section-pad">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.7 }}
              >
                <span className="eyebrow-badge mb-4 inline-flex">
                  OUR MISSION
                </span>
                <h2 className="text-3xl md:text-4xl font-bold text-zinc-900 dark:text-white mb-6">
                  Replacing hold music with
                  <br />
                  intelligent conversations
                </h2>
                <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed mb-4">
                  Every year, businesses lose millions of hours to missed calls,
                  long wait times, and repetitive phone tasks. We built Dialix
                  to change that.
                </p>
                <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  Our platform connects ElevenLabs&apos; conversational AI with
                  enterprise telephony infrastructure so you can deploy voice
                  agents that sound natural, follow your business logic, and
                  integrate with your existing tools — all without writing code.
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.7, delay: 0.2 }}
                className="grid grid-cols-2 gap-4"
              >
                {[
                  { value: "24/7", label: "Agent Availability" },
                  { value: "29+", label: "Languages Supported" },
                  { value: "<100ms", label: "Voice Latency" },
                  { value: "99.99%", label: "Platform Uptime" },
                ].map((stat, i) => (
                  <div
                    key={stat.label}
                    className="card-bezel"
                  >
                    <div className="card-bezel-inner p-6 text-center">
                      <div className="text-2xl md:text-3xl font-bold text-gradient mb-1">
                        {stat.value}
                      </div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                        {stat.label}
                      </div>
                    </div>
                  </div>
                ))}
              </motion.div>
            </div>
          </div>
        </section>

        {/* Platform Features */}
        <section className="section-pad bg-zinc-50/50 dark:bg-zinc-900/30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <span className="eyebrow-badge mb-4 inline-flex">
                WHAT WE BUILD
              </span>
              <h2 className="text-3xl md:text-4xl font-bold text-zinc-900 dark:text-white">
                Everything You Need in One Platform
              </h2>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {platformFeatures.map((feature, i) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1, duration: 0.5 }}
                  className="card-bezel"
                >
                  <div className="card-bezel-inner p-8">
                    <div className="w-12 h-12 rounded-2xl bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center mb-5">
                      <feature.icon className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-2">
                      {feature.title}
                    </h3>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Values */}
        <section className="section-pad">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <span className="eyebrow-badge mb-4 inline-flex">
                OUR VALUES
              </span>
              <h2 className="text-3xl md:text-4xl font-bold text-zinc-900 dark:text-white">
                What Drives Us
              </h2>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {values.map((value, i) => (
                <motion.div
                  key={value.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08, duration: 0.5 }}
                  className="text-center p-6"
                >
                  <div className="w-14 h-14 rounded-2xl bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center mx-auto mb-4 border border-purple-200/50 dark:border-purple-800/30">
                    <value.icon className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                  </div>
                  <h3 className="text-base font-semibold text-zinc-900 dark:text-white mb-2">
                    {value.title}
                  </h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    {value.description}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="section-pad-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="relative rounded-3xl overflow-hidden cta-gradient p-12 lg:p-16 text-center">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                Ready to automate your phone operations?
              </h2>
              <p className="text-white/80 text-lg mb-8 max-w-2xl mx-auto">
                Join businesses using Dialix to handle thousands of
                conversations with AI voice agents.
              </p>
              <div className="flex items-center justify-center gap-4 flex-wrap">
                <a href="/signup" className="btn-pill bg-white text-purple-700 hover:bg-zinc-100 px-8 py-3.5 text-sm font-semibold">
                  Start Now
                </a>
                <a href="mailto:contact@dialix.ai" className="btn-pill bg-white/15 text-white hover:bg-white/25 border border-white/20 px-8 py-3.5 text-sm font-semibold">
                  Contact Sales
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
