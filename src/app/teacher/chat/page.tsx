'use client'

import React, { useEffect, useState } from 'react'
import StaffChat from '@/components/chat/StaffChat'
import { ComponentErrorBoundary } from '@/components/ui/ComponentErrorBoundary'
import { H } from '@/lib/honey'

export default function TeacherStaffChatPage() {
  const [viewportHeight, setViewportHeight] = useState<number | null>(null)
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const update = () => {
      const mobile = window.innerWidth < 768
      setIsMobile(mobile)

      if (window.visualViewport) {
        const vh = window.visualViewport.height
        setViewportHeight(vh)
        const keyboardOpen = mobile && vh < window.innerHeight - 120
        setIsKeyboardOpen(keyboardOpen)
        if (keyboardOpen) {
          window.scrollTo(0, 0)
        }
      } else {
        setIsKeyboardOpen(false)
      }
    }

    update()

    const handleVisualScroll = () => {
      window.scrollTo(0, 0)
      update()
    }

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', update)
      window.visualViewport.addEventListener('scroll', handleVisualScroll)
    }
    window.addEventListener('resize', update)

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', update)
        window.visualViewport.removeEventListener('scroll', handleVisualScroll)
      }
      window.removeEventListener('resize', update)
    }
  }, [])

  // Header in layout = 52px. Bottom Nav in mobile sidebar = 64px.
  const TOP_HEADER_HEIGHT = 52
  const BOTTOM_NAV_HEIGHT = 64

  const calcHeight = () => {
    if (!isMobile) return '100%'
    const navH = isKeyboardOpen ? 0 : BOTTOM_NAV_HEIGHT
    if (viewportHeight) {
      return `${Math.max(200, viewportHeight - TOP_HEADER_HEIGHT - navH - 12)}px`
    }
    return `calc(100dvh - ${TOP_HEADER_HEIGHT + navH + 12}px)`
  }

  return (
    <div
      style={{
        height: calcHeight(),
        maxHeight: calcHeight(),
        padding: isMobile ? '6px 8px 6px 8px' : `${H.spacing.lg} ${H.spacing['2xl']}`,
        boxSizing: 'border-box',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        transition: isMobile ? 'none' : H.motion.transitionFast,
      }}
    >
      <ComponentErrorBoundary sectionName="Staff Chat">
        <StaffChat height="100%" />
      </ComponentErrorBoundary>
    </div>
  )
}
