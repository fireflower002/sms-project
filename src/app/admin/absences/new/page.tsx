'use client'
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, UserX, UserCheck, Loader2, Search, CheckCircle2, AlertTriangle, Star, Bell, Send, RotateCcw, ShieldAlert, CalendarDays } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { todaySLT, generatePeriods, dateToDayOfWeek, formatTime, formatSLT } from '@/lib/utils'

import { H } from '@/lib/honey'
import {
  SchoolCalendarEvent,
  SchoolSettings,
  DEFAULT_SCHOOL_SETTINGS,
  getCalendarReason,
} from '@/lib/calendarService'

const card  = (x?:any):React.CSSProperties => ({ background:H.surface, borderRadius:16, border:`1px solid ${H.border}`, boxShadow:'0 2px 8px rgba(0,0,0,0.06)', overflow:'hidden', padding:'20px 22px', ...x })
const hBtn  = (x?:any):React.CSSProperties => ({ background:H.purple, color:'#FFFFFF', border:'none', borderRadius:12, fontFamily:H.font, fontWeight:700, fontSize:14, padding:'12px 20px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8, width:'100%', minHeight:48, boxShadow:'0 4px 12px rgba(139,92,246,0.25)', boxSizing:'border-box' as const, ...x })
const ghost = (x?:any):React.CSSProperties => ({ background:'#F5F5F4', color:H.muted, border:`1px solid ${H.border}`, borderRadius:8, fontFamily:H.font, fontWeight:600, fontSize:12, padding:'6px 12px', cursor:'pointer', display:'inline-flex', alignItems:'center', gap:5, textDecoration:'none', ...x })
const gBtn  = (x?:any):React.CSSProperties => ({ background:H.grass, color:'#FFFFFF', border:'none', borderRadius:12, fontFamily:H.font, fontWeight:700, fontSize:14, padding:'12px 20px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8, width:'100%', minHeight:48, boxSizing:'border-box' as const, ...x })
const inp   = (x?:any):React.CSSProperties => ({ width:'100%', padding:'10px 14px', background:H.bg, border:`1px solid ${H.border}`, borderRadius:8, color:H.text, fontFamily:H.font, fontWeight:600, fontSize:13, outline:'none', boxSizing:'border-box' as const, transition:'border-color 0.15s', ...x })

const StepBadge = ({ n, done }: { n: number; done?: boolean }) => (
  <div style={{ width:26, height:26, borderRadius:'50%', background:done?H.grass:H.purple, color:'#fff', fontSize:12, fontWeight:900, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontFamily:H.font, border:`2px solid ${H.border}` }}>
    {done ? '✓' : n}
  </div>
)

const Label = ({ children }: { children: React.ReactNode }) => (
  <label style={{ display:'block', fontFamily:H.font, fontSize:11, fontWeight:800, color:H.sub, textTransform:'uppercase' as const, letterSpacing:'0.07em', marginBottom:6 }}>
    {children}
  </label>
)

import { Suspense } from 'react'

function NewAbsenceContent() {
  const supabase     = createClient()
  const router       = useRouter()
  const searchParams = useSearchParams()
  const preloadAbsenceId = searchParams.get('absence_id')

  const [teachers, setTeachers]   = useState<any[]>([])
  const [template, setTemplate]   = useState<any>(null)
  const [search, setSearch]       = useState('')
  const [loading, setLoading]     = useState(false)
  const [fetching, setFetching]   = useState(true)
  const [error, setError]         = useState('')
  const [success, setSuccess]     = useState(false)
  const [form, setForm] = useState({
    teacher_id: '', absence_date: todaySLT(),
    absence_type: 'full_day' as 'full_day'|'morning_block'|'afternoon_block'|'custom_periods',
    custom_periods: [] as number[], reason: '',
  })
  const [selectedTeacher, setSelectedTeacher] = useState<any>(null)
  const [suggestions, setSuggestions]         = useState<Record<number,any[]>>({})
  const [manualOverride, setManualOverride]   = useState<Record<number,boolean>>({})
  const [loadingSugs, setLoadingSugs]         = useState(false)
  const [assignedSubs, setAssignedSubs]       = useState<Record<number,string>>({})
  const [savingPill, setSavingPill]           = useState<Record<number,boolean>>({})
  const [absenceId, setAbsenceId]             = useState<string|null>(null)
  const [notifying, setNotifying]             = useState<Record<number,boolean>>({})
  const [notified, setNotified]               = useState<Record<number,boolean>>({})

  useEffect(() => {
    Promise.all([
      supabase.from('profiles').select('id,full_name,email,subjects').eq('role','teacher').eq('is_active',true).order('full_name'),
      supabase.from('timetable_templates').select('*').eq('is_active',true).maybeSingle(),
    ]).then(async ([{data:t},{data:tmpl}]) => {
      setTeachers(t||[]); setTemplate(tmpl||null)
      if (preloadAbsenceId) {
        const {data:abs} = await supabase.from('absences').select('*, teacher:profiles!teacher_id(id,full_name,subjects,email)').eq('id',preloadAbsenceId).maybeSingle()
        if (abs) {
          setAbsenceId(abs.id)
          setForm(f=>({...f, teacher_id:abs.teacher_id, absence_date:abs.absence_date, absence_type:abs.absence_type, custom_periods:abs.custom_periods||[], reason:abs.reason||'' }))
          setSelectedTeacher(abs.teacher); setSearch(abs.teacher?.full_name||'')
          setTimeout(()=>loadSuggestionsFor(abs.teacher_id,abs.absence_date,abs.absence_type,abs.custom_periods||[],t||[],tmpl,abs.id),100)
        }
      }
      setFetching(false)
    })
  }, [])

  const periods = template ? generatePeriods(template.start_time,template.end_time,template.period_duration,template.breaks||[]).filter((p:any)=>!p.is_break) : []

  const absentPeriods = (() => {
    if (form.absence_type==='full_day')        return periods.map((p:any)=>p.period_number)
    if (form.absence_type==='morning_block')   return periods.slice(0,Math.ceil(periods.length/2)).map((p:any)=>p.period_number)
    if (form.absence_type==='afternoon_block') return periods.slice(Math.ceil(periods.length/2)).map((p:any)=>p.period_number)
    return form.custom_periods
  })()

  const selectTeacher = (t:any) => { setSelectedTeacher(t); setForm(f=>({...f,teacher_id:t.id})); setSearch(t.full_name); setSuggestions({}); setAssignedSubs({}); setAbsenceId(null); setNotified({}) }

  const loadSuggestionsFor = async (teacherId:string, absenceDate:string, absenceType:string, customPeriods:number[], teacherList:any[], tmpl:any, targetAbsenceId?: string) => {
    setLoadingSugs(true)
    if (!tmpl) { setLoadingSugs(false); return }
    const allP = generatePeriods(tmpl.start_time,tmpl.end_time,tmpl.period_duration,tmpl.breaks||[]).filter((p:any)=>!p.is_break)
    const rawAbsent = absenceType==='full_day'?allP.map((p:any)=>p.period_number):absenceType==='morning_block'?allP.slice(0,Math.ceil(allP.length/2)).map((p:any)=>p.period_number):absenceType==='afternoon_block'?allP.slice(Math.ceil(allP.length/2)).map((p:any)=>p.period_number):customPeriods
    const dayOfWeek = dateToDayOfWeek(absenceDate)
    
    const [{data:absentSlots},{data:allSlots}] = await Promise.all([
      supabase.from('schedule_assignments').select('id,period_number,subject,class_id,class:classes(name)').eq('teacher_id',teacherId).eq('day_of_week',dayOfWeek).eq('template_id',tmpl.id),
      supabase.from('schedule_assignments').select('teacher_id,period_number').eq('day_of_week',dayOfWeek).eq('template_id',tmpl.id),
    ])

    const heldMap = new Map((absentSlots||[]).map((s:any)=>[s.period_number, s]))
    // ONLY include periods where the absent teacher holds a scheduled class
    const absent = rawAbsent.filter((p:number) => heldMap.has(p))

    const busy:Record<number,Set<string>>={};
    for (const s of allSlots||[]) { if(!busy[s.period_number])busy[s.period_number]=new Set(); busy[s.period_number].add(s.teacher_id) }
    const newSugs:Record<number,any[]>={}
    for (const p of absent) {
      const slot:any = heldMap.get(p)
      const free = teacherList.filter(t => t.id !== teacherId && !(busy[p]?.has(t.id)))
      newSugs[p] = free.map(t => ({
        ...t,
        sameSubject: (t.subjects||[]).includes(slot?.subject||''),
        className: slot?.class?.name || '',
        subject: slot?.subject || '',
        classId: slot?.class_id || null,
        scheduleAssignmentId: slot?.id || null
      })).sort((a,b) => (b.sameSubject ? 1 : 0) - (a.sameSubject ? 1 : 0) || a.full_name.localeCompare(b.full_name))
    }
    setSuggestions(newSugs)

    // Preload existing substitutions if absence exists
    const currentAbsId = targetAbsenceId || absenceId
    if (currentAbsId) {
      const { data: existingSubs } = await supabase.from('substitutions').select('*').eq('absence_id', currentAbsId)
      if (existingSubs && existingSubs.length > 0) {
        const initialAssigned: Record<number, string> = {}
        const initialNotified: Record<number, boolean> = {}
        for (const subRow of existingSubs) {
          if (subRow.substitute_teacher_id) {
            initialAssigned[subRow.period_number] = subRow.substitute_teacher_id
          }
          if (subRow.notified) {
            initialNotified[subRow.period_number] = true
          }
        }
        setAssignedSubs(initialAssigned)
        setNotified(initialNotified)
      }
    }

    setLoadingSugs(false)
  }

  const handleSubmit = async () => {
    if (!form.teacher_id) { setError('Please select a teacher'); return }
    if (!template?.id) { setError('No active timetable template found — contact admin.'); return }
    setLoading(true); setError('')
    try {
      const {data:{session}}=await supabase.auth.getSession(); const user=session?.user
      const {data:existing}=await supabase.from('absences').select('id').eq('teacher_id',form.teacher_id).eq('absence_date',form.absence_date).maybeSingle()
      if (existing) { setError('Absence already recorded for this teacher on that date.'); return }
      let {data:abs,error:err}=await supabase.from('absences').insert({ teacher_id:form.teacher_id, absence_date:form.absence_date, absence_type:form.absence_type, custom_periods:form.absence_type==='custom_periods'?form.custom_periods:null, reason:form.reason||null, recorded_by:user?.id, status:'approved', template_id: template.id }).select().single()
      if (err && (err.message.includes('status') || err.message.includes('schema cache') || err.message.includes('column'))) {
        const res = await supabase.from('absences').insert({ teacher_id:form.teacher_id, absence_date:form.absence_date, absence_type:form.absence_type, custom_periods:form.absence_type==='custom_periods'?form.custom_periods:null, reason:form.reason||null, recorded_by:user?.id, template_id: template.id }).select().single()
        abs = res.data
        err = res.error
      }
      if (err) { setError(err.message); return }
      setAbsenceId(abs.id); await loadSuggestionsFor(form.teacher_id,form.absence_date,form.absence_type,form.custom_periods,teachers,template,abs.id)
    } finally { setLoading(false) }
  }

  const handleToggleCandidate = async (pNum: number, candidate: any, slot: any) => {
    if (!absenceId) return
    const isCurrentlySelected = assignedSubs[pNum] === candidate.id
    const prevSubId = assignedSubs[pNum]

    setSavingPill(p => ({ ...p, [pNum]: true }))
    setError('')

    try {
      if (isCurrentlySelected) {
        // Deselect -> delete row from substitutions table
        const { error: delErr } = await supabase
          .from('substitutions')
          .delete()
          .eq('absence_id', absenceId)
          .eq('period_number', pNum)

        if (delErr) throw delErr

        setAssignedSubs(p => {
          const copy = { ...p }
          delete copy[pNum]
          return copy
        })
        setNotified(p => ({ ...p, [pNum]: false }))

        // Trigger unassign notification for candidate
        fetch('/api/notify/substitute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            substitute_teacher_id: candidate.id,
            substitute_name: candidate.full_name || '',
            period_number: pNum,
            class_name: slot?.className || slot?.class_name || '',
            subject: slot?.subject || '',
            absence_date: form.absence_date,
            action: 'unassign'
          })
        }).catch(err => console.warn('[handleToggleCandidate] unassign notify error:', err))

      } else {
        // Candidate switch -> send unassign notification to previous candidate
        if (prevSubId && prevSubId !== candidate.id) {
          const prevSub = teachers.find(t => t.id === prevSubId)
          fetch('/api/notify/substitute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              substitute_teacher_id: prevSubId,
              substitute_name: prevSub?.full_name || '',
              period_number: pNum,
              class_name: slot?.className || slot?.class_name || '',
              subject: slot?.subject || '',
              absence_date: form.absence_date,
              action: 'unassign'
            })
          }).catch(err => console.warn('[handleToggleCandidate] prevSub unassign notify error:', err))
        }

        // Select -> upsert row into substitutions table
        const rowToUpsert = {
          absence_id: absenceId,
          substitute_teacher_id: candidate.id,
          period_number: pNum,
          class_id: slot?.classId || slot?.class_id || null,
          subject: slot?.subject || null,
          schedule_assignment_id: slot?.scheduleAssignmentId || slot?.schedule_assignment_id || null,
          status: 'assigned',
          notified: true,
          notified_at: new Date().toISOString()
        }

        const { error: upsertErr } = await supabase
          .from('substitutions')
          .upsert(rowToUpsert, { onConflict: 'absence_id,period_number' })

        if (upsertErr) throw upsertErr

        setAssignedSubs(p => ({ ...p, [pNum]: candidate.id }))
        setNotified(p => ({ ...p, [pNum]: true }))

        // Trigger assign notification for candidate
        fetch('/api/notify/substitute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            substitute_teacher_id: candidate.id,
            substitute_name: candidate.full_name || '',
            absent_teacher_name: selectedTeacher?.full_name || '',
            period_number: pNum,
            class_name: slot?.className || slot?.class_name || '',
            subject: slot?.subject || '',
            absence_date: form.absence_date,
            action: 'assign'
          })
        }).catch(err => console.warn('[handleToggleCandidate] assign notify error:', err))
      }
    } catch (err: any) {
      console.error('[handleToggleCandidate] DB error:', err)
      setError(err?.message || 'Failed to update substitution assignment in database.')
    } finally {
      setSavingPill(p => ({ ...p, [pNum]: false }))
    }
  }

  const notifySubstitute = async (pNum:number) => {
    const subId=assignedSubs[pNum]; if(!subId||!selectedTeacher||!absenceId) return
    setNotifying(p=>({...p,[pNum]:true}))
    setError('')
    try {
      const sub=teachers.find(t=>t.id===subId); const slot=(suggestions[pNum]||[])[0]||{}
      
      const res = await fetch('/api/notify/substitute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          substitute_teacher_id: subId,
          substitute_name: sub?.full_name || '',
          absent_teacher_name: selectedTeacher.full_name,
          period_number: pNum,
          class_name: slot.className || '',
          subject: slot.subject || '',
          absence_date: form.absence_date
        })
      })

      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.error) {
        throw new Error(json.error || 'Failed to send notification')
      }

      // Mark substitution row as notified in DB if columns exist
      try {
        await supabase.from('substitutions').update({
          notified: true,
          notified_at: new Date().toISOString()
        }).eq('absence_id', absenceId).eq('period_number', pNum)
      } catch (subUpdateErr) {
        console.warn('[notifySubstitute] Warning updating notified flag:', subUpdateErr)
      }

      setNotified(p => ({ ...p, [pNum]: true }))
    } catch (err: any) {
      console.error('[notifySubstitute] Error:', err)
      setError(`Notification error: ${err?.message || 'Failed to send notification'}`)
    } finally {
      setNotifying(p=>({...p,[pNum]:false}))
    }
  }

  const [canceling, setCanceling] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)

  const handleCancelAbsence = async () => {
    if (!absenceId) return
    setCanceling(true)
    try {
      await supabase.from('substitutions').delete().eq('absence_id', absenceId)
      const { error: delErr } = await supabase.from('absences').delete().eq('id', absenceId)
      if (delErr) throw delErr
      setAbsenceId(null)
      setSelectedTeacher(null)
      setAssignedSubs({})
      setForm(f => ({ ...f, teacher_id: '', reason: '' }))
      setSearch('')
      setConfirmCancel(false)
      if (preloadAbsenceId) {
        router.push('/admin/disruptions?tab=absences')
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to cancel absence')
    } finally {
      setCanceling(false)
    }
  }

  const notifyAll = async () => { for (const pNum of Object.keys(assignedSubs).map(Number)) { if (!notified[pNum]) await notifySubstitute(pNum) } }
  const filteredTeachers = teachers.filter(t=>!search||t.full_name.toLowerCase().includes(search.toLowerCase())||t.email?.toLowerCase().includes(search.toLowerCase()))

  if (fetching) return <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:H.bg }}><Loader2 size={22} style={{ color:H.purple, animation:'spin 0.7s linear infinite' }}/></div>

  if (success) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:H.bg }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:48, marginBottom:12 }}>✅</div>
        <div style={{ fontFamily:H.font, fontSize:20, fontWeight:900, color:H.grass }}>Absence recorded!</div>
        <div style={{ fontFamily:H.font, fontSize:13, color:H.muted, marginTop:8 }}>Redirecting…</div>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', background:H.bg, fontFamily:H.font, color:H.text }}>

      {/* Header */}
      <header style={{ height:68, padding:'0 24px', display:'flex', alignItems:'center', gap:12, borderBottom:`1px solid ${H.border}`, background:H.surface, backdropFilter:'blur(12px)', position:'sticky', top:0, zIndex:30 }}>
        <div style={{ width:36, height:36, borderRadius:10, backgroundColor:'rgba(139,92,246,0.12)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <UserX size={20} style={{ color: H.purple }} />
        </div>
        <div>
          <h1 style={{ fontFamily:H.font, fontSize:17, fontWeight:800, color:H.text, margin:0 }}>{preloadAbsenceId?'Assign Cover':'Mark Absence'}</h1>
          <p style={{ fontFamily:H.font, fontSize:11, color:H.muted, margin:0 }}>{preloadAbsenceId?'Select substitutes & notify':'Record absence & assign cover'}</p>
        </div>
      </header>

      <main style={{ maxWidth:720, margin:'0 auto', padding:'24px 20px 100px 20px', display:'flex', flexDirection:'column', gap:16 }}>

        {/* ── STEP 1: Select Teacher ── */}
        {!preloadAbsenceId && (
          <div style={card()}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
              <StepBadge n={1} done={!!selectedTeacher}/>
              <span style={{ fontFamily:H.font, fontWeight:900, fontSize:15, color:H.purple }}>Select Teacher</span>
            </div>

            <div style={{ position:'relative', marginBottom:10 }}>
              <Search size={13} style={{ position:'absolute', left:11, top:'50%', transform:'translateY(-50%)', color:H.sub, pointerEvents:'none' }}/>
              <input value={search} onChange={e=>{ setSearch(e.target.value); if(selectedTeacher&&e.target.value!==selectedTeacher.full_name) setSelectedTeacher(null) }}
                placeholder="Search teacher name…" style={inp({ paddingLeft:34 })}
                onFocus={e=>e.target.style.borderColor=H.purple} onBlur={e=>e.target.style.borderColor=H.border}/>
            </div>

            {search && !selectedTeacher && (
              <div style={{ borderRadius:12, border:`2px solid ${H.border}`, overflow:'hidden', maxHeight:220, overflowY:'auto' }}>
                {filteredTeachers.slice(0,8).map(t=>(
                  <button key={t.id} onClick={()=>selectTeacher(t)}
                    style={{ width:'100%', textAlign:'left', padding:'10px 14px', border:'none', borderBottom:`1px solid #F5F5F4`, background:H.surface, cursor:'pointer', display:'flex', alignItems:'center', gap:10, transition:'background 0.12s' }}
                    onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background='#F5F5F4'}
                    onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background=H.surface}>
                    <div style={{ width:32, height:32, borderRadius:'50%', background:`hsl(${(t.full_name.charCodeAt(0)*17)%360},50%,42%)`, color:'#fff', fontWeight:700, fontSize:13, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{t.full_name.charAt(0)}</div>
                    <div>
                      <div style={{ fontFamily:H.font, fontSize:13, fontWeight:700, color:H.text }}>{t.full_name}</div>
                      <div style={{ fontFamily:H.font, fontSize:11, color:H.sub }}>{(t.subjects||[]).slice(0,3).join(', ')}</div>
                    </div>
                  </button>
                ))}
                {filteredTeachers.length===0 && <div style={{ padding:16, textAlign:'center', fontFamily:H.font, fontSize:13, color:H.sub }}>No teachers found</div>}
              </div>
            )}

            {selectedTeacher && (
              <div style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', borderRadius:12, background:`${H.grass}12`, border:`2px solid ${H.grass}44` }}>
                <div style={{ width:38, height:38, borderRadius:'50%', background:`hsl(${(selectedTeacher.full_name.charCodeAt(0)*17)%360},50%,42%)`, color:'#fff', fontWeight:700, fontSize:15, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{selectedTeacher.full_name.charAt(0)}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontFamily:H.font, fontWeight:800, fontSize:14, color:H.text }}>{selectedTeacher.full_name}</div>
                  <div style={{ fontFamily:H.font, fontSize:11, color:H.sub }}>{(selectedTeacher.subjects||[]).join(', ')||'No subjects listed'}</div>
                </div>
                <CheckCircle2 size={18} color={H.grass}/>
              </div>
            )}
          </div>
        )}

        {/* ── STEP 2: Absence Details ── */}
        {!preloadAbsenceId && (
          <div style={card()}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
              <StepBadge n={2} done={!!absenceId}/>
              <span style={{ fontFamily:H.font, fontWeight:900, fontSize:15, color:H.purple }}>Absence Details</span>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>
              <div>
                <Label>Date</Label>
                <input type="date" value={form.absence_date} onChange={e=>setForm(f=>({...f,absence_date:e.target.value}))} style={inp()}
                  onFocus={e=>e.target.style.borderColor=H.purple} onBlur={e=>e.target.style.borderColor=H.border}/>
              </div>
              <div>
                <Label>Type</Label>
                <select value={form.absence_type} onChange={e=>setForm(f=>({...f,absence_type:e.target.value as any}))} style={{ ...inp(), cursor:'pointer', appearance:'none' as const }}>
                  <option value="full_day" style={{ background:H.surface }}>Full Day</option>
                  <option value="morning_block" style={{ background:H.surface }}>Morning Block</option>
                  <option value="afternoon_block" style={{ background:H.surface }}>Afternoon Block</option>
                  <option value="custom_periods" style={{ background:H.surface }}>Custom Periods</option>
                </select>
              </div>
            </div>

            {form.absence_type==='custom_periods' && periods.length>0 && (
              <div style={{ marginBottom:14 }}>
                <Label>Select Absent Periods</Label>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:6 }}>
                  {periods.map((p:any)=>(
                    <button key={p.period_number} onClick={()=>setForm(f=>({...f,custom_periods:f.custom_periods.includes(p.period_number)?f.custom_periods.filter(x=>x!==p.period_number):[...f.custom_periods,p.period_number].sort((a,b)=>a-b)}))}
                      style={{ width:42, height:42, borderRadius:10, border:`2px solid ${form.custom_periods.includes(p.period_number)?'#f87171':H.border}`, background:form.custom_periods.includes(p.period_number)?'rgba(239,68,68,0.15)':'#F5F5F4', fontFamily:H.font, fontWeight:900, fontSize:14, cursor:'pointer', color:form.custom_periods.includes(p.period_number)?'#f87171':H.text }}>
                      {p.period_number}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div style={{ marginBottom:14 }}>
              <Label>Reason <span style={{ fontWeight:400, textTransform:'none' as const, letterSpacing:0 }}>(optional)</span></Label>
              <input value={form.reason} onChange={e=>setForm(f=>({...f,reason:e.target.value}))} placeholder="e.g. Sick leave, Family emergency…" style={inp()}
                onFocus={e=>e.target.style.borderColor=H.purple} onBlur={e=>e.target.style.borderColor=H.border}/>
            </div>

            {error && (
              <div style={{ padding:'10px 14px', borderRadius:10, background:'rgba(239,68,68,0.1)', border:'2px solid rgba(239,68,68,0.3)', fontFamily:H.font, fontSize:13, color:'#f87171', marginBottom:14 }}>{error}</div>
            )}

            {!absenceId && (
              <button onClick={handleSubmit} disabled={loading||!form.teacher_id} style={hBtn({ opacity:loading||!form.teacher_id?0.5:1, cursor:loading||!form.teacher_id?'not-allowed':'pointer' })}>
                {loading ? <><Loader2 size={18} style={{ animation:'spin 0.7s linear infinite' }}/> Recording…</> : <><UserCheck size={18}/> Record Absence &amp; Find Cover</>}
              </button>
            )}
          </div>
        )}

        {/* ── STEP 3: Assign Cover ── */}
        {absenceId && (
          <div style={card()}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:10, marginBottom:12 }}>
              <div>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <StepBadge n={3}/>
                  <span style={{ fontFamily:H.font, fontWeight:900, fontSize:15, color:H.purple }}>Assign Cover &amp; Notify</span>
                </div>
                {form.absence_date && (
                  <div style={{ marginTop:4, marginLeft:36, fontFamily:H.font, fontSize:12, fontWeight:700, color:H.purple, display:'flex', alignItems:'center', gap:5 }}>
                    <CalendarDays size={13}/> Absence Date: {formatSLT(form.absence_date, 'EEEE, dd MMM yyyy')}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setConfirmCancel(v => !v)}
                style={{ background: H.dangerLight, color: H.danger, border: `1px solid ${H.danger}40`, borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}
              >
                <RotateCcw size={12} /> Undo / Cancel Absence
              </button>
            </div>

            {confirmCancel && (
              <div style={{ padding: '14px 16px', borderRadius: 12, background: H.dangerLight, border: `1px solid ${H.danger}40`, marginBottom: 16 }}>
                <div style={{ fontFamily: H.font, fontWeight: 700, fontSize: 13, color: H.danger, marginBottom: 4 }}>
                  Cancel &amp; Rollback this Absence?
                </div>
                <div style={{ fontFamily: H.font, fontSize: 12, color: H.textSec, marginBottom: 10 }}>
                  This will remove the recorded absence entry and reassign any cover teacher back to their normal timetable schedule.
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={handleCancelAbsence} disabled={canceling} style={{ background: H.danger, color: '#fff', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    {canceling ? <Loader2 size={12} style={{ animation: 'spin 0.7s linear infinite' }} /> : <RotateCcw size={12} />} Yes, Undo Absence
                  </button>
                  <button onClick={() => setConfirmCancel(false)} style={ghost({ padding: '6px 12px', fontSize: 12 })}>
                    Keep Absence
                  </button>
                </div>
              </div>
            )}

            <p style={{ fontFamily:H.font, fontSize:13, color:H.sub, marginBottom:16 }}>Assign cover teachers for period(s) held by <strong>{selectedTeacher?.full_name || 'absent teacher'}</strong>. Available teachers are listed with subject matches prioritized.</p>

            {loadingSugs ? (
              <div style={{ textAlign:'center', padding:32 }}><Loader2 size={20} style={{ color:H.purple, animation:'spin 0.7s linear infinite', margin:'0 auto' }}/></div>
            ) : Object.keys(suggestions).length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', background: '#F5F5F4', borderRadius: 12, border: `1px solid ${H.border}` }}>
                <CheckCircle2 size={28} style={{ color: H.grass, margin: '0 auto 8px' }} />
                <div style={{ fontFamily: H.font, fontWeight: 700, fontSize: 14, color: H.text }}>No Scheduled Classes to Cover</div>
                <div style={{ fontFamily: H.font, fontSize: 12, color: H.sub, marginTop: 4 }}>
                  {selectedTeacher?.full_name || 'This teacher'} has no teaching periods scheduled on this day.
                </div>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                {Object.keys(suggestions).map(Number).sort((a,b)=>a-b).map(pNum=>{
                  const sugs  = suggestions[pNum]||[]
                  const subId = assignedSubs[pNum]
                  const sub   = subId ? teachers.find(t=>t.id===subId) : null
                  const slot  = sugs[0]||{}

                  const pInfo = periods.find((p: any) => p.period_number === pNum)
                  const timeRangeStr = pInfo ? `${formatTime(pInfo.start_time)}–${formatTime(pInfo.end_time)}` : ''

                  const isOverride = !!manualOverride[pNum]
                  const rawCandidates: any[] = isOverride
                    ? teachers.filter(t => t.id !== selectedTeacher?.id).map(t => ({
                        ...t,
                        isFree: sugs.some(x => x.id === t.id),
                        sameSubject: (t.subjects || []).includes(slot.subject || ''),
                      }))
                    : sugs.map(t => ({ ...t, isFree: true }))

                  const subjectMatches = rawCandidates
                    .filter(t => t.sameSubject)
                    .sort((a, b) => a.full_name.localeCompare(b.full_name))

                  const otherCandidates = rawCandidates
                    .filter(t => !t.sameSubject)
                    .sort((a, b) => a.full_name.localeCompare(b.full_name))

                  const renderCandidatePill = (t: any) => {
                    const sel = subId === t.id
                    const isPillSaving = savingPill[pNum]
                    return (
                      <button key={t.id}
                        disabled={isPillSaving}
                        onClick={() => handleToggleCandidate(pNum, t, slot)}
                        style={{
                          padding: '7px 13px',
                          borderRadius: 20,
                          border: `2px solid ${sel ? H.grass : t.sameSubject ? H.purple : H.border}`,
                          cursor: isPillSaving ? 'wait' : 'pointer',
                          fontFamily: H.font,
                          fontSize: 12,
                          fontWeight: sel ? 800 : 500,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          transition: 'all 0.15s',
                          background: sel ? `${H.grass}20` : t.sameSubject ? 'rgba(139,92,246,0.12)' : '#F5F5F4',
                          color: sel ? H.grass : t.sameSubject ? H.purple : H.text,
                          opacity: isPillSaving ? 0.6 : t.isFree ? 1 : 0.65,
                        }}
                      >
                        {isPillSaving ? <Loader2 size={12} style={{ animation: 'spin 0.7s linear infinite' }} /> : sel ? <CheckCircle2 size={12} /> : t.sameSubject && <Star size={11} style={{ color: H.purple, fill: H.purple }} />}
                        <span>{t.full_name}</span>
                        {!t.isFree && <span style={{ fontSize: 10, color: '#f87171', fontWeight: 700 }}>(Busy P{pNum})</span>}
                        {t.sameSubject && t.isFree && !sel && <span style={{ fontSize: 10, opacity: 0.85, fontWeight: 700 }}>(★ Match)</span>}
                        {sel && <span style={{ fontSize: 10, opacity: 0.9, fontWeight: 800, color: H.grass }}>(Saved)</span>}
                      </button>
                    )
                  }

                  return (
                    <div key={pNum} style={{ borderRadius:14, border:`2px solid ${subId?H.grass:H.border}`, overflow:'hidden' }}>
                      {/* Period header */}
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', background:subId?`${H.grass}0a`:'#F5F5F4' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                          <div style={{ width:40, height:40, borderRadius:10, background:subId?H.grass:'rgba(239,68,68,0.15)', color:subId?'#fff':'#ef4444', fontFamily:H.font, fontWeight:900, fontSize:13, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, border:`2px solid ${subId?H.border:'rgba(239,68,68,0.3)'}` }}>
                            P{pNum}
                          </div>
                          <div>
                            <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                              <span style={{ fontFamily:H.font, fontSize:14, fontWeight:800, color:H.text }}>
                                Period {pNum} {timeRangeStr ? `· ${timeRangeStr}` : ''}
                              </span>
                              {slot.className && (
                                <span style={{ fontFamily:H.font, fontSize:12, fontWeight:700, color:H.text, background:H.surface, padding:'2px 8px', borderRadius:6, border:`1px solid ${H.border}` }}>
                                  {slot.className}
                                </span>
                              )}
                            </div>
                            <div style={{ display:'flex', alignItems:'center', gap:12, marginTop:3, flexWrap:'wrap' }}>
                              {slot.subject && (
                                <span style={{ fontFamily:H.font, fontSize:11, color:H.purple, fontWeight:700 }}>
                                  Subject: {slot.subject}
                                </span>
                              )}
                              <span style={{ fontFamily:H.font, fontSize:11, color:H.sub, fontWeight:600 }}>
                                Covering for: <strong style={{ color:H.text }}>{selectedTeacher?.full_name || 'Absent Teacher'}</strong>
                              </span>
                            </div>
                          </div>
                        </div>
                        {subId && (
                          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                            {notified[pNum]
                              ? <span style={{ fontFamily:H.font, fontSize:11, fontWeight:700, color:H.grass, display:'flex', alignItems:'center', gap:4 }}><CheckCircle2 size={12}/> Notified</span>
                              : <button onClick={()=>notifySubstitute(pNum)} disabled={notifying[pNum]}
                                  style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 12px', borderRadius:9, border:`2px solid #60a5fa44`, background:'rgba(96,165,250,0.1)', color:'#60a5fa', fontFamily:H.font, fontSize:12, fontWeight:700, cursor:'pointer' }}>
                                  {notifying[pNum]?<Loader2 size={11} style={{ animation:'spin 0.7s linear infinite' }}/>:<><Bell size={11}/> Notify {sub?.full_name?.split(' ')[0] || sub?.full_name}</>}
                                </button>
                            }
                          </div>
                        )}
                      </div>

                      {/* Teacher pills */}
                      <div style={{ padding:'14px 16px', background:H.surface, display:'flex', flexDirection:'column', gap:12 }}>
                        {rawCandidates.length === 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <div style={{ fontFamily: H.font, fontSize: 12, color: '#fb923c', display: 'flex', alignItems: 'center', gap: 6 }}>
                              <AlertTriangle size={13} /> No free teachers available for Period {pNum}
                            </div>
                            <button
                              type="button"
                              onClick={() => setManualOverride(p => ({ ...p, [pNum]: true }))}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 8, background: '#F5F5F4', border: `1px solid ${H.border}`, color: H.purple, fontSize: 11, fontWeight: 700, cursor: 'pointer', width: 'fit-content' }}
                            >
                              <ShieldAlert size={12} /> Manual Override / Show All Teachers
                            </button>
                          </div>
                        ) : (
                          <>
                            <div style={{ display:'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div style={{ fontSize: 11, fontWeight: 800, color: H.sub, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                {isOverride ? 'Manual Override Mode (Showing all teachers)' : 'Candidate Selection'}
                              </div>
                              <button
                                type="button"
                                onClick={() => setManualOverride(p => ({ ...p, [pNum]: !p[pNum] }))}
                                style={{ border: 'none', background: 'transparent', color: H.purple, fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                              >
                                <ShieldAlert size={11} /> {isOverride ? 'Show Only Free' : 'Manual Override'}
                              </button>
                            </div>

                            {/* Group 1: Same Subject Match */}
                            {subjectMatches.length > 0 && (
                              <div style={{ background: 'rgba(139,92,246,0.04)', borderRadius: 12, padding: '10px 12px', border: `1px solid rgba(139,92,246,0.2)` }}>
                                <div style={{ fontSize: 11, fontWeight: 800, color: H.purple, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                                  <Star size={12} style={{ color: H.purple, fill: H.purple }} />
                                  SAME SUBJECT MATCH ({subjectMatches.length}) {slot.subject ? `· ${slot.subject}` : ''}
                                </div>
                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                  {subjectMatches.map(t => renderCandidatePill(t))}
                                </div>
                               </div>
                            )}

                            {/* Group 2: Other Available Teachers */}
                            {otherCandidates.length > 0 && (
                              <div style={{ marginTop: subjectMatches.length > 0 ? 2 : 0 }}>
                                {subjectMatches.length > 0 && (
                                  <div style={{ fontSize: 11, fontWeight: 700, color: H.sub, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    Other Available Teachers ({otherCandidates.length})
                                  </div>
                                )}
                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                  {otherCandidates.map(t => renderCandidatePill(t))}
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {Object.keys(assignedSubs).length>0 && (
              <div style={{ marginTop:16, display:'flex', flexDirection:'column', gap:8 }}>
                {Object.keys(assignedSubs).some(p=>!notified[Number(p)]) && (
                  <button onClick={notifyAll}
                    style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'11px 16px', borderRadius:12, border:`2px solid #60a5fa44`, background:'rgba(96,165,250,0.12)', color:'#2563eb', fontFamily:H.font, fontSize:13, fontWeight:700, cursor:'pointer', width:'100%' }}>
                    <Send size={13}/> Notify all assigned substitutes ({Object.keys(assignedSubs).filter(p=>!notified[Number(p)]).length})
                  </button>
                )}
                <button onClick={()=>router.push('/admin/disruptions?tab=absences')} style={gBtn()}>
                  <CheckCircle2 size={16}/> Done — Return to Attendance & Coverage
                </button>
              </div>
            )}
            <button onClick={()=>router.push('/admin/disruptions?tab=absences')} style={ghost({ width:'100%', justifyContent:'center', marginTop:8, padding:'9px 16px' })}>
              {Object.keys(assignedSubs).length>0 ? 'Back to Dashboard' : 'Skip for now'}
            </button>
          </div>
        )}
      </main>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}*{box-sizing:border-box}::-webkit-scrollbar{width:5px}::-webkit-scrollbar-thumb{background:rgba(139,92,246,0.3);border-radius:99px}select option{background:#ffffff;color:#8b5cf6}`}</style>
    </div>
  )
}

export default function NewAbsencePage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: H.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Loader2 size={32} style={{ color: H.purple, animation: 'spin 0.7s linear infinite' }} /></div>}>
      <NewAbsenceContent />
    </Suspense>
  )
}
