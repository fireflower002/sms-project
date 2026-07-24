'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Loader2, AlertCircle, Package, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

import { H } from '@/lib/honey'

const card  = (x?:any):React.CSSProperties => ({ background:H.surface, borderRadius:16, border:`1px solid ${H.border}`, boxShadow:'0 2px 8px rgba(0,0,0,0.06)', padding:'22px 24px', ...x })
const ghost = (x?:any):React.CSSProperties => ({ background:'#F5F5F4', color:H.muted, border:`1px solid ${H.border}`, borderRadius:8, fontFamily:H.font, fontWeight:600, fontSize:12, padding:'6px 12px', cursor:'pointer', display:'inline-flex', alignItems:'center', gap:5, textDecoration:'none', ...x })
const inp   = (x?:any):React.CSSProperties => ({ width:'100%', padding:'10px 14px', background:H.bg, border:`1px solid ${H.border}`, borderRadius:8, color:H.text, fontFamily:H.font, fontWeight:600, fontSize:13, outline:'none', boxSizing:'border-box' as const, ...x })

const CATEGORIES = ['Electronics','Lab Equipment','Sports Equipment','Books & Stationery','Furniture','Musical Instruments','Chemicals','Safety Equipment','Other']
const CONDITIONS  = ['new','good','fair','poor','damaged','under_repair','lost']

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

