'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Clock, Star, Coffee, Loader2, CalendarDays, Plus, Trash2, Pencil, Check, X, Calendar, Eye, GraduationCap, CheckCircle2, Sparkles, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { generatePeriods, formatTime, SHORT_DAY_NAMES } from '@/lib/utils'

import { H } from '@/lib/honey'
import ConfirmModal, { ConfirmModalState } from '@/components/ui/ConfirmModal'

const card  = (x?:any):React.CSSProperties => ({ background:H.surface, borderRadius:16, border:`1px solid ${H.border}`, boxShadow:'0 2px 8px rgba(0,0,0,0.06)', overflow:'hidden', ...x })
const ghost = (x?:any):React.CSSProperties => ({ background:'#F5F5F4', color:H.muted, border:`1px solid ${H.border}`, borderRadius:8, fontFamily:H.font, fontWeight:600, fontSize:12, padding:'6px 12px', cursor:'pointer', display:'inline-flex', alignItems:'center', gap:5, textDecoration:'none', ...x })
const hBtn  = (x?:any):React.CSSProperties => ({ background:H.purple, color:'#FFFFFF', border:'none', borderRadius:10, fontFamily:H.font, fontWeight:700, fontSize:13, padding:'8px 16px', cursor:'pointer', display:'inline-flex', alignItems:'center', gap:6, textDecoration:'none', ...x })
const gBtn  = (x?:any):React.CSSProperties => ({ background:H.grass, color:'#FFFFFF', border:'none', borderRadius:10, fontFamily:H.font, fontWeight:700, fontSize:13, padding:'8px 16px', cursor:'pointer', display:'inline-flex', alignItems:'center', gap:6, textDecoration:'none', ...x })

const WORK_DAYS = [1,2,3,4,5]
const LETTERS   = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const ALL_GRADES = Array.from({length:13},(_,i)=>i+1)
const GRADE_COLORS = ['#f59e0b','#8b5cf6','#ec4899','#ef4444','#f97316','#22c55e','#10b981','#06b6d4','#3b82f6','#a855f7','#d97706','#84cc16','#f43f5e']
const gc = (g:number) => GRADE_COLORS[(g-1)%GRADE_COLORS.length]

