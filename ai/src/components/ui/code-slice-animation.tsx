'use client'
import { useEffect, useRef, useState, useCallback, useMemo, forwardRef, useImperativeHandle } from 'react'
import { gsap } from 'gsap'

const COLS = 10
const ROWS = 7
const TOTAL_TILES = COLS * ROWS

function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

// The hero page content — rendered once, clipped by each tile
function HeroPage() {
  return (
    <div
      className="w-full h-full relative overflow-hidden"
      style={{
        background: `
          radial-gradient(ellipse 80% 60% at 30% 40%, #e4d4ff 0%, transparent 70%),
          radial-gradient(ellipse 60% 50% at 80% 30%, #d4c0ff 0%, transparent 60%),
          radial-gradient(ellipse 40% 40% at 60% 70%, #e8daff 0%, transparent 50%),
          linear-gradient(180deg, #ece0ff 0%, #f0e8ff 40%, #f8f4ff 80%, #fafafa 100%)
        `,
      }}
    >
      {/* Dot grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.4]"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(0,0,0,0.04) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />

      {/* Content container — mirrors the real hero layout */}
      <div className="relative h-full flex flex-col justify-center px-[8%] sm:px-[10%] lg:px-[12%]">
        {/* Eyebrow badge */}
        <div className="flex items-center gap-2 mb-6">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-purple-300/40 bg-purple-50">
            <svg className="w-3 h-3 text-purple-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
            </svg>
            <span className="text-[11px] sm:text-xs tracking-wide font-medium text-purple-600">
              Enterprise Voice AI
            </span>
          </div>
        </div>

        {/* Heading */}
        <h1
          className="text-[clamp(2rem,5.5vw,4.5rem)] font-bold tracking-tight text-zinc-900 leading-[1.05] max-w-4xl"
          style={{ fontFamily: 'var(--font-geist-sans, system-ui)' }}
        >
          AI Voice Agents for{' '}
          <span
            style={{
              background: 'linear-gradient(135deg, #a78bfa 0%, #7c3aed 50%, #6d28d9 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Enterprise-Scale
          </span>{' '}
          Phone Automation
        </h1>

        {/* Subtext */}
        <p className="mt-5 text-sm sm:text-base lg:text-lg text-zinc-600 max-w-2xl leading-relaxed">
          Deploy human-like voice AI agents that handle thousands of calls
          simultaneously. Build, evaluate, launch, and learn — all from one
          platform.
        </p>

        {/* CTAs */}
        <div className="mt-7 flex flex-wrap items-center gap-3">
          <div
            className="px-6 py-2.5 rounded-full text-sm font-semibold text-white flex items-center gap-2"
            style={{
              background: 'linear-gradient(135deg, #7c3aed, #5b21b6)',
              boxShadow: '0 4px 24px rgba(124,58,237,0.35), 0 0 60px rgba(124,58,237,0.1)',
            }}
          >
            Start Now
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </div>
          <div className="px-6 py-2.5 rounded-full text-sm font-semibold text-purple-700 border border-purple-200 bg-purple-50">
            Contact Sales
          </div>
        </div>

        {/* Stats row */}
        <div className="mt-12 flex items-center gap-8 sm:gap-12">
          {[
            { value: '10K+', label: 'Calls / Day' },
            { value: '99.9%', label: 'Uptime' },
            { value: '<300ms', label: 'Latency' },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <div
                className="text-xl sm:text-2xl font-bold text-zinc-900"
                style={{ fontFamily: 'var(--font-geist-sans, system-ui)' }}
              >
                {stat.value}
              </div>
              <div className="text-[9px] sm:text-[10px] text-zinc-400 uppercase tracking-[0.15em] mt-0.5">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export interface CodeSliceAnimationHandle {
  triggerExit: () => void
}

export const CodeSliceAnimation = forwardRef<CodeSliceAnimationHandle>(function CodeSliceAnimation(_, ref) {
  const containerRef = useRef<HTMLDivElement>(null)
  const tilesRef = useRef<(HTMLDivElement | null)[]>([])
  const mouseRef = useRef({ x: -1, y: -1 })
  const rafRef = useRef<number>(0)
  const [entered, setEntered] = useState(false)
  const exitingRef = useRef(false)
  const [exiting, setExiting] = useState(false)

  // Pre-compute tile positions for clip offsets
  const tilePositions = useMemo(() =>
    Array.from({ length: TOTAL_TILES }).map((_, i) => ({
      row: Math.floor(i / COLS),
      col: i % COLS,
      leftPct: (i % COLS) * (100 / COLS),
      topPct: Math.floor(i / COLS) * (100 / ROWS),
    })),
    []
  )

  // Expose exit animation to parent
  useImperativeHandle(ref, () => ({
    triggerExit: () => {
      exitingRef.current = true
      setExiting(true)
      cancelAnimationFrame(rafRef.current)

      // Explode cubes TOWARD camera — they rush at you and spread outward
      tilesRef.current.forEach((tile, i) => {
        if (!tile) return
        const { col, row } = tilePositions[i]
        const seed = i * 11 + 7

        // Direction from center — spread outward
        const cx = (col + 0.5) / COLS - 0.5
        const cy = (row + 0.5) / ROWS - 0.5
        const dist = Math.sqrt(cx * cx + cy * cy) || 0.1

        // Fly toward camera (positive Z) + spread on X/Y
        const flyX = cx / dist * (200 + seededRandom(seed) * 400)
        const flyY = cy / dist * (150 + seededRandom(seed + 1) * 300)
        const flyZ = 600 + seededRandom(seed + 2) * 1200
        const rotX = (seededRandom(seed + 3) - 0.5) * 120
        const rotY = (seededRandom(seed + 4) - 0.5) * 120
        const delay = seededRandom(seed + 5) * 0.1

        gsap.to(tile, {
          x: flyX, y: flyY, z: flyZ,
          rotateX: rotX, rotateY: rotY,
          opacity: 0, scale: 1.5,
          duration: 1.2, ease: 'power2.in',
          delay,
        })
      })
    },
  }), [tilePositions])

  // Scatter → assemble animation
  useEffect(() => {
    const tl = gsap.timeline({
      delay: 0.1,
      onComplete: () => setEntered(true),
    })

    tilesRef.current.forEach((tile, i) => {
      if (!tile) return
      const seed = i * 7 + 3
      const scatterX = (seededRandom(seed) - 0.5) * 1200
      const scatterY = (seededRandom(seed + 1) - 0.5) * 900
      const scatterZ = seededRandom(seed + 2) * 600 - 300
      const rotX = (seededRandom(seed + 3) - 0.5) * 80
      const rotY = (seededRandom(seed + 4) - 0.5) * 80
      const delay = 0.012 * i + seededRandom(seed + 6) * 0.1

      gsap.set(tile, {
        x: scatterX, y: scatterY, z: scatterZ,
        rotateX: rotX, rotateY: rotY,
        opacity: 0, scale: 0.8,
      })

      tl.to(tile, {
        x: 0, y: 0, z: 0,
        rotateX: 0, rotateY: 0,
        opacity: 1, scale: 1,
        duration: 1.4, ease: 'power3.out',
      }, delay)
    })

    return () => { tl.kill() }
  }, [])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!containerRef.current || exitingRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    mouseRef.current = {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    }
  }, [])

  // Hover: tiles push AWAY from cursor — STRONGER reaction
  useEffect(() => {
    if (!entered) return
    const container = containerRef.current
    if (!container) return
    container.addEventListener('mousemove', handleMouseMove)

    const animate = () => {
      if (exitingRef.current) return
      const { x: mx, y: my } = mouseRef.current

      tilesRef.current.forEach((tile, i) => {
        if (!tile) return
        const { col, row } = tilePositions[i]
        const tileCX = (col + 0.5) / COLS
        const tileCY = (row + 0.5) / ROWS
        const dx = tileCX - mx
        const dy = tileCY - my
        const dist = Math.sqrt(dx * dx + dy * dy)

        // Larger radius + stronger multipliers
        const maxRadius = 0.45
        const proximity = Math.max(0, 1 - dist / maxRadius)
        const strength = proximity * proximity // quadratic for snappier reaction

        // Much stronger push
        const pushX = dx * strength * 120
        const pushY = dy * strength * 120
        const pushZ = strength * 80
        const tiltX = dy * strength * -25
        const tiltY = dx * strength * 25

        gsap.to(tile, {
          x: pushX, y: pushY, z: pushZ,
          rotateX: tiltX, rotateY: tiltY,
          duration: 0.4, ease: 'power2.out', overwrite: 'auto',
        })
      })

      rafRef.current = requestAnimationFrame(animate)
    }

    rafRef.current = requestAnimationFrame(animate)
    return () => {
      container.removeEventListener('mousemove', handleMouseMove)
      cancelAnimationFrame(rafRef.current)
    }
  }, [entered, handleMouseMove, tilePositions])

  // Reset on leave
  useEffect(() => {
    if (!entered) return
    const container = containerRef.current
    if (!container) return

    const handleLeave = () => {
      if (exitingRef.current) return
      mouseRef.current = { x: -1, y: -1 }
      tilesRef.current.forEach((tile) => {
        if (!tile) return
        gsap.to(tile, {
          x: 0, y: 0, z: 0, rotateX: 0, rotateY: 0,
          duration: 0.6, ease: 'power2.out', overwrite: 'auto',
        })
      })
    }

    container.addEventListener('mouseleave', handleLeave)
    return () => container.removeEventListener('mouseleave', handleLeave)
  }, [entered])

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden"
      style={{ perspective: '1200px', background: exiting ? 'transparent' : '#f5f0ff' }}
    >
      {/* Tile grid — each tile clips a portion of the hero */}
      <div
        className="absolute inset-0"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${COLS}, 1fr)`,
          gridTemplateRows: `repeat(${ROWS}, 1fr)`,
          gap: '0px',
          transformStyle: 'preserve-3d',
        }}
      >
        {tilePositions.map(({ col, row }, i) => (
          <div
            key={i}
            ref={(el) => { tilesRef.current[i] = el }}
            className="relative overflow-hidden"
            style={{
              transformStyle: 'preserve-3d',
              willChange: 'transform',
            }}
          >
            {/* Full hero content, offset so this tile shows only its slice */}
            <div
              className="absolute"
              style={{
                width: `${COLS * 100}%`,
                height: `${ROWS * 100}%`,
                left: `${-col * 100}%`,
                top: `${-row * 100}%`,
              }}
            >
              <HeroPage />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
})
