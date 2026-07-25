'use client'
import { useState, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, GraduationCap, ClipboardPaste, CheckCircle2, XCircle, Loader2, AlertCircle, Package, Download, Trash2, Upload } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

import { H } from '@/lib/honey'

const card  = (x?:any):React.CSSProperties => ({ background:H.surface, borderRadius:16, border:`1px solid ${H.border}`, boxShadow:'0 2px 8px rgba(0,0,0,0.06)', overflow:'hidden', ...x })
const hBtn  = (x?:any):React.CSSProperties => ({ background:H.mintGreen, color:'#FFFFFF', border:'none', borderRadius:10, fontFamily:H.font, fontWeight:700, fontSize:13, padding:'8px 16px', cursor:'pointer', display:'inline-flex', alignItems:'center', gap:6, textDecoration:'none', ...x })
const ghost = (x?:any):React.CSSProperties => ({ background:'#F5F5F4', color:H.muted, border:`1px solid ${H.border}`, borderRadius:8, fontFamily:H.font, fontWeight:600, fontSize:12, padding:'6px 12px', cursor:'pointer', display:'inline-flex', alignItems:'center', gap:5, textDecoration:'none', ...x })
const grass = (x?:any):React.CSSProperties => ({ background:H.grass, color:'#FFFFFF', border:'none', borderRadius:10, fontFamily:H.font, fontWeight:700, fontSize:13, padding:'8px 16px', cursor:'pointer', display:'inline-flex', alignItems:'center', gap:6, textDecoration:'none', ...x })
const inp   = (x?:any):React.CSSProperties => ({ width:'100%', padding:'10px 14px', background:H.bg, border:`1px solid ${H.border}`, borderRadius:8, color:H.text, fontFamily:H.font, fontWeight:600, fontSize:13, outline:'none', boxSizing:'border-box' as const, ...x })


const CATEGORIES = ['Electronics','Lab Equipment','Sports Equipment','Books & Stationery','Furniture','Musical Instruments','Chemicals','Safety Equipment','Other']
const CONDITIONS  = ['new','good','fair','poor','damaged']

interface ParsedRow {
  index: number
  name: string
  category: string
  quantity: number
  condition: string
  location: string
  serial_number: string
  purchase_price: string
  notes: string
  errors: string[]
  status: 'valid' | 'error' | 'imported' | 'failed'
  failReason?: string
}

function parseRow(raw: string, idx: number): ParsedRow {
  const cols = raw.includes('\t') ? raw.split('\t') : raw.split(',')
  const clean = (s?: string) => (s || '').trim()

  const name           = clean(cols[0])
  const category       = clean(cols[1]) || 'Other'
  const quantityRaw    = clean(cols[2])
  const quantity       = parseInt(quantityRaw) || 1
  const condition      = clean(cols[3]).toLowerCase() || 'good'
  const location       = clean(cols[4])
  const serial_number  = clean(cols[5])
  const purchase_price = clean(cols[6])
  const notes          = clean(cols[7])

  const errors: string[] = []

  if (!name)               errors.push('Item name is required')
  else if (name.length < 2) errors.push('Name too short')

  const matchedCategory = CATEGORIES.find(c => c.toLowerCase() === category.toLowerCase()) || null
  if (!matchedCategory)    errors.push(`Category "${category}" not recognised — will use "Other"`)

  if (quantityRaw && isNaN(parseInt(quantityRaw))) errors.push('Quantity must be a number')
  if (quantity < 1)        errors.push('Quantity must be at least 1')

  const matchedCondition = CONDITIONS.find(c => c === condition || condition.startsWith(c))
  if (condition && !matchedCondition) errors.push(`Condition "${condition}" not recognised — will use "good"`)

  if (purchase_price && isNaN(parseFloat(purchase_price))) errors.push('Price must be a number')

  return {
    index: idx,
    name,
    category: matchedCategory || 'Other',
    quantity: Math.max(1, quantity),
    condition: matchedCondition || 'good',
    location,
    serial_number,
    purchase_price,
    notes,
    errors: errors.filter(e => !e.includes('will use')), // warnings don't block
    status: errors.filter(e => !e.includes('will use')).length > 0 ? 'error' : 'valid',
  }
}

