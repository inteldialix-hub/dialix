'use client'

/**
 * Lightweight SVG branch decorations — purely static,
 * zero JavaScript, zero animation overhead.
 * Uses hardcoded SVG paths instead of canvas recursion.
 */

export function OrganicBranches({ className = '' }: { className?: string }) {
  return (
    <div
      className={`absolute inset-0 pointer-events-none z-0 overflow-hidden ${className}`}
      aria-hidden="true"
    >
      {/* Top-left branches */}
      <svg
        className="absolute top-0 left-0 w-[280px] h-[280px] opacity-30 dark:opacity-40"
        viewBox="0 0 280 280"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <g stroke="rgba(160,130,200,1)" strokeLinecap="round">
          <path d="M0 0 Q30 25 55 70 Q60 85 50 110 Q45 130 55 150" strokeWidth="2.2" />
          <path d="M55 70 Q70 60 95 55 Q110 52 125 60" strokeWidth="1.6" />
          <path d="M50 110 Q35 120 25 140 Q20 155 28 170" strokeWidth="1.3" />
          <path d="M55 150 Q65 165 60 185 Q55 200 65 215" strokeWidth="1.1" />
          <path d="M95 55 Q115 48 135 55 Q148 60 155 75" strokeWidth="1.1" />
          <path d="M0 30 Q20 45 35 75 Q40 90 35 108" strokeWidth="1.8" />
          <path d="M35 75 Q50 70 70 72 Q85 74 95 85" strokeWidth="1.2" />
          <path d="M35 108 Q25 125 30 145" strokeWidth="1.0" />
          <path d="M30 0 Q45 30 50 55" strokeWidth="1.5" />
          <path d="M50 55 Q58 48 72 45" strokeWidth="0.9" />
          <path d="M0 80 Q18 90 28 115" strokeWidth="1.4" />
          <path d="M28 115 Q35 108 48 105" strokeWidth="0.9" />
        </g>
      </svg>

      {/* Top-right branches (mirrored) */}
      <svg
        className="absolute top-0 right-0 w-[280px] h-[280px] opacity-30 dark:opacity-40"
        viewBox="0 0 280 280"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ transform: 'scaleX(-1)' }}
      >
        <g stroke="rgba(160,130,200,1)" strokeLinecap="round">
          <path d="M0 0 Q30 25 55 70 Q60 85 50 110 Q45 130 55 150" strokeWidth="2.2" />
          <path d="M55 70 Q70 60 95 55 Q110 52 125 60" strokeWidth="1.6" />
          <path d="M50 110 Q35 120 25 140 Q20 155 28 170" strokeWidth="1.3" />
          <path d="M55 150 Q65 165 60 185" strokeWidth="1.1" />
          <path d="M95 55 Q115 48 135 55 Q148 60 155 75" strokeWidth="1.1" />
          <path d="M0 30 Q20 45 35 75 Q40 90 35 108" strokeWidth="1.8" />
          <path d="M35 75 Q50 70 70 72 Q85 74 95 85" strokeWidth="1.2" />
          <path d="M0 80 Q18 90 28 115" strokeWidth="1.4" />
          <path d="M30 0 Q45 30 50 55" strokeWidth="1.5" />
        </g>
      </svg>

      {/* Bottom-left branches */}
      <svg
        className="absolute bottom-0 left-0 w-[260px] h-[260px] opacity-25 dark:opacity-35"
        viewBox="0 0 260 260"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ transform: 'scaleY(-1)' }}
      >
        <g stroke="rgba(160,130,200,1)" strokeLinecap="round">
          <path d="M0 0 Q25 30 50 65 Q55 80 48 100 Q42 118 50 140" strokeWidth="2.0" />
          <path d="M50 65 Q65 55 88 52 Q105 50 118 58" strokeWidth="1.4" />
          <path d="M48 100 Q32 112 22 135" strokeWidth="1.2" />
          <path d="M0 40 Q22 55 38 85 Q42 98 36 115" strokeWidth="1.6" />
          <path d="M38 85 Q55 78 72 80" strokeWidth="1.0" />
          <path d="M0 90 Q15 100 25 120" strokeWidth="1.2" />
        </g>
      </svg>

      {/* Bottom-right branches (mirrored) */}
      <svg
        className="absolute bottom-0 right-0 w-[260px] h-[260px] opacity-25 dark:opacity-35"
        viewBox="0 0 260 260"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ transform: 'scale(-1, -1)' }}
      >
        <g stroke="rgba(160,130,200,1)" strokeLinecap="round">
          <path d="M0 0 Q25 30 50 65 Q55 80 48 100 Q42 118 50 140" strokeWidth="2.0" />
          <path d="M50 65 Q65 55 88 52 Q105 50 118 58" strokeWidth="1.4" />
          <path d="M48 100 Q32 112 22 135" strokeWidth="1.2" />
          <path d="M0 40 Q22 55 38 85 Q42 98 36 115" strokeWidth="1.6" />
          <path d="M38 85 Q55 78 72 80" strokeWidth="1.0" />
        </g>
      </svg>

      {/* Left edge accent */}
      <svg
        className="absolute left-0 top-1/3 w-[80px] h-[120px] opacity-20 dark:opacity-30"
        viewBox="0 0 80 120"
        fill="none"
      >
        <g stroke="rgba(160,130,200,1)" strokeLinecap="round">
          <path d="M0 60 Q20 55 35 40 Q45 32 55 35" strokeWidth="1.3" />
          <path d="M0 65 Q18 70 30 85 Q38 95 50 95" strokeWidth="1.1" />
          <path d="M35 40 Q42 28 52 22" strokeWidth="0.8" />
        </g>
      </svg>

      {/* Right edge accent */}
      <svg
        className="absolute right-0 top-1/3 w-[80px] h-[120px] opacity-20 dark:opacity-30"
        viewBox="0 0 80 120"
        fill="none"
        style={{ transform: 'scaleX(-1)' }}
      >
        <g stroke="rgba(160,130,200,1)" strokeLinecap="round">
          <path d="M0 60 Q20 55 35 40 Q45 32 55 35" strokeWidth="1.3" />
          <path d="M0 65 Q18 70 30 85 Q38 95 50 95" strokeWidth="1.1" />
          <path d="M35 40 Q42 28 52 22" strokeWidth="0.8" />
        </g>
      </svg>
    </div>
  )
}
