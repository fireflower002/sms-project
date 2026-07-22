"use client"
import React, { useState } from 'react'
import { Loader2, GraduationCap, KeyRound, Lock, MailCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { H, STYLE } from '@/lib/honey'
import { createStyles } from '@/lib/styles'

type Mode = 'login' | 'forgot'

export default function LoginForm({
  role,
  homePath,
  title,
}: {
  role: 'admin' | 'teacher'
  homePath: string
  title: string
}) {
  const supabase = createClient()

  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [isEmailFocused, setIsEmailFocused] = useState(false)
  const [isPassFocused, setIsPassFocused] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data: authData, error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (err) {
        setError(err.message || 'Invalid login credentials.')
        setLoading(false)
        return
      }

      const user = authData.user
      if (user) {
        // Fetch user profile role to auto-route to correct dashboard
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, must_change_password')
          .eq('id', user.id)
          .maybeSingle()

        const userRole = profile?.role || 'teacher'

        // Verify forced password change for teachers
        if (userRole === 'teacher') {
          const mustChange = profile?.must_change_password
          if (mustChange) {
            window.location.href = '/teacher/change-password'
            return
          }

          const { data: allowed } = await supabase
            .from('allowed_users')
            .select('is_registered')
            .eq('email', email.trim().toLowerCase())
            .maybeSingle()

          if (allowed && allowed.is_registered === false) {
            window.location.href = '/teacher/change-password'
            return
          }
        }

        // Auto-route based on actual role
        window.location.href = userRole === 'admin' ? '/admin' : '/teacher'
        return
      }

      window.location.href = homePath
    } catch (err: any) {
      setError(err?.message || 'Login failed. Please try again.')
      setLoading(false)
    }
  }

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (err) {
      setError(err.message)
    } else {
      setSent(true)
    }
    setLoading(false)
  }

  const styles = createStyles({
    page: {
      minHeight: '100vh',
      background: H.bg,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      fontFamily: H.font,
    },
    wrap: { width: '100%', maxWidth: 420 },
    header: { textAlign: 'center', marginBottom: 28 },
    logo: {
      width: 60, height: 60, borderRadius: 16,
      background: H.accentLight, border: `1px solid ${H.border}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 30, margin: '0 auto 12px',
      color: H.chocolate,
    },
    h1: { fontWeight: 800, fontSize: 22, color: H.textPrimary, margin: '0 0 4px' },
    sub: { fontSize: 13, color: H.muted, margin: 0 },
    card: {
      background: H.surface, border: `1px solid ${H.border}`,
      borderRadius: 16, boxShadow: '0 4px 12px rgba(0,0,0,0.06)', overflow: 'hidden',
    },
    tabs: { display: 'flex', borderBottom: `1px solid ${H.border}` },
    tab: {
      flex: 1, padding: '14px', fontFamily: H.font, fontWeight: 700,
      fontSize: 13, borderTop: 'none', borderLeft: 'none', borderRight: 'none',
      borderBottom: '2px solid transparent', cursor: 'pointer', transition: 'all 0.15s',
    },
    tabOn: { background: H.accentLight, color: H.chocolate, borderBottomColor: H.honey },
    tabOff: { background: H.bg, color: H.muted, borderBottomColor: 'transparent' },
    body: { padding: 24 },
    errBox: {
      padding: '10px 14px', borderRadius: 10,
      background: H.dangerLight, border: `1px solid ${H.danger}`,
      color: H.danger, fontSize: 13, marginBottom: 18,
    },
    fields: { display: 'flex', flexDirection: 'column', gap: 16 },
    label: {
      display: 'block', fontSize: 11, fontWeight: 700, color: H.muted,
      textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6,
    },
    input: {
      width: '100%', minHeight: '44px', padding: '11px 14px',
      background: H.bg, border: `1px solid ${H.border}`,
      borderRadius: 10, color: H.textPrimary, fontFamily: H.font,
      fontWeight: 600, fontSize: 14, outline: 'none', transition: 'border-color 0.2s ease', boxSizing: 'border-box' as const,
    },
    btn: {
      width: '100%', minHeight: '44px', padding: '12px', background: H.honey, color: '#FFFFFF',
      border: 'none', borderRadius: 10, fontFamily: H.font,
      fontWeight: 700, fontSize: 15, cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 4, boxSizing: 'border-box' as const,
    },
    sentWrap: { textAlign: 'center', padding: '8px 0' },
    sentIcon: { fontSize: 40, marginBottom: 12 },
    sentTitle: { fontWeight: 800, fontSize: 16, color: H.grass, margin: '0 0 8px' },
    sentText: { fontSize: 13, color: H.muted, lineHeight: 1.6, margin: 0 },
    footer: { fontSize: 12, color: H.sub, textAlign: 'center', marginTop: 20 },
  })

  return (
    <div style={styles.page}>
      <style>{STYLE}</style>
      <div style={styles.wrap}>
        {/* Header */}
        <div style={styles.header}>
          <div style={{ ...styles.logo, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <GraduationCap size={28} style={{ color: H.honey }} />
          </div>
          <h1 style={styles.h1}>{title}</h1>
          <p style={styles.sub}>School Management System</p>
        </div>

        {/* Card */}
        <div style={styles.card}>
          {/* Tabs */}
          <div style={styles.tabs}>
            {(['login', 'forgot'] as const).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => { setMode(m); setError(''); setSent(false) }}
                style={{ ...styles.tab, ...(mode === m ? styles.tabOn : styles.tabOff) }}
              >
                {m === 'login' ? (
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <KeyRound size={14} /> Sign In
                  </span>
                ) : (
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <Lock size={14} /> Reset Password
                  </span>
                )}
              </button>
            ))}
          </div>

          <div style={styles.body}>
            {error && <div style={styles.errBox}>{error}</div>}

            {mode === 'login' ? (
              <form onSubmit={handleLogin} style={styles.fields}>
                <div>
                  <label style={styles.label}>Email</label>
                  <input
                    type="email" value={email}
                    onChange={e => setEmail(e.target.value)}
                    onFocus={() => setIsEmailFocused(true)}
                    onBlur={() => setIsEmailFocused(false)}
                    required placeholder="you@school.lk"
                    style={{ ...styles.input, borderColor: isEmailFocused ? H.honey : H.border }}
                  />
                </div>
                <div>
                  <label style={styles.label}>Password</label>
                  <input
                    type="password" value={password}
                    onChange={e => setPassword(e.target.value)}
                    onFocus={() => setIsPassFocused(true)}
                    onBlur={() => setIsPassFocused(false)}
                    required placeholder="••••••••"
                    style={{ ...styles.input, borderColor: isPassFocused ? H.honey : H.border }}
                  />
                </div>
                <button type="submit" disabled={loading} style={{ ...styles.btn, opacity: loading ? 0.7 : 1 }}>
                  {loading
                    ? <><Loader2 size={16} style={{ animation: 'spin 0.7s linear infinite' }} /> Signing in…</>
                    : 'Sign In'}
                </button>
              </form>
            ) : sent ? (
              <div style={styles.sentWrap}>
                <div style={{ ...styles.sentIcon, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  <MailCheck size={32} style={{ color: H.honey }} />
                </div>
                <h3 style={styles.sentTitle}>Check your email</h3>
                <p style={styles.sentText}>
                  Reset link sent to <strong style={{ color: H.textPrimary }}>{email}</strong>
                </p>
              </div>
            ) : (
              <form onSubmit={handleForgot} style={styles.fields}>
                <p style={styles.sentText}>Enter your email and we'll send a reset link.</p>
                <div>
                  <label style={styles.label}>Email</label>
                  <input
                    type="email" value={email}
                    onChange={e => setEmail(e.target.value)}
                    onFocus={() => setIsEmailFocused(true)}
                    onBlur={() => setIsEmailFocused(false)}
                    required placeholder="you@school.lk"
                    style={{ ...styles.input, borderColor: isEmailFocused ? H.honey : H.border }}
                  />
                </div>
                <button type="submit" disabled={loading} style={{ ...styles.btn, opacity: loading ? 0.7 : 1 }}>
                  {loading
                    ? <><Loader2 size={16} style={{ animation: 'spin 0.7s linear infinite' }} /> Sending…</>
                    : 'Send Reset Link'}
                </button>
              </form>
            )}
          </div>
        </div>

        <p style={styles.footer}>School Management System</p>
      </div>
    </div>
  )
}
