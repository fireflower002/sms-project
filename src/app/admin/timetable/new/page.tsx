'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, GraduationCap, Plus, Trash2, Loader2, Clock, Coffee, AlertCircle, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { generatePeriods, formatTime } from '@/lib/utils'

import { H } from '@/lib/honey'

const card  = (x?:any):React.CSSProperties => ({ background:H.surface, borderRadius:16, border:`1px solid ${H.border}`, boxShadow:'0 2px 8px rgba(0,0,0,0.06)', padding:'24px', overflow:'hidden', ...x })
const hBtn  = (x?:any):React.CSSProperties => ({ background:H.skyBlue, color:'#FFFFFF', border:'none', borderRadius:10, fontFamily:H.font, fontWeight:700, fontSize:13, minHeight:'44px', padding:'10px 18px', cursor:'pointer', display:'inline-flex', alignItems:'center', justifyContent:'center', gap:6, textDecoration:'none', ...x })
const ghost = (x?:any):React.CSSProperties => ({ background:'#F5F5F4', color:H.muted, border:`1px solid ${H.border}`, borderRadius:8, fontFamily:H.font, fontWeight:600, fontSize:12, minHeight:'36px', padding:'6px 12px', cursor:'pointer', display:'inline-flex', alignItems:'center', justifyContent:'center', gap:5, textDecoration:'none', ...x })
const grass = (x?:any):React.CSSProperties => ({ background:H.grass, color:'#FFFFFF', border:'none', borderRadius:10, fontFamily:H.font, fontWeight:700, fontSize:13, minHeight:'44px', padding:'10px 18px', cursor:'pointer', display:'inline-flex', alignItems:'center', justifyContent:'center', gap:6, textDecoration:'none', ...x })
const inp   = (x?:any):React.CSSProperties => ({ width:'100%', minHeight:'40px', padding:'8px 12px', background:H.bg, border:`1px solid ${H.border}`, borderRadius:8, color:H.textPrimary, fontFamily:H.font, fontWeight:600, fontSize:13, outline:'none', boxSizing:'border-box' as const, ...x })


interface BreakItem { after_period: number; duration: number; label: string }

const SectionHeader = ({ n, label, action }: { n: number; label: string; action?: React.ReactNode }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <div style={{
        width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
        background: H.skyBlue,
        color: '#ffffff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 800, fontSize: '13px', lineHeight: 1,
      }}>{n}</div>
      <span style={{ fontWeight: 700, fontSize: '15px', color: H.textPrimary, lineHeight: 1.2 }}>{label}</span>
    </div>
    {action}
  </div>
)

