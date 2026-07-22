"use client"
import React, { useState } from 'react'
import { Loader2, CheckCircle, Mail, GraduationCap, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { H, STYLE } from '@/lib/honey'
import { createStyles } from '@/lib/styles'

export default function RegisterForm() {
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [sentEmail, setSentEmail] = useState('')
  const [focusedField, setFocusedField] = useState<string | null>(null)

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const trimmedEmail = email.trim().toLowerCase()
    if (!trimmedEmail) {
      setError('Please enter a valid email address.')
      return
    }

    setLoading(true)
    try {
      // Step 1: Check that this email was pre-approved by Admin (exists in allowed_users)
      const { data: allowed, error: lookupErr } = await supabase
        .from('allowed_users')
        .select('id, is_registered')
        .eq('email', trimmedEmail)
        .maybeSingle()

      if (lookupErr || !allowed) {
        setError('This email has not been added by an administrator. Contact your school admin to be registered.')
        setLoading(false)
        return
      }

      // Step 2: Check that the email hasn't already been used to register
      if (allowed.is_registered) {
        setError('An account already exists for this email. Please sign in instead.')
        setLoading(false)
        return
      }

      // Step 3: Send Magic Link via Supabase Auth
      const res = await fetch('/api/teacher-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to send registration link.')
        setLoading(false)
        return
      }

      setSentEmail(trimmedEmail)
      setSuccess(true)
      setLoading(false)
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.')
      setLoading(false)
    }
  }

  const styles = createStyles({
    page: {
      backgroundColor: H.bg,
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px',
      fontFamily: H.font,
      boxSizing: 'border-box',
    },
    wrap: {
      width: '100%',
      maxWidth: '440px',
    },
    header: {
      textAlign: 'center',
      marginBottom: 24,
    },
    logo: {
      width: 48,
      height: 48,
      borderRadius: 14,
      background: H.surface,
      border: `1px solid ${H.border}`,
      boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    h1: {
      fontSize: 22,
      fontWeight: 800,
      color: H.textPrimary,
      margin: '0 0 4px',
    },
    sub: {
      fontSize: 13,
      color: H.textSec,
      margin: 0,
    },
    card: {
      backgroundColor: H.surface,
      borderRadius: 16,
      border: `1px solid ${H.border}`,
      boxShadow: H.cardShadow,
      overflow: 'hidden',
    },
    cardHeader: {
      padding: '20px 24px',
      borderBottom: `1px solid ${H.border}`,
      backgroundColor: H.bg,
    },
    cardTitle: {
      fontSize: 15,
      fontWeight: 700,
      color: H.textPrimary,
      margin: '0 0 2px',
    },
    cardSub: {
      fontSize: 12,
      color: H.textSec,
      margin: 0,
    },
    body: {
      padding: 24,
    },
    errBox: {
      backgroundColor: H.dangerLight,
      color: H.danger,
      borderRadius: 10,
      padding: '10px 14px',
      fontSize: 13,
      fontWeight: 600,
      marginBottom: 16,
      display: 'flex',
      alignItems: 'center',
      gap: 8,
    },
    fields: {
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
    },
    label: {
      display: 'block',
      fontSize: 12,
      fontWeight: 700,
      color: H.textSec,
      marginBottom: 6,
      textTransform: 'uppercase',
      letterSpacing: '0.04em',
    },
    input: {
      width: '100%',
      height: 44,
      padding: '0 14px',
      borderRadius: 10,
      border: `1px solid ${H.border}`,
      backgroundColor: H.surface,
      fontSize: 14,
      color: H.textPrimary,
      fontFamily: H.font,
      boxSizing: 'border-box',
      outline: 'none',
      transition: 'border-color 0.15s ease',
    },
    hint: {
      fontSize: 11,
      color: H.textMuted,
      margin: '6px 0 0',
    },
    btn: {
      width: '100%',
      height: 44,
      borderRadius: 10,
      border: 'none',
      backgroundColor: H.skyBlue,
      color: '#FFFFFF',
      fontWeight: 700,
      fontSize: 14,
      fontFamily: H.font,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      transition: 'opacity 0.15s ease',
      marginTop: 4,
    },
    footer: {
      textAlign: 'center',
      fontSize: 12,
      color: H.textMuted,
      marginTop: 20,
    },
    successCard: {
      backgroundColor: H.surface,
      borderRadius: 16,
      border: `1px solid ${H.border}`,
      boxShadow: H.cardShadow,
      padding: 32,
      textAlign: 'center',
    },
    successIcon: {
      color: H.successGreen,
      marginBottom: 16,
    },
    successTitle: {
      fontSize: 18,
      fontWeight: 800,
      color: H.textPrimary,
      margin: '0 0 8px',
    },
    successText: {
      fontSize: 13,
      color: H.textSec,
      lineHeight: 1.6,
      margin: '0 0 24px',
    },
    successBtn: {
      padding: '10px 20px',
      borderRadius: 10,
      border: `1px solid ${H.border}`,
      backgroundColor: H.bg,
      color: H.textPrimary,
      fontWeight: 600,
      fontSize: 13,
      fontFamily: H.font,
      cursor: 'pointer',
    },
  })

  if (success) {
    return (
      <div style={styles.page}>
        <style>{STYLE}</style>
        <div style={styles.wrap}>
          <div style={styles.header}>
            <div style={styles.logo}><Mail size={22} style={{ color: H.skyBlue }} /></div>
            <h1 style={styles.h1}>Check Your Email</h1>
            <p style={styles.sub}>School Management System</p>
          </div>
          <div style={styles.successCard}>
            <CheckCircle size={52} style={styles.successIcon} />
            <h2 style={styles.successTitle}>Registration Link Sent!</h2>
            <p style={styles.successText}>
              We sent a secure registration link to <strong>{sentEmail}</strong>.<br />
              Please check your inbox and click the link to set your password and complete registration.
            </p>
            <button
              style={styles.successBtn}
              onClick={() => { setSuccess(false); setEmail(''); }}
            >
              ← Back to Registration
            </button>
          </div>
          <p style={styles.footer}>School Management System</p>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.page}>
      <style>{STYLE}</style>
      <div style={styles.wrap}>
        <div style={styles.header}>
          <div style={styles.logo}><GraduationCap size={24} style={{ color: H.skyBlue }} /></div>
          <h1 style={styles.h1}>Teacher Registration</h1>
          <p style={styles.sub}>School Management System</p>
        </div>

        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <p style={styles.cardTitle}>Register pre-approved email</p>
            <p style={styles.cardSub}>
              Enter your school email address to receive a registration link.
            </p>
          </div>

          <div style={styles.body}>
            {error && <div style={styles.errBox}><AlertTriangle size={14} /> {error}</div>}

            <form onSubmit={handleRegister} style={styles.fields}>
              <div>
                <label style={styles.label}>Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onFocus={() => setFocusedField('email')}
                  onBlur={() => setFocusedField(null)}
                  required
                  placeholder="your.name@school.lk"
                  style={{ ...styles.input, borderColor: focusedField === 'email' ? H.skyBlue : H.border }}
                  autoComplete="email"
                />
                <p style={styles.hint}>Must match the email pre-approved by your administrator.</p>
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{ ...styles.btn, opacity: loading ? 0.7 : 1 }}
              >
                {loading
                  ? <><Loader2 size={16} style={{ animation: 'spin 0.7s linear infinite' }} /> Sending link…</>
                  : 'Send Registration Link'}
              </button>
            </form>

            <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${H.border}`, textAlign: 'center', fontSize: 13, color: H.textSec }}>
              Already registered?{' '}
              <a href="/teacher/login" style={{ color: H.skyBlue, fontWeight: 700, textDecoration: 'none' }}>
                Teacher Sign In
              </a>
            </div>
          </div>
        </div>

        <p style={styles.footer}>School Management System</p>
      </div>
    </div>
  )
}
