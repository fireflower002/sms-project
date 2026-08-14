'use client'
import { useState, useEffect, Fragment } from 'react'
import Link from 'next/link'
import { Plus, Loader2, Mail, User, X, Book, AlertTriangle, Check, Phone, Sparkles, ArrowRight, GraduationCap, UserCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { H } from '@/lib/honey'
import { getSubjectSuggestion, formatSubjectName } from '@/lib/subjectUtils'
import SubjectModal from './SubjectModal'

// Predefined fallback subjects & curated color palette
const PREDEFINED_SUBJECTS = [
  'Maths', 'Science', 'English', 'Sinhala', 'Tamil', 'History',
  'Geography', 'ICT', 'Art', 'Music', 'PE', 'Religion',
  'Commerce', 'Biology', 'Chemistry', 'Physics', 'Economics', 'Combined Maths'
]

const CURATED_PALETTE = [
  '#F59E0B', '#8B5CF6', '#EAB308', '#EF4444', '#06B6D4', '#EC4899',
  '#10B981', '#F97316', '#3B82F6', '#84CC16', '#D946EF', '#059669',
  '#7C3AED', '#F43F5E', '#14B8A6', '#6366F1', '#B45309', '#0EA5E9'
]

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
    maxWidth: '520px',
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
  const [phone, setPhone] = useState('')
  
  // Subject Management States
  const [availableSubjects, setAvailableSubjects] = useState<string[]>(PREDEFINED_SUBJECTS)
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([])
  const [isSubjectModalOpen, setIsSubjectModalOpen] = useState(false)
  const [subjectError, setSubjectError] = useState('')
  const [subjectNotice, setSubjectNotice] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [createdPassword, setCreatedPassword] = useState<string | null>(null)
  const [createdUserId, setCreatedUserId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [focusedField, setFocusedField] = useState<string | null>(null)

  // Fetch subjects list when modal opens from profiles & schedule_assignments
  useEffect(() => {
    if (!open) return
    const fetchSubjects = async () => {
      try {
        const [{ data: profs }, { data: asgns }] = await Promise.all([
          supabase.from('profiles').select('subjects, subject_colors'),
          supabase.from('schedule_assignments').select('subject'),
        ])

        const set = new Set(PREDEFINED_SUBJECTS)

        ;(profs || []).forEach((p: any) => {
          (p.subjects || []).forEach((s: string) => { if (s && s !== 'Other') set.add(s.trim()) })
          if (p.subject_colors) {
            Object.keys(p.subject_colors).forEach((s: string) => { if (s && s !== 'Other') set.add(s.trim()) })
          }
        })

        ;(asgns || []).forEach((a: any) => {
          if (a.subject && a.subject !== 'Other') set.add(a.subject.trim())
        })

        setAvailableSubjects(Array.from(set).sort((a, b) => a.localeCompare(b)))
      } catch (e) {
        console.warn('[AddTeacherModal] Error loading subjects:', e)
      }
    }
    fetchSubjects()
  }, [open, supabase])

  const handleOpen = () => {
    setOpen(true)
    setCreatedPassword(null)
    setCreatedUserId(null)
    setError('')
    setCopied(false)
  }

  const resetForm = () => {
    setName('')
    setEmail('')
    setPhone('')
    setSelectedSubjects([])
    setIsSubjectModalOpen(false)
    setSubjectError('')
    setSubjectNotice('')
    setCreatedPassword(null)
    setCreatedUserId(null)
    setError('')
    setCopied(false)
  }

  const handleClose = () => {
    setOpen(false)
    resetForm()
    onSuccess()
  }

  const handleSelectSubject = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value
    if (!val) return
    if (!selectedSubjects.includes(val)) {
      setSelectedSubjects(prev => [...prev, val])
    }
    setSubjectNotice('')
    setSubjectError('')
    // Reset dropdown selection
    e.target.value = ''
  }

  const handleRemoveSubject = (subj: string) => {
    setSelectedSubjects(prev => prev.filter(s => s !== subj))
  }

  const handleSubjectModalSuccess = (updatedMap: Record<string, string>) => {
    const newKeys = Object.keys(updatedMap).sort((a, b) => a.localeCompare(b))
    setAvailableSubjects(newKeys)

    // Auto select newly added subjects
    const newlyAdded = newKeys.filter(k => !availableSubjects.includes(k))
    if (newlyAdded.length > 0) {
      setSelectedSubjects(prev => Array.from(new Set([...prev, ...newlyAdded])))
      setSubjectNotice(`Subject "${newlyAdded.join(', ')}" added and selected.`)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !email.trim()) {
      setError('Full name and email are required.')
      return
    }

    if (selectedSubjects.length === 0) {
      setError('Subject selection is required. Please select or add at least one subject.')
      return
    }

    setLoading(true)
    setError('')

    const tempPassword = generateTempPassword()

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
          phone: phone.trim() || undefined,
          tempPassword,
          subjects: selectedSubjects,
        }),
      })

      const data = await res.json()

      if (!res.ok || data.error) {
        const errMsg = data.error || `Server returned error status ${res.status}`
        setError(errMsg)
        setLoading(false)
        return
      }

      if (data.userId) setCreatedUserId(data.userId)
      setCreatedPassword(tempPassword)
      setLoading(false)
    } catch (err: any) {
      console.error('[AddTeacherModal] Network or unexpected error:', err)
      setError('Unable to save new teacher account. Please check the details and try again.')
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
                    : 'Enter the teacher’s details and assigned subject to generate an account.'}
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

                {/* Step 2 Guidance Banner (Consistent with Prompt 4 Timetable Guidance Pattern) */}
                <div style={{
                  padding: '16px',
                  borderRadius: '14px',
                  background: '#F3E8FF',
                  border: '1px solid #E9D5FF',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: 32,
                      height: 32,
                      borderRadius: 10,
                      background: H.purple,
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <Sparkles size={16} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{
                          fontSize: '10px',
                          fontWeight: 800,
                          color: H.purpleDark,
                          background: '#E9D5FF',
                          padding: '2px 8px',
                          borderRadius: 12,
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                        }}>
                          Step 2: Next Steps
                        </span>
                      </div>
                      <h4 style={{ fontFamily: H.font, fontSize: '14px', fontWeight: 700, color: H.textPrimary, margin: '2px 0 0' }}>
                        Recommended Onboarding Actions
                      </h4>
                    </div>
                  </div>

                  <p style={{ fontSize: '12px', color: H.textSec, margin: 0, lineHeight: 1.4 }}>
                    Teacher account created. You can now optionally assign this teacher as a Class Teacher or manage profile details:
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <Link
                      href="/admin/classes"
                      onClick={handleClose}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        borderRadius: '10px',
                        background: H.surface,
                        border: `1px solid ${H.border}`,
                        color: H.textPrimary,
                        fontSize: '13px',
                        fontWeight: 600,
                        textDecoration: 'none',
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <GraduationCap size={16} style={{ color: H.purpleDark }} />
                        Assign as Class Teacher (In Charge)
                      </span>
                      <ArrowRight size={14} style={{ color: H.textSec }} />
                    </Link>

                    {createdUserId && (
                      <Link
                        href={`/admin/teachers/${createdUserId}`}
                        onClick={handleClose}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          borderRadius: '10px',
                          background: H.surface,
                          border: `1px solid ${H.border}`,
                          color: H.textPrimary,
                          fontSize: '13px',
                          fontWeight: 600,
                          textDecoration: 'none',
                        }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <UserCheck size={16} style={{ color: H.grass }} />
                          Manage Profile & Password Flags
                        </span>
                        <ArrowRight size={14} style={{ color: H.textSec }} />
                      </Link>
                    )}
                  </div>
                </div>

                <button onClick={handleClose} style={styles.submitButton}>
                  Done & Close
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} style={styles.form}>
                <div>
                  <label style={styles.label} htmlFor="fullName">Full Name *</label>
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
                  <label style={styles.label} htmlFor="email">Email Address *</label>
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
                  <label style={styles.label} htmlFor="phone">Phone Number <span style={{ textTransform: 'none', fontWeight: 500, color: colors.text_muted }}>(Optional)</span></label>
                  <div style={styles.inputContainer}>
                    <Phone size={16} style={styles.inputIcon} />
                    <input
                      id="phone"
                      type="tel"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      onFocus={() => setFocusedField('phone')}
                      onBlur={() => setFocusedField(null)}
                      placeholder="e.g. +94 77 123 4567"
                      style={inputStyle(focusedField === 'phone')}
                    />
                  </div>
                </div>

                {/* MANDATORY SUBJECT FIELD WITH REUSED SUBJECT MODAL */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <label style={{ ...styles.label, marginBottom: 0 }} htmlFor="subjectSelect">
                      Subject * <span style={{ textTransform: 'none', fontWeight: 500, color: colors.danger_text }}>(Required)</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => { setIsSubjectModalOpen(true); setSubjectError(''); setSubjectNotice(''); }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: colors.success_green,
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: 0,
                      }}
                    >
                      <Plus size={14} /> Add New Subject
                    </button>
                  </div>

                  {/* Selected Subjects Tags */}
                  {selectedSubjects.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
                      {selectedSubjects.map(subj => (
                        <span
                          key={subj}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '4px 10px',
                            borderRadius: '20px',
                            backgroundColor: H.purpleLight,
                            color: H.purpleDark,
                            fontSize: '12px',
                            fontWeight: 700,
                            border: `1px solid ${H.purple}30`,
                          }}
                        >
                          {subj}
                          <button
                            type="button"
                            onClick={() => handleRemoveSubject(subj)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: H.purpleDark,
                              cursor: 'pointer',
                              padding: 0,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderRadius: '50%',
                            }}
                          >
                            <X size={12} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Dropdown Selection */}
                  <div style={styles.inputContainer}>
                    <Book size={16} style={styles.inputIcon} />
                    <select
                      id="subjectSelect"
                      onChange={handleSelectSubject}
                      defaultValue=""
                      onFocus={() => setFocusedField('subjects')}
                      onBlur={() => setFocusedField(null)}
                      style={{
                        ...inputStyle(focusedField === 'subjects'),
                        appearance: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      <option value="" disabled>-- Select a subject --</option>
                      {availableSubjects.map(subj => (
                        <option key={subj} value={subj} disabled={selectedSubjects.includes(subj)}>
                          {subj} {selectedSubjects.includes(subj) ? '(Selected)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {subjectNotice && (
                    <p style={{ fontSize: '12px', color: colors.success_dark, marginTop: '6px', fontWeight: 600 }}>
                      ✓ {subjectNotice}
                    </p>
                  )}
                  {selectedSubjects.length === 0 && (
                    <p style={{ fontSize: '12px', color: colors.text_muted, marginTop: '6px' }}>
                      At least one subject must be assigned to the teacher.
                    </p>
                  )}
                </div>

                <button type="submit" disabled={loading} style={{ ...styles.submitButton, opacity: loading ? 0.7 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}>
                  {loading ? <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Creating Account…</> : 'Create Account & Generate Password'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Reused Subject & Color Manager Modal */}
      <SubjectModal
        isOpen={isSubjectModalOpen}
        onClose={() => setIsSubjectModalOpen(false)}
        onSuccess={handleSubjectModalSuccess}
      />
    </Fragment>
  )
}
