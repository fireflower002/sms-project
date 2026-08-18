'use client'

import React, { useEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Send,
  Edit3,
  Trash2,
  Check,
  X,
  Clock,
  Shield,
  Info,
  AlertCircle,
  Loader2,
  MessageSquare,
  Sparkles,
  UserCheck
} from 'lucide-react'
import { H } from '@/lib/honey'

export interface ChatMessage {
  id: string
  sender_id: string
  body: string
  created_at: string
  is_edited?: boolean
  updated_at?: string | null
  is_deleted?: boolean
  deleted_at?: string | null
  author?: {
    full_name?: string
    role?: string
    avatar_url?: string
  }
}

interface StaffChatProps {
  height?: string
  fullScreen?: boolean
}

// Format timestamp helper
function formatMessageTime(isoString: string): string {
  try {
    const d = new Date(isoString)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

// Date separator helper
function getDateLabel(isoString: string): string {
  try {
    const date = new Date(isoString)
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    const targetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())

    if (targetDate.getTime() === today.getTime()) {
      return 'Today'
    } else if (targetDate.getTime() === yesterday.getTime()) {
      return 'Yesterday'
    } else {
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
      })
    }
  } catch {
    return ''
  }
}

// Helper to format raw database rows safely
function formatRawMessage(m: any): ChatMessage {
  const rawAuthor = m.author || m.profiles
  const authorObj = Array.isArray(rawAuthor) ? rawAuthor[0] : rawAuthor
  return {
    id: m.id,
    sender_id: m.sender_id,
    body: m.body,
    created_at: m.created_at,
    is_edited: m.is_edited || false,
    updated_at: m.updated_at || null,
    is_deleted: m.is_deleted || false,
    deleted_at: m.deleted_at || null,
    author: {
      full_name: authorObj?.full_name || 'Staff Member',
      role: authorObj?.role || 'teacher',
    },
  }
}

