'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Send, AlertCircle } from 'lucide-react'

interface HiveChatProps {
  compact?: boolean
  title?: string
  subtitle?: string
}

interface ChatMessage {
  id: string
  user_id: string
  content: string
  created_at: string
  full_name?: string
}

import { H } from '@/lib/honey'

// Design System Tokens
const colors = {
  primary_background: H.bg,
  card_background: H.surface,
  card_border: H.border,
  card_shadow: H.cardShadow,
  primary_accent: H.honey,
  primary_dark: H.chocolate,
  primary_light: H.accentLight,
  danger_background: H.dangerLight,
  danger_text: H.danger,
  danger_border: '#FECACA',
  text_primary: H.textPrimary,
  text_secondary: H.textSec,
  text_muted: H.textMuted,
  input_background: H.bg,
  input_border: H.border,
};

const styles = {
  container: (compact: boolean): React.CSSProperties => ({
    display: 'flex',
    flexDirection: 'column',
    height: compact ? '380px' : 'calc(100vh - 200px)',
    maxHeight: '600px',
    backgroundColor: colors.card_background,
    border: `1px solid ${colors.card_border}`,
    borderRadius: '16px',
    boxShadow: colors.card_shadow,
    overflow: 'hidden',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
  }),
  loading: { padding: '24px', textAlign: 'center' as const, color: colors.text_muted },
  messagesContainer: { flex: 1, overflowY: 'auto' as const, padding: '16px' },
  noMessages: { textAlign: 'center' as const, color: colors.text_muted, fontSize: '14px', marginTop: '20px' },
  message: { display: 'flex', gap: '12px', marginBottom: '16px' },
  avatar: {
    width: '32px', height: '32px', borderRadius: '50%', background: colors.primary_light,
    color: colors.primary_dark, display: 'flex', alignItems: 'center',
    justifyContent: 'center', fontWeight: '700', fontSize: '14px', flexShrink: 0
  },
  messageContent: { flex: 1 },
  messageHeader: { display: 'flex', gap: '8px', alignItems: 'baseline', marginBottom: '4px' },
  author: { fontSize: '14px', fontWeight: '700', color: colors.text_primary },
  timestamp: { fontSize: '11px', color: colors.text_muted },
  messageText: { fontSize: '14px', color: colors.text_secondary, lineHeight: 1.5, whiteSpace: 'pre-wrap' },
  form: { padding: '16px', borderTop: `1px solid ${colors.card_border}`, display: 'flex', gap: '12px' },
  inputWrapper: { position: 'relative', flex: 1 } as React.CSSProperties,
  input: (isFocused: boolean): React.CSSProperties => ({
    width: '100%',
    padding: '10px 16px',
    borderRadius: '10px',
    border: `2px solid ${isFocused ? colors.primary_accent : colors.input_border}`,
    background: colors.input_background,
    color: colors.text_primary,
    fontSize: '14px',
    outline: 'none',
    transition: 'border-color 0.2s ease',
  }),
  button: (disabled: boolean): React.CSSProperties => ({
    background: colors.primary_accent,
    color: colors.primary_dark,
    border: 'none',
    borderRadius: '12px',
    fontWeight: '700',
    fontSize: '14px',
    padding: '0 16px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    opacity: disabled ? 0.6 : 1,
    transition: 'opacity 0.2s ease',
  }),
  error: {
    padding: '12px 16px', background: colors.danger_background, color: colors.danger_text,
    fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px',
    borderTop: `1px solid ${colors.danger_border}`
  }
};

