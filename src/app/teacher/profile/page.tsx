'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2, CheckCircle2, AlertCircle, KeyRound, AlertTriangle, User } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatSLT } from '@/lib/utils'
import { H } from '@/lib/honey'
import { SkeletonBlock } from '@/components/ui/Skeleton'

const styles: { [key: string]: React.CSSProperties } = {
  page: { backgroundColor: H.bg, minHeight: '100vh', padding: 'clamp(16px, 3vw, 32px)', fontFamily: H.font },
  pageHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' },
  pageTitle: { fontSize: '24px', fontWeight: 800, color: H.textPrimary, margin: 0 },
  pageSubtitle: { fontSize: '14px', color: H.textSec, marginTop: '4px', margin: '4px 0 0' },
  card: { backgroundColor: H.surface, border: `1px solid ${H.border}`, borderRadius: '16px', boxShadow: H.cardShadow, overflow: 'hidden' },
  button: { border: 'none', borderRadius: '10px', fontWeight: 700, fontSize: '13px', padding: '10px 18px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', textDecoration: 'none', minHeight: '40px', transition: 'all 0.15s ease' },
  buttonPrimary: { background: H.grass, color: 'white' },
  buttonSecondary: { background: H.surface, color: H.textSec, border: `1px solid ${H.border}` },
  label: { display: 'block', fontSize: '11px', fontWeight: 700, color: H.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' },
}

const inputStyle = (isFocused: boolean): React.CSSProperties => ({
  width: '100%', padding: '12px 16px', borderRadius: '10px',
  border: `2px solid ${isFocused ? H.grass : H.border}`,
  background: H.bg, color: H.textPrimary, fontFamily: H.font,
  fontSize: '14px', outline: 'none', boxSizing: 'border-box' as const,
  transition: 'border-color 0.2s ease', minHeight: '44px',
})

const ALL_SUBJECTS = ['Maths','Science','English','Sinhala','Tamil','History','Geography','ICT','Art','Music','PE','Religion','Commerce','Biology','Chemistry','Physics','Economics','Combined Maths','Other']

export default function TeacherProfilePage() {
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [profile, setProfile] = useState<any>(null)
  const [pendingRequest, setPendingRequest] = useState<any>(null)
  const [form, setForm] = useState({ full_name: '', phone: '', subjects: [] as string[] })
  const [focusedField, setFocusedField] = useState<string | null>(null)
  const supabase = createClient()
  const router = useRouter()

  const hasChanges = profile && (
    form.full_name.trim() !== (profile.full_name || '') ||
    form.phone.trim() !== (profile.phone || '') ||
    JSON.stringify([...form.subjects].sort()) !== JSON.stringify([...(profile.subjects || [])].sort())
  )

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) { router.push('/teacher/login'); return }

      const [{ data: prof }, { data: pending }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', session.user.id).single(),
        supabase.from('profile_change_requests').select('*').eq('teacher_id', session.user.id).eq('status', 'pending').order('created_at', { ascending: false }).limit(1).maybeSingle(),
      ])

      let profileData = prof
      if (!profileData && session.user.email) {
        profileData = {
          id: session.user.id,
          email: session.user.email.toLowerCase(),
          full_name: session.user.user_metadata?.full_name || session.user.email.split('@')[0] || 'Teacher',
          role: 'teacher',
          subjects: [],
          must_change_password: false,
          is_active: true
        }
        await supabase.from('profiles').upsert(profileData)
      }

      if (!profileData) { router.push('/teacher/login'); return }
      setProfile(profileData)
      setPendingRequest(pending || null)
      setForm({ full_name: profileData.full_name || '', phone: profileData.phone || '', subjects: profileData.subjects || [] })
      setLoading(false)
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
    if (form.full_name.trim() !== profile.full_name) payload.new_full_name = form.full_name.trim()
    if (form.phone.trim() !== profile.phone) payload.new_phone = form.phone.trim()
    if (JSON.stringify([...form.subjects].sort()) !== JSON.stringify([...(profile.subjects || [])].sort())) payload.new_subjects = form.subjects

    const { error: err } = await supabase.from('profile_change_requests').insert({ teacher_id: session.user.id, status: 'pending', ...payload })
    if (err) { setError(err.message) } else { setSuccess(true); setTimeout(() => setSuccess(false), 4000) }
    setSubmitting(false)
  }

  const toggleSubject = (s: string) => setForm(f => ({ ...f, subjects: f.subjects.includes(s) ? f.subjects.filter(x => x !== s) : [...f.subjects, s] }))

  if (loading) {
    return (
      <div style={{ backgroundColor: H.bg, minHeight: '100vh', padding: 'clamp(16px, 3vw, 28px)', fontFamily: H.font, boxSizing: 'border-box' }}>
        <div style={{ backgroundColor: H.surface, border: `1px solid ${H.border}`, borderRadius: '16px', boxShadow: H.cardShadow, overflow: 'hidden', maxWidth: '800px', margin: '0 auto' }}>
          <div style={{ padding: '20px 24px', borderBottom: `1px solid ${H.border}`, display: 'flex', alignItems: 'center', gap: '12px' }}>
            <SkeletonBlock width="36px" height="36px" borderRadius="10px" />
            <SkeletonBlock width="160px" height="20px" />
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

  return (
    <div style={{ backgroundColor: H.bg, minHeight: '100vh', padding: 'clamp(16px, 3vw, 28px)', fontFamily: H.font, boxSizing: 'border-box', paddingBottom: '96px' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ backgroundColor: H.surface, border: `1px solid ${H.border}`, borderRadius: '16px', boxShadow: H.cardShadow, overflow: 'hidden' }}>

          {/* Contiguous Header Bar */}
          <div style={{ padding: '20px 24px', borderBottom: `1px solid ${H.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', backgroundColor: H.surface }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#D1FAE5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <User size={20} style={{ color: '#059669' }} />
              </div>
              <div>
                <h1 style={{ fontSize: '22px', fontWeight: 600, letterSpacing: '-0.02em', color: H.textPrimary, margin: 0 }}>My Profile</h1>
                <p style={{ fontSize: '13px', color: H.textSec, margin: '4px 0 0' }}>{profile?.email}</p>
              </div>
            </div>
            <Link href="/teacher/change-password" style={{ ...styles.button, ...styles.buttonSecondary, minHeight: '38px', fontSize: '13px' }}>
              <KeyRound size={14} /> Change Password
            </Link>
          </div>

          {/* Notifications */}
          <div style={{ padding: '0 24px' }}>
            {pendingRequest && (
              <div style={{ padding: '16px 20px', marginTop: '20px', background: H.accentLight, border: `1px solid ${H.accent}`, borderRadius: '12px' }}>
                <h3 style={{ margin: '0 0 6px', color: H.accentDark, fontSize: '14px', fontWeight: 700 }}>Request Pending Approval</h3>
                <p style={{ margin: 0, fontSize: '13px', color: H.textSec }}>Your profile change request submitted on {formatSLT(pendingRequest.created_at, 'dd MMM')} is awaiting admin approval.</p>
              </div>
            )}
            {success && (
              <div style={{ padding: '16px 20px', marginTop: '20px', background: H.successLight, border: `1px solid ${H.grass}`, borderRadius: '12px' }}>
                <h3 style={{ margin: '0 0 6px', color: '#065F46', fontSize: '14px', fontWeight: 700 }}>Request Submitted!</h3>
                <p style={{ margin: 0, fontSize: '13px', color: H.textSec }}>An admin will review your changes shortly.</p>
              </div>
            )}
            {error && (
              <div style={{ padding: '12px 16px', marginTop: '16px', background: H.dangerLight, color: H.danger, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '10px', border: `1px solid ${H.danger}40` }}>
                <AlertTriangle size={15} />
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div>
                <label style={styles.label}>Full Display Name</label>
                <input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} onFocus={() => setFocusedField('name')} onBlur={() => setFocusedField(null)} style={inputStyle(focusedField === 'name')} />
              </div>
              <div>
                <label style={styles.label}>Phone Number</label>
                <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} onFocus={() => setFocusedField('phone')} onBlur={() => setFocusedField(null)} style={inputStyle(focusedField === 'phone')} />
              </div>
              <div>
                <label style={styles.label}>Subjects I Teach</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {ALL_SUBJECTS.map(s => (
                    <button key={s} type="button" onClick={() => toggleSubject(s)} style={{ ...styles.button, minHeight: '36px', padding: '6px 14px', background: form.subjects.includes(s) ? H.successLight : H.bg, color: form.subjects.includes(s) ? '#065F46' : H.textSec, border: `1px solid ${form.subjects.includes(s) ? H.grass : H.border}` }}>{s}</button>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ padding: '16px 24px', borderTop: `1px solid ${H.border}`, display: 'flex', justifyContent: 'flex-end', gap: '12px', background: H.bg }}>
              <button type="submit" disabled={submitting || !hasChanges} style={{ ...styles.button, ...styles.buttonPrimary, opacity: (submitting || !hasChanges) ? 0.6 : 1 }}>
                {submitting ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <CheckCircle2 size={16} />}
                Request Profile Changes
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
