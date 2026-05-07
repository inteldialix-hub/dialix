"use client";

import { Reveal } from "@/components/motion";
import { HoverBorderGradient } from "@/components/ui/hover-border-gradient";
import { ArrowRight, Sparkles } from "lucide-react";

export default function CTABanner() {
  return (
    <section className="py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="relative rounded-3xl overflow-hidden cta-gradient py-16 lg:py-20 px-8 lg:px-16 text-center">
            {/* Pattern overlay */}
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

            {/* Glow orb */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[200px] bg-white/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative">
              <span className="inline-flex items-center rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.15em] font-medium bg-white/15 text-white/90 border border-white/20 mb-6 gap-1.5">
                <Sparkles className="w-3 h-3" />
                Get Started
              </span>
              <h2 className="text-3xl lg:text-5xl font-bold text-white tracking-tight mb-4">
                Ready to Deploy Voice AI?
              </h2>
              <p className="text-white/70 max-w-lg mx-auto leading-relaxed mb-8">
                Join enterprises already automating thousands of calls. Start
                your pilot in days, see ROI in weeks.
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
                  Book a Demo
                </a>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
