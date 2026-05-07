"use client";

import { Reveal, motion } from "@/components/motion";
import {
  Phone,
  MessageSquare,
  Mail,
  Globe,
  Mic,
  Headphones,
  MessageCircle,
  Radio,
} from "lucide-react";

const channels = [
  { icon: Phone, label: "Voice", angle: 0, color: "text-purple-600 dark:text-purple-400" },
  { icon: MessageSquare, label: "SMS", angle: 45, color: "text-blue-600 dark:text-blue-400" },
  { icon: Mail, label: "Email", angle: 90, color: "text-emerald-600 dark:text-emerald-400" },
  { icon: Globe, label: "Web", angle: 135, color: "text-amber-600 dark:text-amber-400" },
  { icon: MessageCircle, label: "WhatsApp", angle: 180, color: "text-green-600 dark:text-green-400" },
  { icon: Headphones, label: "Support", angle: 225, color: "text-cyan-600 dark:text-cyan-400" },
  { icon: Radio, label: "IVR", angle: 270, color: "text-pink-600 dark:text-pink-400" },
  { icon: Mic, label: "Live", angle: 315, color: "text-violet-600 dark:text-violet-400" },
];

export default function OmnichannelSection() {
  return (
    <section className="section-pad">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <Reveal>
            <span className="eyebrow-badge mb-6 inline-flex">
              Omnichannel
            </span>
          </Reveal>
          <Reveal delay={0.1}>
            <h2 className="text-4xl lg:text-5xl font-bold text-zinc-900 dark:text-white tracking-tight mb-4">
              One Agent, Every Channel
            </h2>
          </Reveal>
          <Reveal delay={0.2}>
            <p className="text-zinc-600 dark:text-zinc-400 max-w-xl mx-auto leading-relaxed">
              Deploy voice agents across every touchpoint — phone, SMS, web,
              WhatsApp, and more — from a single unified platform.
            </p>
          </Reveal>
        </div>

        {/* Orbital layout */}
        <Reveal>
          <div className="relative max-w-lg mx-auto aspect-square">
            {/* Orbit rings */}
            <div className="absolute inset-8 rounded-full border border-dashed border-zinc-200 dark:border-zinc-800" />
            <div className="absolute inset-16 rounded-full border border-dashed border-purple-200/50 dark:border-purple-800/30" />

            {/* Center icon */}
            <div className="absolute inset-0 flex items-center justify-center">
              <motion.div
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                className="w-20 h-20 rounded-2xl purple-gradient shadow-lg shadow-purple-500/20 flex items-center justify-center"
              >
                <Phone className="w-8 h-8 text-white" />
              </motion.div>
            </div>

            {/* Channel nodes */}
            {channels.map((channel, i) => {
              const radius = 42;
              const angleRad = (channel.angle * Math.PI) / 180;
              const x = 50 + radius * Math.cos(angleRad);
              const y = 50 + radius * Math.sin(angleRad);

              return (
                <motion.div
                  key={channel.label}
                  initial={{ opacity: 0, scale: 0 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{
                    delay: 0.3 + i * 0.08,
                    duration: 0.5,
                    type: "spring",
                    stiffness: 200,
                    damping: 20,
                  }}
                  className="absolute"
                  style={{
                    left: `${x}%`,
                    top: `${y}%`,
                    transform: "translate(-50%, -50%)",
                  }}
                >
                  <div className="group flex flex-col items-center gap-1.5 cursor-pointer">
                    <div className="w-12 h-12 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shadow-sm flex items-center justify-center group-hover:shadow-md group-hover:scale-110 transition-all duration-300">
                      <channel.icon className={`w-5 h-5 ${channel.color}`} />
                    </div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      {channel.label}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
