'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Coffee, Info, Calendar } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { generatePeriods, formatTime, todayDayOfWeek } from '@/lib/utils'
import { H } from '@/lib/honey'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import Badge from '@/components/ui/Badge'

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
const PALETTE = [H.skyLight, H.accentLight, H.successLight, H.softPinkLight]
const subjectColor = (s: string) => {
  if (!s) return { background: H.bg, color: H.textSec }
  let h = 0
  for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h)
  const color = PALETTE[Math.abs(h) % PALETTE.length]
  return { background: color, color: H.textPrimary }
}

export default function TeacherTimetablePage() {
  const [loading, setLoading] = useState(true)
  const [template, setTemplate] = useState<any>(null)
  const [schedule, setSchedule] = useState<any[]>([])
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) { router.push('/teacher/login'); return }

      const [{ data: tmpl }, { data: asgn }] = await Promise.all([
        supabase.from('timetable_templates').select('*').eq('is_active', true).maybeSingle(),
        supabase.from('schedule_assignments').select('*,class:classes(name,grade_level)').eq('teacher_id', session.user.id).order('day_of_week').order('period_number'),
      ])
      setTemplate(tmpl || null)
      setSchedule(asgn || [])
      setLoading(false)
    }
    load()
  }, [router, supabase])

  const periods = template ? generatePeriods(template.start_time, template.end_time, template.period_duration, template.breaks || []) : []
  const today = todayDayOfWeek()

  if (loading) {
    return (
      <div style={{ backgroundColor: H.bg, minHeight: '100vh', padding: 'clamp(16px, 3vw, 28px)', fontFamily: H.font, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <LoadingSpinner size={32} color={H.skyBlue} />
      </div>
    )
  }

  if (!template) {
    return (
      <div style={{ backgroundColor: H.bg, minHeight: '100vh', padding: 'clamp(16px, 3vw, 28px)', fontFamily: H.font, boxSizing: 'border-box' }}>
        <div style={{ backgroundColor: H.surface, border: `1px solid ${H.border}`, borderRadius: '16px', boxShadow: H.cardShadow, overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: `1px solid ${H.border}`, display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: H.surface }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: H.purpleLight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Calendar size={20} style={{ color: H.purpleDark }} />
            </div>
            <div>
              <h1 style={{ fontSize: '22px', fontWeight: 600, letterSpacing: '-0.02em', color: H.textPrimary, margin: 0 }}>My Weekly Timetable</h1>
            </div>
          </div>
          <div style={{ padding: '32px 24px', display: 'flex', alignItems: 'center', gap: '16px', background: H.purpleLight, margin: '24px', borderRadius: '14px', border: `1px solid ${H.purple}40` }}>
            <Info size={24} style={{ color: H.purple, flexShrink: 0 }} />
            <div>
              <h3 style={{ margin: '0 0 4px', fontSize: '15px', fontWeight: 700, color: H.purpleDark }}>No Active Timetable</h3>
              <p style={{ margin: 0, fontSize: '13px', color: H.textSec }}>No active timetable template has been published by the administration yet.</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ backgroundColor: H.bg, minHeight: '100vh', padding: 'clamp(16px, 3vw, 28px)', fontFamily: H.font, boxSizing: 'border-box', paddingBottom: '48px' }}>
      <div style={{ backgroundColor: H.surface, border: `1px solid ${H.border}`, borderRadius: '16px', boxShadow: H.cardShadow, overflow: 'hidden' }}>

        {/* Contiguous Header Bar */}
        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${H.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', backgroundColor: H.surface }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: H.purpleLight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Calendar size={20} style={{ color: H.purpleDark }} />
            </div>
            <div>
              <h1 style={{ fontSize: '22px', fontWeight: 600, letterSpacing: '-0.02em', color: H.textPrimary, margin: 0 }}>My Weekly Timetable</h1>
              <p style={{ fontSize: '13px', color: H.textSec, margin: '4px 0 0', fontVariantNumeric: 'tabular-nums' }}>{schedule.length} periods assigned this week</p>
            </div>
          </div>
          <Badge variant="category"><Calendar size={13} style={{ marginRight: 4 }} /> Active Schedule</Badge>
        </div>

        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.thTime}>Period</th>
                {DAYS.map((day, i) => (
                  <th key={day} style={{ ...styles.th, ...(i + 1 === today && { background: H.purpleLight, color: H.purpleDark, borderRadius: '12px' }) }}>
                    {day} {i + 1 === today && '(Today)'}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {periods.map((p, i) => {
                if (p.is_break) {
                  return (
                    <tr key={`break-${i}`}>
                      <td style={styles.td}>
                        <div style={{ ...styles.tdContent, background: H.bg, alignItems: 'center', flexDirection: 'row', gap: '8px' }}>
                          <Coffee size={16} style={{ color: H.textMuted }} />
                          <div style={{ textAlign: 'center' }}>
                            <p style={{ margin: 0, fontSize: '12px', fontWeight: 600, color: H.textSec }}>{(p as any).label || 'Break'}</p>
                            <p style={{ margin: 0, fontSize: '11px', color: H.textMuted }}>{formatTime(p.start_time)} - {formatTime(p.end_time)}</p>
                          </div>
                        </div>
                      </td>
                      <td colSpan={5} style={styles.td}>
                        <div style={{ ...styles.tdContent, background: H.bg, justifyContent: 'center', alignItems: 'center' }}></div>
                      </td>
                    </tr>
                  )
                }

                return (
                  <tr key={p.period_number}>
                    <td style={styles.td}>
                      <div style={{ ...styles.tdContent, justifyContent: 'center', alignItems: 'center', flexDirection: 'column' }}>
                        <p style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: H.textPrimary }}>P{p.period_number}</p>
                        <p style={{ margin: 0, fontSize: '11px', color: H.textMuted }}>{formatTime(p.start_time)}</p>
                      </div>
                    </td>
                    {DAYS.map((_, dayIndex) => {
                      const dayNum = dayIndex + 1
                      const slot = schedule.find((s: any) => s.day_of_week === dayNum && s.period_number === p.period_number)
                      const cellStyle = slot ? subjectColor(slot.subject || '') : { background: dayNum === today ? H.skyLight + '40' : H.bg, color: H.textSec }
                      return (
                        <td key={dayIndex} style={styles.td}>
                          <div style={{ ...styles.tdContent, background: cellStyle.background, border: `1px solid ${H.border}` }}>
                            {slot ? (
                              <>
                                <p style={{ color: cellStyle.color, fontWeight: 800, fontSize: '14px', margin: 0 }}>{slot.subject}</p>
                                <p style={{ color: cellStyle.color, opacity: 0.8, fontSize: '12px', fontWeight: 600, margin: '4px 0 0' }}>{slot.class?.name}</p>
                              </>
                            ) : (
                              <p style={{ margin: 0, fontSize: '13px', color: H.textMuted, textAlign: 'center' }}>—</p>
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
  )
}