export default function TemplateDetailPage() {
  const params   = useParams()
  const router   = useRouter()
  const supabase = createClient()
  const id       = params.id as string

  const [template, setTemplate]           = useState<any>(null)
  const [classes, setClasses]             = useState<any[]>([])
  const [assignments, setAssignments]     = useState<any[]>([])
  const [teachers, setTeachers]           = useState<any[]>([])
  const [selectedClass, setSelectedClass] = useState('')
  const [activeGradeModal, setActiveGradeModal] = useState<number | null>(null)
  const [modalSelectedClass, setModalSelectedClass] = useState('')
  const [loading, setLoading]             = useState(true)
  const [activating, setActivating]       = useState(false)
  const [toast, setToast]                 = useState<{msg:string;ok:boolean}|null>(null)
  const [modal, setModal]                 = useState<ConfirmModalState | null>(null)

  const flash = (msg:string, ok=true) => { setToast({msg,ok}); setTimeout(()=>setToast(null),3000) }

  const fetchData = async () => {
    setLoading(true)
    const [{ data:tmpl },{ data:cls },{ data:assign },{ data:tchr }] = await Promise.all([
      supabase.from('timetable_templates').select('*').eq('id',id).single(),
      supabase.from('classes').select('*').eq('is_active',true).order('grade_level').order('name'),
      supabase.from('schedule_assignments').select('*, teacher:profiles(full_name)').eq('template_id',id),
      supabase.from('profiles').select('id,full_name').eq('role','teacher').eq('is_active',true).order('full_name'),
    ])
    if (!tmpl) { router.push('/admin/timetable'); return }
    setTemplate(tmpl); setClasses(cls||[]); setAssignments(assign||[]); setTeachers(tchr||[])
    if (cls&&cls.length>0&&!selectedClass) setSelectedClass(cls[0].id)
    setLoading(false)
  }
  useEffect(() => { fetchData() }, [id])

  const byGrade:Record<number,any[]> = {}
  classes.forEach(c=>{ if(!byGrade[c.grade_level]) byGrade[c.grade_level]=[]; byGrade[c.grade_level].push(c) })
  const usedGrades   = Object.keys(byGrade).map(Number).sort((a,b)=>a-b)
  const unusedGrades = ALL_GRADES.filter(g=>!usedGrades.includes(g))
  const incompleteClassesCount = classes.filter(c => !c.class_teacher_id || !c.class_teacher_subject).length

  const handleSetActive = async () => {
    setActivating(true)
    await supabase.from('timetable_templates').update({is_active:false}).not('id','is',null)
    await supabase.from('timetable_templates').update({is_active:true}).eq('id',id)
    fetchData(); setActivating(false)
  }

  if (loading) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:H.bg }}>
      <Loader2 size={22} style={{ color:H.purple, animation:'spin 0.7s linear infinite' }}/>
    </div>
  )
  if (!template) return null

  const periods        = generatePeriods(template.start_time, template.end_time, template.period_duration, template.breaks||[])
  const actualPeriods  = periods.filter((p:any)=>!p.is_break)
  const totalCells     = actualPeriods.length * WORK_DAYS.length

  const getAssignment  = (classId:string, periodNum:number, day:number) => assignments.find(a=>a.class_id===classId&&a.period_number===periodNum&&a.day_of_week===day)

  const colorPalette = [H.honey,'#8b5cf6','#ec4899','#f97316','#06b6d4','#22c55e','#10b981','#3b82f6','#a855f7','#ef4444']
  const teacherColors:Record<string,string> = {}
  teachers.forEach((t,i)=>{ teacherColors[t.id]=colorPalette[i%colorPalette.length] })

  const openGradeTimetable = (grade: number) => {
    const gradeClasses = byGrade[grade] || []
    setActiveGradeModal(grade)
    setModalSelectedClass(gradeClasses[0]?.id || '')
  }

  return (
    <div style={{ minHeight:'100vh', background:H.bg, fontFamily:H.font, color:H.text, padding:'clamp(16px, 3vw, 28px)', boxSizing:'border-box' }}>
      <div style={{ backgroundColor:H.surface, border:`1px solid ${H.border}`, borderRadius:16, boxShadow:H.cardShadow, overflow:'hidden' }}>

        {/* Header — Clean icon navigation */}
        <header style={{ padding:'20px 24px', display:'flex', alignItems:'center', justifyContent:'space-between', borderBottom:`1px solid ${H.border}`, background:H.surface, flexWrap:'wrap', gap:12 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: H.purpleLight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Calendar size={20} style={{ color: H.purpleDark }} />
            </div>
            <div>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <h1 style={{ fontFamily:H.font, fontSize:22, fontWeight:600, letterSpacing:'-0.02em', color:H.text, margin:0 }}>{template.name}</h1>
                {template.is_active && (
                  <span style={{ background:'rgba(238,189,43,0.15)', color:H.honey, border:`1px solid ${H.honey}`, borderRadius:12, padding:'2px 8px', fontFamily:H.font, fontWeight:700, fontSize:11, display:'inline-flex', alignItems:'center', gap:4 }}>
                    <Star size={11} fill={H.honey}/> Active
                  </span>
                )}
              </div>
              <p style={{ fontFamily:H.font, fontSize:13, color:H.muted, margin:'4px 0 0' }}>
                {actualPeriods.length} periods per day · {formatTime(template.start_time)} – {formatTime(template.end_time)} · {classes.length} active classes
              </p>
            </div>
          </div>
          <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
            {!template.is_active && (
              <button onClick={handleSetActive} disabled={activating} style={hBtn({ padding:'8px 16px', fontSize:13 })}>
                {activating ? <Loader2 size={13} style={{ animation:'spin 0.7s linear infinite' }}/> : <><Star size={13}/> Set Active</>}
              </button>
            )}
            <Link href={`/admin/timetable/view/${id}`} style={ghost({ padding:'8px 14px', fontSize:13 })}>
              <Calendar size={14} /> Full School Timetable
            </Link>
            <Link href={`/admin/timetable/${id}/build`} style={gBtn({ padding:'8px 16px', fontSize:13 })}>
              <Pencil size={14} /> Build Schedule →
            </Link>
          </div>
        </header>

        {/* Toast */}
        {toast && <div style={{ position:'fixed', top:80, left:'50%', transform:'translateX(-50%)', zIndex:9999, padding:'8px 20px', borderRadius:12, background:toast.ok?H.grass:'#ef4444', color:'#fff', fontFamily:H.font, fontSize:13, fontWeight:700, boxShadow:`0 4px 12px rgba(0,0,0,0.15)`, border:`1px solid ${H.border}`, whiteSpace:'nowrap', pointerEvents:'none' }}>{toast.msg}</div>}

        <main style={{ padding:'24px', display:'flex', flexDirection:'column', gap:20 }}>

          {/* Step 2 Guidance Banner: When classes exist but schedule assignments are not built yet */}
          {classes.length > 0 && assignments.length === 0 && (
            <div style={{ padding: '16px 20px', borderRadius: 14, background: '#F3E8FF', border: `1px solid #E9D5FF`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flex: 1, minWidth: 280 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: H.purple, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Sparkles size={18} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                    <span style={{ fontSize: 10, fontWeight: 800, color: H.purpleDark, background: '#E9D5FF', padding: '2px 8px', borderRadius: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Step 2 of 2
                    </span>
                    <h3 style={{ fontFamily: H.font, fontSize: 15, fontWeight: 700, color: H.textPrimary, margin: 0 }}>
                      Next Step: Build your schedule
                    </h3>
                  </div>
                  <p style={{ fontFamily: H.font, fontSize: 13, color: H.textSec, margin: 0, lineHeight: 1.4 }}>
                    Your timetable template and classes are set up. Now populate subject assignments into period slots across classes.
                  </p>
                  {incompleteClassesCount > 0 && (
                    <div style={{ marginTop: 8, fontSize: 12, color: '#9A3412', background: '#FFF7ED', border: '1px solid #FFEDD5', padding: '4px 10px', borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                      <AlertTriangle size={13} style={{ color: '#C2410C' }} />
                      Tip: {incompleteClassesCount} class{incompleteClassesCount !== 1 ? 'es are' : ' is'} missing a Class Teacher. You can assign them in <Link href="/admin/classes" style={{ color: '#C2410C', fontWeight: 700, textDecoration: 'underline' }}>Classes Directory</Link> or proceed directly to builder.
                    </div>
                  )}
                </div>
              </div>
              <Link href={`/admin/timetable/${id}/build`} style={gBtn({ padding: '10px 18px', fontSize: 13, textDecoration: 'none', flexShrink: 0 })}>
                Build Schedule →
              </Link>
            </div>
          )}

          {/* Stats Bar */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:12 }}>
            {[
              { label:'Periods/Day', value:actualPeriods.length, color:'#60a5fa' },
              { label:'Breaks',      value:(template.breaks||[]).length, color:H.honey },
              { label:'Total Classes', value:classes.length, color:H.grass },
              { label:'Teachers',    value:teachers.length, color:'#a78bfa' },
            ].map(s=>(
              <div key={s.label} style={card({ padding:'16px 18px' })}>
                <div style={{ fontFamily:H.font, fontSize:26, fontWeight:900, color:s.color, lineHeight:1, letterSpacing:'-0.03em' }}>{s.value}</div>
                <div style={{ fontFamily:H.font, fontSize:10, fontWeight:700, color:H.sub, textTransform:'uppercase', letterSpacing:'0.07em', marginTop:4 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Grades Summary Grid */}
          <div>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
              <div>
                <h2 style={{ fontFamily:H.font, fontWeight:700, fontSize:16, color:H.text, margin:0 }}>Grade Summaries</h2>
                <p style={{ fontFamily:H.font, fontSize:12, color:H.sub, margin:'2px 0 0' }}>Overview of schedule coverage per grade level</p>
              </div>
              <Link href="/admin/classes" style={{ ...ghost({ padding:'6px 14px', fontSize:12 }), background:H.surface, color:H.purple, borderColor:H.purple }}>
                <GraduationCap size={14}/> Manage Grades & Classes →
              </Link>
            </div>

            {usedGrades.length===0 ? (
              <div style={card({ padding:'48px 24px', textAlign:'center' })}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: H.purpleLight, color: H.purpleDark, padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
                  Step 1 of 2
                </div>
                <GraduationCap size={40} style={{ color: H.purple, display: 'block', margin: '0 auto 12px', opacity: 0.8 }} />
                <h3 style={{ fontFamily: H.font, fontSize: 18, fontWeight: 700, color: H.text, margin: '0 0 6px' }}>Next Step: Set up your classes</h3>
                <p style={{ fontFamily: H.font, fontSize: 13, color: H.sub, margin: '0 0 20px', maxWidth: 460, marginLeft: 'auto', marginRight: 'auto' }}>
                  Classes and Class Teachers must be configured in the master directory before building your schedule.
                </p>
                <Link href="/admin/classes" style={{ ...hBtn({ display: 'inline-flex', width: 'auto' }), padding: '10px 20px', fontSize: 13 }}>
                  <GraduationCap size={15} /> Go to Classes Directory →
                </Link>
              </div>
            ) : (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(320px, 1fr))', gap:16 }}>
                {usedGrades.map(grade=>{
                  const gradeClasses=(byGrade[grade]||[]).sort((a:any,b:any)=>a.name.localeCompare(b.name))
                  const color=gc(grade)
                  const unassignedCount = gradeClasses.filter((c:any) => !c.class_teacher_id || !c.class_teacher_subject).length

                  // Calculate overall grade progress
                  const totalGradeCells = gradeClasses.length * totalCells
                  const filledGradeCells = gradeClasses.reduce((acc, cls) => acc + assignments.filter(a=>a.class_id===cls.id).length, 0)
                  const gradePct = totalGradeCells > 0 ? Math.round((filledGradeCells / totalGradeCells) * 100) : 0

                  return (
                    <div key={grade} style={card({ border: `1px solid ${H.border}` })}>
                      {/* Grade header */}
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 16px', background:`${color}12`, borderBottom:`2px solid ${color}30` }}>
                        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                          <div style={{ width:36, height:36, borderRadius:10, background:color, color:'#fff', fontWeight:900, fontSize:16, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{grade}</div>
                          <div>
                            <div style={{ fontFamily:H.font, fontWeight:800, fontSize:15, color:H.text }}>Grade {grade}</div>
                            <div style={{ fontFamily:H.font, fontSize:11, color:H.sub }}>{gradeClasses.length} class{gradeClasses.length!==1?'es':''}</div>
                          </div>
                        </div>
                        {unassignedCount > 0 && (
                          <div style={{ fontSize:11, fontWeight:700, color:H.danger, background:'rgba(239,68,68,0.12)', padding:'3px 8px', borderRadius:6, border:'1px solid rgba(239,68,68,0.25)', display:'flex', alignItems:'center', gap:4 }} title="Missing Class Teacher assignment">
                            ⚠️ {unassignedCount} missing teacher
                          </div>
                        )}
                      </div>

                      {/* Grade Progress Bar */}
                      <div style={{ padding:'12px 16px 8px', borderBottom:`1px solid ${H.border}`, background:H.surface }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:11, fontFamily:H.font, fontWeight:600, color:H.sub, marginBottom:6 }}>
                          <span>Schedule Progress</span>
                          <span style={{ color: gradePct === 100 ? H.grass : H.text, fontWeight: 700 }}>{gradePct}% filled</span>
                        </div>
                        <div style={{ height:6, borderRadius:3, background:`#E5E7EB`, overflow:'hidden' }}>
                          <div style={{ height:'100%', borderRadius:3, width:`${gradePct}%`, background:gradePct===100?H.grass:color, transition:'width 0.3s ease' }}/>
                        </div>
                      </div>

                      {/* Class List Summary */}
                      <div style={{ padding:'12px 16px', display:'flex', flexDirection:'column', gap:6, maxHeight:180, overflowY:'auto' }}>
                        {gradeClasses.map((cls:any, idx:number)=>{
                          const filled = assignments.filter(a=>a.class_id===cls.id).length
                          const pct = totalCells>0?Math.round((filled/totalCells)*100):0
                          const isUnassigned = !cls.class_teacher_id || !cls.class_teacher_subject
                          return (
                            <div key={cls.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'6px 10px', borderRadius:8, background:'#FAF9F6', border:`1px solid ${H.border}` }}>
                              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                                <div style={{ width:22, height:22, borderRadius:6, background:color, color:'#fff', fontWeight:800, fontSize:11, display:'flex', alignItems:'center', justifyContent:'center' }}>
                                  {LETTERS[idx]}
                                </div>
                                <span style={{ fontFamily:H.font, fontSize:12, fontWeight:600, color:H.text }}>{cls.name}</span>
                                {isUnassigned && (
                                  <span style={{ fontSize:10, color:'#D97706', fontWeight:700, background:'#FEF3C7', padding:'1px 5px', borderRadius:4 }} title="No Class Teacher assigned">
                                    ⭐ Unassigned
                                  </span>
                                )}
                              </div>
                              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                                <span style={{ fontFamily:H.font, fontSize:11, color:pct===100?H.grass:H.sub, fontWeight:600 }}>{pct}%</span>
                              </div>
                            </div>
                          )
                        })}
                        {gradeClasses.length===0 && <p style={{ fontFamily:H.font, fontSize:12, color:H.sub, fontStyle:'italic', margin:0 }}>No classes in this grade</p>}
                      </div>

                      {/* Action Button: View Full Weekly Timetable */}
                      <div style={{ padding:'10px 16px', borderTop:`1px solid ${H.border}`, background:H.bg, display:'flex', justifyContent:'flex-end' }}>
                        <button onClick={()=>openGradeTimetable(grade)} style={{ ...ghost({ padding:'6px 12px', fontSize:12 }), background:H.surface, color:H.textPrimary }}>
                          <Eye size={13} /> View Grade Timetable
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Grade Timetable Modal */}
      {activeGradeModal !== null && (
        <div style={{ position:'fixed', inset:0, zIndex:999, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div onClick={()=>setActiveGradeModal(null)} style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.6)', backdropFilter:'blur(4px)' }}/>
          <div style={{ position:'relative', width:'100%', maxWidth:900, maxHeight:'90vh', background:H.surface, border:`1px solid ${H.border}`, borderRadius:20, boxShadow:H.cardShadow, display:'flex', flexDirection:'column', overflow:'hidden', fontFamily:H.font }}>
            
            {/* Modal Header */}
            <div style={{ padding:'18px 24px', borderBottom:`1px solid ${H.border}`, display:'flex', alignItems:'center', justifyContent:'space-between', background:H.surface }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ width:32, height:32, borderRadius:8, background:gc(activeGradeModal), color:'#fff', fontWeight:900, fontSize:15, display:'flex', alignItems:'center', justifyContent:'center' }}>
                  {activeGradeModal}
                </div>
                <div>
                  <h2 style={{ fontFamily:H.font, fontSize:18, fontWeight:700, color:H.textPrimary, margin:0 }}>Grade {activeGradeModal} Timetable</h2>
                  <p style={{ fontFamily:H.font, fontSize:12, color:H.sub, margin:'2px 0 0' }}>Weekly timetable grid for Grade {activeGradeModal} classes</p>
                </div>
              </div>
              <button onClick={()=>setActiveGradeModal(null)} style={{ background:'none', border:'none', cursor:'pointer', color:H.sub, padding:4 }}><X size={18}/></button>
            </div>

            {/* Class Selector Tabs */}
            <div style={{ padding:'12px 24px', borderBottom:`1px solid ${H.border}`, background:'#FAF9F6', display:'flex', gap:8, overflowX:'auto' }}>
              {(byGrade[activeGradeModal] || []).map((cls: any) => {
                const isSel = modalSelectedClass === cls.id
                return (
                  <button key={cls.id} onClick={()=>setModalSelectedClass(cls.id)}
                    style={{ padding:'6px 14px', borderRadius:8, fontFamily:H.font, fontSize:12, fontWeight:600, cursor:'pointer', border:`1px solid ${isSel ? gc(activeGradeModal) : H.border}`, background: isSel ? gc(activeGradeModal) : H.surface, color: isSel ? '#ffffff' : H.textSec, whiteSpace:'nowrap' }}>
                    {cls.name}
                  </button>
                )
              })}
            </div>

            {/* Modal Body: Weekly Timetable */}
            <div style={{ padding:24, overflowY:'auto', flex:1 }}>
              {modalSelectedClass ? (
                <div style={{ border:`1px solid ${H.border}`, borderRadius:12, overflow:'hidden' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                    <thead>
                      <tr style={{ background:'#F5F5F4' }}>
                        <th style={{ padding:'10px 14px', textAlign:'left', fontFamily:H.font, fontSize:10, fontWeight:900, color:H.sub, textTransform:'uppercase', letterSpacing:'0.05em', width:80 }}>Period</th>
                        {WORK_DAYS.map(day=>(
                          <th key={day} style={{ padding:'10px 8px', textAlign:'center', fontFamily:H.font, fontSize:10, fontWeight:900, color:H.sub, textTransform:'uppercase', letterSpacing:'0.05em' }}>{SHORT_DAY_NAMES[day]}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {periods.map((period:any, i:number)=>(
                        <tr key={i} style={{ borderTop:`1px solid ${H.border}` }}>
                          {period.is_break ? (
                            <td colSpan={6} style={{ padding:'8px 14px', textAlign:'center', fontFamily:H.font, fontSize:11, fontWeight:600, color:H.honey, background:`rgba(238,189,43,0.06)` }}>
                              <Coffee size={11} style={{ display:'inline', marginRight:5 }}/>{period.break_label} · {formatTime(period.start_time)} – {formatTime(period.end_time)}
                            </td>
                          ) : (
                            <>
                              <td style={{ padding:'8px 14px', background:'#F5F5F4' }}>
                                <div style={{ fontFamily:H.font, fontWeight:800, fontSize:11, color:H.muted }}>P{period.period_number}</div>
                                <div style={{ fontFamily:'monospace', fontSize:9, color:H.sub }}>{formatTime(period.start_time)}</div>
                              </td>
                              {WORK_DAYS.map(day=>{
                                const asgn = getAssignment(modalSelectedClass, period.period_number, day)
                                const color = asgn ? (teacherColors[asgn.teacher_id] || H.honey) : null
                                return (
                                  <td key={day} style={{ padding:4, textAlign:'center' }}>
                                    {asgn ? (
                                      <div style={{ borderRadius:8, overflow:'hidden', border:`1px solid ${color}` }}>
                                        <div style={{ background:color!, padding:'4px 6px' }}>
                                          <div style={{ fontFamily:H.font, fontSize:11, fontWeight:800, color:'#fff', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{asgn.subject||'—'}</div>
                                        </div>
                                        <div style={{ padding:'3px 6px', background:`${color}15` }}>
                                          <div style={{ fontFamily:H.font, fontSize:10, color:H.muted, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{asgn.teacher?.full_name?.split(' ')[0]||'—'}</div>
                                        </div>
                                      </div>
                                    ) : (
                                      <div style={{ height:40, borderRadius:8, border:`1px dashed ${H.border}`, background:'#FAF9F6', display:'flex', alignItems:'center', justifyContent:'center', color:H.sub, fontSize:11, fontStyle:'italic' }}>—</div>
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
              ) : (
                <div style={{ padding:40, textAlign:'center', color:H.sub }}>No class selected</div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{ padding:'14px 24px', borderTop:`1px solid ${H.border}`, background:H.surface, display:'flex', justifyContent:'flex-end', gap:10 }}>
              <Link href={`/admin/timetable/${id}/build`} style={gBtn({ padding:'6px 14px', fontSize:12 })}>
                <Pencil size={12} /> Edit Schedule in Builder →
              </Link>
              <button onClick={()=>setActiveGradeModal(null)} style={ghost({ padding:'6px 14px', fontSize:12 })}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Modal */}
      <ConfirmModal
        open={!!modal}
        {...(modal ?? { title: '', message: '', onConfirm: () => {} })}
        onCancel={() => setModal(null)}
      />

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}*{box-sizing:border-box}::-webkit-scrollbar{width:5px}::-webkit-scrollbar-thumb{background:rgba(238,189,43,0.3);border-radius:99px}`}</style>
    </div>
  )
}
