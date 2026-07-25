'use client'
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, UserX, UserCheck, Loader2, Search, CheckCircle2, AlertTriangle, Star, Bell, Send, RotateCcw } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { todaySLT, generatePeriods } from '@/lib/utils'

import { H } from '@/lib/honey'

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
  const [loadingSugs, setLoadingSugs]         = useState(false)
  const [assignedSubs, setAssignedSubs]       = useState<Record<number,string>>({})
  const [savingSubs, setSavingSubs]           = useState(false)
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
          setTimeout(()=>loadSuggestionsFor(abs.teacher_id,abs.absence_date,abs.absence_type,abs.custom_periods||[],t||[],tmpl),100)
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

  const loadSuggestionsFor = async (teacherId:string, absenceDate:string, absenceType:string, customPeriods:number[], teacherList:any[], tmpl:any) => {
    setLoadingSugs(true)
    if (!tmpl) { setLoadingSugs(false); return }
    const allP = generatePeriods(tmpl.start_time,tmpl.end_time,tmpl.period_duration,tmpl.breaks||[]).filter((p:any)=>!p.is_break)
    const absent = absenceType==='full_day'?allP.map((p:any)=>p.period_number):absenceType==='morning_block'?allP.slice(0,Math.ceil(allP.length/2)).map((p:any)=>p.period_number):absenceType==='afternoon_block'?allP.slice(Math.ceil(allP.length/2)).map((p:any)=>p.period_number):customPeriods
    const dayOfWeek = Math.min(new Date(absenceDate+' 12:00').getDay()||7,5)
    const [{data:absentSlots},{data:allSlots}] = await Promise.all([
      supabase.from('schedule_assignments').select('period_number,subject,class_id,class:classes(name)').eq('teacher_id',teacherId).eq('day_of_week',dayOfWeek),
      supabase.from('schedule_assignments').select('teacher_id,period_number').eq('day_of_week',dayOfWeek),
    ])
    const busy:Record<number,Set<string>>={};
    for (const s of allSlots||[]) { if(!busy[s.period_number])busy[s.period_number]=new Set(); busy[s.period_number].add(s.teacher_id) }
    const newSugs:Record<number,any[]>={}
    for (const p of absent) {
      const slot:any=(absentSlots||[]).find((s:any)=>s.period_number===p)
      const free=teacherList.filter(t=>t.id!==teacherId&&!(busy[p]?.has(t.id)))
      newSugs[p]=free.map(t=>({...t,sameSubject:(t.subjects||[]).includes(slot?.subject||''),className:slot?.class?.name||'',subject:slot?.subject||'',classId:slot?.class_id||null})).sort((a,b)=>(b.sameSubject?1:0)-(a.sameSubject?1:0)||a.full_name.localeCompare(b.full_name)).slice(0,6)
    }
    setSuggestions(newSugs); setLoadingSugs(false)
  }

  const handleSubmit = async () => {
    if (!form.teacher_id) { setError('Please select a teacher'); return }
    setLoading(true); setError('')
    try {
      const {data:{session}}=await supabase.auth.getSession(); const user=session?.user
      const {data:existing}=await supabase.from('absences').select('id').eq('teacher_id',form.teacher_id).eq('absence_date',form.absence_date).maybeSingle()
      if (existing) { setError('Absence already recorded for this teacher on that date.'); return }
      const {data:abs,error:err}=await supabase.from('absences').insert({ teacher_id:form.teacher_id, absence_date:form.absence_date, absence_type:form.absence_type, custom_periods:form.absence_type==='custom_periods'?form.custom_periods:null, reason:form.reason||null, recorded_by:user?.id }).select().single()
      if (err) { setError(err.message); return }
      setAbsenceId(abs.id); await loadSuggestionsFor(form.teacher_id,form.absence_date,form.absence_type,form.custom_periods,teachers,template)
    } finally { setLoading(false) }
  }

  const saveSubstitutions = async () => {
    if (!absenceId) return; setSavingSubs(true)
    try {
      const dayOfWeek=Math.min(new Date(form.absence_date+' 12:00').getDay()||7,5)
      const {data:absentSlots}=await supabase.from('schedule_assignments').select('period_number,subject,class_id').eq('teacher_id',form.teacher_id).eq('day_of_week',dayOfWeek)
      const rows=Object.entries(assignedSubs).map(([pStr,subId])=>{
        const p=Number(pStr);
        const slot=(absentSlots||[]).find((s:any)=>s.period_number===p);
        return {
          absence_id: absenceId,
          substitute_teacher_id: subId,
          period_number: p,
          class_id: slot?.class_id || null,
          subject: slot?.subject || null,
        }
      })
      if (rows.length>0) {
        const { error: subErr } = await supabase.from('substitutions').insert(rows)
        if (subErr) throw subErr
      }
      setSuccess(true)
      setTimeout(()=>router.push('/admin/disruptions?tab=absences'),1500)
    } catch (err: any) {
      console.error('[saveSubstitutions] Error:', err)
      setError(err?.message || 'Failed to save period coverage.')
    } finally {
      setSavingSubs(false)
    }
  }

  const notifySubstitute = async (pNum:number) => {
    const subId=assignedSubs[pNum]; if(!subId||!selectedTeacher) return
    setNotifying(p=>({...p,[pNum]:true}))
    const sub=teachers.find(t=>t.id===subId); const slot=(suggestions[pNum]||[])[0]||{}
    const formattedDate=new Date(form.absence_date+'T12:00:00').toLocaleDateString('en-LK',{weekday:'long',day:'2-digit',month:'long'})
    await supabase.from('notifications').insert({ user_id:subId, type:'substitute_assigned', title:`Cover duty — Period ${pNum}`, body:`You are assigned to cover ${slot.className||'a class'}${slot.subject?` (${slot.subject})`:''} on ${formattedDate}. Covering for ${selectedTeacher.full_name}.`, link:'/teacher', is_read:false })
    await fetch('/api/notify/substitute',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({substitute_teacher_id:subId,substitute_name:sub?.full_name||'',absent_teacher_name:selectedTeacher.full_name,period_number:pNum,class_name:slot.className||'',subject:slot.subject||'',absence_date:form.absence_date})}).catch(()=>{})
    setNotifying(p=>({...p,[pNum]:false})); setNotified(p=>({...p,[pNum]:true}))
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
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <StepBadge n={3}/>
                <span style={{ fontFamily:H.font, fontWeight:900, fontSize:15, color:H.purple }}>Assign Cover &amp; Notify</span>
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

            <p style={{ fontFamily:H.font, fontSize:13, color:H.sub, marginBottom:16 }}>Click a teacher to assign them, then notify directly.</p>

            {loadingSugs ? (
              <div style={{ textAlign:'center', padding:32 }}><Loader2 size={20} style={{ color:H.purple, animation:'spin 0.7s linear infinite', margin:'0 auto' }}/></div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                {absentPeriods.map(pNum=>{
                  const sugs  = suggestions[pNum]||[]
                  const subId = assignedSubs[pNum]
                  const sub   = subId ? teachers.find(t=>t.id===subId) : null
                  const slot  = sugs[0]||{}
                  return (
                    <div key={pNum} style={{ borderRadius:14, border:`2px solid ${subId?H.grass:H.border}`, overflow:'hidden' }}>
                      {/* Period header */}
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 16px', background:subId?`${H.grass}0a`:'#F5F5F4' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                          <div style={{ width:32, height:32, borderRadius:9, background:subId?H.grass:'rgba(239,68,68,0.2)', color:subId?'#fff':'#f87171', fontFamily:H.font, fontWeight:900, fontSize:13, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, border:`2px solid ${subId?H.border:'rgba(239,68,68,0.4)'}` }}>P{pNum}</div>
                          <div>
                            <div style={{ fontFamily:H.font, fontSize:13, fontWeight:800, color:H.text }}>{slot.className||'—'}</div>
                            {slot.subject && <div style={{ fontFamily:H.font, fontSize:11, color:H.sub }}>{slot.subject}</div>}
                          </div>
                        </div>
                        {subId && (
                          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                            {notified[pNum]
                              ? <span style={{ fontFamily:H.font, fontSize:11, fontWeight:700, color:H.grass, display:'flex', alignItems:'center', gap:4 }}><CheckCircle2 size={12}/> Notified</span>
                              : <button onClick={()=>notifySubstitute(pNum)} disabled={notifying[pNum]}
                                  style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 12px', borderRadius:9, border:`2px solid #60a5fa44`, background:'rgba(96,165,250,0.1)', color:'#60a5fa', fontFamily:H.font, fontSize:12, fontWeight:700, cursor:'pointer' }}>
                                  {notifying[pNum]?<Loader2 size={11} style={{ animation:'spin 0.7s linear infinite' }}/>:<><Bell size={11}/> Notify {sub?.full_name.split(' ')[0]}</>}
                                </button>
                            }
                          </div>
                        )}
                      </div>

                      {/* Teacher pills */}
                      <div style={{ padding:'12px 16px', background:H.surface }}>
                        {sugs.length===0 ? (
                          <div style={{ fontFamily:H.font, fontSize:12, color:'#fb923c', display:'flex', alignItems:'center', gap:6 }}><AlertTriangle size={13}/> All teachers busy this period</div>
                        ) : (
                          <>
                            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                              {sugs.map(t=>{
                                const sel = subId===t.id
                                return (
                                  <button key={t.id} onClick={()=>{ setAssignedSubs(p=>({...p,[pNum]:sel?undefined!:t.id})); if(sel)setNotified(p=>({...p,[pNum]:false})) }}
                                    style={{ padding:'7px 13px', borderRadius:20, border:`2px solid ${sel?H.grass:t.sameSubject?H.purple:H.border}`, cursor:'pointer', fontFamily:H.font, fontSize:12, fontWeight:sel?800:500, display:'flex', alignItems:'center', gap:5, transition:'all 0.15s', background:sel?`${H.grass}20`:t.sameSubject?'rgba(139,92,246,0.12)':'#F5F5F4', color:sel?H.grass:t.sameSubject?H.purple:H.text }}>
                                    {sel ? <CheckCircle2 size={11}/> : t.sameSubject && <Star size={10} style={{ color:H.purple, fill:H.purple }}/>}
                                    {t.full_name.split(' ')[0]} {t.full_name.split(' ').slice(-1)[0]}
                                  </button>
                                )
                              })}
                            </div>
                            {sugs.some(t=>t.sameSubject) && <div style={{ marginTop:6, fontFamily:H.font, fontSize:11, color:H.sub, display:'flex', alignItems:'center', gap:4 }}><Star size={9} style={{ color:H.purple, fill:H.purple }}/> teaches this subject</div>}
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
                    style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'10px 16px', borderRadius:12, border:`2px solid #60a5fa44`, background:'rgba(96,165,250,0.08)', color:'#60a5fa', fontFamily:H.font, fontSize:13, fontWeight:700, cursor:'pointer', width:'100%' }}>
                    <Send size={13}/> Notify all assigned substitutes
                  </button>
                )}
                <button onClick={saveSubstitutions} disabled={savingSubs} style={gBtn({ opacity:savingSubs?0.7:1 })}>
                  {savingSubs ? <><Loader2 size={15} style={{ animation:'spin 0.7s linear infinite' }}/> Saving…</> : <><CheckCircle2 size={15}/> Save {Object.keys(assignedSubs).length} Substitution{Object.keys(assignedSubs).length!==1?'s':''}</>}
                </button>
              </div>
            )}
            <button onClick={()=>router.push('/admin/disruptions?tab=absences')} style={ghost({ width:'100%', justifyContent:'center', marginTop:8, padding:'9px 16px' })}>
              Skip for now
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
