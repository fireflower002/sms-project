'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Loader2, CheckCircle2, Eye, EyeOff } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { H, STYLE } from '@/lib/honey'
import { createStyles } from '@/lib/styles'

export default function ChangePassword({ backHref, backLabel }: { backHref: string; backLabel: string }) {
  const supabase = createClient()

  const [current, setCurrent] = useState('')
  const [newPass, setNewPass] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showCur, setShowCur] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [isCurrentFocused, setIsCurrentFocused] = useState(false)
  const [isNewFocused, setIsNewFocused] = useState(false)
  const [isConfirmFocused, setIsConfirmFocused] = useState(false)

  const strength = newPass.length < 8 ? 0 : newPass.length < 10 ? 1 : newPass.length < 12 ? 2 : 3
  const strengthColor = [H.danger, H.warning, '#059669', H.grass][strength]
  const strengthLabel = ['Too short', 'Weak', 'Good', 'Strong'][strength]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('')
    if (newPass !== confirm) { setError('Passwords do not match.'); return }
    if (newPass.length < 8) { setError('Password must be at least 8 characters.'); return }
    setLoading(true)

    const { data: { session } } = await supabase.auth.getSession(); const user = session?.user
    if (!user?.email) { setError('Not authenticated.'); setLoading(false); return }

    const { error: signInErr } = await supabase.auth.signInWithPassword({ email: user.email, password: current })
    if (signInErr) { setError('Current password is incorrect.'); setLoading(false); return }

    const { error: updateErr } = await supabase.auth.updateUser({ password: newPass })
    if (updateErr) { setError(updateErr.message) } else { setDone(true) }
    setLoading(false)
  }
  
  const styles = createStyles({
    container: { minHeight: '100vh', background: H.bg, fontFamily: H.font, color: H.text },
    header: { height: 64, padding: '0 28px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: `1px solid ${H.border}`, background: H.surface, position: 'sticky', top: 0, zIndex: 30 },
    backLink: { background: '#F5F5F4', color: H.muted, border: `1px solid ${H.border}`, borderRadius: 8, fontFamily: H.font, fontWeight: 700, fontSize: 12, padding: '6px 12px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5, textDecoration: 'none' },
    title: { fontFamily: H.font, fontSize: 18, fontWeight: 800, color: H.text, margin: 0 },
    main: { maxWidth: 480, margin: '0 auto', padding: '32px 28px' },
    done: { background: H.surface, borderRadius: 16, border: `1px solid ${H.grass}`, padding: '48px 32px', textAlign: 'center', boxShadow: H.shadows.card },
    doneIcon: { fontSize: 48, marginBottom: 12 },
    doneTitle: { fontFamily: H.font, fontSize: 20, fontWeight: 800, color: H.grass, margin: '0 0 8px' },
    doneText: { fontFamily: H.font, fontSize: 13, color: H.muted, margin: '0 0 24px' },
    doneLink: { background: H.grass, color: '#FFFFFF', border: 'none', borderRadius: 10, fontFamily: H.font, fontWeight: 700, fontSize: 13, padding: '10px 22px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none' },
    form: { background: H.surface, borderRadius: 16, border: `1px solid ${H.border}`, padding: '28px 24px', display: 'flex', flexDirection: 'column', gap: 18, boxShadow: H.shadows.card },
    error: { padding: '10px 14px', borderRadius: 10, background: H.dangerLight, border: `1px solid ${H.danger}`, fontFamily: H.font, fontSize: 13, color: H.danger },
    label: { display: 'block', fontFamily: H.font, fontSize: 11, fontWeight: 700, color: H.muted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 },
    inputContainer: { position: 'relative' },
    input: { width: '100%', padding: '10px 40px 10px 14px', background: H.bg, border: `1px solid ${H.border}`, borderRadius: 10, color: H.text, fontFamily: H.font, fontWeight: 600, fontSize: 14, outline: 'none', transition: 'border-color 0.2s ease' },
    eyeButton: { position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: H.sub },
    strength: { marginTop: 8 },
    strengthBars: { display: 'flex', gap: 4, marginBottom: 4 },
    strengthBar: { flex: 1, height: 4, borderRadius: 2, transition: 'background 0.2s' },
    strengthLabel: { fontFamily: H.font, fontSize: 11, fontWeight: 700 },
    confirmInput: { width: '100%', padding: '10px 14px', background: H.bg, border: `1px solid ${H.border}`, borderRadius: 10, color: H.text, fontFamily: H.font, fontWeight: 600, fontSize: 14, outline: 'none', transition: 'border-color 0.2s ease' },
    confirmErrorText: { fontFamily: H.font, fontSize: 11, color: H.danger, marginTop: 4, display: 'block' },
    submitButton: { background: H.grass, color: '#FFFFFF', border: 'none', borderRadius: 10, fontFamily: H.font, fontWeight: 700, fontSize: 14, padding: '12px 22px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 },
  });

  return (
    <div style={styles.container}>
      <style>{STYLE}</style>
      <header style={styles.header}>
        <Link href={backHref} style={styles.backLink}>←</Link>
        <span style={{ fontSize: 20 }}>🔑</span>
        <h1 style={styles.title}>Change Password</h1>
      </header>

      <main style={styles.main}>
        {done ? (
          <div style={styles.done}>
            <div style={styles.doneIcon}>🔐</div>
            <h2 style={styles.doneTitle}>Password Updated!</h2>
            <p style={styles.doneText}>Your password has been changed successfully.</p>
            <Link href={backHref} style={styles.doneLink}>← Back</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={styles.form}>
            {error && (
              <div style={styles.error}>{error}</div>
            )}
            <div>
              <label style={styles.label}>Current Password</label>
              <div style={styles.inputContainer}>
                <input type={showCur ? 'text' : 'password'} value={current} onChange={e => setCurrent(e.target.value)} required placeholder="••••••••"
                  style={{...styles.input, borderColor: isCurrentFocused ? H.grass : H.border}}
                  onFocus={() => setIsCurrentFocused(true)} onBlur={() => setIsCurrentFocused(false)} />
                <button type="button" onClick={() => setShowCur(x => !x)} style={styles.eyeButton}>
                  {showCur ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
            <div>
              <label style={styles.label}>New Password</label>
              <div style={styles.inputContainer}>
                <input type={showNew ? 'text' : 'password'} value={newPass} onChange={e => setNewPass(e.target.value)} required placeholder="Min. 8 characters" minLength={8}
                  style={{...styles.input, borderColor: isNewFocused ? H.grass : H.border}}
                  onFocus={() => setIsNewFocused(true)} onBlur={() => setIsNewFocused(false)} />
                <button type="button" onClick={() => setShowNew(x => !x)} style={styles.eyeButton}>
                  {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {newPass && (
                <div style={styles.strength}>
                  <div style={styles.strengthBars}>
                    {[1, 2, 3].map(l => <div key={l} style={{...styles.strengthBar, background: strength >= l ? strengthColor : '#E8E4DD' }} />)}
                  </div>
                  <span style={{...styles.strengthLabel, color: strengthColor }}>{strengthLabel}</span>
                </div>
              )}
            </div>
            <div>
              <label style={styles.label}>Confirm New Password</label>
              <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required placeholder="••••••••"
                style={{...styles.confirmInput, borderColor: isConfirmFocused ? H.grass : (confirm && confirm !== newPass ? H.danger : H.border)}}
                onFocus={() => setIsConfirmFocused(true)} onBlur={() => setIsConfirmFocused(false)} />
              {confirm && confirm !== newPass && <span style={styles.confirmErrorText}>Passwords don't match</span>}
            </div>
            <button type="submit" disabled={loading || !current || newPass.length < 8 || newPass !== confirm}
              style={{...styles.submitButton, opacity: (loading || !current || newPass.length < 8 || newPass !== confirm) ? 0.5 : 1 }}>
              {loading ? <Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} /> : <CheckCircle2 size={14} />}
              Update Password
            </button>
          </form>
        )}
      </main>
    </div>
  )
}
