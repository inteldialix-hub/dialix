"use client";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { motion } from "framer-motion";
import { Mail, MessageSquare, Clock, MapPin, Send } from "lucide-react";
import { useState } from "react";

const contactChannels = [
  {
    icon: Mail,
    title: "Email Us",
    description: "For general inquiries and sales",
    detail: "contact@dialix.ai",
    href: "mailto:contact@dialix.ai",
  },
  {
    icon: MessageSquare,
    title: "Technical Support",
    description: "For platform and integration help",
    detail: "support@dialix.ai",
    href: "mailto:support@dialix.ai",
  },
  {
    icon: Clock,
    title: "Response Time",
    description: "We typically respond within",
    detail: "< 24 hours",
    href: null,
  },
  {
    icon: MapPin,
    title: "Headquarters",
    description: "Based in",
    detail: "London, UK",
    href: null,
  },
];

export default function ContactPageClient() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    company: "",
    subject: "",
    message: "",
  });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // In a real app, this would send to an API
    setSubmitted(true);
  };

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
              <span className="eyebrow-badge mb-6 inline-flex">CONTACT US</span>
              <h1 className="text-4xl md:text-5xl font-bold text-zinc-900 dark:text-white mb-4">
                Let&apos;s Talk Voice AI
              </h1>
              <p className="text-lg text-zinc-600 dark:text-zinc-400">
                Whether you&apos;re evaluating Dialix for your team, need
                technical support, or want to explore partnerships — we&apos;re
                here to help.
              </p>
            </motion.div>
          </div>
          <div className="absolute inset-0 dot-grid opacity-40 pointer-events-none" />
        </section>

        {/* Contact cards */}
        <section className="section-pad-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {contactChannels.map((channel, i) => (
                <motion.div
                  key={channel.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08, duration: 0.5 }}
                  className="card-bezel"
                >
                  <div className="card-bezel-inner p-6 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center mx-auto mb-4">
                      <channel.icon className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-white mb-1">
                      {channel.title}
                    </h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">
                      {channel.description}
                    </p>
                    {channel.href ? (
                      <a
                        href={channel.href}
                        className="text-sm font-medium text-purple-600 dark:text-purple-400 hover:underline"
                      >
                        {channel.detail}
                      </a>
                    ) : (
                      <span className="text-sm font-medium text-zinc-900 dark:text-white">
                        {channel.detail}
                      </span>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Contact Form */}
        <section className="section-pad">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <div className="text-center mb-10">
                <h2 className="text-2xl md:text-3xl font-bold text-zinc-900 dark:text-white mb-3">
                  Send Us a Message
                </h2>
                <p className="text-zinc-600 dark:text-zinc-400">
                  Fill out the form below and we&apos;ll get back to you as soon
                  as possible.
                </p>
              </div>

              {submitted ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="card-bezel"
                >
                  <div className="card-bezel-inner p-12 text-center">
                    <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center mx-auto mb-6">
                      <Send className="w-7 h-7 text-green-600 dark:text-green-400" />
                    </div>
                    <h3 className="text-xl font-semibold text-zinc-900 dark:text-white mb-2">
                      Message Sent!
                    </h3>
                    <p className="text-zinc-600 dark:text-zinc-400 mb-6">
                      Thanks for reaching out. Our team will review your message
                      and respond within 24 hours.
                    </p>
                    <button
                      onClick={() => {
                        setSubmitted(false);
                        setForm({ name: "", email: "", company: "", subject: "", message: "" });
                      }}
                      className="btn-pill-primary text-sm px-6 py-2.5"
                    >
                      Send Another
                    </button>
                  </div>
                </motion.div>
              ) : (
                <div className="card-bezel">
                  <div className="card-bezel-inner p-8">
                    <form onSubmit={handleSubmit} className="space-y-5">
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                            Name *
                          </label>
                          <input
                            type="text"
                            required
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            className="w-full px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 transition-all text-zinc-900 dark:text-white"
                            placeholder="Your name"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                            Email *
                          </label>
                          <input
                            type="email"
                            required
                            value={form.email}
                            onChange={(e) => setForm({ ...form, email: e.target.value })}
                            className="w-full px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 transition-all text-zinc-900 dark:text-white"
                            placeholder="you@company.com"
                          />
                        </div>
                      </div>

                      <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                            Company
                          </label>
                          <input
                            type="text"
                            value={form.company}
                            onChange={(e) => setForm({ ...form, company: e.target.value })}
                            className="w-full px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 transition-all text-zinc-900 dark:text-white"
                            placeholder="Your company"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                            Subject *
                          </label>
                          <input
                            type="text"
                            required
                            value={form.subject}
                            onChange={(e) => setForm({ ...form, subject: e.target.value })}
                            className="w-full px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 transition-all text-zinc-900 dark:text-white"
                            placeholder="How can we help?"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                          Message *
                        </label>
                        <textarea
                          required
                          rows={5}
                          value={form.message}
                          onChange={(e) => setForm({ ...form, message: e.target.value })}
                          className="w-full px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 transition-all text-zinc-900 dark:text-white resize-y"
                          placeholder="Tell us about your use case, team size, and what you're looking to achieve..."
                        />
                      </div>

                      <button
                        type="submit"
                        className="btn-pill-accent w-full py-3 text-sm"
                      >
                        <Send className="w-4 h-4 mr-2 inline" />
                        Send Message
                      </button>
                    </form>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