export default function BulkInventoryImportPage() {
  const supabase = createClient()

  const [rows, setRows]             = useState<ParsedRow[]>([])
  const [parsed, setParsed]         = useState(false)
  const [importing, setImporting]   = useState(false)
  const [done, setDone]             = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  const processFile = useCallback((file: File) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      if (!text) return
      const lines = text
        .split(/\r?\n/)
        .map(l => l.trim())
        .filter(l => l.length > 0)
        .filter(l => !/^(name|item.?name|category)/i.test(l.split(/[\t,;]/)[0]))

      if (lines.length === 0) return
      setRows(lines.map((line, i) => parseRow(line, i)))
      setParsed(true)
      setDone(false)
    }
    reader.readAsText(file)
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) processFile(file)
  }

  const removeRow = (idx: number) => setRows(p => p.filter(r => r.index !== idx))

  const handleImport = async () => {
    const validRows = rows.filter(r => r.status === 'valid')
    if (validRows.length === 0) return
    setImporting(true)

    const { data: { session } } = await supabase.auth.getSession(); const user = session?.user

    for (const row of validRows) {
      const { error } = await supabase.from('inventory').insert({
        name:               row.name,
        category:           row.category || 'Other',
        quantity_total:     row.quantity || 1,
        quantity_available: row.quantity || 1,
        condition:          row.condition || 'good',
        location:           row.location || null,
        serial_number:      row.serial_number || null,
        purchase_price:     row.purchase_price ? parseFloat(row.purchase_price) : null,
        notes:              row.notes || null,
        public_token:       crypto.randomUUID(),
        low_stock_threshold: 1,
        is_active:          true,
        created_by:         user?.id,
      })

      setRows(prev => prev.map(r =>
        r.index === row.index
          ? { ...r, status: error ? 'failed' : 'imported', failReason: error?.message }
          : r
      ))
    }

    setImporting(false)
    setDone(true)
  }

  const validCount    = rows.filter(r => r.status === 'valid').length
  const errorCount    = rows.filter(r => r.status === 'error').length
  const importedCount = rows.filter(r => r.status === 'imported').length
  const failedCount   = rows.filter(r => r.status === 'failed').length

  const downloadTemplate = () => {
    const csv = [
      'Item Name,Category,Quantity,Condition,Location,Serial Number,Purchase Price (LKR),Notes',
      'Dell Laptop,Electronics,5,new,IT Room,DL001,120000,For student lab',
      'Whiteboard,Furniture,10,good,Storeroom,,,',
      'Chemistry Kit,Lab Equipment,8,good,Lab 2,,45000,',
      'Football,Sports Equipment,6,fair,Sports Room,,,',
    ].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = 'inventory_import_template.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const conditionColor: Record<string, string> = { new: '#22c55e', good: '#6366f1', fair: '#f97316', poor: '#ef4444', damaged: '#b91c1c' }

  return (
    <div style={{ minHeight:'100vh', background:H.bg, fontFamily:H.font, color:H.text }}>
      <header style={{ height:68, padding:'0 24px', display:'flex', alignItems:'center', justifyContent:'space-between', borderBottom:`1px solid ${H.border}`, background:H.surface, backdropFilter:'blur(12px)', position:'sticky', top:0, zIndex:30 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ width:36, height:36, borderRadius:10, backgroundColor:'rgba(6,182,212,0.12)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <Package size={20} style={{ color: H.mintGreen }} />
          </div>
          <div>
            <div style={{ fontFamily:H.font, fontWeight:800, fontSize:17, color:H.text }}>Bulk Import Inventory</div>
            <div style={{ fontFamily:H.font, fontSize:11, color:H.muted }}>Upload an Excel or CSV file to add multiple items at once</div>
          </div>
        </div>
      </header>

      <main style={{ maxWidth:960, margin:'0 auto', padding:'24px 20px 100px 20px', display:'flex', flexDirection:'column', gap:20 }}>

        {!parsed && (
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h2 style={{ fontFamily: H.font, fontWeight: 800, fontSize: 16, color: H.text, margin: 0 }}>Upload Inventory File</h2>
                <p style={{ fontFamily: H.font, fontSize: 12, color: H.muted, margin: '2px 0 0' }}>Upload a .xlsx or .csv file containing inventory item records</p>
              </div>
              <button onClick={downloadTemplate} style={ghost({ padding: '8px 14px', fontSize: 13, gap: 6 })}>
                <Download size={14} /> Download Excel Template
              </button>
            </div>

            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
              onDragLeave={(e) => { e.preventDefault(); setIsDragging(false) }}
              onDrop={handleDrop}
              onClick={() => document.getElementById('inventory-file-upload-input')?.click()}
              style={{
                background: isDragging ? 'rgba(6,182,212,0.06)' : H.surface,
                border: `2px dashed ${isDragging ? H.mintGreen : H.border}`,
                borderRadius: 18,
                padding: '48px 24px',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 12,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              <input
                id="inventory-file-upload-input"
                type="file"
                accept=".xlsx,.csv,.tsv,.txt"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
              <div style={{ width: 52, height: 52, borderRadius: 16, background: 'rgba(6,182,212,0.12)', color: H.mintGreen, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Upload size={26} />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 15, color: H.text }}>
                  Drop your Excel (.xlsx / .csv) file here, or <span style={{ color: H.mintGreen, textDecoration: 'underline' }}>browse files</span>
                </div>
                <div style={{ fontSize: 12, color: H.muted, marginTop: 4 }}>
                  Columns: Item Name, Category, Quantity, Condition, Location, Serial Number, Price, Notes
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Parsed results */}
        {parsed && (
          <>
            {/* Summary */}
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
              {[
                { label: 'Ready',    count: validCount,    color: '#22c55e' },
                { label: 'Errors',   count: errorCount,    color: '#ef4444' },
                { label: 'Imported', count: importedCount, color: '#6366f1' },
                { label: 'Failed',   count: failedCount,   color: '#dc2626' },
              ].filter(s => s.count > 0).map(s => (
                <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 12px', borderRadius: '20px', background: `${s.color}12`, border: `1px solid ${s.color}30` }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color }}/>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: s.color }}>{s.count}</span>
                  <span style={{ fontSize: '12px', color: H.sub }}>{s.label}</span>
                </div>
              ))}
              <button onClick={() => { setParsed(false); setDone(false); setRows([]) }}
                style={ghost({ padding:'6px 10px', fontSize:12 })}>
                <Trash2 size={13}/> Start Over
              </button>
            </div>

            {/* Table */}
            <div style={card({ padding: 0, overflow: 'hidden' })}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', minWidth: '760px' }}>
                  <thead>
                    <tr style={{ background: '#F5F5F4', borderBottom: '1px solid #F5F5F4' }}>
                      {['#','Item Name','Category','Qty','Condition','Location','Serial No.','Status',''].map(h => (
                        <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: H.sub, fontSize: '11px', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr key={row.index} style={{ borderBottom: '1px solid #F5F5F4', background: i % 2 === 0 ? 'transparent' : '#F5F5F4' }}>
                        <td style={{ padding: '10px 12px', color: H.muted, fontWeight: 600 }}>{i + 1}</td>
                        <td style={{ padding: '10px 12px', fontWeight: 600, maxWidth: '160px' }}>{row.name || <span style={{ color: '#ef4444', fontStyle: 'italic' }}>missing</span>}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px', background: 'rgb(99 102 241/0.1)', color: '#6366f1', whiteSpace: 'nowrap' }}>
                            {row.category}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', fontWeight: 700, textAlign: 'center' }}>{row.quantity}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px', background: `${conditionColor[row.condition]}15`, color: conditionColor[row.condition], textTransform: 'capitalize' }}>
                            {row.condition}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', color: H.sub, fontSize: '11px' }}>{row.location || '—'}</td>
                        <td style={{ padding: '10px 12px', color: H.sub, fontFamily: 'monospace', fontSize: '11px' }}>{row.serial_number || '—'}</td>
                        <td style={{ padding: '10px 12px', minWidth: '120px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 700, fontSize: '11px',
                              color: row.status === 'valid' ? '#22c55e' : row.status === 'imported' ? '#6366f1' : '#ef4444' }}>
                              {row.status === 'valid'    && <><CheckCircle2 size={12}/> Ready</>}
                              {row.status === 'error'    && <><XCircle size={12}/> Fix errors</>}
                              {row.status === 'imported' && <><CheckCircle2 size={12}/> Imported ✓</>}
                              {row.status === 'failed'   && <><XCircle size={12}/> Failed</>}
                            </div>
                            {row.errors.map((e, ei) => <div key={ei} style={{ fontSize: '10px', color: '#dc2626' }}>• {e}</div>)}
                            {row.failReason && <div style={{ fontSize: '10px', color: '#dc2626' }}>• {row.failReason}</div>}
                          </div>
                        </td>
                        <td style={{ padding: '10px 8px' }}>
                          {row.status !== 'imported' && (
                            <button onClick={() => removeRow(row.index)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: H.muted, padding: '4px' }}>
                              <Trash2 size={13}/>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {!done && validCount > 0 && (
              <button onClick={handleImport} disabled={importing}
                style={hBtn({ alignSelf: 'flex-end', padding: '12px 28px' })}>
                {importing
                  ? <><Loader2 size={15} style={{ animation:'spin 0.7s linear infinite' }}/> Importing…</>
                  : <><Upload size={15}/> Import {validCount} Item{validCount !== 1 ? 's' : ''}</>
                }
              </button>
            )}

            {done && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderRadius: '12px', background: 'rgb(34 197 94/0.08)', border: '1px solid rgb(34 197 94/0.2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <CheckCircle2 size={18} style={{ color: '#22c55e' }}/>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '14px', color: '#16a34a' }}>
                      {importedCount} item{importedCount !== 1 ? 's' : ''} added to inventory
                    </div>
                    <div style={{ fontSize: '12px', color: H.sub }}>
                      You can now assign items to teachers from the inventory page
                    </div>
                  </div>
                </div>
                <Link href="/admin/inventory" style={hBtn({ padding:'6px 14px', fontSize:12 })}>
                  <Package size={13}/> View Inventory
                </Link>
              </div>
            )}
          </>
        )}
      </main>
    
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}*{box-sizing:border-box}::-webkit-scrollbar{width:5px}::-webkit-scrollbar-thumb{background:rgba(238,189,43,0.3);border-radius:99px}`}</style>
    </div>
  )
}
