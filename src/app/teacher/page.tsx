'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatTime, todaySLT, todayDayOfWeek, generatePeriods } from '@/lib/utils'
import {
  Sun, Moon, Sunset, X, ArrowRight, Bell, ClipboardList,
  ArrowRightLeft, User, Megaphone, Info, Calendar, Clock, Coffee, LayoutDashboard
} from 'lucide-react'
import { H } from '@/lib/honey'
import { DashboardSkeleton } from '@/components/ui/Skeleton'
import Badge from '@/components/ui/Badge'

const styles: { [key: string]: React.CSSProperties } = {
  page: { backgroundColor: H.bg, minHeight: '100vh', padding: 'clamp(12px, 3vw, 24px)', fontFamily: H.font },
  pageGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', alignItems: 'start' },
  mainColumn: { display: 'flex', flexDirection: 'column', gap: '20px' },
  card: { backgroundColor: H.surface, border: `1px solid ${H.border}`, borderRadius: '16px', boxShadow: H.cardShadow },
  pageTitle: { fontSize: '24px', fontWeight: 800, color: H.textPrimary, margin: 0 },
  pageSubtitle: { fontSize: '14px', color: H.textSec, display: 'flex', alignItems: 'center', gap: '8px', margin: '4px 0 0' },
  sectionHeader: { fontSize: '15px', fontWeight: 700, color: H.textPrimary, margin: '0 0 14px', letterSpacing: '-0.01em' },
  button: { display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '10px', fontWeight: 600, fontSize: '13px', textDecoration: 'none', cursor: 'pointer', minHeight: '38px' },
  metricStrip: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    borderBottom: `1px solid ${H.border}`,
    backgroundColor: H.surface,
  },
  metricCell: {
    padding: '16px 20px',
    textDecoration: 'none',
    color: 'inherit',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    gap: '6px',
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
    fontWeight: 700,
    letterSpacing: '-0.02em',
    color: H.textPrimary,
    fontVariantNumeric: 'tabular-nums',
  },
}

// SUB-COMPONENTS ==============================================================

const NotificationCard = ({ icon, color, bg, border, title, children, onDismiss }: any) => (
  <div style={{ backgroundColor: bg, border: `1px solid ${border}`, borderRadius: '14px', padding: '16px', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
    <div style={{ color, marginTop: 2 }}>{icon}</div>
    <div style={{ flex: 1 }}>
      <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color }}>{title}</h3>
      <div style={{ marginTop: '6px' }}>{children}</div>
    </div>
    <button onClick={onDismiss} style={{ background: 'none', border: 'none', cursor: 'pointer', color: H.textMuted, padding: 4 }}>
      <X size={18} />
    </button>
  </div>
)

