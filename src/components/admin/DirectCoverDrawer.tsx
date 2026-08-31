'use client'

import { useState, useEffect } from 'react'
import {
  X,
  UserX,
  Search,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ShieldAlert,
  Star,
  CalendarDays,
  Bell,
  Zap
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { H } from '@/lib/honey'
import { todaySLT, generatePeriods, dateToDayOfWeek, formatTime, formatSLT } from '@/lib/utils'
import { useToast } from '@/components/ui/Toast'
import { useFocusTrap } from '@/lib/useFocusTrap'

interface DirectCoverDrawerProps {
  isOpen: boolean
  onClose: () => void
  absenceId?: string | null
  initialTeacherId?: string | null
  initialDate?: string | null
  onSuccess?: () => void
}

export default function DirectCoverDrawer({
  isOpen,
  onClose,
  absenceId: initialAbsenceId,
  initialTeacherId,
  initialDate,
  onSuccess
}: DirectCoverDrawerProps) {
  const supabase = createClient()
  const { showToast } = useToast()

  const [teachers, setTeachers] = useState<any[]>([])
  const [template, setTemplate] = useState<any>(null)
  const [search, setSearch] = useState('')
  const [selectedTeacher, setSelectedTeacher] = useState<any>(null)

  const [absenceDate, setAbsenceDate] = useState(initialDate || todaySLT())
  const [absenceType, setAbsenceType] = useState<'full_day' | 'morning_block' | 'afternoon_block' | 'custom_periods'>('full_day')
  const [customPeriods, setCustomPeriods] = useState<number[]>([])
  const [reason, setReason] = useState('')
  const [currentAbsenceId, setCurrentAbsenceId] = useState<string | null>(initialAbsenceId || null)

  const [suggestions, setSuggestions] = useState<Record<number, any[]>>({})
  const [manualOverride, setManualOverride] = useState<Record<number, boolean>>({})
  const [assignedSubs, setAssignedSubs] = useState<Record<number, string>>({})
  const [notified, setNotified] = useState<Record<number, boolean>>({})

  const [fetching, setFetching] = useState(true)
  const [loadingSugs, setLoadingSugs] = useState(false)
  const [savingPill, setSavingPill] = useState<Record<number, boolean>>({})
  const [notifyingPill, setNotifyingPill] = useState<Record<number, boolean>>({})

  // Safeguard modal for manual override on busy teacher
  const [conflictModal, setConflictModal] = useState<{
    pNum: number
    candidate: any
    slot: any
  } | null>(null)

  // Banner notification for failed notification sending
  const [notifyErrorBanner, setNotifyErrorBanner] = useState<string | null>(null)

  // Fetch baseline teachers & active template
  useEffect(() => {
    if (!isOpen) return

    setFetching(true)
    Promise.all([
      supabase.from('profiles').select('id,full_name,email,subjects').eq('role', 'teacher').eq('is_active', true).order('full_name'),
      supabase.from('timetable_templates').select('*').eq('is_active', true).maybeSingle(),
    ]).then(async ([{ data: t }, { data: tmpl }]) => {
      const teacherList = t || []
      setTeachers(teacherList)
      setTemplate(tmpl || null)

      const targetAbsId = initialAbsenceId
      if (targetAbsId) {
        const { data: abs } = await supabase.from('absences').select('*, teacher:profiles!teacher_id(id,full_name,subjects,email)').eq('id', targetAbsId).maybeSingle()
        if (abs) {
          setCurrentAbsenceId(abs.id)
          setAbsenceDate(abs.absence_date)
          setAbsenceType(abs.absence_type)
          setCustomPeriods(abs.custom_periods || [])
          setReason(abs.reason || '')
          setSelectedTeacher(abs.teacher)
          setSearch(abs.teacher?.full_name || '')
          loadSuggestions(abs.teacher_id, abs.absence_date, abs.absence_type, abs.custom_periods || [], teacherList, tmpl, abs.id)
        }
      } else if (initialTeacherId) {
        const found = teacherList.find(x => x.id === initialTeacherId)
        if (found) {
          setSelectedTeacher(found)
          setSearch(found.full_name)
          loadSuggestions(found.id, initialDate || todaySLT(), 'full_day', [], teacherList, tmpl)
        }
      }
      setFetching(false)
    })
  }, [isOpen, initialAbsenceId, initialTeacherId, initialDate])

  const periods = template
    ? generatePeriods(template.start_time, template.end_time, template.period_duration, template.breaks || []).filter((p: any) => !p.is_break)
    : []

  const loadSuggestions = async (
    teacherId: string,
    dateStr: string,
    typeStr: string,
    cPeriods: number[],
    teacherList: any[],
    tmpl: any,
    existingAbsenceId?: string | null
  ) => {
    setLoadingSugs(true)
    setNotifyErrorBanner(null)
    if (!tmpl) {
      setLoadingSugs(false)
      return
    }

    const allP = generatePeriods(tmpl.start_time, tmpl.end_time, tmpl.period_duration, tmpl.breaks || []).filter((p: any) => !p.is_break)
    const rawAbsent = typeStr === 'full_day'
      ? allP.map((p: any) => p.period_number)
      : typeStr === 'morning_block'
      ? allP.slice(0, Math.ceil(allP.length / 2)).map((p: any) => p.period_number)
      : typeStr === 'afternoon_block'
      ? allP.slice(Math.ceil(allP.length / 2)).map((p: any) => p.period_number)
      : cPeriods

    const dayOfWeek = dateToDayOfWeek(dateStr)

    // Fetch absent teacher slots, all teacher schedule assignments, and active substitutions for that day
    const [{ data: absentSlots }, { data: allSlots }, { data: activeSubstitutions }] = await Promise.all([
      supabase.from('schedule_assignments').select('id,period_number,subject,class_id,class:classes(name)').eq('teacher_id', teacherId).eq('day_of_week', dayOfWeek).eq('template_id', tmpl.id),
      supabase.from('schedule_assignments').select('teacher_id,period_number').eq('day_of_week', dayOfWeek).eq('template_id', tmpl.id),
      supabase.from('substitutions').select('substitute_teacher_id,period_number,absence:absences!absence_id!inner(absence_date)').filter('substitute_teacher_id', 'not.is', null).eq('absence.absence_date', dateStr)
    ])

    const heldMap = new Map((absentSlots || []).map((s: any) => [s.period_number, s]))
    const absent = rawAbsent.filter((p: number) => heldMap.has(p))

    // Map busy teaching periods
    const busy: Record<number, Set<string>> = {}
    for (const s of allSlots || []) {
      if (!busy[s.period_number]) busy[s.period_number] = new Set()
      busy[s.period_number].add(s.teacher_id)
    }

    // Map busy covering periods for date
    const subBusy: Record<number, Set<string>> = {}
    for (const sub of activeSubstitutions || []) {
      const subAbsenceDate = (sub.absence as any)?.absence_date
      if (subAbsenceDate === dateStr && sub.substitute_teacher_id) {
        if (!subBusy[sub.period_number]) subBusy[sub.period_number] = new Set()
        subBusy[sub.period_number].add(sub.substitute_teacher_id)
      }
    }

    const newSugs: Record<number, any[]> = {}
    for (const p of absent) {
      const slot: any = heldMap.get(p)
      newSugs[p] = teacherList.filter(t => t.id !== teacherId).map(t => {
        const isTeaching = busy[p]?.has(t.id) || false
        const isCovering = subBusy[p]?.has(t.id) || false
        const isFree = !isTeaching && !isCovering
        return {
          ...t,
          isFree,
          isTeaching,
          isCovering,
          sameSubject: (t.subjects || []).includes(slot?.subject || ''),
          className: slot?.class?.name || '',
          subject: slot?.subject || '',
          classId: slot?.class_id || null,
          scheduleAssignmentId: slot?.id || null
        }
      }).sort((a, b) => {
        if (a.isFree !== b.isFree) return a.isFree ? -1 : 1
        if (a.sameSubject !== b.sameSubject) return a.sameSubject ? -1 : 1
        return a.full_name.localeCompare(b.full_name)
      })
    }
    setSuggestions(newSugs)

    // Preload existing substitutions if available
    const absId = existingAbsenceId || currentAbsenceId
    if (absId) {
      const { data: existingSubs } = await supabase.from('substitutions').select('*').eq('absence_id', absId)
      if (existingSubs && existingSubs.length > 0) {
        const initialAssigned: Record<number, string> = {}
        const initialNotified: Record<number, boolean> = {}
        for (const subRow of existingSubs) {
          if (subRow.substitute_teacher_id) {
            initialAssigned[subRow.period_number] = subRow.substitute_teacher_id
          }
          if (subRow.notified) {
            initialNotified[subRow.period_number] = true
          }
        }
        setAssignedSubs(initialAssigned)
        setNotified(initialNotified)
      }
    }

    setLoadingSugs(false)
  }

  const handleSelectTeacher = (t: any) => {
    setSelectedTeacher(t)
    setSearch(t.full_name)
    setSuggestions({})
    setAssignedSubs({})
    setCurrentAbsenceId(null)
    setNotified({})
    loadSuggestions(t.id, absenceDate, absenceType, customPeriods, teachers, template)
  }

  // Ensure absence row exists in DB
  const ensureAbsenceRecord = async (): Promise<string | null> => {
    if (currentAbsenceId) return currentAbsenceId
    if (!selectedTeacher || !template?.id) return null

    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user

    // Check if existing absence exists for this teacher on date
    const { data: existing } = await supabase.from('absences').select('id').eq('teacher_id', selectedTeacher.id).eq('absence_date', absenceDate).maybeSingle()
    if (existing) {
      setCurrentAbsenceId(existing.id)
      return existing.id
    }

    // Insert approved emergency absence
    const { data: newAbs, error } = await supabase.from('absences').insert({
      teacher_id: selectedTeacher.id,
      absence_date: absenceDate,
      absence_type: absenceType,
      custom_periods: absenceType === 'custom_periods' ? customPeriods : null,
      reason: reason || 'Emergency Admin Cover Override',
      recorded_by: user?.id,
      status: 'approved',
      template_id: template.id
    }).select().single()

    if (error) {
      showToast(`Error creating absence record: ${error.message}`, 'error')
      return null
    }

    setCurrentAbsenceId(newAbs.id)
    return newAbs.id
  }

  // Execute candidate toggle (DB update + notification)
  const execToggleCandidate = async (pNum: number, candidate: any, slot: any) => {
    const isCurrentlySelected = assignedSubs[pNum] === candidate.id
    const prevSubId = assignedSubs[pNum]

    setSavingPill(p => ({ ...p, [pNum]: true }))
    setNotifyErrorBanner(null)

    try {
      const absId = await ensureAbsenceRecord()
      if (!absId) {
        setSavingPill(p => ({ ...p, [pNum]: false }))
        return
      }

      if (isCurrentlySelected) {
        // Deselect -> delete substitution row
        const { error: delErr } = await supabase
          .from('substitutions')
          .delete()
          .eq('absence_id', absId)
          .eq('period_number', pNum)

        if (delErr) throw delErr

        setAssignedSubs(p => {
          const copy = { ...p }
          delete copy[pNum]
          return copy
        })
        setNotified(p => ({ ...p, [pNum]: false }))

        // Notify unassign async
        fetch('/api/notify/substitute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            substitute_teacher_id: candidate.id,
            substitute_name: candidate.full_name || '',
            period_number: pNum,
            class_name: slot?.className || '',
            subject: slot?.subject || '',
            absence_date: absenceDate,
            action: 'unassign'
          })
        }).catch(err => console.warn('Unassign notification warning:', err))

        showToast(`Unassigned cover for Period ${pNum}`, 'info')
      } else {
        // Unassign previous candidate if switching
        if (prevSubId && prevSubId !== candidate.id) {
          const prevSub = teachers.find(t => t.id === prevSubId)
          fetch('/api/notify/substitute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              substitute_teacher_id: prevSubId,
              substitute_name: prevSub?.full_name || '',
              period_number: pNum,
              class_name: slot?.className || '',
              subject: slot?.subject || '',
              absence_date: absenceDate,
              action: 'unassign'
            })
          }).catch(err => console.warn('Previous sub unassign notify error:', err))
        }

        // Upsert substitution into database
        const rowToUpsert = {
          absence_id: absId,
          substitute_teacher_id: candidate.id,
          period_number: pNum,
          class_id: slot?.classId || null,
          subject: slot?.subject || null,
          schedule_assignment_id: slot?.scheduleAssignmentId || null,
          status: 'assigned',
          notified: true,
          notified_at: new Date().toISOString()
        }

        const { error: upsertErr } = await supabase
          .from('substitutions')
          .upsert(rowToUpsert, { onConflict: 'absence_id,period_number' })

        if (upsertErr) throw upsertErr

        // Update UI state immediately (DB write SUCCESS!)
        setAssignedSubs(p => ({ ...p, [pNum]: candidate.id }))
        showToast(`Assigned ${candidate.full_name} to Period ${pNum}`, 'success')

        // Dispatch notification call
        try {
          const notifRes = await fetch('/api/notify/substitute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              substitute_teacher_id: candidate.id,
              substitute_name: candidate.full_name || '',
              absent_teacher_name: selectedTeacher?.full_name || '',
              period_number: pNum,
              class_name: slot?.className || '',
              subject: slot?.subject || '',
              absence_date: absenceDate,
              action: 'assign'
            })
          })

          const json = await notifRes.json().catch(() => ({}))
          if (!notifRes.ok || (json.success === false) || json.error) {
            throw new Error(json.error || `HTTP ${notifRes.status}`)
          }

          setNotified(p => ({ ...p, [pNum]: true }))
        } catch (notifErr: any) {
          console.warn('[DirectCoverDrawer] Notification dispatch failed:', notifErr)
          setNotified(p => ({ ...p, [pNum]: false }))
          setNotifyErrorBanner(`Cover saved in database, but notification to ${candidate.full_name} failed (${notifErr.message}). Please inform the teacher manually.`)
          showToast(`Cover assigned, but notification failed. Please inform ${candidate.full_name} manually.`, 'warning')
        }
      }
    } catch (err: any) {
      console.error('[DirectCoverDrawer] DB assignment error:', err)
      showToast(err.message || 'Failed to save cover assignment.', 'error')
    } finally {
      setSavingPill(p => ({ ...p, [pNum]: false }))
      if (onSuccess) onSuccess()
    }
  }

  // Handle candidate click with manual override conflict safeguard check
  const handleCandidateClick = (pNum: number, candidate: any, slot: any) => {
    const isCurrentlySelected = assignedSubs[pNum] === candidate.id

    // If teacher is flagged as busy and not already selected, trigger safeguard confirmation
    if (!isCurrentlySelected && !candidate.isFree) {
      setConflictModal({ pNum, candidate, slot })
      return
    }

    execToggleCandidate(pNum, candidate, slot)
  }

  const handleNotifySingle = async (pNum: number) => {
    const subId = assignedSubs[pNum]
    if (!subId || !selectedTeacher || !currentAbsenceId) return
    setNotifyingPill(p => ({ ...p, [pNum]: true }))
    setNotifyErrorBanner(null)
    try {
      const sub = teachers.find(t => t.id === subId)
      const slot = (suggestions[pNum] || [])[0] || {}

      const res = await fetch('/api/notify/substitute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          substitute_teacher_id: subId,
          substitute_name: sub?.full_name || '',
          absent_teacher_name: selectedTeacher.full_name,
          period_number: pNum,
          class_name: slot.className || '',
          subject: slot.subject || '',
          absence_date: absenceDate
        })
      })

      const json = await res.json().catch(() => ({}))
      if (!res.ok || (json.success === false) || json.error) throw new Error(json.error || `HTTP ${res.status}`)

      await supabase.from('substitutions').update({ notified: true, notified_at: new Date().toISOString() }).eq('absence_id', currentAbsenceId).eq('period_number', pNum)
      setNotified(p => ({ ...p, [pNum]: true }))
      showToast(`Notification sent to ${sub?.full_name}`, 'success')
    } catch (err: any) {
      setNotifyErrorBanner(`Notification failed for Period ${pNum} (${err.message}).`)
      showToast(`Failed to send notification: ${err.message}`, 'error')
    } finally {
      setNotifyingPill(p => ({ ...p, [pNum]: false }))
    }
  }

  const filteredTeachers = teachers.filter(t =>
    !search || t.full_name.toLowerCase().includes(search.toLowerCase()) || t.email?.toLowerCase().includes(search.toLowerCase())
  )

  const containerRef = useFocusTrap<HTMLDivElement>({
    isOpen,
    onClose,
  })

  if (!isOpen) return null

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-cover-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(28, 25, 23, 0.4)',
        backdropFilter: 'blur(4px)',
        transition: 'all 0.2s ease-in-out'
      }}
    >
      {/* Slide-over panel */}
      <div
        style={{
          width: '100%',
          maxWidth: '620px',
          height: '100%',
          backgroundColor: H.surface,
          boxShadow: '-4px 0 24px rgba(0,0,0,0.12)',
          display: 'flex',
          flexDirection: 'column',
          fontFamily: H.font,
          color: H.textPrimary,
          overflow: 'hidden'
        }}
      >
        {/* Drawer Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: `1px solid ${H.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: H.surface
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Zap size={20} style={{ color: '#7F1D1D' }} />
            </div>
            <div>
              <h2 id="drawer-cover-title" style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: H.textPrimary }}>
                Emergency Direct Cover Override
              </h2>
              <p style={{ fontSize: '12px', color: H.textSec, margin: '2px 0 0 0' }}>
                Single-click inline substitution assignment for immediate absences.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              border: 'none',
              background: '#F4F4F5',
              borderRadius: '8px',
              width: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: H.textMuted
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Drawer Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Notification Error Warning Banner */}
          {notifyErrorBanner && (
            <div style={{ padding: '12px 16px', borderRadius: '10px', backgroundColor: '#FEF2F2', border: '1px solid #FECACA', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <AlertTriangle size={18} style={{ color: H.danger, flexShrink: 0, marginTop: 2 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: H.danger }}>Notification Alert</div>
                <div style={{ fontSize: '12px', color: H.textPrimary, marginTop: 2 }}>{notifyErrorBanner}</div>
              </div>
              <button onClick={() => setNotifyErrorBanner(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: H.danger }}>
                <X size={14} />
              </button>
            </div>
          )}

          {/* Section 1: Teacher & Date Selector */}
          <div style={{ backgroundColor: H.bg, border: `1px solid ${H.border}`, borderRadius: '14px', padding: '16px 18px' }}>
            <div style={{ fontSize: '11px', fontWeight: 800, color: H.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
              1. Absent Teacher & Date
            </div>

            {/* Absent Teacher Selector */}
            <div style={{ position: 'relative', marginBottom: '12px' }}>
              <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: H.textMuted }} />
              <input
                value={search}
                onChange={e => {
                  setSearch(e.target.value)
                  if (selectedTeacher && e.target.value !== selectedTeacher.full_name) {
                    setSelectedTeacher(null)
                    setSuggestions({})
                  }
                }}
                placeholder="Search teacher name..."
                style={{
                  width: '100%',
                  padding: '9px 12px 9px 36px',
                  borderRadius: '8px',
                  border: `1px solid ${H.border}`,
                  backgroundColor: H.surface,
                  fontSize: '13px',
                  fontWeight: 600,
                  color: H.textPrimary,
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />

              {search && !selectedTeacher && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, marginTop: 4, borderRadius: 10, border: `1px solid ${H.border}`, backgroundColor: H.surface, boxShadow: H.cardShadow, maxHeight: 180, overflowY: 'auto' }}>
                  {filteredTeachers.slice(0, 6).map(t => (
                    <button
                      key={t.id}
                      onClick={() => handleSelectTeacher(t)}
                      style={{ width: '100%', textAlign: 'left', padding: '9px 14px', border: 'none', borderBottom: `1px solid ${H.border}`, background: H.surface, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}
                    >
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#F4F4F5', color: '#18181B', fontWeight: 700, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {t.full_name.charAt(0)}
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: H.textPrimary }}>{t.full_name}</div>
                        <div style={{ fontSize: 11, color: H.textMuted }}>{(t.subjects || []).join(', ')}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedTeacher && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 10, backgroundColor: H.surface, border: `1px solid ${H.border}`, marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#18181B', color: '#FFF', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {selectedTeacher.full_name.charAt(0)}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: H.textPrimary }}>{selectedTeacher.full_name}</div>
                    <div style={{ fontSize: 11, color: H.textMuted }}>{(selectedTeacher.subjects || []).join(', ')}</div>
                  </div>
                </div>
                <CheckCircle2 size={16} style={{ color: H.successGreen }} />
              </div>
            )}

            {/* Date & Type selectors */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: H.textMuted, display: 'block', marginBottom: 4 }}>Absence Date</label>
                <input
                  type="date"
                  value={absenceDate}
                  onChange={e => {
                    setAbsenceDate(e.target.value)
                    if (selectedTeacher) {
                      loadSuggestions(selectedTeacher.id, e.target.value, absenceType, customPeriods, teachers, template)
                    }
                  }}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${H.border}`, fontSize: 12, fontWeight: 600, color: H.textPrimary, backgroundColor: H.surface, boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: H.textMuted, display: 'block', marginBottom: 4 }}>Absence Scope</label>
                <select
                  value={absenceType}
                  onChange={e => {
                    const val = e.target.value as any
                    setAbsenceType(val)
                    if (selectedTeacher) {
                      loadSuggestions(selectedTeacher.id, absenceDate, val, customPeriods, teachers, template)
                    }
                  }}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${H.border}`, fontSize: 12, fontWeight: 600, color: H.textPrimary, backgroundColor: H.surface, boxSizing: 'border-box' }}
                >
                  <option value="full_day">Full Day</option>
                  <option value="morning_block">Morning Block</option>
                  <option value="afternoon_block">Afternoon Block</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Period Breakdown & Conflict-Free Substitutes */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ fontSize: '11px', fontWeight: 800, color: H.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                2. Direct Cover Assignments ({Object.keys(suggestions).length} Periods)
              </div>
              {selectedTeacher && (
                <div style={{ fontSize: 11, fontWeight: 600, color: H.accentDark, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <CalendarDays size={12} /> {formatSLT(absenceDate, 'dd MMM yyyy')}
                </div>
              )}
            </div>

            {loadingSugs ? (
              <div style={{ padding: '32px', textAlign: 'center' }}>
                <Loader2 size={24} style={{ color: H.accent, animation: 'spin 0.7s linear infinite', margin: '0 auto' }} />
                <div style={{ fontSize: 12, color: H.textMuted, marginTop: 8 }}>Calculating free teacher schedule conflicts...</div>
              </div>
            ) : !selectedTeacher ? (
              <div style={{ padding: '32px 20px', textAlign: 'center', backgroundColor: H.bg, borderRadius: 12, border: `1px dashed ${H.border}` }}>
                <UserX size={32} style={{ color: H.textMuted, margin: '0 auto 8px', opacity: 0.5 }} />
                <div style={{ fontSize: 13, fontWeight: 600, color: H.textPrimary }}>Select an absent teacher</div>
                <div style={{ fontSize: 11, color: H.textMuted, marginTop: 4 }}>Select a teacher above to view scheduled periods requiring cover.</div>
              </div>
            ) : Object.keys(suggestions).length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', backgroundColor: '#F0FDF4', borderRadius: 12, border: `1px solid ${H.successLight}` }}>
                <CheckCircle2 size={24} style={{ color: H.successGreen, margin: '0 auto 6px' }} />
                <div style={{ fontSize: 13, fontWeight: 700, color: '#166534' }}>No Scheduled Classes to Cover</div>
                <div style={{ fontSize: 12, color: H.textSec, marginTop: 2 }}>{selectedTeacher.full_name} has no teaching slots scheduled on this date.</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {Object.keys(suggestions).map(Number).sort((a, b) => a - b).map(pNum => {
                  const sugs = suggestions[pNum] || []
                  const subId = assignedSubs[pNum]
                  const sub = subId ? teachers.find(t => t.id === subId) : null
                  const slot = sugs[0] || {}

                  const pInfo = periods.find((p: any) => p.period_number === pNum)
                  const timeRangeStr = pInfo ? `${formatTime(pInfo.start_time)}–${formatTime(pInfo.end_time)}` : ''
                  const isOverride = !!manualOverride[pNum]

                  const candidates = isOverride ? sugs : sugs.filter(t => t.isFree)
                  const subjectMatches = candidates.filter(t => t.sameSubject)
                  const otherCandidates = candidates.filter(t => !t.sameSubject)

                  const renderPill = (t: any) => {
                    const sel = subId === t.id
                    const isSaving = savingPill[pNum]
                    return (
                      <button
                        key={t.id}
                        disabled={isSaving}
                        onClick={() => handleCandidateClick(pNum, t, slot)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '20px',
                          border: `1.5px solid ${sel ? H.successGreen : t.sameSubject ? H.purple : H.border}`,
                          cursor: isSaving ? 'wait' : 'pointer',
                          fontSize: '12px',
                          fontWeight: sel ? 700 : 500,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          transition: 'all 0.15s ease',
                          backgroundColor: sel ? H.successLight : t.sameSubject ? '#F3E8FF' : H.surface,
                          color: sel ? '#14532D' : t.sameSubject ? '#6B21A8' : H.textPrimary,
                          opacity: !t.isFree ? 0.75 : 1
                        }}
                      >
                        {isSaving ? (
                          <Loader2 size={11} style={{ animation: 'spin 0.7s linear infinite' }} />
                        ) : sel ? (
                          <CheckCircle2 size={12} style={{ color: H.successGreen }} />
                        ) : t.sameSubject ? (
                          <Star size={11} style={{ color: H.purple, fill: H.purple }} />
                        ) : null}

                        <span>{t.full_name}</span>

                        {!t.isFree && <span style={{ fontSize: '10px', color: H.danger, fontWeight: 700 }}>(Busy P{pNum})</span>}
                        {sel && <span style={{ fontSize: '10px', color: H.successGreen, fontWeight: 700 }}>(Saved)</span>}
                      </button>
                    )
                  }

                  return (
                    <div key={pNum} style={{ borderRadius: '12px', border: `1px solid ${subId ? H.successGreen : H.border}`, overflow: 'hidden' }}>
                      {/* Period Header */}
                      <div style={{ padding: '10px 14px', backgroundColor: subId ? '#F0FDF4' : '#FAFAFA', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: subId ? H.successGreen : '#18181B', color: '#FFF', fontWeight: 800, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            P{pNum}
                          </div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: H.textPrimary }}>
                              Period {pNum} {timeRangeStr ? `· ${timeRangeStr}` : ''} {slot.className ? `(${slot.className})` : ''}
                            </div>
                            <div style={{ fontSize: 11, color: H.textMuted }}>
                              Subject: <strong style={{ color: H.textPrimary }}>{slot.subject || 'General'}</strong>
                            </div>
                          </div>
                        </div>

                        {subId && (
                          <div>
                            {notified[pNum] ? (
                              <span style={{ fontSize: 11, fontWeight: 700, color: H.successGreen, display: 'flex', alignItems: 'center', gap: 4 }}>
                                <CheckCircle2 size={12} /> Notified
                              </span>
                            ) : (
                              <button
                                onClick={() => handleNotifySingle(pNum)}
                                disabled={notifyingPill[pNum]}
                                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6, border: `1px solid ${H.border}`, backgroundColor: H.surface, color: H.textPrimary, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                              >
                                {notifyingPill[pNum] ? <Loader2 size={10} style={{ animation: 'spin 0.7s linear infinite' }} /> : <Bell size={11} />}
                                <span>Notify {sub?.full_name?.split(' ')[0]}</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Candidate Selection Area */}
                      <div style={{ padding: '12px 14px', backgroundColor: H.surface, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ fontSize: 10, fontWeight: 800, color: H.textMuted, textTransform: 'uppercase' }}>
                            {isOverride ? 'Manual Override (Showing All Teachers)' : 'Available Substitute Candidates'}
                          </div>
                          <button
                            type="button"
                            onClick={() => setManualOverride(p => ({ ...p, [pNum]: !p[pNum] }))}
                            style={{ border: 'none', background: 'none', color: H.purple, fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                          >
                            <ShieldAlert size={11} /> {isOverride ? 'Show Free Only' : 'Manual Override'}
                          </button>
                        </div>

                        {candidates.length === 0 ? (
                          <div style={{ fontSize: 12, color: H.danger, display: 'flex', alignItems: 'center', gap: 6, padding: '6px 0' }}>
                            <AlertTriangle size={14} /> No conflict-free teachers available for Period {pNum}. Click "Manual Override" to view busy teachers.
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {/* Same subject group */}
                            {subjectMatches.length > 0 && (
                              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                {subjectMatches.map(t => renderPill(t))}
                              </div>
                            )}

                            {/* Other candidates */}
                            {otherCandidates.length > 0 && (
                              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                {otherCandidates.map(t => renderPill(t))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Drawer Footer */}
        <div style={{ padding: '16px 24px', borderTop: `1px solid ${H.border}`, backgroundColor: H.surface, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 12, color: H.textMuted }}>
            {Object.keys(assignedSubs).length} cover assignment(s) saved
          </div>
          <button
            onClick={onClose}
            style={{
              padding: '8px 20px',
              borderRadius: '8px',
              backgroundColor: '#18181B',
              color: '#FFFFFF',
              border: 'none',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Done
          </button>
        </div>
      </div>

      {/* Manual Override Conflict Safeguard Modal */}
      {conflictModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 110,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(2px)'
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '440px',
              backgroundColor: H.surface,
              borderRadius: '16px',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
              fontFamily: H.font
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AlertTriangle size={20} style={{ color: H.danger }} />
              </div>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: H.danger }}>
                  Schedule Conflict Warning
                </h3>
                <p style={{ fontSize: '12px', color: H.textMuted, margin: '2px 0 0 0' }}>
                  Manual Override Assignment Confirmation
                </p>
              </div>
            </div>

            <p style={{ fontSize: '13.5px', color: H.textPrimary, lineHeight: 1.5, margin: '0 0 20px 0' }}>
              <strong>{conflictModal.candidate?.full_name}</strong> is currently flagged as <strong>busy during Period {conflictModal.pNum}</strong> ({conflictModal.candidate?.isTeaching ? 'teaching regular class' : 'assigned to another cover'}).
              <br /><br />
              Assigning this teacher will create a double-booking schedule conflict. Are you sure you want to proceed?
            </p>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setConflictModal(null)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: `1px solid ${H.border}`,
                  backgroundColor: H.surface,
                  color: H.textSec,
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const { pNum, candidate, slot } = conflictModal
                  setConflictModal(null)
                  execToggleCandidate(pNum, candidate, slot)
                }}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: H.danger,
                  color: '#FFFFFF',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Proceed & Assign Anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
