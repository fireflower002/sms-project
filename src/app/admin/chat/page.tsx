'use client'

import React, { useEffect, useState } from 'react'
import StaffChat from '@/components/chat/StaffChat'
import { H } from '@/lib/honey'

export default function AdminStaffChatPage() {
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
        setIsKeyboardOpen(mobile && vh < window.innerHeight - 120)
      } else {
        setIsKeyboardOpen(false)
      }
    }

    update()

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', update)
      window.visualViewport.addEventListener('scroll', update)
    }
    window.addEventListener('resize', update)

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', update)
        window.visualViewport.removeEventListener('scroll', update)
      }
      window.removeEventListener('resize', update)
    }
  }, [])

  const paddingBottom = isMobile ? (isKeyboardOpen ? 4 : 76) : 16

  return (
    <div
      style={{
        height: viewportHeight ? `${viewportHeight}px` : '100vh',
        maxHeight: viewportHeight ? `${viewportHeight}px` : '100vh',
        padding: isMobile ? `8px 8px ${paddingBottom}px 8px` : '16px 24px',
        boxSizing: 'border-box',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        transition: 'padding-bottom 0.15s ease',
      }}
    >
      <StaffChat height="100%" />
    </div>
  )
}
