'use client'
import { useState, Fragment } from 'react'
import { Plus, Loader2, Mail, User, X, Book, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

import { H } from '@/lib/honey'

// Design System Tokens
const colors = {
  primary_background: H.bg,
  card_background: H.surface,
  card_border: H.border,
  card_shadow: H.shadows.modal,
  success_green: H.successGreen,
  success_dark: '#065F46',
  success_light: H.successLight,
  danger_background: H.dangerLight,
  danger_text: H.danger,
  text_primary: H.textPrimary,
  text_secondary: H.textSec,
  text_muted: H.textMuted,
  input_background: H.bg,
  input_border: H.border,
  overlay_background: 'rgba(28, 25, 23, 0.6)',
}

const styles = {
  triggerButton: {
    background: colors.success_green,
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '12px',
    fontWeight: '700',
    fontSize: '14px',
    padding: '10px 20px',
    minHeight: '44px',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    transition: 'background-color 0.2s ease',
  },
  modalOverlay: {
    position: 'fixed' as const,
    inset: 0,
    zIndex: 50,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16px',
    backgroundColor: colors.overlay_background,
    backdropFilter: 'blur(4px)',
  },
  modalContent: {
    position: 'relative' as const,
    width: '100%',
    maxWidth: '480px',
    borderRadius: '16px',
    backgroundColor: colors.card_background,
    border: `1px solid ${colors.card_border}`,
    boxShadow: colors.card_shadow,
    padding: 'clamp(20px, 5vw, 32px)',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    boxSizing: 'border-box' as const,
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '12px',
    marginBottom: '20px'
  },
  headerTitle: {
    fontWeight: 800,
    fontSize: '22px',
    color: colors.text_primary,
    margin: 0,
  },
  headerSubtitle: {
    fontSize: '14px',
    color: colors.text_secondary,
    marginTop: '4px',
    margin: '4px 0 0 0',
  },
  closeButton: {
    background: colors.primary_background,
    border: `1px solid ${colors.card_border}`,
    color: colors.text_secondary,
    borderRadius: '50%',
    width: '40px',
    height: '40px',
    minWidth: '40px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background-color 0.2s ease, color 0.2s ease',
  },
  form: { display: 'flex', flexDirection: 'column' as const, gap: '20px' },
  label: {
    display: 'block',
    fontSize: '11px',
    fontWeight: 700,
    color: colors.text_muted,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
    marginBottom: '8px',
  },
  inputContainer: { position: 'relative' as const, display: 'flex', alignItems: 'center' },
  inputIcon: { position: 'absolute' as const, left: '14px', color: colors.text_muted, pointerEvents: 'none' as const },
  errorBanner: {
    padding: '12px 16px',
    borderRadius: '10px',
    background: colors.danger_background,
    border: `1px solid ${colors.danger_text}`,
    fontSize: '13px',
    color: colors.danger_text,
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    marginBottom: '16px',
    lineHeight: 1.5,
  },
  submitButton: {
    width: '100%',
    minHeight: '44px',
    padding: '12px 16px',
    background: colors.success_green,
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '12px',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    fontWeight: 700,
    fontSize: '15px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
  },
}

const inputStyle = (isFocused: boolean) => ({
  width: '100%',
  minHeight: '44px',
  padding: '12px 16px 12px 42px',
  borderRadius: '10px',
  border: `2px solid ${isFocused ? colors.success_green : colors.input_border}`,
  background: colors.input_background,
  color: colors.text_primary,
  fontSize: '14px',
  outline: 'none',
  boxSizing: 'border-box' as const,
  transition: 'border-color 0.2s ease',
})

function generateTempPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#'
  let pass = 'Tch#'
  for (let i = 0; i < 6; i++) {
    pass += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return pass
}

export default function AddTeacherModal({ onSuccess }: { onSuccess: () => void }) {
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [subjects, setSubjects] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [createdPassword, setCreatedPassword] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [focusedField, setFocusedField] = useState<string | null>(null)

  const handleOpen = () => {
    setOpen(true)
    setCreatedPassword(null)
    setError('')
    setCopied(false)
  }

  const handleClose = () => {
    setOpen(false)
    setName('')
    setEmail('')
    setSubjects('')
    setCreatedPassword(null)
    setError('')
    setCopied(false)
    onSuccess()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !email.trim()) {
      setError('Full name and email are required.')
      return
    }
    setLoading(true)
    setError('')

    const tempPassword = generateTempPassword()
    const subjectList  = subjects.split(',').map(s => s.trim()).filter(Boolean)

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token

      const res = await fetch('/api/admin/create-teacher', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          full_name: name.trim(),
          email: email.trim().toLowerCase(),
          tempPassword,
          subjects: subjectList,
        }),
      })

      const data = await res.json()

      if (!res.ok || data.error) {
        const errMsg = data.error || `Server returned error status ${res.status}`
        setError(errMsg)
        setLoading(false)
        return
      }

      setCreatedPassword(tempPassword)
      setLoading(false)
    } catch (err: any) {
      console.error('[AddTeacherModal] Network or unexpected error:', err)
      setError(err?.message || 'Failed to connect to server. Please try again.')
      setLoading(false)
    }
  }

  const handleCopy = () => {
    if (createdPassword) {
      navigator.clipboard.writeText(createdPassword)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <Fragment>
      <button onClick={handleOpen} style={styles.triggerButton}>
        <Plus size={16} /> Add Teacher
      </button>

      {open && (
        <div style={{ ...styles.modalOverlay, animation: 'fadeIn 0.2s cubic-bezier(0.4, 0, 0.2, 1)' }}>
          <div style={{ ...styles.modalContent, animation: 'modalScale 0.2s cubic-bezier(0.4, 0, 0.2, 1)' }}>
            <div style={styles.header}>
              <div>
                <h2 style={styles.headerTitle}>{createdPassword ? 'Teacher Account Created' : 'Register New Teacher'}</h2>
                <p style={styles.headerSubtitle}>
                  {createdPassword
                    ? 'Share the temporary password below with the teacher.'
                    : 'Enter the teacher’s details to generate an account.'}
                </p>
              </div>
              <button onClick={handleClose} style={styles.closeButton}>
                <X size={20} />
              </button>
            </div>

            {error && (
              <div style={styles.errorBanner}>
                <AlertTriangle size={18} style={{ minWidth: 18, marginTop: 2 }} />
                <div>
                  <strong>Action Failed:</strong> {error}
                </div>
              </div>
            )}

            {createdPassword ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ padding: '16px', borderRadius: '12px', background: colors.primary_background, border: `1px solid ${colors.card_border}` }}>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: colors.text_secondary, margin: '0 0 8px' }}>
                    Teacher added successfully for <strong>{email}</strong>.
                  </p>
                  <label style={styles.label}>Temporary Password</label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      readOnly
                      value={createdPassword}
                      style={{
                        ...inputStyle(false),
                        fontFamily: 'monospace',
                        fontWeight: 700,
                        fontSize: '16px',
                        letterSpacing: '0.05em',
                        color: colors.text_primary,
                        padding: '10px 14px',
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleCopy}
                      style={{
                        padding: '12px 18px',
                        background: copied ? colors.success_green : colors.text_primary,
                        color: '#FFFFFF',
                        border: 'none',
                        borderRadius: '10px',
                        fontWeight: 700,
                        fontSize: '13px',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        transition: 'background-color 0.2s ease',
                      }}
                    >
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <p style={{ fontSize: '12px', color: colors.danger_text, marginTop: '10px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <AlertTriangle size={14} /> This is the only time the temporary password will be shown. Please copy and share it manually with the teacher.
                  </p>
                </div>

                <button onClick={handleClose} style={styles.submitButton}>
                  Done & Close
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} style={styles.form}>
                <div>
                  <label style={styles.label} htmlFor="fullName">Full Name</label>
                  <div style={styles.inputContainer}>
                    <User size={16} style={styles.inputIcon} />
                    <input
                      id="fullName"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      onFocus={() => setFocusedField('name')}
                      onBlur={() => setFocusedField(null)}
                      required
                      placeholder="e.g. Nimali Perera"
                      style={inputStyle(focusedField === 'name')}
                    />
                  </div>
                </div>

                <div>
                  <label style={styles.label} htmlFor="email">Email Address</label>
                  <div style={styles.inputContainer}>
                    <Mail size={16} style={styles.inputIcon} />
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      onFocus={() => setFocusedField('email')}
                      onBlur={() => setFocusedField(null)}
                      required
                      placeholder="teacher@school.lk"
                      style={inputStyle(focusedField === 'email')}
                    />
                  </div>
                </div>
                
                <div>
                  <label style={styles.label} htmlFor="subjects">Subjects (Optional)</label>
                  <input
                    id="subjects"
                    value={subjects}
                    onChange={e => setSubjects(e.target.value)}
                    onFocus={() => setFocusedField('subjects')}
                    onBlur={() => setFocusedField(null)}
                    placeholder="e.g. Mathematics, Science"
                    style={{ ...inputStyle(focusedField === 'subjects'), paddingLeft: '16px' }}
                   />
                   <p style={{fontSize: '12px', color: colors.text_muted, marginTop: '6px'}}>
                      Separate multiple subjects with a comma.
                   </p>
                </div>

                <button type="submit" disabled={loading} style={{ ...styles.submitButton, opacity: loading ? 0.7 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}>
                  {loading ? <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Creating Account…</> : 'Create Account & Generate Password'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </Fragment>
  )
}
