'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, CheckCircle2, KeyRound, AlertTriangle, User, Phone, BookOpen, Info, ShieldCheck, Mail, Lock, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatSLT } from '@/lib/utils'
import { H } from '@/lib/honey'
import { SkeletonBlock } from '@/components/ui/Skeleton'
import ChangePasswordModal from '@/components/teacher/ChangePasswordModal'

const DEFAULT_SUBJECT_COLORS: Record<string, string> = {
  English: '#3B82F6',
  Maths: '#6366F1',
  Mathematics: '#6366F1',
  Science: '#10B981',
  History: '#F59E0B',
  Music: '#EAB308',
  Sinhala: '#F97316',
  Tamil: '#8B5CF6',
  Geography: '#0284C7',
  ICT: '#84CC16',
  Art: '#EC4899',
  PE: '#059669',
  Religion: '#7C3AED',
  Commerce: '#D946EF',
  Biology: '#14B8A6',
  Chemistry: '#4338CA',
  Physics: '#0EA5E9',
  Economics: '#B45309',
  'Combined Maths': '#E11D48',
}

const styles: { [key: string]: React.CSSProperties } = {
  page: { backgroundColor: H.bg, minHeight: '100vh', padding: 'clamp(16px, 3vw, 28px)', fontFamily: H.font, boxSizing: 'border-box', paddingBottom: '96px' },
  card: { backgroundColor: H.surface, border: `1px solid ${H.border}`, borderRadius: '16px', boxShadow: H.cardShadow, overflow: 'hidden' },
  button: { border: 'none', borderRadius: '10px', fontWeight: 700, fontSize: '13px', padding: '10px 18px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', textDecoration: 'none', minHeight: '40px', transition: 'all 0.15s ease' },
  buttonPrimary: { background: H.grass, color: 'white' },
  buttonSecondary: { background: H.surface, color: H.textSec, border: `1px solid ${H.border}` },
  label: { display: 'block', fontSize: '11px', fontWeight: 700, color: H.textMuted, textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: '8px' },
  sectionHeader: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' },
  sectionIconContainer: { width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: '15px', fontWeight: 700, color: H.textPrimary, margin: 0 },
  sectionSubtitle: { fontSize: '12px', color: H.textSec, margin: '2px 0 0' },
}

const inputStyle = (isFocused: boolean): React.CSSProperties => ({
  width: '100%',
  padding: '12px 16px 12px 42px',
  borderRadius: '10px',
  border: `2px solid ${isFocused ? H.grass : H.border}`,
  background: H.surface,
  color: H.textPrimary,
  fontFamily: H.font,
  fontSize: '14px',
  outline: 'none',
  boxSizing: 'border-box' as const,
  transition: 'border-color 0.2s ease',
  minHeight: '44px',
})

const readOnlyInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 16px 12px 42px',
  borderRadius: '10px',
  border: `1px solid ${H.border}`,
  background: '#FAF9F6',
  color: H.textSec,
  fontFamily: H.font,
  fontSize: '14px',
  outline: 'none',
  boxSizing: 'border-box' as const,
  minHeight: '44px',
  cursor: 'not-allowed',
}

