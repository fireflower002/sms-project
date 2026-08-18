'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, GraduationCap, UserX, Loader2, Trash2, Edit2,
  CheckCircle2, XCircle, AlertCircle, Save, X, Users, CalendarDays, RefreshCw
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatSLT, generatePeriods } from '@/lib/utils'
import { H } from '@/lib/honey'
import { FormCardSkeleton } from '@/components/ui/Skeleton'

const card  = (x?:any):React.CSSProperties => ({ background:H.surface, borderRadius:16, border:`1px solid ${H.border}`, boxShadow:'0 2px 8px rgba(0,0,0,0.06)', overflow:'hidden', ...x })
const hBtn  = (x?:any):React.CSSProperties => ({ background:H.honey, color:'#FFFFFF', border:'none', borderRadius:10, fontFamily:H.font, fontWeight:700, fontSize:13, padding:'8px 16px', cursor:'pointer', display:'inline-flex', alignItems:'center', gap:6, textDecoration:'none', ...x })
const ghost = (x?:any):React.CSSProperties => ({ background:'#F5F5F4', color:H.muted, border:`1px solid ${H.border}`, borderRadius:8, fontFamily:H.font, fontWeight:600, fontSize:12, padding:'6px 12px', cursor:'pointer', display:'inline-flex', alignItems:'center', gap:5, textDecoration:'none', ...x })
const grass = (x?:any):React.CSSProperties => ({ background:H.grass, color:'#FFFFFF', border:'none', borderRadius:10, fontFamily:H.font, fontWeight:700, fontSize:13, padding:'8px 16px', cursor:'pointer', display:'inline-flex', alignItems:'center', gap:6, textDecoration:'none', ...x })
const inp   = (x?:any):React.CSSProperties => ({ width:'100%', padding:'10px 14px', background:H.bg, border:`1px solid ${H.border}`, borderRadius:8, color:H.text, fontFamily:H.font, fontWeight:600, fontSize:13, outline:'none', boxSizing:'border-box' as const, ...x })

const TYPE_LABEL: Record<string,string> = {
  full_day:'Full Day', morning_block:'Morning Block',
  afternoon_block:'Afternoon Block', custom_periods:'Custom Periods',
}
const TYPE_COLOR: Record<string,string> = {
  full_day:'#ef4444', morning_block:'#f97316',
  afternoon_block:'#8b5cf6', custom_periods:'#3b82f6',
}

