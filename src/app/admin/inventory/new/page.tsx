'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2, AlertCircle, Package, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

import { H } from '@/lib/honey'

const card  = (x?:any):React.CSSProperties => ({ background:H.surface, borderRadius:16, border:`1px solid ${H.border}`, boxShadow:'0 2px 8px rgba(0,0,0,0.06)', padding:'22px 24px', ...x })
const ghost = (x?:any):React.CSSProperties => ({ background:'#F5F5F4', color:H.muted, border:`1px solid ${H.border}`, borderRadius:8, fontFamily:H.font, fontWeight:600, fontSize:12, padding:'6px 12px', cursor:'pointer', display:'inline-flex', alignItems:'center', gap:5, textDecoration:'none', ...x })
const inp   = (x?:any):React.CSSProperties => ({ width:'100%', padding:'10px 14px', background:H.bg, border:`1px solid ${H.border}`, borderRadius:8, color:H.text, fontFamily:H.font, fontWeight:600, fontSize:13, outline:'none', boxSizing:'border-box' as const, ...x })

const CATEGORIES = ['Electronics','Lab Equipment','Sports Equipment','Books & Stationery','Furniture','Musical Instruments','Chemicals','Safety Equipment','Other']
const CONDITIONS  = ['new','good','fair','poor','damaged']

const Label = ({ children }: { children: React.ReactNode }) => (
  <label style={{ display:'block', fontFamily:H.font, fontSize:11, fontWeight:800, color:H.sub, textTransform:'uppercase' as const, letterSpacing:'0.07em', marginBottom:6 }}>
    {children}
  </label>
)

const Section = ({ title, children }: { title:string; children:React.ReactNode }) => (
  <div style={card()}>
    <h2 style={{ fontFamily:H.font, fontSize:15, fontWeight:800, color:H.text, margin:'0 0 18px' }}>
      {title}
    </h2>
    {children}
  </div>
)