function InventoryFormContent() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const editId       = searchParams.get('id') || searchParams.get('edit')
  const supabase     = createClient()

  const [loading, setLoading]       = useState(false)
  const [fetchingItem, setFetching] = useState(!!editId)
  const [error, setError]           = useState('')
  const [staffList, setStaffList]   = useState<any[]>([])
  const [form, setForm]             = useState({
    name:'', description:'', category:'Electronics', serial_number:'', barcode:'',
    condition:'good', condition_notes:'', assigned_to:'', public_token:'',
    quantity_total:1, low_stock_threshold:1,
    location:'', purchase_date:'', purchase_price:'', notes:''
  })
  const set = (k: string, v: any) => setForm(p => ({...p,[k]:v}))

  useEffect(() => {
    const loadStaffAndItem = async () => {
      const { data: staff } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .eq('is_active', true)
        .order('full_name')
      setStaffList(staff || [])

      if (!editId) {
        setForm(p => ({ ...p, public_token: crypto.randomUUID() }))
        return
      }

      setFetching(true)
      const { data, error: fetchErr } = await supabase
        .from('inventory')
        .select('*')
        .eq('id', editId)
        .single()

      if (fetchErr || !data) {
        setError('Failed to load inventory item details.')
      } else {
        setForm({
          name: data.name || '',
          description: data.description || '',
          category: data.category || 'Electronics',
          serial_number: data.serial_number || '',
          barcode: data.barcode || '',
          condition: data.condition || 'good',
          condition_notes: data.condition_notes || '',
          assigned_to: data.assigned_to || '',
          public_token: data.public_token || crypto.randomUUID(),
          quantity_total: data.quantity_total ?? 1,
          low_stock_threshold: data.low_stock_threshold ?? 1,
          location: data.location || '',
          purchase_date: data.purchase_date || '',
          purchase_price: data.purchase_price ? String(data.purchase_price) : '',
          notes: data.notes || ''
        })
      }
      setFetching(false)
    }
    loadStaffAndItem()
  }, [editId, supabase])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('')
    if (!form.name.trim()) return setError('Item name is required.')
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession(); const user = session?.user
      const public_token = form.public_token || crypto.randomUUID()

      const payload: any = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        category: form.category,
        serial_number: form.serial_number.trim() || null,
        condition: form.condition,
        condition_notes: form.condition_notes.trim() || null,
        assigned_to: form.assigned_to || null,
        assigned_at: form.assigned_to ? new Date().toISOString() : null,
        public_token: public_token,
        quantity_total: form.quantity_total,
        quantity_available: form.quantity_total,
        low_stock_threshold: form.low_stock_threshold,
        location: form.location.trim() || null,
        purchase_date: form.purchase_date || null,
        purchase_price: form.purchase_price ? parseFloat(form.purchase_price) : null,
        notes: form.notes.trim() || null,
      }

      if (editId) {
        const { error: err } = await supabase
          .from('inventory')
          .update(payload)
          .eq('id', editId)
        if (err) throw err
      } else {
        const { data, error: err } = await supabase
          .from('inventory')
          .insert([{
            ...payload,
            created_by: user?.id,
            barcode: `INV-2026-${Math.floor(10000 + Math.random() * 90000)}`,
          }])
          .select()
          .single()
        if (err) throw err
        if (!data) throw new Error('Failed to create inventory item.')
      }

      router.push('/admin/inventory')
    } catch (err: any) {
      setError(err.message || 'Failed to save inventory item.')
      setLoading(false)
    }
  }

  const focusStyle = (e: React.FocusEvent<any>) => e.target.style.borderColor = H.mintGreen
  const blurStyle  = (e: React.FocusEvent<any>) => e.target.style.borderColor = H.border

  if (fetchingItem) {
    return (
      <div style={{ minHeight:'60vh', display:'flex', alignItems:'center', justifyContent:'center', color:H.text }}>
        <Loader2 size={32} style={{ animation:'spin 0.7s linear infinite', color: H.mintGreen }} />
      </div>
    )
  }

  return (
    <div style={{ minHeight:'100vh', background:H.bg, fontFamily:H.font, color:H.text }}>

      {/* Header */}
      <header style={{ height:68, padding:'0 28px', display:'flex', alignItems:'center', justifyContent:'space-between', borderBottom:`1px solid ${H.border}`, background:H.surface, backdropFilter:'blur(12px)', position:'sticky', top:0, zIndex:30 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <Package size={20} style={{ color: H.mintGreen }} />
          <div>
            <h1 style={{ fontFamily:H.font, fontSize:17, fontWeight:800, color:H.text, margin:0 }}>
              {editId ? 'Edit Inventory Item' : 'Add Inventory Item'}
            </h1>
            <p style={{ fontFamily:H.font, fontSize:11, color:H.muted, margin:0 }}>
              {editId ? 'Update item details and stock levels' : 'Barcode auto-generated on save'}
            </p>
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
                  <Label>Condition Status</Label>
                  <select style={{ ...inp(), cursor:'pointer', appearance:'none' as const }} value={form.condition} onChange={e=>set('condition',e.target.value)}>
                    {CONDITIONS.map(c=><option key={c} style={{ background:H.surface, color:H.mintGreen }}>{c.replace('_',' ')}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <Label>Condition / Maintenance Notes</Label>
                <input style={inp()} placeholder="Optional notes on item condition or repairs…" value={form.condition_notes}
                  onChange={e=>set('condition_notes',e.target.value)}
                  onFocus={focusStyle} onBlur={blurStyle}/>
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

          {/* Assignment & Tracking */}
          <Section title="Assignment & Tracking">
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <div>
                <Label>Assign Item To</Label>
                <select style={{ ...inp(), cursor:'pointer', appearance:'none' as const }} value={form.assigned_to} onChange={e=>set('assigned_to',e.target.value)}>
                  <option value="" style={{ background:H.surface, color:H.muted }}>Unassigned (Available)</option>
                  {staffList.map(s => (
                    <option key={s.id} value={s.id} style={{ background:H.surface, color:H.mintGreen }}>
                      {s.full_name} ({s.role || 'Staff'})
                    </option>
                  ))}
                </select>
                <p style={{ fontFamily:H.font, fontSize:11, color:H.sub, marginTop:5 }}>
                  Public QR scans hide identity and show role/department only ("Assigned to a Teacher").
                </p>
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
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, padding:'14px 16px', borderRadius:12, background:'rgba(6,182,212,0.06)', border:`1px solid rgba(6,182,212,0.2)` }}>
                <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(typeof window !== 'undefined' ? `${window.location.origin}/item/${form.public_token}` : form.public_token)}`}
                    alt="Item QR Code"
                    style={{ width: 54, height: 54, borderRadius: 8, border: `1px solid ${H.border}`, background: '#fff', padding: 4 }}
                  />
                  <div>
                    <div style={{ fontFamily:H.font, fontSize:12, fontWeight:700, color:H.text }}>
                      Barcode: <span style={{ fontFamily:'DM Mono, monospace', color:H.mintGreen }}>{form.barcode || 'INV-2026-AUTO'}</span>
                    </div>
                    <div style={{ fontFamily:H.font, fontSize:11, color:H.muted, marginTop:2 }}>
                      Encodes public URL: /item/{form.public_token?.slice(0, 8)}…
                    </div>
                  </div>
                </div>
                {form.public_token && (
                  <button
                    type="button"
                    onClick={() => {
                      const printWin = window.open('', '_blank');
                      if (printWin) {
                        const targetUrl = `${window.location.origin}/item/${form.public_token}`;
                        printWin.document.write(`
                          <html>
                            <head><title>Print QR Sticker - ${form.name}</title></head>
                            <body style="font-family: sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0;">
                              <div style="border: 2px dashed #000; padding: 16px; border-radius: 12px; text-align: center; width: 200px;">
                                <h3 style="margin: 0 0 6px; font-size: 14px;">${form.name}</h3>
                                <p style="margin: 0 0 10px; font-size: 11px; color: #666;">${form.category} | ${form.barcode || 'INV-2026'}</p>
                                <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(targetUrl)}" style="width: 120px; height: 120px;" />
                                <p style="margin: 8px 0 0; font-size: 10px; color: #888;">Scan to verify item</p>
                              </div>
                              <script>window.onload = function() { window.print(); window.close(); }</script>
                            </body>
                          </html>
                        `);
                        printWin.document.close();
                      }
                    }}
                    style={ghost({ padding: '6px 12px', fontSize: 12, background: H.surface })}
                  >
                    Print Sticker
                  </button>
                )}
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
              {loading ? <Loader2 size={16} style={{ animation:'spin 0.7s linear infinite' }}/> : <><Package size={16}/> {editId ? 'Update Item' : 'Save Item'}</>}
            </button>
          </div>
        </form>
      </main>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}*{box-sizing:border-box}::-webkit-scrollbar{width:5px}::-webkit-scrollbar-thumb{background:rgba(6,182,212,0.3);border-radius:99px}select option{background:#ffffff;color:#06b6d4}`}</style>
    </div>
  )
}

export default function NewInventoryPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight:'60vh', display:'flex', alignItems:'center', justifyContent:'center', color:H.text }}>
        <Loader2 size={32} style={{ animation:'spin 0.7s linear infinite', color: H.mintGreen }} />
      </div>
    }>
      <InventoryFormContent />
    </Suspense>
  )
}
