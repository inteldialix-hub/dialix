'use client'

import { useState, useEffect } from 'react'
import { IntroScreen } from '@/components/IntroScreen'

interface PageWrapperProps {
  children: React.ReactNode
}

export function PageWrapper({ children }: PageWrapperProps) {
  // Check sessionStorage so the intro only shows once per browser session
  const [showIntro, setShowIntro] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const alreadyEntered = sessionStorage.getItem('dialix-intro-done')
    if (!alreadyEntered) {
      setShowIntro(true)
    }
    setMounted(true)
  }, [])

  const handleEnter = () => {
    sessionStorage.setItem('dialix-intro-done', '1')
    setShowIntro(false)
  }

  // Avoid flash: don't render until we know whether to show intro
  if (!mounted) return null

  return (
    <>
      {/* Intro overlay — renders on top of everything */}
      {showIntro && (
        <IntroScreen onEnter={handleEnter} />
      )}

      {/* Main site content — always in DOM so it's ready when intro fades */}
      <div
        className={`
          transition-opacity duration-500 ease-out
          ${showIntro ? 'opacity-0' : 'opacity-100'}
        `}
      >
        {children}
      </div>
    </>
  )
}
