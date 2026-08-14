'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  ArrowRightLeft,
  Calendar,
  Clock,
  User,
  BookOpen,
  FileText,
  Loader2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { H } from '@/lib/honey'
import { getCurrentSLTDate } from '@/lib/calendarService'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

interface TeacherProfile {
  id: string
  full_name: string
  subjects?: string[]
}

interface ClassItem {
  id: string
  name: string
  grade_level?: number
}

const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8]

export default function NewTeacherSwapPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentUser, setCurrentUser] = useState<any>(null)

  const [teachers, setTeachers] = useState<TeacherProfile[]>([])
  const [classes, setClasses] = useState<ClassItem[]>([])

  // Form State
  const [form, setForm] = useState({
    swap_date: getCurrentSLTDate(),
    requester_period: 1,
    requester_class_id: '',
    target_teacher_id: '',
    target_period: 1,
    target_class_id: '',
    note: '',
  })

  // Load User, Teachers & Classes
  const loadInitialData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .eq('id', user.id)
        .single()

      setCurrentUser({ id: user.id, full_name: profile?.full_name || user.email })

      // Fetch other teachers
      const { data: teacherList, error: tErr } = await supabase
        .from('profiles')
        .select('id, full_name, subjects')
        .neq('id', user.id)
        .order('full_name', { ascending: true })

      if (tErr) throw tErr
      setTeachers(teacherList || [])

      // Fetch classes
      const { data: classList, error: cErr } = await supabase
        .from('classes')
        .select('id, name, grade_level')
        .order('name', { ascending: true })

      if (cErr) throw cErr
      setClasses(classList || [])
    } catch (err: any) {
      console.error('[NewSwapPage] Load error:', err)
      setError(err.message || 'Failed to load initial data')
    } finally {
      setLoading(false)
    }
  }, [supabase, router])

  useEffect(() => {
    loadInitialData()
  }, [loadInitialData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentUser) return

    if (!form.target_teacher_id) {
      setError('Please select a target teacher to swap with.')
      return
    }
    if (!form.swap_date) {
      setError('Please select a valid swap date.')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const payload = {
        requester_id: currentUser.id,
        target_teacher_id: form.target_teacher_id,
        requester_period: Number(form.requester_period),
        target_period: Number(form.target_period),
        requester_class_id: form.requester_class_id || null,
        target_class_id: form.target_class_id || null,
        swap_date: form.swap_date,
        note: form.note.trim() || null,
        status: 'pending',
      }

      const { data: inserted, error: insertErr } = await supabase
        .from('swap_requests')
        .insert(payload)
        .select('id')
        .single()

      if (insertErr) throw insertErr

      // Send Notification to Target Teacher
      const targetTeacher = teachers.find(t => t.id === form.target_teacher_id)
      await supabase.from('notifications').insert({
        user_id: form.target_teacher_id,
        type: 'swap_request',
        title: 'New Class Swap Request',
        body: `${currentUser.full_name || 'A teacher'} requested a class swap for ${form.swap_date} (Period ${form.requester_period} for Period ${form.target_period}).`,
        link: '/teacher/swaps',
        is_read: false
      })

      router.push('/teacher/swaps?created=true')
    } catch (err: any) {
      console.error('[NewSwapPage] Insert error:', err)
      setError('Could not submit swap request. Please check the form details and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <LoadingSpinner centered size={32} color={H.purple} />
      </div>
    )
  }

  return (
    <div style={{ backgroundColor: H.bg, minHeight: '100vh', padding: 'clamp(16px, 3vw, 32px)', fontFamily: H.font }}>
      <div style={{ maxWidth: '640px', margin: '0 auto' }}>

        {/* Back Link */}
        <Link
          href="/teacher/swaps"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            color: H.textSec,
            fontSize: '13px',
            fontWeight: 600,
            textDecoration: 'none',
            marginBottom: '20px'
          }}
        >
          <ArrowLeft size={16} /> Back to Swap Requests
        </Link>

        {/* Header */}
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: H.textPrimary, margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ArrowRightLeft size={24} style={{ color: H.purple }} />
            Request Period / Class Swap
          </h1>
          <p style={{ fontSize: '14px', color: H.textSec, margin: '4px 0 0' }}>
            Propose a period exchange with a fellow teacher. Peer approval is required before admin finalization.
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div style={{ backgroundColor: H.dangerLight, border: `1px solid ${H.danger}`, borderRadius: H.radius.md, padding: '12px 16px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px', color: H.danger, fontSize: '13px', fontWeight: 600 }}>
            <AlertCircle size={16} />
            <span style={{ flex: 1 }}>{error}</span>
          </div>
        )}

        {/* Form Card */}
        <div style={{ backgroundColor: H.surface, border: `1px solid ${H.border}`, borderRadius: H.radius.xl, boxShadow: H.shadows.card, padding: '24px' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* 1. Date of Swap */}
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: H.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                Date of Swap
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="date"
                  value={form.swap_date}
                  onChange={e => setForm(f => ({ ...f, swap_date: e.target.value }))}
                  required
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: H.radius.md,
                    border: `1px solid ${H.border}`,
                    backgroundColor: H.bg,
                    color: H.textPrimary,
                    fontSize: '14px',
                    fontFamily: H.font,
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            {/* 2. My Period & Class */}
            <div style={{ backgroundColor: H.bg, border: `1px solid ${H.border}`, borderRadius: H.radius.lg, padding: '16px' }}>
              <span style={{ fontSize: '12px', fontWeight: 800, color: H.purple, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '12px' }}>
                Your Assigned Period (To Give Away)
              </span>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: H.textMuted, marginBottom: '4px' }}>
                    My Period
                  </label>
                  <select
                    value={form.requester_period}
                    onChange={e => setForm(f => ({ ...f, requester_period: Number(e.target.value) }))}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: H.radius.md,
                      border: `1px solid ${H.border}`,
                      backgroundColor: H.surface,
                      color: H.textPrimary,
                      fontSize: '13px',
                      fontFamily: H.font,
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  >
                    {PERIODS.map(p => (
                      <option key={p} value={p}>Period {p}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: H.textMuted, marginBottom: '4px' }}>
                    My Class (Optional)
                  </label>
                  <select
                    value={form.requester_class_id}
                    onChange={e => setForm(f => ({ ...f, requester_class_id: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: H.radius.md,
                      border: `1px solid ${H.border}`,
                      backgroundColor: H.surface,
                      color: H.textPrimary,
                      fontSize: '13px',
                      fontFamily: H.font,
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  >
                    <option value="">Select Class...</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* 3. Target Teacher */}
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: H.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                Select Target Teacher to Swap With
              </label>
              <select
                value={form.target_teacher_id}
                onChange={e => setForm(f => ({ ...f, target_teacher_id: e.target.value }))}
                required
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: H.radius.md,
                  border: `1px solid ${H.border}`,
                  backgroundColor: H.bg,
                  color: H.textPrimary,
                  fontSize: '14px',
                  fontFamily: H.font,
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              >
                <option value="">Choose a teacher...</option>
                {teachers.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.full_name} {t.subjects && t.subjects.length > 0 ? `(${t.subjects.join(', ')})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* 4. Target Teacher's Period & Class */}
            <div style={{ backgroundColor: H.bg, border: `1px solid ${H.border}`, borderRadius: H.radius.lg, padding: '16px' }}>
              <span style={{ fontSize: '12px', fontWeight: 800, color: H.skyDark, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '12px' }}>
                Target Period Requested (To Take Over)
              </span>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: H.textMuted, marginBottom: '4px' }}>
                    Target Period
                  </label>
                  <select
                    value={form.target_period}
                    onChange={e => setForm(f => ({ ...f, target_period: Number(e.target.value) }))}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: H.radius.md,
                      border: `1px solid ${H.border}`,
                      backgroundColor: H.surface,
                      color: H.textPrimary,
                      fontSize: '13px',
                      fontFamily: H.font,
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  >
                    {PERIODS.map(p => (
                      <option key={p} value={p}>Period {p}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: H.textMuted, marginBottom: '4px' }}>
                    Target Class (Optional)
                  </label>
                  <select
                    value={form.target_class_id}
                    onChange={e => setForm(f => ({ ...f, target_class_id: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: H.radius.md,
                      border: `1px solid ${H.border}`,
                      backgroundColor: H.surface,
                      color: H.textPrimary,
                      fontSize: '13px',
                      fontFamily: H.font,
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  >
                    <option value="">Select Class...</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* 5. Note / Reason */}
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: H.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                Reason / Note for Teacher & Admin (Optional)
              </label>
              <textarea
                placeholder="Explain the reason for this period swap request..."
                value={form.note}
                onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                rows={3}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: H.radius.md,
                  border: `1px solid ${H.border}`,
                  backgroundColor: H.bg,
                  color: H.textPrimary,
                  fontSize: '13px',
                  fontFamily: H.font,
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Submit Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
              <Link
                href="/teacher/swaps"
                style={{
                  padding: '10px 18px',
                  borderRadius: H.radius.md,
                  border: `1px solid ${H.border}`,
                  backgroundColor: H.surface,
                  color: H.textSec,
                  fontWeight: 600,
                  fontSize: '13px',
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center'
                }}
              >
                Cancel
              </Link>

              <button
                type="submit"
                disabled={submitting}
                style={{
                  padding: '10px 24px',
                  borderRadius: H.radius.md,
                  backgroundColor: H.purple,
                  color: '#FFFFFF',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: H.shadows.sm
                }}
              >
                {submitting ? (
                  <>
                    <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Submitting...
                  </>
                ) : (
                  <>
                    <ArrowRightLeft size={16} /> Submit Swap Request
                  </>
                )}
              </button>
            </div>

          </form>
        </div>
      </div>
    </div>
  )
}
