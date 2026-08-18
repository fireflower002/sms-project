'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  BookOpen,
  Calendar,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Trash2,
  Key,
  Shield,
  Edit2,
  Save,
  X,
  RefreshCw,
  Clock,
  Briefcase,
  Copy,
  Check,
  Plus
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { H } from '@/lib/honey'
import Badge from '@/components/ui/Badge'
import { ProfileDetailSkeleton } from '@/components/ui/Skeleton'
import ConfirmModal, { ConfirmModalState } from '@/components/ui/ConfirmModal'
import SubjectModal from '@/components/admin/SubjectModal'
import { getSubjectSuggestion, formatSubjectName } from '@/lib/subjectUtils'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

const PREDEFINED_SUBJECTS = [
  'Maths', 'Science', 'English', 'Sinhala', 'Tamil', 'History',
  'Geography', 'ICT', 'Art', 'Music', 'PE', 'Religion',
  'Commerce', 'Biology', 'Chemistry', 'Physics', 'Economics', 'Combined Maths'
]

export default function TeacherDetailClient({ teacherId, initialData }: { teacherId: string; initialData?: any }) {
  const router = useRouter()
  const supabase = createClient()

  const [teacher, setTeacher] = useState<any>(initialData?.teacher || null)
  const [schedule, setSchedule] = useState<any[]>(initialData?.schedule || [])
  const [absences, setAbsences] = useState<any[]>(initialData?.absences || [])
  const [swaps, setSwaps] = useState<any[]>(initialData?.swaps || [])
  const [loading, setLoading] = useState(!initialData)
  const [actionLoading, setActionLoading] = useState(false)
  const [modal, setModal] = useState<ConfirmModalState | null>(null)

  // Phone Editing State
  const [editingPhone, setEditingPhone] = useState(false)
  const [phoneInput, setPhoneInput] = useState(initialData?.teacher?.phone || '')
  const [savingPhone, setSavingPhone] = useState(false)
  const [phoneError, setPhoneError] = useState('')

  // Subject Editing State
  const [editingSubjects, setEditingSubjects] = useState(false)
  const [availableSubjects, setAvailableSubjects] = useState<string[]>(PREDEFINED_SUBJECTS)
  const [subjectsList, setSubjectsList] = useState<string[]>(initialData?.teacher?.subjects || [])
  const [savingSubjects, setSavingSubjects] = useState(false)

  // Reused Subject Modal State
  const [isSubjectModalOpen, setIsSubjectModalOpen] = useState(false)
  const [subjectNotice, setSubjectNotice] = useState('')
  const [subjectError, setSubjectError] = useState('')

  // Temp Password Reset Modal State
  const [resetTempPassword, setResetTempPassword] = useState<string | null>(null)
  const [copiedPass, setCopiedPass] = useState(false)

  // Fetch Available Subjects System-Wide
  const fetchAvailableSubjects = useCallback(async () => {
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
      console.warn('[TeacherDetailPage] Error fetching available subjects:', e)
    }
  }, [supabase])

  const fetchTeacherData = useCallback(async () => {
    setLoading(true)
    await fetchAvailableSubjects()

    const [{ data: prof }, { data: allowed }] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, full_name, email, phone, role, subjects, is_active, must_change_password, created_at')
        .eq('id', teacherId)
        .maybeSingle(),
      supabase
        .from('allowed_users')
        .select('id, full_name, email, phone, role, subjects, must_change_password, created_at')
        .eq('id', teacherId)
        .maybeSingle(),
    ])

    if (!prof) {
      if (allowed) {
        setTeacher({
          id: allowed.id,
          full_name: allowed.full_name,
          email: allowed.email,
          phone: allowed.phone || null,
          role: 'teacher',
          subjects: allowed.subjects || [],
          is_active: true,
          must_change_password: allowed.must_change_password ?? true,
          is_pending: true,
          created_at: allowed.created_at,
        })
        setSubjectsList(allowed.subjects || [])
        setPhoneInput(allowed.phone || '')
      } else {
        setTeacher(null)
      }
      setLoading(false)
      return
    }

    setTeacher(prof)
    setSubjectsList(prof.subjects || [])
    setPhoneInput(prof.phone || '')

    const { data: activeTemplate } = await supabase
      .from('timetable_templates')
      .select('id')
      .eq('is_active', true)
      .maybeSingle()

    if (activeTemplate) {
      const { data: schedData } = await supabase
        .from('schedule_assignments')
        .select('*, class:classes(name, grade_level)')
        .eq('template_id', activeTemplate.id)
        .eq('teacher_id', teacherId)
        .order('day_of_week')
        .order('period_number')

      setSchedule(schedData || [])
    }

    const { data: absData } = await supabase
      .from('absences')
      .select('*')
      .eq('teacher_id', teacherId)
      .order('absence_date', { ascending: false })
      .limit(5)

    setAbsences(absData || [])

    const { data: swapData } = await supabase
      .from('swap_requests')
      .select('*, requester:profiles!requester_id(full_name), target:profiles!target_teacher_id(full_name)')
      .or(`requester_id.eq.${teacherId},target_teacher_id.eq.${teacherId}`)
      .order('created_at', { ascending: false })
      .limit(5)

    setSwaps(swapData || [])
    setLoading(false)
  }, [teacherId, supabase, fetchAvailableSubjects])

  useEffect(() => {
    if (!initialData) {
      fetchTeacherData()
    } else {
      fetchAvailableSubjects()
    }
  }, [initialData, fetchTeacherData, fetchAvailableSubjects])

  const handleSavePhone = async () => {
    setSavingPhone(true)
    setPhoneError('')
    try {
      const val = phoneInput.trim() || null
      const { error: profErr } = await supabase.from('profiles').update({ phone: val }).eq('id', teacherId)
      if (profErr) {
        setPhoneError(profErr.message || 'Failed to update phone number.')
        return
      }
      setTeacher((prev: any) => ({ ...prev, phone: val }))
      setEditingPhone(false)
    } catch (err: any) {
      setPhoneError(err?.message || 'Unexpected error saving phone number.')
    } finally {
      setSavingPhone(false)
    }
  }

  const handleToggleActive = async () => {
    if (!teacher) return
    const newStatus = !teacher.is_active
    const actionLabel = newStatus ? 'Activate' : 'Deactivate'

    setModal({
      title: `${actionLabel} Teacher Account?`,
      message: `Are you sure you want to ${actionLabel.toLowerCase()} ${teacher.full_name}'s account access?`,
      variant: newStatus ? 'neutral' : 'danger',
      confirmLabel: actionLabel,
      onConfirm: async () => {
        setModal(null)
        setActionLoading(true)
        const { error } = await supabase.from('profiles').update({ is_active: newStatus }).eq('id', teacherId)
        if (!error) fetchTeacherData()
        setActionLoading(false)
      },
    })
  }

  const handleTogglePasswordForce = async () => {
    if (!teacher) return
    const nextVal = !teacher.must_change_password
    setActionLoading(true)
    const { error } = await supabase.from('profiles').update({ must_change_password: nextVal }).eq('id', teacherId)
    if (!error) {
      await supabase.from('allowed_users').update({ must_change_password: nextVal }).eq('email', teacher.email)
      fetchTeacherData()
    }
    setActionLoading(false)
  }

  const handleAdminResetPassword = async () => {
    if (!teacher) return
    setActionLoading(true)
    try {
      const res = await fetch('/api/admin/reset-teacher-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teacherId: teacher.id, email: teacher.email }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setModal({
          title: 'Password Reset Failed',
          message: data.error || 'Failed to reset teacher password.',
          variant: 'danger',
          confirmLabel: 'OK',
          cancelLabel: '',
          onConfirm: () => setModal(null),
        })
      } else {
        setResetTempPassword(data.tempPassword)
        fetchTeacherData()
      }
    } catch (err: any) {
      setModal({
        title: 'Error',
        message: err.message || 'An error occurred while resetting teacher password.',
        variant: 'danger',
        confirmLabel: 'OK',
        cancelLabel: '',
        onConfirm: () => setModal(null),
      })
    } finally {
      setActionLoading(false)
    }
  }

  const handleSaveSubjects = async () => {
    setSavingSubjects(true)
    try {
      const { error: profErr } = await supabase.from('profiles').update({ subjects: subjectsList }).eq('id', teacherId)
      if (profErr) {
        setModal({
          title: 'Save Failed',
          message: profErr.message || 'Failed to update teacher subjects in profiles table.',
          variant: 'danger',
          confirmLabel: 'OK',
          cancelLabel: '',
          onConfirm: () => setModal(null),
        })
        setSavingSubjects(false)
        return
      }
      if (teacher?.email) {
        await supabase.from('allowed_users').update({ subjects: subjectsList }).eq('email', teacher.email)
      }
      setEditingSubjects(false)
      setIsSubjectModalOpen(false)
      setSubjectNotice('')
      setSubjectError('')
      await fetchTeacherData()
    } catch (err: any) {
      setModal({
        title: 'Error',
        message: err.message || 'An unexpected error occurred while saving subjects.',
        variant: 'danger',
        confirmLabel: 'OK',
        cancelLabel: '',
        onConfirm: () => setModal(null),
      })
    } finally {
      setSavingSubjects(false)
    }
  }

  const handleSelectSubject = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value
    if (!val) return
    if (!subjectsList.includes(val)) {
      setSubjectsList(prev => [...prev, val])
    }
    setSubjectNotice('')
    setSubjectError('')
    e.target.value = ''
  }

  const handleRemoveSubject = (sub: string) => {
    setSubjectsList(prev => prev.filter(s => s !== sub))
  }

  const handleDeleteTeacher = () => {
    setModal({
      title: 'Delete Teacher?',
      message: `Are you sure you want to delete ${teacher?.full_name}? This action cannot be undone.`,
      variant: 'danger',
      confirmLabel: 'Delete Teacher',
      onConfirm: async () => {
        setModal(null)
        setActionLoading(true)
        await supabase.from('profiles').delete().eq('id', teacherId)
        await supabase.from('allowed_users').delete().eq('email', teacher.email)
        router.push('/admin/teachers')
      },
    })
  }

  if (loading) {
    return <ProfileDetailSkeleton />
  }

  if (!teacher) {
    return (
      <div style={{ padding: '40px 24px', textAlign: 'center' }}>
        <h2 style={{ color: H.textPrimary }}>Teacher Profile Not Found</h2>
        <p style={{ color: H.textSec }}>The requested teacher ID could not be found.</p>
        <Link href="/admin/teachers" style={{ color: H.honey, fontWeight: 700 }}>
          ← Back to Teacher List
        </Link>
      </div>
    )
  }

  return (
    <div style={{ backgroundColor: H.bg, minHeight: '100vh', padding: 'clamp(16px, 3vw, 28px)', fontFamily: H.font, boxSizing: 'border-box' }}>
      {/* Top Header */}
      <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: H.textMuted }}>
          <Link href="/admin/teachers" style={{ color: H.textSec, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
            <ArrowLeft size={16} /> Teachers
          </Link>
          <span>/</span>
          <span style={{ color: H.textPrimary, fontWeight: 700 }}>{teacher.full_name}</span>
        </div>

        <button
          onClick={handleDeleteTeacher}
          disabled={actionLoading}
          style={{ padding: '8px 16px', borderRadius: '10px', backgroundColor: H.dangerLight, color: H.danger, border: 'none', fontWeight: 700, fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <Trash2 size={15} /> Delete Teacher
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px', alignItems: 'start' }}>
        {/* Left Card: Main Profile & Controls */}
        <div style={{ backgroundColor: H.surface, border: `1px solid ${H.border}`, borderRadius: '16px', padding: '24px', boxShadow: H.cardShadow }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
            <div style={{ width: '60px', height: '60px', borderRadius: '50%', backgroundColor: H.skyLight, color: H.skyDark, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: 800 }}>
              {teacher.full_name?.charAt(0) || 'T'}
            </div>
            <div>
              <h1 style={{ fontSize: '20px', fontWeight: 800, color: H.textPrimary, margin: 0 }}>{teacher.full_name}</h1>
              <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                <Badge variant={teacher.is_active ? 'active' : 'inactive'}>
                  {teacher.is_active ? 'Active Account' : 'Inactive'}
                </Badge>
                {teacher.must_change_password && <Badge variant="pending">Must Change Pass</Badge>}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderTop: `1px solid ${H.border}`, paddingTop: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: H.textSec, fontSize: '13px' }}>
              <Mail size={16} /> <span>{teacher.email}</span>
            </div>

            {/* Phone Row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '13px', color: H.textSec }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Phone size={16} />
                {editingPhone ? (
                  <input
                    value={phoneInput}
                    onChange={e => setPhoneInput(e.target.value)}
                    placeholder="Enter phone number"
                    style={{ padding: '4px 8px', borderRadius: '6px', border: `1px solid ${H.border}`, fontSize: '13px', outline: 'none' }}
                  />
                ) : (
                  <span>{teacher.phone || 'No phone added'}</span>
                )}
              </div>

              {editingPhone ? (
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={handleSavePhone} disabled={savingPhone} style={{ border: 'none', background: H.skyBlue, color: '#FFF', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', fontWeight: 700 }}>
                    {savingPhone ? '...' : <Save size={14} />}
                  </button>
                  <button onClick={() => setEditingPhone(false)} style={{ border: 'none', background: H.bg, color: H.textSec, borderRadius: '6px', padding: '4px 8px', cursor: 'pointer' }}>
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <button onClick={() => setEditingPhone(true)} style={{ border: 'none', background: 'transparent', color: H.skyBlue, cursor: 'pointer', fontWeight: 600 }}>
                  <Edit2 size={14} />
                </button>
              )}
            </div>
            {phoneError && <p style={{ fontSize: '11px', color: H.danger, margin: 0 }}>{phoneError}</p>}

            {/* Account Controls */}
            <div style={{ borderTop: `1px solid ${H.border}`, paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                onClick={handleToggleActive}
                disabled={actionLoading}
                style={{ width: '100%', padding: '10px', borderRadius: '10px', border: `1px solid ${H.border}`, background: H.bg, color: H.textPrimary, fontWeight: 700, fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                <Shield size={16} /> {teacher.is_active ? 'Deactivate Account' : 'Activate Account'}
              </button>

              <button
                onClick={handleAdminResetPassword}
                disabled={actionLoading}
                style={{ width: '100%', padding: '10px', borderRadius: '10px', border: `1px solid ${H.border}`, background: H.bg, color: H.textPrimary, fontWeight: 700, fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                <Key size={16} /> Reset Temporary Password
              </button>
            </div>
          </div>
        </div>

        {/* Right Section: Subjects & Timetable Schedule */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Assigned Subjects Card */}
          <div style={{ backgroundColor: H.surface, border: `1px solid ${H.border}`, borderRadius: '16px', padding: '24px', boxShadow: H.cardShadow }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 800, color: H.textPrimary, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BookOpen size={18} /> Assigned Subjects
              </h3>
              <button
                onClick={() => setEditingSubjects(!editingSubjects)}
                style={{ border: 'none', background: 'transparent', color: H.skyBlue, cursor: 'pointer', fontWeight: 700, fontSize: '13px' }}
              >
                {editingSubjects ? 'Done' : 'Edit Subjects'}
              </button>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {subjectsList.length === 0 ? (
                <span style={{ fontSize: '13px', color: H.textMuted }}>No subjects assigned yet.</span>
              ) : (
                subjectsList.map(sub => (
                  <span key={sub} style={{ padding: '6px 12px', borderRadius: '20px', backgroundColor: H.bg, border: `1px solid ${H.border}`, fontSize: '13px', fontWeight: 600, color: H.textPrimary, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {sub}
                    {editingSubjects && (
                      <button onClick={() => handleRemoveSubject(sub)} style={{ border: 'none', background: 'transparent', color: H.danger, cursor: 'pointer', padding: 0 }}>
                        <X size={12} />
                      </button>
                    )}
                  </span>
                ))
              )}
            </div>

            {editingSubjects && (
              <div style={{ marginTop: '16px', borderTop: `1px solid ${H.border}`, paddingTop: '16px', display: 'flex', gap: '10px' }}>
                <select onChange={handleSelectSubject} defaultValue="" style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: `1px solid ${H.border}`, fontSize: '13px' }}>
                  <option value="" disabled>Add subject...</option>
                  {availableSubjects.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <button onClick={handleSaveSubjects} disabled={savingSubjects} style={{ padding: '8px 16px', borderRadius: '8px', background: '#18181B', color: '#FFF', border: 'none', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>
                  {savingSubjects ? 'Saving...' : 'Save'}
                </button>
              </div>
            )}
          </div>

          {/* Active Timetable Schedule Card */}
          <div style={{ backgroundColor: H.surface, border: `1px solid ${H.border}`, borderRadius: '16px', padding: '24px', boxShadow: H.cardShadow }}>
            <h3 style={{ fontSize: '16px', fontWeight: 800, color: H.textPrimary, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calendar size={18} /> Weekly Timetable Schedule ({schedule.length} periods)
            </h3>

            {schedule.length === 0 ? (
              <p style={{ fontSize: '13px', color: H.textMuted, margin: 0 }}>No active timetable assignments for this teacher.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {schedule.map((s: any) => (
                  <div key={s.id} style={{ padding: '12px 16px', borderRadius: '10px', backgroundColor: H.bg, border: `1px solid ${H.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: H.textPrimary }}>{DAYS[(s.day_of_week || 1) - 1]} • Period {s.period_number}</span>
                      <p style={{ fontSize: '12px', color: H.textSec, margin: '2px 0 0' }}>Class: <strong>{s.class?.name || 'Unassigned'}</strong> • Subject: <strong>{s.subject}</strong></p>
                    </div>
                    <Badge variant="category">{s.subject}</Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <ConfirmModal
        open={!!modal}
        {...(modal ?? { title: '', message: '', onConfirm: () => {} })}
        onCancel={() => setModal(null)}
      />
    </div>
  )
}
