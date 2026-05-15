'use client'

import { useState, useEffect } from 'react'
import { IntroScreen } from '@/components/IntroScreen'

interface PageWrapperProps {
  children: React.ReactNode
}

export function PageWrapper({ children }: PageWrapperProps) {
  const [showIntro, setShowIntro] = useState(false)
  const [introMounted, setIntroMounted] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const alreadyEntered = sessionStorage.getItem('dialix-intro-done')
    if (!alreadyEntered) {
      setShowIntro(true)
      setIntroMounted(true)
    }
    setMounted(true)
  }, [])

  const handleEnter = () => {
    sessionStorage.setItem('dialix-intro-done', '1')
    setShowIntro(false)
    // Keep intro mounted so cubes can finish their exit animation,
    // then unmount after animation completes
    setTimeout(() => setIntroMounted(false), 1500)
  }

  if (!mounted) return null

  return (
    <>
      {/* Main site content — ALWAYS visible, sits behind the z-9999 intro */}
      {children}

      {/* Intro overlay — fixed on top, stays mounted during exit animation */}
      {introMounted && (
        <IntroScreen onEnter={handleEnter} />
      )}
    </>
  )
}
