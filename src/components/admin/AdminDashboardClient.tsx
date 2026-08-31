'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Users, BookOpen, Archive, UserX,
  Sun, Moon, Sunset, CheckCircle, CheckCircle2, Clock, AlertCircle, ArrowUpRight, Pencil, Sparkles
} from 'lucide-react'
import { H } from '@/lib/honey'
import Badge from '@/components/ui/Badge'
import { DashboardSkeleton } from '@/components/ui/Skeleton'

const styles: { [key: string]: React.CSSProperties } = {
  page: {
    backgroundColor: H.bg,
    minHeight: '100vh',
    padding: 'clamp(16px, 3vw, 28px)',
    fontFamily: H.font,
    boxSizing: 'border-box',
  },
  shell: {
    backgroundColor: H.surface,
    border: `1px solid ${H.border}`,
    borderRadius: '16px',
    boxShadow: H.cardShadow,
    overflow: 'hidden',
  },
  headerBar: {
    padding: '20px 24px',
    borderBottom: `1px solid ${H.border}`,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '12px',
    backgroundColor: H.surface,
  },
  pageTitle: {
    fontSize: '22px',
    fontWeight: 600,
    letterSpacing: '-0.02em',
    color: H.textPrimary,
    margin: 0,
  },
  pageSubtitle: {
    fontSize: '13px',
    fontWeight: 400,
    color: H.textSec,
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    margin: '4px 0 0 0',
  },
  statusBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    borderRadius: '20px',
    backgroundColor: '#F4F4F5',
    border: `1px solid ${H.border}`,
    fontSize: '12px',
    fontWeight: 500,
    color: H.textSec,
    fontVariantNumeric: 'tabular-nums',
    fontFeatureSettings: '"tnum"',
  },
  metricStrip: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    borderBottom: `1px solid ${H.border}`,
    backgroundColor: H.surface,
  },
  metricCell: {
    padding: '18px 24px',
    textDecoration: 'none',
    color: 'inherit',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    gap: '8px',
    transition: 'background-color 0.15s ease',
    borderRight: `1px solid ${H.border}`,
    boxSizing: 'border-box',
  },
  metricLabel: {
    fontSize: '11px',
    fontWeight: 600,
    color: H.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metricValueRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '8px',
  },
  metricValue: {
    fontSize: '26px',
    fontWeight: 600,
    color: H.textPrimary,
    fontVariantNumeric: 'tabular-nums',
    fontFeatureSettings: '"tnum"',
    lineHeight: 1.1,
  },
  contentGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    backgroundColor: H.surface,
  },
  mainSection: {
    padding: '24px',
    borderRight: `1px solid ${H.border}`,
  },
  sideSection: {
    padding: '24px',
    backgroundColor: '#FAFAFA',
  },
  sectionHeader: {
    fontSize: '15px',
    fontWeight: 600,
    letterSpacing: '-0.01em',
    color: H.textPrimary,
    margin: '0 0 16px 0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tableWrapper: {
    overflowX: 'auto',
    WebkitOverflowScrolling: 'touch',
  },
  table: {
    width: '100%',
    minWidth: '450px',
    borderCollapse: 'collapse',
  },
  th: {
    fontSize: '11px',
    fontWeight: 600,
    color: H.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    padding: `${H.spacing.sm} ${H.spacing.lg}`,
    textAlign: 'left',
    borderBottom: `1px solid ${H.border}`,
  },
  td: {
    padding: `${H.spacing.md} ${H.spacing.lg}`,
    fontSize: '13px',
    color: H.textSec,
    borderBottom: `1px solid ${H.border}`,
    fontVariantNumeric: 'tabular-nums',
    fontFeatureSettings: '"tnum"',
  },
  trHover: {
    backgroundColor: '#F4F4F5',
  },
  actionCard: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '14px 16px',
    borderRadius: '10px',
    backgroundColor: H.surface,
    border: `1px solid ${H.border}`,
    textDecoration: 'none',
    transition: 'border-color 0.15s ease, background-color 0.15s ease',
  },
}

