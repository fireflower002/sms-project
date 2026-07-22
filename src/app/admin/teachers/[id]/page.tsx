'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  User,
  Mail,
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
  Briefcase
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { H } from '@/lib/honey'
import Badge from '@/components/ui/Badge'
import ConfirmModal, { ConfirmModalState } from '@/components/ui/ConfirmModal'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

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

  // Subject Editing State
  const [editingSubjects, setEditingSubjects] = useState(false)
  const [subjectInput, setSubjectInput] = useState('')
  const [subjectsList, setSubjectsList] = useState<string[]>([])
  const [savingSubjects, setSavingSubjects] = useState(false)

  const fetchTeacherData = useCallback(async () => {
    setLoading(true)

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
          role: 'teacher',
          subjects: allowed.subjects || [],
          is_active: true,
          must_change_password: allowed.must_change_password ?? true,
          is_pending: true,
          created_at: allowed.created_at,
        })
        setSubjectsList(allowed.subjects || [])
      } else {
        setTeacher(null)
      }
      setLoading(false)
      return
    }

    setTeacher(prof)
    setSubjectsList(prof.subjects || [])

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
  }, [teacherId, supabase])

  useEffect(() => {
    fetchTeacherData()
  }, [fetchTeacherData])

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
          setModal({
            title: 'Action Failed',
            message: error.message,
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

  // Save Subject Modifications
  const handleSaveSubjects = async () => {
    setSavingSubjects(true)
    const { error } = await supabase
      .from('profiles')
      .update({ subjects: subjectsList })
      .eq('id', teacherId)

    if (!error) {
      await supabase
        .from('allowed_users')
        .update({ subjects: subjectsList })
        .eq('email', teacher.email)
      setEditingSubjects(false)
      fetchTeacherData()
    }
    setSavingSubjects(false)
  }

  const handleAddSubject = () => {
    const trimmed = subjectInput.trim()
    if (trimmed && !subjectsList.includes(trimmed)) {
      setSubjectsList([...subjectsList, trimmed])
      setSubjectInput('')
    }
  }

  const handleRemoveSubject = (sub: string) => {
    setSubjectsList(subjectsList.filter(s => s !== sub))
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
      <div style={{ padding: '40px 24px', maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
        <AlertTriangle size={48} style={{ color: '#EF4444', marginBottom: '16px' }} />
        <h2 style={{ fontSize: '20px', fontWeight: 700, color: H.textPrimary }}>Teacher Not Found</h2>
        <p style={{ fontSize: '14px', color: H.textSec, marginTop: '8px', marginBottom: '24px' }}>
          No teacher account was found matching ID: <code>{teacherId}</code>
        </p>
        <Link
          href="/admin/teachers"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            backgroundColor: H.honey,
            color: '#FFF',
            borderRadius: '10px',
            fontWeight: 700,
            textDecoration: 'none',
          }}
        >
          <ArrowLeft size={16} /> Back to Teacher Directory
        </Link>
      </div>
    )
  }

  return (
    <div style={{ backgroundColor: H.bg, minHeight: '100vh', padding: 'clamp(16px, 4vw, 32px)', boxSizing: 'border-box' }}>
      {/* Top Breadcrumb Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <Link
          href="/admin/teachers"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '13px',
            fontWeight: '600',
            color: H.textSec,
            textDecoration: 'none',
            padding: '6px 12px',
            borderRadius: '8px',
            backgroundColor: H.surface,
            border: `1px solid ${H.border}`,
          }}
        >
          <ArrowLeft size={14} /> Back to Teachers
        </Link>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={fetchTeacherData}
            title="Refresh profile"
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              border: `1px solid ${H.border}`,
              backgroundColor: H.surface,
              color: H.textSec,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '13px',
              fontWeight: 600,
            }}
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Grid Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
        {/* Profile Card */}
        <div style={{ backgroundColor: H.surface, border: `1px solid ${H.border}`, borderRadius: '16px', padding: '24px', boxShadow: H.cardShadow }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', marginBottom: '20px' }}>
            <div
              style={{
                width: 60,
                height: 60,
                borderRadius: '50%',
                backgroundColor: H.honey,
                color: '#FFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '22px',
                fontWeight: 800,
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              }}
            >
              {teacher.full_name ? teacher.full_name.charAt(0).toUpperCase() : 'T'}
            </div>
            <div style={{ flex: 1 }}>
              <h1 style={{ fontSize: '20px', fontWeight: 800, color: H.textPrimary, margin: 0 }}>{teacher.full_name}</h1>
              <p style={{ fontSize: '13px', color: H.textSec, margin: '4px 0 10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Mail size={14} /> {teacher.email}
              </p>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {teacher.must_change_password || teacher.is_pending ? (
                  <Badge variant="pending">Must Change Password</Badge>
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
              <strong>{teacher.must_change_password ? 'Force Reset Pending' : 'Normal'}</strong>
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
              <Key size={16} />
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
          {/* Subjects Card */}
          <div style={{ backgroundColor: H.surface, border: `1px solid ${H.border}`, borderRadius: '16px', padding: '24px', boxShadow: H.cardShadow }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BookOpen size={18} style={{ color: H.honey }} />
                <h2 style={{ fontSize: '16px', fontWeight: 700, color: H.textPrimary, margin: 0 }}>Assigned Subjects</h2>
              </div>
              {!editingSubjects ? (
                <button
                  onClick={() => setEditingSubjects(true)}
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
                      setSubjectsList(teacher.subjects || [])
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

            {editingSubjects && (
              <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                <input
                  type="text"
                  value={subjectInput}
                  onChange={e => setSubjectInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleAddSubject()
                    }
                  }}
                  placeholder="Type subject & press enter..."
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: `1px solid ${H.border}`,
                    fontSize: '13px',
                    outline: 'none',
                  }}
                />
                <button
                  onClick={handleAddSubject}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    backgroundColor: H.honey,
                    color: '#FFF',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  Add
                </button>
              </div>
            )}

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
                      fontWeight: 600,
                      fontSize: '13px',
                    }}
                  >
                    {sub}
                    {editingSubjects && (
                      <X
                        size={12}
                        onClick={() => handleRemoveSubject(sub)}
                        style={{ cursor: 'pointer', color: '#991B1B' }}
                      />
                    )}
                  </span>
                ))
              ) : (
                <p style={{ fontSize: '13px', color: H.textMuted, margin: 0 }}>No subjects assigned yet.</p>
              )}
            </div>
          </div>

          {/* Weekly Schedule Assignments */}
          <div style={{ backgroundColor: H.surface, border: `1px solid ${H.border}`, borderRadius: '16px', padding: '24px', boxShadow: H.cardShadow }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <Calendar size={18} style={{ color: H.honey }} />
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: H.textPrimary, margin: 0 }}>Weekly Class Assignments</h2>
            </div>

            {schedule.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {DAYS.map((dayName, index) => {
                  const dayNum = index + 1
                  const daySlots = schedule.filter(s => s.day_of_week === dayNum)
                  if (daySlots.length === 0) return null

                  return (
                    <div key={dayName} style={{ padding: '12px', borderRadius: '10px', backgroundColor: H.bg, border: `1px solid ${H.border}` }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: H.honey, marginBottom: '8px' }}>
                        {dayName} ({daySlots.length} periods)
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '8px' }}>
                        {daySlots.map(slot => (
                          <div
                            key={slot.id}
                            style={{
                              padding: '8px 10px',
                              borderRadius: '6px',
                              backgroundColor: H.surface,
                              border: `1px solid ${H.border}`,
                              fontSize: '12px',
                            }}
                          >
                            <div style={{ fontWeight: 700, color: H.textPrimary }}>
                              Period {slot.period_number}
                            </div>
                            <div style={{ color: H.textSec }}>
                              {slot.class?.name || 'Class'} • {slot.subject_name || 'Subject'}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p style={{ fontSize: '13px', color: H.textMuted, margin: 0, padding: '16px 0', textAlign: 'center' }}>
                No active timetable assignments found for this teacher.
              </p>
            )}
          </div>

          {/* Recent Activity: Swaps & Absences */}
          <div style={{ backgroundColor: H.surface, border: `1px solid ${H.border}`, borderRadius: '16px', padding: '24px', boxShadow: H.cardShadow }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <Clock size={18} style={{ color: H.honey }} />
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: H.textPrimary, margin: 0 }}>Recent Swaps & Absences</h2>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {absences.length > 0 && (
                <div>
                  <h4 style={{ fontSize: '12px', fontWeight: 700, color: H.textMuted, textTransform: 'uppercase', marginBottom: '8px' }}>
                    Absence History
                  </h4>
                  {absences.map(abs => (
                    <div
                      key={abs.id}
                      style={{
                        padding: '10px',
                        borderRadius: '8px',
                        border: `1px solid ${H.border}`,
                        backgroundColor: H.bg,
                        marginBottom: '6px',
                        fontSize: '13px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <strong>{abs.absence_date}</strong> — {abs.absence_type.replace('_', ' ')}
                        {abs.reason && <span style={{ color: H.textMuted }}> ({abs.reason})</span>}
                      </div>
                      <Badge variant={abs.status === 'covered' ? 'active' : 'pending'}>
                        {abs.status || 'Reported'}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}

              {swaps.length > 0 && (
                <div>
                  <h4 style={{ fontSize: '12px', fontWeight: 700, color: H.textMuted, textTransform: 'uppercase', marginBottom: '8px' }}>
                    Swap Requests
                  </h4>
                  {swaps.map(swp => (
                    <div
                      key={swp.id}
                      style={{
                        padding: '10px',
                        borderRadius: '8px',
                        border: `1px solid ${H.border}`,
                        backgroundColor: H.bg,
                        marginBottom: '6px',
                        fontSize: '13px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <strong>{swp.swap_date}</strong> — {swp.requester?.full_name} ↔ {swp.target?.full_name}
                      </div>
                      <Badge variant={swp.status === 'accepted' ? 'active' : swp.status === 'rejected' ? 'inactive' : 'pending'}>
                        {swp.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}

              {absences.length === 0 && swaps.length === 0 && (
                <p style={{ fontSize: '13px', color: H.textMuted, margin: 0, textAlign: 'center', padding: '12px 0' }}>
                  No recent absences or swap requests recorded.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      <ConfirmModal
        open={!!modal}
        {...(modal ?? { title: '', message: '', onConfirm: () => {} })}
        onCancel={() => setModal(null)}
      />
    </div>
  )
}