export default function StaffChat({ height = 'calc(100vh - 200px)', fullScreen = false }: StaffChatProps) {
  const supabase = createClient()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [user, setUser] = useState<{ id: string; full_name?: string; role?: string } | null>(null)
  const [loadingInitial, setLoadingInitial] = useState(true)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Inline editing state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [editingSaving, setEditingSaving] = useState(false)

  // Deleting & Clear state
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showClearModal, setShowClearModal] = useState(false)
  const [clearing, setClearing] = useState(false)

  // Refs for scrolling
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const isFirstLoadRef = useRef(true)
  const prevScrollHeightRef = useRef(0)

  // 1. Fetch current authenticated user profile
  useEffect(() => {
    let mounted = true
    const initUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user && mounted) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, full_name, role')
            .eq('id', session.user.id)
            .maybeSingle()

          setUser({
            id: session.user.id,
            full_name: profile?.full_name || session.user.email || 'Staff Member',
            role: profile?.role || 'teacher',
          })
        }
      } catch (err: any) {
        console.error('Failed to get user profile:', err)
      }
    }
    initUser()
    return () => { mounted = false }
  }, [supabase])

  // 2. Fetch initial recent 35 messages
  const fetchInitialMessages = useCallback(async () => {
    setLoadingInitial(true)
    setError(null)
    try {
      const { data, error: fetchErr } = await supabase
        .from('hive_messages')
        .select('id, sender_id, body, created_at, profiles!sender_id(full_name, role)')
        .order('created_at', { ascending: false })
        .limit(35)

      if (fetchErr) {
        throw fetchErr
      } else {
        const formatted: ChatMessage[] = (data || []).map(formatRawMessage).reverse()
        setMessages(formatted)
        setHasMore(formatted.length === 35)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load chat history')
    } finally {
      setLoadingInitial(false)
    }
  }, [supabase])

  useEffect(() => {
    if (user) {
      fetchInitialMessages()
    }
  }, [user, fetchInitialMessages])

  const scrollToBottom = (smooth = false) => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto',
      })
    }
  }

  // 3. Scroll to bottom on initial load (strictly within container, never scrolling the page window)
  useEffect(() => {
    if (!loadingInitial && isFirstLoadRef.current && messages.length > 0) {
      scrollToBottom(false)
      isFirstLoadRef.current = false
    }
  }, [loadingInitial, messages])

  // 4. Lazy-load older messages on scroll near top
  const loadOlderMessages = async () => {
    if (loadingOlder || !hasMore || messages.length === 0) return

    setLoadingOlder(true)
    const oldestTimestamp = messages[0].created_at
    const container = messagesContainerRef.current
    if (container) {
      prevScrollHeightRef.current = container.scrollHeight
    }

    try {
      const { data, error: olderErr } = await supabase
        .from('hive_messages')
        .select('id, sender_id, body, created_at, profiles!sender_id(full_name, role)')
        .lt('created_at', oldestTimestamp)
        .order('created_at', { ascending: false })
        .limit(35)

      if (olderErr) {
        setHasMore(false)
      } else if (data && data.length > 0) {
        const older: ChatMessage[] = data.map(formatRawMessage).reverse()
        setMessages((prev) => [...older, ...prev])
        setHasMore(data.length === 35)
      } else {
        setHasMore(false)
      }
    } catch (err: any) {
      console.error('Failed to load older messages:', err)
    } finally {
      setLoadingOlder(false)
      // Maintain scroll position after prepending older messages
      requestAnimationFrame(() => {
        if (container) {
          const newScrollHeight = container.scrollHeight
          container.scrollTop = newScrollHeight - prevScrollHeightRef.current
        }
      })
    }
  }

  const handleScroll = () => {
    const container = messagesContainerRef.current
    if (!container) return
    if (container.scrollTop < 60 && hasMore && !loadingOlder && !loadingInitial) {
      loadOlderMessages()
    }
  }

  // 5. Supabase Realtime Subscription (INSERT, UPDATE, DELETE)
  useEffect(() => {
    if (!user) return

    const channel = supabase
      .channel('public:hive_messages')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'hive_messages' },
        async (payload) => {
          const newMsg = payload.new as any

          // Check if message is already in state
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev

            // Fetch profile for sender
            supabase
              .from('profiles')
              .select('full_name, role')
              .eq('id', newMsg.sender_id)
              .maybeSingle()
              .then(({ data: profile }) => {
                const formattedMsg: ChatMessage = {
                  id: newMsg.id,
                  sender_id: newMsg.sender_id,
                  body: newMsg.body,
                  created_at: newMsg.created_at,
                  is_edited: newMsg.is_edited || false,
                  updated_at: newMsg.updated_at,
                  is_deleted: newMsg.is_deleted || false,
                  deleted_at: newMsg.deleted_at,
                  author: {
                    full_name: profile?.full_name || 'Staff Member',
                    role: profile?.role || 'teacher',
                  },
                }

                setMessages((current) => {
                  if (current.some((m) => m.id === formattedMsg.id)) return current
                  return [...current, formattedMsg]
                })

                // Auto-scroll to bottom on new incoming message
                setTimeout(() => {
                  scrollToBottom(true)
                }, 50)
              })

            return prev
          })
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'hive_messages' },
        (payload) => {
          const updated = payload.new as any
          setMessages((prev) =>
            prev.map((m) =>
              m.id === updated.id
                ? {
                    ...m,
                    body: updated.body,
                    is_edited: updated.is_edited ?? m.is_edited,
                    updated_at: updated.updated_at ?? m.updated_at,
                    is_deleted: updated.is_deleted ?? m.is_deleted,
                    deleted_at: updated.deleted_at ?? m.deleted_at,
                  }
                : m
            )
          )
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'hive_messages' },
        (payload) => {
          const deletedId = payload.old?.id
          if (deletedId) {
            setMessages((prev) => prev.filter((m) => m.id !== deletedId))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, supabase])

  // 6. Send Message
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || !user || sending) return

    const content = newMessage.trim()
    setNewMessage('')
    setSending(true)
    setError(null)

    try {
      const { error: insertErr } = await supabase
        .from('hive_messages')
        .insert({ sender_id: user.id, body: content })

      if (insertErr) {
        setError(insertErr.message)
        setNewMessage(content)
      } else {
        setTimeout(() => {
          scrollToBottom(true)
        }, 100)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to send message')
      setNewMessage(content)
    } finally {
      setSending(false)
    }
  }

  // 7. Edit Message
  const startEditing = (msg: ChatMessage) => {
    setEditingId(msg.id)
    setEditText(msg.body)
  }

  const cancelEditing = () => {
    setEditingId(null)
    setEditText('')
  }

  const saveEdit = async (msgId: string) => {
    if (!editText.trim() || editingSaving) return
    setEditingSaving(true)
    const nowIso = new Date().toISOString()
    const trimmed = editText.trim()

    try {
      const { error: updateErr } = await supabase
        .from('hive_messages')
        .update({
          body: trimmed,
          is_edited: true,
          updated_at: nowIso,
        })
        .eq('id', msgId)

      if (updateErr) {
        setError(`Edit failed: ${updateErr.message}`)
      } else {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === msgId ? { ...m, body: trimmed, is_edited: true, updated_at: nowIso } : m
          )
        )
        setEditingId(null)
        setEditText('')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to edit message')
    } finally {
      setEditingSaving(false)
    }
  }

  // 8. Delete Message (Permanent DB deletion via server API)
  const handleDelete = async (msgId: string) => {
    setDeletingId(msgId)

    try {
      const res = await fetch('/api/chat/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'single', messageId: msgId }),
      })
      const data = await res.json()

      if (!res.ok || data.error) {
        setError(`Delete failed: ${data.error || 'Server error'}`)
      } else {
        setMessages((prev) => prev.filter((m) => m.id !== msgId))
      }
    } catch (err: any) {
      setError(err.message || 'Failed to delete message')
    } finally {
      setDeletingId(null)
    }
  }

  // 9. Clear Chat Functions (Permanent DB deletion via server API)
  const handleClearMyMessages = async () => {
    if (!user) return
    setClearing(true)
    try {
      const res = await fetch('/api/chat/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'my_messages' }),
      })
      const data = await res.json()

      if (!res.ok || data.error) {
        setError(`Failed to clear your messages: ${data.error || 'Server error'}`)
      } else {
        setMessages((prev) => prev.filter((m) => m.sender_id !== user.id))
        setShowClearModal(false)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to clear messages')
    } finally {
      setClearing(false)
    }
  }

  const handleClearAllMessages = async () => {
    if (user?.role !== 'admin') return
    setClearing(true)
    try {
      const res = await fetch('/api/chat/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'all_messages' }),
      })
      const data = await res.json()

      if (!res.ok || data.error) {
        setError(`Failed to clear channel: ${data.error || 'Server error'}`)
      } else {
        setMessages([])
        setShowClearModal(false)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to clear channel')
    } finally {
      setClearing(false)
    }
  }

  if (!user) {
    return (
      <div style={styles.skeletonContainer(height)}>
        <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', color: H.accent }} />
        <span style={{ fontSize: '14px', color: H.textMuted }}>Loading Staff Channel...</span>
      </div>
    )
  }

  // Group messages by Date
  const groupedMessages: { dateLabel: string; msgs: ChatMessage[] }[] = []
  let currentDateLabel = ''

  messages.forEach((msg) => {
    const label = getDateLabel(msg.created_at)
    if (label !== currentDateLabel) {
      currentDateLabel = label
      groupedMessages.push({ dateLabel: label, msgs: [msg] })
    } else {
      groupedMessages[groupedMessages.length - 1].msgs.push(msg)
    }
  })

  return (
    <div style={styles.chatWrapper(height, fullScreen)}>
      {/* Top Bar Header */}
      <div className="staff-chat-header" style={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={styles.headerIconWrapper}>
            <MessageSquare size={18} color="#18181B" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h2 style={styles.headerTitle}>Staff Communication Channel</h2>
              <span style={styles.liveBadge}>
                <span style={styles.livePulse} /> Live Realtime
              </span>
            </div>
            <p style={styles.headerSubtitle}>
              Shared chat for all Teachers & Admins
            </p>
          </div>
        </div>

        {/* Header Right Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={styles.retentionBanner}>
            <Info size={13} color="#71717A" />
            <span>Messages kept <strong>30 days</strong></span>
          </div>

          <button
            onClick={() => setShowClearModal(true)}
            title="Clear chat history"
            type="button"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '8px',
              border: '1px solid #FECACA',
              backgroundColor: '#FEF2F2',
              color: '#DC2626',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <Trash2 size={13} /> Clear Chat
          </button>
        </div>
      </div>

      {/* Messages Container */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        style={styles.messagesContainer}
      >
        {/* Loading older messages indicator */}
        {loadingOlder && (
          <div style={styles.loaderTop}>
            <Loader2 size={16} style={{ animation: 'spin 1s linear infinite', color: H.accent }} />
            <span>Loading older messages...</span>
          </div>
        )}

        {!hasMore && messages.length > 0 && (
          <div style={styles.historyStartNote}>
            Beginning of Staff Channel history
          </div>
        )}

        {/* Skeleton loading state */}
        {loadingInitial ? (
          <div style={styles.skeletonList}>
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                style={{
                  ...styles.skeletonBubble,
                  alignSelf: i % 2 === 0 ? 'flex-end' : 'flex-start',
                  width: `${30 + (i * 12)}%`,
                }}
              />
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={styles.emptyIconCircle}>
              <Sparkles size={24} color="#18181B" />
            </div>
            <h3 style={{ margin: '0 0 6px', fontSize: '15px', fontWeight: 600, color: H.textPrimary }}>
              Welcome to Staff Channel!
            </h3>
            <p style={{ margin: 0, fontSize: '13px', color: H.textMuted, maxWidth: '320px', lineHeight: 1.4 }}>
              Start the discussion with fellow teachers and administrators. All staff will see updates live.
            </p>
          </div>
        ) : (
          groupedMessages.map((group, gIdx) => (
            <React.Fragment key={gIdx}>
              {/* Date Header Divider */}
              <div style={styles.dateSeparator}>
                <span style={styles.dateBadge}>{group.dateLabel}</span>
              </div>

              {group.msgs.map((msg) => {
                const isSelf = msg.sender_id === user.id
                const isAdmin = user.role === 'admin'
                const canEdit = isSelf && !msg.is_deleted
                const canDelete = (isSelf || isAdmin) && !msg.is_deleted
                const isEditing = editingId === msg.id

                return (
                  <div
                    key={msg.id}
                    style={{
                      ...styles.messageRow,
                      justifyContent: isSelf ? 'flex-end' : 'flex-start',
                    }}
                  >
                    {/* Avatar for non-self messages */}
                    {!isSelf && (
                      <div
                        style={{
                          ...styles.avatar,
                          backgroundColor: msg.author?.role === 'admin' ? '#18181B' : '#F4F4F5',
                          color: msg.author?.role === 'admin' ? '#FFFFFF' : '#18181B',
                        }}
                      >
                        {msg.author?.full_name?.charAt(0).toUpperCase() || '?'}
                      </div>
                    )}

                    {/* Message Bubble Box */}
                    <div
                      className="staff-chat-bubble"
                      style={{
                        ...styles.bubble,
                        ...(isSelf ? styles.bubbleSelf : styles.bubbleOther),
                        opacity: msg.is_deleted ? 0.7 : 1,
                      }}
                    >
                      {/* Sender Header for non-self */}
                      {!isSelf && (
                        <div style={styles.authorHeader}>
                          <span style={styles.authorName}>
                            {msg.author?.full_name || 'Staff Member'}
                          </span>
                          <span
                            style={{
                              ...styles.roleBadge,
                              backgroundColor: msg.author?.role === 'admin' ? '#18181B' : '#F4F4F5',
                              color: msg.author?.role === 'admin' ? '#FFFFFF' : '#71717A',
                            }}
                          >
                            {msg.author?.role === 'admin' ? (
                              <>
                                <Shield size={10} style={{ marginRight: '2px' }} /> Admin
                              </>
                            ) : (
                              'Teacher'
                            )}
                          </span>
                        </div>
                      )}

                      {/* Deleted Message rendering */}
                      {msg.is_deleted ? (
                        <div style={styles.deletedContent}>
                          <Trash2 size={13} style={{ color: H.textMuted }} />
                          <span style={{ fontStyle: 'italic', color: H.textMuted, fontSize: '13px' }}>
                            This message was deleted
                          </span>
                        </div>
                      ) : isEditing ? (
                        /* Inline Editing Form */
                        <div style={styles.editWrapper}>
                          <textarea
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            rows={2}
                            style={styles.editTextarea}
                            autoFocus
                          />
                          <div style={styles.editActions}>
                            <button
                              onClick={cancelEditing}
                              disabled={editingSaving}
                              style={styles.editCancelBtn}
                              type="button"
                            >
                              <X size={13} /> Cancel
                            </button>
                            <button
                              onClick={() => saveEdit(msg.id)}
                              disabled={!editText.trim() || editingSaving}
                              style={styles.editSaveBtn}
                              type="button"
                            >
                              {editingSaving ? (
                                <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
                              ) : (
                                <Check size={13} />
                              )}
                              Save
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* Message Content */
                        <div style={styles.messageText}>
                          {msg.body}
                        </div>
                      )}

                      {/* Footer: Time + Edited Badge + Actions */}
                      <div
                        style={{
                          ...styles.bubbleFooter,
                          justifyContent: isSelf ? 'flex-end' : 'flex-start',
                        }}
                      >
                        <span style={styles.timestamp}>
                          {formatMessageTime(msg.created_at)}
                        </span>

                        {msg.is_edited && !msg.is_deleted && (
                          <span style={styles.editedTag}>
                            • edited
                          </span>
                        )}

                        {/* Hover Action Buttons */}
                        {!msg.is_deleted && !isEditing && (canEdit || canDelete) && (
                          <div style={styles.actionButtons}>
                            {canEdit && (
                              <button
                                onClick={() => startEditing(msg)}
                                style={styles.actionIconBtn}
                                title="Edit message"
                                type="button"
                              >
                                <Edit3 size={12} />
                              </button>
                            )}
                            {canDelete && (
                              <button
                                onClick={() => handleDelete(msg.id)}
                                disabled={deletingId === msg.id}
                                style={{
                                  ...styles.actionIconBtnDelete,
                                  color: isSelf ? 'rgba(255, 255, 255, 0.9)' : '#7F1D1D',
                                }}
                                title={isAdmin && !isSelf ? "Delete message (Admin moderation)" : "Delete message"}
                                type="button"
                              >
                                {deletingId === msg.id ? (
                                  <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
                                ) : (
                                  <Trash2 size={12} />
                                )}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </React.Fragment>
          ))
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Error alert toast */}
      {error && (
        <div style={styles.errorAlert}>
          <AlertCircle size={15} />
          <span style={{ flex: 1 }}>{error}</span>
          <button onClick={() => setError(null)} style={styles.errorCloseBtn} type="button">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Message Input Form */}
      <form onSubmit={handleSend} className="staff-chat-input-form" style={styles.inputForm}>
        <div style={{ flex: '1 1 auto', minWidth: 0, position: 'relative' }}>
          <input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onFocus={() => {
              if (typeof window !== 'undefined') window.scrollTo(0, 0)
              setTimeout(() => {
                if (typeof window !== 'undefined') window.scrollTo(0, 0)
                scrollToBottom(true)
              }, 150)
            }}
            placeholder="Type a message to staff..."
            disabled={sending}
            style={styles.textInput}
          />
        </div>
        <button
          type="submit"
          disabled={!newMessage.trim() || sending}
          style={{
            ...styles.sendBtn,
            opacity: !newMessage.trim() || sending ? 0.5 : 1,
            cursor: !newMessage.trim() || sending ? 'not-allowed' : 'pointer',
          }}
        >
          {sending ? (
            <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
          ) : (
            <Send size={16} />
          )}
        </button>
      </form>

      <style>{`
        @media (max-width: 767px) {
          .staff-chat-header {
            padding: 10px 12px !important;
            gap: 8px !important;
          }
          .staff-chat-input-form {
            padding: 10px 12px !important;
            gap: 8px !important;
          }
          .staff-chat-input-form input {
            font-size: 16px !important;
          }
          .staff-chat-bubble {
            max-width: 86% !important;
          }
        }
      `}</style>

      {/* Clear Chat Confirmation Modal */}
      {showClearModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '16px',
          }}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              border: `1px solid ${H.border}`,
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              maxWidth: '440px',
              width: '100%',
              padding: '24px',
              boxSizing: 'border-box',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  backgroundColor: '#FEF2F2',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#DC2626',
                  flexShrink: 0,
                }}
              >
                <Trash2 size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 800, color: H.textPrimary, margin: 0 }}>
                  Clear Chat History
                </h3>
                <p style={{ fontSize: '12px', color: H.textSec, margin: '2px 0 0 0' }}>
                  Select how you want to clear chat messages:
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', margin: '20px 0' }}>
              <button
                onClick={handleClearMyMessages}
                disabled={clearing}
                type="button"
                style={{
                  padding: '12px 16px',
                  borderRadius: '10px',
                  border: `1px solid ${H.border}`,
                  backgroundColor: H.bg,
                  color: H.textPrimary,
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  textAlign: 'left',
                }}
              >
                <div>
                  <div>Clear My Messages</div>
                  <div style={{ fontSize: '11px', fontWeight: 400, color: H.textMuted }}>
                    Deletes all messages sent by your account from the staff channel
                  </div>
                </div>
                {clearing && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
              </button>

              {user?.role === 'admin' && (
                <button
                  onClick={handleClearAllMessages}
                  disabled={clearing}
                  type="button"
                  style={{
                    padding: '12px 16px',
                    borderRadius: '10px',
                    border: '1px solid #FECACA',
                    backgroundColor: '#FEF2F2',
                    color: '#7F1D1D',
                    fontWeight: 700,
                    fontSize: '13px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    textAlign: 'left',
                  }}
                >
                  <div>
                    <div>Clear Entire Channel (Admin)</div>
                    <div style={{ fontSize: '11px', fontWeight: 400, color: '#7F1D1D' }}>
                      Deletes all staff messages for all accounts in the system
                    </div>
                  </div>
                  {clearing && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
                </button>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowClearModal(false)}
                disabled={clearing}
                type="button"
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: `1px solid ${H.border}`,
                  backgroundColor: '#FFFFFF',
                  color: H.textSec,
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Inline Style Object adhering to Honey H token redesign aesthetics
const styles = {
  chatWrapper: (height: string, fullScreen: boolean): React.CSSProperties => ({
    display: 'flex',
    flexDirection: 'column',
    height: fullScreen ? '100%' : (height || '100%'),
    maxHeight: '100%',
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: H.radius['2xl'],
    border: `1px solid ${H.border}`,
    boxShadow: H.shadows.lg,
    overflow: 'hidden',
    position: 'relative',
    fontFamily: H.font,
  }),

  header: {
    padding: `${H.spacing.md} ${H.spacing.xl}`,
    borderBottom: `1px solid ${H.border}`,
    backgroundColor: '#FFFFFF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap' as const,
    gap: H.spacing.md,
    flexShrink: 0,
  },

  headerIconWrapper: {
    width: H.targetSizes.buttonSm,
    height: H.targetSizes.buttonSm,
    borderRadius: H.radius.lg,
    backgroundColor: '#F4F4F5',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerTitle: {
    margin: 0,
    fontSize: H.fontSize.lg,
    fontWeight: H.fontWeight.bold,
    color: H.textPrimary,
    letterSpacing: '-0.01em',
  },

  headerSubtitle: {
    margin: '2px 0 0',
    fontSize: H.fontSize.sm,
    color: H.textMuted,
  },

  liveBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    fontSize: '11px',
    fontWeight: 600,
    color: '#059669',
    backgroundColor: '#D1FAE5',
    padding: '2px 8px',
    borderRadius: '12px',
  },

  livePulse: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    backgroundColor: '#10B981',
    boxShadow: '0 0 0 2px rgba(16, 185, 129, 0.2)',
  },

  retentionBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    backgroundColor: '#F4F4F5',
    border: `1px solid ${H.border}`,
    color: '#71717A',
    padding: '6px 12px',
    borderRadius: '20px',
    fontSize: '12px',
  },

  messagesContainer: {
    flex: '1 1 0%',
    minHeight: 0,
    overflowY: 'auto' as const,
    padding: '20px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
    backgroundColor: '#FAFAFA',
  },

  loaderTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '8px',
    fontSize: '12px',
    color: H.textMuted,
  },

  historyStartNote: {
    textAlign: 'center' as const,
    fontSize: '11px',
    color: H.textMuted,
    margin: '8px 0',
    fontStyle: 'italic',
  },

  skeletonContainer: (height: string): React.CSSProperties => ({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    height: height,
    backgroundColor: '#FFFFFF',
    borderRadius: '16px',
    border: `1px solid ${H.border}`,
  }),

  skeletonList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
    padding: '16px 0',
  },

  skeletonBubble: {
    height: '42px',
    backgroundColor: '#E5E7EB',
    borderRadius: '12px',
    animation: 'pulse 1.5s ease-in-out infinite',
  },

  emptyState: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center' as const,
    padding: '40px 20px',
    margin: 'auto 0',
  },

  emptyIconCircle: {
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    backgroundColor: '#F4F4F5',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '12px',
  },

  dateSeparator: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '12px 0 6px',
  },

  dateBadge: {
    fontSize: '11px',
    fontWeight: 600,
    color: '#71717A',
    backgroundColor: '#E4E4E7',
    padding: '3px 12px',
    borderRadius: '12px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.04em',
  },

  messageRow: {
    display: 'flex',
    gap: '10px',
    alignItems: 'flex-end',
    width: '100%',
  },

  avatar: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '700',
    fontSize: '13px',
    flexShrink: 0,
  },

  bubble: {
    maxWidth: '72%',
    padding: '10px 14px',
    borderRadius: '14px',
    position: 'relative' as const,
    wordBreak: 'break-word' as const,
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
    transition: 'all 0.15s ease',
  },

  bubbleSelf: {
    backgroundColor: '#18181B',
    color: '#FFFFFF',
    borderBottomRightRadius: '2px',
  },

  bubbleOther: {
    backgroundColor: '#FFFFFF',
    color: H.textPrimary,
    border: `1px solid ${H.border}`,
    borderBottomLeftRadius: '2px',
  },

  authorHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginBottom: '4px',
  },

  authorName: {
    fontSize: '12px',
    fontWeight: 700,
    color: H.textPrimary,
  },

  roleBadge: {
    fontSize: '10px',
    fontWeight: 600,
    padding: '1px 6px',
    borderRadius: '8px',
    display: 'inline-flex',
    alignItems: 'center',
  },

  messageText: {
    fontSize: '14px',
    lineHeight: 1.45,
    whiteSpace: 'pre-wrap' as const,
  },

  deletedContent: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '2px 0',
  },

  editWrapper: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
    width: '100%',
    minWidth: '180px',
  },

  editTextarea: {
    width: '100%',
    borderRadius: '8px',
    border: `1px solid ${H.border}`,
    padding: '6px 10px',
    fontSize: '13px',
    fontFamily: 'inherit',
    outline: 'none',
    resize: 'none' as const,
    backgroundColor: '#FFFFFF',
    color: H.textPrimary,
  },

  editActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '6px',
  },

  editCancelBtn: {
    background: 'none',
    border: 'none',
    color: H.textMuted,
    fontSize: '11px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '3px',
  },

  editSaveBtn: {
    backgroundColor: '#18181B',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '6px',
    padding: '3px 10px',
    fontSize: '11px',
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },

  bubbleFooter: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginTop: '4px',
  },

  timestamp: {
    fontSize: '10px',
    opacity: 0.75,
  },

  editedTag: {
    fontSize: '10px',
    fontStyle: 'italic',
    opacity: 0.7,
  },

  actionButtons: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    marginLeft: '6px',
  },

  actionIconBtn: {
    background: 'transparent',
    border: 'none',
    color: 'inherit',
    opacity: 0.7,
    cursor: 'pointer',
    padding: '2px',
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
  },

  actionIconBtnDelete: {
    background: 'transparent',
    border: 'none',
    color: '#DC2626',
    opacity: 0.75,
    cursor: 'pointer',
    padding: '2px',
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
  },

  errorAlert: {
    padding: '10px 16px',
    backgroundColor: '#FEF2F2',
    color: '#DC2626',
    borderTop: '1px solid #FECACA',
    fontSize: '13px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },

  errorCloseBtn: {
    background: 'none',
    border: 'none',
    color: '#DC2626',
    cursor: 'pointer',
    padding: '2px',
  },

  inputForm: {
    padding: '14px 20px',
    borderTop: `1px solid ${H.border}`,
    backgroundColor: '#FFFFFF',
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
    flexShrink: 0,
    boxSizing: 'border-box' as const,
    width: '100%',
  },

  textInput: {
    width: '100%',
    boxSizing: 'border-box' as const,
    height: '42px',
    padding: '0 16px',
    borderRadius: '12px',
    border: `1.5px solid ${H.border}`,
    backgroundColor: '#FAFAF8',
    color: H.textPrimary,
    fontSize: '14px',
    outline: 'none',
    fontFamily: 'inherit',
    transition: 'border-color 0.2s ease',
  },

  sendBtn: {
    width: '42px',
    height: '42px',
    minWidth: '42px',
    minHeight: '42px',
    borderRadius: '12px',
    backgroundColor: '#18181B',
    color: '#FFFFFF',
    border: 'none',
    fontWeight: '700',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    cursor: 'pointer',
    position: 'relative' as const,
    zIndex: 12,
    boxSizing: 'border-box' as const,
    transition: 'transform 0.1s ease',
  },
}
