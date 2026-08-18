'use client'
import { useEffect, useState, useCallback, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  RefreshCw,
  Search,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  XCircle,
  ArrowRightLeft,
  ClipboardList,
  Plus,
  RotateCcw,
  Download,
  Loader2,
  Settings,
  Zap
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatSLT, todaySLT } from '@/lib/utils'
import { H } from '@/lib/honey'
import { SchoolSettings, DEFAULT_SCHOOL_SETTINGS } from '@/lib/calendarService'

import StatCard from '@/components/ui/StatCard'
import Badge from '@/components/ui/Badge'
import EmptyState from '@/components/ui/EmptyState'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { SkeletonBlock, TableSkeleton } from '@/components/ui/Skeleton'
import ConfirmModal, { ConfirmModalState } from '@/components/ui/ConfirmModal'
import { exportToCSV } from '@/lib/csvExport'
import { useToast } from '@/components/ui/Toast'
import DirectCoverDrawer from '@/components/admin/DirectCoverDrawer'

const styles: { [key: string]: React.CSSProperties } = {
  page: { backgroundColor: H.bg, minHeight: '100vh', padding: 'clamp(16px, 3vw, 28px)', fontFamily: H.font, boxSizing: 'border-box' },
  shell: { backgroundColor: H.surface, border: `1px solid ${H.border}`, borderRadius: '16px', boxShadow: H.cardShadow, overflow: 'hidden' },
  headerBar: { padding: '20px 24px', borderBottom: `1px solid ${H.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', backgroundColor: H.surface },
  pageTitle: { fontSize: '22px', fontWeight: 600, letterSpacing: '-0.02em', color: H.textPrimary, margin: 0 },
  pageSubtitle: { fontSize: '13px', fontWeight: 400, color: H.textSec, margin: '4px 0 0 0' },
  actionsWrapper: { display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' },
  button: { border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '13px', minHeight: '36px', padding: '7px 14px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.15s ease', textDecoration: 'none', boxSizing: 'border-box' },
  buttonPrimary: { background: '#18181B', color: '#FFFFFF' },
  buttonSecondary: { background: '#F4F4F5', color: H.textSec, border: `1px solid ${H.border}` },
  buttonSuccess: { background: '#14532D', color: '#FFFFFF' },
  buttonDanger: { background: '#7F1D1D', color: '#FFFFFF' },
  
  // Contiguous Tab Bar
  tabContainer: { display: 'flex', gap: '8px', padding: '0 24px', borderBottom: `1px solid ${H.border}`, backgroundColor: '#FAFAFA' },
  tabButton: { padding: '12px 16px', fontSize: '13.5px', fontWeight: 600, cursor: 'pointer', background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.15s ease' },
  
  // Contiguous Stat Strip
  statStrip: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', borderBottom: `1px solid ${H.border}`, backgroundColor: H.surface },
  statCell: { padding: '16px 24px', display: 'flex', alignItems: 'center', gap: '16px', borderRight: `1px solid ${H.border}` },
  statValue: { fontSize: '24px', fontWeight: 600, color: H.textPrimary, fontVariantNumeric: 'tabular-nums', fontFeatureSettings: '"tnum"', lineHeight: 1 },
  statLabel: { fontSize: '11px', fontWeight: 600, color: H.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '4px' },
  
  // Integrated Toolbar & Table
  toolbar: { padding: '16px 24px', display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', borderBottom: `1px solid ${H.border}`, backgroundColor: H.surface },
  tableWrapper: { overflowX: 'auto', WebkitOverflowScrolling: 'touch' },
  table: { width: '100%', minWidth: '600px', borderCollapse: 'collapse' },
  th: { fontSize: '11px', fontWeight: 600, color: H.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '12px 20px', textAlign: 'left', borderBottom: `1px solid ${H.border}`, whiteSpace: 'nowrap' },
  td: { padding: '14px 20px', fontSize: '13px', color: H.textSec, borderBottom: `1px solid ${H.border}`, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', fontFeatureSettings: '"tnum"' },
}

const ABSENCE_TYPE_VARIANTS: Record<string, { label: string; bg: string; color: string }> = {
  full_day: { label: 'Full Day', bg: '#FEF2F2', color: '#DC2626' },
  morning_block: { label: 'Morning', bg: '#FEF9C3', color: '#713F12' },
  afternoon_block: { label: 'Afternoon', bg: '#FFF7ED', color: '#9A3412' },
  custom_periods: { label: 'Custom', bg: '#F5F3FF', color: '#5B21B6' },
}

const SWAP_STATUS_VARIANTS: Record<string, { label: string; variant: 'pending' | 'active' | 'danger' | 'inactive' | 'custom'; bg?: string; color?: string }> = {
  peer_accepted: { label: 'Pending Admin Approval', variant: 'custom', bg: '#E0F2FE', color: '#0369A1' },
  accepted: { label: 'Swap Finalized', variant: 'active' },
  rejected: { label: 'Rejected', variant: 'danger' },
  pending: { label: 'Waiting for Teacher Response', variant: 'inactive' },
  cancelled: { label: 'Cancelled', variant: 'inactive' },
}

function DisruptionsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialTab = searchParams.get('tab') === 'swaps' ? 'swaps' : 'absences'
  const [activeTab, setActiveTab] = useState<'absences' | 'swaps'>(initialTab)
  
  const supabase = createClient()
  const today = todaySLT()
  const { showToast } = useToast()

  // Settings state
  const [settings, setSettings] = useState<SchoolSettings>(DEFAULT_SCHOOL_SETTINGS)
  const [settingsForm, setSettingsForm] = useState<SchoolSettings>(DEFAULT_SCHOOL_SETTINGS)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)

  // Absences state
  const [absences, setAbsences] = useState<any[]>([])
  const [absencesLoading, setAbsencesLoading] = useState(true)
  const [absenceSearch, setAbsenceSearch] = useState('')
  const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')
  const [processingAbsence, setProcessingAbsence] = useState<string | null>(null)
  const [isSearchFocused, setIsSearchFocused] = useState(false)

  // Swaps state
  const [swaps, setSwaps] = useState<any[]>([])
  const [swapsLoading, setSwapsLoading] = useState(true)
  const [swapProcessing, setSwapProcessing] = useState<string | null>(null)
  const [swapFilter, setSwapFilter] = useState<'peer_accepted' | 'all'>('peer_accepted')
  const [swapStats, setSwapStats] = useState({ pending: 0, approved: 0, rejected: 0 })

  // Modal state
  const [modal, setModal] = useState<ConfirmModalState | null>(null)

  // Direct Cover Drawer state
  const [directCoverOpen, setDirectCoverOpen] = useState(false)
  const [directCoverAbsenceId, setDirectCoverAbsenceId] = useState<string | null>(null)
  const [directCoverTeacherId, setDirectCoverTeacherId] = useState<string | null>(null)
  const [directCoverDate, setDirectCoverDate] = useState<string | null>(null)

  const handleOpenDirectCover = (absenceId?: string | null, teacherId?: string | null, dateStr?: string | null) => {
    setDirectCoverAbsenceId(absenceId || null)
    setDirectCoverTeacherId(teacherId || null)
    setDirectCoverDate(dateStr || today)
    setDirectCoverOpen(true)
  }

  const handleExportAbsences = () => {
    const filtered = absences.filter(a => !absenceSearch || a.teacher?.full_name?.toLowerCase().includes(absenceSearch.toLowerCase()))
    const ok = exportToCSV(
      'absence_records',
      [
        { label: 'Teacher Name', key: 'teacher_name' },
        { label: 'Date', key: 'absence_date' },
        { label: 'Type', key: 'absence_type' },
        { label: 'Status', key: 'status' },
        { label: 'Reason', key: 'reason' },
        { label: 'Coverage', key: 'cover_status' },
      ],
      filtered.map(a => ({
        teacher_name: a.teacher?.full_name || 'N/A',
        absence_date: a.absence_date,
        absence_type: ABSENCE_TYPE_VARIANTS[a.absence_type]?.label || a.absence_type,
        status: a.status || 'pending',
        reason: a.reason || 'None provided',
        cover_status: a.substitutions?.length > 0 ? 'Covered' : 'Uncovered',
      }))
    )
    if (ok) {
      showToast(`Exported ${filtered.length} absence records to CSV`, 'success')
    } else {
      showToast('No absence records available to export', 'warning')
    }
  }

  // ── Fetch Absences ──
  const fetchAbsences = useCallback(async () => {
    setAbsencesLoading(true)
    let query = supabase.from('absences')
      .select('*, teacher:profiles!teacher_id(id,full_name,subjects), substitutions(*, substitute:profiles!substitute_teacher_id(full_name))')
      .not('template_id', 'is', null)
      .order('absence_date', { ascending: false })

    if (dateFilter === 'today') {
      query = query.eq('absence_date', today)
    } else if (dateFilter === 'week') {
      const d = new Date()
      d.setDate(d.getDate() - 7)
      query = query.gte('absence_date', d.toISOString().split('T')[0])
    }

    let { data, error } = await query
    if (error) {
      // Fallback query if nested substitutions relation fails
      const fallbackQuery = await supabase.from('absences')
        .select('*, teacher:profiles!teacher_id(id,full_name,subjects), substitutions(*)')
        .not('template_id', 'is', null)
        .order('absence_date', { ascending: false })
      data = fallbackQuery.data
    }
    setAbsences(data || [])
    setAbsencesLoading(false)
  }, [supabase, dateFilter, today])

  const handleApproveAbsence = async (absence: any) => {
    setProcessingAbsence(absence.id)
    const { error } = await supabase.from('absences').update({ status: 'approved' }).eq('id', absence.id)
    if (error) {
      console.error('Failed to approve absence:', error.message)
      showToast('Could not approve cover request. Please verify cover teacher availability.', 'error')
    } else {
      showToast(`Absence approved! Assigning cover...`, 'success')
      fetchAbsences()
      handleOpenDirectCover(absence.id, absence.teacher_id, absence.absence_date)
    }
    setProcessingAbsence(null)
  }

  const handleRejectAbsence = async (absence: any) => {
    setModal({
      title: 'Reject Absence Request?',
      message: `Are you sure you want to reject ${absence.teacher?.full_name || 'this teacher'}'s absence request for ${absence.absence_date}?`,
      variant: 'danger',
      confirmLabel: 'Reject Request',
      onConfirm: async () => {
        setModal(null)
        setProcessingAbsence(absence.id)
        const { error } = await supabase.from('absences').update({ status: 'rejected' }).eq('id', absence.id)
        if (error) {
          console.error('Failed to reject absence:', error.message)
          showToast('Could not decline cover request. Please try again.', 'error')
        } else {
          showToast(`Absence request rejected.`, 'info')
          fetchAbsences()
        }
        setProcessingAbsence(null)
      }
    })
  }

  // ── Fetch Swaps ──
  const fetchSwaps = useCallback(async () => {
    setSwapsLoading(true)
    const { data } = await supabase.from('swap_requests')
      .select('*, requester:profiles!requester_id(full_name), target:profiles!target_teacher_id(full_name), requester_class:classes!requester_class_id(name), target_class:classes!target_class_id(name)')
      .order('created_at', { ascending: false })

    const list = data || []
    setSwaps(list)

    const pending = list.filter(s => s.status === 'peer_accepted').length
    const approved = list.filter(s => s.status === 'accepted').length
    const rejected = list.filter(s => s.status === 'rejected').length
    setSwapStats({ pending, approved, rejected })
    setSwapsLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchAbsences()
    fetchSwaps()
  }, [fetchAbsences, fetchSwaps])

  // Fetch school settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      const { data } = await supabase.from('school_settings').select('*').eq('school_id', 'default').maybeSingle()
      if (data) {
        setSettings(data)
        setSettingsForm(data)
      }
    }
    loadSettings()
  }, [supabase])

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingSettings(true)
    try {
      const res = await fetch('/api/admin/calendar/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          absence_buffer_hours: settingsForm.absence_buffer_hours,
          working_days: settingsForm.working_days,
          allow_emergency_absence: settingsForm.allow_emergency_absence,
          auto_sync_holidays: settingsForm.auto_sync_holidays,
        }),
      })

      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed saving school settings')
      }

      showToast('Absence settings updated successfully', 'success')
      setSettings(json.settings)
      setSettingsForm(json.settings)
      setShowSettingsModal(false)
    } catch (err: any) {
      showToast(err.message || 'Error updating settings', 'error')
    } finally {
      setSavingSettings(false)
    }
  }

  // Handle Swap Decision (Approve/Reject)
  const handleSwapDecision = async (swap: any, approve: boolean) => {
    setSwapProcessing(swap.id)
    try {
      const newStatus = approve ? 'accepted' : 'rejected'
      await supabase.from('swap_requests').update({ status: newStatus }).eq('id', swap.id)
      
      const notifBody = `Your swap request for ${swap.swap_date ? formatSLT(swap.swap_date, 'dd MMM yyyy') : 'the requested date'} has been ${approve ? 'approved' : 'rejected'} by the administration.`
      
      const notifRows = []
      if (swap.requester_id) {
        notifRows.push({
          user_id: swap.requester_id,
          type: 'swap_decision',
          title: `Class Swap ${approve ? 'Approved' : 'Rejected'}`,
          body: notifBody,
          link: '/teacher',
          is_read: false
        })
      }
      if (notifRows.length > 0) {
        await supabase.from('notifications').insert(notifRows)
      }
      showToast(`Class swap ${approve ? 'approved' : 'rejected'} successfully`, approve ? 'success' : 'info')
    } catch (err: any) {
      console.error('Failed to update swap decision:', err)
      showToast(approve ? 'Could not approve class swap. Please try again.' : 'Could not decline class swap. Please try again.', 'error')
    } finally {
      setSwapProcessing(null)
      fetchSwaps()
    }
  }

  // Confirm modal triggers for swap actions
  const triggerSwapApproval = (swap: any, approve: boolean) => {
    const action = approve ? 'Approve' : 'Reject'
    setModal({
      title: `${action} Swap Request?`,
      message: `Are you sure you want to ${action.toLowerCase()} the class swap between ${swap.requester?.full_name} and ${swap.target?.full_name}?`,
      variant: approve ? 'neutral' : 'danger',
      confirmLabel: approve ? 'Approve & Finalize' : 'Reject',
      onConfirm: async () => {
        setModal(null)
        await handleSwapDecision(swap, approve)
      }
    })
  }

  // ── Handle Absence Rollback / Undo (Issue #3 Fix) ──
  const handleUndoAbsence = async (absence: any) => {
    try {
      const res = await fetch('/api/teacher/cancel-absence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ absenceId: absence.id }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to undo absence')
      }
      showToast('Absence record cancelled and cover unassigned', 'info')
      fetchAbsences()
    } catch (err: any) {
      showToast(err.message || 'Failed to undo absence record.', 'error')
    }
  }

  const triggerUndoAbsence = (absence: any) => {
    const teacherName = absence.teacher?.full_name || 'the teacher'
    const dateStr = formatSLT(absence.absence_date, 'dd MMM yyyy')
    setModal({
      title: 'Undo & Cancel Absence?',
      message: `Are you sure you want to cancel the recorded absence for ${teacherName} on ${dateStr}? This will remove the absence record and reassign any cover teacher back to their normal schedule.`,
      variant: 'danger',
      confirmLabel: 'Undo Absence',
      onConfirm: async () => {
        setModal(null)
        await handleUndoAbsence(absence)
      }
    })
  }

  // Absences calculations
  const pendingAbsenceCount = absences.filter(a => {
    const curStatus = a.status || 'pending'
    return curStatus === 'pending' || curStatus === 'late_submission'
  }).length
  const filteredAbsences = absences.filter(a => {
    const matchesSearch = !absenceSearch || a.teacher?.full_name?.toLowerCase().includes(absenceSearch.toLowerCase())
    const curStatus = a.status || 'pending'
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'pending' ? (curStatus === 'pending' || curStatus === 'late_submission') : curStatus === statusFilter)
    return matchesSearch && matchesStatus
  })
  const todayAbsences = absences.filter(a => a.absence_date === today)
  const todayCount = todayAbsences.length
  const coveredCount = todayAbsences.filter(a => a.substitutions?.length > 0).length
  const needsCover = todayCount - coveredCount

  const urgentSwaps = absences.flatMap(a => (a.substitutions || []).map((s: any) => ({ ...s, absence: a })))
    .filter((s: any) => s.status === 'swap_requested')

  return (
    <div style={styles.page}>
      <div style={styles.shell}>
        {/* Contiguous Header Bar */}
        <div style={styles.headerBar}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#F4F4F5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AlertTriangle size={20} style={{ color: '#18181B' }} />
            </div>
            <div>
              <h1 style={styles.pageTitle}>Attendance & Coverage</h1>
              <p style={styles.pageSubtitle}>
                Manage teacher absences, cover duty assignments, and class swap requests.
              </p>
            </div>
          </div>
          <div style={styles.actionsWrapper}>
            <button
              onClick={() => setShowSettingsModal(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 12px',
                borderRadius: '8px',
                border: `1px solid ${H.border}`,
                backgroundColor: H.surface,
                color: H.textSec,
                fontSize: '12.5px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
              title="Absence Cutoff Settings"
            >
              <Settings size={14} style={{ color: H.textMuted }} />
              <span>Cutoff Settings</span>
            </button>
            <button
              onClick={activeTab === 'absences' ? fetchAbsences : fetchSwaps}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                border: `1px solid ${H.border}`,
                backgroundColor: H.surface,
                color: H.textMuted,
                cursor: 'pointer',
              }}
              title="Refresh Data"
              aria-label="Refresh Data"
            >
              <RefreshCw size={14} style={(activeTab === 'absences' ? absencesLoading : swapsLoading) ? { animation: 'spin 1s linear infinite' } : {}} />
            </button>
            {activeTab === 'absences' && (
              <>
                <button
                  onClick={() => handleOpenDirectCover()}
                  style={{
                    ...styles.button,
                    backgroundColor: '#7F1D1D',
                    color: '#FFFFFF',
                    fontWeight: 700
                  }}
                  title="Emergency Direct Cover Override"
                >
                  <Zap size={14} style={{ color: '#FFFFFF' }} /> Direct Cover
                </button>
                <Link href="/admin/absences/new" style={{ ...styles.button, ...styles.buttonPrimary }}>
                  <Plus size={14} /> Mark Absent
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Contiguous Tabs */}
        <div style={styles.tabContainer}>
          <button
            onClick={() => setActiveTab('absences')}
            style={{
              ...styles.tabButton,
              color: activeTab === 'absences' ? '#18181B' : H.textSec,
              borderBottom: activeTab === 'absences' ? '3px solid #18181B' : '3px solid transparent',
            }}
          >
            <ClipboardList size={16} />
            <span>Absences & Cover</span>
            {pendingAbsenceCount > 0 ? (
              <Badge variant="pending">{pendingAbsenceCount} Pending</Badge>
            ) : todayCount > 0 ? (
              <Badge variant="active">{todayCount} Today</Badge>
            ) : null}
          </button>
          <button
            onClick={() => setActiveTab('swaps')}
            style={{
              ...styles.tabButton,
              color: activeTab === 'swaps' ? '#18181B' : H.textSec,
              borderBottom: activeTab === 'swaps' ? '3px solid #18181B' : '3px solid transparent',
            }}
          >
            <ArrowRightLeft size={16} />
            <span>Cover Swap Requests</span>
            {swapStats.pending > 0 && <Badge variant="custom" bg="#F4F4F5" color="#18181B">{swapStats.pending} Pending</Badge>}
          </button>
        </div>

        {/* ── ABSENCES TAB CONTENT ── */}
        {activeTab === 'absences' && (
          <>
            {/* Contiguous Metric Strip */}
            <div style={styles.statStrip}>
              <div style={styles.statCell}>
                <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: H.dangerLight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <AlertTriangle size={18} style={{ color: H.danger }} />
                </div>
                <div>
                  <div style={styles.statValue}>{todayCount}</div>
                  <div style={styles.statLabel}>Absent Today</div>
                </div>
              </div>
              <div style={styles.statCell}>
                <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: H.successLight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CheckCircle2 size={18} style={{ color: H.successGreen }} />
                </div>
                <div>
                  <div style={styles.statValue}>{coveredCount}</div>
                  <div style={styles.statLabel}>Cover Assigned</div>
                </div>
              </div>
              <div style={{ ...styles.statCell, borderRight: 'none' }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#F4F4F5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <AlertCircle size={18} style={{ color: '#18181B' }} />
                </div>
                <div>
                  <div style={styles.statValue}>{pendingAbsenceCount}</div>
                  <div style={styles.statLabel}>Pending Approval</div>
                </div>
              </div>
            </div>

            {/* Urgent Swap Alert Banner */}
            {urgentSwaps.length > 0 && (
              <div style={{ margin: '16px 20px 0', padding: '14px 18px', borderRadius: '12px', background: H.dangerLight, border: '1px solid #FECACA', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <AlertTriangle size={20} style={{ color: H.danger }} />
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '13px', color: H.danger }}>
                      URGENT: {urgentSwaps.length} Cover Swap Request(s) Pending Reassignment
                    </div>
                    <div style={{ fontSize: '12px', color: H.textPrimary, marginTop: '2px' }}>
                      {urgentSwaps.map(s => `${s.substitute?.full_name || 'Cover teacher'} (P${s.period_number} for ${s.absence?.teacher?.full_name || 'absent teacher'})`).join(', ')}
                    </div>
                  </div>
                </div>
                <Link href={`/admin/absences/${urgentSwaps[0]?.absence_id}`} style={{ padding: '6px 14px', borderRadius: '8px', background: '#7F1D1D', color: '#fff', fontSize: '12px', fontWeight: 700, textDecoration: 'none' }}>
                  Reassign Cover Now →
                </Link>
              </div>
            )}

            {/* Integrated Toolbar */}
            <div style={styles.toolbar}>
              <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
                <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: H.textMuted }} />
                <input
                  value={absenceSearch}
                  onChange={e => setAbsenceSearch(e.target.value)}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => setIsSearchFocused(false)}
                  placeholder="Search by teacher name..."
                  style={{
                    width: '100%',
                    padding: '8px 14px 8px 36px',
                    borderRadius: '8px',
                    border: `1px solid ${isSearchFocused ? H.skyBlue : H.border}`,
                    background: H.bg,
                    color: H.textPrimary,
                    fontSize: '13px',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                {/* Status Filter */}
                <div style={{ display: 'flex', border: `1px solid ${H.border}`, borderRadius: '8px', overflow: 'hidden' }}>
                  {(['all', 'pending', 'approved', 'rejected'] as const).map(sf => (
                    <button
                      key={sf}
                      onClick={() => setStatusFilter(sf)}
                      style={{
                        padding: '7px 12px',
                        fontWeight: 600,
                        fontSize: '12px',
                        cursor: 'pointer',
                        border: 'none',
                        borderLeft: sf !== 'all' ? `1px solid ${H.border}` : 'none',
                        background: statusFilter === sf ? H.surface : H.bg,
                        color: statusFilter === sf ? H.purpleDark : H.textSec,
                        textTransform: 'capitalize',
                      }}
                    >
                      {sf === 'pending' ? `Pending (${pendingAbsenceCount})` : sf}
                    </button>
                  ))}
                </div>

                {/* Date Filter */}
                <div style={{ display: 'flex', border: `1px solid ${H.border}`, borderRadius: '8px', overflow: 'hidden' }}>
                  {(['today', 'week', 'all'] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setDateFilter(f)}
                      style={{
                        padding: '7px 14px',
                        fontWeight: 600,
                        fontSize: '12px',
                        cursor: 'pointer',
                        border: 'none',
                        borderLeft: f !== 'today' ? `1px solid ${H.border}` : 'none',
                        background: dateFilter === f ? H.surface : H.bg,
                        color: dateFilter === f ? H.textPrimary : H.textSec,
                        textTransform: 'capitalize',
                      }}
                    >
                      {f}
                    </button>
                  ))}
                </div>
                <button
                  onClick={handleExportAbsences}
                  style={{
                    ...styles.button,
                    ...styles.buttonSecondary,
                    minHeight: '36px',
                    fontSize: '12px',
                    padding: '6px 12px',
                    gap: '6px',
                  }}
                  title="Export CSV"
                >
                  <Download size={14} /> Export CSV
                </button>
              </div>
            </div>

            <div>
            {absencesLoading ? (
              <div style={{ padding: '24px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', borderBottom: `1px solid ${H.border}`, paddingBottom: '12px' }}>
                      <SkeletonBlock width="22%" height="16px" />
                      <SkeletonBlock width="18%" height="16px" />
                      <SkeletonBlock width="15%" height="16px" />
                      <SkeletonBlock width="25%" height="16px" />
                      <SkeletonBlock width="15%" height="22px" borderRadius="12px" />
                    </div>
                  ))}
                </div>
              </div>
            ) : filteredAbsences.length === 0 ? (
              <EmptyState title="No Absences Found" description="There are no absences matching the current filters." />
            ) : (
              <div style={styles.tableWrapper}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      {['Teacher', 'Date', 'Type', 'Status', 'Reason', 'Cover Status', 'Actions'].map(h => (
                        <th key={h} style={styles.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAbsences.map(a => {
                      const subsList = a.substitutions || []
                      const subCount = subsList.length
                      const hasSwapRequest = subsList.some((s: any) => s.status === 'swap_requested')
                      const unassigned = subCount === 0
                      const typeConfig = ABSENCE_TYPE_VARIANTS[a.absence_type] || { label: a.absence_type, bg: '#F3F4F6', color: '#4B5563' }
                      const currentStatus = a.status || 'pending'
                      const isPending = currentStatus === 'pending'
                      const isLateSubmission = currentStatus === 'late_submission'
                      const isRejected = currentStatus === 'rejected'
                      const isApprovedNeedsCover = currentStatus === 'approved' && unassigned

                      return (
                        <tr key={a.id}>
                          <td style={{ ...styles.td, color: H.textPrimary, fontWeight: 600 }}>{a.teacher?.full_name || 'N/A'}</td>
                          <td style={styles.td}>{formatSLT(a.absence_date, 'dd MMM yyyy')}</td>
                          <td style={styles.td}>
                            <Badge variant="custom" bg={typeConfig.bg} color={typeConfig.color}>
                              {typeConfig.label}
                            </Badge>
                          </td>
                          <td style={styles.td}>
                            {isPending ? (
                              <Badge variant="pending">Pending Review</Badge>
                            ) : isLateSubmission ? (
                              <Badge variant="danger" icon={<AlertCircle size={11} />}>Late Submission</Badge>
                            ) : isRejected ? (
                              <Badge variant="danger">Rejected</Badge>
                            ) : isApprovedNeedsCover ? (
                              <Badge variant="pending" icon={<AlertCircle size={11} />}>Approved — Needs Cover</Badge>
                            ) : (
                              <Badge variant="active">Approved</Badge>
                            )}
                          </td>
                          <td style={{ ...styles.td, fontStyle: 'italic', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {a.reason || '-'}
                          </td>
                          <td style={styles.td}>
                            {hasSwapRequest ? (
                              <Link
                                href={`/admin/absences/${a.id}`}
                                style={{
                                  ...styles.button,
                                  textDecoration: 'none',
                                  minHeight: '32px',
                                  padding: '4px 12px',
                                  fontSize: '12px',
                                  background: '#1E3A8A',
                                  color: '#FFFFFF',
                                  fontWeight: 700
                                }}
                              >
                                Reassign Cover
                              </Link>
                            ) : (
                              <button
                                onClick={() => handleOpenDirectCover(a.id, a.teacher_id, a.absence_date)}
                                style={{
                                  ...styles.button,
                                  minHeight: '32px',
                                  padding: '4px 12px',
                                  fontSize: '12px',
                                  cursor: 'pointer',
                                  ...(unassigned ? { background: '#1E3A8A', color: '#FFFFFF' } : { background: '#F4F4F5', color: '#18181B', border: `1px solid ${H.border}` })
                                }}
                              >
                                {unassigned ? 'Assign Cover Now' : 'View Cover'}
                              </button>
                            )}
                          </td>
                          <td style={styles.td}>
                            {(isPending || isLateSubmission) ? (
                              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                <button
                                  onClick={() => handleApproveAbsence(a)}
                                  disabled={processingAbsence === a.id}
                                  style={{
                                    ...styles.button,
                                    ...styles.buttonPrimary,
                                    minHeight: '30px',
                                    padding: '4px 10px',
                                    fontSize: '12px',
                                    cursor: 'pointer',
                                    backgroundColor: '#14532D',
                                  }}
                                  title="Approve Absence"
                                >
                                  {processingAbsence === a.id ? <Loader2 size={12} style={{ animation: 'spin 0.7s linear infinite' }} /> : <CheckCircle2 size={12} />}
                                  <span>Approve</span>
                                </button>
                                <button
                                  onClick={() => handleRejectAbsence(a)}
                                  disabled={processingAbsence === a.id}
                                  style={{
                                    ...styles.button,
                                    ...styles.buttonDanger,
                                    minHeight: '30px',
                                    padding: '4px 10px',
                                    fontSize: '12px',
                                    cursor: 'pointer',
                                  }}
                                  title="Reject Absence"
                                >
                                  <XCircle size={12} />
                                  <span>Reject</span>
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => triggerUndoAbsence(a)}
                                style={{
                                  ...styles.button,
                                  ...styles.buttonDanger,
                                  minHeight: '30px',
                                  padding: '4px 10px',
                                  fontSize: '12px',
                                  cursor: 'pointer',
                                }}
                                title="Undo & cancel this absence record"
                              >
                                <RotateCcw size={13} />
                                <span>Undo</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── SWAPS TAB ── */}
      {activeTab === 'swaps' && (
        <>
          <div style={styles.statCardGrid}>
            <StatCard
              variant="icon"
              value={swapStats.pending}
              label="Needs Approval"
              icon={AlertCircle}
              iconBg={H.softPinkLight}
              iconColor={H.softPinkDark}
            />
            <StatCard
              variant="icon"
              value={swapStats.approved}
              label="Approved"
              icon={CheckCircle2}
              iconBg={H.successLight}
              iconColor="#065F46"
            />
            <StatCard
              variant="icon"
              value={swapStats.rejected}
              label="Rejected"
              icon={XCircle}
              iconBg={H.dangerLight}
              iconColor={H.danger}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
            {(['peer_accepted', 'all'] as const).map(f => (
              <button
                key={f}
                onClick={() => setSwapFilter(f)}
                style={{
                  ...styles.button,
                  background: swapFilter === f ? H.softPinkLight : '#F5F5F4',
                  color: swapFilter === f ? H.softPinkDark : H.textSec,
                  border: `1px solid ${swapFilter === f ? H.softPink : H.border}`,
                }}
              >
                {f === 'peer_accepted' ? 'Needs Approval' : 'All Requests'}
              </button>
            ))}
          </div>

          {swapsLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {[1, 2, 3].map(i => (
                <div key={i} style={{ ...styles.card, padding: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                    <SkeletonBlock width="100px" height="22px" borderRadius="12px" />
                    <SkeletonBlock width="140px" height="14px" />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    <SkeletonBlock width="100%" height="40px" />
                    <SkeletonBlock width="100%" height="40px" />
                  </div>
                </div>
              ))}
            </div>
          ) : swaps.length === 0 ? (
            <div style={styles.card}>
              <EmptyState title="All Clear!" description="There are no swap requests that match the current filter." />
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {swaps.map(swap => {
                const statusConfig = SWAP_STATUS_VARIANTS[swap.status] || SWAP_STATUS_VARIANTS.pending
                const isBusy = swapProcessing === swap.id || swapProcessing === `${swap.id}_r`

                return (
                  <div key={swap.id} style={styles.card}>
                    <div style={{ padding: '16px 20px', borderBottom: `1px solid ${H.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Badge variant={statusConfig.variant} bg={statusConfig.bg} color={statusConfig.color}>
                        {statusConfig.label}
                      </Badge>
                      <span style={{ fontSize: '12px', color: H.textMuted }}>Requested on {formatSLT(swap.created_at, 'dd MMM yyyy')}</span>
                    </div>

                    <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '16px', alignItems: 'center' }}>
                      <div style={{ textAlign: 'center' }}>
                        <p style={{ fontWeight: 700, color: H.textPrimary, margin: 0 }}>{swap.requester?.full_name}</p>
                        <p style={{ fontSize: '13px', color: H.textSec, margin: '4px 0 0' }}>Period {swap.requester_period} ({swap.requester_class?.name})</p>
                      </div>
                      <ArrowRightLeft size={24} style={{ color: H.softPink }} />
                      <div style={{ textAlign: 'center' }}>
                        <p style={{ fontWeight: 700, color: H.textPrimary, margin: 0 }}>{swap.target?.full_name}</p>
                        <p style={{ fontSize: '13px', color: H.textSec, margin: '4px 0 0' }}>Period {swap.target_period} ({swap.target_class?.name})</p>
                      </div>
                    </div>

                    {swap.note && (
                      <div style={{ borderTop: `1px solid ${H.border}`, padding: '16px 20px', fontSize: '13px', fontStyle: 'italic', color: H.textSec }}>
                        "{swap.note}"
                      </div>
                    )}

                    {swap.status === 'peer_accepted' && (
                      <div style={{ borderTop: `1px solid ${H.border}`, padding: '16px 20px', background: H.bg, display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                        <button
                          onClick={() => triggerSwapApproval(swap, false)}
                          disabled={isBusy}
                          style={{ ...styles.button, ...styles.buttonDanger }}
                        >
                          {swapProcessing === `${swap.id}_r` ? <LoadingSpinner size={16} color={H.danger} /> : 'Reject'}
                        </button>
                        <button
                          onClick={() => triggerSwapApproval(swap, true)}
                          disabled={isBusy}
                          style={{ ...styles.button, ...styles.buttonSuccess }}
                        >
                          {swapProcessing === swap.id ? <LoadingSpinner size={16} color="#FFFFFF" /> : 'Approve & Finalize'}
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
      </div>

      {/* ConfirmModal */}
      <ConfirmModal
        open={!!modal}
        {...(modal ?? { title: '', message: '', onConfirm: () => {} })}
        onCancel={() => setModal(null)}
      />

      {/* Absence Settings Modal */}
      {showSettingsModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ width: '100%', maxWidth: '500px', backgroundColor: H.surface, borderRadius: '16px', boxShadow: H.cardShadow, padding: '24px', border: `1px solid ${H.border}` }}>
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: H.textPrimary, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Settings size={20} style={{ color: '#18181B' }} />
              Absence & Cutoff Settings
            </h3>

            <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: H.textMuted, textTransform: 'uppercase', marginBottom: '6px' }}>
                  Absence Submission Buffer (Hours Before Start / After End)
                </label>
                <input
                  type="number"
                  min={0}
                  max={12}
                  value={settingsForm.absence_buffer_hours ?? 2}
                  onChange={e => setSettingsForm(f => ({ ...f, absence_buffer_hours: parseInt(e.target.value) || 0 }))}
                  required
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${H.border}`, fontSize: '14px', boxSizing: 'border-box' }}
                />
                <div style={{ fontSize: '12px', color: H.textSec, marginTop: '4px' }}>
                  Submissions within this buffer before school starts (or after school ends) require emergency approval or default to the next working day.
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input
                  type="checkbox"
                  id="allowEmergencyCheck"
                  checked={settingsForm.allow_emergency_absence}
                  onChange={e => setSettingsForm(f => ({ ...f, allow_emergency_absence: e.target.checked }))}
                />
                <label htmlFor="allowEmergencyCheck" style={{ fontSize: '13px', fontWeight: 600, color: H.textPrimary }}>
                  Allow Teachers to Check "Emergency Absence" After Cutoff
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
                <button
                  type="button"
                  onClick={() => setShowSettingsModal(false)}
                  style={{ padding: '10px 16px', borderRadius: '8px', border: `1px solid ${H.border}`, background: H.surface, color: H.textSec, fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingSettings}
                  style={{ padding: '10px 20px', borderRadius: '8px', background: '#18181B', color: '#FFFFFF', border: 'none', fontWeight: 700, cursor: 'pointer' }}
                >
                  {savingSettings ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Direct Cover Drawer */}
      <DirectCoverDrawer
        isOpen={directCoverOpen}
        onClose={() => setDirectCoverOpen(false)}
        absenceId={directCoverAbsenceId}
        initialTeacherId={directCoverTeacherId}
        initialDate={directCoverDate}
        onSuccess={() => {
          fetchAbsences()
          fetchSwaps()
        }}
      />
    </div>
  )
}

export default function DisruptionsPage() {
  return (
    <Suspense fallback={<TableSkeleton />}>
      <DisruptionsContent />
    </Suspense>
  )
}
