'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Coffee, Info, Calendar, ShieldAlert, UserCheck, Clock, ArrowRightLeft, Sparkles, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { generatePeriods, formatTime, todayDayOfWeek, todaySLT, formatSLT, dateToDayOfWeek } from '@/lib/utils'
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

import { CURATED_PALETTE, DEFAULT_SUBJECT_COLORS } from '@/components/admin/SubjectModal'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

function hex2rgba(hex: string, a: number) {
  if (!hex || !hex.startsWith('#')) return `rgba(245, 158, 11, ${a})`
  const r = parseInt(hex.slice(1,3), 16), g = parseInt(hex.slice(3,5), 16), b = parseInt(hex.slice(5,7), 16)
  return `rgba(${r},${g},${b},${a})`
}

export default function TeacherTimetablePage() {
  const [loading, setLoading] = useState(true)
  const [template, setTemplate] = useState<any>(null)
  const [schedule, setSchedule] = useState<any[]>([])
  const [reliefDuties, setReliefDuties] = useState<any[]>([])
  const [subjectColors, setSubjectColors] = useState<Record<string, string>>({})
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
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

      // Filter for today or upcoming relief duties only (exclude past dates)
      const activeRelief = (subData || []).filter((s: any) => {
        const date = s.absence?.absence_date
        return date && date >= todayStr
      })
      setReliefDuties(activeRelief)

      setLoading(false)
    }
    load()
  }, [router, supabase])

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
  const today = todayDayOfWeek()
  const todayStr = todaySLT()
  const initialDay = today >= 1 && today <= 5 ? today : 1
  const [selectedDay, setSelectedDay] = useState<number>(initialDay)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

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

  const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']

  return (
    <div style={{ backgroundColor: H.bg, minHeight: '100vh', padding: 'clamp(12px, 3vw, 28px)', fontFamily: H.font, boxSizing: 'border-box', paddingBottom: '96px' }}>
      
      {/* ── Separate Dedicated Relief & Cover Duties Section ── */}
      {reliefDuties.length > 0 && (
        <div style={{
          backgroundColor: H.surface,
          border: `1.5px solid ${H.honey}`,
          borderRadius: '16px',
          boxShadow: '0 4px 16px rgba(245, 158, 11, 0.12)',
          overflow: 'hidden',
          marginBottom: '24px',
        }}>
          {/* Header */}
          <div style={{
            padding: '16px 20px',
            backgroundColor: 'rgba(254, 243, 199, 0.5)',
            borderBottom: `1px solid rgba(245, 158, 11, 0.25)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                backgroundColor: '#FEF3C7',
                border: '1px solid #FCD34D',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <ShieldAlert size={20} style={{ color: '#D97706' }} />
              </div>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 800, color: H.textPrimary, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  Relief & Cover Duty Assignments
                </h2>
                <p style={{ fontSize: '12.5px', color: H.textSec, margin: '2px 0 0' }}>
                  You have been assigned to cover classes on specific dates below.
                </p>
              </div>
            </div>
            <span style={{
              fontSize: '12px',
              fontWeight: 700,
              padding: '4px 12px',
              borderRadius: '20px',
              backgroundColor: '#FEF3C7',
              color: '#92400E',
              border: '1px solid #FCD34D',
            }}>
              {reliefDuties.length} Active Duty {reliefDuties.length > 1 ? 'Assignments' : 'Assignment'}
            </span>
          </div>

          {/* Duties Cards List */}
          <div style={{ padding: '16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
            {reliefDuties.map((sub: any) => {
              const isToday = sub.absence?.absence_date === todayStr
              const periodInfo = periods.find((p: any) => p.period_number === sub.period_number)
              const formattedDate = formatSLT(sub.absence?.absence_date || todayStr, 'EEEE, dd MMM yyyy')
              const isSwap = sub.status === 'swap_requested'

              return (
                <div key={sub.id} style={{
                  backgroundColor: isToday ? '#FFFBEB' : H.bg,
                  border: `1.5px solid ${isToday ? '#FCD34D' : H.border}`,
                  borderRadius: '14px',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  position: 'relative',
                  boxShadow: isToday ? '0 2px 8px rgba(245, 158, 11, 0.15)' : 'none',
                }}>
                  {/* Card Header: Date & Status */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Calendar size={14} style={{ color: '#D97706' }} />
                      <span style={{ fontSize: '13px', fontWeight: 700, color: H.textPrimary }}>
                        {formattedDate}
                      </span>
                    </div>
                    {isToday ? (
                      <span style={{
                        fontSize: '10.5px',
                        fontWeight: 800,
                        padding: '2px 8px',
                        borderRadius: '6px',
                        backgroundColor: '#DC2626',
                        color: '#FFFFFF',
                        letterSpacing: '0.03em',
                      }}>
                        TODAY
                      </span>
                    ) : isSwap ? (
                      <span style={{
                        fontSize: '10.5px',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: '6px',
                        backgroundColor: '#EFF6FF',
                        color: '#1D4ED8',
                        border: '1px solid #BFDBFE',
                      }}>
                        SWAP PENDING
                      </span>
                    ) : (
                      <span style={{
                        fontSize: '10.5px',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: '6px',
                        backgroundColor: '#FEF3C7',
                        color: '#92400E',
                        border: '1px solid #FCD34D',
                      }}>
                        RELIEF
                      </span>
                    )}
                  </div>

                  {/* Class & Subject Details */}
                  <div style={{
                    backgroundColor: H.surface,
                    border: `1px solid ${H.border}`,
                    borderRadius: '10px',
                    padding: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}>
                    <div>
                      <span style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        color: '#D97706',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        display: 'block',
                      }}>
                        Period {sub.period_number} {periodInfo ? `(${formatTime(periodInfo.start_time)} - ${formatTime(periodInfo.end_time)})` : ''}
                      </span>
                      <p style={{ margin: '2px 0 0', fontSize: '15px', fontWeight: 800, color: H.textPrimary }}>
                        {sub.subject || 'Cover Class'}
                      </p>
                      <p style={{ margin: '2px 0 0', fontSize: '12.5px', fontWeight: 600, color: H.textSec }}>
                        Class: {sub.class?.name || 'Assigned Class'}
                      </p>
                    </div>
                    <div style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      backgroundColor: '#FEF3C7',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: '14px',
                      color: '#B45309',
                      border: '1px solid #FCD34D',
                    }}>
                      P{sub.period_number}
                    </div>
                  </div>

                  {/* Absent Teacher Context */}
                  <div style={{ fontSize: '12px', color: H.textSec, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <UserCheck size={13} style={{ color: H.textMuted }} />
                    <span>Covering for: <strong>{sub.absence?.teacher?.full_name || 'Absent Teacher'}</strong></span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Main Timetable Shell ── */}
      <div style={{ backgroundColor: H.surface, border: `1px solid ${H.border}`, borderRadius: '16px', boxShadow: H.cardShadow, overflow: 'hidden' }}>

        {/* Contiguous Header Bar */}
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${H.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', backgroundColor: H.surface }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: H.purpleLight, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Calendar size={20} style={{ color: H.purpleDark }} />
            </div>
            <div>
              <h1 style={{ fontSize: '20px', fontWeight: 700, letterSpacing: '-0.02em', color: H.textPrimary, margin: 0 }}>My Weekly Timetable</h1>
              <p style={{ fontSize: '12.5px', color: H.textSec, margin: '2px 0 0', fontVariantNumeric: 'tabular-nums' }}>
                {schedule.length} regular periods assigned this week
              </p>
            </div>
          </div>
          <Badge variant="category"><Calendar size={13} style={{ marginRight: 4 }} /> Base Schedule</Badge>
        </div>

        {/* Day Selector Tabs for Mobile / Single Day Navigation */}
        <div style={{
          padding: '12px 16px',
          borderBottom: `1px solid ${H.border}`,
          backgroundColor: H.bg,
          display: 'flex',
          gap: '8px',
          alignItems: 'center',
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
        }}>
          {DAYS.map((dayName, idx) => {
            const dayNum = idx + 1
            const isSelected = selectedDay === dayNum
            const isToday = dayNum === today
            // Check if there are relief duties on this day of week for today
            const hasReliefToday = isToday && reliefDuties.some((r: any) => r.absence?.absence_date === todayStr)

            return (
              <button
                key={dayName}
                onClick={() => setSelectedDay(dayNum)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '10px',
                  border: `1px solid ${isSelected ? H.purple : H.border}`,
                  backgroundColor: isSelected ? H.purple : H.surface,
                  color: isSelected ? '#FFFFFF' : isToday ? H.purpleDark : H.textPrimary,
                  fontWeight: isSelected || isToday ? 700 : 500,
                  fontSize: '13px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: isSelected ? '0 2px 6px rgba(124, 58, 237, 0.25)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                <span>{isMobile ? DAY_SHORT[idx] : dayName}</span>
                {isToday && (
                  <span style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    padding: '1px 5px',
                    borderRadius: '6px',
                    backgroundColor: isSelected ? 'rgba(255,255,255,0.25)' : H.purpleLight,
                    color: isSelected ? '#FFFFFF' : H.purpleDark,
                  }}>
                    Today
                  </span>
                )}
                {hasReliefToday && (
                  <span style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    backgroundColor: '#F59E0B',
                    display: 'inline-block',
                  }} title="Relief duty today" />
                )}
              </button>
            )
          })}
        </div>

        {/* Single-Day View (Rendered on Mobile or when viewing single day) */}
        {isMobile ? (
          <div style={{ padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: H.textPrimary }}>
                {DAYS[selectedDay - 1]} Schedule
              </h2>
              <span style={{ fontSize: '12px', color: H.textSec, fontWeight: 600 }}>
                {schedule.filter(s => s.day_of_week === selectedDay).length} Regular Classes
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {periods.map((p, i) => {
                if (p.is_break) {
                  return (
                    <div key={`mob-break-${i}`} style={{
                      padding: '12px 16px',
                      borderRadius: '12px',
                      backgroundColor: H.bg,
                      border: `1px dashed ${H.border}`,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                    }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 8,
                        backgroundColor: H.accentLight, color: H.accentDark,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                      }}>
                        <Coffee size={16} />
                      </div>
                      <div>
                        <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: H.textSec }}>{(p as any).label || 'Break'}</p>
                        <p style={{ margin: '2px 0 0', fontSize: '11.5px', color: H.textMuted }}>{formatTime(p.start_time)} - {formatTime(p.end_time)}</p>
                      </div>
                    </div>
                  )
                }

                const slot = schedule.find((s: any) => s.day_of_week === selectedDay && s.period_number === p.period_number)
                const cellStyle = slot ? getSubjectStyle(slot.subject, slot.subject_color) : { background: H.surface, color: H.textSec, border: `1px solid ${H.border}` }

                // Check if selected day matches relief duty day of week
                const todayReliefForSlot = reliefDuties.find((r: any) => {
                  if (r.period_number !== p.period_number) return false
                  const rDay = r.absence?.absence_date ? dateToDayOfWeek(r.absence.absence_date) : 0
                  return rDay === selectedDay
                })

                return (
                  <div key={`mob-p-${p.period_number}`} style={{
                    padding: '14px 16px',
                    borderRadius: '12px',
                    backgroundColor: cellStyle.background,
                    border: cellStyle.border,
                    borderLeft: (cellStyle as any).borderLeft || cellStyle.border,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div style={{
                        width: 40, height: 40, borderRadius: 10,
                        backgroundColor: slot ? 'rgba(255,255,255,0.6)' : H.bg,
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0, border: `1px solid ${H.border}`
                      }}>
                        <span style={{ fontSize: '13px', fontWeight: 800, color: H.textPrimary }}>P{p.period_number}</span>
                      </div>
                      <div>
                        {slot ? (
                          <>
                            <p style={{ margin: 0, fontWeight: 800, fontSize: '14px', color: cellStyle.color }}>{slot.subject}</p>
                            <p style={{ margin: '2px 0 0', fontSize: '12px', fontWeight: 600, color: cellStyle.color, opacity: 0.85 }}>{slot.class?.name}</p>
                          </>
                        ) : (
                          <p style={{ margin: 0, fontWeight: 600, fontSize: '13px', color: H.textMuted }}>Free Period</p>
                        )}
                        {todayReliefForSlot && (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            marginTop: '4px',
                            fontSize: '11px',
                            fontWeight: 700,
                            color: '#B45309',
                            backgroundColor: '#FEF3C7',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            border: '1px solid #FCD34D',
                          }}>
                            <ShieldAlert size={11} /> Relief: {todayReliefForSlot.class?.name || ''} ({todayReliefForSlot.subject || ''})
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: H.textMuted }}>{formatTime(p.start_time)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          /* Full Weekly Grid with Sticky Left-0 Period Column for Desktop / Tablet */
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', padding: '12px' }}>
            <table style={{ width: '100%', minWidth: '750px', borderCollapse: 'separate', borderSpacing: '6px' }}>
              <thead>
                <tr>
                  <th style={{
                    position: 'sticky', left: 0, zIndex: 20,
                    backgroundColor: H.surface,
                    padding: '12px 14px',
                    fontSize: '12px',
                    fontWeight: 700,
                    color: H.textSec,
                    textAlign: 'center',
                    width: '100px',
                    minWidth: '100px',
                    borderRight: `2px solid ${H.border}`,
                    boxShadow: '2px 0 5px rgba(0,0,0,0.04)',
                  }}>
                    Period
                  </th>
                  {DAYS.map((day, i) => (
                    <th key={day} style={{
                      padding: '12px 14px',
                      fontSize: '13px',
                      fontWeight: 700,
                      color: i + 1 === today ? H.purpleDark : H.textSec,
                      textAlign: 'center',
                      backgroundColor: i + 1 === today ? H.purpleLight : 'transparent',
                      borderRadius: '10px',
                    }}>
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
                        <td style={{
                          position: 'sticky', left: 0, zIndex: 10,
                          backgroundColor: H.bg,
                          padding: '8px 12px',
                          verticalAlign: 'middle',
                          borderRight: `2px solid ${H.border}`,
                          boxShadow: '2px 0 5px rgba(0,0,0,0.04)',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                            <Coffee size={14} style={{ color: H.textMuted }} />
                            <div style={{ textAlign: 'center' }}>
                              <p style={{ margin: 0, fontSize: '11px', fontWeight: 700, color: H.textSec }}>{(p as any).label || 'Break'}</p>
                              <p style={{ margin: 0, fontSize: '10px', color: H.textMuted }}>{formatTime(p.start_time)}</p>
                            </div>
                          </div>
                        </td>
                        <td colSpan={5} style={{ padding: 0 }}>
                          <div style={{ height: '50px', background: H.bg, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span style={{ fontSize: '12px', color: H.textMuted, fontWeight: 500 }}>— {(p as any).label || 'Break'} ({formatTime(p.start_time)} - {formatTime(p.end_time)}) —</span>
                          </div>
                        </td>
                      </tr>
                    )
                  }

                  return (
                    <tr key={p.period_number}>
                      <td style={{
                        position: 'sticky', left: 0, zIndex: 10,
                        backgroundColor: H.surface,
                        padding: '8px 12px',
                        verticalAlign: 'middle',
                        borderRight: `2px solid ${H.border}`,
                        boxShadow: '2px 0 5px rgba(0,0,0,0.04)',
                      }}>
                        <div style={{ textAlign: 'center' }}>
                          <p style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: H.textPrimary }}>P{p.period_number}</p>
                          <p style={{ margin: 0, fontSize: '10.5px', color: H.textMuted, fontVariantNumeric: 'tabular-nums' }}>{formatTime(p.start_time)}</p>
                        </div>
                      </td>
                      {DAYS.map((_, dayIndex) => {
                        const dayNum = dayIndex + 1
                        const slot = schedule.find((s: any) => s.day_of_week === dayNum && s.period_number === p.period_number)
                        const cellStyle = slot ? getSubjectStyle(slot.subject, slot.subject_color) : { background: dayNum === today ? H.skyLight + '40' : H.bg, color: H.textSec, border: `1px solid ${H.border}` }

                        // Check if dayNum matches relief duty day of week
                        const reliefToday = reliefDuties.find((r: any) => {
                          if (r.period_number !== p.period_number) return false
                          const rDay = r.absence?.absence_date ? dateToDayOfWeek(r.absence.absence_date) : 0
                          return rDay === dayNum
                        })

                        return (
                          <td key={dayIndex} style={{ padding: '0', verticalAlign: 'top' }}>
                            <div style={{
                              minHeight: '80px',
                              height: '100%',
                              padding: '10px 12px',
                              borderRadius: '10px',
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'center',
                              background: cellStyle.background,
                              border: cellStyle.border,
                              borderLeft: (cellStyle as any).borderLeft || cellStyle.border,
                              boxSizing: 'border-box',
                            }}>
                              {slot ? (
                                <>
                                  <p style={{ color: cellStyle.color, fontWeight: 800, fontSize: '13.5px', margin: 0 }}>{slot.subject}</p>
                                  <p style={{ color: cellStyle.color, opacity: 0.8, fontSize: '11.5px', fontWeight: 600, margin: '3px 0 0' }}>{slot.class?.name}</p>
                                </>
                              ) : (
                                <p style={{ margin: 0, fontSize: '13px', color: H.textMuted, textAlign: 'center' }}>—</p>
                              )}

                              {reliefToday && (
                                <div style={{
                                  marginTop: '6px',
                                  padding: '4px 6px',
                                  borderRadius: '6px',
                                  backgroundColor: '#FEF3C7',
                                  border: '1px solid #FCD34D',
                                  fontSize: '10.5px',
                                  fontWeight: 700,
                                  color: '#B45309',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                }}>
                                  <ShieldAlert size={10} style={{ flexShrink: 0 }} />
                                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    Relief: {reliefToday.class?.name || ''} {reliefToday.absence?.absence_date ? `(${formatSLT(reliefToday.absence.absence_date, 'd MMM')})` : ''}
                                  </span>
                                </div>
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
        )}
      </div>
    </div>
  )
}



