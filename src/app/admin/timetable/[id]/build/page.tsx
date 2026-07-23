'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2, X, AlertTriangle, RefreshCw, Wand2, CheckCircle2, ChevronDown, ChevronUp, Calendar } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { generatePeriods, formatTime } from '@/lib/utils'

import { H } from '@/lib/honey'

const ghost = (x?:any):React.CSSProperties => ({ background:'#F5F5F4', color:H.muted, border:`1px solid ${H.border}`, borderRadius:8, fontFamily:H.font, fontWeight:600, fontSize:12, padding:'6px 12px', cursor:'pointer', display:'inline-flex', alignItems:'center', gap:5, textDecoration:'none', ...x })

const DAYS     = ['Monday','Tuesday','Wednesday','Thursday','Friday']
const DAY_SHORT = ['Mon','Tue','Wed','Thu','Fri']
const PALETTE  = ['#f59e0b','#8b5cf6','#ec4899','#ef4444','#f97316','#22c55e','#10b981','#06b6d4','#3b82f6','#a855f7','#d97706','#84cc16','#f43f5e','#fb923c','#4ade80']

function hex2rgba(hex:string, a:number) {
  const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16)
  return `rgba(${r},${g},${b},${a})`
}
function avatarColor(name:string) { return `hsl(${(name.charCodeAt(0)*17)%360},50%,42%)` }

interface CardData { teacherId:string; teacherName:string; subject:string; color:string }
interface FixResult {
  fixed: { className:string; day:number; period:number; oldTeacher:string; newTeacher:string; subject:string }[]
  unresolved: { className:string; day:number; period:number; teacher:string; subject:string; reason:string }[]
}

