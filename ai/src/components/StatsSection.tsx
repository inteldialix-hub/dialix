"use client";

import { useEffect, useRef, useState } from "react";
import { Reveal, Stagger, MotionItem } from "@/components/motion";

const stats = [
  {
    value: 65,
    suffix: "M+",
    label: "Customer Calls",
    description:
      "Proven voice AI performance across real, high-volume phone operations.",
  },
  {
    value: 4,
    suffix: "M+",
    label: "Hours Saved",
    description:
      "Less time on manual calls. More time for growth, sales, and support.",
  },
  {
    value: 35,
    suffix: "%",
    prefix: "+",
    label: "Answered Calls",
    description:
      "Voice agents respond instantly — no hold music, no missed opportunities.",
  },
  {
    value: 99.99,
    suffix: "%",
    label: "Uptime",
    description:
      "AI voice agents your business can rely on, every minute of every day.",
  },
];

function CountUp({
  target,
  prefix = "",
  suffix = "",
}: {
  target: number;
  prefix?: string;
  suffix?: string;
}) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true;
          const duration = 1800;
          const steps = 60;
          const increment = target / steps;
          let current = 0;
          timer = setInterval(() => {
            if (cancelled) {
              if (timer) clearInterval(timer);
              return;
            }
            current += increment;
            if (current >= target) {
              setCount(target);
              if (timer) clearInterval(timer);
            } else {
              setCount(Math.floor(current * 100) / 100);
            }
          }, duration / steps);
        }
      },
      { threshold: 0.3 }
    );

    if (ref.current) observer.observe(ref.current);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      observer.disconnect();
    };
  }, [target]);

  const display = target % 1 === 0 ? Math.floor(count) : count.toFixed(2);

  return (
    <span ref={ref}>
      {prefix}
      {display}
      {suffix}
    </span>
  );
}

export default function StatsSection() {
  return (
    <section className="section-pad-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="card-bezel">
            <div className="card-bezel-inner p-8 lg:p-10">
              <Stagger className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
                {stats.map((stat) => (
                  <MotionItem key={stat.label}>
                    <div className="text-left">
                      <div className="text-4xl lg:text-5xl font-bold text-purple-600 dark:text-purple-400 tracking-tight mb-2">
                        <CountUp
                          target={stat.value}
                          prefix={stat.prefix}
                          suffix={stat.suffix}
                        />
                      </div>
                      <div className="text-sm font-semibold text-zinc-900 dark:text-white mb-2">
                        {stat.label}
                      </div>
                      <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                        {stat.description}
                      </p>
                    </div>
                  </MotionItem>
                ))}
              </Stagger>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
