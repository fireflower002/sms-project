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
import ConfirmModal, { ConfirmModalState } from '@/components/ui/ConfirmModal'
import SubjectModal from '@/components/admin/SubjectModal'
import { getSubjectSuggestion, formatSubjectName } from '@/lib/subjectUtils'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

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

export default function TeacherDetailPage() {
  const params = useParams()
  const router = useRouter()
  const teacherId = params.id as string
  const supabase = createClient()

  const [teacher, setTeacher] = useState<any>(null)
  const [schedule, setSchedule] = useState<any[]>([])
  const [absences, setAbsences] = useState<any[]>([])
  const [swaps, setSwaps] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [modal, setModal] = useState<ConfirmModalState | null>(null)

  // Phone Editing State
  const [editingPhone, setEditingPhone] = useState(false)
  const [phoneInput, setPhoneInput] = useState('')
  const [savingPhone, setSavingPhone] = useState(false)
  const [phoneError, setPhoneError] = useState('')

  // Subject Editing State
  const [editingSubjects, setEditingSubjects] = useState(false)
  const [availableSubjects, setAvailableSubjects] = useState<string[]>(PREDEFINED_SUBJECTS)
  const [subjectsList, setSubjectsList] = useState<string[]>([])
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

    // Fetch Available Subjects
    await fetchAvailableSubjects()

    // 1. Fetch Profile
    const { data: prof, error: profErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', teacherId)
      .maybeSingle()

    if (profErr || !prof) {
      // Check if it's in allowed_users instead
      const { data: allowed } = await supabase
        .from('allowed_users')
        .select('*')
        .eq('id', teacherId)
        .maybeSingle()

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

    // 2. Fetch Active Timetable Schedule
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

    // 3. Fetch Recent Absences
    const { data: absData } = await supabase
      .from('absences')
      .select('*')
      .eq('teacher_id', teacherId)
      .order('absence_date', { ascending: false })
      .limit(5)

    setAbsences(absData || [])

    // 4. Fetch Recent Swaps
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
    fetchTeacherData()
  }, [fetchTeacherData])

  // Save Phone Number
  const handleSavePhone = async () => {
    setSavingPhone(true)
    setPhoneError('')
    try {
      const val = phoneInput.trim() || null
      const { error: profErr } = await supabase.from('profiles').update({ phone: val }).eq('id', teacherId)
      if (profErr) {
        console.error('[TeacherDetailPage] Failed to update phone in profiles:', profErr)
        setPhoneError(profErr.message || 'Failed to update phone number.')
        return
      }

      setTeacher((prev: any) => ({ ...prev, phone: val }))
      setEditingPhone(false)
    } catch (err: any) {
      console.error('[TeacherDetailPage] Exception saving phone:', err)
      setPhoneError(err?.message || 'Unexpected error saving phone number.')
    } finally {
      setSavingPhone(false)
    }
  }

  // Toggle Account Active Status
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
        const { error } = await supabase
          .from('profiles')
          .update({ is_active: newStatus })
          .eq('id', teacherId)

        if (error) {
          console.error('Failed to update teacher status:', error.message)
          setModal({
            title: 'Action Failed',
            message: 'Could not update profile details. Please try again.',
            variant: 'danger',
            confirmLabel: 'OK',
            cancelLabel: '',
            onConfirm: () => setModal(null),
          })
        } else {
          fetchTeacherData()
        }
        setActionLoading(false)
      },
    })
  }

  // Toggle Forced Password Reset Requirement
  const handleTogglePasswordForce = async () => {
    if (!teacher) return
    const nextVal = !teacher.must_change_password
    setActionLoading(true)

    const { error } = await supabase
      .from('profiles')
      .update({ must_change_password: nextVal })
      .eq('id', teacherId)

    if (!error) {
      await supabase
        .from('allowed_users')
        .update({ must_change_password: nextVal })
        .eq('email', teacher.email)
      fetchTeacherData()
    }
    setActionLoading(false)
  }

  // Admin Reset Teacher Password (generates temporary password)
  const handleAdminResetPassword = async () => {
    if (!teacher) return
    setActionLoading(true)
    try {
      const res = await fetch('/api/admin/reset-teacher-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teacherId: teacher.id,
          email: teacher.email,
        }),
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

  // Save Subject Modifications with explicit error reporting
  const handleSaveSubjects = async () => {
    setSavingSubjects(true)
    try {
      const { error: profErr } = await supabase
        .from('profiles')
        .update({ subjects: subjectsList })
        .eq('id', teacherId)

      if (profErr) {
        console.error('[TeacherDetailPage] Failed to save subjects to profiles:', profErr)
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
        const { error: allowedErr } = await supabase
          .from('allowed_users')
          .update({ subjects: subjectsList })
          .eq('email', teacher.email)

        if (allowedErr) {
          console.warn('[TeacherDetailPage] allowed_users subjects update warning:', allowedErr.message)
        }
      }

      setEditingSubjects(false)
      setIsSubjectModalOpen(false)
      setSubjectNotice('')
      setSubjectError('')
      await fetchTeacherData()
    } catch (err: any) {
      console.error('[TeacherDetailPage] Exception saving subjects:', err)
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

  const handleSubjectModalSuccess = (updatedMap: Record<string, string>) => {
    const newKeys = Object.keys(updatedMap).sort((a, b) => a.localeCompare(b))
    setAvailableSubjects(newKeys)

    // Auto select newly created subjects into the teacher's subject list
    const newlyAdded = newKeys.filter(k => !availableSubjects.includes(k))
    if (newlyAdded.length > 0) {
      setSubjectsList(prev => Array.from(new Set([...prev, ...newlyAdded])))
      setSubjectNotice(`Subject "${newlyAdded.join(', ')}" added and assigned.`)
    }
  }

  // Delete Teacher
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
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
        <Loader2 size={36} style={{ animation: 'spin 1s linear infinite', color: H.honey }} />
      </div>
    )
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
        <Link
          href="/admin/teachers"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            color: H.textSec,
            fontSize: '13px',
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          <ArrowLeft size={16} /> Back to Teacher Management
        </Link>
        <button
          onClick={fetchTeacherData}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            borderRadius: '8px',
            border: `1px solid ${H.border}`,
            backgroundColor: H.surface,
            color: H.textSec,
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <RefreshCw size={13} /> Refresh Details
        </button>
      </div>

      {/* Temp Password Reset Success Alert Banner */}
      {resetTempPassword && (
        <div style={{
          marginBottom: '20px',
          padding: '16px 20px',
          borderRadius: '12px',
          backgroundColor: H.successLight,
          border: `1px solid ${H.successGreen}`,
          color: '#065F46'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 size={18} /> Password Reset Generated
            </h3>
            <button onClick={() => setResetTempPassword(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#065F46' }}>
              <X size={16} />
            </button>
          </div>
          <p style={{ margin: '0 0 10px', fontSize: '13px' }}>
            A temporary password was generated for <strong>{teacher.email}</strong>. Share it with the teacher:
          </p>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <input
              readOnly
              value={resetTempPassword}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: `1px solid ${H.border}`,
                backgroundColor: '#FFF',
                fontFamily: 'monospace',
                fontWeight: 700,
                fontSize: '15px',
                color: H.textPrimary,
              }}
            />
            <button
              onClick={() => {
                navigator.clipboard.writeText(resetTempPassword)
                setCopiedPass(true)
                setTimeout(() => setCopiedPass(false), 2000)
              }}
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                backgroundColor: copiedPass ? H.successGreen : H.textPrimary,
                color: '#FFF',
                border: 'none',
                fontWeight: 700,
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              {copiedPass ? 'Copied!' : 'Copy Password'}
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
        {/* Profile Info Card */}
        <div style={{ backgroundColor: H.surface, border: `1px solid ${H.border}`, borderRadius: '16px', padding: '24px', boxShadow: H.cardShadow }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', backgroundColor: H.honey, color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: 800 }}>
              {teacher.full_name ? teacher.full_name.charAt(0).toUpperCase() : 'T'}
            </div>
            <div>
              <h1 style={{ fontSize: '20px', fontWeight: 800, color: H.textPrimary, margin: 0 }}>{teacher.full_name}</h1>
              <p style={{ fontSize: '13px', color: H.textSec, margin: '2px 0 4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Mail size={13} /> {teacher.email}
              </p>
              {!editingPhone ? (
                <p style={{ fontSize: '13px', color: H.textSec, margin: '2px 0 8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Phone size={13} /> {teacher.phone || <span style={{ color: H.textMuted, fontStyle: 'italic' }}>No phone provided</span>}
                  <button
                    onClick={() => { setEditingPhone(true); setPhoneInput(teacher.phone || ''); setPhoneError(''); }}
                    style={{ background: 'none', border: 'none', color: H.honey, cursor: 'pointer', padding: 0, marginLeft: 4, display: 'inline-flex', alignItems: 'center' }}
                    title="Edit Phone Number"
                  >
                    <Edit2 size={12} />
                  </button>
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, margin: '4px 0 8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Phone size={13} style={{ color: H.textSec }} />
                    <input
                      type="tel"
                      value={phoneInput}
                      onChange={e => setPhoneInput(e.target.value)}
                      placeholder="+94 77 123 4567"
                      style={{
                        padding: '4px 8px',
                        borderRadius: 6,
                        border: `1px solid ${phoneError ? H.danger : H.border}`,
                        fontSize: '12px',
                        fontFamily: H.font,
                        outline: 'none',
                        width: 140,
                      }}
                    />
                    <button
                      onClick={handleSavePhone}
                      disabled={savingPhone}
                      style={{ padding: '4px 8px', borderRadius: 6, border: 'none', background: H.successGreen, color: '#FFF', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                    >
                      {savingPhone ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={12} />}
                    </button>
                    <button
                      onClick={() => { setEditingPhone(false); setPhoneError(''); }}
                      style={{ padding: '4px 6px', borderRadius: 6, border: `1px solid ${H.border}`, background: H.bg, color: H.textMuted, fontSize: 11, cursor: 'pointer' }}
                    >
                      <X size={12} />
                    </button>
                  </div>
                  {phoneError && (
                    <div style={{ fontSize: '11px', color: H.danger, fontWeight: 600 }}>
                      ⚠️ {phoneError}
                    </div>
                  )}
                </div>
              )}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {teacher.must_change_password || teacher.is_pending ? (
                  <Badge variant="pending">Temp Password — Awaiting Change</Badge>
                ) : teacher.is_active ? (
                  <Badge variant="active">Active Staff</Badge>
                ) : (
                  <Badge variant="inactive">Inactive</Badge>
                )}
                <Badge variant="category">{teacher.role || 'teacher'}</Badge>
              </div>
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: `1px solid ${H.border}`, margin: '20px 0' }} />

          {/* Quick Details */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px', color: H.textSec }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Account Status:</span>
              <strong style={{ color: teacher.is_active ? H.successGreen : '#EF4444' }}>
                {teacher.is_active ? 'Active' : 'Deactivated'}
              </strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Password Status:</span>
              <strong>{teacher.must_change_password ? 'Temp Password — Awaiting Change' : 'Normal'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Joined Date:</span>
              <strong>{teacher.created_at ? new Date(teacher.created_at).toLocaleDateString('en-GB') : 'N/A'}</strong>
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: `1px solid ${H.border}`, margin: '20px 0' }} />

          {/* Account Control Actions */}
          <h3 style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: H.textMuted, marginBottom: '12px' }}>
            Account Controls
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button
              onClick={handleToggleActive}
              disabled={actionLoading}
              style={{
                padding: '10px 14px',
                borderRadius: '10px',
                fontWeight: 700,
                fontSize: '13px',
                border: 'none',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                backgroundColor: teacher.is_active ? '#FEF2F2' : H.successLight,
                color: teacher.is_active ? '#DC2626' : '#065F46',
              }}
            >
              {teacher.is_active ? <XCircle size={16} /> : <CheckCircle2 size={16} />}
              {teacher.is_active ? 'Deactivate Teacher Access' : 'Activate Teacher Access'}
            </button>

            <button
              onClick={handleAdminResetPassword}
              disabled={actionLoading}
              style={{
                padding: '10px 14px',
                borderRadius: '10px',
                fontWeight: 700,
                fontSize: '13px',
                border: `1px solid ${H.purple}40`,
                backgroundColor: H.purpleLight,
                color: H.purpleDark,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              <Key size={16} /> Reset Password
            </button>

            <button
              onClick={handleTogglePasswordForce}
              disabled={actionLoading}
              style={{
                padding: '10px 14px',
                borderRadius: '10px',
                fontWeight: 700,
                fontSize: '13px',
                border: `1px solid ${H.border}`,
                backgroundColor: H.bg,
                color: H.textPrimary,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              <Shield size={16} />
              {teacher.must_change_password ? 'Remove Forced Password Reset' : 'Require Password Change on Next Login'}
            </button>

            <button
              onClick={handleDeleteTeacher}
              disabled={actionLoading}
              style={{
                padding: '10px 14px',
                borderRadius: '10px',
                fontWeight: 700,
                fontSize: '13px',
                border: '1px solid #FCA5A5',
                backgroundColor: '#FFF5F5',
                color: '#B91C1C',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              <Trash2 size={16} /> Delete Teacher Profile
            </button>
          </div>
        </div>

        {/* Subjects & Timetable Card */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* UNIFIED SUBJECTS ASSIGNMENT CARD */}
          <div style={{ backgroundColor: H.surface, border: `1px solid ${H.border}`, borderRadius: '16px', padding: '24px', boxShadow: H.cardShadow }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BookOpen size={18} style={{ color: H.honey }} />
                <h2 style={{ fontSize: '16px', fontWeight: 700, color: H.textPrimary, margin: 0 }}>Assigned Subjects</h2>
              </div>
              {!editingSubjects ? (
                <button
                  onClick={() => { setEditingSubjects(true); setSubjectNotice(''); setSubjectError(''); }}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    border: `1px solid ${H.border}`,
                    backgroundColor: H.bg,
                    color: H.textSec,
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <Edit2 size={13} /> Edit
                </button>
              ) : (
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    onClick={handleSaveSubjects}
                    disabled={savingSubjects}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '8px',
                      border: 'none',
                      backgroundColor: H.successGreen,
                      color: '#FFF',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    {savingSubjects ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={13} />} Save
                  </button>
                  <button
                    onClick={() => {
                      setEditingSubjects(false)
                      setIsSubjectModalOpen(false)
                      setSubjectsList(teacher.subjects || [])
                      setSubjectNotice('')
                      setSubjectError('')
                    }}
                    style={{
                      padding: '6px 10px',
                      borderRadius: '8px',
                      border: `1px solid ${H.border}`,
                      backgroundColor: H.bg,
                      color: H.textMuted,
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    <X size={13} />
                  </button>
                </div>
              )}
            </div>

            {/* UNIFIED SUBJECT DROPDOWN & REUSED SUBJECT MODAL TRIGGER */}
            {editingSubjects && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: H.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Select Subject from List:
                  </span>
                  <button
                    type="button"
                    onClick={() => { setIsSubjectModalOpen(true); setSubjectNotice(''); setSubjectError(''); }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: H.successGreen,
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: 0
                    }}
                  >
                    <Plus size={13} /> Add New Subject
                  </button>
                </div>

                <select
                  id="adminSubjectSelect"
                  onChange={handleSelectSubject}
                  defaultValue=""
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: `1px solid ${H.border}`,
                    backgroundColor: H.bg,
                    color: H.textPrimary,
                    fontSize: '13px',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <option value="" disabled>-- Select a subject to assign --</option>
                  {availableSubjects.map(subj => (
                    <option key={subj} value={subj} disabled={subjectsList.includes(subj)}>
                      {subj} {subjectsList.includes(subj) ? '(Assigned)' : ''}
                    </option>
                  ))}
                </select>

                {subjectNotice && (
                  <p style={{ fontSize: '12px', color: H.successGreen, margin: '2px 0 0', fontWeight: 600 }}>
                    ✓ {subjectNotice}
                  </p>
                )}
                {subjectError && (
                  <div style={{ fontSize: '12px', color: '#EF4444', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <AlertTriangle size={13} /> {subjectError}
                  </div>
                )}
              </div>
            )}

            {/* Subject Badges Display */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {subjectsList.length > 0 ? (
                subjectsList.map((sub, idx) => (
                  <span
                    key={idx}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 12px',
                      borderRadius: '20px',
                      backgroundColor: H.accentLight,
                      color: H.accentDark,
                      fontSize: '13px',
                      fontWeight: 600,
                      border: `1px solid ${H.accent}40`,
                    }}
                  >
                    {sub}
                    {editingSubjects && (
                      <button
                        onClick={() => handleRemoveSubject(sub)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: H.accentDark,
                          padding: 0,
                          display: 'flex',
                          alignItems: 'center',
                        }}
                      >
                        <X size={13} />
                      </button>
                    )}
                  </span>
                ))
              ) : (
                <p style={{ fontSize: '13px', color: H.textMuted, margin: 0, fontStyle: 'italic' }}>
                  No subjects currently assigned. Click Edit above to assign subjects.
                </p>
              )}
            </div>
          </div>

          {/* Timetable Schedule Summary */}
          <div style={{ backgroundColor: H.surface, border: `1px solid ${H.border}`, borderRadius: '16px', padding: '24px', boxShadow: H.cardShadow }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <Calendar size={18} style={{ color: H.honey }} />
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: H.textPrimary, margin: 0 }}>Weekly Schedule ({schedule.length} Periods)</h2>
            </div>

            {schedule.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {DAYS.map((dayName, dayIdx) => {
                  const dayNum = dayIdx + 1
                  const dayPeriods = schedule.filter(s => s.day_of_week === dayNum)
                  if (dayPeriods.length === 0) return null

                  return (
                    <div key={dayName} style={{ borderBottom: `1px solid ${H.border}`, paddingBottom: '8px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: H.textMuted, textTransform: 'uppercase' }}>{dayName}</span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px' }}>
                        {dayPeriods.map(p => (
                          <div
                            key={p.id}
                            style={{
                              padding: '6px 10px',
                              borderRadius: '8px',
                              border: `1px solid ${H.border}`,
                              backgroundColor: H.bg,
                              fontSize: '12px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                            }}
                          >
                            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: p.subject_color || H.honey }} />
                            <strong>P{p.period_number}:</strong> {p.subject} ({p.class?.name || 'Class'})
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p style={{ fontSize: '13px', color: H.textMuted, margin: 0, fontStyle: 'italic' }}>
                No active timetable periods assigned to this teacher.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Reused Subject & Color Manager Modal */}
      <SubjectModal
        isOpen={isSubjectModalOpen}
        onClose={() => setIsSubjectModalOpen(false)}
        onSuccess={handleSubjectModalSuccess}
      />

      <ConfirmModal
        open={!!modal}
        {...(modal ?? { title: '', message: '', onConfirm: () => {} })}
        onCancel={() => setModal(null)}
      />
    </div>
  )
}
