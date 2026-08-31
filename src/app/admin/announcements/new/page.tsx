'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2, Pin, Send, Megaphone, AlertCircle, Calendar as CalendarIcon, Users as UsersIcon } from 'lucide-react'
import sanitizeHtml from 'sanitize-html'
import { createClient } from '@/lib/supabase/client'

import { H } from '@/lib/honey'

const card  = (x?:any):React.CSSProperties => ({ background:H.surface, borderRadius:16, border:`1px solid ${H.border}`, boxShadow:'0 2px 8px rgba(0,0,0,0.06)', padding:'20px 22px', ...x })
const ghost = (x?:any):React.CSSProperties => ({ background:'#F5F5F4', color:H.muted, border:`1px solid ${H.border}`, borderRadius:8, fontFamily:H.font, fontWeight:600, fontSize:12, padding:'6px 12px', cursor:'pointer', display:'inline-flex', alignItems:'center', gap:5, textDecoration:'none', ...x })
const inp   = (x?:any):React.CSSProperties => ({ width:'100%', padding:'10px 14px', background:H.bg, border:`1px solid ${H.border}`, borderRadius:8, color:H.text, fontFamily:H.font, fontWeight:600, fontSize:13, outline:'none', boxSizing:'border-box' as const, transition:'border-color 0.15s', ...x })

const Label = ({ children }: { children: React.ReactNode }) => (
  <label style={{ display:'block', fontFamily:H.font, fontSize:11, fontWeight:800, color:H.sub, textTransform:'uppercase' as const, letterSpacing:'0.07em', marginBottom:8 }}>
    {children}
  </label>
)

const CATEGORIES = ['General','Urgent','Event','Holiday','Exam','Other']
const CAT_COLOR: Record<string,string> = { General:'#94a3b8', Urgent:'#f87171', Event:'#60a5fa', Holiday:'#8fb339', Exam:'#eebd2b', Other:'#94a3b8' }
const PRIORITIES = [
  { value:'low',    label:'Low',    color:'#94a3b8' },
  { value:'medium', label:'Medium', color:'#fb923c' },
  { value:'high',   label:'High',   color:'#f87171' },
]

