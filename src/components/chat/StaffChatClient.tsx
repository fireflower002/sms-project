'use client'

import React, { useEffect, useState } from 'react'
import StaffChat, { ChatMessage } from '@/components/chat/StaffChat'
import { ComponentErrorBoundary } from '@/components/ui/ComponentErrorBoundary'
import { H } from '@/lib/honey'

interface StaffChatClientProps {
  initialMessages?: ChatMessage[]
  initialUser?: { id: string; full_name?: string; role?: string } | null
  isTeacher?: boolean
}

export default function StaffChatClient({ initialMessages, initialUser, isTeacher = false }: StaffChatClientProps) {
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

  const TOP_HEADER_HEIGHT = 52
  const BOTTOM_NAV_HEIGHT = 64

  const calcHeight = () => {
    if (!isTeacher) {
      return isMobile ? (viewportHeight ? `${viewportHeight}px` : '100dvh') : '100%'
    }
    if (!isMobile) return '100%'
    const navH = isKeyboardOpen ? 0 : BOTTOM_NAV_HEIGHT
    if (viewportHeight) {
      return `${Math.max(200, viewportHeight - TOP_HEADER_HEIGHT - navH - 12)}px`
    }
    return `calc(100dvh - ${TOP_HEADER_HEIGHT + navH + 12}px)`
  }

  const paddingBottom = isMobile ? (isKeyboardOpen ? 4 : 76) : 16

  return (
    <div
      style={{
        height: calcHeight(),
        maxHeight: calcHeight(),
        padding: isTeacher
          ? (isMobile ? '6px 8px 6px 8px' : `${H.spacing.lg} ${H.spacing['2xl']}`)
          : (isMobile ? `${H.spacing.sm} ${H.spacing.sm} ${paddingBottom}px ${H.spacing.sm}` : `${H.spacing.lg} ${H.spacing['2xl']}`),
        boxSizing: 'border-box',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        transition: isMobile ? 'none' : H.motion.transitionFast,
      }}
    >
      <ComponentErrorBoundary sectionName="Staff Chat">
        <StaffChat height="100%" initialMessages={initialMessages} initialUser={initialUser} />
      </ComponentErrorBoundary>
    </div>
  )
}