export default function AbsenceDetailClient({ absenceId, initialData }: { absenceId: string; initialData?: any }) {
  const router  = useRouter()
  const supabase = createClient()

  const [absence, setAbsence]       = useState<any>(initialData?.absence || null)
  const [subs, setSubs]             = useState<any[]>(initialData?.subs || [])
  const [allTeachers, setAllTeachers] = useState<any[]>(initialData?.allTeachers || [])
  const [template, setTemplate]     = useState<any>(initialData?.template || null)
  const [loading, setLoading]       = useState(!initialData)
  const [error, setError]           = useState('')

  // Edit mode
  const [editing, setEditing]       = useState(false)
  const [editForm, setEditForm]     = useState<any>(initialData?.absence ? {
    absence_date: initialData.absence.absence_date,
    absence_type: initialData.absence.absence_type,
    custom_periods: initialData.absence.custom_periods || [],
    reason: initialData.absence.reason || '',
  } : {})
  const [saving, setSaving]         = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Delete
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting]     = useState(false)

  // Reassign sub
  const [reassigning, setReassigning] = useState<string|null>(null)
  const [reassignTeacher, setReassignTeacher] = useState<Record<string,string>>({})
  const [savingReassign, setSavingReassign] = useState<string|null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [{ data: abs }, { data: subData }, { data: teachers }, { data: tmpl }] = await Promise.all([
      supabase.from('absences')
        .select('*, teacher:profiles!teacher_id(id,full_name,email,subjects)')
        .eq('id', absenceId).maybeSingle(),
      supabase.from('substitutions')
        .select('*, substitute:profiles!substitute_teacher_id(id,full_name), class:classes!class_id(name)')
        .eq('absence_id', absenceId)
        .order('period_number'),
      supabase.from('profiles').select('id,full_name,subjects').eq('role','teacher').eq('is_active',true).order('full_name'),
      supabase.from('timetable_templates').select('*').eq('is_active',true).maybeSingle(),
    ])
    if (!abs) { router.push('/admin/disruptions?tab=absences'); return }
    setAbsence(abs)
    setSubs(subData || [])
    setAllTeachers(teachers || [])
    setTemplate(tmpl || null)
    setEditForm({
      absence_date: abs.absence_date,
      absence_type: abs.absence_type,
      custom_periods: abs.custom_periods || [],
      reason: abs.reason || '',
    })
    setLoading(false)
  }, [absenceId, supabase, router])

  useEffect(() => {
    if (!initialData) fetchData()
  }, [initialData, fetchData])

  const periods = template
    ? generatePeriods(template.start_time, template.end_time, template.period_duration, template.breaks || [])
        .filter((p: any) => !p.is_break)
    : []

  const handleSave = async () => {
    setSaving(true); setError('')
    const { error: e } = await supabase.from('absences').update({
      absence_date:   editForm.absence_date,
      absence_type:   editForm.absence_type,
      custom_periods: editForm.absence_type === 'custom_periods' ? editForm.custom_periods : null,
      reason:         editForm.reason || null,
    }).eq('id', absenceId)

    if (e) { setError('Failed to update absence: '+e.message); setSaving(false); return }
    setSaving(false); setEditing(false); setSaveSuccess(true)
    setTimeout(()=>setSaveSuccess(false),3000)
    fetchData()
  }

  const handleDelete = async () => {
    setDeleting(true)
    const { error: e } = await supabase.from('absences').delete().eq('id', absenceId)
    if (e) { setError('Failed to delete: '+e.message); setDeleting(false); return }
    router.push('/admin/disruptions?tab=absences')
  }

  const handleReassign = async (subId: string) => {
    const newTeacherId = reassignTeacher[subId]
    if (!newTeacherId) return
    setSavingReassign(subId)
    const { error: e } = await supabase.from('substitutions').update({
      substitute_teacher_id: newTeacherId,
      status: 'assigned',
    }).eq('id', subId)
    setSavingReassign(null); setReassigning(null)
    if (e) setError('Reassign failed: '+e.message)
    else fetchData()
  }

  if (loading) return <FormCardSkeleton />
  if (!absence) return null

  const isPast = new Date(absence.absence_date) < new Date(new Date().toDateString())

  return (
    <div style={{ minHeight:'100vh', background:H.bg, fontFamily:H.font, color:H.text }}>
      {/* Header Bar */}
      <header style={{ height:64, padding:'0 24px', display:'flex', alignItems:'center', justifyContent:'space-between', borderBottom:`1px solid ${H.border}`, background:H.surface }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <Link href="/admin/disruptions?tab=absences" style={{ ...ghost(), padding:'8px 12px' }}>
            <ArrowLeft size={16}/> Back
          </Link>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <h1 style={{ fontFamily:H.font, fontSize:16, fontWeight:800, color:H.text, margin:0 }}>
                {absence.teacher?.full_name}’s Absence
              </h1>
              <span style={{ padding:'2px 8px', borderRadius:99, fontSize:11, fontWeight:800, background:`${TYPE_COLOR[absence.absence_type]}18`, color:TYPE_COLOR[absence.absence_type], border:`1px solid ${TYPE_COLOR[absence.absence_type]}40` }}>
                {TYPE_LABEL[absence.absence_type]}
              </span>
            </div>
            <span style={{ fontSize:11, color:H.sub }}>
              Date: {absence.absence_date} • Created {formatSLT(absence.created_at, 'dd MMM yyyy, h:mm a')}
            </span>
          </div>
        </div>

        <div style={{ display:'flex', gap:8 }}>
          {!editing ? (
            <button onClick={()=>setEditing(true)} style={ghost()}>
              <Edit2 size={14}/> Edit Record
            </button>
          ) : (
            <button onClick={()=>setEditing(false)} style={ghost()}>
              <X size={14}/> Cancel Edit
            </button>
          )}
          <button onClick={()=>setConfirmDelete(true)} style={{ ...ghost(), color:'#ef4444', borderColor:'rgba(239,68,68,0.3)', background:'rgba(239,68,68,0.06)' }}>
            <Trash2 size={14}/> Delete
          </button>
        </div>
      </header>

      {/* Main Body */}
      <main style={{ maxWidth:900, margin:'0 auto', padding:'24px 20px 80px 20px', display:'flex', flexDirection:'column', gap:20 }}>

        {error && (
          <div style={{ padding:'12px 16px', borderRadius:10, background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', color:'#ef4444', fontSize:13, fontWeight:700, display:'flex', alignItems:'center', gap:8 }}>
            <AlertCircle size={16}/> {error}
          </div>
        )}

        {saveSuccess && (
          <div style={{ padding:'12px 16px', borderRadius:10, background:'rgba(143,179,57,0.1)', border:'1px solid rgba(143,179,57,0.3)', color:H.grass, fontSize:13, fontWeight:700, display:'flex', alignItems:'center', gap:8 }}>
            <CheckCircle2 size={16}/> Absence updated successfully.
          </div>
        )}

        {/* Delete Confirmation Card */}
        {confirmDelete && (
          <div style={card({ padding:20, borderColor:'rgba(239,68,68,0.4)', background:'rgba(239,68,68,0.04)', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12 })}>
            <div>
              <div style={{ fontWeight:800, fontSize:14, color:'#ef4444' }}>Confirm Deletion</div>
              <div style={{ fontSize:12, color:H.sub }}>Deleting this absence will also remove all associated substitution assignments.</div>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={()=>setConfirmDelete(false)} style={ghost()}>Cancel</button>
              <button onClick={handleDelete} disabled={deleting} style={{ ...ghost(), background:'#ef4444', color:'#fff', borderColor:'#ef4444', fontWeight:800 }}>
                {deleting ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        )}

        {/* Info or Edit Form Card */}
        {!editing ? (
          <div style={card({ padding:24, display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:20 })}>
            <div>
              <div style={{ fontSize:11, fontWeight:800, color:H.sub, textTransform:'uppercase', letterSpacing:'0.06em' }}>Teacher</div>
              <div style={{ fontSize:15, fontWeight:800, color:H.text, marginTop:4 }}>{absence.teacher?.full_name}</div>
              <div style={{ fontSize:12, color:H.sub }}>{absence.teacher?.email}</div>
            </div>
            <div>
              <div style={{ fontSize:11, fontWeight:800, color:H.sub, textTransform:'uppercase', letterSpacing:'0.06em' }}>Absence Date</div>
              <div style={{ fontSize:15, fontWeight:800, color:H.text, marginTop:4, display:'flex', alignItems:'center', gap:6 }}>
                <CalendarDays size={16} color={H.honey}/> {absence.absence_date}
                {isPast && <span style={{ fontSize:10, fontWeight:700, color:H.sub, background:H.bg, padding:'2px 6px', borderRadius:4 }}>Past</span>}
              </div>
            </div>
            <div>
              <div style={{ fontSize:11, fontWeight:800, color:H.sub, textTransform:'uppercase', letterSpacing:'0.06em' }}>Type & Coverage</div>
              <div style={{ fontSize:14, fontWeight:700, color:TYPE_COLOR[absence.absence_type], marginTop:4 }}>
                {TYPE_LABEL[absence.absence_type]}
              </div>
              {absence.absence_type === 'custom_periods' && absence.custom_periods && (
                <div style={{ fontSize:12, color:H.sub, marginTop:2 }}>
                  Periods: {absence.custom_periods.join(', ')}
                </div>
              )}
            </div>
            {absence.reason && (
              <div style={{ gridColumn:'1 / -1' }}>
                <div style={{ fontSize:11, fontWeight:800, color:H.sub, textTransform:'uppercase', letterSpacing:'0.06em' }}>Reason / Notes</div>
                <div style={{ fontSize:13, color:H.text, marginTop:4, background:H.bg, padding:'10px 14px', borderRadius:8, border:`1px solid ${H.border}` }}>
                  {absence.reason}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* EDIT FORM */
          <div style={card({ padding:24, display:'flex', flexDirection:'column', gap:16 })}>
            <div style={{ fontSize:14, fontWeight:800, color:H.text }}>Edit Absence Details</div>

            <div>
              <label style={{ display:'block', fontSize:11, fontWeight:800, color:H.sub, textTransform:'uppercase', marginBottom:6 }}>Absence Date</label>
              <input type="date" value={editForm.absence_date} onChange={e=>setEditForm({...editForm, absence_date:e.target.value})} style={inp()}/>
            </div>

            <div>
              <label style={{ display:'block', fontSize:11, fontWeight:800, color:H.sub, textTransform:'uppercase', marginBottom:6 }}>Absence Type</label>
              <select value={editForm.absence_type} onChange={e=>setEditForm({...editForm, absence_type:e.target.value})} style={inp()}>
                <option value="full_day">Full Day</option>
                <option value="morning_block">Morning Block (P1–P4)</option>
                <option value="afternoon_block">Afternoon Block (P5–P8)</option>
                <option value="custom_periods">Custom Periods</option>
              </select>
            </div>

            {editForm.absence_type === 'custom_periods' && (
              <div>
                <label style={{ display:'block', fontSize:11, fontWeight:800, color:H.sub, textTransform:'uppercase', marginBottom:6 }}>Select Periods</label>
                <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                  {[1,2,3,4,5,6,7,8].map(p => {
                    const sel = (editForm.custom_periods || []).includes(p)
                    return (
                      <button key={p} type="button" onClick={() => {
                        const cur = editForm.custom_periods || []
                        const next = sel ? cur.filter((x:number)=>x!==p) : [...cur, p]
                        setEditForm({...editForm, custom_periods: next.sort()})
                      }} style={{ width:36, height:36, borderRadius:8, border:`2px solid ${sel ? H.honey : H.border}`, background:sel ? 'rgba(24,24,27,0.08)' : H.bg, color:sel ? H.honey : H.text, fontWeight:800, cursor:'pointer' }}>
                        P{p}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            <div>
              <label style={{ display:'block', fontSize:11, fontWeight:800, color:H.sub, textTransform:'uppercase', marginBottom:6 }}>Reason / Note</label>
              <textarea rows={3} value={editForm.reason} onChange={e=>setEditForm({...editForm, reason:e.target.value})} style={{ ...inp(), resize:'none' }} placeholder="Optional reason..."/>
            </div>

            <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:8 }}>
              <button onClick={()=>setEditing(false)} style={ghost()}>Cancel</button>
              <button onClick={handleSave} disabled={saving} style={hBtn()}>
                {saving ? <Loader2 size={14} style={{ animation:'spin 0.7s linear infinite' }}/> : <Save size={14}/>} Save Changes
              </button>
            </div>
          </div>
        )}

        {/* Substitutions Section Card */}
        <div style={card({ padding:24, display:'flex', flexDirection:'column', gap:16 })}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div>
              <div style={{ fontSize:15, fontWeight:800, color:H.text }}>Covering Substitutions ({subs.length})</div>
              <div style={{ fontSize:12, color:H.sub }}>Assigned substitute teachers covering affected classes</div>
            </div>
            <button onClick={fetchData} style={ghost()}><RefreshCw size={12}/> Refresh</button>
          </div>

          {subs.length === 0 ? (
            <div style={{ padding:'24px 0', textAlign:'center', color:H.sub, fontSize:13 }}>
              No substitution assignments generated for this absence.
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {subs.map((s: any) => {
                const isReassign = reassigning === s.id
                return (
                  <div key={s.id} style={{ padding:'12px 16px', borderRadius:10, background:H.bg, border:`1px solid ${H.border}`, display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
                    <div>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <span style={{ fontSize:13, fontWeight:800, color:H.text }}>Period {s.period_number}</span>
                        <span style={{ fontSize:12, fontWeight:700, color:H.textPrimary, background:'#F4F4F5', padding:'2px 8px', borderRadius:6 }}>
                          {s.class?.name || 'Class'}
                        </span>
                        <span style={{ fontSize:11, color:H.sub }}>{s.subject}</span>
                      </div>
                      <div style={{ fontSize:12, color:H.sub, marginTop:4, display:'flex', alignItems:'center', gap:6 }}>
                        Sub: <strong style={{ color: s.substitute ? H.text : '#ef4444' }}>{s.substitute?.full_name || 'Unassigned'}</strong>
                      </div>
                    </div>

                    <div>
                      {!isReassign ? (
                        <button onClick={()=>setReassigning(s.id)} style={{ ...ghost(), fontSize:11, padding:'4px 10px' }}>
                          Change Sub
                        </button>
                      ) : (
                        <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                          <select value={reassignTeacher[s.id] || ''} onChange={e=>setReassignTeacher({...reassignTeacher, [s.id]:e.target.value})} style={{ ...inp(), padding:'4px 8px', fontSize:12, width:160 }}>
                            <option value="">Select teacher...</option>
                            {allTeachers.map(t=>(
                              <option key={t.id} value={t.id}>{t.full_name}</option>
                            ))}
                          </select>
                          <button onClick={()=>handleReassign(s.id)} disabled={savingReassign === s.id} style={{ ...hBtn(), padding:'4px 10px', fontSize:11 }}>
                            {savingReassign === s.id ? '...' : 'Save'}
                          </button>
                          <button onClick={()=>setReassigning(null)} style={{ ...ghost(), padding:'4px 8px' }}><X size={12}/></button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

      </main>
    </div>
  )
}
