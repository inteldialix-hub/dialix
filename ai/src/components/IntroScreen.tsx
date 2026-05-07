'use client'

import { SpiralAnimation } from "@/components/ui/spiral-animation"
import { useState, useEffect, useCallback } from 'react'

interface IntroScreenProps {
  onEnter: () => void
}

export function IntroScreen({ onEnter }: IntroScreenProps) {
  const [buttonVisible, setButtonVisible] = useState(false)
  const [isExiting, setIsExiting] = useState(false)

  // Fade in the enter button after the animation loads
  useEffect(() => {
    const timer = setTimeout(() => {
      setButtonVisible(true)
    }, 2000)

    return () => clearTimeout(timer)
  }, [])

  const handleEnter = useCallback(() => {
    setIsExiting(true)
    // Wait for exit animation to complete before revealing main site
    setTimeout(() => {
      onEnter()
    }, 800)
  }, [onEnter])

  // Also allow keyboard Enter to trigger
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && buttonVisible && !isExiting) {
        handleEnter()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [buttonVisible, isExiting, handleEnter])

  return (
    <div
      className={`
        fixed inset-0 w-full h-full overflow-hidden bg-black z-[9999]
        transition-opacity duration-700 ease-out
        ${isExiting ? 'opacity-0 pointer-events-none' : 'opacity-100'}
      `}
    >
      {/* Galaxy Spiral Animation */}
      <div className="absolute inset-0">
        <SpiralAnimation />
      </div>

      {/* Subtle vignette overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.4) 100%)',
        }}
      />

      {/* Enter Button */}
      <div
        className={`
          absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10
          flex flex-col items-center gap-6
          transition-all duration-[1500ms] ease-out
          ${buttonVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}
        `}
      >
        {/* Brand name above Enter */}
        <div className="text-white/40 text-xs tracking-[0.4em] uppercase font-light">
          Dialix
        </div>

        <button
          onClick={handleEnter}
          className="
            group relative text-white text-2xl tracking-[0.2em] uppercase font-extralight
            transition-all duration-700 cursor-pointer
            hover:tracking-[0.35em]
          "
          aria-label="Enter the website"
        >
          {/* Glow effect behind text */}
          <span className="absolute inset-0 -inset-x-4 rounded-full bg-white/5 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

          {/* Pulsing dot */}
          <span className="absolute -left-6 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />

          <span className="relative">Enter</span>
        </button>

        {/* Keyboard hint */}
        <div className="text-white/20 text-[10px] tracking-[0.2em] uppercase mt-2">
          or press ↵ enter
        </div>
      </div>
    </div>
  )
}
