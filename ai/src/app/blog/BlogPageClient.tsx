"use client";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { motion } from "framer-motion";
import { ArrowRight, Clock, Tag } from "lucide-react";
import Link from "next/link";

const blogPosts = [
  {
    slug: "how-ai-voice-agents-work",
    category: "Platform",
    title: "How AI Voice Agents Actually Work: ElevenLabs, GPT-4, and Real-Time Telephony",
    excerpt:
      "A deep dive into the architecture behind modern voice AI — from speech recognition to natural language processing to text-to-speech synthesis, and how Dialix orchestrates it all.",
    date: "April 25, 2026",
    readTime: "8 min read",
    featured: true,
  },
  {
    slug: "call-analytics-quality-scores",
    category: "Analytics",
    title: "Understanding Call Analytics: Quality Scores, Latency Metrics, and Transcription",
    excerpt:
      "Learn how to use Dialix's analysis dashboard to review conversations, measure agent performance with quality scores, and optimize your call operations.",
    date: "April 20, 2026",
    readTime: "6 min read",
    featured: false,
  },
  {
    slug: "webhook-integration-guide",
    category: "Developer",
    title: "Automating Workflows with Webhooks: A Complete Integration Guide",
    excerpt:
      "Step-by-step guide to setting up webhook subscriptions in Dialix — receive real-time call events, trigger CRM updates, and build custom automation pipelines.",
    date: "April 15, 2026",
    readTime: "5 min read",
    featured: false,
  },
  {
    slug: "deploying-multilingual-agents",
    category: "Use Cases",
    title: "Deploying Multilingual Voice Agents for Global Customer Support",
    excerpt:
      "How to configure agents in 29+ languages, select the right TTS model, and handle cultural nuances in automated conversations.",
    date: "April 10, 2026",
    readTime: "7 min read",
    featured: false,
  },
  {
    slug: "healthcare-appointment-scheduling",
    category: "Industry",
    title: "AI Receptionists in Healthcare: Automating Appointment Scheduling",
    excerpt:
      "Case study: how a healthcare practice reduced missed calls by 80% and automated appointment booking with Dialix voice agents.",
    date: "April 5, 2026",
    readTime: "5 min read",
    featured: false,
  },
  {
    slug: "phone-number-management-tips",
    category: "Platform",
    title: "Phone Number Management: Provisioning, Routing, and Best Practices",
    excerpt:
      "Everything you need to know about managing phone numbers in Dialix — from provisioning new numbers to assigning them to agents and configuring inbound routing.",
    date: "March 28, 2026",
    readTime: "4 min read",
    featured: false,
  },
];

const categories = ["All", "Platform", "Analytics", "Developer", "Use Cases", "Industry"];

export default function BlogPageClient() {
  const featured = blogPosts.find((p) => p.featured);
  const rest = blogPosts.filter((p) => !p.featured);

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
              <span className="eyebrow-badge mb-6 inline-flex">BLOG</span>
              <h1 className="text-4xl md:text-5xl font-bold text-zinc-900 dark:text-white mb-4">
                Voice AI Insights
              </h1>
              <p className="text-lg text-zinc-600 dark:text-zinc-400">
                Guides, tutorials, and industry insights to help you get the
                most out of your AI voice agents.
              </p>
            </motion.div>
          </div>
          <div className="absolute inset-0 dot-grid opacity-40 pointer-events-none" />
        </section>

        {/* Category filter */}
        <section className="py-8 border-b border-zinc-200 dark:border-zinc-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-2 overflow-x-auto">
              {categories.map((cat) => (
                <button
                  key={cat}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
                    cat === "All"
                      ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                      : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Featured post */}
        {featured && (
          <section className="section-pad-sm">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className="card-bezel"
              >
                <div className="card-bezel-inner p-8 lg:p-12">
                  <div className="grid lg:grid-cols-[1fr_1.2fr] gap-8 items-center">
                    <div>
                      <div className="flex items-center gap-3 mb-4">
                        <span className="eyebrow-badge">{featured.category}</span>
                        <span className="text-xs text-zinc-500">FEATURED</span>
                      </div>
                      <h2 className="text-2xl md:text-3xl font-bold text-zinc-900 dark:text-white mb-4 leading-tight">
                        {featured.title}
                      </h2>
                      <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed mb-6">
                        {featured.excerpt}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-zinc-500 mb-6">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {featured.readTime}
                        </span>
                        <span>{featured.date}</span>
                      </div>
                      <span className="btn-pill-primary text-sm px-6 py-2.5 inline-flex items-center gap-2 cursor-pointer">
                        Read Article <ArrowRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                    <div className="rounded-2xl bg-gradient-to-br from-purple-100 via-purple-50 to-zinc-100 dark:from-purple-900/30 dark:via-zinc-800 dark:to-zinc-900 h-64 lg:h-80 flex items-center justify-center">
                      <div className="text-6xl opacity-30">🎙️</div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </section>
        )}

        {/* Post grid */}
        <section className="section-pad">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {rest.map((post, i) => (
                <motion.article
                  key={post.slug}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08, duration: 0.5 }}
                  className="card-bezel group cursor-pointer"
                >
                  <div className="card-bezel-inner p-6 flex flex-col h-full">
                    {/* Thumbnail */}
                    <div className="rounded-xl bg-gradient-to-br from-purple-50 to-zinc-100 dark:from-zinc-800 dark:to-zinc-900 h-40 flex items-center justify-center mb-5 group-hover:scale-[1.02] transition-transform duration-300">
                      <Tag className="w-8 h-8 text-purple-400/40" />
                    </div>

                    <span className="eyebrow-badge self-start mb-3 text-[10px]">
                      {post.category}
                    </span>

                    <h3 className="text-base font-semibold text-zinc-900 dark:text-white mb-2 leading-snug group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                      {post.title}
                    </h3>

                    <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed mb-4 flex-1">
                      {post.excerpt}
                    </p>

                    <div className="flex items-center justify-between text-xs text-zinc-500 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                      <span>{post.date}</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {post.readTime}
                      </span>
                    </div>
                  </div>
                </motion.article>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