export default function NewTemplatePage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ name: '', start_time: '07:30', end_time: '14:00', period_duration: 40 })
  const [breaks, setBreaks] = useState<BreakItem[]>([
    { after_period: 3, duration: 20, label: 'Morning Recess' },
    { after_period: 6, duration: 40, label: 'Lunch Break' },
  ])

  const generatedPeriods: any[] = (() => {
    try { return generatePeriods(form.start_time, form.end_time, form.period_duration, breaks) }
    catch { return [] }
  })()
  const actualPeriods = generatedPeriods.filter((p: any) => !p.is_break)
  const breakSlots    = generatedPeriods.filter((p: any) => p.is_break)

  const validate = () => {
    if (!form.name.trim()) return 'Template name is required.'
    if (form.period_duration < 10) return 'Period must be at least 10 min.'
    const toMins = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
    if (toMins(form.end_time) <= toMins(form.start_time)) return 'End time must be after start time.'
    if (actualPeriods.length < 1) return 'Settings must generate at least 1 period.'
    for (const b of breaks) {
      if (b.duration < 5) return 'Break must be at least 5 min.'
      if (!b.label.trim()) return 'Each break needs a label.'
    }
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('')
    const err = validate()
    if (err) { setError(err); return }
    setLoading(true)
    try {
      const { data, error: insertError } = await supabase
        .from('timetable_templates')
        .insert({ name: form.name.trim(), start_time: form.start_time, end_time: form.end_time, period_duration: form.period_duration, breaks, is_active: false })
        .select().single()
      if (insertError) { setError(`Failed to create: ${insertError.message}`); return }
      router.push(`/admin/timetable/${data.id}`)
    } catch (e: any) { setError(e?.message || 'Unexpected error.') }
    finally { setLoading(false) }
  }

  const breakGridCols = '100px 120px 1fr 40px'

  return (
    <div style={{ minHeight: '100vh', background: H.bg }}>

      {/* Header */}
      <header style={{ position:'sticky', top:0, zIndex:50, background: H.surface, borderBottom: `1px solid ${H.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '64px', maxWidth: '1400px', margin: '0 auto', padding: '0 28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Link href="/admin/timetable" style={ghost({ padding:'6px 10px', fontSize:12 })}><ArrowLeft size={16} /></Link>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: H.skyLight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <GraduationCap size={16} style={{ color: H.skyDark }} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '14px', color: H.textPrimary }}>New Timetable Template</div>
              <div style={{ fontSize: '11px', color: H.sub }}>Define school hours and periods</div>
            </div>
          </div>
          
        </div>
      </header>

      <main className="page-container" style={{ paddingTop: '32px', paddingBottom: '48px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '28px', alignItems: 'start' }}>

          {/* ── LEFT: Form ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {error && (
              <div className="alert alert-error animate-fade-up">
                <AlertCircle size={15} style={{ flexShrink: 0 }} /><span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

              {/* Section 1 — Name */}
              <div style={card()}>
                <SectionHeader n={1} label="Template Name" />
                <input style={inp()} placeholder="e.g. 2025–2026 Main Schedule"
                  value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  required autoFocus />
                <p style={{ fontSize: '12px', color: H.muted, marginTop: '6px' }}>
                  Give it a clear name so you can identify it later
                </p>
              </div>

              {/* Section 2 — School Hours */}
              <div style={card()}>
                <SectionHeader n={2} label="School Hours" />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div>
                    <label style={{ display:'block', fontFamily:H.font, fontSize:11, fontWeight:800, color:H.sub, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:6 }}>School Starts</label>
                    <input type="time" style={inp()} value={form.start_time}
                      onChange={e => setForm(p => ({ ...p, start_time: e.target.value }))} required />
                  </div>
                  <div>
                    <label style={{ display:'block', fontFamily:H.font, fontSize:11, fontWeight:800, color:H.sub, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:6 }}>School Ends</label>
                    <input type="time" style={inp()} value={form.end_time}
                      onChange={e => setForm(p => ({ ...p, end_time: e.target.value }))} required />
                  </div>
                </div>

                <div style={{ marginTop: '16px' }}>
                  <label style={{ display:'block', fontFamily:H.font, fontSize:11, fontWeight:800, color:H.sub, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:6 }}>Period Duration (minutes)</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <input type="range" min="10" max="90" step="5" value={form.period_duration}
                      onChange={e => setForm(p => ({ ...p, period_duration: Number(e.target.value) }))}
                      style={{ flex: 1, accentColor: H.skyBlue }} />
                    <input type="number" min="10" max="90"
                      value={form.period_duration}
                      onChange={e => setForm(p => ({ ...p, period_duration: Math.max(10, Math.min(90, Number(e.target.value))) }))}
                      style={{ ...inp(), width: '68px', textAlign: 'center', fontWeight: 700, fontFamily: 'monospace' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: H.muted, marginTop: '4px' }}>
                    <span>10 min</span>
                    <span style={{ fontWeight: 600 }}>{form.period_duration} minutes per period</span>
                    <span>90 min</span>
                  </div>
                </div>

                {actualPeriods.length > 0 && (
                  <div style={{ marginTop: '14px', padding: '10px 14px', borderRadius: '10px', background: H.successLight, border: `1px solid ${H.successGreen}`, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CheckCircle2 size={15} style={{ color: '#065F46', flexShrink: 0 }} />
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#065F46' }}>
                      {actualPeriods.length} periods will be generated
                    </span>
                  </div>
                )}
              </div>

              {/* Section 3 — Breaks */}
              <div style={card()}>
                <SectionHeader n={3} label="Breaks & Intervals" action={
                  <button type="button"
                    onClick={() => setBreaks(p => [...p, { after_period: 1, duration: 15, label: 'Break' }])}
                    style={ghost({ padding:'6px 12px', fontSize:12 })}>
                    <Plus size={14} /> Add Break
                  </button>
                } />

                {breaks.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px', border: '2px dashed', borderRadius: '12px', borderColor: H.border, color: H.muted }}>
                    <Coffee size={22} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
                    <p style={{ fontSize: '13px' }}>No breaks — click "Add Break" to add recess or lunch</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {/* Grid Column Header Row */}
                    <div style={{ display: 'grid', gridTemplateColumns: breakGridCols, gap: '12px', padding: '0 4px', alignItems: 'center' }}>
                      <span style={{ fontFamily: H.font, fontSize: '11px', fontWeight: 800, color: H.sub, textTransform: 'uppercase', letterSpacing: '0.07em' }}>After Period</span>
                      <span style={{ fontFamily: H.font, fontSize: '11px', fontWeight: 800, color: H.sub, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Duration (min)</span>
                      <span style={{ fontFamily: H.font, fontSize: '11px', fontWeight: 800, color: H.sub, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Label</span>
                      <span />
                    </div>

                    {/* Aligned Grid Rows */}
                    {breaks.map((b, i) => (
                      <div key={i} style={{ display: 'grid', gridTemplateColumns: breakGridCols, gap: '12px', alignItems: 'center', padding: '10px 12px', borderRadius: '12px', border: `1px solid ${H.border}`, background: H.bg }}>
                        <input type="number" min="1" max={actualPeriods.length || 20}
                          value={b.after_period}
                          onChange={e => setBreaks(p => p.map((x, j) => j === i ? { ...x, after_period: Number(e.target.value) } : x))}
                          style={{ ...inp(), textAlign: 'center', fontFamily: 'monospace' }} />
                        
                        <input type="number" min="5" max="120"
                          value={b.duration}
                          onChange={e => setBreaks(p => p.map((x, j) => j === i ? { ...x, duration: Number(e.target.value) } : x))}
                          style={{ ...inp(), textAlign: 'center', fontFamily: 'monospace' }} />
                        
                        <input type="text" placeholder="e.g. Recess"
                          style={inp()}
                          value={b.label}
                          onChange={e => setBreaks(p => p.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} />
                        
                        <button type="button" onClick={() => setBreaks(p => p.filter((_, j) => j !== i))}
                          title="Remove Break"
                          style={{ background: H.dangerLight, color: H.danger, border: `1px solid ${'#FECACA'}`, borderRadius: '8px', width: '36px', height: '36px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button type="submit" disabled={loading || actualPeriods.length === 0}
                style={{ background: H.skyBlue, color: '#FFFFFF', border: 'none', borderRadius: 12, fontFamily: H.font, fontWeight: 800, fontSize: 14, minHeight: '48px', padding: '12px', cursor: loading || actualPeriods.length === 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', opacity: (loading || actualPeriods.length === 0) ? 0.6 : 1 }}>
                {loading
                  ? <Loader2 size={18} style={{ animation:'spin 0.7s linear infinite' }} />
                  : <><CheckCircle2 size={16} /> Create Template ({actualPeriods.length} periods)</>
                }
              </button>
            </form>
          </div>

          {/* ── RIGHT: Live Preview (sticky) ── */}
          <div style={{ position: 'sticky', top: '80px' }}>
            <div style={card()}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <Clock size={16} style={{ color: '#eab308' }} />
                <span style={{ fontWeight: 700 }}>Live Preview</span>
              </div>
              <p style={{ fontSize: '12px', color: H.muted, marginBottom: '14px' }}>Updates as you type</p>

              {generatedPeriods.length > 0 ? (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', maxHeight: '480px', overflowY: 'auto', paddingRight: '4px' }}>
                    {generatedPeriods.map((slot: any, i: number) => (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        padding: '8px 12px', borderRadius: '8px', fontSize: '13px',
                        background: slot.is_break ? 'rgb(245 158 11 / 0.08)' : '#F5F5F4',
                        border: '1px solid',
                        borderColor: slot.is_break ? 'rgb(245 158 11 / 0.35)' : H.border,
                      }}>
                        {slot.is_break ? (
                          <>
                            <Coffee size={13} style={{ color: '#f59e0b', flexShrink: 0 }} />
                            <span style={{ fontWeight: 600, color: '#f59e0b', flex: 1 }}>{slot.break_label}</span>
                            <span style={{ fontFamily: 'monospace', fontSize: '11px', color: '#d97706' }}>
                              {formatTime(slot.start_time)} – {formatTime(slot.end_time)}
                            </span>
                          </>
                        ) : (
                          <>
                            <div style={{ width: '24px', height: '24px', borderRadius: '6px', background: H.accentLight, color: H.chocolate, border: `1px solid ${H.border}`, fontWeight: 800, fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              {slot.period_number}
                            </div>
                            <span style={{ fontWeight: 500, flex: 1 }}>Period {slot.period_number}</span>
                            <span style={{ fontFamily: 'monospace', fontSize: '11px', color: H.muted }}>
                              {formatTime(slot.start_time)} – {formatTime(slot.end_time)}
                            </span>
                          </>
                        )}
                      </div>
                    ))}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginTop: '14px', paddingTop: '14px', borderTop: '1px solid', borderTopColor: H.border }}>
                    {[
                      { val: actualPeriods.length, label: 'Periods',    color: '#eab308' },
                      { val: breakSlots.length,    label: 'Breaks',     color: '#f97316' },
                      { val: `${form.period_duration}m`, label: 'Per Period', color: '#3b82f6' },
                    ].map(s => (
                      <div key={s.label} style={{ padding: '10px 6px', borderRadius: '10px', background: '#F5F5F4', textAlign: 'center' }}>
                        <div style={{ fontSize: '20px', fontWeight: 800, color: s.color }}>{s.val}</div>
                        <div style={{ fontSize: '11px', color: H.muted, marginTop: '2px' }}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: '48px 0', color: H.muted }}>
                  <Clock size={30} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                  <p style={{ fontSize: '13px' }}>Fill in the settings to see a preview</p>
                </div>
              )}
            </div>
          </div>

        </div>
      </main>
    
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}*{box-sizing:border-box}::-webkit-scrollbar{width:5px}::-webkit-scrollbar-thumb{background:rgba(238,189,43,0.3);border-radius:99px}`}</style>
    </div>
  )
}
