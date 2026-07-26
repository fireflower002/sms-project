'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, GraduationCap, Plus, Trash2, Loader2, Pencil, Check, X, Search, Download } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { H, STYLE } from '@/lib/honey'
import { createStyles } from '@/lib/styles'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { TableSkeleton } from '@/components/ui/Skeleton'
import EmptyState from '@/components/ui/EmptyState'
import ConfirmModal, { ConfirmModalState } from '@/components/ui/ConfirmModal'
import { exportToCSV } from '@/lib/csvExport'
import { useToast } from '@/components/ui/Toast'

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const ALL_GRADES = Array.from({ length: 13 }, (_, i) => i + 1)

interface ClassRow { id: string; name: string; grade_level: number; slug: string }

export default function ClassesPage() {
  const supabase = createClient()
  const [classes, setClasses]     = useState<ClassRow[]>([])
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState<number | null>(null) // which grade is saving
  const [toast, setToast]         = useState<{ msg: string; ok: boolean } | null>(null)
  const [showAddGrade, setShowAddGrade] = useState(false)
  const [newGradeLevel, setNewGradeLevel] = useState(6)
  const [newGradeCount, setNewGradeCount] = useState(3)
  const [search, setSearch] = useState('')
  const { showToast } = useToast()

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
        { label: 'Slug', key: 'slug' },
      ],
      filteredClasses
    )
    if (ok) {
      showToast(`Exported ${filteredClasses.length} class records to CSV`, 'success')
    } else {
      showToast('No class records available to export', 'warning')
    }
  }

  const fetchClasses = async () => {
    const { data, error } = await supabase
      .from('classes')
      .select('id, name, grade_level, slug')
      .eq('is_active', true)
      .order('grade_level')
      .order('name')
    if (error) flash(error.message, false)
    else setClasses(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchClasses() }, [])

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
    setSaving(-1)
    for (let i = 0; i < newGradeCount; i++) {
      const suffix = LETTERS[i]
      await supabase.from('classes').upsert(
        { name: `Grade ${newGradeLevel} ${suffix}`, grade_level: newGradeLevel, slug: `grade-${newGradeLevel}-${suffix.toLowerCase()}`, is_active: true },
        { onConflict: 'slug' }
      )
    }
    setShowAddGrade(false)
    flash(`Grade ${newGradeLevel} added with ${newGradeCount} class${newGradeCount !== 1 ? 'es' : ''}`)
    await fetchClasses()
    setSaving(null)
  }

  // ── Add one more class to a grade ──
  const handlePlusClass = async (grade: number) => {
    const existing = byGrade[grade] || []
    if (existing.length >= 26) return
    setSaving(grade)
    const suffix = LETTERS[existing.length]
    const { error } = await supabase.from('classes').upsert(
      { name: `Grade ${grade} ${suffix}`, grade_level: grade, slug: `grade-${grade}-${suffix.toLowerCase()}`, is_active: true },
      { onConflict: 'slug' }
    )
    if (error) flash(error.message, false)
    else flash(`Grade ${grade} ${suffix} added`)
    await fetchClasses()
    setSaving(null)
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
        if (error) flash(error.message, false)
        else flash(`${last.name} removed`)
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
        await supabase.from('classes').update({ is_active: false }).in('id', cls.map(c => c.id))
        flash(`Grade ${grade} deleted`)
        await fetchClasses()
        setSaving(null)
      }
    });
  }

  // ── Rename class ──
  const handleRename = async (id: string) => {
    const name = renameVal.trim()
    if (!name) return
    const { error } = await supabase.from('classes').update({ name }).eq('id', id)
    if (error) flash(error.message, false)
    else { flash('Renamed'); setRenamingId(null) }
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
            <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: H.purpleLight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <GraduationCap size={20} style={{ color: H.purpleDark }} />
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
              <button onClick={() => { setNewGradeLevel(unusedGrades[0]); setNewGradeCount(3); setShowAddGrade(true) }}
                style={{ ...styles.addGradeButton, borderRadius: '10px', minHeight: '38px', fontSize: '13px', fontWeight: 600 }}>
                <Plus size={14} /> Add Grade
              </button>
            )}
          </div>
        </header>

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
                            <span style={styles.classDisplayName}>
                              {cls.name}
                            </span>
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
              {/* Grade selector */}
              <div>
                <label style={styles.modalLabel}>
                  Grade Level
                </label>
                <div style={styles.gradeSelector}>
                  {unusedGrades.map(g => (
                    <button key={g} onClick={() => setNewGradeLevel(g)}
                      style={{
                        ...styles.gradeSelectorButton,
                        borderColor: newGradeLevel === g ? gradeColor(g) : H.border,
                        background: newGradeLevel === g ? `${gradeColor(g)}20` : '#F5F5F4',
                        color: newGradeLevel === g ? gradeColor(g) : H.text,
                      }}>
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              {/* Class count */}
              <div>
                <label style={styles.modalLabel}>
                  Number of Classes
                </label>
                <div style={styles.gradeCountControls}>
                  <button onClick={() => setNewGradeCount(c => Math.max(1, c - 1))}
                    style={{...styles.gradeCountButton, ...styles.minusCountButton}}>
                    −
                  </button>
                  <div style={styles.gradeCountDisplay}>
                    <div style={{...styles.gradeCountNumber, color: gradeColor(newGradeLevel)}}>
                      {newGradeCount}
                    </div>
                    <div style={styles.gradeCountLabel}>classes</div>
                  </div>
                  <button onClick={() => setNewGradeCount(c => Math.min(10, c + 1))}
                    style={{...styles.gradeCountButton, ...styles.plusCountButton}}>
                    +
                  </button>
                </div>

                {/* Preview pills */}
                <div style={styles.previewPills}>
                  {Array.from({ length: newGradeCount }, (_, i) => (
                    <div key={i} style={{...styles.previewPill, borderColor: `${gradeColor(newGradeLevel)}55`}}>
                      <div style={{...styles.previewLetterBadge, background: gradeColor(newGradeLevel)}}>
                        {LETTERS[i]}
                      </div>
                      <span style={styles.previewClassName}>
                        Grade {newGradeLevel} {LETTERS[i]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Buttons */}
              <div style={styles.modalButtons}>
                <button onClick={() => setShowAddGrade(false)} style={styles.cancelButton}>
                  Cancel
                </button>
                <button onClick={handleAddGrade} disabled={saving === -1} style={{...styles.createGradeButton, opacity: saving === -1 ? 0.5 : 1}}>
                  {saving === -1
                    ? <Loader2 size={15} style={{ animation:'spin 0.7s linear infinite' }} />
                    : <><Plus size={14} /> Create Grade {newGradeLevel}</>
                  }
                </button>
              </div>
            </div>
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
