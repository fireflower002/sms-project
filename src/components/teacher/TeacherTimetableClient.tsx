'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Coffee, Info, Calendar, ShieldAlert, UserCheck, Clock, ArrowRightLeft, Sparkles, AlertCircle, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { generatePeriods, formatTime, todayDayOfWeek, todaySLT, formatSLT, dateToDayOfWeek } from '@/lib/utils'
import { H } from '@/lib/honey'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import Badge from '@/components/ui/Badge'
import { ComponentErrorBoundary } from '@/components/ui/ComponentErrorBoundary'
import { TimetableSkeleton } from '@/components/ui/Skeleton'
import { CURATED_PALETTE, DEFAULT_SUBJECT_COLORS } from '@/components/admin/SubjectModal'

const styles: { [key: string]: React.CSSProperties } = {
  page: { backgroundColor: H.bg, minHeight: '100vh', padding: 'clamp(16px, 3vw, 32px)', fontFamily: H.font },
  pageHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' },
  pageTitle: { fontSize: '24px', fontWeight: 800, color: H.textPrimary, margin: 0 },
  pageSubtitle: { fontSize: '14px', color: H.textSec, marginTop: '4px', margin: '4px 0 0' },
  card: { backgroundColor: H.surface, border: `1px solid ${H.border}`, borderRadius: '16px', boxShadow: H.cardShadow, overflow: 'hidden' },
  tableWrapper: { overflowX: 'auto', padding: '12px' },
  table: { width: '100%', minWidth: '800px', borderCollapse: 'separate', borderSpacing: '8px' },
  th: {
    padding: '14px',
    fontSize: '13px',
    fontWeight: 700,
    color: H.textSec,
    textAlign: 'center',
    width: '18%',
  },
  thTime: {
    padding: '14px 8px',
    fontSize: '12px',
    fontWeight: 700,
    color: H.textSec,
    textAlign: 'center',
    width: '10%',
  },
  td: {
    padding: '0',
    verticalAlign: 'top',
  },
  tdContent: {
    minHeight: '90px',
    height: '100%',
    padding: '12px',
    borderRadius: '12px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
  },
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

function hex2rgba(hex: string, a: number) {
  if (!hex || !hex.startsWith('#')) return `rgba(245, 158, 11, ${a})`
  const r = parseInt(hex.slice(1,3), 16), g = parseInt(hex.slice(3,5), 16), b = parseInt(hex.slice(5,7), 16)
  return `rgba(${r},${g},${b},${a})`
}

export default function TeacherTimetableClient({ initialData }: { initialData?: any }) {
  const [loading, setLoading] = useState(!initialData)
  const [template, setTemplate] = useState<any>(initialData?.template || null)
  const [schedule, setSchedule] = useState<any[]>(initialData?.schedule || [])
  const [reliefDuties, setReliefDuties] = useState<any[]>(initialData?.reliefDuties || [])
  const [subjectColors, setSubjectColors] = useState<Record<string, string>>(initialData?.subjectColors || {})
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    if (initialData) return

    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) { router.push('/teacher/login'); return }

      const todayStr = todaySLT()

      const [{ data: tmpl }, { data: asgn }, { data: prof }, { data: subData }] = await Promise.all([
        supabase.from('timetable_templates').select('*').eq('is_active', true).maybeSingle(),
        supabase.from('schedule_assignments').select('*,class:classes(name,grade_level)').eq('teacher_id', session.user.id).order('day_of_week').order('period_number'),
        supabase.from('profiles').select('subject_colors').eq('id', session.user.id).maybeSingle(),
        supabase.from('substitutions')
          .select('*, absence:absences!absence_id!inner(absence_date, teacher:profiles!teacher_id(full_name)), class:classes(name,grade_level)')
          .eq('substitute_teacher_id', session.user.id)
          .in('status', ['assigned', 'swap_requested', 'confirmed'])
          .order('created_at', { ascending: false }),
      ])

      setTemplate(tmpl || null)
      setSchedule(asgn || [])
      if (prof?.subject_colors) setSubjectColors(prof.subject_colors)

      const activeRelief = (subData || []).filter((s: any) => {
        const date = s.absence?.absence_date
        return date && date >= todayStr
      })
      setReliefDuties(activeRelief)
      setLoading(false)
    }
    load()
  }, [router, supabase, initialData])

  const getSubjectStyle = (s: string, slotColor?: string) => {
    if (!s) return { background: H.bg, color: H.textSec, border: `1px solid ${H.border}` }
    let hex = slotColor
    if (s === 'Music' && (!hex || hex === '#14B8A6' || hex === '#06B6D4')) {
      hex = '#EAB308'
    } else if (!hex || hex === '#14B8A6') {
      hex = subjectColors[s] || DEFAULT_SUBJECT_COLORS[s] || CURATED_PALETTE[0]
    }
    return {
      background: hex2rgba(hex, 0.12),
      color: H.textPrimary,
      border: `1px solid ${hex2rgba(hex, 0.35)}`,
      borderLeft: `4px solid ${hex}`,
    }
  }

  const periods = template ? generatePeriods(template.start_time, template.end_time, template.period_duration, template.breaks || []) : []
  const todayDow = todayDayOfWeek()

  if (loading) return <TimetableSkeleton />

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.pageHeader}>
        <div>
          <h1 style={{ ...styles.pageTitle, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Calendar size={26} style={{ color: '#18181B' }} />
            My Weekly Timetable
          </h1>
          <p style={styles.pageSubtitle}>
            {template ? `${template.name} • Active Timetable` : 'View your assigned class schedule'}
          </p>
        </div>
      </div>

      {!template ? (
        <div style={{ ...styles.card, padding: '40px 20px', textAlign: 'center' }}>
          <ShieldAlert size={36} style={{ color: H.textMuted, margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: '18px', fontWeight: 700, color: H.textPrimary, margin: 0 }}>No Active Timetable</h3>
          <p style={{ fontSize: '14px', color: H.textSec, marginTop: '4px' }}>The school administration has not published an active timetable yet.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {/* Relief Duties Section */}
          {reliefDuties.length > 0 && (
            <div style={{ ...styles.card, border: `1px solid ${H.skyLight}`, backgroundColor: '#F0F9FF' }}>
              <div style={{ padding: '16px 20px', borderBottom: `1px solid ${H.skyLight}`, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={18} style={{ color: H.skyDark }} />
                <h3 style={{ fontSize: '15px', fontWeight: 800, color: H.skyDark, margin: 0 }}>
                  Upcoming Relief & Coverage Duties ({reliefDuties.length})
                </h3>
              </div>
              <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {reliefDuties.map((duty: any) => (
                  <div key={duty.id} style={{ backgroundColor: H.surface, border: `1px solid ${H.border}`, borderRadius: '12px', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: H.textPrimary, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>{duty.absence?.absence_date}</span>
                        <span>•</span>
                        <span>Period {duty.period_number}</span>
                        <Badge variant="category">{duty.class?.name || 'Class'}</Badge>
                      </div>
                      <p style={{ fontSize: '12px', color: H.textSec, margin: '4px 0 0' }}>
                        Covering for <strong>{duty.absence?.teacher?.full_name || 'Absent Teacher'}</strong> ({duty.subject})
                      </p>
                    </div>
                    <Badge variant="pending">Coverage Duty</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Timetable Grid Card */}
          <div style={styles.card}>
            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.thTime}>Period</th>
                    {DAYS.map((dayName, idx) => {
                      const dayNum = idx + 1
                      const isToday = dayNum === todayDow
                      return (
                        <th
                          key={dayName}
                          style={{
                            ...styles.th,
                            backgroundColor: isToday ? '#F4F4F5' : 'transparent',
                            borderRadius: '10px',
                            color: isToday ? '#18181B' : H.textSec,
                            fontWeight: isToday ? 800 : 700,
                          }}
                        >
                          {dayName} {isToday && <span style={{ fontSize: '11px', color: '#18181B' }}>(Today)</span>}
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {periods.map((p: any) => {
                    if (p.is_break) {
                      return (
                        <tr key={`break-${p.number}`}>
                          <td style={{ ...styles.thTime, backgroundColor: '#FAF9F6', borderRadius: '8px' }}>
                            <Coffee size={14} style={{ display: 'inline', marginRight: '4px' }} />
                            Break
                          </td>
                          <td colSpan={5} style={{ textAlign: 'center', padding: '8px', backgroundColor: '#FAF9F6', borderRadius: '8px', fontSize: '12px', fontWeight: 600, color: H.textMuted }}>
                            {p.label || 'Break'} ({formatTime(p.start_time)} - {formatTime(p.end_time)})
                          </td>
                        </tr>
                      )
                    }

                    const periodNum = p.period_number

                    return (
                      <tr key={`period-${periodNum}`}>
                        <td style={{ ...styles.thTime, backgroundColor: H.bg, borderRadius: '8px' }}>
                          <div style={{ fontWeight: 700, color: H.textPrimary }}>P{periodNum}</div>
                          <div style={{ fontSize: '11px', color: H.textMuted }}>{formatTime(p.start_time)}</div>
                        </td>

                        {[1, 2, 3, 4, 5].map((dayNum) => {
                          const asgn = schedule.find(
                            (s: any) => s.day_of_week === dayNum && s.period_number === periodNum
                          )
                          const isToday = dayNum === todayDow

                          return (
                            <td key={`cell-${dayNum}-${periodNum}`} style={styles.td}>
                              <div
                                style={{
                                  ...styles.tdContent,
                                  ...(asgn ? getSubjectStyle(asgn.subject, asgn.color) : { background: H.bg, border: `1px solid ${H.border}` }),
                                  ...(isToday && !asgn ? { border: `1px dashed ${H.border}` } : {}),
                                }}
                              >
                                {asgn ? (
                                  <>
                                    <div style={{ fontSize: '13px', fontWeight: 800 }}>{asgn.class?.name || 'Class'}</div>
                                    <div style={{ fontSize: '12px', fontWeight: 600, marginTop: '2px', opacity: 0.9 }}>{asgn.subject}</div>
                                  </>
                                ) : (
                                  <div style={{ fontSize: '12px', color: H.textMuted, textAlign: 'center' }}>Free</div>
                                )}
                              </div>
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}
    </div>
  )
}