export default function NewAnnouncementPage() {
  const router   = useRouter()
  const supabase = createClient()

  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')
  const [titleError, setTitleError] = useState('')
  const [bodyError, setBodyError]   = useState('')
  const [classes, setClasses]       = useState<any[]>([])
  const [selectedClasses, setSelectedClasses] = useState<string[]>([])
  const [form, setForm]             = useState({
    title: '', body: '', category: 'General',
    priority: 'medium', is_pinned: false,
    send_telegram: true, is_published: true,
    start_date: '', end_date: '', expiry_date: '',
  })

  useEffect(() => {
    const fetchClasses = async () => {
      const { data } = await supabase
        .from('classes')
        .select('*')
        .eq('is_active', true)
        .order('name')
      setClasses(data || [])
    }
    fetchClasses()
  }, [supabase])

  const set = (k: string, v: any) => {
    setForm(p => ({ ...p, [k]: v }))
    if (k === 'title') setTitleError('')
    if (k === 'body') setBodyError('')
    setError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    let hasError = false
    const cleanTitle = sanitizeHtml(form.title.trim(), { allowedTags: [], allowedAttributes: {} })
    const cleanBody = sanitizeHtml(form.body.trim(), { allowedTags: [], allowedAttributes: {} })

    if (!cleanTitle) {
      setTitleError('Title is required.')
      hasError = true
    } else if (cleanTitle.length > 200) {
      setTitleError('Title must not exceed 200 characters.')
      hasError = true
    } else {
      setTitleError('')
    }

    if (!cleanBody) {
      setBodyError('Message content is required.')
      hasError = true
    } else if (cleanBody.length > 5000) {
      setBodyError('Message content must not exceed 5,000 characters.')
      hasError = true
    } else {
      setBodyError('')
    }

    if (hasError) {
      setError('Please fix input validation errors before posting.')
      return
    }

    setLoading(true); setError('')

    try {
      const { data: { session } } = await supabase.auth.getSession(); const user = session?.user
      const insertPayload: any = {
        title: cleanTitle,
        body: cleanBody,
        category: form.category,
        priority: form.priority,
        is_pinned: form.is_pinned,
        is_published: form.is_published,
        is_active: true,
        start_date: form.start_date ? new Date(form.start_date).toISOString() : null,
        end_date: form.end_date ? new Date(form.end_date).toISOString() : null,
        expiry_date: form.expiry_date ? new Date(form.expiry_date).toISOString() : null,
      }
      if (user?.id) insertPayload.created_by = user.id

      const { data, error: insertErr } = await supabase
        .from('announcements')
        .insert(insertPayload)
        .select()
        .single()

      if (insertErr) {
        console.error('Failed to post announcement:', insertErr.message)
        setError('Could not post announcement. Please check message details and try again.')
        setLoading(false)
        return
      }

      // If targeted classes are selected, link them
      if (selectedClasses.length > 0 && data?.id) {
        const links = selectedClasses.map(classId => ({
          announcement_id: data.id,
          class_id: classId
        }))
        const { error: linksErr } = await supabase
          .from('announcement_classes')
          .insert(links)

        if (linksErr) {
          console.error('Failed to link targeted classes for announcement:', linksErr.message)
          // Attempt rollback deletion of main announcement row so it does not default to public
          const { error: rollbackErr } = await supabase
            .from('announcements')
            .delete()
            .eq('id', data.id)

          if (rollbackErr) {
            console.error('[Rollback Failed] Could not delete orphaned announcement record:', rollbackErr.message)
            setError(`Announcement could not attach target classes and automatic cleanup failed. Please check the announcements list and remove notice "${form.title.trim()}" if it appears.`)
          } else {
            console.info('[Rollback Succeeded] Cleanly deleted orphaned announcement ID:', data.id)
            setError('Failed to attach target classes. Announcement post cancelled — please try again.')
          }
          setLoading(false)
          return
        }
      }

      let tgParam = 'disabled'
      if (form.send_telegram) {
        try {
          const tgRes = await fetch('/api/notify/announcement', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: form.title.trim(), body: form.body.trim(), priority: form.priority }),
          })
          const tgData = await tgRes.json().catch(() => ({}))
          const status = tgData.data?.telegram?.status || tgData.telegram?.status
          if (status) {
            tgParam = status
          } else if (tgRes.ok && (tgData.success !== false)) {
            tgParam = 'sent'
          } else {
            tgParam = 'failed'
          }
        } catch {
          tgParam = 'failed'
        }
      }

      setLoading(false)
      router.push(`/admin/announcements?posted=1&tg=${tgParam}`)
    } catch (err: any) {
      console.error('Unexpected error posting announcement:', err)
      setError('Could not post announcement. Please try again.')
      setLoading(false)
    }
  }

  const focus = (e: React.FocusEvent<any>) => e.target.style.borderColor = H.skyBlue
  const blur  = (e: React.FocusEvent<any>) => e.target.style.borderColor = H.border

  return (
    <div style={{ minHeight: '100vh', background: H.bg, fontFamily: H.font, color: H.text }}>

      {/* Header */}
      <header style={{ height: 68, padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${H.border}`, background: H.surface, backdropFilter: 'blur(12px)', position: 'sticky', top: 0, zIndex: 30 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#F4F4F5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Megaphone size={20} style={{ color: '#18181B' }} />
          </div>
          <div>
            <h1 style={{ fontFamily: H.font, fontSize: 17, fontWeight: 800, color: H.text, margin: 0 }}>New Announcement</h1>
            <p style={{ fontFamily: H.font, fontSize: 11, color: H.muted, margin: 0 }}>Post a notice to staff</p>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 800, margin: '0 auto', padding: '24px 20px 100px 20px' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {error && (
            <div style={{ padding: '12px 16px', borderRadius: 12, background: 'rgba(239,68,68,0.1)', border: '2px solid rgba(239,68,68,0.3)', display: 'flex', gap: 8, alignItems: 'center', fontFamily: H.font, fontSize: 13, fontWeight: 700, color: '#ef4444' }}>
              <AlertCircle size={16} style={{ flexShrink: 0 }}/>{error}
            </div>
          )}

          {/* Content card */}
          <div style={card({ display: 'flex', flexDirection: 'column', gap: 16 })}>
            <h2 style={{ fontFamily: H.font, fontSize: 15, fontWeight: 900, color: '#18181B', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Megaphone size={16} color="#18181B"/> Announcement Details
            </h2>

            <div>
              <Label>Title <span style={{ color: '#f87171' }}>*</span></Label>
              <input style={{ ...inp(), borderColor: titleError ? '#ef4444' : H.border }} placeholder="e.g. School closed on Monday"
                value={form.title} onChange={e => set('title', e.target.value)}
                autoFocus onFocus={focus} onBlur={blur}/>
              {titleError && (
                <p style={{ fontFamily: H.font, fontSize: 12, fontWeight: 600, color: '#ef4444', margin: '5px 0 0 0' }}>
                  {titleError}
                </p>
              )}
            </div>

            <div>
              <Label>Message <span style={{ color: '#f87171' }}>*</span></Label>
              <textarea style={{ ...inp(), resize: 'none' as const, lineHeight: 1.6, borderColor: bodyError ? '#ef4444' : H.border }} rows={5}
                placeholder="Write the full announcement here…"
                value={form.body} onChange={e => set('body', e.target.value)}
                onFocus={focus} onBlur={blur}/>
              {bodyError ? (
                <p style={{ fontFamily: H.font, fontSize: 12, fontWeight: 600, color: '#ef4444', margin: '5px 0 0 0' }}>
                  {bodyError}
                </p>
              ) : (
                <p style={{ fontFamily: H.font, fontSize: 11, color: H.sub, marginTop: 5 }}>{form.body.length} characters</p>
              )}
            </div>
          </div>

          {/* Target Audience & Dates Card */}
          <div style={card({ display: 'flex', flexDirection: 'column', gap: 16 })}>
            <h2 style={{ fontFamily: H.font, fontSize: 15, fontWeight: 900, color: H.skyBlue, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <UsersIcon size={16} color={H.skyBlue}/> Target Audience & Dates (Optional)
            </h2>

            {/* Target Classes */}
            <div>
              <Label>Target Classes</Label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                {classes.map(cls => {
                  const isSelected = selectedClasses.includes(cls.id)
                  return (
                    <button
                      key={cls.id}
                      type="button"
                      onClick={() => {
                        if (isSelected) {
                          setSelectedClasses(selectedClasses.filter(id => id !== cls.id))
                        } else {
                          setSelectedClasses([...selectedClasses, cls.id])
                        }
                      }}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '20px',
                        border: `1px solid ${isSelected ? H.skyBlue : H.border}`,
                        background: isSelected ? H.skyLight : '#FFFFFF',
                        color: isSelected ? H.skyDark : H.text,
                        fontWeight: 600,
                        fontSize: '12px',
                        cursor: 'pointer',
                        transition: 'all 0.15s'
                      }}
                    >
                      {cls.name}
                    </button>
                  )
                })}
              </div>
              <p style={{ fontFamily: H.font, fontSize: 11, color: H.sub, margin: 0 }}>
                {selectedClasses.length === 0 ? 'Visible to all teachers.' : `Targeting ${selectedClasses.length} class(es).`}
              </p>
            </div>

            {/* Date inputs grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
              <div>
                <Label>Relevant Start Date</Label>
                <input
                  type="date"
                  style={inp()}
                  value={form.start_date}
                  onChange={e => set('start_date', e.target.value)}
                  onFocus={focus}
                  onBlur={blur}
                />
              </div>
              <div>
                <Label>Relevant End Date</Label>
                <input
                  type="date"
                  style={inp()}
                  value={form.end_date}
                  onChange={e => set('end_date', e.target.value)}
                  onFocus={focus}
                  onBlur={blur}
                />
              </div>
              <div>
                <Label>Expiry Date</Label>
                <input
                  type="date"
                  style={inp()}
                  value={form.expiry_date}
                  onChange={e => set('expiry_date', e.target.value)}
                  onFocus={focus}
                  onBlur={blur}
                />
              </div>
            </div>
          </div>

          {/* Category + Priority row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>

            {/* Category */}
            <div style={card({ display: 'flex', flexDirection: 'column', gap: 8 })}>
              <Label>Category</Label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {CATEGORIES.map(c => {
                  const col = CAT_COLOR[c]
                  const sel = form.category === c
                  return (
                    <button key={c} type="button" onClick={() => set('category', c)}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 9, border: `2px solid ${sel ? col : H.border}`, background: sel ? `${col}18` : '#F5F5F4', cursor: 'pointer', textAlign: 'left' as const }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: col, flexShrink: 0 }}/>
                      <span style={{ fontFamily: H.font, fontSize: 12, fontWeight: sel ? 800 : 500, color: sel ? col : H.text }}>{c}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Priority */}
            <div style={card({ display: 'flex', flexDirection: 'column', gap: 8 })}>
              <Label>Priority</Label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {PRIORITIES.map(p => {
                  const sel = form.priority === p.value
                  return (
                    <button key={p.value} type="button" onClick={() => set('priority', p.value)}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 9, border: `2px solid ${sel ? p.color : H.border}`, background: sel ? `${p.color}18` : '#F5F5F4', cursor: 'pointer' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, flexShrink: 0 }}/>
                      <span style={{ fontFamily: H.font, fontSize: 12, fontWeight: sel ? 800 : 500, color: sel ? p.color : H.text }}>{p.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Options */}
            <div style={card({ display: 'flex', flexDirection: 'column', gap: 12 })}>
              <Label>Options</Label>

              {/* Pin toggle */}
              <button type="button" onClick={() => set('is_pinned', !form.is_pinned)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 14px',
                  borderRadius: 12,
                  border: `2px solid ${form.is_pinned ? H.skyBlue : H.border}`,
                  background: form.is_pinned ? 'rgba(59,130,246,0.08)' : '#F5F5F4',
                  cursor: 'pointer',
                  width: '100%',
                  textAlign: 'left' as const,
                  boxSizing: 'border-box',
                  minHeight: 58,
                  outline: 'none',
                  transition: 'all 0.2s ease',
                }}>
                <div style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  background: form.is_pinned ? 'rgba(59,130,246,0.15)' : '#E7E5E4'
                }}>
                  <Pin size={18} color={form.is_pinned ? H.skyBlue : H.muted}/>
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 0 }}>
                  <div style={{ fontFamily: H.font, fontSize: 13, fontWeight: 700, color: form.is_pinned ? H.skyBlue : H.text, lineHeight: 1.3 }}>Pin announcement</div>
                  <div style={{ fontFamily: H.font, fontSize: 11, color: H.sub, lineHeight: 1.3, marginTop: 2 }}>Shows at the top of the notice board</div>
                </div>
                <div style={{
                  width: 42,
                  height: 24,
                  borderRadius: 12,
                  background: form.is_pinned ? H.skyBlue : '#D6D3D1',
                  position: 'relative',
                  flexShrink: 0,
                  transition: 'background-color 0.2s ease'
                }}>
                  <div style={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    background: '#ffffff',
                    position: 'absolute',
                    top: 2,
                    left: form.is_pinned ? 20 : 2,
                    transition: 'left 0.2s ease',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.25)'
                  }}/>
                </div>
              </button>

              {/* Telegram toggle */}
              <button type="button" onClick={() => set('send_telegram', !form.send_telegram)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 14px',
                  borderRadius: 12,
                  border: `2px solid ${form.send_telegram ? '#60a5fa' : H.border}`,
                  background: form.send_telegram ? 'rgba(96,165,250,0.08)' : '#F5F5F4',
                  cursor: 'pointer',
                  width: '100%',
                  textAlign: 'left' as const,
                  boxSizing: 'border-box',
                  minHeight: 58,
                  outline: 'none',
                  transition: 'all 0.2s ease',
                }}>
                <div style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  background: form.send_telegram ? 'rgba(96,165,250,0.15)' : '#E7E5E4'
                }}>
                  <Send size={18} color={form.send_telegram ? '#60a5fa' : H.muted}/>
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 0 }}>
                  <div style={{ fontFamily: H.font, fontSize: 13, fontWeight: 700, color: form.send_telegram ? '#60a5fa' : H.text, lineHeight: 1.3 }}>Send Telegram</div>
                  <div style={{ fontFamily: H.font, fontSize: 11, color: H.sub, lineHeight: 1.3, marginTop: 2 }}>Push to school Telegram group</div>
                </div>
                <div style={{
                  width: 42,
                  height: 24,
                  borderRadius: 12,
                  background: form.send_telegram ? '#60a5fa' : '#D6D3D1',
                  position: 'relative',
                  flexShrink: 0,
                  transition: 'background-color 0.2s ease'
                }}>
                  <div style={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    background: '#ffffff',
                    position: 'absolute',
                    top: 2,
                    left: form.send_telegram ? 20 : 2,
                    transition: 'left 0.2s ease',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.25)'
                  }}/>
                </div>
              </button>
            </div>
          </div>

          {/* Submit */}
          <button type="submit" disabled={loading}
            style={{ background: '#18181B', color: '#fff', border: `2px solid ${H.border}`, borderRadius: 14, fontFamily: H.font, fontWeight: 900, fontSize: 15, padding: '14px 24px', cursor: loading ? 'not-allowed' : 'pointer', boxShadow: `0 4px 12px rgba(24, 24, 27, 0.15)`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: loading ? 0.7 : 1, minHeight: 48, width: '100%', boxSizing: 'border-box' as const }}>
            {loading
              ? <><Loader2 size={18} style={{ animation: 'spin 0.7s linear infinite' }}/> Posting…</>
              : <><Megaphone size={18}/> Post Announcement{form.send_telegram ? ' + Notify Telegram' : ''}</>
            }
          </button>
        </form>
      </main>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}*{box-sizing:border-box}::-webkit-scrollbar{width:5px}::-webkit-scrollbar-thumb{background:rgba(59,130,246,0.3);border-radius:99px}`}</style>
    </div>
  )
}
