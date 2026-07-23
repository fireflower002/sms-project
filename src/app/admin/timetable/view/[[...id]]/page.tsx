'use client'
import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2, Printer, Coffee, ChevronDown, AlertTriangle, CheckCircle2, Users, Calendar, BarChart2, TrendingUp, Star, Pencil, Filter } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { generatePeriods, formatTime } from '@/lib/utils'
import { H } from '@/lib/honey'
import { TimetableSkeleton } from '@/components/ui/Skeleton'

const card  = (x?:any):React.CSSProperties => ({ background:H.surface, borderRadius:16, border:`1px solid ${H.border}`, boxShadow:'0 2px 8px rgba(0,0,0,0.06)', overflow:'hidden', ...x })
const ghost = (x?:any):React.CSSProperties => ({ background:'#F5F5F4', color:H.muted, border:`1px solid ${H.border}`, borderRadius:8, fontFamily:H.font, fontWeight:600, fontSize:12, padding:'6px 12px', cursor:'pointer', display:'inline-flex', alignItems:'center', gap:5, textDecoration:'none', ...x })
const hBtn  = (x?:any):React.CSSProperties => ({ background:H.purple, color:'#FFFFFF', border:'none', borderRadius:10, fontFamily:H.font, fontWeight:700, fontSize:13, padding:'8px 16px', cursor:'pointer', display:'inline-flex', alignItems:'center', gap:6, textDecoration:'none', ...x })

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday']
const DAY_SHORT = ['Mon','Tue','Wed','Thu','Fri']
const PALETTE = ['#f59e0b','#8b5cf6','#ec4899','#ef4444','#f97316','#22c55e','#10b981','#06b6d4','#3b82f6','#a855f7','#d97706','#84cc16']

function subjectColor(s: string) { let h=0; for(let i=0;i<s.length;i++) h=s.charCodeAt(i)+((h<<5)-h); return PALETTE[Math.abs(h)%PALETTE.length] }
function hex2rgba(hex: string, a: number) { const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16); return `rgba(${r},${g},${b},${a})` }

