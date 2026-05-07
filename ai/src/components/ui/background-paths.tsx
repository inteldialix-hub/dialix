"use client";

/**
 * Background decoration using CSS-animated SVG paths.
 * Uses stroke-dashoffset animation (GPU-composited) instead of
 * the old 72-path Framer Motion version (216 JS animations).
 *
 * Visually: flowing dashed curves that drift across the hero section.
 */

const pathSets = [
  // Set 1: curves flowing left-to-right
  [
    { d: "M-380 -189C-380 -189 -312 216 152 343C616 470 684 875 684 875", w: 1.2, o: 0.15 },
    { d: "M-350 -159C-350 -159 -282 246 182 373C646 500 714 905 714 905", w: 0.8, o: 0.12 },
    { d: "M-320 -129C-320 -129 -252 276 212 403C676 530 744 935 744 935", w: 1.0, o: 0.18 },
    { d: "M-290 -99C-290 -99 -222 306 242 433C706 560 774 965 774 965", w: 0.6, o: 0.1 },
    { d: "M-260 -69C-260 -69 -192 336 272 463C736 590 804 995 804 995", w: 0.9, o: 0.14 },
    { d: "M-230 -39C-230 -39 -162 366 302 493C766 620 834 1025 834 1025", w: 0.7, o: 0.11 },
    { d: "M-200 -9C-200 -9 -132 396 332 523C796 650 864 1055 864 1055", w: 1.1, o: 0.16 },
    { d: "M-170 21C-170 21 -102 426 362 553C826 680 894 1085 894 1085", w: 0.5, o: 0.09 },
  ],
  // Set 2: mirrored curves flowing right-to-left
  [
    { d: "M-380 -189C-380 -189 -312 216 152 343C616 470 684 875 684 875", w: 0.8, o: 0.1 },
    { d: "M-340 -149C-340 -149 -272 256 192 383C656 510 724 915 724 915", w: 0.6, o: 0.08 },
    { d: "M-300 -109C-300 -109 -232 296 232 423C696 550 764 955 764 955", w: 0.9, o: 0.12 },
    { d: "M-260 -69C-260 -69 -192 336 272 463C736 590 804 995 804 995", w: 0.5, o: 0.07 },
    { d: "M-220 -29C-220 -29 -152 376 312 503C776 630 844 1035 844 1035", w: 0.7, o: 0.1 },
    { d: "M-180 11C-180 11 -112 416 352 543C816 670 884 1075 884 1075", w: 0.6, o: 0.09 },
  ],
];

export function BackgroundPaths() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Forward-flowing paths */}
      <svg
        className="absolute inset-0 w-full h-full text-purple-500/40 dark:text-purple-400/25"
        viewBox="0 0 696 316"
        fill="none"
        aria-hidden="true"
      >
        <title>Background Decoration</title>
        {pathSets[0].map((p, i) => (
          <path
            key={`f-${i}`}
            d={p.d}
            stroke="currentColor"
            strokeWidth={p.w}
            strokeOpacity={p.o}
            strokeDasharray="12 16"
            className="animate-dash"
            style={{
              animationDuration: `${18 + i * 4}s`,
              animationDelay: `${i * -2.5}s`,
            }}
          />
        ))}
      </svg>

      {/* Mirrored paths (reversed) */}
      <svg
        className="absolute inset-0 w-full h-full text-violet-500/30 dark:text-violet-400/20"
        viewBox="0 0 696 316"
        fill="none"
        aria-hidden="true"
        style={{ transform: "scaleX(-1)" }}
      >
        <title>Background Decoration Mirror</title>
        {pathSets[1].map((p, i) => (
          <path
            key={`r-${i}`}
            d={p.d}
            stroke="currentColor"
            strokeWidth={p.w}
            strokeOpacity={p.o}
            strokeDasharray="10 18"
            className="animate-dash-reverse"
            style={{
              animationDuration: `${22 + i * 3}s`,
              animationDelay: `${i * -3}s`,
            }}
          />
        ))}
      </svg>
    </div>
  );
}
