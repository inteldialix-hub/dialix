"use client";

import Link from "next/link";
import { Reveal, Stagger, MotionItem } from "@/components/motion";
import { ArrowRight, Shield, Zap } from "lucide-react";
import { OrganicBranches } from "@/components/ui/organic-branches";

const footerLinks = [
  {
    title: "Platform",
    links: [
      { label: "Dashboard", href: "/dashboard" },
      { label: "AI Voice Agents", href: "/dashboard/agents" },
      { label: "Phone Numbers", href: "/dashboard/phone-numbers" },
      { label: "Call Analytics", href: "/dashboard/history" },
      { label: "Webhooks & API", href: "/dashboard" },
      { label: "Pricing", href: "/pricing" },
      { label: "Settings", href: "/dashboard/settings" },
    ],
  },
  {
    title: "Use Cases",
    links: [
      { label: "BPO & Call Centers", href: "/#industries" },
      { label: "Healthcare", href: "/#industries" },
      { label: "Real Estate", href: "/#industries" },
      { label: "Financial Services", href: "/#industries" },
      { label: "Retail & E-Commerce", href: "/#industries" },
      { label: "Technology", href: "/#industries" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Blog", href: "/blog" },
      { label: "Case Studies", href: "/#case-studies" },
      { label: "FAQ", href: "/#faq" },
      { label: "API Documentation", href: "/docs" },
      { label: "System Status", href: "/status" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About Us", href: "/about" },
      { label: "Contact", href: "/contact" },
      { label: "Careers", href: "/careers" },
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Terms of Service", href: "/terms" },
    ],
  },
];

const socialLinks = [
  { name: "LinkedIn", href: "#" },
  { name: "Twitter", href: "#" },
  { name: "YouTube", href: "#" },
  { name: "GitHub", href: "#" },
];

export default function Footer() {
  return (
    <footer className="relative overflow-hidden border-t border-zinc-200 dark:border-zinc-800/60">
      {/* Gradient background */}
      <div className="absolute inset-0 footer-gradient" />
      <OrganicBranches />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
        <div className="grid lg:grid-cols-[1.2fr_2fr] gap-16">
          {/* Brand column */}
          <Reveal>
            <div>
              {/* Logo */}
              <Link href="/" className="flex items-center gap-2.5 mb-6">
                <div className="w-9 h-9 bg-zinc-900 dark:bg-white rounded-xl flex items-center justify-center shadow-lg">
                  <Zap className="w-4 h-4 text-white dark:text-zinc-900" />
                </div>
                <span className="text-xl font-bold text-zinc-900 dark:text-white tracking-tight">
                  Dialix
                </span>
              </Link>

              <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed mb-6 max-w-sm">
                Enterprise-ready Voice AI platform for automated phone calls.
                Build, deploy, and scale AI voice agents that handle thousands
                of conversations simultaneously.
              </p>

              {/* Social links */}
              <div className="flex items-center gap-3 mb-8">
                {socialLinks.map((social) => (
                  <a
                    key={social.name}
                    href={social.href}
                    aria-label={`Visit us on ${social.name}`}
                    className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-zinc-600 dark:text-zinc-400 hover:bg-purple-100 dark:hover:bg-purple-900/40 hover:text-purple-600 dark:hover:text-purple-400 hover:border-purple-300 dark:hover:border-purple-700 transition-all duration-300 text-xs font-semibold"
                  >
                    {social.name.slice(0, 2)}
                  </a>
                ))}
              </div>

              {/* Newsletter */}
              <div className="mb-8">
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-3">
                  Stay Updated
                </p>
                <div className="flex">
                  <input
                    type="email"
                    placeholder="your@email.com"
                    className="flex-1 px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-l-xl focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 transition-all text-zinc-900 dark:text-white placeholder:text-zinc-400"
                  />
                  <button className="px-4 py-2.5 bg-zinc-900 dark:bg-purple-600 text-white rounded-r-xl hover:bg-zinc-800 dark:hover:bg-purple-700 transition-colors border border-zinc-900 dark:border-purple-600">
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Security note */}
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-[10px] font-semibold text-zinc-600 dark:text-zinc-400">
                <Shield className="w-2.5 h-2.5" />
                Enterprise-grade Security
              </div>
            </div>
          </Reveal>

          {/* Link columns */}
          <Stagger className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {footerLinks.map((column) => (
              <MotionItem key={column.title}>
                <h4 className="text-sm font-semibold text-zinc-900 dark:text-white mb-4">
                  {column.title}
                </h4>
                <ul className="space-y-2.5">
                  {column.links.map((link) => (
                    <li key={link.label}>
                      {link.href.startsWith("#") || link.href.startsWith("/#") ? (
                        <a
                          href={link.href}
                          className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
                        >
                          {link.label}
                        </a>
                      ) : (
                        <Link
                          href={link.href}
                          className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
                        >
                          {link.label}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </MotionItem>
            ))}
          </Stagger>
        </div>

        {/* Bottom bar */}
        <div className="mt-16 pt-8 border-t border-zinc-200 dark:border-zinc-800/60 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-zinc-500 dark:text-zinc-500">
            &copy; {new Date().getFullYear()} Dialix AI. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            {[
              { label: "Privacy Policy", href: "/privacy" },
              { label: "Terms of Service", href: "/terms" },
              { label: "Contact", href: "/contact" },
            ].map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="text-xs text-zinc-500 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Giant brand watermark */}
      <div
        className="bg-gradient-to-b from-zinc-300/30 via-zinc-300/15 to-transparent dark:from-zinc-700/20 dark:via-zinc-700/10 dark:to-transparent bg-clip-text text-transparent leading-none absolute left-1/2 -translate-x-1/2 bottom-8 font-black tracking-tighter pointer-events-none select-none text-center"
        style={{
          fontSize: "clamp(4rem, 14vw, 12rem)",
          maxWidth: "95vw",
        }}
      >
        DIALIX
      </div>
    </footer>
  );
}
