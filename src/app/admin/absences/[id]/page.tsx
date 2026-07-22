'use client'
import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, GraduationCap, UserX, Loader2, Trash2, Edit2,
  CheckCircle2, XCircle, AlertCircle, Save, X, Users, CalendarDays, RefreshCw
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatSLT, generatePeriods } from '@/lib/utils'

import { H } from '@/lib/honey'

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

export default function AbsenceDetailPage() {
  const params  = useParams()
  const router  = useRouter()
  const id      = params.id as string
  const supabase = createClient()

  const [absence, setAbsence]       = useState<any>(null)
  const [subs, setSubs]             = useState<any[]>([])
  const [allTeachers, setAllTeachers] = useState<any[]>([])
  const [template, setTemplate]     = useState<any>(null)
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')

  // Edit mode
  const [editing, setEditing]       = useState(false)
  const [editForm, setEditForm]     = useState<any>({})
  const [saving, setSaving]         = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Delete
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting]     = useState(false)

  // Reassign sub
  const [reassigning, setReassigning] = useState<string|null>(null) // sub id
  const [reassignTeacher, setReassignTeacher] = useState<Record<string,string>>({})
  const [savingReassign, setSavingReassign] = useState<string|null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [{ data: abs }, { data: subData }, { data: teachers }, { data: tmpl }] = await Promise.all([
      supabase.from('absences')
        .select('*, teacher:profiles!teacher_id(id,full_name,email,subjects)')
        .eq('id', id).maybeSingle(),
      supabase.from('substitutions')
        .select('*, substitute:profiles!substitute_teacher_id(id,full_name), class:classes!class_id(name), original:profiles!original_teacher_id(full_name)')
        .eq('absence_id', id)
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
  }, [id])

  useEffect(() => { fetchData() }, [fetchData])

  const periods = template
    ? generatePeriods(template.start_time, template.end_time, template.period_duration, template.breaks || [])
        .filter((p: any) => !p.is_break)
    : []

  // ── Edit absence ──────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true); setError('')
    const { error: e } = await supabase.from('absences').update({
      absence_date:   editForm.absence_date,
      absence_type:   editForm.absence_type,
      custom_periods: editForm.absence_type === 'custom_periods' ? editForm.custom_periods : null,
      reason:         editForm.reason || null,
    }).eq('id', id)
    if (e) { setError(`Save failed: ${e.message}`); setSaving(false); return }
    setSaving(false); setEditing(false); setSaveSuccess(true)
    setTimeout(() => setSaveSuccess(false), 3000)
    fetchData()
  }

  const toggleCustomPeriod = (n: number) => {
    setEditForm((p: any) => ({
      ...p,
      custom_periods: p.custom_periods.includes(n)
        ? p.custom_periods.filter((x: number) => x !== n)
        : [...p.custom_periods, n].sort((a: number, b: number) => a - b),
    }))
  }

  // ── Delete absence ────────────────────────────────────────
  const handleDelete = async () => {
    setDeleting(true)
    // Substitutions cascade via FK, but let's delete explicitly
    await supabase.from('substitutions').delete().eq('absence_id', id)
    const { error: e } = await supabase.from('absences').delete().eq('id', id)
    if (e) { setError(`Delete failed: ${e.message}`); setDeleting(false); return }
    router.push('/admin/disruptions?tab=absences')
  }

  // ── Reassign substitution ─────────────────────────────────
  const handleReassign = async (subId: string) => {
    const newTeacherId = reassignTeacher[subId]
    if (!newTeacherId) return
    setSavingReassign(subId)
    const { error: e } = await supabase.from('substitutions').update({
      substitute_teacher_id: newTeacherId,
      status: 'assigned',
    }).eq('id', subId)
    if (e) { setError(`Reassign failed: ${e.message}`) }
    else { setReassigning(null) }
    setSavingReassign(null)
    fetchData()
  }

  const handleRemoveSub = async (subId: string) => {
    await supabase.from('substitutions').delete().eq('id', subId)
    fetchData()
  }

  if (loading) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:H.bg }}>
      <Loader2 size={24} style={{ animation:'spin 0.7s linear infinite', color:H.muted }}/>
    </div>
  )

  if (!absence) return null

  const typeColor = TYPE_COLOR[absence.absence_type] || '#64748b'
  const coveredCount = subs.filter(s => s.status !== 'cancelled').length

  return (
    <div style={{ minHeight:'100vh', background:H.bg, fontFamily:H.font, color:H.text }}>
      <header style={{ position:'sticky', top:0, zIndex:50, background:H.surface, backdropFilter:'blur(12px)', borderBottom:`1px solid ${H.border}` }}>
        <div style={{ maxWidth:1400, margin:'0 auto', padding:'0 28px', display:'flex', alignItems:'center', justifyContent:'space-between', height:64 }}>
          <div className="flex items-center gap-3">
            <Link href="/admin/disruptions?tab=absences" style={ghost({ padding:'6px 10px', fontSize:12 })}><ArrowLeft size={16}/></Link>
            <div style={{ width:32, height:32, borderRadius:8, background:H.surface, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <GraduationCap size={16} style={{ color:H.honey }}/>
            </div>
            <div>
              <div style={{ fontWeight:800, fontSize:'14px' }}>Absence Detail</div>
              <div style={{ fontSize:'11px', color:H.sub }}>{absence.teacher?.full_name}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            
            <button onClick={fetchData} style={ghost({ padding:'6px 10px', fontSize:12 })}><RefreshCw size={14}/></button>
            {!editing && (
              <>
                <button onClick={() => setEditing(true)} style={ghost({ padding:'6px 12px', fontSize:12 })}>
                  <Edit2 size={13}/> Edit
                </button>
                <button onClick={() => setConfirmDelete(true)} style={{ background:"rgba(239,68,68,0.12)", color:"#f87171", border:"2px solid rgba(239,68,68,0.3)", borderRadius:10, fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:700, fontSize:12, padding:"6px 12px", cursor:"pointer", display:"inline-flex", alignItems:"center", gap:5 }}>
                  <Trash2 size={13}/> Delete
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <main style={{ maxWidth:720, margin:'0 auto', padding:'24px 28px', display:'flex', flexDirection:'column', gap:16, fontFamily:H.font, color:H.text }}>

        {/* Error */}
        {error && (
          <div style={{ display:'flex', gap:'8px', padding:'10px 14px', borderRadius:'10px', background:'#fee2e2', border:'1px solid #fca5a5' }}>
            <AlertCircle size={14} style={{ color:'#b91c1c', flexShrink:0 }}/>
            <span style={{ fontSize:'13px', color:'#b91c1c' }}>{error}</span>
          </div>
        )}

        {/* Save success */}
        {saveSuccess && (
          <div style={{ display:'flex', gap:'8px', padding:'10px 14px', borderRadius:'10px', background:'rgb(34 197 94/0.1)', border:'1px solid rgb(34 197 94/0.3)' }}>
            <CheckCircle2 size={14} style={{ color:'#16a34a' }}/>
            <span style={{ fontSize:'13px', color:'#16a34a', fontWeight:600 }}>Absence updated successfully</span>
          </div>
        )}

        {/* Delete confirm */}
        {confirmDelete && (
          <div style={{ padding:'16px 20px', borderRadius:'12px', background:'#fee2e2', border:'2px solid #fca5a5' }}>
            <div style={{ fontWeight:700, fontSize:'14px', color:'#b91c1c', marginBottom:'8px' }}>
              Delete this absence record?
            </div>
            <div style={{ fontSize:'12px', color:'#dc2626', marginBottom:'14px' }}>
              This will also delete all {subs.length} substitution assignment{subs.length !== 1 ? 's' : ''} linked to it. This cannot be undone.
            </div>
            <div style={{ display:'flex', gap:'8px' }}>
              <button onClick={handleDelete} disabled={deleting} style={{ background:"rgba(239,68,68,0.12)", color:"#f87171", border:"2px solid rgba(239,68,68,0.3)", borderRadius:10, fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:700, fontSize:12, padding:"6px 12px", cursor:"pointer", display:"inline-flex", alignItems:"center", gap:5 }}>
                {deleting ? <Loader2 size={13} style={{ animation:'spin 0.7s linear infinite' }}/> : <><Trash2 size={13}/> Yes, Delete</>}
              </button>
              <button onClick={() => setConfirmDelete(false)} style={ghost({ padding:'6px 12px', fontSize:12 })}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Teacher card */}
        <div style={{ ...card(), display:'flex', alignItems:'center', gap:'14px', padding:'16px 20px' }}>
          <div style={{ width:48, height:48, borderRadius:'50%', background:`hsl(${(absence.teacher?.full_name?.charCodeAt(0)*17)%360},50%,42%)`, color:'white', fontWeight:800, fontSize:'18px', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            {absence.teacher?.full_name?.charAt(0)}
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:800, fontSize:'16px' }}>{absence.teacher?.full_name}</div>
            <div style={{ fontSize:'12px', color:H.sub, marginTop:'2px' }}>
              {absence.teacher?.email}
            </div>
            {absence.teacher?.subjects?.length > 0 && (
              <div style={{ display:'flex', gap:'4px', marginTop:'6px', flexWrap:'wrap' }}>
                {absence.teacher.subjects.map((s: string) => (
                  <span key={s} style={{ fontSize:'10px', fontWeight:700, padding:'2px 8px', borderRadius:'10px', background:'rgb(99 102 241/0.1)', color:'#6366f1' }}>{s}</span>
                ))}
              </div>
            )}
          </div>
          <div style={{ textAlign:'right', flexShrink:0 }}>
            {coveredCount > 0
              ? <span style={{ fontSize:'11px', fontWeight:700, padding:'4px 10px', borderRadius:'20px', background:'rgb(34 197 94/0.1)', color:'#16a34a' }}>✓ {coveredCount} covered</span>
              : <span style={{ fontSize:'11px', fontWeight:700, padding:'4px 10px', borderRadius:'20px', background:'rgb(245 158 11/0.1)', color:'#d97706' }}>⚠ Needs cover</span>
            }
          </div>
        </div>

        {/* Absence details — view or edit */}
        {editing ? (
          <div style={{ ...card(), display:'flex', flexDirection:'column', gap:'14px' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <span style={{ fontWeight:700, fontSize:'14px', display:'flex', alignItems:'center', gap:'8px' }}>
                <Edit2 size={14} style={{ color:'#6366f1' }}/> Edit Absence
              </span>
              <button onClick={() => setEditing(false)} style={{ background:'none', border:'none', cursor:'pointer', color:H.muted }}>
                <X size={16}/>
              </button>
            </div>

            <div>
              <label style={{ display:'block', fontFamily:H.font, fontSize:11, fontWeight:800, color:H.sub, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:6 }}>Date</label>
              <input type="date" style={inp()} value={editForm.absence_date}
                onChange={e => setEditForm((p: any) => ({ ...p, absence_date: e.target.value }))}/>
            </div>

            <div>
              <label style={{ display:'block', fontFamily:H.font, fontSize:11, fontWeight:800, color:H.sub, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:6 }}>Absence Type</label>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px' }}>
                {Object.entries(TYPE_LABEL).map(([v, l]) => (
                  <button key={v} type="button" onClick={() => setEditForm((p: any) => ({ ...p, absence_type: v }))}
                    style={{ padding:'10px 12px', borderRadius:'10px', border:'2px solid', borderColor: editForm.absence_type === v ? TYPE_COLOR[v] : H.border, background: editForm.absence_type === v ? `${TYPE_COLOR[v]}12` : 'rgba(61,43,31,0.35)', cursor:'pointer', textAlign:'left' }}>
                    <div style={{ fontSize:'12px', fontWeight:700, color: editForm.absence_type === v ? TYPE_COLOR[v] : H.text }}>{l}</div>
                  </button>
                ))}
              </div>
            </div>

            {editForm.absence_type === 'custom_periods' && (
              <div>
                <label style={{ display:'block', fontFamily:H.font, fontSize:11, fontWeight:800, color:H.sub, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:6 }}>Absent Periods</label>
                <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
                  {periods.map((p: any) => (
                    <button key={p.period_number} type="button"
                      onClick={() => toggleCustomPeriod(p.period_number)}
                      style={{ width:36, height:36, borderRadius:'8px', border:'2px solid', borderColor: editForm.custom_periods.includes(p.period_number) ? '#3b82f6' : H.border, background: editForm.custom_periods.includes(p.period_number) ? '#3b82f6' : 'rgba(61,43,31,0.35)', color: editForm.custom_periods.includes(p.period_number) ? 'white' : H.text, fontWeight:700, fontSize:'13px', cursor:'pointer' }}>
                      {p.period_number}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label style={{ display:'block', fontFamily:H.font, fontSize:11, fontWeight:800, color:H.sub, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:6 }}>Reason</label>
              <input style={inp()} value={editForm.reason} placeholder="e.g. Sick leave"
                onChange={e => setEditForm((p: any) => ({ ...p, reason: e.target.value }))}/>
            </div>

            <div style={{ display:'flex', gap:'8px' }}>
              <button onClick={handleSave} disabled={saving} style={hBtn()}>
                {saving ? <Loader2 size={14} style={{ animation:'spin 0.7s linear infinite' }}/> : <><Save size={14}/> Save Changes</>}
              </button>
              <button onClick={() => setEditing(false)} style={ghost()}>Cancel</button>
            </div>
          </div>
        ) : (
          <div style={{ ...card(), display:'grid', gridTemplateColumns:'1fr 1fr', gap:'14px', padding:'16px 20px' }}>
            <div>
              <div style={{ fontSize:'11px', fontWeight:700, color:H.sub, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'4px' }}>Date</div>
              <div style={{ fontWeight:700, fontSize:'15px', display:'flex', alignItems:'center', gap:'6px' }}>
                <CalendarDays size={14} style={{ color:'#6366f1' }}/>
                {formatSLT(absence.absence_date + 'T00:00:00', 'EEEE, dd MMM yyyy')}
              </div>
            </div>
            <div>
              <div style={{ fontSize:'11px', fontWeight:700, color:H.sub, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'4px' }}>Type</div>
              <span style={{ fontSize:'13px', fontWeight:700, padding:'4px 12px', borderRadius:'20px', background:`${typeColor}12`, color:typeColor }}>
                {TYPE_LABEL[absence.absence_type]}
              </span>
            </div>
            {absence.reason && (
              <div style={{ gridColumn:'span 2' }}>
                <div style={{ fontSize:'11px', fontWeight:700, color:H.sub, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'4px' }}>Reason</div>
                <div style={{ fontSize:'13px' }}>{absence.reason}</div>
              </div>
            )}
            {absence.custom_periods?.length > 0 && (
              <div style={{ gridColumn:'span 2' }}>
                <div style={{ fontSize:'11px', fontWeight:700, color:H.sub, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'6px' }}>Absent Periods</div>
                <div style={{ display:'flex', gap:'6px' }}>
                  {absence.custom_periods.map((n: number) => (
                    <span key={n} style={{ width:32, height:32, borderRadius:'8px', background:'rgb(59 130 246/0.1)', color:'#3b82f6', fontWeight:700, fontSize:'13px', display:'flex', alignItems:'center', justifyContent:'center' }}>
                      {n}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div style={{ gridColumn:'span 2', fontSize:'11px', color:H.muted }}>
              Recorded {formatSLT(absence.created_at, 'dd MMM yyyy, h:mm a')}
            </div>
          </div>
        )}

        {/* Substitutions */}
        <div style={{ ...card(), padding:0, overflow:'hidden' }}>
          <div style={{ padding:'12px 16px', borderBottom:'1px solid', borderColor:H.border, display:'flex', alignItems:'center', gap:'8px' }}>
            <Users size={15} style={{ color:'#f97316' }}/>
            <span style={{ fontWeight:700, fontSize:'13px' }}>Substitutions</span>
            <span style={{ fontSize:'12px', color:H.muted, marginLeft:'4px' }}>{subs.length} period{subs.length !== 1 ? 's' : ''}</span>
            <Link href={`/admin/absences/new?absence_id=${id}`} style={{ ...ghost({ padding:'6px 12px', fontSize:12 }), marginLeft:'auto', fontSize:'11px' }}>
              + Add Cover
            </Link>
          </div>

          {subs.length === 0 ? (
            <div style={{ padding:'32px', textAlign:'center', color:H.muted }}>
              <Users size={28} style={{ margin:'0 auto 10px', opacity:0.4 }}/>
              <div style={{ fontSize:'13px' }}>No substitutions assigned yet</div>
              <Link href={`/admin/absences/new?absence_id=${id}`} style={{ ...hBtn({ padding:'6px 14px', fontSize:12 }), marginTop:'12px', display:'inline-flex' }}>
                Assign Cover
              </Link>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column' }}>
              {subs.map((sub, i) => (
                <div key={sub.id} style={{ padding:'12px 16px', borderBottom: i < subs.length - 1 ? '1px solid rgba(61,43,31,0.5)' : 'none', display:'flex', alignItems:'center', gap:'12px' }}>
                  {/* Period badge */}
                  <div style={{ width:36, height:36, borderRadius:'10px', background:'#f97316', color:'white', fontWeight:800, fontSize:'14px', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    P{sub.period_number}
                  </div>

                  <div style={{ flex:1, minWidth:0 }}>
                    {reassigning === sub.id ? (
                      <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
                        <select style={{ ...inp(), flex:1, fontSize:'12px', padding:'6px 10px' }}
                          value={reassignTeacher[sub.id] || ''}
                          onChange={e => setReassignTeacher(p => ({ ...p, [sub.id]: e.target.value }))}>
                          <option value="">Select substitute…</option>
                          {allTeachers.filter(t => t.id !== absence.teacher_id).map(t => (
                            <option key={t.id} value={t.id}>{t.full_name}</option>
                          ))}
                        </select>
                        <button onClick={() => handleReassign(sub.id)} disabled={!reassignTeacher[sub.id] || savingReassign === sub.id}
                          style={hBtn({ padding:'6px 14px', fontSize:12 })}>
                          {savingReassign === sub.id ? <Loader2 size={12} style={{ animation:'spin 0.7s linear infinite' }}/> : <Save size={12}/>}
                        </button>
                        <button onClick={() => setReassigning(null)} style={ghost({ padding:'6px 10px', fontSize:12 })}>
                          <X size={12}/>
                        </button>
                      </div>
                    ) : (
                      <>
                        <div style={{ fontWeight:600, fontSize:'13px' }}>
                          {sub.substitute?.full_name || <span style={{ color:H.muted, fontStyle:'italic' }}>Unassigned</span>}
                        </div>
                        <div style={{ fontSize:'11px', color:H.sub, marginTop:'2px' }}>
                          {sub.class?.name}{sub.subject ? ` · ${sub.subject}` : ''}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Status badge */}
                  {reassigning !== sub.id && (
                    <span style={{ fontSize:'10px', fontWeight:700, padding:'3px 8px', borderRadius:'10px', flexShrink:0,
                      background: sub.status === 'confirmed' ? 'rgb(34 197 94/0.1)' : sub.status === 'cancelled' ? 'rgb(100 116 139/0.1)' : 'rgb(245 158 11/0.1)',
                      color: sub.status === 'confirmed' ? '#16a34a' : sub.status === 'cancelled' ? '#64748b' : '#d97706',
                    }}>
                      {sub.status === 'confirmed' ? '✓ Confirmed' : sub.status === 'cancelled' ? 'Cancelled' : 'Assigned'}
                    </span>
                  )}

                  {/* Actions */}
                  {reassigning !== sub.id && (
                    <div style={{ display:'flex', gap:'4px', flexShrink:0 }}>
                      <button onClick={() => { setReassigning(sub.id); setReassignTeacher(p => ({ ...p, [sub.id]: sub.substitute_teacher_id || '' })) }}
                        style={{ background:'none', border:'none', cursor:'pointer', color:H.muted, padding:'4px' }} title="Reassign">
                        <Edit2 size={13}/>
                      </button>
                      <button onClick={() => handleRemoveSub(sub.id)}
                        style={{ background:'none', border:'none', cursor:'pointer', color:H.muted, padding:'4px' }} title="Remove">
                        <Trash2 size={13}/>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

      </main>
    
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}*{box-sizing:border-box}::-webkit-scrollbar{width:5px}::-webkit-scrollbar-thumb{background:rgba(238,189,43,0.3);border-radius:99px}`}</style>
    </div>
  )
}