'use client'
import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, CheckCircle2, Eye, EyeOff, Lock, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { H, STYLE } from '@/lib/honey'
import { createStyles } from '@/lib/styles'

export default function ForcedChangePasswordPage() {
  const router = useRouter()
  const supabase = createClient()

  const [userEmail, setUserEmail] = useState<string>('')
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [newPass, setNewPass] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [focusedField, setFocusedField] = useState<string | null>(null)

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/teacher/login')
        return
      }
      setUserEmail(session.user.email || '')
      setCheckingAuth(false)
    }
    checkUser()
  }, [router, supabase])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (newPass.length < 8) {
      setError('Password must be at least 8 characters long.')
      return
    }

    if (newPass !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)

    try {
      const { error: updateErr } = await supabase.auth.updateUser({
        password: newPass,
      })

      if (updateErr) {
        setError(updateErr.message)
        setLoading(false)
        return
      }

      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        await supabase
          .from('profiles')
          .update({ must_change_password: false })
          .eq('id', session.user.id)

        if (session.user.email) {
          await supabase
            .from('allowed_users')
            .update({ is_registered: true, must_change_password: false })
            .eq('email', session.user.email)
        }
      }

      setSuccess(true)
      setTimeout(() => {
        router.push('/teacher')
      }, 2000)
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
    inputContainer: {
      position: 'relative',
    },
    input: {
      width: '100%',
      height: 44,
      padding: '0 40px 0 14px',
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
    eyeBtn: {
      position: 'absolute',
      right: 12,
      top: '50%',
      transform: 'translateY(-50%)',
      background: 'none',
      border: 'none',
      color: H.textMuted,
      cursor: 'pointer',
      padding: 4,
      display: 'flex',
      alignItems: 'center',
    },
    btn: {
      width: '100%',
      height: 44,
      borderRadius: 10,
      border: 'none',
      backgroundColor: H.honey,
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
  })

  if (checkingAuth) {
    return (
      <div style={styles.page}>
        <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: H.honey }} />
      </div>
    )
  }

  if (success) {
    return (
      <div style={styles.page}>
        <style>{STYLE}</style>
        <div style={styles.wrap}>
          <div style={styles.header}>
            <div style={styles.logo}><Lock size={24} style={{ color: H.honey }} /></div>
            <h1 style={styles.h1}>Password Updated!</h1>
            <p style={styles.sub}>School Management System</p>
          </div>
          <div style={styles.successCard}>
            <CheckCircle2 size={52} style={{ color: H.grass, marginBottom: 16 }} />
            <h2 style={{ fontWeight: 800, fontSize: 20, color: H.textPrimary, margin: '0 0 10px' }}>You're all set!</h2>
            <p style={{ fontSize: 14, color: H.textSec, lineHeight: 1.6, margin: '0 0 20px' }}>
              Your password has been changed successfully. Redirecting to your dashboard...
            </p>
            <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', margin: '0 auto', color: H.honey }} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.page}>
      <style>{STYLE}</style>
      <div style={styles.wrap}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.logo}><Lock size={24} style={{ color: H.honey }} /></div>
          <h1 style={styles.h1}>Set New Password</h1>
          <p style={styles.sub}>Logged in as {userEmail}</p>
        </div>

        {/* Card */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <p style={styles.cardTitle}>Set permanent password</p>
            <p style={styles.cardSub}>
              Your admin created this account with a temporary password. Please set a new password to continue.
            </p>
          </div>

          <div style={styles.body}>
            {error && <div style={styles.errBox}><AlertTriangle size={14} /> {error}</div>}

            <form onSubmit={handleSubmit} style={styles.fields}>
              <div>
                <label style={styles.label}>New Password</label>
                <div style={styles.inputContainer}>
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={newPass}
                    onChange={e => setNewPass(e.target.value)}
                    onFocus={() => setFocusedField('newPass')}
                    onBlur={() => setFocusedField(null)}
                    required
                    placeholder="At least 8 characters"
                    style={{ ...styles.input, borderColor: focusedField === 'newPass' ? H.honey : H.border }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    style={styles.eyeBtn}
                  >
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label style={styles.label}>Confirm New Password</label>
                <div style={styles.inputContainer}>
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    onFocus={() => setFocusedField('confirm')}
                    onBlur={() => setFocusedField(null)}
                    required
                    placeholder="Repeat new password"
                    style={{ ...styles.input, borderColor: focusedField === 'confirm' ? H.honey : H.border }}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || newPass.length < 8 || newPass !== confirm}
                style={{ ...styles.btn, opacity: (loading || newPass.length < 8 || newPass !== confirm) ? 0.6 : 1 }}
              >
                {loading ? <><Loader2 size={16} style={{ animation: 'spin 0.7s linear infinite' }} /> Saving...</> : 'Save Password & Continue'}
              </button>
            </form>
          </div>
        </div>

        <p style={styles.footer}>School Management System</p>
      </div>
    </div>
  )
}
