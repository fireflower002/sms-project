'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2 } from 'lucide-react'
import { H, STYLE } from '@/lib/honey'
import { createStyles } from '@/lib/styles'

function ResetPasswordContent() {
  const router = useRouter()
  const params = useSearchParams()
  const supabase = createClient()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [isPassFocused, setIsPassFocused] = useState(false)
  const [isConfirmFocused, setIsConfirmFocused] = useState(false)

  useEffect(() => {
    const handleRecoverySession = async () => {
      const code = params.get('code')
      const tokenHash = params.get('token_hash')
      const type = params.get('type')

      if (code) {
        await supabase.auth.exchangeCodeForSession(code)
      } else if (tokenHash && type === 'recovery') {
        await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: 'recovery',
        })
      }
    }
    handleRecoverySession()
  }, [params, supabase])

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    setLoading(true)

    const { error } = await supabase.auth.updateUser({
      password: password
    })

    if (error) {
      setError(error.message)
    } else {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        await supabase.from('profiles').update({ must_change_password: false }).eq('id', session.user.id)
      }
      setSuccess(true)
      setTimeout(() => router.push('/'), 2000)
    }

    setLoading(false)
  }

  const styles = createStyles({
    container: { minHeight: '100vh', background: H.bg, fontFamily: H.font, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 },
    content: { width: '100%', maxWidth: 420 },
    success: { background: H.surface, borderRadius: 16, border: `1px solid ${H.border}`, padding: '48px 32px', textAlign: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' },
    successIcon: { fontSize: 48, marginBottom: 12 },
    successTitle: { fontSize: 20, fontWeight: 800, color: H.grass, marginBottom: 12 },
    successText: { color: H.text, marginBottom: 24 },
    redirectText: { color: H.purple, fontSize: 14 },
    form: { background: H.surface, borderRadius: 16, border: `1px solid ${H.border}`, padding: '28px 24px', display: 'flex', flexDirection: 'column', gap: 18, boxShadow: '0 4px 12px rgba(0,0,0,0.06)' },
    title: { fontSize: 22, fontWeight: 800, color: H.text, textAlign: 'center', marginBottom: 12 },
    error: { padding: '10px 14px', borderRadius: 10, background: H.dangerLight, border: `1px solid ${H.danger}`, color: H.danger, fontSize: 13, marginBottom: 14 },
    label: { display: 'block', marginBottom: 6, fontSize: 11, fontWeight: 700, color: H.muted, textTransform: 'uppercase', letterSpacing: '0.07em' },
    input: { width: '100%', padding: '11px 14px', borderRadius: 10, border: `1px solid ${H.border}`, background: H.bg, color: H.text, fontFamily: H.font, fontWeight: 600, fontSize: 14, outline: 'none', transition: 'border-color 0.2s ease' },
    button: { width: '100%', padding: '12px', background: H.honey, color: '#FFFFFF', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 },
  });

  return (
    <div style={styles.container}>
      <style>{STYLE}</style>
      <div style={styles.content}>
        {success ? (
          <div style={styles.success}>
            <div style={styles.successIcon}>🔐</div>
            <h1 style={styles.successTitle}>Password Updated!</h1>
            <p style={styles.successText}>Your password has been successfully changed.</p>
            <p style={styles.redirectText}>Redirecting to home page...</p>
          </div>
        ) : (
          <form onSubmit={handleReset} style={styles.form}>
            <h1 style={styles.title}>Reset Password</h1>

            {error && (
              <div style={styles.error}>
                {error}
              </div>
            )}

            <div>
              <label style={styles.label}>New Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setIsPassFocused(true)}
                onBlur={() => setIsPassFocused(false)}
                style={{ ...styles.input, borderColor: isPassFocused ? H.honey : H.border }}
                required
                minLength={8}
                placeholder="Min. 8 characters"
              />
            </div>

            <div>
              <label style={styles.label}>Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onFocus={() => setIsConfirmFocused(true)}
                onBlur={() => setIsConfirmFocused(false)}
                style={{ ...styles.input, borderColor: confirmPassword && confirmPassword !== password ? H.danger : (isConfirmFocused ? H.honey : H.border) }}
                required
                placeholder="Re-enter password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{ ...styles.button, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}
            >
              {loading ? <Loader2 size={16} style={{animation: 'spin 0.7s linear infinite'}}/> : 'Update Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: H.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Loader2 size={32} style={{ color: H.honey, animation: 'spin 0.7s linear infinite' }} /></div>}>
      <ResetPasswordContent />
    </Suspense>
  )
}
