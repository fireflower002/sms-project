"use client"
import React, { useState } from 'react'
import { Loader2, GraduationCap, KeyRound, Lock, MailCheck, ShieldAlert, CheckCircle2, ArrowLeft } from 'lucide-react'
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
  const [successMsg, setSuccessMsg] = useState('')
  const [isEmailFocused, setIsEmailFocused] = useState(false)
  const [isPassFocused, setIsPassFocused] = useState(false)

  // OTP Admin Password Reset State
  const [otpStep, setOtpStep] = useState<'request' | 'verify'>('request')
  const [otpCode, setOtpCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccessMsg('')
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
        let userRole = 'teacher'
        let mustChange = false

        const { data: profile, error: profErr } = await supabase
          .from('profiles')
          .select('role, must_change_password')
          .eq('id', user.id)
          .maybeSingle()

        if (profErr) {
          const { data: fallbackProfile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .maybeSingle()
          userRole = fallbackProfile?.role || 'teacher'
        } else {
          userRole = profile?.role || 'teacher'
          mustChange = profile?.must_change_password ?? false
        }

        // Verify forced password change for teachers
        if (userRole === 'teacher') {
          if (mustChange) {
            window.location.href = '/teacher/profile?changePassword=true'
            return
          }

          const { data: allowed } = await supabase
            .from('allowed_users')
            .select('is_registered')
            .eq('email', email.trim().toLowerCase())
            .maybeSingle()

          if (allowed && allowed.is_registered === false) {
            window.location.href = '/teacher/profile?changePassword=true'
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

  // Admin Request OTP for Password Reset
  const handleRequestAdminOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccessMsg('')
    const trimmedEmail = email.trim().toLowerCase()

    if (!trimmedEmail) {
      setError('Please enter your administrator email address.')
      return
    }

    setLoading(true)
    try {
      // 1. Verify user profile exists and is an admin
      const { data: prof } = await supabase
        .from('profiles')
        .select('role')
        .eq('email', trimmedEmail)
        .maybeSingle()

      if (!prof || prof.role !== 'admin') {
        setError('No administrator account found matching this email address.')
        setLoading(false)
        return
      }

      // 2. Dispatch OTP code via Supabase Auth
      const { error: otpErr } = await supabase.auth.signInWithOtp({
        email: trimmedEmail,
        options: { shouldCreateUser: false },
      })

      if (otpErr) {
        const { error: resetErr } = await supabase.auth.resetPasswordForEmail(trimmedEmail)
        if (resetErr) {
          setError(resetErr.message || 'Failed to send OTP code to email.')
          setLoading(false)
          return
        }
      }

      setOtpStep('verify')
      setSuccessMsg('A 6-digit verification code has been sent to your email.')
    } catch (err: any) {
      setError(err.message || 'Failed to send OTP code. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Admin Verify OTP and Set New Password
  const handleVerifyAdminOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccessMsg('')

    if (!otpCode.trim()) {
      setError('Please enter the 6-digit verification code.')
      return
    }

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters long.')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      const trimmedEmail = email.trim().toLowerCase()
      const trimmedCode = otpCode.trim()

      let verifyRes = await supabase.auth.verifyOtp({
        email: trimmedEmail,
        token: trimmedCode,
        type: 'email',
      })

      if (verifyRes.error) {
        verifyRes = await supabase.auth.verifyOtp({
          email: trimmedEmail,
          token: trimmedCode,
          type: 'recovery',
        })
      }

      if (verifyRes.error) {
        setError('Invalid or expired OTP code. Please check your email and try again.')
        setLoading(false)
        return
      }

      const { error: updateErr } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (updateErr) {
        setError(updateErr.message || 'Failed to update password.')
        setLoading(false)
        return
      }

      setSuccessMsg('Password updated successfully! Please sign in with your new password.')
      setOtpStep('request')
      setOtpCode('')
      setNewPassword('')
      setConfirmPassword('')
      setPassword('')
      setMode('login')
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred during password reset.')
    } finally {
      setLoading(false)
    }
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
    h1: { fontWeight: H.fontWeight.extrabold, fontSize: H.fontSize['3xl'], color: H.textPrimary, margin: '0 0 4px' },
    sub: { fontSize: H.fontSize.md, color: H.muted, margin: 0 },
    card: {
      background: H.surface, border: `1px solid ${H.border}`,
      borderRadius: H.radius['2xl'], boxShadow: H.shadows.card, overflow: 'hidden',
    },
    tabs: { display: 'flex', borderBottom: `1px solid ${H.border}` },
    tab: {
      flex: 1, padding: H.spacing.md, fontFamily: H.font, fontWeight: H.fontWeight.bold,
      fontSize: H.fontSize.md, borderTop: 'none', borderLeft: 'none', borderRight: 'none',
      borderBottom: '2px solid transparent', cursor: 'pointer', transition: H.motion.transitionFast,
    },
    tabOn: { background: H.accentLight, color: H.chocolate, borderBottomColor: H.honey },
    tabOff: { background: H.bg, color: H.muted, borderBottomColor: 'transparent' },
    body: { padding: H.spacing['2xl'] },
    errBox: {
      padding: `${H.spacing.sm} ${H.spacing.md}`, borderRadius: H.radius.lg,
      background: H.dangerLight, border: `1px solid ${H.danger}`,
      color: H.danger, fontSize: H.fontSize.md, marginBottom: H.spacing.lg,
    },
    successBox: {
      padding: `${H.spacing.sm} ${H.spacing.md}`, borderRadius: H.radius.lg,
      background: H.successLight, border: `1px solid ${H.grass}40`,
      color: H.grass, fontSize: H.fontSize.md, marginBottom: H.spacing.lg,
      display: 'flex', alignItems: 'center', gap: H.spacing.sm,
    },
    fields: { display: 'flex', flexDirection: 'column', gap: H.spacing.lg },
    label: {
      display: 'block', fontSize: H.fontSize.xs, fontWeight: H.fontWeight.bold, color: H.muted,
      textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6,
    },
    input: {
      width: '100%', minHeight: H.targetSizes.touchTarget, padding: '11px 14px',
      background: H.bg, border: `1px solid ${H.border}`,
      borderRadius: H.radius.lg, color: H.textPrimary, fontFamily: H.font,
      fontWeight: H.fontWeight.semibold, fontSize: H.fontSize.base, outline: 'none', transition: H.motion.transitionFast, boxSizing: 'border-box' as const,
    },
    btn: {
      width: '100%', minHeight: H.targetSizes.touchTarget, padding: H.spacing.md, background: H.honey, color: '#FFFFFF',
      border: 'none', borderRadius: H.radius.lg, fontFamily: H.font,
      fontWeight: H.fontWeight.bold, fontSize: H.fontSize.medium, cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: H.spacing.sm, marginTop: 4, boxSizing: 'border-box' as const,
      transition: H.motion.transitionFast,
    },
    infoNotice: {
      padding: `${H.spacing.xl} ${H.spacing.lg}`, borderRadius: H.radius.xl,
      background: H.purpleLight, border: `1px solid ${H.purple}40`,
      textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: H.spacing.md,
    },
    footer: { fontSize: H.fontSize.sm, color: H.sub, textAlign: 'center', marginTop: H.spacing.xl },
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
                onClick={() => { setMode(m); setError(''); setSuccessMsg(''); setOtpStep('request') }}
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
            {successMsg && (
              <div style={styles.successBox}>
                <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
                <span>{successMsg}</span>
              </div>
            )}

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
            ) : role === 'teacher' ? (
              /* Teacher-side Password Reset Notice */
              <div style={styles.infoNotice}>
                <ShieldAlert size={32} style={{ color: H.purpleDark }} />
                <div>
                  <h3 style={{ margin: '0 0 6px', fontSize: '15px', fontWeight: 700, color: H.purpleDark }}>
                    Admin-Managed Password Reset
                  </h3>
                  <p style={{ margin: 0, fontSize: '12.5px', color: H.textSec, lineHeight: 1.5 }}>
                    Teacher account passwords are managed directly by school administrators. If you forgot your password, please contact your administrator to receive a temporary password.
                  </p>
                </div>
                <button
                  onClick={() => setMode('login')}
                  style={{
                    padding: '8px 16px', borderRadius: 8, border: `1px solid ${H.purple}`,
                    backgroundColor: H.surface, color: H.purpleDark, fontWeight: 600, fontSize: 13, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 6, marginTop: 4,
                  }}
                >
                  <ArrowLeft size={14} /> Back to Sign In
                </button>
              </div>
            ) : otpStep === 'request' ? (
              /* Admin Step 1: Enter Email & Request OTP */
              <form onSubmit={handleRequestAdminOtp} style={styles.fields}>
                <p style={{ fontSize: 13, color: H.muted, margin: '0 0 4px', lineHeight: 1.5 }}>
                  Enter your admin email address to receive a 6-digit OTP verification code.
                </p>
                <div>
                  <label style={styles.label}>Admin Email</label>
                  <input
                    type="email" value={email}
                    onChange={e => setEmail(e.target.value)}
                    onFocus={() => setIsEmailFocused(true)}
                    onBlur={() => setIsEmailFocused(false)}
                    required placeholder="admin@school.lk"
                    style={{ ...styles.input, borderColor: isEmailFocused ? H.honey : H.border }}
                  />
                </div>
                <button type="submit" disabled={loading} style={{ ...styles.btn, opacity: loading ? 0.7 : 1 }}>
                  {loading
                    ? <><Loader2 size={16} style={{ animation: 'spin 0.7s linear infinite' }} /> Sending OTP…</>
                    : 'Send Verification Code'}
                </button>
              </form>
            ) : (
              /* Admin Step 2: Enter OTP Code + New Password */
              <form onSubmit={handleVerifyAdminOtp} style={styles.fields}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12.5, color: H.textSec }}>Resetting for <strong>{email}</strong></span>
                  <button
                    type="button"
                    onClick={() => { setOtpStep('request'); setError('') }}
                    style={{ background: 'none', border: 'none', color: H.purple, fontSize: 12, cursor: 'pointer', fontWeight: 600, textDecoration: 'underline' }}
                  >
                    Change Email
                  </button>
                </div>

                <div>
                  <label style={styles.label}>6-Digit OTP Code</label>
                  <input
                    type="text"
                    maxLength={6}
                    value={otpCode}
                    onChange={e => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    required
                    placeholder="123456"
                    style={{
                      ...styles.input,
                      letterSpacing: '0.2em',
                      fontSize: '18px',
                      fontWeight: 800,
                      textAlign: 'center',
                    }}
                  />
                </div>

                <div>
                  <label style={styles.label}>New Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    required
                    placeholder="At least 8 characters"
                    style={styles.input}
                  />
                </div>

                <div>
                  <label style={styles.label}>Confirm New Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    required
                    placeholder="Re-enter new password"
                    style={styles.input}
                  />
                </div>

                <button type="submit" disabled={loading} style={{ ...styles.btn, opacity: loading ? 0.7 : 1 }}>
                  {loading
                    ? <><Loader2 size={16} style={{ animation: 'spin 0.7s linear infinite' }} /> Resetting Password…</>
                    : 'Verify OTP & Reset Password'}
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