export default function AdminTimetableViewPage() {
  const params   = useParams()
  const router   = useRouter()
  const supabase = createClient()
  const printRef = useRef<HTMLDivElement>(null)

  const rawId = params?.id
  const targetId = Array.isArray(rawId) ? rawId[0] : (typeof rawId === 'string' ? rawId : null)

  const [loading, setLoading]         = useState(true)
  const [templates, setTemplates]     = useState<any[]>([])
  const [template, setTemplate]       = useState<any>(null)
  const [classes, setClasses]         = useState<any[]>([])
  const [teachers, setTeachers]       = useState<any[]>([])
  const [schedule, setSchedule]       = useState<any[]>([])
  const [selectedDay, setSelectedDay] = useState(1)
  const [selectedGrades, setSelectedGrades] = useState<string[]>([])
  const [allGrades, setAllGrades]     = useState<string[]>([])
  const [tab, setTab]                 = useState<'timetable'|'gaps'>('timetable')
  const [showGradeDropdown, setShowGradeDropdown] = useState(false)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const [{ data: tmpls }, { data: cls }, { data: tchs }] = await Promise.all([
        supabase.from('timetable_templates').select('*').order('created_at', { ascending: false }),
        supabase.from('classes').select('*').eq('is_active', true).order('grade_level').order('name'),
        supabase.from('profiles').select('id,full_name,subjects').eq('role', 'teacher').eq('is_active', true).order('full_name'),
      ])

      const templateList = tmpls || []
      setTemplates(templateList)

      let currentTmpl: any = null
      if (targetId) {
        currentTmpl = templateList.find((t: any) => t.id === targetId) || null
      }
      if (!currentTmpl) {
        currentTmpl = templateList.find((t: any) => t.is_active) || templateList[0] || null
      }
      setTemplate(currentTmpl)

      if (currentTmpl) {
        const { data: asgn } = await supabase
          .from('schedule_assignments')
          .select('*,teacher:profiles!teacher_id(id,full_name)')
          .eq('template_id', currentTmpl.id)
          .order('day_of_week')
          .order('period_number')
        setSchedule(asgn || [])
      } else {
        setSchedule([])
      }

      setClasses(cls || [])
      setTeachers(tchs || [])
      const gs = Array.from(new Set((cls || []).map((c: any) => String(c.grade_level)))).sort((a, b) => Number(a) - Number(b))
      setAllGrades(gs)
      setSelectedGrades(gs) // Default to ALL grades
      setLoading(false)
    }
    load()
  }, [targetId])

  const handleTemplateChange = (newId: string) => {
    router.push(`/admin/timetable/view/${newId}`)
  }

  const toggleGradeFilter = (g: string) => {
    if (selectedGrades.includes(g)) {
      if (selectedGrades.length > 1) {
        setSelectedGrades(selectedGrades.filter(x => x !== g))
      }
    } else {
      setSelectedGrades([...selectedGrades, g].sort((a, b) => Number(a) - Number(b)))
    }
  }

  const selectAllGrades = () => setSelectedGrades(allGrades)

  const periods         = template ? generatePeriods(template.start_time, template.end_time, template.period_duration, template.breaks || []) : []
  const teachingPeriods = periods.filter((p: any) => !p.is_break)
  const getSlot         = (classId: string, day: number, period: number) => schedule.find(a => a.class_id === classId && a.day_of_week === day && a.period_number === period)
  
  const filteredClasses = classes.filter(c => selectedGrades.includes(String(c.grade_level)))

  const gapsAnalysis = () => {
    if (!template) return { unassigned: [] as any[], idleTeachers: [] as any[], summary: null }
    const unassigned: any[] = []
    for (const cls of classes) {
      for (let day = 1; day <= 5; day++) {
        for (const p of teachingPeriods) {
          if (!schedule.find(a => a.class_id === cls.id && a.day_of_week === day && a.period_number === p.period_number)) {
            unassigned.push({ day, period: p.period_number, className: cls.name, classId: cls.id })
          }
        }
      }
    }
    const idleTeachers: any[] = []
    for (let day = 1; day <= 5; day++) {
      const busyIds = new Set(schedule.filter((a: any) => a.day_of_week === day).map((a: any) => a.teacher_id))
      const idle = teachers.filter(t => !busyIds.has(t.id))
      if (idle.length > 0) idleTeachers.push({ day, teachers: idle })
    }
    const totalSlots = classes.length * 5 * teachingPeriods.length
    const filledSlots = totalSlots - unassigned.length
    const pct = totalSlots > 0 ? Math.round((filledSlots / totalSlots) * 100) : 0
    return { unassigned, idleTeachers, summary: { totalSlots, filledSlots, unassigned: unassigned.length, pct } }
  }

  const { unassigned, idleTeachers, summary } = gapsAnalysis()
  const unassignedByDay: Record<number, any[]> = {}
  for (const u of unassigned) {
    if (!unassignedByDay[u.day]) unassignedByDay[u.day] = []
    unassignedByDay[u.day].push(u)
  }

  const handlePrint = () => {
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`<html><head><title>Full School Timetable - ${template?.name || 'Schedule'}</title><style>*{box-sizing:border-box}body{font-family:sans-serif;font-size:10px;padding:12px;background:#fff;color:#000}table{width:100%;border-collapse:collapse}th,td{border:1px solid #e2e8f0;padding:5px 6px;text-align:center}th{background:#f8fafc;font-size:9px;font-weight:700;color:#64748b}</style></head><body>${printRef.current?.innerHTML || ''}<script>window.print();window.close()<\/script></body></html>`)
    win.document.close()
  }

  if (loading) return <TimetableSkeleton />

  return (
    <div style={{ minHeight: '100vh', background: H.bg, fontFamily: H.font, color: H.text, padding: 'clamp(16px, 3vw, 28px)', boxSizing: 'border-box' }}>
      <div style={{ backgroundColor: H.surface, border: `1px solid ${H.border}`, borderRadius: 16, boxShadow: H.cardShadow, overflow: 'hidden' }}>

        {/* Contiguous Header — Back arrow removed (navigation in sidebar) */}
        <header style={{ borderBottom: `1px solid ${H.border}`, background: H.surface, padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: H.purpleLight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Calendar size={20} style={{ color: H.purpleDark }} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h1 style={{ fontFamily: H.font, fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', color: H.text, margin: 0 }}>
                  Full School Timetable
                </h1>
                {template?.is_active && (
                  <span style={{ background: 'rgba(238,189,43,0.15)', color: H.honey, border: `1px solid ${H.honey}`, borderRadius: 12, padding: '2px 8px', fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Star size={10} fill={H.honey} /> Active
                  </span>
                )}
              </div>
              <p style={{ fontFamily: H.font, fontSize: 13, color: H.muted, margin: '4px 0 0 0', fontVariantNumeric: 'tabular-nums' }}>
                {template?.name || 'Master Schedule'} • {filteredClasses.length} of {classes.length} classes shown • {teachingPeriods.length} periods per day
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {templates.length > 1 && (
              <div style={{ position: 'relative' }}>
                <select
                  value={template?.id || ''}
                  onChange={(e) => handleTemplateChange(e.target.value)}
                  style={{ padding: '7px 28px 7px 12px', background: H.surface, border: `1px solid ${H.border}`, borderRadius: 8, color: H.textPrimary, fontFamily: H.font, fontWeight: 600, fontSize: 12, outline: 'none', cursor: 'pointer', appearance: 'none' }}
                >
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name} {t.is_active ? '(Active)' : ''}
                    </option>
                  ))}
                </select>
                <ChevronDown size={12} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: H.sub }} />
              </div>
            )}
            {template && (
              <Link href={`/admin/timetable/${template.id}/build`} style={hBtn()}>
                <Pencil size={14} /> Edit Schedule
              </Link>
            )}
            {tab === 'timetable' && (
              <button onClick={handlePrint} style={ghost()}><Printer size={13} /> Print Schedule</button>
            )}
          </div>
        </header>

        {/* Contiguous Tabs Bar */}
        <div style={{ display: 'flex', padding: '0 24px', borderBottom: `1px solid ${H.border}`, backgroundColor: '#FAF9F6' }}>
          {([['timetable', 'Weekly Timetable Matrix'], ['gaps', 'Gaps & Conflict Analysis']] as const).map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} style={{
              padding: '12px 18px', fontFamily: H.font, fontSize: 14, fontWeight: 600,
              borderBottom: tab === key ? `3px solid ${H.honey}` : '3px solid transparent',
              color: tab === key ? H.honey : H.sub, background: 'none', border: 'none',
              cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 8,
            }}>
              {label}
              {key === 'gaps' && summary && summary.unassigned > 0 && (
                <span style={{ background: '#ef4444', color: 'white', borderRadius: 10, padding: '1px 8px', fontSize: 11, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{summary.unassigned}</span>
              )}
            </button>
          ))}
        </div>

        <main style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* ── TIMETABLE TAB ── */}
          {tab === 'timetable' && <>
            {/* Day + Grade Filter Controls Toolbar */}
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderRadius: 10, background: '#FAF9F6', border: `1px solid ${H.border}` }}>
              
              {/* Day selection tabs */}
              <div style={{ display: 'flex', border: `1px solid ${H.border}`, borderRadius: 8, overflow: 'hidden', backgroundColor: H.surface }}>
                {DAYS.map((d, i) => (
                  <button key={d} onClick={() => setSelectedDay(i + 1)}
                    style={{ padding: '7px 14px', fontFamily: H.font, fontWeight: 600, fontSize: 12, cursor: 'pointer', border: 'none', borderRight: i < 4 ? `1px solid ${H.border}` : 'none', background: selectedDay === i + 1 ? H.honey : H.surface, color: selectedDay === i + 1 ? '#FFFFFF' : H.textSec }}>
                    {DAY_SHORT[i]}
                  </button>
                ))}
              </div>

              {/* Multi-Grade Checkbox / Pill Filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: H.sub, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Filter size={13} /> Filter Grades:
                </span>
                <button
                  onClick={selectAllGrades}
                  style={{
                    padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                    border: `1px solid ${selectedGrades.length === allGrades.length ? H.purple : H.border}`,
                    background: selectedGrades.length === allGrades.length ? H.purpleLight : H.surface,
                    color: selectedGrades.length === allGrades.length ? H.purpleDark : H.textSec
                  }}
                >
                  All Grades
                </button>
                {allGrades.map(g => {
                  const isChecked = selectedGrades.includes(g)
                  return (
                    <button
                      key={g}
                      onClick={() => toggleGradeFilter(g)}
                      style={{
                        padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        border: `1px solid ${isChecked ? H.honey : H.border}`,
                        background: isChecked ? 'rgba(238,189,43,0.15)' : H.surface,
                        color: isChecked ? H.honey : H.textSec,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        style={{ cursor: 'pointer', accentColor: H.honey }}
                      />
                      Grade {g}
                    </button>
                  )
                })}
              </div>
            </div>

            {!template ? (
              <div style={{ padding: 48, textAlign: 'center' }}>
                <Calendar size={32} style={{ color: H.muted, marginBottom: 10 }} />
                <p style={{ fontFamily: H.font, fontSize: 14, color: H.sub }}>No timetable template found. Create one in the Timetable section.</p>
              </div>
            ) : filteredClasses.length === 0 ? (
              <div style={card({ padding: 48, textAlign: 'center' })}>
                <p style={{ fontFamily: H.font, fontSize: 14, color: H.sub }}>No classes match the selected grade filter.</p>
                <button onClick={selectAllGrades} style={{ ...ghost(), marginTop: 12 }}>Reset Grade Filter</button>
              </div>
            ) : (
              <div ref={printRef}>
                {DAYS.map((dayName, di) => {
                  const dayNum = di + 1; if (dayNum !== selectedDay) return null
                  return (
                    <div key={dayNum} style={card()}>
                      <div style={{ padding: '12px 18px', background: '#F5F5F4', display: 'flex', alignItems: 'center', gap: 10, borderBottom: `3px solid ${H.border}` }}>
                        <span style={{ fontFamily: H.font, fontWeight: 900, fontSize: 16, color: H.honey }}>{dayName}</span>
                        <span style={{ fontFamily: H.font, fontSize: 11, color: H.sub, marginLeft: 'auto' }}>{filteredClasses.length} classes displayed</span>
                      </div>

                      {/* Period x Class Matrix Table with Sticky Period Column */}
                      <div style={{ overflowX: 'auto', position: 'relative' }}>
                        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 12, minWidth: `${120 + filteredClasses.length * 100}px` }}>
                          <thead>
                            <tr style={{ background: '#F5F5F4' }}>
                              {/* STICKY LEFT-0 PERIOD COLUMN HEADER */}
                              <th style={{
                                position: 'sticky', left: 0, zIndex: 20,
                                background: '#F5F5F4', padding: '10px 14px', textAlign: 'left',
                                fontFamily: H.font, fontSize: 10, fontWeight: 900, color: H.sub,
                                textTransform: 'uppercase', letterSpacing: '0.05em', width: 90,
                                borderRight: `2px solid ${H.border}`, borderBottom: `1px solid ${H.border}`
                              }}>
                                Period
                              </th>
                              {filteredClasses.map((cls: any) => (
                                <th key={cls.id} style={{
                                  padding: '10px 8px', textAlign: 'center', fontFamily: H.font,
                                  fontSize: 11, fontWeight: 800, color: H.muted, minWidth: 100,
                                  borderBottom: `1px solid ${H.border}`
                                }}>
                                  {cls.name}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {periods.map((p: any, pi: number) => (
                              <tr key={pi}>
                                {p.is_break ? (
                                  <>
                                    {/* STICKY BREAK LABEL FOR PERIOD COLUMN */}
                                    <td style={{
                                      position: 'sticky', left: 0, zIndex: 10,
                                      background: '#FFFBEB', padding: '8px 14px',
                                      fontFamily: H.font, fontWeight: 800, fontSize: 11, color: H.honey,
                                      borderRight: `2px solid ${H.border}`, borderTop: `1px solid ${H.border}`
                                    }}>
                                      <Coffee size={11} style={{ display: 'inline', marginRight: 4 }} /> Break
                                    </td>
                                    <td colSpan={filteredClasses.length} style={{ padding: '8px 14px', fontFamily: H.font, fontSize: 11, color: H.honey, background: 'rgba(238,189,43,0.06)', textAlign: 'center', fontStyle: 'italic', borderTop: `1px solid ${H.border}` }}>
                                      {p.break_label} · {formatTime(p.start_time)} – {formatTime(p.end_time)}
                                    </td>
                                  </>
                                ) : (
                                  <>
                                    {/* STICKY LEFT-0 PERIOD COLUMN CELL */}
                                    <td style={{
                                      position: 'sticky', left: 0, zIndex: 10,
                                      background: '#F5F5F4', padding: '8px 14px',
                                      fontFamily: H.font, fontWeight: 800, fontSize: 11, color: H.muted,
                                      whiteSpace: 'nowrap', borderRight: `2px solid ${H.border}`, borderTop: `1px solid ${H.border}`
                                    }}>
                                      P{p.period_number}<br />
                                      <span style={{ fontSize: 9, fontFamily: 'monospace', fontWeight: 400, color: H.sub }}>{formatTime(p.start_time)}</span>
                                    </td>

                                    {filteredClasses.map((cls: any) => {
                                      const slot = getSlot(cls.id, dayNum, p.period_number)
                                      const color = slot ? (slot.subject_color || subjectColor(slot.subject || '')) : null
                                      return (
                                        <td key={cls.id} style={{ padding: 4, verticalAlign: 'middle', borderTop: `1px solid ${H.border}` }}>
                                          {slot ? (
                                            /* FILLED PERIOD CELL */
                                            <div style={{ borderRadius: 8, overflow: 'hidden', border: `1px solid ${color}` }}>
                                              <div style={{ background: color!, padding: '4px 6px' }}>
                                                <div style={{ fontFamily: H.font, fontSize: 10, fontWeight: 800, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{slot.subject}</div>
                                              </div>
                                              <div style={{ padding: '3px 6px', background: hex2rgba(color!, 0.12) }}>
                                                <div style={{ fontFamily: H.font, fontSize: 9, color: H.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                  {slot.teacher?.full_name?.split(' ').slice(-1)[0] || 'Teacher'}
                                                </div>
                                              </div>
                                            </div>
                                          ) : (
                                            /* VISUALLY DE-EMPHASIZED EMPTY CELL */
                                            <div style={{ height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, background: '#FAF9F6', border: `1px dashed ${H.border}` }}>
                                              <span style={{ fontFamily: H.font, fontSize: 10, color: H.sub, fontStyle: 'italic' }}>—</span>
                                            </div>
                                          )}
                                        </td>
                                      )
                                    })}
                                  </>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>}

          {/* ── GAPS TAB ── */}
          {tab === 'gaps' && <>
            {!template ? (
              <div style={card({ padding: 48, textAlign: 'center' })}><p style={{ fontFamily: H.font, fontSize: 14, color: H.sub }}>No timetable template found.</p></div>
            ) : <>
              {summary && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12 }}>
                  {[
                    { label: 'Total Slots', value: summary.totalSlots, icon: <BarChart2 size={20} color="#a78bfa" />, color: '#a78bfa' },
                    { label: 'Filled', value: summary.filledSlots, icon: <CheckCircle2 size={20} color={H.grass} />, color: H.grass },
                    { label: 'Unassigned', value: summary.unassigned, icon: summary.unassigned > 0 ? <AlertTriangle size={20} color="#f87171" /> : <CheckCircle2 size={20} color={H.grass} />, color: summary.unassigned > 0 ? '#f87171' : H.grass },
                    { label: 'Coverage', value: `${summary.pct}%`, icon: <TrendingUp size={20} color={summary.pct === 100 ? H.grass : summary.pct > 80 ? H.honey : '#f87171'} />, color: summary.pct === 100 ? H.grass : summary.pct > 80 ? H.honey : '#f87171' },
                  ].map(s => (
                    <div key={s.label} style={card({ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 12 })}>
                      <div style={{ width: 42, height: 42, borderRadius: 12, background: `${s.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{s.icon}</div>
                      <div>
                        <div style={{ fontFamily: H.font, fontSize: 26, fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.value}</div>
                        <div style={{ fontFamily: H.font, fontSize: 10, fontWeight: 700, color: H.sub, textTransform: 'uppercase', letterSpacing: '0.07em', marginTop: 2 }}>{s.label}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Unassigned */}
              <div style={card()}>
                <div style={{ padding: '12px 18px', borderBottom: `2px solid ${H.border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AlertTriangle size={16} color={H.honey} />
                  <span style={{ fontFamily: H.font, fontWeight: 900, fontSize: 15, color: H.honey }}>Unassigned Periods</span>
                  {summary && <span style={{ fontFamily: H.font, fontSize: 12, color: H.sub }}>{summary.unassigned} slots need a teacher</span>}
                </div>
                {unassigned.length === 0 ? (
                  <div style={{ padding: 32, textAlign: 'center' }}>
                    <CheckCircle2 size={28} color={H.grass} style={{ marginBottom: 8 }} />
                    <p style={{ fontFamily: H.font, fontSize: 13, fontWeight: 700, color: H.grass }}>All periods are covered!</p>
                  </div>
                ) : DAYS.map((dayName, di) => {
                  const dayNum = di + 1, slots = unassignedByDay[dayNum]
                  if (!slots || slots.length === 0) return null
                  return (
                    <div key={dayNum} style={{ borderBottom: `1px solid #F5F5F4` }}>
                      <div style={{ padding: '8px 18px', background: '#F5F5F4', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontFamily: H.font, fontWeight: 800, fontSize: 13, color: H.honey }}>{dayName}</span>
                        <span style={{ background: '#ef4444', color: '#fff', borderRadius: 10, padding: '0 7px', fontSize: 10, fontWeight: 900 }}>{slots.length}</span>
                      </div>
                      <div style={{ padding: '10px 18px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {slots.map((s: any, i: number) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
                            <span style={{ fontFamily: H.font, fontSize: 10, fontWeight: 900, color: '#f87171' }}>P{s.period}</span>
                            <span style={{ fontFamily: H.font, fontSize: 11, fontWeight: 600, color: H.text }}>{s.className}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Idle teachers */}
              <div style={card()}>
                <div style={{ padding: '12px 18px', borderBottom: `2px solid ${H.border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Users size={16} color={H.honey} />
                  <span style={{ fontFamily: H.font, fontWeight: 900, fontSize: 15, color: H.honey }}>Teachers with No Classes</span>
                </div>
                {idleTeachers.length === 0 ? (
                  <div style={{ padding: 32, textAlign: 'center' }}>
                    <CheckCircle2 size={28} color={H.grass} style={{ marginBottom: 8 }} />
                    <p style={{ fontFamily: H.font, fontSize: 13, fontWeight: 700, color: H.grass }}>Every teacher has at least one class each day.</p>
                  </div>
                ) : idleTeachers.map(({ day, teachers: idle }: any) => (
                  <div key={day} style={{ borderBottom: `1px solid #F5F5F4` }}>
                    <div style={{ padding: '8px 18px', background: '#F5F5F4', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontFamily: H.font, fontWeight: 800, fontSize: 13, color: H.honey }}>{DAYS[day - 1]}</span>
                      <span style={{ background: '#fb923c', color: '#fff', borderRadius: 10, padding: '0 7px', fontSize: 10, fontWeight: 900 }}>{idle.length}</span>
                    </div>
                    <div style={{ padding: '10px 18px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {idle.map((t: any) => (
                        <Link key={t.id} href={`/admin/teachers/${t.id}`}
                          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 8, background: 'rgba(251,146,60,0.08)', border: '1px solid rgba(251,146,60,0.25)', textDecoration: 'none' }}>
                          <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#fb923c', color: '#fff', fontWeight: 900, fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{t.full_name.charAt(0)}</div>
                          <span style={{ fontFamily: H.font, fontSize: 11, fontWeight: 600, color: H.text }}>{t.full_name}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>}
          </>}
        </main>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}*{box-sizing:border-box}::-webkit-scrollbar{width:5px}::-webkit-scrollbar-thumb{background:rgba(238,189,43,0.3);border-radius:99px}`}</style>
    </div>
  )
}