const QuickActionGrid = () => {
  const actions = [
    { label: 'Report Absence', desc: 'Notify admin of upcoming leave', href: '/teacher/report-absence', icon: ClipboardList, color: '#0284C7', bg: '#E0F2FE' },
    { label: 'Weekly Timetable', desc: 'View complete teaching schedule', href: '/teacher/timetable', icon: Calendar, color: '#D97706', bg: '#FEF3C7' },
    { label: 'Staff Notices', desc: 'Read school announcements', href: '/teacher/announcements', icon: Megaphone, color: '#9D174D', bg: '#FCE7F3' },
  ]

  return (
    <div>
      <h2 style={styles.sectionHeader}>Quick Actions</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
        {actions.map(act => {
          const Icon = act.icon
          return (
            <Link key={act.href} href={act.href} style={{ textDecoration: 'none' }}>
              <div style={{
                backgroundColor: H.surface,
                border: `1px solid ${H.border}`,
                borderRadius: '12px',
                padding: '14px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                cursor: 'pointer',
                transition: 'border-color 0.15s ease, background-color 0.15s ease',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 8,
                    backgroundColor: act.bg, color: act.color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <Icon size={18} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '13.5px', color: H.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{act.label}</div>
                    <div style={{ fontSize: '12px', color: H.textSec, marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{act.desc}</div>
                  </div>
                </div>
                <ArrowRight size={15} style={{ color: H.textMuted, flexShrink: 0 }} />
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

const AnnouncementsPreview = ({ announcements }: any) => (
  <div>
    <h2 style={styles.sectionHeader}>Latest Announcements</h2>
    <div style={{ ...styles.card, padding: '20px' }}>
      {announcements.length === 0 ? (
        <p style={{ color: H.textMuted, margin: 0, fontSize: '13px' }}>No new announcements.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {announcements.map((a: any, idx: number) => (
            <Link key={a.id} href="/teacher/announcements" style={{ textDecoration: 'none', color: 'inherit' }}>
              <div style={{
                paddingBottom: idx === announcements.length - 1 ? 0 : '12px',
                borderBottom: idx === announcements.length - 1 ? 'none' : `1px solid ${H.border}`
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  {a.priority === 'high' && <Badge variant="pending">URGENT</Badge>}
                  <h4 style={{ margin: 0, fontWeight: 700, fontSize: '14px', color: H.textPrimary }}>{a.title}</h4>
                </div>
                <p style={{ margin: 0, fontSize: '12px', color: H.textSec }}>
                  Published {new Date(a.created_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  </div>
)

const ScheduleTimeline = ({ schedule, template, substitutions }: any) => {
  if (!template) {
    return (
      <div style={{
        padding: '16px 20px',
        borderRadius: '14px',
        background: H.skyLight,
        border: `1px solid ${H.skyBlue}40`,
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        color: H.skyDark,
        fontSize: '13px',
        fontWeight: 600,
      }}>
        <Info size={20} style={{ color: H.skyBlue, minWidth: 20 }} />
        <span>No active timetable template configured by administration.</span>
      </div>
    )
  }

  const periods = generatePeriods(template.start_time, template.end_time, template.period_duration, template.breaks || [])
  const now = new Date()

  return (
    <div style={{ ...styles.card }}>
      <div style={{ padding: '16px 20px', borderBottom: `1px solid ${H.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ ...styles.sectionHeader, margin: 0 }}>Today's Schedule</h2>
        <Badge variant="category">P1 - P{periods.filter((p: any) => !p.is_break).length}</Badge>
      </div>
      <div style={{ padding: '16px 20px' }}>
        {periods.map((p: any, index: number) => {
          const isNow = now >= new Date(now.toDateString() + ' ' + p.start_time) && now < new Date(now.toDateString() + ' ' + p.end_time)
          const slot = schedule.find((s: any) => s.period_number === p.period_number)
          const sub = substitutions.find((s: any) => s.period_number === p.period_number)

          return (
            <div key={index} style={{
              display: 'flex', gap: '14px',
              borderLeft: `3px solid ${isNow ? H.skyBlue : H.border}`,
              padding: '12px 0 12px 14px',
              backgroundColor: isNow ? H.skyLight + '40' : 'transparent',
              borderRadius: '0 8px 8px 0',
              marginBottom: 4,
            }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: isNow ? H.skyDark : H.textMuted, width: '70px', flexShrink: 0 }}>
                {formatTime(p.start_time)}
              </div>
              <div style={{ flex: 1 }}>
                {p.is_break ? (
                  <p style={{ margin: 0, fontWeight: 700, fontSize: '13px', color: H.textSec, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <Coffee size={14} style={{ color: H.accent }} />
                    {p.label || 'Break'}
                  </p>
                ) : sub ? (
                  <>
                    <p style={{ margin: 0, fontWeight: 700, color: H.danger, background: H.dangerLight, padding: '2px 8px', borderRadius: '6px', display: 'inline-block', fontSize: '11px' }}>COVER DUTY</p>
                    <p style={{ margin: '4px 0 0', fontWeight: 700, fontSize: '13px', color: H.textPrimary }}>{sub.class?.name}</p>
                    <p style={{ margin: '2px 0 0', fontSize: '12px', color: H.textSec }}>For {sub.original?.full_name}</p>
                  </>
                ) : slot ? (
                  <>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: '14px', color: H.textPrimary }}>{slot.subject}</p>
                    <p style={{ margin: '2px 0 0', fontSize: '12px', color: H.textSec }}>{slot.class?.name}</p>
                  </>
                ) : (
                  <p style={{ margin: 0, fontWeight: 600, fontSize: '13px', color: H.grass }}>Free Period</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// MAIN PAGE COMPONENT ========================================================
export default function TeacherDashboard() {
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<any>({ schedule: [], template: null, announcements: [], substitutions: [] })
  const [showSubs, setShowSubs] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const loadData = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) { router.push('/teacher/login'); return }

      let prof: any = null
      const { data: fetchProf } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle()
      prof = fetchProf

      if (!prof) {
        // Auto-heal missing profile from allowed_users or Auth user metadata
        const userEmail = session.user.email?.toLowerCase() || ''
        let fullName = session.user.user_metadata?.full_name || ''
        let subjects: string[] = []
        let mustChangePassword = false

        if (userEmail) {
          const { data: allowed } = await supabase.from('allowed_users').select('*').eq('email', userEmail).maybeSingle()
          if (allowed) {
            fullName = allowed.full_name || fullName
            subjects = allowed.subjects || []
            mustChangePassword = !allowed.is_registered
          }
        }

        if (!fullName) fullName = userEmail.split('@')[0] || 'Teacher'

        const newProfile = {
          id: session.user.id,
          email: userEmail,
          full_name: fullName,
          role: 'teacher',
          subjects,
          must_change_password: mustChangePassword,
          is_active: true
        }

        await supabase.from('profiles').upsert(newProfile)
        prof = newProfile
      }

      if (prof.role === 'admin') {
        router.push('/admin')
        return
      }

      setProfile(prof)

      const today = todaySLT()
      const todayDay = todayDayOfWeek()

      const [schedule, template, announcements, substitutions] = await Promise.all([
        supabase.from('schedule_assignments').select('*,class:classes(name,grade_level)').eq('teacher_id', session.user.id).eq('day_of_week', todayDay).order('period_number'),
        supabase.from('timetable_templates').select('*').eq('is_active', true).maybeSingle(),
        supabase.from('announcements').select('id,title,body,created_at,priority').eq('is_published', true).eq('is_active', true).order('created_at', { ascending: false }).limit(3),
        supabase.from('substitutions').select('*,class:classes(name),absence:absences!absence_id!inner(absence_date,teacher:profiles!teacher_id(full_name))').eq('substitute_teacher_id', session.user.id).eq('absence.absence_date', today),
      ])

      const formattedSubs = (substitutions.data || []).map((s: any) => ({
        ...s,
        original: s.absence?.teacher || null,
      }))

      setData({
        schedule: schedule.data || [],
        template: template.data,
        announcements: announcements.data || [],
        substitutions: formattedSubs,
      })
      setLoading(false)
    }
    loadData()
  }, [router, supabase])

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return { text: "Good Morning", icon: <Sun size={20} style={{ color: H.accent }} /> }
    if (hour < 17) return { text: "Good Afternoon", icon: <Sunset size={20} style={{ color: H.accent }} /> }
    return { text: "Good Evening", icon: <Moon size={20} style={{ color: H.accent }} /> }
  }
  const { text: greetingText, icon: greetingIcon } = getGreeting()

  if (loading) return <DashboardSkeleton />

  return (
    <div style={{ backgroundColor: H.bg, minHeight: '100vh', padding: 'clamp(12px, 3vw, 24px)', fontFamily: H.font, boxSizing: 'border-box' }}>
      <div style={{ backgroundColor: H.surface, border: `1px solid ${H.border}`, borderRadius: '16px', boxShadow: H.cardShadow, overflow: 'hidden' }}>
        
        {/* Contiguous Greeting Header */}
        <div style={{ padding: '18px 20px', borderBottom: `1px solid ${H.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', backgroundColor: H.surface }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#E0F2FE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <LayoutDashboard size={20} style={{ color: '#0284C7' }} />
            </div>
            <div>
              <h1 style={{ fontSize: '20px', fontWeight: 700, letterSpacing: '-0.02em', color: H.textPrimary, margin: 0 }}>
                {greetingText}, {profile?.full_name?.split(' ')[0]}
              </h1>
              <p style={{ fontSize: '12.5px', fontWeight: 400, color: H.textSec, margin: '2px 0 0', display: 'flex', alignItems: 'center', gap: '6px', fontVariantNumeric: 'tabular-nums' }}>
                {greetingIcon} {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
          </div>
        </div>

        {/* Contiguous Metric Strip (3 cells) */}
        <div style={styles.metricStrip}>
          <div style={styles.metricCell}>
            <div style={styles.metricLabel}>Classes Today</div>
            <div style={styles.metricValueRow}>
              <span style={styles.metricValue}>{data.schedule.length}</span>
              <span style={{ fontSize: '12px', color: H.textMuted }}>periods</span>
            </div>
          </div>

          <div style={styles.metricCell}>
            <div style={styles.metricLabel}>Cover Duties</div>
            <div style={styles.metricValueRow}>
              <span style={{ ...styles.metricValue, color: data.substitutions.length > 0 ? H.skyDark : H.textPrimary }}>
                {data.substitutions.length}
              </span>
              <span style={{ fontSize: '12px', color: H.textMuted }}>assigned</span>
            </div>
          </div>

          <div style={{ ...styles.metricCell, borderRight: 'none' }}>
            <div style={styles.metricLabel}>Announcements</div>
            <div style={styles.metricValueRow}>
              <span style={styles.metricValue}>{data.announcements.length}</span>
              <span style={{ fontSize: '12px', color: H.textMuted }}>notices</span>
            </div>
          </div>
        </div>

        <div style={{ padding: 'clamp(16px, 3vw, 24px)' }}>
          <div style={styles.pageGrid}>
            <div style={styles.mainColumn}>
              {data.substitutions.length > 0 && showSubs && (
                <NotificationCard
                  icon={<ClipboardList size={22} />}
                  color={H.skyDark}
                  bg={H.skyLight}
                  border={H.skyBlue}
                  title={`You have ${data.substitutions.length} cover duty assignment(s) today`}
                  onDismiss={() => setShowSubs(false)}
                >
                  <p style={{ margin: 0, fontSize: '13px', color: H.textSec }}>Please check your timeline on the right for class details.</p>
                </NotificationCard>
              )}

              <QuickActionGrid />
              <AnnouncementsPreview announcements={data.announcements} />
            </div>

            <ScheduleTimeline schedule={data.schedule} template={data.template} substitutions={data.substitutions} />
          </div>
        </div>
      </div>
    </div>
  )
}

