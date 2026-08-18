'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, Check, CheckCheck, Clock, ExternalLink } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { H } from '@/lib/honey'
import { ComponentErrorBoundary } from '@/components/ui/ComponentErrorBoundary'

export interface NotificationItem {
  id: string
  user_id: string
  type: string
  title: string
  body: string | null
  link: string | null
  is_read: boolean
  created_at: string
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState<number>(0)
  const [isOpen, setIsOpen] = useState<boolean>(false)
  const [loading, setLoading] = useState<boolean>(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const supabase = createClient()

  const fetchNotifications = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(15)

      if (error) {
        console.warn('[NotificationBell] error fetching notifications:', error.message)
        return
      }

      setNotifications(data || [])
      setUnreadCount((data || []).filter(n => !n.is_read).length)
    } catch (err) {
      console.warn('[NotificationBell] error:', err)
    }
  }

  useEffect(() => {
    fetchNotifications()

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleToggle = () => {
    if (!isOpen) {
      fetchNotifications()
    }
    setIsOpen(!isOpen)
  }

  const markAsRead = async (notif: NotificationItem) => {
    if (!notif.is_read) {
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n))
      setUnreadCount(prev => Math.max(0, prev - 1))
      await supabase.from('notifications').update({ is_read: true }).eq('id', notif.id)
    }
    if (notif.link) {
      setIsOpen(false)
      router.push(notif.link)
    }
  }

  const markAllAsRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    setUnreadCount(0)
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) {
      await supabase.from('notifications').update({ is_read: true }).eq('user_id', session.user.id).eq('is_read', false)
    }
  }

  const formatTimeAgo = (dateStr: string) => {
    try {
      const diff = (new Date().getTime() - new Date(dateStr).getTime()) / 1000
      if (diff < 60) return 'Just now'
      if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
      if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
      return `${Math.floor(diff / 86400)}d ago`
    } catch {
      return ''
    }
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={handleToggle}
        title="Notifications"
        style={{
          position: 'relative',
          background: isOpen ? H.accentLight : 'transparent',
          border: `1px solid ${isOpen ? H.accent : 'transparent'}`,
          borderRadius: '10px',
          padding: '8px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: isOpen ? H.accentDark : H.textSec,
          transition: 'all 0.15s ease',
        }}
      >
        <Bell size={19} />
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: '2px',
              right: '2px',
              backgroundColor: '#EF4444',
              color: '#FFFFFF',
              fontSize: '10.5px',
              fontWeight: 800,
              minWidth: '17px',
              height: '17px',
              borderRadius: '99px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 4px',
              border: '2px solid #FFFFFF',
              boxSizing: 'border-box',
            }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <ComponentErrorBoundary sectionName="Notifications Menu">
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              right: 0,
              width: '320px',
              maxWidth: '90vw',
              backgroundColor: H.surface,
              border: `1px solid ${H.border}`,
              borderRadius: '14px',
              boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
              zIndex: 1100,
              overflow: 'hidden',
              fontFamily: H.font,
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: '12px 16px',
                borderBottom: `1px solid ${H.border}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: H.bg,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontWeight: 800, fontSize: '14px', color: H.textPrimary }}>Notifications</span>
                {unreadCount > 0 && (
                  <span
                    style={{
                      backgroundColor: '#F4F4F5',
                      color: '#18181B',
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '2px 7px',
                      borderRadius: '6px',
                    }}
                  >
                    {unreadCount} new
                  </span>
                )}
              </div>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: H.accent,
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: 0,
                  }}
                >
                  <CheckCheck size={14} /> Mark all read
                </button>
              )}
            </div>

            {/* Body List */}
            <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
              {notifications.length === 0 ? (
                <div style={{ padding: '32px 16px', textAlign: 'center', color: H.textMuted, fontSize: '13px' }}>
                  <Bell size={24} style={{ opacity: 0.4, margin: '0 auto 8px', display: 'block' }} />
                  No notifications yet
                </div>
              ) : (
                notifications.map(n => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => markAsRead(n)}
                    aria-label={`Notification: ${n.title}. ${n.is_read ? 'Read' : 'Unread'}. Click to mark as read.`}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      background: 'none',
                      border: 'none',
                      borderBottom: `1px solid ${H.border}`,
                      backgroundColor: n.is_read ? H.surface : 'rgba(24, 24, 27, 0.04)',
                      cursor: 'pointer',
                      transition: 'background-color 0.15s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      padding: '12px 16px',
                      fontFamily: H.font,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {!n.is_read && (
                          <span
                            style={{
                              width: '7px',
                              height: '7px',
                              borderRadius: '50%',
                              backgroundColor: '#18181B',
                              display: 'inline-block',
                              flexShrink: 0,
                            }}
                          />
                        )}
                        <span style={{ fontWeight: n.is_read ? 600 : 800, fontSize: '13px', color: H.textPrimary }}>
                          {n.title}
                        </span>
                      </div>
                      <span style={{ fontSize: '11px', color: H.textMuted, whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {formatTimeAgo(n.created_at)}
                      </span>
                    </div>

                    {n.body && (
                      <p style={{ margin: 0, fontSize: '12px', color: H.textSec, lineHeight: '1.4' }}>
                        {n.body}
                      </p>
                    )}

                    {n.link && (
                      <span style={{ fontSize: '11px', color: H.accent, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '3px', marginTop: '2px' }}>
                        View details <ExternalLink size={10} />
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </ComponentErrorBoundary>
      )}
    </div>
  )
}
