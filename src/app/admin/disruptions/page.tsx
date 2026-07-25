'use client'
import { useEffect, useState, useCallback, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
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
  RotateCcw
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatSLT, todaySLT } from '@/lib/utils'
import { H } from '@/lib/honey'

import StatCard from '@/components/ui/StatCard'
import Badge from '@/components/ui/Badge'
import EmptyState from '@/components/ui/EmptyState'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { SkeletonBlock, TableSkeleton } from '@/components/ui/Skeleton'
import ConfirmModal, { ConfirmModalState } from '@/components/ui/ConfirmModal'

const styles: { [key: string]: React.CSSProperties } = {
  page: { backgroundColor: H.bg, minHeight: '100vh', padding: 'clamp(16px, 3vw, 28px)', fontFamily: H.font, boxSizing: 'border-box' },
  shell: { backgroundColor: H.surface, border: `1px solid ${H.border}`, borderRadius: '16px', boxShadow: H.cardShadow, overflow: 'hidden' },
  headerBar: { padding: '20px 24px', borderBottom: `1px solid ${H.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', backgroundColor: H.surface },
  pageTitle: { fontSize: '22px', fontWeight: 600, letterSpacing: '-0.02em', color: H.textPrimary, margin: 0 },
  pageSubtitle: { fontSize: '13px', fontWeight: 400, color: H.textSec, margin: '4px 0 0 0' },
  actionsWrapper: { display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' },
  button: { border: 'none', borderRadius: '10px', fontWeight: 600, fontSize: '13px', minHeight: '38px', padding: '8px 16px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'background-color 0.15s ease', textDecoration: 'none', boxSizing: 'border-box' },
  buttonPrimary: { background: H.purple, color: '#FFFFFF' },
  buttonSecondary: { background: '#F5F5F4', color: H.textSec, border: `1px solid ${H.border}` },
  buttonSuccess: { background: H.successGreen, color: '#FFFFFF' },
  buttonDanger: { background: H.dangerLight, color: H.danger },
  
  // Contiguous Tab Bar
  tabContainer: { display: 'flex', gap: '8px', padding: '0 24px', borderBottom: `1px solid ${H.border}`, backgroundColor: '#FAF9F6' },
  tabButton: { padding: '12px 16px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.15s ease' },
  
  // Contiguous Stat Strip
  statStrip: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', borderBottom: `1px solid ${H.border}`, backgroundColor: H.surface },
  statCell: { padding: '16px 24px', display: 'flex', alignItems: 'center', gap: '16px', borderRight: `1px solid ${H.border}` },
  statValue: { fontSize: '24px', fontWeight: 700, color: H.textPrimary, fontVariantNumeric: 'tabular-nums', fontFeatureSettings: '"tnum"', lineHeight: 1 },
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
  peer_accepted: { label: 'Needs Approval', variant: 'custom', bg: H.softPinkLight, color: H.softPinkDark },
  accepted: { label: 'Approved', variant: 'active' },
  rejected: { label: 'Rejected', variant: 'danger' },
  pending: { label: 'Awaiting Peer', variant: 'inactive' },
  cancelled: { label: 'Cancelled', variant: 'inactive' },
}

function DisruptionsContent() {
  const searchParams = useSearchParams()
  const initialTab = searchParams.get('tab') === 'swaps' ? 'swaps' : 'absences'
  const [activeTab, setActiveTab] = useState<'absences' | 'swaps'>(initialTab)
  
  const supabase = createClient()
  const today = todaySLT()

  // Absences state
  const [absences, setAbsences] = useState<any[]>([])
  const [absencesLoading, setAbsencesLoading] = useState(true)
  const [absenceSearch, setAbsenceSearch] = useState('')
  const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'all'>('today')
  const [isSearchFocused, setIsSearchFocused] = useState(false)

  // Swaps state
  const [swaps, setSwaps] = useState<any[]>([])
  const [swapsLoading, setSwapsLoading] = useState(true)
  const [swapProcessing, setSwapProcessing] = useState<string | null>(null)
  const [swapFilter, setSwapFilter] = useState<'peer_accepted' | 'all'>('peer_accepted')
  const [swapStats, setSwapStats] = useState({ pending: 0, approved: 0, rejected: 0 })

  // Modal state
  const [modal, setModal] = useState<ConfirmModalState | null>(null)

  // ── Fetch Absences ──
  const fetchAbsences = useCallback(async () => {
    setAbsencesLoading(true)
    let query = supabase.from('absences')
      .select('*, teacher:profiles!teacher_id(id,full_name,subjects), substitutions(id,substitute_teacher_id,period_number)')
      .order('absence_date', { ascending: false })

    if (dateFilter === 'today') {
      query = query.eq('absence_date', today)
    } else if (dateFilter === 'week') {
      const d = new Date()
      d.setDate(d.getDate() - 7)
      query = query.gte('absence_date', d.toISOString().split('T')[0])
    } else {
      query = query.limit(200)
    }

    const { data } = await query
    setAbsences(data || [])
    setAbsencesLoading(false)
  }, [dateFilter, today, supabase])

  // ── Fetch Swaps ──
  const fetchSwaps = useCallback(async () => {
    setSwapsLoading(true)
    let query = supabase.from('swap_requests')
      .select('*, requester:profiles!requester_id(id,full_name), target:profiles!target_teacher_id(id,full_name), requester_class:classes!requester_class_id(name), target_class:classes!target_class_id(name)')
      .order('created_at', { ascending: false })

    if (swapFilter === 'peer_accepted') query = query.eq('status', 'peer_accepted')

    const { data } = await query
    setSwaps(data || [])

    const [{ count: p }, { count: a }, { count: r }] = await Promise.all([
      supabase.from('swap_requests').select('id', { count: 'exact', head: true }).eq('status', 'peer_accepted'),
      supabase.from('swap_requests').select('id', { count: 'exact', head: true }).eq('status', 'accepted'),
      supabase.from('swap_requests').select('id', { count: 'exact', head: true }).eq('status', 'rejected'),
    ])
    setSwapStats({ pending: p || 0, approved: a || 0, rejected: r || 0 })
    setSwapsLoading(false)
  }, [swapFilter, supabase])

  useEffect(() => {
    fetchAbsences()
  }, [fetchAbsences])

  useEffect(() => {
    fetchSwaps()
  }, [fetchSwaps])

  // ── Handle Swap Approval / Rejection with Notification Fix ──
  const handleSwapDecision = async (swap: any, approve: boolean) => {
    const actionId = approve ? swap.id : `${swap.id}_r`
    setSwapProcessing(actionId)

    const { data: { session } } = await supabase.auth.getSession()
    const adminId = session?.user?.id

    try {
      if (approve) {
        await supabase.rpc('execute_schedule_swap', { p_swap_id: swap.id })
      } else {
        await supabase.from('swap_requests')
          .update({ status: 'rejected', responded_at: new Date().toISOString() })
          .eq('id', swap.id)
      }

      // 🔔 SEND PRIVATE NOTIFICATION TO TEACHERS (Decision #2 Fix)
      const notifBody = `Your swap request for ${swap.swap_date ? formatSLT(swap.swap_date, 'dd MMM yyyy') : 'the requested date'} (Period ${swap.requester_period} with ${swap.target?.full_name || 'teacher'}) has been ${approve ? 'approved' : 'rejected'} by the administration.`
      
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
      if (swap.target_teacher_id) {
        notifRows.push({
          user_id: swap.target_teacher_id,
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
    } catch (err: any) {
      console.error('[handleSwapDecision] Error processing swap decision:', err)
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
      fetchAbsences()
    } catch (err: any) {
      console.error('[handleUndoAbsence] Error deleting absence:', err)
      alert(err.message || 'Failed to undo absence record.')
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
  const filteredAbsences = absences.filter(a => !absenceSearch || a.teacher?.full_name?.toLowerCase().includes(absenceSearch.toLowerCase()))
  const todayAbsences = absences.filter(a => a.absence_date === today)
  const todayCount = todayAbsences.length
  const coveredCount = todayAbsences.filter(a => a.substitutions?.length > 0).length
  const needsCover = todayCount - coveredCount

  return (
    <div style={styles.page}>
      <div style={styles.shell}>
        {/* Contiguous Header Bar */}
        <div style={styles.headerBar}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: H.purpleLight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AlertTriangle size={20} style={{ color: H.purpleDark }} />
            </div>
            <div>
              <h1 style={styles.pageTitle}>Disruptions & Coverage</h1>
              <p style={styles.pageSubtitle}>
                Manage teacher absences, cover duty assignments, and class swap requests.
              </p>
            </div>
          </div>
          <div style={styles.actionsWrapper}>
            <button
              onClick={activeTab === 'absences' ? fetchAbsences : fetchSwaps}
              style={{ ...styles.button, ...styles.buttonSecondary }}
              title="Refresh"
            >
              <RefreshCw size={14} style={(activeTab === 'absences' ? absencesLoading : swapsLoading) ? { animation: 'spin 1s linear infinite' } : {}} />
              <span>Refresh</span>
            </button>
            {activeTab === 'absences' && (
              <Link href="/admin/absences/new" style={{ ...styles.button, ...styles.buttonPrimary }}>
                <Plus size={14} /> Mark Absent
              </Link>
            )}
          </div>
        </div>

        {/* Contiguous Tabs */}
        <div style={styles.tabContainer}>
          <button
            onClick={() => setActiveTab('absences')}
            style={{
              ...styles.tabButton,
              color: activeTab === 'absences' ? H.purple : H.textSec,
              borderBottom: activeTab === 'absences' ? `3px solid ${H.purple}` : '3px solid transparent',
            }}
          >
            <ClipboardList size={16} />
            <span>Absences & Cover</span>
            {todayCount > 0 && <Badge variant="pending">{todayCount} Today</Badge>}
          </button>
          <button
            onClick={() => setActiveTab('swaps')}
            style={{
              ...styles.tabButton,
              color: activeTab === 'swaps' ? H.softPink : H.textSec,
              borderBottom: activeTab === 'swaps' ? `3px solid ${H.softPink}` : '3px solid transparent',
            }}
          >
            <ArrowRightLeft size={16} />
            <span>Cover Swap Requests</span>
            {swapStats.pending > 0 && <Badge variant="custom" bg={H.softPinkLight} color={H.softPinkDark}>{swapStats.pending} Pending</Badge>}
          </button>
        </div>

        {/* ── ABSENCES TAB CONTENT ── */}
        {activeTab === 'absences' && (
          <>
            {/* Contiguous Metric Strip */}
            <div style={styles.statStrip}>
              <div style={styles.statCell}>
                <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: H.accentLight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <AlertTriangle size={18} style={{ color: H.accentDark }} />
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
                <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: needsCover > 0 ? '#FFF7ED' : H.successLight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <AlertTriangle size={18} style={{ color: needsCover > 0 ? '#C2410C' : H.successGreen }} />
                </div>
                <div>
                  <div style={styles.statValue}>{needsCover}</div>
                  <div style={styles.statLabel}>Needs Cover</div>
                </div>
              </div>
            </div>

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
                      {['Teacher', 'Date', 'Type', 'Reason', 'Cover Status', 'Actions'].map(h => (
                        <th key={h} style={styles.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAbsences.map(a => {
                      const subCount = a.substitutions?.length || 0
                      const unassigned = subCount === 0
                      const typeConfig = ABSENCE_TYPE_VARIANTS[a.absence_type] || { label: a.absence_type, bg: '#F3F4F6', color: '#4B5563' }

                      return (
                        <tr key={a.id}>
                          <td style={{ ...styles.td, color: H.textPrimary, fontWeight: 600 }}>{a.teacher?.full_name || 'N/A'}</td>
                          <td style={styles.td}>{formatSLT(a.absence_date, 'dd MMM yyyy')}</td>
                          <td style={styles.td}>
                            <Badge variant="custom" bg={typeConfig.bg} color={typeConfig.color}>
                              {typeConfig.label}
                            </Badge>
                          </td>
                          <td style={{ ...styles.td, fontStyle: 'italic', maxWidth: '220px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {a.reason || '-'}
                          </td>
                          <td style={styles.td}>
                            <Link
                              href={`/admin/absences/${a.id}`}
                              style={{
                                ...styles.button,
                                textDecoration: 'none',
                                minHeight: '32px',
                                padding: '4px 12px',
                                fontSize: '12px',
                                ...(unassigned ? { background: H.skyLight, color: H.skyDark } : { background: H.successLight, color: '#065F46' })
                              }}
                            >
                              {unassigned ? 'Assign Cover' : 'View Cover'}
                            </Link>
                          </td>
                          <td style={styles.td}>
                            <button
                              onClick={() => triggerUndoAbsence(a)}
                              style={{
                                ...styles.button,
                                ...styles.buttonDanger,
                                minHeight: '32px',
                                padding: '4px 10px',
                                fontSize: '12px',
                                cursor: 'pointer',
                              }}
                              title="Undo & cancel this absence record"
                            >
                              <RotateCcw size={13} />
                              <span>Undo</span>
                            </button>
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
