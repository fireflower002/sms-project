'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, GraduationCap, Plus, Trash2, Loader2, Pencil, Check, X, Search, Download, UserCheck, Star, BookOpen, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { H, STYLE } from '@/lib/honey'
import { createStyles } from '@/lib/styles'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { TableSkeleton } from '@/components/ui/Skeleton'
import EmptyState from '@/components/ui/EmptyState'
import ConfirmModal, { ConfirmModalState } from '@/components/ui/ConfirmModal'
import { exportToCSV } from '@/lib/csvExport'
import { useToast } from '@/components/ui/Toast'
import { CURATED_PALETTE, DEFAULT_SUBJECT_COLORS } from '@/components/admin/SubjectModal'

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const ALL_GRADES = Array.from({ length: 13 }, (_, i) => i + 1)

interface ClassRow {
  id: string
  name: string
  grade_level: number
  slug: string
  class_teacher_id?: string
  class_teacher_periods?: number
  class_teacher_subject?: string
  class_teacher?: { full_name: string; subjects?: string[] } | any
}

const getStoredClassTeacher = (classId: string, slug: string) => {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(`ct_cache_${classId}`) || localStorage.getItem(`ct_cache_${slug}`)
    return raw ? JSON.parse(raw) : null
  } catch (e) {
    return null
  }
}

const setStoredClassTeacher = (classId: string, slug: string, data: { teacherId: string; periods: number; subject: string }) => {
  if (typeof window === 'undefined') return
  try {
    const json = JSON.stringify(data)
    localStorage.setItem(`ct_cache_${classId}`, json)
    localStorage.setItem(`ct_cache_${slug}`, json)
  } catch (e) {}
}

