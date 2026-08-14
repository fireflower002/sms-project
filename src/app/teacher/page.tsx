'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatTime, todaySLT, todayDayOfWeek, generatePeriods } from '@/lib/utils'
import {
  Sun, Moon, Sunset, X, ArrowRight, Bell, ClipboardList,
  ArrowRightLeft, User, Megaphone, Info, Calendar, Clock, Coffee, LayoutDashboard,
  RotateCcw, Loader2, AlertCircle, CheckCircle2
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

const ScheduleTimeline = ({ schedule, template, substitutions, onRequestSwap }: any) => {
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
                  <div>
                    <span style={{ margin: 0, fontWeight: 700, color: H.danger, background: H.dangerLight, padding: '2px 8px', borderRadius: '6px', fontSize: '11px', display: 'inline-block' }}>COVER DUTY</span>
                    <p style={{ margin: '4px 0 0', fontWeight: 700, fontSize: '13px', color: H.textPrimary }}>{sub.class?.name}</p>
                    <p style={{ margin: '2px 0 0', fontSize: '12px', color: H.textSec }}>For {sub.original?.full_name}</p>
                    {sub.status === 'swap_requested' ? (
                      <span style={{ fontSize: '11px', color: H.softPinkDark, fontWeight: 700, marginTop: '4px', display: 'inline-block' }}>
                        ⚠ Swap Requested ({sub.swap_reason || 'Pending Admin Reassignment'})
                      </span>
                    ) : (
                      <button
                        onClick={() => onRequestSwap(sub)}
                        style={{
                          marginTop: '6px',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          border: `1px solid ${H.border}`,
                          background: H.surface,
                          color: H.textSec,
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <RotateCcw size={11} /> Request Swap / Can't Cover
                      </button>
                    )}
                  </div>
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
  const [swapSub, setSwapSub] = useState<any>(null)
  const [swapReason, setSwapReason] = useState('')
  const [submittingSwap, setSubmittingSwap] = useState(false)
  const [swapSuccess, setSwapSuccess] = useState(false)
  const [swapError, setSwapError] = useState('')

  const router = useRouter()
  const supabase = createClient()

  const loadData = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) { router.push('/teacher/login'); return }

    // Check server role endpoint first to prevent converting admin accounts
    try {
      const res = await fetch('/api/auth/role')
      if (res.ok) {
        const roleData = await res.json()
        if (roleData.role === 'admin') {
          router.push('/admin')
          return
        }
      }
    } catch (e) {}

    let prof: any = null
    const { data: fetchProf } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle()
    prof = fetchProf

    if (!prof) {
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

      if (!fullName) fullName = userEmail.split('@')[0] || 'User'

      const isAdminByMetaOrEmail =
        session.user.user_metadata?.role === 'admin' ||
        userEmail.startsWith('admin') ||
        userEmail.includes('admin@')

      const newProfile = {
        id: session.user.id,
        email: userEmail,
        full_name: fullName,
        role: isAdminByMetaOrEmail ? 'admin' : 'teacher',
        subjects,
        must_change_password: isAdminByMetaOrEmail ? false : mustChangePassword,
        is_active: true
      }

      await supabase.from('profiles').upsert(newProfile)
      prof = newProfile
    }

    if (prof?.role === 'admin') {
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

  useEffect(() => {
    loadData()
  }, [router, supabase])

  const handleRequestSwapSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!swapSub) return
    setSubmittingSwap(true)
    setSwapError('')

    try {
      let { error } = await supabase
        .from('substitutions')
        .update({
          status: 'swap_requested',
          swap_reason: swapReason || 'Schedule conflict reported by cover teacher',
          swap_requested_at: new Date().toISOString()
        })
        .eq('id', swapSub.id)

      if (error && (error.message.includes('status') || error.message.includes('schema cache') || error.message.includes('column'))) {
        const res = await supabase
          .from('substitutions')
          .update({
            notified: true,
            notified_at: new Date().toISOString()
          })
          .eq('id', swapSub.id)
        error = res.error
      }

      if (error) throw error

      // Post high-priority notification broadcast for administration
      await supabase.from('announcements').insert({
        title: `URGENT: Cover Swap Requested - Period ${swapSub.period_number}`,
        body: `${profile?.full_name || 'Cover teacher'} requested a swap for Period ${swapSub.period_number} (${swapSub.class?.name || 'Class'}). Reason: ${swapReason || 'Schedule conflict'}`,
        priority: 'high',
        is_published: true,
        is_active: true,
        created_by: profile?.id
      })

      setSwapSuccess(true)
      setTimeout(() => {
        setSwapSub(null)
        setSwapSuccess(false)
        setSwapReason('')
        loadData()
      }, 1500)
    } catch (err: any) {
      setSwapError(err.message || 'Failed to submit swap request.')
    } finally {
      setSubmittingSwap(false)
    }
  }

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

            <ScheduleTimeline schedule={data.schedule} template={data.template} substitutions={data.substitutions} onRequestSwap={(sub: any) => setSwapSub(sub)} />
          </div>
        </div>
      </div>

      {/* Swap Request Modal */}
      {swapSub && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(28,25,23,0.6)', backdropFilter: 'blur(4px)' }} onClick={() => setSwapSub(null)} />
          <div style={{ position: 'relative', width: '100%', maxWidth: '440px', borderRadius: '16px', backgroundColor: H.surface, border: `1px solid ${H.border}`, boxShadow: H.cardShadow, padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: H.textPrimary, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <RotateCcw size={18} style={{ color: H.purple }} /> Request Cover Swap
              </h3>
              <button onClick={() => setSwapSub(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: H.textMuted }}>
                <X size={18} />
              </button>
            </div>

            {swapSuccess ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <CheckCircle2 size={44} style={{ color: H.grass, margin: '0 auto 12px' }} />
                <div style={{ fontWeight: 700, fontSize: '15px', color: H.textPrimary }}>Swap Requested</div>
                <p style={{ fontSize: '13px', color: H.textSec, marginTop: '4px' }}>Administration has been notified to reassign your cover duty.</p>
              </div>
            ) : (
              <form onSubmit={handleRequestSwapSubmit}>
                <p style={{ fontSize: '13px', color: H.textSec, margin: '0 0 16px' }}>
                  Flag to administration that you cannot cover Period {swapSub.period_number} for <strong>{swapSub.original?.full_name || 'absent teacher'}</strong>.
                </p>

                {swapError && (
                  <div style={{ padding: '10px 14px', borderRadius: '8px', background: H.dangerLight, color: H.danger, fontSize: '13px', fontWeight: 600, marginBottom: '14px' }}>
                    <AlertCircle size={14} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
                    {swapError}
                  </div>
                )}

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: H.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
                    Reason for Swap Request
                  </label>
                  <textarea
                    value={swapReason}
                    onChange={e => setSwapReason(e.target.value)}
                    placeholder="e.g. Schedule conflict, urgent appointment, class overlap..."
                    required
                    rows={3}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: `1px solid ${H.border}`,
                      background: H.bg,
                      color: H.textPrimary,
                      fontSize: '13px',
                      fontFamily: H.font,
                      outline: 'none',
                      boxSizing: 'border-box',
                      resize: 'vertical',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button type="button" onClick={() => setSwapSub(null)} style={{ border: `1px solid ${H.border}`, background: H.bg, color: H.textSec, padding: '8px 16px', borderRadius: '8px', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>
                    Cancel
                  </button>
                  <button type="submit" disabled={submittingSwap} style={{ border: 'none', background: H.purple, color: '#fff', padding: '8px 16px', borderRadius: '8px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', opacity: submittingSwap ? 0.7 : 1 }}>
                    {submittingSwap ? <Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} /> : 'Submit Request'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

