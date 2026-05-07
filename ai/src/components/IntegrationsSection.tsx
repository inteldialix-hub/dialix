"use client";

import { Reveal, motion } from "@/components/motion";

const integrationLogos = [
  { name: "Salesforce", size: "lg" },
  { name: "HubSpot", size: "md" },
  { name: "Zendesk", size: "sm" },
  { name: "Freshworks", size: "md" },
  { name: "Twilio", size: "sm" },
  { name: "Zapier", size: "md" },
  { name: "Slack", size: "sm" },
  { name: "GoHighLevel", size: "lg" },
  { name: "Calendly", size: "sm" },
  { name: "Intercom", size: "md" },
  { name: "Monday", size: "sm" },
  { name: "Pipedrive", size: "md" },
];

export default function IntegrationsSection() {
  return (
    <section id="integrations" className="section-pad">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="relative rounded-3xl overflow-hidden purple-gradient p-8 lg:p-16">
            {/* Background pattern */}
            <div className="absolute inset-0 opacity-10">
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage:
                    "radial-gradient(circle, rgba(255,255,255,0.15) 1px, transparent 1px)",
                  backgroundSize: "32px 32px",
                }}
              />
            </div>

            <div className="relative grid lg:grid-cols-2 gap-12 items-center">
              {/* Text content */}
              <div>
                <span className="inline-flex items-center rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.15em] font-medium bg-white/15 text-white/90 border border-white/20 mb-6">
                  Integrations
                </span>
                <h2 className="text-4xl lg:text-5xl font-bold text-white tracking-tight leading-[1.1] mb-4">
                  Connects Into Your{" "}
                  <span className="text-purple-200">Existing Stack</span>
                </h2>
                <p className="text-white/70 leading-relaxed mb-8 max-w-md">
                  Dialix integrates with your CRM, helpdesk, calendar, and
                  telephony tools. No rip-and-replace — just plug in and go.
                </p>
                <button className="btn-pill bg-white text-purple-700 font-semibold px-8 py-3.5 hover:bg-purple-50 transition-colors">
                  View All Integrations
                </button>
              </div>

              {/* Integration cloud */}
              <div className="relative min-h-[360px] flex items-center justify-center">
                {/* Center node */}
                <div className="absolute z-10 w-16 h-16 rounded-2xl bg-white shadow-xl shadow-purple-900/30 flex items-center justify-center">
                  <span className="text-lg font-bold text-purple-700">S</span>
                </div>

                {/* Orbiting logos */}
                {integrationLogos.map((logo, i) => {
                  const ring = i < 4 ? 0 : i < 8 ? 1 : 2;
                  const posInRing = ring === 0 ? i : ring === 1 ? i - 4 : i - 8;
                  const countInRing = 4;
                  const radius = 70 + ring * 55;
                  const offset = ring * 25;
                  const angle =
                    (posInRing / countInRing) * 360 + offset;
                  const angleRad = (angle * Math.PI) / 180;
                  const x = Math.round(Math.cos(angleRad) * radius);
                  const y = Math.round(Math.sin(angleRad) * radius);

                  const sizeClass =
                    logo.size === "lg"
                      ? "w-14 h-14 text-xs"
                      : logo.size === "md"
                        ? "w-12 h-12 text-[10px]"
                        : "w-10 h-10 text-[9px]";

                  return (
                    <motion.div
                      key={logo.name}
                      initial={{ opacity: 0, scale: 0 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      viewport={{ once: true }}
                      transition={{
                        delay: 0.3 + i * 0.06,
                        duration: 0.5,
                        type: "spring",
                        stiffness: 200,
                        damping: 18,
                      }}
                      className="absolute"
                      style={{
                        left: `calc(50% + ${x}px)`,
                        top: `calc(50% + ${y}px)`,
                        marginLeft: logo.size === "lg" ? "-28px" : logo.size === "md" ? "-24px" : "-20px",
                        marginTop: logo.size === "lg" ? "-28px" : logo.size === "md" ? "-24px" : "-20px",
                      }}
                    >
                      <div
                        className={`${sizeClass} rounded-xl bg-white/95 dark:bg-zinc-900/90 shadow-md shadow-purple-900/10 flex items-center justify-center font-semibold text-zinc-700 dark:text-zinc-300 hover:scale-110 transition-transform cursor-pointer border border-white/40`}
                      >
                        {logo.name.slice(0, 2)}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