export default function HiveChat({ compact = false, title, subtitle }: HiveChatProps) {
  const supabase = createClient()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isInputFocused, setIsInputFocused] = useState(false)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: 'smooth',
      })
    }
  }

  useEffect(() => {
    const getUser = async () => {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('id,full_name').eq('id', user.id).maybeSingle()
        setUser({ ...user, full_name: profile?.full_name || user.email })
      }
      setLoading(false)
    }
    getUser()
  }, [])

  useEffect(() => {
    if (loading || !user) return;

    const fetchMessages = async () => {
      try {
        const { data, error } = await supabase
          .from('hive_messages')
          .select('id, sender_id, body, created_at, author:profiles!sender_id(full_name)')
          .order('created_at', { ascending: true })
          .limit(100)

        if (error) {
          console.error('[HiveChat] Error fetching messages:', error.message)
          setError('Could not load chat messages. Please try again.')
          return
        }

        const formatted = (data || []).map((m: any) => ({
          id: m.id,
          user_id: m.sender_id,
          content: m.body,
          created_at: m.created_at,
          full_name: m.author?.full_name || 'Staff Member',
        }))

        setMessages(formatted)
        setTimeout(scrollToBottom, 100)
      } catch (err: any) {
        console.error('[HiveChat] Unexpected fetch error:', err)
        setError('Could not load chat messages. Please try again.')
      }
    }

    fetchMessages()

    const channel = supabase
      .channel('public:hive_messages')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'hive_messages' },
        async (payload) => {
          const newMsg = payload.new as any
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', newMsg.sender_id)
            .maybeSingle()

          const formattedMsg: ChatMessage = {
            id: newMsg.id,
            user_id: newMsg.sender_id,
            content: newMsg.body,
            created_at: newMsg.created_at,
            full_name: profile?.full_name || 'Staff Member',
          }

          setMessages((prev) => [...prev, formattedMsg])
          setTimeout(scrollToBottom, 100)
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'hive_messages' },
        (payload) => {
          const deletedId = (payload.old as any)?.id
          if (deletedId) {
            setMessages((prev) => prev.filter((m) => m.id !== deletedId))
          } else {
            // Bulk clear event — re-fetch message list
            fetchMessages()
          }
        }
      )
      .subscribe();
      
    return () => { supabase.removeChannel(channel) }
  }, [loading, user])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || !user || sending) return

    setSending(true)
    setError(null)

    const content = newMessage.trim();
    setNewMessage('');

    const { error: insertError } = await supabase
      .from('hive_messages')
      .insert({ sender_id: user.id, body: content })

    if (insertError) {
      console.error('[HiveChat] Error sending message:', insertError.message)
      setError('Message failed to send. Please check your connection.');
      setNewMessage(content); // Restore message on failure
    }
    setSending(false)
  }

  const formatTime = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })

  if (loading) return <div style={styles.loading}>Loading Chat...</div>
  if (!user) return <div style={styles.loading}>You must be logged in to chat.</div>

  return (
    <div style={styles.container(compact)}>
      {(title || subtitle) && (
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${colors.card_border}`, background: colors.primary_background }}>
          {title && <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: colors.text_primary }}>{title}</h3>}
          {subtitle && <p style={{ margin: '2px 0 0', fontSize: '12px', color: colors.text_secondary }}>{subtitle}</p>}
        </div>
      )}
      <div ref={messagesContainerRef} style={styles.messagesContainer}>
        {messages.length === 0 ? (
          <div style={styles.noMessages}>No messages yet. Be the first to start the conversation!</div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} style={styles.message}>
              <div style={styles.avatar}>{msg.full_name?.charAt(0).toUpperCase() || '?'}</div>
              <div style={styles.messageContent}>
                <div style={styles.messageHeader}>
                  <span style={styles.author}>{msg.full_name}</span>
                  <span style={styles.timestamp}>{formatTime(msg.created_at)}</span>
                </div>
                <p style={styles.messageText}>{msg.content}</p>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {error && (
        <div style={styles.error}>
          <AlertCircle size={16} /> {error}
        </div>
      )}

      <form onSubmit={handleSend} style={styles.form}>
        <div style={styles.inputWrapper}>
          <input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onFocus={() => setIsInputFocused(true)}
            onBlur={() => setIsInputFocused(false)}
            placeholder="Type a message..."
            disabled={sending}
            style={styles.input(isInputFocused)}
          />
        </div>
        <button type="submit" disabled={!newMessage.trim() || sending} style={styles.button(!newMessage.trim() || sending)}>
          <Send size={16} />
        </button>
      </form>
    </div>
  )
}
