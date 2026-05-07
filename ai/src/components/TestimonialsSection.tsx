"use client";

import { InfiniteSlider } from "@/components/ui/infinite-slider";
import { Reveal } from "@/components/motion";
import { Star, Quote } from "lucide-react";

const testimonials = [
  {
    name: "Sarah Chen",
    role: "VP of Customer Success",
    company: "Freshworks",
    avatar: "SC",
    rating: 5,
    text: "Dialix cut our average response time by 75%. The AI agents handle tier-1 support flawlessly — our human team now focuses exclusively on complex cases.",
    accentColor: "from-purple-500 to-violet-600",
  },
  {
    name: "Marcus Thompson",
    role: "Head of Operations",
    company: "TechFlow",
    avatar: "MT",
    rating: 5,
    text: "We went from zero to 3x more demos booked in the first month. The lead qualification accuracy is remarkably precise — better than our best SDRs.",
    accentColor: "from-blue-500 to-cyan-600",
  },
  {
    name: "Elena Rodriguez",
    role: "Chief Revenue Officer",
    company: "ScaleUp AI",
    avatar: "ER",
    rating: 5,
    text: "The ROI was visible within 2 weeks. Dialix's voice agents sound natural, handle objections beautifully, and never miss a follow-up.",
    accentColor: "from-emerald-500 to-teal-600",
  },
  {
    name: "David Kim",
    role: "Director of IT",
    company: "MedConnect",
    avatar: "DK",
    rating: 5,
    text: "HIPAA compliance was non-negotiable for us. Dialix met every requirement and deployed in under two weeks. Our patient scheduling is now 100% automated.",
    accentColor: "from-amber-500 to-orange-600",
  },
  {
    name: "Lisa Wang",
    role: "COO",
    company: "PropTech Solutions",
    avatar: "LW",
    rating: 5,
    text: "Our property inquiry response rate went from 40% to 98%. Prospects get instant answers 24/7 and agents only handle serious buyers. Game-changing.",
    accentColor: "from-pink-500 to-rose-600",
  },
  {
    name: "James Okafor",
    role: "Customer Experience Lead",
    company: "FinServe Global",
    avatar: "JO",
    rating: 5,
    text: "The multilingual support blew us away. We serve 12 markets with one platform. Dialix handles calls in Spanish, French, German, and Arabic natively.",
    accentColor: "from-violet-500 to-purple-600",
  },
];

function TestimonialCard({
  testimonial,
}: {
  testimonial: (typeof testimonials)[0];
}) {
  return (
    <div className="group relative w-[340px] shrink-0 select-none">
      <div className="card-bezel h-full">
        <div className="card-bezel-inner p-6 h-full flex flex-col">
          {/* Quote icon */}
          <Quote className="w-6 h-6 text-purple-300 dark:text-purple-700 mb-3 rotate-180" />

          {/* Stars */}
          <div className="flex gap-0.5 mb-3">
            {Array.from({ length: testimonial.rating }).map((_, i) => (
              <Star
                key={i}
                className="w-3.5 h-3.5 text-amber-400 fill-amber-400"
              />
            ))}
          </div>

          {/* Text */}
          <p className="text-sm text-zinc-700 dark:text-zinc-400 leading-relaxed flex-1 mb-5">
            &ldquo;{testimonial.text}&rdquo;
          </p>

          {/* Author */}
          <div className="flex items-center gap-3 pt-4 border-t border-zinc-100 dark:border-zinc-800">
            <div
              className={`w-9 h-9 rounded-full bg-gradient-to-br ${testimonial.accentColor} flex items-center justify-center text-white text-xs font-bold`}
            >
              {testimonial.avatar}
            </div>
            <div>
              <div className="text-sm font-semibold text-zinc-900 dark:text-white">
                {testimonial.name}
              </div>
              <div className="text-[11px] text-zinc-600 dark:text-zinc-500">
                {testimonial.role} · {testimonial.company}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TestimonialsSection() {
  return (
    <section className="section-pad overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-12">
        <div className="text-center">
          <Reveal>
            <span className="eyebrow-badge mb-6 inline-flex">
              What People Say
            </span>
          </Reveal>
          <Reveal delay={0.1}>
            <h2 className="text-4xl lg:text-5xl font-bold text-zinc-900 dark:text-white tracking-tight mb-4">
              Trusted by{" "}
              <span className="text-gradient">Industry Leaders</span>
            </h2>
          </Reveal>
          <Reveal delay={0.2}>
            <p className="text-zinc-600 dark:text-zinc-400 max-w-xl mx-auto leading-relaxed">
              From startups to Fortune 500 companies, teams trust Dialix
              to power their voice AI operations.
            </p>
          </Reveal>
        </div>
      </div>

      {/* Marquee Row 1 */}
      <div className="mb-4">
        <InfiniteSlider gap={20} speed={30}>
          {testimonials.slice(0, 3).map((t) => (
            <TestimonialCard key={t.name} testimonial={t} />
          ))}
        </InfiniteSlider>
      </div>

      {/* Marquee Row 2 — reverse direction */}
      <div>
        <InfiniteSlider gap={20} speed={25} reverse>
          {testimonials.slice(3).map((t) => (
            <TestimonialCard key={t.name} testimonial={t} />
          ))}
        </InfiniteSlider>
      </div>
    </section>
  );
}