export default function TimetableBuildPage() {
  const params     = useParams()
  const supabase   = createClient()
  const templateId = params.id as string

  const [template, setTemplate]         = useState<any>(null)
  const [classes, setClasses]           = useState<any[]>([])
  const [teachers, setTeachers]         = useState<any[]>([])
  const [assignments, setAssignments]   = useState<any[]>([])
  const [loading, setLoading]           = useState(true)
  const [savingKey, setSavingKey]       = useState<string|null>(null)
  const [errorMsg, setErrorMsg]         = useState<string|null>(null)
  const dragCard = useRef<CardData|null>(null)
  const [draggingCard, setDraggingCard] = useState<CardData|null>(null)
  const [dragOverKey, setDragOverKey]   = useState<string|null>(null)
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedDay, setSelectedDay]   = useState(1)
  const [autoFixing, setAutoFixing]     = useState(false)
  const [fixResult, setFixResult]       = useState<FixResult|null>(null)
  const [showFixDetail, setShowFixDetail] = useState(false)
  const [subjectColors, setSubjectColors] = useState<Record<string,string>>({})

  const getConflictIds = (asgns:any[]) => {
    const m:Record<string,any[]>={};
    asgns.forEach(a=>{ const k=`${a.teacher_id}|${a.day_of_week}|${a.period_number}`; if(!m[k])m[k]=[]; m[k].push(a) })
    const ids=new Set<string>()
    Object.values(m).forEach(g=>{ if(g.length>1) g.forEach(a=>ids.add(a.id)) })
    return ids
  }
  const countConflictSlots = (asgns:any[]) => {
    const m:Record<string,number>={}
    asgns.forEach(a=>{ const k=`${a.teacher_id}|${a.day_of_week}|${a.period_number}`; m[k]=(m[k]||0)+1 })
    return Object.values(m).filter(v=>v>1).length
  }

  const fetchData = useCallback(async () => {
    setLoading(true); setErrorMsg(null)
    const [{ data:tmpl,error:e1 },{ data:cls,error:e2 },{ data:tch,error:e3 },{ data:asgn,error:e4 },{ data:alwd }] = await Promise.all([
      supabase.from('timetable_templates').select('*').eq('id',templateId).single(),
      supabase.from('classes').select('*').eq('is_active',true).order('grade_level').order('name'),
      supabase.from('profiles').select('id,full_name,email,subjects,subject_colors').eq('role','teacher').eq('is_active',true).order('full_name'),
      supabase.from('schedule_assignments').select('*').eq('template_id',templateId),
      supabase.from('allowed_users').select('email,subjects'),
    ])
    if (e1||e2||e3||e4) { setErrorMsg(`Load error: ${(e1||e2||e3||e4)?.message}`); setLoading(false); return }
    setTemplate(tmpl); setClasses(cls||[])
    const allowedMap:Record<string,string[]>={}
    ;(alwd||[]).forEach((a:any)=>{ if(a.email&&a.subjects?.length) allowedMap[a.email.toLowerCase()]=a.subjects })
    const merged=(tch||[]).map((t:any)=>({...t,subjects:Array.from(new Set([...(t.subjects||[]),...(allowedMap[t.email?.toLowerCase()]||[])])).filter(Boolean)}))
    setTeachers(merged); setAssignments(asgn||[])
    const map:Record<string,string>={}
    merged.forEach((t:any)=>{ const tc=t.subject_colors||{}; (t.subjects||[]).forEach((s:string)=>{ if(!map[s])map[s]=tc[s]||PALETTE[Object.keys(map).length%PALETTE.length] }) })
    setSubjectColors(map)
    if (cls&&cls.length>0) setSelectedClass(c=>c||cls[0].id)
    setLoading(false)
  },[templateId])

  useEffect(()=>{ fetchData() },[fetchData])

  const periods = template ? generatePeriods(template.start_time,template.end_time,template.period_duration,template.breaks||[]).filter((p:any)=>!p.is_break) : []
  const getAssignment = (classId:string,day:number,period:number) => assignments.find(a=>a.class_id===classId&&a.day_of_week===day&&a.period_number===period)

  const doSave = async (classId:string,day:number,period:number,card:CardData) => {
    const key=`${classId}-${day}-${period}`; setSavingKey(key); setErrorMsg(null)
    const existing=getAssignment(classId,day,period); let err:any=null
    if (existing) ({ error:err }=await supabase.from('schedule_assignments').update({teacher_id:card.teacherId,subject:card.subject,subject_color:card.color}).eq('id',existing.id))
    else ({ error:err }=await supabase.from('schedule_assignments').insert({template_id:templateId,class_id:classId,day_of_week:day,period_number:period,teacher_id:card.teacherId,subject:card.subject,subject_color:card.color}))
    if (err) { setErrorMsg(`Save failed: ${err.message}`); setSavingKey(null); return }
    const { data }=await supabase.from('schedule_assignments').select('*').eq('template_id',templateId)
    setAssignments(data||[]); setSavingKey(null)
  }

  const clearAssignment = async (classId:string,day:number,period:number) => {
    const existing=getAssignment(classId,day,period); if(!existing) return
    setSavingKey(`${classId}-${day}-${period}`)
    await supabase.from('schedule_assignments').delete().eq('id',existing.id)
    setAssignments(prev=>prev.filter(a=>a.id!==existing.id)); setSavingKey(null)
  }

  const onDragStart = (card:CardData,e:React.DragEvent) => { dragCard.current=card; setDraggingCard(card); try{e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('application/json',JSON.stringify(card))}catch{} }
  const onDragEnd   = () => { dragCard.current=null; setDraggingCard(null); setDragOverKey(null) }
  const onDragOver  = (key:string,e:React.DragEvent) => { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect='move'; setDragOverKey(key) }
  const onDragLeave = (key:string,e:React.DragEvent) => { if(!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverKey(k=>k===key?null:k) }
  const onDrop = (classId:string,day:number,period:number,e:React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setDragOverKey(null); setDraggingCard(null)
    let card:CardData|null=dragCard.current; dragCard.current=null
    if (!card) { try{ const r=e.dataTransfer.getData('application/json'); if(r) card=JSON.parse(r) }catch{} }
    if (!card||!card.teacherId||!card.subject) { setErrorMsg('Drop failed — try again'); return }
    doSave(classId,day,period,card)
  }

  const autoFixConflicts = async () => {
    setAutoFixing(true); setFixResult(null); setErrorMsg(null)
    const { data:fresh }=await supabase.from('schedule_assignments').select('*').eq('template_id',templateId)
    const all:any[]=fresh||[]
    const slotMap:Record<string,any[]>={}
    all.forEach(a=>{ const k=`${a.teacher_id}|${a.day_of_week}|${a.period_number}`; if(!slotMap[k])slotMap[k]=[]; slotMap[k].push(a) })
    const conflictGroups=Object.values(slotMap).filter(g=>g.length>1)
    if (conflictGroups.length===0) { setFixResult({fixed:[],unresolved:[]}); setShowFixDetail(false); setAutoFixing(false); return }
    const busyMap:Record<string,Set<string>>={}
    all.forEach(a=>{ if(!busyMap[a.teacher_id])busyMap[a.teacher_id]=new Set(); busyMap[a.teacher_id].add(`${a.day_of_week}|${a.period_number}`) })
    const subjectTeachers:Record<string,any[]>={}
    teachers.forEach(t=>{ (t.subjects||[]).forEach((s:string)=>{ if(!subjectTeachers[s])subjectTeachers[s]=[]; subjectTeachers[s].push(t) }) })
    const fixed:FixResult['fixed']=[], unresolved:FixResult['unresolved']=[], updates:{id:string;teacher_id:string}[]=[]
    for (const group of conflictGroups) {
      group.sort((a:any,b:any)=>{ const ca=classes.find(c=>c.id===a.class_id)?.name||''; const cb=classes.find(c=>c.id===b.class_id)?.name||''; return ca.localeCompare(cb) })
      for (let i=1;i<group.length;i++) {
        const conflict=group[i]; const cls=classes.find(c=>c.id===conflict.class_id)
        const slotKey=`${conflict.day_of_week}|${conflict.period_number}`; const subject=conflict.subject
        const alt=(subjectTeachers[subject]||[]).find((t:any)=>t.id!==conflict.teacher_id&&!busyMap[t.id]?.has(slotKey))
        if (alt) {
          const oldTeacher=teachers.find(t=>t.id===conflict.teacher_id)
          updates.push({id:conflict.id,teacher_id:alt.id}); busyMap[alt.id].add(slotKey)
          fixed.push({ className:cls?.name||'Class', day:conflict.day_of_week, period:conflict.period_number, oldTeacher:oldTeacher?.full_name||'Teacher', newTeacher:alt.full_name, subject })
        } else {
          const tName=teachers.find(t=>t.id===conflict.teacher_id)?.full_name||'Teacher'
          unresolved.push({ className:cls?.name||'Class', day:conflict.day_of_week, period:conflict.period_number, teacher:tName, subject, reason:'No free teacher available for subject' })
        }
      }
    }
    for (const u of updates) await supabase.from('schedule_assignments').update({teacher_id:u.teacher_id}).eq('id',u.id)
    const { data:refreshed }=await supabase.from('schedule_assignments').select('*').eq('template_id',templateId)
    setAssignments(refreshed||[]); setFixResult({fixed,unresolved}); setShowFixDetail(true); setAutoFixing(false)
  }

  const conflictIds   = getConflictIds(assignments)
  const conflictCount = countConflictSlots(assignments)
  const gradeGroups:Record<number,any[]>={}
  classes.forEach(c=>{ if(!gradeGroups[c.grade_level])gradeGroups[c.grade_level]=[]; gradeGroups[c.grade_level].push(c) })
  const selectedClassData = classes.find(c=>c.id===selectedClass)

  if (loading) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:H.bg }}>
      <Loader2 size={24} style={{ color:H.honey, animation:'spin 0.7s linear infinite' }}/>
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column', background:H.bg, fontFamily:H.font, color:H.text }}>

      {/* HEADER — ArrowLeft back button to return to template view */}
      <header style={{ height:64, padding:'0 20px', display:'flex', alignItems:'center', justifyContent:'space-between', borderBottom:`1px solid ${H.border}`, background:H.surface, backdropFilter:'blur(12px)', position:'sticky', top:0, zIndex:30, flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <Link href={`/admin/timetable/${templateId}`} style={ghost({ padding:'6px 12px' })} title="Back to Template Overview">
            <ArrowLeft size={14} /> Back
          </Link>
          <div style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: H.purpleLight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Calendar size={18} style={{ color: H.purpleDark }} />
          </div>
          <div>
            <h1 style={{ fontFamily:H.font, fontSize:15, fontWeight:800, color:H.text, margin:0 }}>{template?.name}</h1>
            <p style={{ fontFamily:H.font, fontSize:11, color:H.muted, margin:0 }}>
              {draggingCard ? `Dropping: ${draggingCard.subject} — ${draggingCard.teacherName}` : 'Drag cards to period slots'}
            </p>
          </div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <button onClick={fetchData} style={ghost({ padding:'6px 10px' })} title="Refresh"><RefreshCw size={13}/></button>
          <button onClick={autoFixConflicts} disabled={autoFixing}
            style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 16px', borderRadius:10, border:`1px solid ${H.border}`, cursor:autoFixing?'wait':'pointer', fontFamily:H.font, fontWeight:700, fontSize:13, background: conflictCount>0?H.accent:H.purple, color:'#fff', transition:'all 0.2s' }}>
            {autoFixing ? <><Loader2 size={14} style={{ animation:'spin 0.7s linear infinite' }}/> Auto-Fixing…</>
              : conflictCount>0 ? <><AlertTriangle size={14}/> {conflictCount} Conflict{conflictCount!==1?'s':''} · Auto-Fix</>
              : <><Wand2 size={14}/> Auto-Fix Conflicts</>}
          </button>
        </div>
      </header>

      {/* Error banner */}
      {errorMsg && (
        <div style={{ background:'rgba(239,68,68,0.12)', borderBottom:`1px solid rgba(239,68,68,0.3)`, padding:'10px 20px', display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
          <AlertTriangle size={14} style={{ color:'#f87171', flexShrink:0 }}/>
          <span style={{ fontFamily:H.font, fontSize:13, color:'#f87171', flex:1 }}>{errorMsg}</span>
          <button onClick={()=>setErrorMsg(null)} style={{ background:'none', border:'none', cursor:'pointer', color:'#f87171' }}><X size={13}/></button>
        </div>
      )}

      {/* Fix result banner */}
      {fixResult && (
        <div style={{ borderBottom:`1px solid ${fixResult.unresolved.length>0?'#fb923c':H.grass}`, background:fixResult.unresolved.length>0?'rgba(251,146,60,0.08)':`rgba(143,179,57,0.08)`, flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 20px', gap:12 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              {fixResult.unresolved.length===0 ? <CheckCircle2 size={16} color={H.grass}/> : <AlertTriangle size={16} color="#fb923c"/>}
              <div>
                <div style={{ fontFamily:H.font, fontWeight:700, fontSize:13, color:fixResult.unresolved.length>0?'#fb923c':H.grass }}>
                  {fixResult.fixed.length===0&&fixResult.unresolved.length===0 ? 'No conflicts — timetable is clean!'
                    : fixResult.unresolved.length===0 ? `All conflicts resolved! ${fixResult.fixed.length} teacher${fixResult.fixed.length!==1?'s':''} reassigned.`
                    : `Fixed ${fixResult.fixed.length} · ${fixResult.unresolved.length} need manual attention`}
                </div>
                {fixResult.unresolved.length>0 && <div style={{ fontFamily:H.font, fontSize:11, color:'#fb923c', marginTop:2 }}>No alternative teacher available — reassign manually.</div>}
              </div>
            </div>
            <div style={{ display:'flex', gap:8, alignItems:'center', flexShrink:0 }}>
              {(fixResult.fixed.length>0||fixResult.unresolved.length>0) && (
                <button onClick={()=>setShowFixDetail(v=>!v)} style={{ background:'none', border:'none', cursor:'pointer', fontFamily:H.font, fontSize:12, fontWeight:600, color:H.muted, display:'flex', alignItems:'center', gap:4 }}>
                  {showFixDetail?<><ChevronUp size={12}/>Hide</>:<><ChevronDown size={12}/>Details</>}
                </button>
              )}
              <button onClick={()=>setFixResult(null)} style={{ background:'none', border:'none', cursor:'pointer', color:H.muted }}><X size={14}/></button>
            </div>
          </div>
          {showFixDetail && (
            <div style={{ padding:'0 20px 12px', display:'flex', flexDirection:'column', gap:4, maxHeight:160, overflowY:'auto' }}>
              {fixResult.fixed.map((f,i)=>(
                <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:7, fontFamily:H.font, fontSize:12, color:H.grass, padding:'2px 0' }}>
                  <CheckCircle2 size={11} style={{ marginTop:1, flexShrink:0 }}/>
                  <span><strong>{f.className}</strong> · P{f.period} · {DAYS[f.day-1]} · {f.subject} — <strong>{f.oldTeacher}</strong> → <strong>{f.newTeacher}</strong></span>
                </div>
              ))}
              {fixResult.unresolved.map((u,i)=>(
                <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:7, fontFamily:H.font, fontSize:12, color:'#f87171', padding:'2px 0' }}>
                  <AlertTriangle size={11} style={{ marginTop:1, flexShrink:0 }}/>
                  <span><strong>{u.className}</strong> · P{u.period} · {DAYS[u.day-1]} · {u.subject} ({u.teacher}) — {u.reason}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* BODY — Responsive Flex Layout */}
      <div className="builder-body-container" style={{ display:'flex', flex:1, overflow:'hidden' }}>

        {/* SIDEBAR — Teachers & Subjects (Stacked horizontally on mobile) */}
        <aside className="builder-sidebar" style={{ width:250, flexShrink:0, borderRight:`1px solid ${H.border}`, background:H.surface, overflowY:'auto', display:'flex', flexDirection:'column' }}>
          <div style={{ padding:'10px 14px', borderBottom:`1px solid ${H.border}`, fontFamily:H.font, fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', color:H.muted, flexShrink:0 }}>
            Teachers & Subjects
          </div>

          {teachers.length===0 && (
            <div style={{ padding:'20px 16px', fontFamily:H.font, fontSize:13, color:H.muted, textAlign:'center' }}>
              No teachers found.<br/>Add teachers with subjects first.
            </div>
          )}

          <div className="builder-sidebar-items" style={{ display:'flex', flexDirection:'column' }}>
            {teachers.map((teacher:any)=>{
              const subs:string[]=teacher.subjects||[]
              if (subs.length===0) return null
              const busyPeriods=assignments.filter(a=>a.teacher_id===teacher.id&&a.day_of_week===selectedDay).map(a=>a.period_number).sort((a:number,b:number)=>a-b)
              const teacherConflicts=assignments.filter(a=>conflictIds.has(a.id)&&a.teacher_id===teacher.id).length
              return (
                <div key={teacher.id} className="teacher-card" style={{ borderBottom:`1px solid ${H.border}`, paddingBottom:6 }}>
                  <div style={{ padding:'8px 12px 4px', display:'flex', alignItems:'center', gap:7 }}>
                    <div style={{ width:24, height:24, borderRadius:'50%', background:avatarColor(teacher.full_name), color:'#fff', fontWeight:700, fontSize:11, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, position:'relative' }}>
                      {teacher.full_name.charAt(0)}
                      {teacherConflicts>0 && <div style={{ position:'absolute', top:-3, right:-3, width:8, height:8, borderRadius:'50%', background:'#f97316' }}/>}
                    </div>
                    <div style={{ minWidth:0, flex:1 }}>
                      <div style={{ fontFamily:H.font, fontSize:12, fontWeight:700, color:H.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{teacher.full_name}</div>
                      <div style={{ fontFamily:H.font, fontSize:10, color:teacherConflicts>0?'#f97316':H.muted }}>
                        {teacherConflicts>0 ? `${teacherConflicts} conflict${teacherConflicts!==1?'s':''}` : busyPeriods.length>0 ? `Busy P${busyPeriods.join(', ')} today` : 'Free today'}
                      </div>
                    </div>
                  </div>
                  <div style={{ padding:'4px 10px', display:'flex', flexWrap:'wrap', gap:5 }}>
                    {subs.map((subject:string)=>{
                      const color=subjectColors[subject]||H.honey
                      const card:CardData={teacherId:teacher.id,teacherName:teacher.full_name,subject,color}
                      const isBeingDragged=draggingCard?.teacherId===teacher.id&&draggingCard?.subject===subject
                      return (
                        <div key={subject} draggable onDragStart={e=>onDragStart(card,e)} onDragEnd={onDragEnd}
                          style={{ borderRadius:8, background:color, cursor:'grab', userSelect:'none' as const, opacity:isBeingDragged?0.4:1, transform:isBeingDragged?'scale(0.95)':'scale(1)', transition:'opacity 0.15s,transform 0.15s', boxShadow:`0 2px 6px ${hex2rgba(color,0.3)}`, overflow:'hidden', border:`1px solid ${H.border}` }}>
                          <div style={{ padding:'4px 8px 2px', display:'flex', alignItems:'center', gap:6 }}>
                            <span style={{ fontFamily:H.font, fontSize:11, fontWeight:700, color:'#fff', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{subject}</span>
                          </div>
                          <div style={{ padding:'2px 8px 4px', background:'rgba(0,0,0,0.15)', display:'flex', alignItems:'center', gap:4 }}>
                            <span style={{ fontFamily:H.font, fontSize:9, color:'rgba(255,255,255,0.9)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{teacher.full_name}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </aside>

        {/* MAIN — Period grid with STICKY Top Day Tabs & Full Width Drop Boxes */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>

          {/* Sticky Class + Day selection bar */}
          <div style={{ padding:'10px 16px', borderBottom:`1px solid ${H.border}`, background:H.surface, display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' as const, flexShrink:0, position:'sticky', top:0, zIndex:25 }}>
            <select value={selectedClass} onChange={e=>setSelectedClass(e.target.value)}
              style={{ padding:'7px 12px', background:H.bg, border:`1px solid ${H.border}`, borderRadius:8, color:H.text, fontFamily:H.font, fontWeight:700, fontSize:13, outline:'none', cursor:'pointer', minWidth:160, maxWidth:220 }}>
              {Object.entries(gradeGroups).sort(([a],[b])=>Number(a)-Number(b)).map(([grade,cls])=>(
                <optgroup key={grade} label={`Grade ${grade}`}>
                  {(cls as any[]).map((c:any)=><option key={c.id} value={c.id} style={{ background:H.surface }}>{c.name}</option>)}
                </optgroup>
              ))}
            </select>

            {/* Mon-Fri Sticky Day Tabs */}
            <div style={{ display:'flex', border:`1px solid ${H.border}`, borderRadius:8, overflow:'hidden', backgroundColor:H.surface }}>
              {DAYS.map((d,i)=>(
                <button key={d} onClick={()=>setSelectedDay(i+1)}
                  style={{ padding:'7px 14px', fontFamily:H.font, fontWeight:600, fontSize:12, cursor:'pointer', border:'none', borderRight:i<4?`1px solid ${H.border}`:'none', background:selectedDay===i+1?H.honey:H.surface, color:selectedDay===i+1?'#FFFFFF':H.textSec }}>
                  {DAY_SHORT[i]}
                </button>
              ))}
            </div>

            {selectedClassData && (
              <span style={{ fontFamily:H.font, fontSize:12, color:H.sub, marginLeft:'auto' }}>
                {selectedClassData.name} · {DAYS[selectedDay-1]}
                {conflictCount>0 && <span style={{ marginLeft:8, color:'#f97316', fontWeight:700 }}>⚠ {conflictCount} conflict{conflictCount!==1?'s':''}</span>}
              </span>
            )}
          </div>

          {/* Period slots — Full Container Width */}
          <div style={{ flex:1, overflowY:'auto', padding:16 }}>
            <div style={{ display:'flex', flexDirection:'column', gap:10, width:'100%', boxSizing:'border-box' }}>
              {periods.map((period:any)=>{
                const asgn        = selectedClass?getAssignment(selectedClass,selectedDay,period.period_number):null
                const asgnTeacher = asgn?teachers.find(t=>t.id===asgn.teacher_id):null
                const slotKey     = `${selectedClass}-${selectedDay}-${period.period_number}`
                const isSaving    = savingKey===slotKey
                const isOver      = dragOverKey===slotKey
                const isConflict  = asgn?conflictIds.has(asgn.id):false
                const slotColor   = isConflict?'#f97316':(asgn?.subject_color||H.honey)

                return (
                  <div key={period.period_number}
                    onDragOver={e=>onDragOver(slotKey,e)} onDragEnter={e=>{e.preventDefault();setDragOverKey(slotKey)}}
                    onDragLeave={e=>onDragLeave(slotKey,e)} onDrop={e=>onDrop(selectedClass,selectedDay,period.period_number,e)}
                    style={{
                      display:'flex', width:'100%', boxSizing:'border-box', borderRadius:12, border:`1px solid`, minHeight:68,
                      borderColor:isConflict?'#f97316':isOver?H.honey:asgn?slotColor:H.border,
                      background:isConflict?hex2rgba('#f97316',0.07):isOver?hex2rgba(H.honey,0.06):asgn?hex2rgba(slotColor,0.06):H.surface,
                      transition:'all 0.12s', transform:isOver?'scale(1.005)':'scale(1)', overflow:'hidden', position:'relative'
                    }}>

                    {isConflict && <div style={{ position:'absolute', left:0, top:0, bottom:0, width:4, background:'#f97316' }}/>}

                    {/* Period # + time */}
                    <div style={{ width:72, flexShrink:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:8, borderRight:`1px solid ${asgn?hex2rgba(slotColor,0.3):H.border}`, background:asgn?hex2rgba(slotColor,0.1):'#F5F5F4' }}>
                      <div style={{ fontFamily:H.font, fontWeight:900, fontSize:22, lineHeight:1, color:asgn?slotColor:isOver?H.honey:H.sub }}>P{period.period_number}</div>
                      <div style={{ fontFamily:'monospace', fontSize:9, color:H.sub, textAlign:'center', marginTop:3, lineHeight:1.3 }}>{formatTime(period.start_time)}<br/>{formatTime(period.end_time)}</div>
                    </div>

                    {/* Content Slot — Full Width */}
                    <div style={{ flex:1, display:'flex', alignItems:'center', padding:'10px 14px', gap:12, minWidth:0, width:'100%', boxSizing:'border-box' }}>
                      {isSaving ? (
                        <div style={{ display:'flex', alignItems:'center', gap:8, color:H.sub }}>
                          <Loader2 size={16} style={{ animation:'spin 0.7s linear infinite' }}/>
                          <span style={{ fontFamily:H.font, fontSize:13 }}>Saving…</span>
                        </div>
                      ) : asgn && asgnTeacher ? (
                        <>
                          <div style={{ flex:1, borderRadius:8, overflow:'hidden', boxShadow:`0 2px 6px ${hex2rgba(slotColor,0.25)}`, minWidth:0 }}>
                            <div style={{ background:slotColor, padding:'5px 10px', display:'flex', alignItems:'center', gap:6 }}>
                              {isConflict && <AlertTriangle size={11} style={{ color:'#fff', flexShrink:0 }}/>}
                              <span style={{ fontFamily:H.font, fontSize:13, fontWeight:800, color:'#fff', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{asgn.subject}</span>
                              {isConflict && <span style={{ marginLeft:'auto', fontFamily:H.font, fontSize:10, color:'rgba(255,255,255,0.9)', fontWeight:700, whiteSpace:'nowrap', flexShrink:0 }}>Conflict</span>}
                            </div>
                            <div style={{ padding:'3px 10px', background:hex2rgba(slotColor,0.14), display:'flex', alignItems:'center', gap:5 }}>
                              <div style={{ width:14, height:14, borderRadius:'50%', background:avatarColor(asgnTeacher.full_name), display:'flex', alignItems:'center', justifyContent:'center', fontSize:8, fontWeight:700, color:'#fff', flexShrink:0 }}>{asgnTeacher.full_name.charAt(0)}</div>
                              <span style={{ fontFamily:H.font, fontSize:11, color:H.muted, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{asgnTeacher.full_name}</span>
                            </div>
                          </div>
                          <button onClick={e=>{e.stopPropagation();clearAssignment(selectedClass,selectedDay,period.period_number)}} style={{ background:'#F5F5F4', border:`1px solid ${H.border}`, borderRadius:6, width:28, height:28, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:H.muted, flexShrink:0, padding:0 }}><X size={14}/></button>
                        </>
                      ) : isOver && draggingCard ? (
                        <div style={{ flex:1, borderRadius:8, overflow:'hidden', opacity:0.7, minWidth:0 }}>
                          <div style={{ background:draggingCard.color, padding:'5px 10px' }}><span style={{ fontFamily:H.font, fontSize:13, fontWeight:800, color:'#fff' }}>{draggingCard.subject}</span></div>
                          <div style={{ padding:'3px 10px', background:hex2rgba(draggingCard.color,0.15) }}><span style={{ fontFamily:H.font, fontSize:11, color:H.muted }}>{draggingCard.teacherName}</span></div>
                        </div>
                      ) : (
                        <span style={{ fontFamily:H.font, fontSize:13, color:isOver?H.honey:H.sub, fontWeight:isOver?600:400 }}>
                          {isOver?'Release to assign':'Drop a card here'}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        *{box-sizing:border-box}
        ::-webkit-scrollbar{width:5px;height:5px}
        ::-webkit-scrollbar-thumb{background:rgba(238,189,43,0.3);border-radius:99px}
        
        @media (max-width: 767px) {
          .builder-body-container {
            flex-direction: column !important;
            overflow-y: auto !important;
            height: auto !important;
          }
          .builder-sidebar {
            width: 100% !important;
            height: auto !important;
            border-right: none !important;
            border-bottom: 1px solid ${H.border} !important;
          }
          .builder-sidebar-items {
            flex-direction: row !important;
            overflow-x: auto !important;
            padding: 8px 12px !important;
            gap: 10px !important;
          }
          .teacher-card {
            border-bottom: none !important;
            border-right: 1px solid ${H.border} !important;
            padding-right: 10px !important;
            min-width: 180px !important;
          }
        }
      `}</style>
    </div>
  )
}