export default function NewInventoryPage() {
  const router   = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [form, setForm]       = useState({
    name:'', description:'', category:'Electronics', serial_number:'',
    condition:'good', quantity_total:1, low_stock_threshold:1,
    location:'', purchase_date:'', purchase_price:'', notes:''
  })
  const set = (k: string, v: any) => setForm(p => ({...p,[k]:v}))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('')
    if (!form.name.trim()) return setError('Item name is required.')
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession(); const user = session?.user
      const { data, error: err } = await supabase
        .from('inventory')
        .insert([{
          name: form.name.trim(),
          description: form.description.trim() || null,
          category: form.category,
          serial_number: form.serial_number.trim() || null,
          condition: form.condition,
          quantity_total: form.quantity_total,
          quantity_available: form.quantity_total,
          low_stock_threshold: form.low_stock_threshold,
          location: form.location.trim() || null,
          purchase_date: form.purchase_date || null,
          purchase_price: form.purchase_price ? parseFloat(form.purchase_price) : null,
          notes: form.notes.trim() || null,
          created_by: user?.id,
          barcode: `INV-2026-${Math.floor(10000 + Math.random() * 90000)}`,
        }])
        .select()
        .single()
      if (err) throw err
      router.push(`/admin/inventory/${data.id}`)
    } catch (err: any) {
      setError(err.message || 'Failed to save inventory item.')
      setLoading(false)
    }
  }

  const focusStyle = (e: React.FocusEvent<any>) => e.target.style.borderColor = H.mintGreen
  const blurStyle  = (e: React.FocusEvent<any>) => e.target.style.borderColor = H.border

  return (
    <div style={{ minHeight:'100vh', background:H.bg, fontFamily:H.font, color:H.text }}>

      {/* Header */}
      <header style={{ height:68, padding:'0 28px', display:'flex', alignItems:'center', justifyContent:'space-between', borderBottom:`1px solid ${H.border}`, background:H.surface, backdropFilter:'blur(12px)', position:'sticky', top:0, zIndex:30 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <Package size={20} style={{ color: H.mintGreen }} />
          <div>
            <h1 style={{ fontFamily:H.font, fontSize:17, fontWeight:800, color:H.text, margin:0 }}>Add Inventory Item</h1>
            <p style={{ fontFamily:H.font, fontSize:11, color:H.muted, margin:0 }}>Barcode auto-generated on save</p>
          </div>
        </div>
      </header>
      <main style={{ maxWidth:720, margin:'0 auto', padding:'28px 28px 160px', display:'flex', flexDirection:'column', gap:16 }}>

        {error && (
          <div style={{ padding:'12px 16px', borderRadius:12, background:'rgba(239,68,68,0.1)', border:'2px solid rgba(239,68,68,0.3)', display:'flex', gap:8, alignItems:'center', fontFamily:H.font, fontSize:13, color:'#f87171' }}>
            <AlertCircle size={15} style={{ flexShrink:0 }}/>{error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:16 }}>

          {/* Item Details */}
          <Section title="Item Details">
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <div>
                <Label>Item Name <span style={{ color:'#f87171' }}>*</span></Label>
                <input style={inp()} placeholder="e.g. Dell Laptop i5" value={form.name}
                  onChange={e=>set('name',e.target.value)} required autoFocus
                  onFocus={focusStyle} onBlur={blurStyle}/>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div>
                  <Label>Category <span style={{ color:'#f87171' }}>*</span></Label>
                  <select style={{ ...inp(), cursor:'pointer', appearance:'none' as const }} value={form.category} onChange={e=>set('category',e.target.value)}>
                    {CATEGORIES.map(c=><option key={c} style={{ background:H.surface, color:H.mintGreen }}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Condition</Label>
                  <select style={{ ...inp(), cursor:'pointer', appearance:'none' as const }} value={form.condition} onChange={e=>set('condition',e.target.value)}>
                    {CONDITIONS.map(c=><option key={c} style={{ background:H.surface, color:H.mintGreen }}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <Label>Description</Label>
                <textarea style={{ ...inp(), resize:'none' as const, lineHeight:1.6 }} rows={2}
                  placeholder="Optional description…" value={form.description}
                  onChange={e=>set('description',e.target.value)}
                  onFocus={focusStyle} onBlur={blurStyle}/>
              </div>
            </div>
          </Section>

          {/* Quantity */}
          <Section title="Quantity & Stock Alert">
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div>
                <Label>Total Quantity <span style={{ color:'#f87171' }}>*</span></Label>
                <input type="number" min={1} style={inp()} value={form.quantity_total}
                  onChange={e=>set('quantity_total',parseInt(e.target.value)||1)}
                  onFocus={focusStyle} onBlur={blurStyle}/>
              </div>
              <div>
                <Label>Alert When Below</Label>
                <input type="number" min={0} style={inp()} value={form.low_stock_threshold}
                  onChange={e=>set('low_stock_threshold',parseInt(e.target.value)||0)}
                  onFocus={focusStyle} onBlur={blurStyle}/>
                <p style={{ fontFamily:H.font, fontSize:11, color:H.sub, marginTop:5 }}>Show low stock warning at this number</p>
              </div>
            </div>
          </Section>

          {/* Location & Tracking */}
          <Section title="Location & Tracking">
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <div>
                <Label>Storage Location</Label>
                <input style={inp()} placeholder="e.g. Lab Store Room B" value={form.location}
                  onChange={e=>set('location',e.target.value)}
                  onFocus={focusStyle} onBlur={blurStyle}/>
              </div>
              <div>
                <Label>Serial Number <span style={{ fontWeight:400, textTransform:'none' as const, letterSpacing:0 }}>(optional)</span></Label>
                <input style={{ ...inp(), fontFamily:'DM Mono, monospace' }} placeholder="e.g. SN-123456" value={form.serial_number}
                  onChange={e=>set('serial_number',e.target.value)}
                  onFocus={focusStyle} onBlur={blurStyle}/>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 14px', borderRadius:10, background:'rgba(6,182,212,0.06)', border:`2px solid rgba(6,182,212,0.2)` }}>
                <span style={{ fontFamily:H.font, fontSize:12, color:H.muted }}>Barcode auto-generated: </span>
                <span style={{ fontFamily:'DM Mono, monospace', fontWeight:700, color:H.mintGreen, fontSize:12 }}>PENDING</span>
              </div>
            </div>
          </Section>

          {/* Purchase Info */}
          <Section title="Purchase Info">
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div>
                  <Label>Purchase Date</Label>
                  <input type="date" style={inp()} value={form.purchase_date}
                    onChange={e=>set('purchase_date',e.target.value)}
                    onFocus={focusStyle} onBlur={blurStyle}/>
                </div>
                <div>
                  <Label>Price (LKR)</Label>
                  <input type="number" min={0} step="0.01" style={inp()} placeholder="0.00"
                    value={form.purchase_price} onChange={e=>set('purchase_price',e.target.value)}
                    onFocus={focusStyle} onBlur={blurStyle}/>
                </div>
              </div>
              <div>
                <Label>Notes</Label>
                <textarea style={{ ...inp(), resize:'none' as const, lineHeight:1.6 }} rows={2}
                  placeholder="Any additional notes…" value={form.notes}
                  onChange={e=>set('notes',e.target.value)}
                  onFocus={focusStyle} onBlur={blurStyle}/>
              </div>
            </div>
          </Section>

          {/* Form Action Bar (Normal Layout Flow with generous bottom clearance) */}
          <div style={{
            display:'flex',
            alignItems:'center',
            justifyContent:'flex-end',
            gap: 12,
            marginTop: 12,
            paddingTop: 8,
          }}>
            <Link href="/admin/inventory" style={{
              background: '#F5F5F4',
              color: H.textSec,
              border: `1px solid ${H.border}`,
              borderRadius: 12,
              fontFamily: H.font,
              fontWeight: 700,
              fontSize: 14,
              padding: '12px 20px',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 44,
              boxSizing: 'border-box'
            }}>
              Cancel
            </Link>
            <button type="submit" disabled={loading}
              style={{
                background: H.grass,
                color: '#fff',
                border: 'none',
                borderRadius: 12,
                fontFamily: H.font,
                fontWeight: 800,
                fontSize: 14,
                padding: '12px 24px',
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                opacity: loading ? 0.7 : 1,
                minHeight: 44,
                boxShadow: '0 2px 4px rgba(0,0,0,0.08)',
                boxSizing: 'border-box'
              }}>
              {loading ? <Loader2 size={16} style={{ animation:'spin 0.7s linear infinite' }}/> : <><Package size={16}/> Save Item</>}
            </button>
          </div>
        </form>
      </main>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}*{box-sizing:border-box}::-webkit-scrollbar{width:5px}::-webkit-scrollbar-thumb{background:rgba(6,182,212,0.3);border-radius:99px}select option{background:#ffffff;color:#06b6d4}`}</style>
    </div>
  )
}