function getInitials(name?: string) {
  if (!name) return 'T'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default function TeacherProfilePage() {
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [profile, setProfile] = useState<any>(null)
  const [pendingRequest, setPendingRequest] = useState<any>(null)
  const [form, setForm] = useState({ full_name: '', phone: '' })
  const [focusedField, setFocusedField] = useState<string | null>(null)
  const [showPasswordModal, setShowPasswordModal] = useState(false)

  const supabase = createClient()
  const router = useRouter()

  const baselineName = pendingRequest?.new_full_name ? pendingRequest.new_full_name : (profile?.full_name || '')
  const baselinePhone = pendingRequest?.new_phone ? pendingRequest.new_phone : (profile?.phone || '')

  const hasChanges = profile && (
    form.full_name.trim() !== baselineName ||
    form.phone.trim() !== baselinePhone
  )

  useEffect(() => {
    const load = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user) { router.push('/teacher/login'); return }

        const userEmail = session.user.email?.toLowerCase()

        const [{ data: prof }, { data: pending }, allowedRes, { data: schedData }] = await Promise.all([
          supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle(),
          supabase.from('profile_change_requests').select('*').eq('teacher_id', session.user.id).eq('status', 'pending').order('created_at', { ascending: false }).limit(1).maybeSingle(),
          userEmail ? Promise.resolve(supabase.from('allowed_users').select('subjects, role').eq('email', userEmail).maybeSingle()).catch(() => ({ data: null })) : Promise.resolve({ data: null }),
          supabase.from('schedule_assignments').select('subject').eq('teacher_id', session.user.id),
        ])

        const allowed = allowedRes?.data || null
        let profileData = prof

        if (!profileData && userEmail) {
          const isAdmin = allowed?.role === 'admin'

          profileData = {
            id: session.user.id,
            email: userEmail,
            full_name: session.user.user_metadata?.full_name || userEmail.split('@')[0] || (isAdmin ? 'Admin' : 'Teacher'),
            role: isAdmin ? 'admin' : 'teacher',
            subjects: allowed?.subjects || [],
            must_change_password: false,
            is_active: true
          }
          await supabase.from('profiles').upsert(profileData)
        }

        if (!profileData) { router.push('/teacher/login'); return }

        const existingProfileSubs: string[] = profileData.subjects || []
        const allowedSubs: string[] = allowed?.subjects || []
        const schedSubs: string[] = (schedData || []).map((s: any) => s.subject).filter(Boolean)

        const mergedSubjects = Array.from(new Set([...existingProfileSubs, ...allowedSubs, ...schedSubs]))
          .filter((s): s is string => typeof s === 'string' && s.trim().length > 0 && s !== 'Other')
          .sort((a, b) => a.localeCompare(b))

        if (JSON.stringify(existingProfileSubs.sort()) !== JSON.stringify(mergedSubjects) && mergedSubjects.length > 0) {
          await supabase.from('profiles').update({ subjects: mergedSubjects }).eq('id', session.user.id)
          profileData.subjects = mergedSubjects
        }

        setProfile(profileData)
        setPendingRequest(pending || null)

        const initialName: string = pending?.new_full_name ? pending.new_full_name : (profileData.full_name || '')
        const initialPhone: string = pending?.new_phone ? pending.new_phone : (profileData.phone || '')

        setForm({ full_name: initialName, phone: initialPhone })

        if (profileData.must_change_password) {
          setShowPasswordModal(true)
        } else if (typeof window !== 'undefined' && window.location.search.includes('changePassword=true')) {
          router.replace('/teacher/profile')
        }
      } catch (err) {
        console.error('[TeacherProfilePage] load error:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [router, supabase])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) { setError('Not authenticated'); setSubmitting(false); return }

    const payload: any = {}
    if (form.full_name.trim() !== (profile?.full_name || '')) payload.new_full_name = form.full_name.trim()
    if (form.phone.trim() !== (profile?.phone || '')) payload.new_phone = form.phone.trim()

    if (Object.keys(payload).length === 0) {
      setError('No profile changes detected to submit.')
      setSubmitting(false)
      return
    }

    const { data: insertedReq, error: err } = await supabase
      .from('profile_change_requests')
      .insert({ teacher_id: session.user.id, status: 'pending', ...payload })
      .select()
      .maybeSingle()

    if (err) {
      console.error('Failed to submit profile change request:', err.message)
      setError('Could not submit profile update request. Please try again.')
    } else {
      setSuccess(true)
      if (insertedReq) setPendingRequest(insertedReq)
      setTimeout(() => setSuccess(false), 5000)
    }
    setSubmitting(false)
  }

  if (loading) {
    return (
      <div style={{ backgroundColor: H.bg, minHeight: '100vh', padding: 'clamp(16px, 3vw, 28px)', fontFamily: H.font, boxSizing: 'border-box' }}>
        <div style={{ backgroundColor: H.surface, border: `1px solid ${H.border}`, borderRadius: '16px', boxShadow: H.cardShadow, overflow: 'hidden', maxWidth: '800px', margin: '0 auto' }}>
          <div style={{ padding: '20px 24px', borderBottom: `1px solid ${H.border}`, display: 'flex', alignItems: 'center', gap: '12px' }}>
            <SkeletonBlock width="44px" height="44px" borderRadius="50%" />
            <div>
              <SkeletonBlock width="160px" height="20px" />
              <SkeletonBlock width="200px" height="14px" />
            </div>
          </div>
          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <SkeletonBlock width="40%" height="16px" />
            <SkeletonBlock width="100%" height="40px" />
            <SkeletonBlock width="40%" height="16px" />
            <SkeletonBlock width="100%" height="40px" />
          </div>
        </div>
      </div>
    )
  }

  const assignedSubjects: string[] = profile?.subjects || []
  const subjectColors: Record<string, string> = profile?.subject_colors || {}

  return (
    <div style={{ backgroundColor: H.bg, minHeight: '100vh', padding: 'clamp(16px, 3vw, 28px)', fontFamily: H.font, boxSizing: 'border-box', paddingBottom: '96px' }}>
      <div style={{ maxWidth: '780px', margin: '0 auto' }}>
        <div style={styles.card}>

          {/* HERO HEADER BAR */}
          <div style={{ padding: '24px', borderBottom: `1px solid ${H.border}`, backgroundColor: H.surface }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{
                  width: 52,
                  height: 52,
                  borderRadius: '50%',
                  backgroundColor: H.grass,
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '18px',
                  fontWeight: 800,
                  letterSpacing: '0.05em',
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)'
                }}>
                  {getInitials(profile?.full_name || profile?.email)}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h1 style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-0.02em', color: H.textPrimary, margin: 0 }}>
                      {profile?.full_name || 'Teacher Profile'}
                    </h1>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '12px',
                      backgroundColor: H.successLight,
                      color: '#065F46',
                      fontSize: '11px',
                      fontWeight: 700,
                      textTransform: 'uppercase'
                    }}>
                      Teacher
                    </span>
                  </div>
                  <p style={{ fontSize: '13px', color: H.textSec, margin: '4px 0 0' }}>{profile?.email}</p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(true)}
                  style={{ ...styles.button, ...styles.buttonSecondary, minHeight: '38px', fontSize: '13px' }}
                >
                  <KeyRound size={14} /> Change Password
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await supabase.auth.signOut()
                    window.location.href = '/'
                  }}
                  style={{
                    ...styles.button,
                    backgroundColor: '#FEF2F2',
                    color: '#DC2626',
                    border: '1px solid #FCA5A5',
                    minHeight: '38px',
                    fontSize: '13px'
                  }}
                >
                  <LogOut size={14} /> Sign Out
                </button>
              </div>
            </div>
          </div>

          {/* NOTIFICATION BANNERS */}
          <div style={{ padding: '0 24px' }}>
            {pendingRequest && (
              <div style={{ padding: '14px 18px', marginTop: '20px', background: H.accentLight, border: `1px solid ${H.accent}`, borderRadius: '12px', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <Info size={18} style={{ color: H.accentDark, minWidth: 18, marginTop: 2 }} />
                <div>
                  <h3 style={{ margin: '0 0 4px', color: H.accentDark, fontSize: '13px', fontWeight: 700 }}>Request Pending Approval</h3>
                  <p style={{ margin: 0, fontSize: '12px', color: H.textSec }}>
                    Your profile change request submitted on {formatSLT(pendingRequest.created_at, 'dd MMM')} is awaiting admin review.
                  </p>
                </div>
              </div>
            )}
            {success && (
              <div style={{ padding: '14px 18px', marginTop: '20px', background: H.successLight, border: `1px solid ${H.grass}`, borderRadius: '12px', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <CheckCircle2 size={18} style={{ color: '#065F46', minWidth: 18, marginTop: 2 }} />
                <div>
                  <h3 style={{ margin: '0 0 4px', color: '#065F46', fontSize: '13px', fontWeight: 700 }}>Request Submitted!</h3>
                  <p style={{ margin: 0, fontSize: '12px', color: H.textSec }}>Your requested display name change has been submitted to school administrators for approval.</p>
                </div>
              </div>
            )}
            {error && (
              <div style={{ padding: '12px 16px', marginTop: '16px', background: H.dangerLight, color: H.danger, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '10px', border: `1px solid ${H.danger}40` }}>
                <AlertTriangle size={15} />
                <span>{error}</span>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '28px' }}>

              {/* SECTION 1: PERSONAL INFORMATION (EDITABLE & READ-ONLY EMAIL) */}
              <div>
                <div style={styles.sectionHeader}>
                  <div style={{ ...styles.sectionIconContainer, backgroundColor: H.successLight }}>
                    <User size={16} style={{ color: '#065F46' }} />
                  </div>
                  <div>
                    <h2 style={styles.sectionTitle}>Personal Details</h2>
                    <p style={styles.sectionSubtitle}>Manage your display name, contact number, and account information</p>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                  <div>
                    <label style={styles.label} htmlFor="fullNameInput">Full Display Name</label>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <User size={16} style={{ position: 'absolute', left: 14, color: H.textMuted, pointerEvents: 'none' }} />
                      <input
                        id="fullNameInput"
                        value={form.full_name}
                        onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                        onFocus={() => setFocusedField('name')}
                        onBlur={() => setFocusedField(null)}
                        placeholder="e.g. Nimali Perera"
                        style={inputStyle(focusedField === 'name')}
                      />
                    </div>
                    <p style={{ fontSize: '11px', color: H.textMuted, marginTop: '6px', margin: '6px 0 0' }}>
                      Submits a change request for admin approval before updating.
                    </p>
                  </div>

                  <div>
                    <label style={styles.label} htmlFor="phoneInput">Phone Number</label>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <Phone size={16} style={{ position: 'absolute', left: 14, color: H.textMuted, pointerEvents: 'none' }} />
                      <input
                        id="phoneInput"
                        value={form.phone}
                        onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                        onFocus={() => setFocusedField('phone')}
                        onBlur={() => setFocusedField(null)}
                        placeholder="+94 77 123 4567"
                        style={inputStyle(focusedField === 'phone')}
                      />
                    </div>
                  </div>

                  {/* READ-ONLY EMAIL ADDRESS WITH AUTHENTICATION EXPLANATION NOTE */}
                  <div style={{ gridColumn: '1 / -1' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <label style={{ ...styles.label, marginBottom: 0 }} htmlFor="emailInput">Email Address</label>
                      <span style={{ fontSize: '11px', color: H.textMuted, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <Lock size={12} /> Tied to Login Credentials
                      </span>
                    </div>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <Mail size={16} style={{ position: 'absolute', left: 14, color: H.textMuted, pointerEvents: 'none' }} />
                      <input
                        id="emailInput"
                        value={profile?.email || ''}
                        readOnly
                        disabled
                        style={readOnlyInputStyle}
                      />
                    </div>
                    <p style={{ fontSize: '11px', color: H.textMuted, marginTop: '6px' }}>
                      Your email address is permanently linked to your authentication credentials. To update your account email, please contact a school administrator.
                    </p>
                  </div>
                </div>
              </div>

              <hr style={{ border: 'none', borderTop: `1px solid ${H.border}`, margin: 0 }} />

              {/* SECTION 2: ASSIGNED SUBJECTS (READ-ONLY) */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
                  <div style={styles.sectionHeader}>
                    <div style={{ ...styles.sectionIconContainer, backgroundColor: H.purpleLight }}>
                      <BookOpen size={16} style={{ color: H.purpleDark }} />
                    </div>
                    <div>
                      <h2 style={styles.sectionTitle}>Assigned Subjects</h2>
                      <p style={styles.sectionSubtitle}>Subjects currently assigned to you by administrators</p>
                    </div>
                  </div>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 10px',
                    borderRadius: '20px',
                    backgroundColor: H.bg,
                    border: `1px solid ${H.border}`,
                    color: H.textMuted,
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase'
                  }}>
                    <ShieldCheck size={12} /> Read-Only
                  </span>
                </div>

                {/* Read-Only Subject Badges */}
                <div style={{
                  padding: '16px',
                  borderRadius: '12px',
                  backgroundColor: H.bg,
                  border: `1px solid ${H.border}`,
                  marginBottom: '14px'
                }}>
                  {assignedSubjects.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                      {assignedSubjects.map(subj => {
                        const themeColor = subjectColors[subj] || DEFAULT_SUBJECT_COLORS[subj] || H.grass
                        return (
                          <span
                            key={subj}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '8px',
                              padding: '8px 14px',
                              borderRadius: '24px',
                              backgroundColor: H.surface,
                              border: `1px solid ${H.border}`,
                              color: H.textPrimary,
                              fontSize: '13px',
                              fontWeight: 700,
                              boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                            }}
                          >
                            <span style={{
                              width: 10,
                              height: 10,
                              borderRadius: '50%',
                              backgroundColor: themeColor,
                              display: 'inline-block',
                              flexShrink: 0
                            }} />
                            {subj}
                          </span>
                        )
                      })}
                    </div>
                  ) : (
                    <p style={{ margin: 0, fontSize: '13px', color: H.textMuted, fontStyle: 'italic' }}>
                      No subjects currently assigned by admin.
                    </p>
                  )}
                </div>

                {/* Clear Callout Guidance Note for Teachers */}
                <div style={{
                  padding: '12px 16px',
                  borderRadius: '12px',
                  backgroundColor: '#F5F3FF',
                  border: '1px solid #DDD6FE',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px'
                }}>
                  <Info size={16} style={{ color: '#6D28D9', minWidth: 16, marginTop: 2 }} />
                  <p style={{ margin: 0, fontSize: '12px', color: '#5B21B6', lineHeight: 1.5, fontWeight: 500 }}>
                    <strong>Subject Assignment Notice:</strong> Subject assignments are managed by school administrators. If your listed subjects are incorrect or need updating, please contact your school administrator to update your profile in the Admin Dashboard.
                  </p>
                </div>
              </div>

            </div>

            {/* ACTION FOOTER */}
            <div style={{
              padding: '16px 24px',
              borderTop: `1px solid ${H.border}`,
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px',
              backgroundColor: '#FAF9F6'
            }}>
              <button
                type="submit"
                disabled={submitting || !hasChanges}
                style={{
                  ...styles.button,
                  ...styles.buttonPrimary,
                  opacity: (submitting || !hasChanges) ? 0.5 : 1,
                  cursor: (submitting || !hasChanges) ? 'not-allowed' : 'pointer'
                }}
              >
                {submitting ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <CheckCircle2 size={16} />}
                Request Profile Changes
              </button>
            </div>
          </form>
        </div>
      </div>

      <ChangePasswordModal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        isForced={profile?.must_change_password}
      />
    </div>
  )
}
