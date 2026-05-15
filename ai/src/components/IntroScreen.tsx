'use client'

import { CodeSliceAnimation, type CodeSliceAnimationHandle } from "@/components/ui/code-slice-animation"
import { useState, useEffect, useCallback, useRef } from 'react'

interface IntroScreenProps {
  onEnter: () => void
}

export function IntroScreen({ onEnter }: IntroScreenProps) {
  const [buttonVisible, setButtonVisible] = useState(false)
  const [isExiting, setIsExiting] = useState(false)
  const animRef = useRef<CodeSliceAnimationHandle>(null)

  // Fade in the enter button after the tiles assemble
  useEffect(() => {
    const timer = setTimeout(() => {
      setButtonVisible(true)
    }, 2800)

    return () => clearTimeout(timer)
  }, [])

  const handleEnter = useCallback(() => {
    if (isExiting) return
    setIsExiting(true)

    // Trigger the cube explosion
    animRef.current?.triggerExit()

    // After cubes fly out, reveal the main site
    setTimeout(() => {
      onEnter()
    }, 1400)
  }, [onEnter, isExiting])

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
      className={`fixed inset-0 w-full h-full overflow-hidden z-[9999] transition-colors duration-300 ${isExiting ? 'bg-transparent' : ''}`}
      style={isExiting ? undefined : { background: '#f5f0ff' }}
    >
      {/* Code Slice 3D Animation */}
      <div className="absolute inset-0">
        <CodeSliceAnimation ref={animRef} />
      </div>

      {/* Enter Button — fades out when exiting */}
      <div
        className={`
          absolute left-1/2 bottom-[15%] -translate-x-1/2 z-10
          flex flex-col items-center gap-4
          transition-all ease-out
          ${isExiting ? 'opacity-0 translate-y-4 duration-500' : buttonVisible ? 'opacity-100 translate-y-0 duration-[1500ms]' : 'opacity-0 translate-y-6 duration-[1500ms]'}
        `}
      >
        <button
          onClick={handleEnter}
          className="
            group relative text-white text-sm tracking-[0.12em] uppercase font-semibold
            transition-all duration-500 cursor-pointer
            hover:text-white
            px-8 py-3.5
          "
          aria-label="Enter the website"
        >
          {/* Backdrop pill */}
          <span
            className="absolute inset-0 rounded-full transition-all duration-300 group-hover:scale-105"
            style={{
              background: 'linear-gradient(135deg, #a78bfa 0%, #7c3aed 50%, #5b21b6 100%)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(167,139,250,0.3)',
              boxShadow: '0 4px 20px rgba(124,58,237,0.4), 0 0 40px rgba(124,58,237,0.15)',
            }}
          />

          <span className="relative flex items-center gap-2">
            <span>Enter</span>
            <span className="text-white/60 group-hover:text-white transition-colors">→</span>
          </span>
        </button>

        {/* Keyboard hint */}
        <div className="text-zinc-400 text-[10px] tracking-[0.2em] uppercase">
          or press ↵ enter
        </div>
      </div>
    </div>
  )
}