const AbsencesTable = ({ absences }: { absences: any[] }) => {
  const [hoveredRow, setHoveredRow] = useState<string | null>(null)
  
  if (absences.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 24px', color: H.textSec, fontSize: '14px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
        <CheckCircle size={32} style={{ color: H.successGreen }} />
        <span style={{ fontWeight: 600, color: H.textPrimary }}>No active or pending teacher absences.</span>
        <span style={{ fontSize: '13px', color: H.textMuted }}>Everything is running smoothly. No cover required.</span>
      </div>
    )
  }

  return (
    <div style={styles.tableWrapper}>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Teacher</th>
            <th style={styles.th}>Date</th>
            <th style={styles.th}>Status</th>
            <th style={styles.th}>Reason</th>
            <th style={{ ...styles.th, textAlign: 'right' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {absences.map((absence: any) => {
            const currentStatus = absence.status || 'pending'
            const isPending = currentStatus === 'pending' || currentStatus === 'late_submission'
            const isLate = currentStatus === 'late_submission'
            return (
              <tr
                key={absence.id}
                style={{ ...(hoveredRow === absence.id && styles.trHover) }}
                onMouseEnter={() => setHoveredRow(absence.id)}
                onMouseLeave={() => setHoveredRow(null)}
              >
                <td style={{ ...styles.td, color: H.textPrimary, fontWeight: 600 }}>{absence.teacher?.full_name || absence.profiles?.full_name || 'Teacher'}</td>
                <td style={styles.td}>{absence.absence_date || '-'}</td>
                <td style={styles.td}>
                  {isLate ? (
                    <Badge variant="danger">Late Sub.</Badge>
                  ) : isPending ? (
                    <Badge variant="pending">Pending</Badge>
                  ) : (
                    <Badge variant="active">Approved</Badge>
                  )}
                </td>
                <td style={{ ...styles.td, fontStyle: 'italic' }}>{absence.reason || '-'}</td>
                <td style={{ ...styles.td, textAlign: 'right' }}>
                  <Link href="/admin/disruptions?tab=absences" style={{ textDecoration: 'none', fontSize: '12px', color: H.purple, fontWeight: 700 }}>
                    Review →
                  </Link>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

const PendingActions = ({ swaps, requests }: { swaps: number; requests: number }) => (
  <div>
    <h3 style={styles.sectionHeader}>Teacher Requests & Announcements</h3>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <Link href="/admin/announcements" style={{ textDecoration: 'none' }}>
        <div style={styles.actionCard}>
          <div>
            <div style={{ fontWeight: 600, fontSize: '14px', color: H.textPrimary }}>School Announcements</div>
            <p style={{ fontSize: '12px', color: H.textSec, margin: '2px 0 0' }}>Post staff broadcasts & emergency notices</p>
          </div>
          <Badge variant="category">Staff Broadcasts</Badge>
        </div>
      </Link>
      <Link href="/admin/disruptions?tab=swaps" style={{ textDecoration: 'none' }}>
        <div style={styles.actionCard}>
          <div>
            <div style={{ fontWeight: 600, fontSize: '14px', color: H.textPrimary }}>Cover Swap Requests</div>
            <p style={{ fontSize: '12px', color: H.textSec, margin: '2px 0 0' }}>Teachers requesting to swap assigned classes</p>
          </div>
          {swaps > 0 ? (
            <Badge variant="pending" icon={<Clock size={12}/>}>{swaps} Pending</Badge>
          ) : (
            <Badge variant="active">No pending requests</Badge>
          )}
        </div>
      </Link>
      <Link href="/admin/profile-requests" style={{ textDecoration: 'none' }}>
        <div style={styles.actionCard}>
          <div>
            <div style={{ fontWeight: 600, fontSize: '14px', color: H.textPrimary }}>Teacher Account Updates</div>
            <p style={{ fontSize: '12px', color: H.textSec, margin: '2px 0 0' }}>Teachers requesting updates to profile details</p>
          </div>
          {requests > 0 ? (
            <Badge variant="pending" icon={<AlertCircle size={12}/>}>{requests} Pending</Badge>
          ) : (
            <Badge variant="active">No pending requests</Badge>
          )}
        </div>
      </Link>
    </div>
  </div>
)

export default function AdminDashboardClient({ initialData }: { initialData?: any }) {
  const [user, setUser] = useState<any>(initialData?.user || null)
  const [loading, setLoading] = useState(!initialData)
  const [stats, setStats] = useState(initialData?.stats || { teachers: 0, classes: 0, items: 0 })
  const [todaysAbsences, setTodaysAbsences] = useState<any[]>(initialData?.todaysAbsences || [])
  const [pending, setPending] = useState(initialData?.pending || { swaps: 0, requests: 0 })
  const [activeTimetable, setActiveTimetable] = useState<any>(initialData?.activeTimetable || null)
  const [hoveredTile, setHoveredTile] = useState<string | null>(null)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    if (initialData) {
      setLoading(false)
      return
    }

    const loadInitialData = async () => {
      setLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/admin/login')
        return
      }

      let absenceRes: any = await supabase.from('absences').select('id, absence_date, reason, created_at, status, teacher:profiles!teacher_id(full_name)').not('template_id', 'is', null).order('absence_date', { ascending: false }).limit(10)
      if (absenceRes.error) {
        absenceRes = await supabase.from('absences').select('id, absence_date, reason, created_at, status, profiles(full_name)').not('template_id', 'is', null).order('absence_date', { ascending: false }).limit(10)
      }

      const [
        userData,
        teacherStats,
        classStats,
        itemStats,
        swapData,
        requestData,
        timetableRes
      ] = await Promise.all([
        supabase.from('profiles').select('full_name').eq('id', session.user.id).single(),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'teacher').eq('is_active', true),
        supabase.from('classes').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('inventory').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('swap_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('profile_change_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('timetable_templates').select('id, name').eq('is_active', true).maybeSingle(),
      ])

      setUser(userData.data)
      setStats({ teachers: teacherStats.count || 0, classes: classStats.count || 0, items: itemStats.count || 0 })
      setTodaysAbsences(absenceRes.data || [])
      setPending({ swaps: swapData.count || 0, requests: requestData.count || 0 })

      let activeTmpl = timetableRes?.data
      if (!activeTmpl) {
        const { data: fallbackTmpl } = await supabase.from('timetable_templates').select('id, name').order('created_at', { ascending: false }).limit(1).maybeSingle()
        activeTmpl = fallbackTmpl
      }
      setActiveTimetable(activeTmpl)

      setLoading(false)
    }

    loadInitialData()
  }, [router, initialData, supabase])

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return { text: "Good Morning", icon: Sun }
    if (hour < 18) return { text: "Good Afternoon", icon: Sunset }
    return { text: "Good Evening", icon: Moon }
  }
  const { text: greetingText, icon: GreetingIcon } = getGreeting()

  const statTiles = [
    { href: '/admin/teachers', label: 'Active Teachers', value: stats.teachers, icon: Users, color: H.successGreen },
    { href: '/admin/classes', label: 'Active Classes', value: stats.classes, icon: BookOpen, color: H.skyBlue },
    { href: '/admin/inventory', label: 'Inventory Items', value: stats.items, icon: Archive, color: H.mintGreen },
    { href: '/admin/disruptions?tab=absences', label: 'Total Absences', value: todaysAbsences.length, icon: UserX, color: H.accent },
  ]

  if (loading) {
    return <DashboardSkeleton />
  }

  return (
    <div style={styles.page}>
      <div style={styles.shell}>
        <div style={styles.headerBar}>
          <div>
            <h1 style={styles.pageTitle}>{greetingText}, {user?.full_name?.split(' ')[0] || 'Admin'}</h1>
            <p style={styles.pageSubtitle}>
              <GreetingIcon size={14} style={{ color: H.accent }} />
              Here is today's school overview.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div style={styles.statusBadge}>
              <CheckCircle2 size={13} style={{ color: '#166534' }} />
              <span style={{ fontWeight: 600, color: '#166534' }}>System Active</span>
              <span style={{ color: H.textMuted }}>•</span>
              {new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
            </div>
          </div>
        </div>

        <div style={styles.metricStrip}>
          {statTiles.map((tile, idx) => {
            const Icon = tile.icon
            const isHovered = hoveredTile === tile.href
            return (
              <Link
                key={tile.href}
                href={tile.href}
                style={{
                  ...styles.metricCell,
                  backgroundColor: isHovered ? '#F5F5F4' : 'transparent',
                  borderRight: idx === statTiles.length - 1 ? 'none' : `1px solid ${H.border}`,
                }}
                onMouseEnter={() => setHoveredTile(tile.href)}
                onMouseLeave={() => setHoveredTile(null)}
              >
                <div style={styles.metricLabel}>
                  <span>{tile.label}</span>
                  <Icon size={16} style={{ color: tile.color }} />
                </div>
                <div style={styles.metricValueRow}>
                  <span style={styles.metricValue}>{tile.value}</span>
                  <ArrowUpRight size={14} style={{ color: H.textMuted, opacity: isHovered ? 1 : 0, transition: 'opacity 0.15s ease' }} />
                </div>
              </Link>
            )
          })}
        </div>

        {(stats.teachers === 0 || stats.classes === 0 || !activeTimetable) && (
          <div style={{
            padding: '14px 20px',
            backgroundColor: '#F4F4F5',
            borderBottom: `1px solid ${H.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Sparkles size={16} style={{ color: '#18181B', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: H.textPrimary }}>
                  Workspace Setup Checklist
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px', fontSize: '12.5px' }}>
                  <Link
                    href="/admin/teachers"
                    style={{
                      fontWeight: stats.teachers === 0 ? 700 : 500,
                      color: stats.teachers === 0 ? '#18181B' : H.textSec,
                      textDecoration: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                    }}
                  >
                    <span style={{ width: '18px', height: '18px', borderRadius: '50%', background: stats.teachers === 0 ? '#18181B' : '#E4E4E7', color: stats.teachers === 0 ? '#FFF' : H.textMuted, fontSize: '11px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>1</span>
                    Add Teachers
                  </Link>
                  <span style={{ color: H.textMuted }}>→</span>
                  <Link
                    href="/admin/classes"
                    style={{
                      fontWeight: stats.classes === 0 ? 700 : 500,
                      color: stats.classes === 0 ? '#18181B' : H.textSec,
                      textDecoration: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                    }}
                  >
                    <span style={{ width: '18px', height: '18px', borderRadius: '50%', background: stats.classes === 0 ? '#18181B' : '#E4E4E7', color: stats.classes === 0 ? '#FFF' : H.textMuted, fontSize: '11px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>2</span>
                    Create Classes
                  </Link>
                  <span style={{ color: H.textMuted }}>→</span>
                  <Link
                    href="/admin/timetable"
                    style={{
                      fontWeight: !activeTimetable ? 700 : 500,
                      color: !activeTimetable ? '#18181B' : H.textSec,
                      textDecoration: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                    }}
                  >
                    <span style={{ width: '18px', height: '18px', borderRadius: '50%', background: !activeTimetable ? '#18181B' : '#E4E4E7', color: !activeTimetable ? '#FFF' : H.textMuted, fontSize: '11px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>3</span>
                    Build Timetable
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        <div style={styles.contentGrid}>
          <div style={styles.mainSection}>
            <div style={styles.sectionHeader}>
              <span>Today's Attendance & Coverage</span>
              <span style={{ fontSize: '12px', fontWeight: 500, color: H.textMuted }}>
                {todaysAbsences.length} reported
              </span>
            </div>
            <AbsencesTable absences={todaysAbsences} />
          </div>

          <div style={styles.sideSection}>
            <PendingActions swaps={pending.swaps} requests={pending.requests} />
          </div>
        </div>
      </div>
    </div>
  )
}