export default function ClassesPage() {
  const supabase = createClient()
  const [classes, setClasses]     = useState<ClassRow[]>([])
  const [teachers, setTeachers]   = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState<number | null>(null) // which grade is saving
  const [toast, setToast]         = useState<{ msg: string; ok: boolean } | null>(null)
  const [showAddGrade, setShowAddGrade] = useState(false)
  const [newGradeLevel, setNewGradeLevel] = useState(6)
  const [newGradeCount, setNewGradeCount] = useState(3)
  const [search, setSearch] = useState('')
  const [hasActiveTemplate, setHasActiveTemplate] = useState<boolean>(true)
  const { showToast } = useToast()

  // Class Teacher modal state
  const [editingClassTeacher, setEditingClassTeacher] = useState<ClassRow | null>(null)
  const [ctTeacherId, setCtTeacherId] = useState('')
  const [ctPeriods, setCtPeriods] = useState(1)
  const [ctSubject, setCtSubject] = useState('')
  const [savingCT, setSavingCT] = useState(false)

  // Add grade Class Teacher state
  const [newClassTeachers, setNewClassTeachers] = useState<Record<string, string>>({})
  const [newClassPeriods, setNewClassPeriods]   = useState<Record<string, number>>({})
  const [newClassSubjects, setNewClassSubjects] = useState<Record<string, string>>({})

  // Inline rename state
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameVal, setRenameVal]   = useState('')
  const [hoveredGradeBtn, setHoveredGradeBtn] = useState<string | null>(null)
  const [hoveredClassPill, setHoveredClassPill] = useState<string | null>(null)
  const [hoveredAddClassBtn, setHoveredAddClassBtn] = useState<number | null>(null)
  const [modal, setModal] = useState<ConfirmModalState | null>(null)

  const flash = (msg: string, ok = true) => {
    setToast({ msg, ok })
    showToast(msg, ok ? 'success' : 'error')
    setTimeout(() => setToast(null), 3000)
  }

  const handleExportCSV = () => {
    const ok = exportToCSV(
      'classes_list',
      [
        { label: 'Class Name', key: 'name' },
        { label: 'Grade Level', key: 'grade_level' },
        { label: 'Class Teacher', key: 'class_teacher_name' },
        { label: 'Default Subject', key: 'class_teacher_subject' },
      ],
      filteredClasses.map(c => ({
        ...c,
        class_teacher_name: c.class_teacher?.full_name || 'Unassigned',
      }))
    )
    if (ok) {
      showToast(`Exported ${filteredClasses.length} class records to CSV`, 'success')
    } else {
      showToast('No class records available to export', 'warning')
    }
  }

  const syncClassTeacherToTimetables = async (classId: string, teacherId: string | null, periodCount: number, subject: string | null) => {
    if (!classId) return
    try {
      const { data: tmpls } = await supabase.from('timetable_templates').select('id').eq('is_active', true)
      if (!tmpls || tmpls.length === 0) return

      for (const tmpl of tmpls) {
        for (let day = 1; day <= 5; day++) {
          for (let period = 1; period <= 2; period++) {
            if (teacherId && subject && period <= periodCount) {
              const subjectColor = DEFAULT_SUBJECT_COLORS[subject] || CURATED_PALETTE[0]
              const { data: existing } = await supabase
                .from('schedule_assignments')
                .select('id')
                .eq('template_id', tmpl.id)
                .eq('class_id', classId)
                .eq('day_of_week', day)
                .eq('period_number', period)
                .maybeSingle()

              if (existing) {
                await supabase.from('schedule_assignments').update({
                  teacher_id: teacherId,
                  subject: subject,
                  subject_color: subjectColor,
                }).eq('id', existing.id)
              } else {
                await supabase.from('schedule_assignments').insert({
                  template_id: tmpl.id,
                  class_id: classId,
                  day_of_week: day,
                  period_number: period,
                  teacher_id: teacherId,
                  subject: subject,
                  subject_color: subjectColor,
                })
              }
            } else {
              // Delete period assignment if teacher is unassigned, subject is null, or period exceeds periodCount
              await supabase.from('schedule_assignments').delete()
                .eq('template_id', tmpl.id)
                .eq('class_id', classId)
                .eq('day_of_week', day)
                .eq('period_number', period)
            }
          }
        }
      }
    } catch (e) {
      console.error('Timetable auto-sync error:', e)
    }
  }

  const [hasCTColumns, setHasCTColumns] = useState<boolean>(false)

  const fetchClasses = async () => {
    const [{ data: tch }, { data: tmplData }] = await Promise.all([
      supabase.from('profiles').select('id, full_name, subjects').eq('role', 'teacher').eq('is_active', true).order('full_name'),
      supabase.from('timetable_templates').select('id').eq('is_active', true).maybeSingle()
    ])
    const teacherList = tch || []
    setTeachers(teacherList)
    setHasActiveTemplate(Boolean(tmplData))

    const { data: rawData } = await supabase
      .from('classes')
      .select('*')
      .eq('is_active', true)
      .order('grade_level')
      .order('name')

    // Auto-migrate any legacy localStorage class teacher assignments into DB columns
    for (const c of rawData || []) {
      if (!c.class_teacher_id) {
        const stored = getStoredClassTeacher(c.id, c.slug)
        if (stored?.teacherId) {
          await supabase.from('classes').update({
            class_teacher_id: stored.teacherId,
            class_teacher_periods: stored.periods || 1,
            class_teacher_subject: stored.subject || null,
          }).eq('id', c.id)
        }
      }
    }

    // Refetch clean rows after auto-migration check if any updates occurred
    const { data: cleanRows } = await supabase.from('classes').select('*').eq('is_active', true).order('grade_level').order('name')
    const sourceData = cleanRows || rawData || []

    const mapped: ClassRow[] = sourceData.map((c: any) => {
      const ctId = c.class_teacher_id
      const ctPer = c.class_teacher_periods || 1
      const ctSub = c.class_teacher_subject

      return {
        ...c,
        class_teacher_id: ctId,
        class_teacher_periods: ctPer,
        class_teacher_subject: ctSub,
        class_teacher: ctId ? teacherList.find(t => t.id === ctId) : undefined
      }
    }).sort((a, b) => a.grade_level - b.grade_level || a.name.localeCompare(b.name, undefined, { numeric: true }))

    setClasses(mapped)
    setLoading(false)
  }

  const openEditModal = (cls: ClassRow) => {
    const ctId = cls.class_teacher_id || ''
    const ctPer = cls.class_teacher_periods || 1
    const t = teachers.find(x => x.id === ctId)
    const ctSub = cls.class_teacher_subject || (t?.subjects?.[0] || '')

    setEditingClassTeacher(cls)
    setCtTeacherId(ctId)
    setCtPeriods(ctPer)
    setCtSubject(ctSub)
  }

  const getOtherClassAssignedToTeacher = (teacherId: string, currentClassId?: string) => {
    if (!teacherId) return null
    const match = classes.find(c => c.class_teacher_id === teacherId && c.id !== currentClassId)
    return match ? match.name : null
  }

  const handleSaveClassTeacher = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingClassTeacher) return
    if (!ctTeacherId) {
      flash('Please select a Class Teacher (In Charge)', false)
      return
    }
    setSavingCT(true)

    // Remove teacher from any previous class assignment to enforce 1-to-1 teacher in charge constraint
    await supabase.from('classes').update({
      class_teacher_id: null,
      class_teacher_periods: 1,
      class_teacher_subject: null,
    }).eq('class_teacher_id', ctTeacherId)

    const isNewClass = !editingClassTeacher.id

    if (isNewClass) {
      const basicPayload = {
        name: editingClassTeacher.name,
        grade_level: editingClassTeacher.grade_level,
        slug: editingClassTeacher.slug,
        is_active: true,
        class_teacher_id: ctTeacherId,
        class_teacher_periods: ctPeriods,
        class_teacher_subject: ctSubject || null,
      }
      const { data: inserted, error: insertErr } = await supabase
        .from('classes')
        .upsert(basicPayload, { onConflict: 'slug' })
        .select('id')
        .maybeSingle()

      if (insertErr) {
        flash(`Failed to create class: ${insertErr.message}`, false)
        setSavingCT(false)
        return
      }

      if (inserted?.id) {
        await syncClassTeacherToTimetables(inserted.id, ctTeacherId, ctPeriods, ctSubject || null)
      }
      flash(`${editingClassTeacher.name} created with Class Teacher assigned!`)
      await fetchClasses()
      setEditingClassTeacher(null)
      setSavingCT(false)
      return
    }

    const payload: any = {
      class_teacher_id: ctTeacherId,
      class_teacher_periods: ctPeriods,
      class_teacher_subject: ctSubject || null,
    }
    const { error } = await supabase.from('classes').update(payload).eq('id', editingClassTeacher.id)

    if (error) {
      console.error('Failed to update Class Teacher:', error.message)
      flash('Could not update class teacher assignment. Please try again.', false)
      setSavingCT(false)
      return
    }

    await syncClassTeacherToTimetables(editingClassTeacher.id, ctTeacherId, ctPeriods, ctSubject || null)
    flash(`Class Teacher settings updated for ${editingClassTeacher.name}!`)

    // Update in-place in local state
    setClasses(prev => prev.map(c => {
      if (c.class_teacher_id === ctTeacherId && c.id !== editingClassTeacher.id) {
        return { ...c, class_teacher_id: undefined, class_teacher_periods: 1, class_teacher_subject: undefined, class_teacher: undefined }
      }
      if (c.id === editingClassTeacher.id) {
        return {
          ...c,
          class_teacher_id: ctTeacherId,
          class_teacher_periods: ctPeriods,
          class_teacher_subject: ctSubject || undefined,
          class_teacher: teachers.find(t => t.id === ctTeacherId),
        }
      }
      return c
    }))

    setEditingClassTeacher(null)
    setSavingCT(false)
  }

  useEffect(() => { fetchClasses() }, [])

  // Map assigned class teachers for 1-to-1 constraint validation
  const assignedTeacherMap: Record<string, string> = {}
  classes.forEach(c => {
    if (c.class_teacher_id) {
      assignedTeacherMap[c.class_teacher_id] = c.name
    }
  })

  // Filter classes by search term
  const filteredClasses = classes.filter(c => {
    if (!search.trim()) return true
    const q = search.trim().toLowerCase()
    return c.name.toLowerCase().includes(q) || `grade ${c.grade_level}`.includes(q)
  })

  // Group by grade
  const byGrade: Record<number, ClassRow[]> = {}
  filteredClasses.forEach(c => {
    if (!byGrade[c.grade_level]) byGrade[c.grade_level] = []
    byGrade[c.grade_level].push(c)
  })
  const usedGrades   = Object.keys(byGrade).map(Number).sort((a, b) => a - b)
  const unusedGrades = ALL_GRADES.filter(g => !usedGrades.includes(g))

  // ── Add whole grade ──
  const handleAddGrade = async () => {
    if (!hasActiveTemplate) {
      flash('Cannot create classes: Please create an active timetable template first.', false)
      return
    }

    // Enforce that every class preview MUST have a Class Teacher assigned
    for (let i = 0; i < newGradeCount; i++) {
      const suffix = LETTERS[i]
      if (!newClassTeachers[suffix]) {
        flash(`Please assign a Class Teacher for Grade ${newGradeLevel} ${suffix}`, false)
        return
      }
      if (!newClassSubjects[suffix]) {
        flash(`Please select a Subject for Grade ${newGradeLevel} ${suffix}`, false)
        return
      }
    }

    setSaving(-1)
    let createdCount = 0
    for (let i = 0; i < newGradeCount; i++) {
      const suffix = LETTERS[i]
      const teacherId = newClassTeachers[suffix] || null
      const periods   = newClassPeriods[suffix] || 1
      const subject   = newClassSubjects[suffix] || null

      if (teacherId && subject) {
        setStoredClassTeacher('', `grade-${newGradeLevel}-${suffix.toLowerCase()}`, {
          teacherId: teacherId,
          periods: periods,
          subject: subject,
        })
      }

      if (teacherId && hasCTColumns) {
        // Enforce 1-to-1 rule: Unassign from previous class
        try {
          await supabase.from('classes').update({
            class_teacher_id: null,
            class_teacher_periods: 1,
            class_teacher_subject: null,
          }).eq('class_teacher_id', teacherId)
        } catch (e) {}
      }

      const basicPayload = {
        name: `Grade ${newGradeLevel} ${suffix}`,
        grade_level: newGradeLevel,
        slug: `grade-${newGradeLevel}-${suffix.toLowerCase()}`,
        is_active: true,
      }

      const payloadToInsert = (hasCTColumns && teacherId && subject) ? {
        ...basicPayload,
        class_teacher_id: teacherId,
        class_teacher_periods: periods,
        class_teacher_subject: subject,
      } : basicPayload

      let { data: inserted, error: err } = await supabase
        .from('classes')
        .upsert(payloadToInsert, { onConflict: 'slug' })
        .select('id')
        .maybeSingle()

      if (err) {
        // Fallback to basic payload without class_teacher_* columns
        const fb = await supabase.from('classes').upsert(basicPayload, { onConflict: 'slug' }).select('id').maybeSingle()
        inserted = fb.data
        err = fb.error
      }

      if (err) {
        flash(`Error creating Grade ${newGradeLevel} ${suffix}: ${err.message}`, false)
      } else {
        createdCount++
        if (inserted?.id && teacherId && subject) {
          await syncClassTeacherToTimetables(inserted.id, teacherId, periods, subject)
        }
      }
    }
    setShowAddGrade(false)
    setNewClassTeachers({})
    setNewClassPeriods({})
    setNewClassSubjects({})
    if (createdCount > 0) {
      flash(`Grade ${newGradeLevel} added with ${createdCount} class${createdCount !== 1 ? 'es' : ''}!`)
    }
    await fetchClasses()
    setSaving(null)
  }

  // ── Add one more class to a grade ──
  const handlePlusClass = (grade: number) => {
    if (!hasActiveTemplate) {
      flash('Cannot add class: Please create an active timetable template first.', false)
      return
    }
    const existing = byGrade[grade] || []
    if (existing.length >= 26) return
    const suffix = LETTERS[existing.length]
    const className = `Grade ${grade} ${suffix}`
    const slug = `grade-${grade}-${suffix.toLowerCase()}`

    setEditingClassTeacher({
      id: '',
      name: className,
      grade_level: grade,
      slug: slug,
    })
    setCtTeacherId('')
    setCtPeriods(1)
    setCtSubject('')
  }

  // ── Remove last class from a grade ──
  const handleMinusClass = (grade: number) => {
    const existing = (byGrade[grade] || []).sort((a, b) => a.name.localeCompare(b.name))
    if (existing.length === 0) return
    const last = existing[existing.length - 1]
    setModal({
      title: 'Remove Class?',
      message: `Are you sure you want to remove ${last.name}?`,
      variant: 'danger',
      confirmLabel: 'Remove',
      onConfirm: async () => {
        setModal(null);
        setSaving(grade)
        const { error } = await supabase.from('classes').update({ is_active: false }).eq('id', last.id)
        if (error) {
          console.error('Failed to remove class:', error.message)
          flash('Could not remove class. Please try again.', false)
        } else flash(`${last.name} removed`)
        await fetchClasses()
        setSaving(null)
      }
    });
  }

  // ── Delete entire grade ──
  const handleDeleteGrade = (grade: number) => {
    const cls = byGrade[grade] || []
    setModal({
      title: 'Delete Entire Grade?',
      message: `Delete all ${cls.length} classes in Grade ${grade}? This cannot be undone.`,
      variant: 'danger',
      confirmLabel: 'Delete Grade',
      onConfirm: async () => {
        setModal(null);
        setSaving(grade)
        const { error } = await supabase.from('classes').update({ is_active: false }).in('id', cls.map(c => c.id))
        if (error) {
          console.error('Failed to delete grade:', error.message)
          flash('Could not delete grade level. Please try again.', false)
        } else {
          flash(`Grade ${grade} deleted`)
          await fetchClasses()
        }
        setSaving(null)
      }
    });
  }

  // ── Rename class ──
  const handleRename = async (id: string) => {
    const name = renameVal.trim()
    if (!name) return
    const { error } = await supabase.from('classes').update({ name }).eq('id', id)
    if (error) {
      console.error('Failed to rename class:', error.message)
      flash('Could not rename class. Please try again.', false)
    } else { flash('Renamed'); setRenamingId(null) }
    await fetchClasses()
  }

  const gradeColor = (g: number) => H.gradeColors[(g - 1) % H.gradeColors.length]

  const styles = createStyles({
    container: { minHeight: '100vh', background: H.bg },
    header: { position:'sticky', top:0, zIndex:50, background: H.surface, borderBottom:`1px solid ${H.border}` },
    headerContent: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: '64px', maxWidth: '760px', margin: '0 auto', padding: '12px 20px', flexWrap: 'wrap', gap: '12px' },
    headerLeft: { display: 'flex', alignItems: 'center', gap: '12px' },
    backButton: { background:'#F5F5F4', color:H.muted, border:`1px solid ${H.border}`, borderRadius:8, fontFamily:H.font, fontWeight:600, fontSize:12, minHeight: '44px', padding:'8px 14px', cursor:'pointer', display:'inline-flex', alignItems:'center', gap:5, textDecoration:'none' },
    iconWrapper: { width: '32px', height: '32px', borderRadius: '8px', background: H.purpleLight, display: 'flex', alignItems: 'center', justifyContent: 'center' },
    icon: { color: H.purpleDark },
    headerTitle: { fontWeight: 800, fontSize: '14px', color:H.text },
    headerSubtitle: { fontSize: '11px', color: H.sub },
    headerRight: { display: 'flex', gap: '8px', alignItems: 'center' },
    addGradeButton: { background:H.purple, color:'#FFFFFF', border:'none', borderRadius:10, fontFamily:H.font, fontWeight:700, fontSize:13, minHeight: '44px', padding:'10px 18px', cursor:'pointer', display:'inline-flex', alignItems:'center', gap:6, textDecoration:'none' },
    
    toast: {
      position: 'fixed', top: '76px', left: '50%', transform: 'translateX(-50%)',
      zIndex: 9998, padding: '9px 18px', borderRadius: '10px',
      background: H.grass, color: 'white',
      fontSize: '13px', fontWeight: 600, boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
      whiteSpace: 'nowrap', pointerEvents: 'none',
    },
    toastError: {
      background: H.danger,
    },

    main: { padding: '28px 0 60px', maxWidth: '760px', margin: '0 auto', fontFamily:H.font, color:H.text },
    loadingContainer: { display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px', gap: '10px', color: H.muted },
    emptyStateCard: { background:H.surface, borderRadius:16, border:`1px solid ${H.border}`, boxShadow:'0 2px 8px rgba(0,0,0,0.06)', overflow:'hidden', textAlign: 'center', padding: '64px 32px' },
    emptyStateIcon: { margin: '0 auto 16px', color: H.sub },
    emptyStateTitle: { fontWeight: 700, fontSize: '18px', marginBottom: '8px' },
    emptyStateSubtitle: { fontSize: '14px', color: H.muted, marginBottom: '24px' },
    emptyStateButton: { background:H.purple, color:'#FFFFFF', border:'none', borderRadius:10, fontFamily:H.font, fontWeight:700, fontSize:13, padding:'8px 16px', cursor:'pointer', display:'inline-flex', alignItems:'center', gap:6, textDecoration:'none' },
    
    gradesList: { display: 'flex', flexDirection: 'column', gap: '14px' },
    gradeCard: { background:H.surface, borderRadius:16, border:`1px solid ${H.border}`, boxShadow:'0 2px 8px rgba(0,0,0,0.06)', overflow:'hidden', padding: '0' },
    gradeHeader: {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '14px 20px',
      borderBottom: `1px solid ${H.border}`,
    },
    gradeHeaderLeft: { display: 'flex', alignItems: 'center', gap: '12px' },
    gradeBadge: {
      width: '44px', height: '44px', borderRadius: '12px',
      color: 'white',
      fontWeight: 800, fontSize: '20px',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    },
    gradeTitle: { fontWeight: 800, fontSize: '17px', color:H.text },
    gradeSubtitle: { fontSize: '12px', color: H.sub },
    gradeControls: { display: 'flex', alignItems: 'center', gap: '8px' },
    controlButton: {
      width: '34px', height: '34px', borderRadius: '8px',
      border: `1px solid ${H.border}`,
      background: H.surface,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      cursor: 'pointer',
      fontSize: '20px', fontWeight: 700, lineHeight: 1,
    },
    minusButton: { color: H.danger },
    plusButton: { color: H.grass },
    gradeCountDisplay: {
      minWidth: '36px', height: '34px', borderRadius: '8px',
      border: `1px solid`,
      background: `transparent`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 800, fontSize: '18px',
    },
    deleteGradeButton: {
      width: '34px', height: '34px', borderRadius: '8px',
      border: `1px solid ${H.border}`,
      background: H.surface,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      cursor: 'pointer', color: H.danger, marginLeft: '4px',
    },

    classPillsContainer: { padding: '16px 20px', display: 'flex', flexWrap: 'wrap', gap: '10px' },
    classPill: {
      display: 'flex', alignItems: 'center', gap: '0',
      borderRadius: '10px', overflow: 'hidden',
    },
    classLetterBadge: {
      width: '32px', height: '32px',
      color: 'white',
      fontWeight: 800, fontSize: '14px',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    },
    classDisplayName: {
      padding: '0 10px', height: '32px', display: 'flex', alignItems: 'center',
      fontSize: '13px', fontWeight: 600, color: H.text,
      whiteSpace: 'nowrap',
    },
    renameInput: {
      width: '110px', padding: '0 8px', height: '32px',
      border: 'none', outline: 'none', fontSize: '12px', fontWeight: 600,
      background: H.surface,
      color: H.text,
    },
    renameConfirmButton: { width: '28px', height: '32px', border: 'none', background: `${H.grass}22`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: H.grass },
    renameCancelButton: { width: '28px', height: '32px', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: H.muted },
    renameButton: { width: '28px', height: '32px', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: H.muted, opacity: 0.6 },
    
    quickAddButton: {
      height: '34px', padding: '0 12px', borderRadius: '10px',
      background: 'transparent', color: H.text,
      cursor: 'pointer', fontSize: '12px', fontWeight: 700,
      display: 'flex', alignItems: 'center', gap: '4px',
      opacity: 0.7, transition: 'opacity 0.15s',
    },

    modalOverlay: { position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' },
    modalBackdrop: { position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' },
    modalContent: {
      position: 'relative', width: '100%', maxWidth: '420px',
      borderRadius: '16px', overflow: 'hidden',
      background: H.surface,
      border: `1px solid ${H.border}`,
      boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
    },
    modalHeader: { padding: '22px 24px 0' },
    modalTitle: { fontWeight: 800, fontSize: '18px', marginBottom: '4px', color:H.text },
    modalSubtitle: { fontSize: '13px', color: H.sub, marginBottom: '24px' },
    modalBody: { padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: '20px' },
    modalLabel: { fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: H.sub, display: 'block', marginBottom: '10px' },
    gradeSelector: { display: 'flex', flexWrap: 'wrap', gap: '8px' },
    gradeSelectorButton: {
      width: '44px', height: '44px', borderRadius: '10px',
      border: `1px solid ${H.border}`,
      background: '#F5F5F4',
      color: H.text,
      fontWeight: 800, fontSize: '16px', cursor: 'pointer',
      transition: 'all 0.15s',
    },
    gradeCountControls: { display: 'flex', alignItems: 'center', gap: '12px' },
    gradeCountButton: { width: '40px', height: '40px', borderRadius: '10px', border: `1px solid ${H.border}`, background: '#F5F5F4', fontSize: '22px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    minusCountButton: { color: H.danger },
    plusCountButton: { color: H.grass },
    modalGradeCountDisplay: { flex: 1, textAlign: 'center' },
    gradeCountNumber: { fontWeight: 800, fontSize: '32px', lineHeight: 1 },
    gradeCountLabel: { fontSize: '11px', color: H.muted, marginTop: '2px' },
    previewPills: { display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '14px' },
    previewPill: {
      display: 'flex', alignItems: 'center', borderRadius: '8px', overflow: 'hidden',
      border: `1px solid ${H.border}`,
    },
    previewLetterBadge: { width: '26px', height: '26px', color: 'white', fontWeight: 800, fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    previewClassName: { padding: '0 8px', fontSize: '12px', fontWeight: 600, color:H.text },
    modalButtons: { display: 'flex', gap: '10px', marginTop: '4px' },
    cancelButton: { background:'#F5F5F4', color:H.muted, border:`1px solid ${H.border}`, borderRadius:10, fontFamily:H.font, fontWeight:600, fontSize:12, padding:'8px 16px', cursor:'pointer', display:'inline-flex', alignItems:'center', gap:5, textDecoration:'none', flex: 1 },
    createGradeButton: { background:H.purple, color:'#FFFFFF', border:'none', borderRadius:10, fontFamily:H.font, fontWeight:700, fontSize:13, padding:'8px 16px', cursor:'pointer', display:'inline-flex', alignItems:'center', gap:6, textDecoration:'none', flex: 1 },
  });

  return (
    <div style={{ backgroundColor: H.bg, minHeight: '100vh', padding: 'clamp(16px, 3vw, 28px)', fontFamily: H.font, boxSizing: 'border-box' }}>
      <div style={{ backgroundColor: H.surface, border: `1px solid ${H.border}`, borderRadius: '16px', boxShadow: H.cardShadow, overflow: 'hidden' }}>
        
        {/* Contiguous Header Bar */}
        <header style={{ padding: '20px 24px', borderBottom: `1px solid ${H.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', backgroundColor: H.surface }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#F4F4F5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <GraduationCap size={20} style={{ color: '#18181B' }} />
            </div>
            <div>
              <h1 style={{ fontSize: '22px', fontWeight: 600, letterSpacing: '-0.02em', color: H.textPrimary, margin: 0 }}>Grades & Classes</h1>
              <p style={{ fontSize: '13px', fontWeight: 400, color: H.textSec, margin: '4px 0 0', fontVariantNumeric: 'tabular-nums' }}>
                {usedGrades.length} active grade{usedGrades.length !== 1 ? 's' : ''} • {classes.length} total classes
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {unusedGrades.length > 0 && (
              <button
                onClick={() => {
                  if (!hasActiveTemplate) {
                    showToast('Please create a timetable template first before adding classes.', 'warning')
                    return
                  }
                  setNewGradeLevel(unusedGrades[0])
                  setNewGradeCount(3)
                  setShowAddGrade(true)
                }}
                style={{
                  ...styles.addGradeButton,
                  borderRadius: '8px',
                  minHeight: '36px',
                  fontSize: '13px',
                  fontWeight: 600,
                  background: '#18181B',
                  opacity: hasActiveTemplate ? 1 : 0.5,
                  cursor: hasActiveTemplate ? 'pointer' : 'not-allowed',
                }}
                title={!hasActiveTemplate ? 'Create a timetable template first' : 'Add Grade'}
              >
                <Plus size={14} /> Add Grade
              </button>
            )}
          </div>
        </header>

        {/* Warning Banner if No Active Timetable Template Exists */}
        {!hasActiveTemplate && (
          <div style={{ margin: '16px 24px 0', padding: '14px 18px', borderRadius: '12px', background: '#FFF7ED', border: '1px solid #FFEDD5', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <AlertTriangle size={20} style={{ color: '#C2410C' }} />
              <div>
                <div style={{ fontWeight: 800, fontSize: '13px', color: '#9A3412' }}>
                  Timetable Template Required Before Creating Classes
                </div>
                <div style={{ fontSize: '12px', color: H.textPrimary, marginTop: '2px' }}>
                  You cannot create or setup classes without first creating an active timetable template.
                </div>
              </div>
            </div>
            <Link href="/admin/timetable/new" style={{ padding: '8px 16px', borderRadius: '10px', background: H.purple, color: '#fff', fontSize: '12px', fontWeight: 700, textDecoration: 'none' }}>
              Create Timetable Template →
            </Link>
          </div>
        )}

        {/* Warning Banner for Incomplete Classes Missing Class Teacher */}
        {(() => {
          const incompleteClasses = classes.filter(c => !c.class_teacher_id || !c.class_teacher_subject)
          if (incompleteClasses.length === 0 || !hasActiveTemplate) return null
          return (
            <div style={{ margin: '16px 24px 0', padding: '14px 18px', borderRadius: '12px', background: '#FFF7ED', border: '1px solid #FFEDD5', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <AlertTriangle size={20} style={{ color: '#C2410C' }} />
                <div>
                  <div style={{ fontWeight: 800, fontSize: '13px', color: '#9A3412' }}>
                    Incomplete Classes Detected ({incompleteClasses.length} class{incompleteClasses.length !== 1 ? 'es' : ''})
                  </div>
                  <div style={{ fontSize: '12px', color: H.textPrimary, marginTop: '2px' }}>
                    Some active classes do not have a Class Teacher assigned. Assigning a Class Teacher automatically configures their daily opening period coverage in active timetables.
                  </div>
                </div>
              </div>
              <button
                onClick={() => openEditModal(incompleteClasses[0])}
                style={{ padding: '8px 16px', borderRadius: '10px', background: H.purple, color: '#fff', fontSize: '12px', fontWeight: 700, border: 'none', cursor: 'pointer' }}
              >
                Assign Class Teacher →
              </button>
            </div>
          )
        })()}

        {/* Search & Export Toolbar */}
        <div style={{ padding: '14px 24px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${H.border}`, backgroundColor: '#FAF9F6' }}>
          <div style={{ position: 'relative', minWidth: '220px', flex: '1 1 240px' }}>
            <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: H.textMuted }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search classes or grade level..."
              style={{
                width: '100%',
                padding: '8px 14px 8px 36px',
                borderRadius: '8px',
                border: `1px solid ${H.border}`,
                background: H.surface,
                color: H.textPrimary,
                fontSize: '13px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <button
            onClick={handleExportCSV}
            style={{
              padding: '8px 14px',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
              borderRadius: '8px',
              border: `1px solid ${H.border}`,
              backgroundColor: H.surface,
              color: H.textPrimary,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              minHeight: '38px',
            }}
            title="Export CSV"
          >
            <Download size={14} /> Export CSV
          </button>
        </div>

        {/* Toast */}
        {toast && (
          <div style={{ ...styles.toast, backgroundColor: toast.ok ? H.grass : H.danger }}>
            {toast.msg}
          </div>
        )}

        <main style={{ padding: '24px' }}>
        {loading ? (
          <TableSkeleton rows={6} columns={4} />
        ) : usedGrades.length === 0 ? (
          /* Empty state */
          <div style={styles.emptyStateCard}>
            <EmptyState
              icon={<GraduationCap size={48} style={styles.emptyStateIcon} />}
              title="No grades yet"
              description="Add a grade to create classes for your school"
              action={
                <button
                  onClick={() => { setNewGradeLevel(6); setNewGradeCount(3); setShowAddGrade(true) }}
                  style={styles.emptyStateButton}
                >
                  <Plus size={15} /> Add First Grade
                </button>
              }
            />
          </div>
        ) : (
          <div style={styles.gradesList}>
            {usedGrades.map(grade => {
              const gradeClasses = (byGrade[grade] || []).sort((a, b) => a.name.localeCompare(b.name))
              const color = gradeColor(grade)
              const isSaving = saving === grade

              return (
                <div key={grade} style={styles.gradeCard}>
                  {/* Grade header bar */}
                  <div style={{...styles.gradeHeader, background: `linear-gradient(135deg, ${color}18, ${color}08)`}}>
                    <div style={styles.gradeHeaderLeft}>
                      {/* Grade badge */}
                      <div style={{...styles.gradeBadge, background: color, boxShadow: `0 4px 12px ${color}55`}}>
                        {grade}
                      </div>
                      <div>
                        <div style={styles.gradeTitle}>Grade {grade}</div>
                        <div style={styles.gradeSubtitle}>
                          {gradeClasses.length} class{gradeClasses.length !== 1 ? 'es' : ''}
                        </div>
                      </div>
                    </div>

                    {/* +/- controls + delete */}
                    <div style={styles.gradeControls}>
                      {isSaving ? (
                        <Loader2 size={18} style={{ animation:'spin 0.7s linear infinite', color: H.muted }} />
                      ) : (
                        <>
                          {/* Minus button */}
                          <button
                            onClick={() => handleMinusClass(grade)}
                            disabled={gradeClasses.length === 0}
                            title="Remove last class"
                            style={{
                              ...styles.controlButton, ...styles.minusButton,
                              cursor: gradeClasses.length === 0 ? 'not-allowed' : 'pointer',
                              opacity: gradeClasses.length === 0 ? 0.4 : 1,
                              background: hoveredGradeBtn === `minus-${grade}` ? '#F5F5F4' : H.surface,
                            }}
                            onMouseEnter={() => setHoveredGradeBtn(`minus-${grade}`)}
                            onMouseLeave={() => setHoveredGradeBtn(null)}
                          >
                            −
                          </button>

                          {/* Class count display */}
                          <div style={{...styles.gradeCountDisplay, borderColor: color, background: `${color}15`, color: color}}>
                            {gradeClasses.length}
                          </div>

                          {/* Plus button */}
                          <button
                            onClick={() => handlePlusClass(grade)}
                            disabled={gradeClasses.length >= 26}
                            title="Add next class"
                            style={{
                              ...styles.controlButton, ...styles.plusButton,
                              cursor: gradeClasses.length >= 26 ? 'not-allowed' : 'pointer',
                              opacity: gradeClasses.length >= 26 ? 0.4 : 1,
                              background: hoveredGradeBtn === `plus-${grade}` ? '#F5F5F4' : H.surface,
                            }}
                            onMouseEnter={() => setHoveredGradeBtn(`plus-${grade}`)}
                            onMouseLeave={() => setHoveredGradeBtn(null)}
                          >
                            +
                          </button>

                          {/* Delete grade */}
                          <button
                            onClick={() => handleDeleteGrade(grade)}
                            title="Delete entire grade"
                            style={{
                              ...styles.deleteGradeButton,
                              background: hoveredGradeBtn === `delete-${grade}` ? '#F5F5F4' : H.surface,
                            }}
                            onMouseEnter={() => setHoveredGradeBtn(`delete-${grade}`)}
                            onMouseLeave={() => setHoveredGradeBtn(null)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Class pills */}
                  <div style={styles.classPillsContainer}>
                    {gradeClasses.map((cls, idx) => (
                      <div key={cls.id} style={{
                        ...styles.classPill,
                        borderColor: `${color}55`,
                        background: `${color}10`,
                      }}>
                        {/* Letter badge */}
                        <div style={{...styles.classLetterBadge, background: color}}>
                          {LETTERS[idx]}
                        </div>

                        {renamingId === cls.id ? (
                          /* Inline rename */
                          <>
                            <input
                              autoFocus
                              value={renameVal}
                              onChange={e => setRenameVal(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') handleRename(cls.id); if (e.key === 'Escape') setRenamingId(null) }}
                              style={styles.renameInput}
                            />
                            <button onClick={() => handleRename(cls.id)} style={styles.renameConfirmButton}>
                              <Check size={12} />
                            </button>
                            <button onClick={() => setRenamingId(null)} style={styles.renameCancelButton}>
                              <X size={12} />
                            </button>
                          </>
                        ) : (
                          /* Normal display */
                          <>
                            <span
                              onClick={() => openEditModal(cls)}
                              style={{ ...styles.classDisplayName, cursor: 'pointer' }}
                              title="Click to edit Class Teacher & Default Periods"
                            >
                              {cls.name}
                              {cls.class_teacher?.full_name ? (
                                <span style={{ fontSize: '10px', color: H.purple, fontWeight: 700, marginLeft: '6px', opacity: 0.9 }}>
                                  ⭐ {cls.class_teacher.full_name.split(' ')[0]} (P1{cls.class_teacher_periods === 2 ? '-P2' : ''}{cls.class_teacher_subject ? ` ${cls.class_teacher_subject}` : ''})
                                </span>
                              ) : (
                                <span style={{ fontSize: '10px', color: '#D97706', background: '#FEF3C7', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', marginLeft: '6px' }}>
                                  ⭐ Unassigned
                                </span>
                              )}
                            </span>
                            <button
                              onClick={() => openEditModal(cls)}
                              title="Edit Class Teacher & Default Periods"
                              style={{ ...styles.renameButton, opacity: 0.9, color: cls.class_teacher_id ? H.purple : H.muted }}
                            >
                              <UserCheck size={12} />
                            </button>
                            <button
                              onClick={() => { setRenamingId(cls.id); setRenameVal(cls.name) }}
                              title="Rename"
                              style={{...styles.renameButton, opacity: hoveredClassPill === cls.id ? 1 : 0.6}}
                              onMouseEnter={() => setHoveredClassPill(cls.id)}
                              onMouseLeave={() => setHoveredClassPill(null)}
                            >
                              <Pencil size={11} />
                            </button>
                          </>
                        )}
                      </div>
                    ))}

                    {/* Quick-add button inside the pills row */}
                    {gradeClasses.length < 26 && !isSaving && (
                      <button
                        onClick={() => handlePlusClass(grade)}
                        title={`Add Grade ${grade} ${LETTERS[gradeClasses.length]}`}
                        style={{
                          ...styles.quickAddButton,
                          borderColor: color,
                          color: color,
                          opacity: hoveredAddClassBtn === grade ? 1 : 0.7,
                        }}
                        onMouseEnter={() => setHoveredAddClassBtn(grade)}
                        onMouseLeave={() => setHoveredAddClassBtn(null)}
                      >
                        <Plus size={12} /> Grade {grade} {LETTERS[gradeClasses.length]}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>

      {/* ── ADD GRADE MODAL ── */}
      {showAddGrade && (
        <div style={styles.modalOverlay}>
          <div onClick={() => setShowAddGrade(false)} style={styles.modalBackdrop} />
          <div style={styles.modalContent}>
            {/* Modal header */}
            <div style={styles.modalHeader}>
              <div style={styles.modalTitle}>Add New Grade</div>
              <div style={styles.modalSubtitle}>
                Choose the grade and how many classes to create
              </div>
            </div>

            <div style={styles.modalBody}>
              <div>
                <label style={styles.modalLabel}>Select Grade Level</label>
                <div style={styles.gradeSelector}>
                  {unusedGrades.map(g => (
                    <button
                      key={g}
                      onClick={() => setNewGradeLevel(g)}
                      style={{
                        ...styles.gradeSelectorButton,
                        borderColor: newGradeLevel === g ? gradeColor(g) : H.border,
                        background: newGradeLevel === g ? `${gradeColor(g)}20` : '#F5F5F4',
                        color: newGradeLevel === g ? gradeColor(g) : H.text,
                      }}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={styles.modalLabel}>Number of Classes to Create</label>
                <div style={styles.gradeCountControls}>
                  <button
                    onClick={() => setNewGradeCount(Math.max(1, newGradeCount - 1))}
                    style={{ ...styles.gradeCountButton, ...styles.minusCountButton }}
                  >
                    -
                  </button>
                  <div style={styles.modalGradeCountDisplay}>
                    <div style={{ ...styles.gradeCountNumber, color: gradeColor(newGradeLevel) }}>
                      {newGradeCount}
                    </div>
                    <div style={styles.gradeCountLabel}>
                      {newGradeCount === 1 ? 'class' : 'classes'}
                    </div>
                  </div>
                  <button
                    onClick={() => setNewGradeCount(Math.min(6, newGradeCount + 1))}
                    style={{ ...styles.gradeCountButton, ...styles.plusCountButton }}
                  >
                    +
                  </button>
                </div>

                <div style={styles.previewPills}>
                  {Array.from({ length: newGradeCount }, (_, i) => LETTERS[i]).map((letter, i) => (
                    <div key={i} style={{ ...styles.previewPill, borderColor: `${gradeColor(newGradeLevel)}44` }}>
                      <div style={{ ...styles.previewLetterBadge, background: gradeColor(newGradeLevel) }}>
                        {letter}
                      </div>
                      <div style={styles.previewClassName}>
                        Grade {newGradeLevel} {letter}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Assign Class Teachers per class section */}
                <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <label style={styles.modalLabel}>Assign Class Teachers in Charge (Optional)</label>
                  {Array.from({ length: newGradeCount }, (_, i) => LETTERS[i]).map(suffix => {
                    const selTeacherId = newClassTeachers[suffix] || ''
                    const selTeacherObj = teachers.find(t => t.id === selTeacherId)
                    const teacherSubjects = selTeacherObj?.subjects?.length ? selTeacherObj.subjects : ['English', 'Mathematics', 'Science', 'History', 'Geography', 'ICT', 'Buddhism', 'Tamil', 'Health', 'Art', 'Music', 'Physical Education']

                    return (
                      <div key={suffix} style={{ padding: '10px 12px', borderRadius: '10px', background: '#F5F5F4', border: `1px solid ${H.border}`, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 800, color: H.textPrimary, display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <UserCheck size={13} style={{ color: H.purple }} /> Grade {newGradeLevel} {suffix}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <select
                            value={selTeacherId}
                            onChange={e => {
                              const val = e.target.value
                              setNewClassTeachers(p => ({ ...p, [suffix]: val }))
                              const t = teachers.find(x => x.id === val)
                              if (t && t.subjects?.length) {
                                setNewClassSubjects(p => ({ ...p, [suffix]: t.subjects[0] }))
                              } else {
                                setNewClassSubjects(p => ({ ...p, [suffix]: '' }))
                              }
                            }}
                            style={{ padding: '7px 10px', borderRadius: '6px', border: `1px solid ${H.border}`, fontSize: '12px', fontWeight: 600, background: H.bg, color: H.textPrimary }}
                          >
                            <option value="">-- No Class Teacher --</option>
                            {teachers.map(t => {
                              const curClass = getOtherClassAssignedToTeacher(t.id)
                              const selectedInOtherSuffix = Object.entries(newClassTeachers).find(([s, id]) => id === t.id && s !== suffix)?.[0]
                              const isTaken = Boolean(curClass || selectedInOtherSuffix)
                              return (
                                <option key={t.id} value={t.id} disabled={isTaken}>
                                  {t.full_name}
                                  {curClass ? ` (Already Class Teacher for ${curClass})` : selectedInOtherSuffix ? ` (Selected for Grade ${newGradeLevel} ${selectedInOtherSuffix})` : ''}
                                </option>
                              )
                            })}
                          </select>

                          {selTeacherId && (
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <select
                                value={newClassPeriods[suffix] || 1}
                                onChange={e => setNewClassPeriods(p => ({ ...p, [suffix]: Number(e.target.value) }))}
                                style={{ flex: 1, padding: '6px 8px', borderRadius: '6px', border: `1px solid ${H.border}`, fontSize: '11px', fontWeight: 600, background: H.bg, color: H.textPrimary }}
                              >
                                <option value={1}>First 1 Period (P1)</option>
                                <option value={2}>First 2 Periods (P1-P2)</option>
                              </select>

                              <select
                                value={newClassSubjects[suffix] || ''}
                                onChange={e => setNewClassSubjects(p => ({ ...p, [suffix]: e.target.value }))}
                                style={{ flex: 1, padding: '6px 8px', borderRadius: '6px', border: `1px solid ${H.border}`, fontSize: '11px', fontWeight: 600, background: H.bg, color: H.textPrimary }}
                              >
                                <option value="">-- Select Subject --</option>
                                {teacherSubjects.map((s: string) => (
                                  <option key={s} value={s}>{s}</option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div style={styles.modalButtons}>
                <button onClick={() => setShowAddGrade(false)} style={styles.cancelButton}>
                  Cancel
                </button>
                <button
                  onClick={handleAddGrade}
                  disabled={saving === -1}
                  style={styles.createGradeButton}
                >
                  {saving === -1 ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : `Create Grade ${newGradeLevel}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── ASSIGN CLASS TEACHER MODAL ── */}
      {editingClassTeacher && (
        <div style={styles.modalOverlay}>
          <div onClick={() => setEditingClassTeacher(null)} style={styles.modalBackdrop} />
          <div style={{ ...styles.modalContent, maxWidth: '460px' }}>
            <form onSubmit={handleSaveClassTeacher}>
              <div style={styles.modalHeader}>
                <div style={styles.modalTitle}>Class Teacher Settings</div>
                <div style={styles.modalSubtitle}>
                  Set the Teacher-in-Charge for <strong>{editingClassTeacher.name}</strong>. This teacher takes the first 1 or 2 periods of every day.
                </div>
              </div>

              <div style={styles.modalBody}>
                {/* Select Teacher */}
                <div>
                  <label style={styles.modalLabel}>Class Teacher (In Charge)</label>
                  <select
                    value={ctTeacherId}
                    onChange={e => {
                      const id = e.target.value
                      setCtTeacherId(id)
                      const t = teachers.find(x => x.id === id)
                      if (t && t.subjects?.length) setCtSubject(t.subjects[0])
                      else setCtSubject('')
                    }}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: `1px solid ${H.border}`, background: H.bg, color: H.textPrimary, fontSize: '13px', fontWeight: 600, outline: 'none' }}
                  >
                    <option value="">-- No Class Teacher Assigned --</option>
                    {teachers.map(t => {
                      const curClass = getOtherClassAssignedToTeacher(t.id, editingClassTeacher.id)
                      const isOther = Boolean(curClass)
                      return (
                        <option key={t.id} value={t.id} disabled={isOther}>
                          {t.full_name}{isOther ? ` (Already Class Teacher for ${curClass})` : ''}
                        </option>
                      )
                    })}
                  </select>
                </div>

                {/* Select Periods */}
                <div>
                  <label style={styles.modalLabel}>First Periods Assigned Every Day</label>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      type="button"
                      onClick={() => setCtPeriods(1)}
                      style={{ flex: 1, padding: '10px', borderRadius: '10px', border: `2px solid ${ctPeriods === 1 ? H.purple : H.border}`, background: ctPeriods === 1 ? `${H.purple}15` : H.bg, color: ctPeriods === 1 ? H.purple : H.textPrimary, fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
                    >
                      First 1 Period (P1)
                    </button>
                    <button
                      type="button"
                      onClick={() => setCtPeriods(2)}
                      style={{ flex: 1, padding: '10px', borderRadius: '10px', border: `2px solid ${ctPeriods === 2 ? H.purple : H.border}`, background: ctPeriods === 2 ? `${H.purple}15` : H.bg, color: ctPeriods === 2 ? H.purple : H.textPrimary, fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
                    >
                      First 2 Periods (P1-P2)
                    </button>
                  </div>
                </div>

                {/* Select Subject */}
                <div>
                  <label style={styles.modalLabel}>Class Teacher Subject</label>
                  {(() => {
                    const selTeacherObj = teachers.find(t => t.id === ctTeacherId)
                    const teacherSubjects = selTeacherObj?.subjects?.length ? selTeacherObj.subjects : ['English', 'Mathematics', 'Science', 'History', 'Geography', 'ICT', 'Buddhism', 'Tamil', 'Health', 'Art', 'Music', 'Physical Education']
                    return (
                      <select
                        value={ctSubject}
                        onChange={e => setCtSubject(e.target.value)}
                        style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: `1px solid ${H.border}`, background: H.bg, color: H.textPrimary, fontSize: '13px', fontWeight: 600, outline: 'none' }}
                      >
                        <option value="">-- Select Subject --</option>
                        {teacherSubjects.map((s: string) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    )
                  })()}
                </div>

                <div style={styles.modalButtons}>
                  <button type="button" onClick={() => setEditingClassTeacher(null)} style={styles.cancelButton}>
                    Cancel
                  </button>
                  <button type="submit" disabled={savingCT} style={{ ...styles.createGradeButton, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                    {savingCT ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={14} />} Save Settings
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    
      <ConfirmModal
        open={!!modal}
        {...(modal ?? { title: '', message: '', onConfirm: () => {} })}
        onCancel={() => setModal(null)}
      />

      </div>
      <style>{STYLE}</style>
    </div>
  )
}
