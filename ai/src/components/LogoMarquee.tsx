"use client";

import { Reveal } from "@/components/motion";
import { InfiniteSlider } from "@/components/ui/infinite-slider";
import { ProgressiveBlur } from "@/components/ui/progressive-blur";

const logos = [
  { name: "Freshworks", weight: "font-bold" },
  { name: "Gorgias", weight: "font-semibold" },
  { name: "Webflow", weight: "font-bold" },
  { name: "Y Combinator", weight: "font-semibold" },
  { name: "ActiveCampaign", weight: "font-medium" },
  { name: "Calendly", weight: "font-bold" },
  { name: "GoHighLevel", weight: "font-semibold" },
  { name: "Pipedrive", weight: "font-medium" },
  { name: "monday.com", weight: "font-bold" },
  { name: "Intercom", weight: "font-semibold" },
  { name: "HubSpot", weight: "font-bold" },
  { name: "Salesforce", weight: "font-semibold" },
];

export default function LogoMarquee() {
  return (
    <section className="py-14 border-y border-zinc-200/80 dark:border-zinc-800/60 bg-white dark:bg-zinc-900/30">
      <Reveal>
        <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-500 mb-8">
          Trusted by leading enterprises
        </p>

        <div className="relative mx-auto max-w-5xl">
          <InfiniteSlider gap={48} speed={30} speedOnHover={10}>
            {logos.map((logo) => (
              <span
                key={logo.name}
                className={`text-xl lg:text-2xl ${logo.weight} text-zinc-700 dark:text-zinc-400 whitespace-nowrap select-none hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors duration-300`}
              >
                {logo.name}
              </span>
            ))}
          </InfiniteSlider>

          <ProgressiveBlur
            blurIntensity={1}
            className="pointer-events-none absolute top-0 left-0 h-full w-[120px]"
            direction="left"
          />
          <ProgressiveBlur
            blurIntensity={1}
            className="pointer-events-none absolute top-0 right-0 h-full w-[120px]"
            direction="right"
          />
        </div>
      </Reveal>
    </section>
  );
}
