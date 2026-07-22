'use client'
import { useState, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, GraduationCap, ClipboardPaste, CheckCircle2, XCircle, Loader2, AlertCircle, Users, Download, Trash2, Upload } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

import { H } from '@/lib/honey'

const card  = (x?:any):React.CSSProperties => ({ background:H.surface, borderRadius:16, border:`1px solid ${H.border}`, boxShadow:'0 2px 8px rgba(0,0,0,0.06)', overflow:'hidden', ...x })
const hBtn  = (x?:any):React.CSSProperties => ({ background:H.skyBlue, color:'#FFFFFF', border:'none', borderRadius:10, fontFamily:H.font, fontWeight:700, fontSize:13, padding:'8px 16px', cursor:'pointer', display:'inline-flex', alignItems:'center', gap:6, textDecoration:'none', ...x })
const ghost = (x?:any):React.CSSProperties => ({ background:'#F5F5F4', color:H.muted, border:`1px solid ${H.border}`, borderRadius:8, fontFamily:H.font, fontWeight:600, fontSize:12, padding:'6px 12px', cursor:'pointer', display:'inline-flex', alignItems:'center', gap:5, textDecoration:'none', ...x })
const grass = (x?:any):React.CSSProperties => ({ background:H.grass, color:'#FFFFFF', border:'none', borderRadius:10, fontFamily:H.font, fontWeight:700, fontSize:13, padding:'8px 16px', cursor:'pointer', display:'inline-flex', alignItems:'center', gap:6, textDecoration:'none', ...x })
const inp   = (x?:any):React.CSSProperties => ({ width:'100%', padding:'10px 14px', background:H.bg, border:`1px solid ${H.border}`, borderRadius:8, color:H.text, fontFamily:H.font, fontWeight:600, fontSize:13, outline:'none', boxSizing:'border-box' as const, ...x })


const SUBJECTS = ['Maths','Science','English','Sinhala','Tamil','History','Geography','ICT','Art','Music','PE','Religion','Commerce','Biology','Chemistry','Physics','Economics','Other']

interface ParsedRow {
  index: number
  raw: string
  full_name: string
  email: string
  phone: string
  subjects: string[]
  errors: string[]
  status: 'valid' | 'error' | 'duplicate' | 'imported' | 'failed'
  failReason?: string
  tempPassword?: string
}

function parseRow(raw: string, idx: number): ParsedRow {
  // Split by tab (Excel paste) or comma
  const cols = raw.includes('\t') ? raw.split('\t') : raw.split(',')
  const clean = (s?: string) => (s || '').trim()

  const full_name = clean(cols[0])
  const email     = clean(cols[1])
  const phone     = clean(cols[2])
  const subjectsRaw = clean(cols[3])
  const subjects  = subjectsRaw
    ? subjectsRaw.split(/[\/,;]/).map(s => s.trim()).filter(Boolean)
    : []

  const errors: string[] = []
  const nameParts = full_name.split(/\s+/).filter(Boolean)
  if (!full_name)                    errors.push('Name is required')
  else if (nameParts.length < 2)    errors.push('Must be first + last name')
  else if (full_name.length < 4)    errors.push('Name too short')

  if (!email)                        errors.push('Email is required')
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('Invalid email format')

  return {
    index: idx,
    raw,
    full_name,
    email: email.toLowerCase(),
    phone,
    subjects,
    errors,
    status: errors.length > 0 ? 'error' : 'valid',
  }
}

export default function BulkTeacherImportPage() {
  const supabase = createClient()

  const [pasteText, setPasteText]   = useState('')
  const [rows, setRows]             = useState<ParsedRow[]>([])
  const [parsed, setParsed]         = useState(false)
  const [importing, setImporting]   = useState(false)
  const [done, setDone]             = useState(false)

  const handleParse = useCallback(() => {
    const lines = pasteText
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0)
      // Skip header row if it looks like one
      .filter(l => !/^(name|full.?name|teacher)/i.test(l.split(/[\t,]/)[0]))

    if (lines.length === 0) return
    setRows(lines.map((line, i) => parseRow(line, i)))
    setParsed(true)
    setDone(false)
  }, [pasteText])

  const removeRow = (idx: number) => setRows(p => p.filter(r => r.index !== idx))

  const handleImport = async () => {
    const validRows = rows.filter(r => r.status === 'valid')
    if (validRows.length === 0) return

    setImporting(true)

    // Check for duplicates in DB
    const emails = validRows.map(r => r.email)
    const { data: existing } = await supabase
      .from('allowed_users')
      .select('email')
      .in('email', emails)

    const existingEmails = new Set((existing || []).map((e: any) => e.email))

    // Also check profiles
    const { data: existingProfiles } = await supabase
      .from('profiles')
      .select('email')
      .in('email', emails)

    const profileEmails = new Set((existingProfiles || []).map((e: any) => e.email))

    // Mark duplicates
    setRows(prev => prev.map(r => {
      if (r.status !== 'valid') return r
      if (existingEmails.has(r.email)) return { ...r, status: 'duplicate' as const, failReason: 'Already pre-registered' }
      if (profileEmails.has(r.email)) return { ...r, status: 'duplicate' as const, failReason: 'Account already exists' }
      return r
    }))

    // Call backend API to create Auth users with temp passwords
    const toImport = validRows.filter(r => !existingEmails.has(r.email) && !profileEmails.has(r.email))

    try {
      const res = await fetch('/api/admin/bulk-create-teachers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teachers: toImport }),
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to import teachers')
      }

      const resMap = new Map((data.results || []).map((item: any) => [item.email, item]))

      setRows(prev => prev.map(r => {
        const item: any = resMap.get(r.email)
        if (item) {
          if (item.status === 'success') {
            return { ...r, status: 'imported' as const, tempPassword: item.tempPassword }
          } else {
            return { ...r, status: 'failed' as const, failReason: item.error }
          }
        }
        return r
      }))
    } catch (err: any) {
      setRows(prev => prev.map(r => r.status === 'valid' ? { ...r, status: 'failed' as const, failReason: err.message } : r))
    }

    setImporting(false)
    setDone(true)
  }

  const exportCredentials = () => {
    const importedRows = rows.filter(r => r.status === 'imported')
    if (importedRows.length === 0) return

    const csvLines = [
      'Full Name,Email,Temporary Password',
      ...importedRows.map(r => `"${r.full_name}","${r.email}","${r.tempPassword || 'N/A'}"`)
    ]
    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `teacher_passwords_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const validCount    = rows.filter(r => r.status === 'valid').length
  const errorCount    = rows.filter(r => r.status === 'error').length
  const importedCount = rows.filter(r => r.status === 'imported').length
  const dupCount      = rows.filter(r => r.status === 'duplicate').length
  const failedCount   = rows.filter(r => r.status === 'failed').length

  const downloadTemplate = () => {
    const csv = [
      'Full Name\tEmail\tPhone\tSubjects (slash separated)',
      'Kamal Perera\tkamal@school.lk\t0771234567\tMaths/Science',
      'Nimal Silva\tnimal@school.lk\t0787654321\tEnglish',
      'Amali Fernando\tamali@school.lk\t\tHistory/Geography',
    ].join('\n')
    const blob = new Blob([csv], { type: 'text/tab-separated-values' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = 'teacher_import_template.tsv'; a.click()
    URL.revokeObjectURL(url)
  }

  const statusStyle = (status: ParsedRow['status']) => {
    const map: Record<string, { bg: string, color: string, icon: React.ReactNode }> = {
      valid:     { bg: 'rgb(34 197 94/0.08)',   color: '#16a34a', icon: <CheckCircle2 size={13}/> },
      error:     { bg: 'rgb(239 68 68/0.08)',   color: '#dc2626', icon: <XCircle size={13}/> },
      duplicate: { bg: 'rgb(245 158 11/0.08)',  color: '#d97706', icon: <AlertCircle size={13}/> },
      imported:  { bg: 'rgb(34 197 94/0.12)',   color: '#16a34a', icon: <CheckCircle2 size={13}/> },
      failed:    { bg: 'rgb(239 68 68/0.12)',   color: '#dc2626', icon: <XCircle size={13}/> },
    }
    return map[status] || map.valid
  }

  return (
    <div style={{ minHeight:'100vh', background:H.bg, fontFamily:H.font, color:H.text }}>
      <header style={{ height:68, padding:'0 28px', display:'flex', alignItems:'center', justifyContent:'space-between', borderBottom:`1px solid ${H.border}`, background:H.surface, backdropFilter:'blur(12px)', position:'sticky', top:0, zIndex:30 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <Link href="/admin/teachers" style={ghost({ padding:'6px 10px', fontSize:12 })}>←</Link>
            <span style={{ fontSize:20 }}>👩‍🏫</span>
            <div>
              <div style={{ fontFamily:H.font, fontWeight:800, fontSize:17, color:H.text }}>Bulk Import Teachers</div>
              <div style={{ fontFamily:H.font, fontSize:11, color:H.muted }}>Paste from Excel to add multiple teachers at once</div>
            </div>
          </div>
        </header>

      <main style={{ maxWidth:960, margin:'0 auto', padding:'24px 28px', display:'flex', flexDirection:'column', gap:16 }}>

        {/* Instructions */}
        <div style={{ background:'rgba(238,189,43,0.06)', border:`2px solid rgba(238,189,43,0.2)`, borderRadius:14, padding:'16px 20px' }}>
          <div style={{ fontFamily:H.font, fontWeight:800, fontSize:13, color:H.honey, marginBottom:10, display:'flex', alignItems:'center', gap:8 }}>
            📋 How to use
          </div>
          <div style={{ fontFamily:H.font, fontSize:12, color:H.muted, lineHeight:1.7 }}>
            1. Download the Excel template below, fill it in, then select all cells and copy (Ctrl+C / Cmd+C).<br/>
            2. Paste into the box below. Columns: <strong style={{ color:H.text }}>Full Name · Email · Phone (optional) · Subjects (optional, slash-separated)</strong><br/>
            3. Review each row — fix any errors shown, then click Import.<br/>
            4. Teachers will receive an email invitation to register using their email address.
          </div>
          <button onClick={downloadTemplate} style={{ ...ghost({ padding:'6px 12px', fontSize:12 }), marginTop:12 }}>
            <Download size={13}/> Download Excel Template
          </button>
        </div>

        {/* Paste area */}
        {!parsed && (
          <div style={{ background:H.surface, borderRadius:18, border:`3px solid ${H.border}`, padding:'16px 20px', display:'flex', flexDirection:'column', gap:12 }}>
            <label style={{ fontWeight: 700, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ClipboardPaste size={14}/> Paste data from Excel
            </label>
            <textarea
              style={inp({ fontFamily:'monospace', fontSize:12, resize:'vertical', lineHeight:1.6, minHeight:160 })}
              rows={10}
              placeholder={`Kamal Perera\tkamal@school.lk\t0771234567\tMaths/Science\nNimal Silva\tnimal@school.lk\t0787654321\tEnglish\nAmali Fernando\tamali@school.lk\t\tHistory`}
              value={pasteText}
              onChange={e => setPasteText(e.target.value)}
            />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', color: H.muted }}>
                {pasteText.split('\n').filter(l => l.trim()).length} rows detected
              </span>
              <button onClick={handleParse}
                disabled={!pasteText.trim()}
                style={hBtn()}>
                <CheckCircle2 size={14}/> Validate Rows
              </button>
            </div>
          </div>
        )}

        {/* Parsed results */}
        {parsed && (
          <>
            {/* Summary bar */}
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
              {[
                { label: 'Ready to import', count: validCount,    color: '#22c55e' },
                { label: 'Errors',          count: errorCount,    color: '#ef4444' },
                { label: 'Duplicates',      count: dupCount,      color: '#f97316' },
                { label: 'Imported',        count: importedCount, color: '#6366f1' },
                { label: 'Failed',          count: failedCount,   color: '#dc2626' },
              ].filter(s => s.count > 0).map(s => (
                <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 12px', borderRadius: '20px', background: `${s.color}12`, border: `1px solid ${s.color}30` }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color }}/>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: s.color }}>{s.count}</span>
                  <span style={{ fontSize: '12px', color: H.sub }}>{s.label}</span>
                </div>
              ))}
              <button onClick={() => { setParsed(false); setDone(false); setRows([]) }}
                style={{ marginLeft: 'auto' }}>
                <Trash2 size={13}/> Start Over
              </button>
            </div>

            {/* Row table */}
            <div style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ background: '#F5F5F4', borderBottom: '1px solid #F5F5F4' }}>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: H.sub, fontSize: '11px', width: 32 }}>#</th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: H.sub, fontSize: '11px' }}>Full Name</th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: H.sub, fontSize: '11px' }}>Email</th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: H.sub, fontSize: '11px' }}>Phone</th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: H.sub, fontSize: '11px' }}>Subjects</th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: H.sub, fontSize: '11px' }}>Status</th>
                      <th style={{ padding: '10px 14px', width: 36 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => {
                      const st = statusStyle(row.status)
                      return (
                        <tr key={row.index} style={{ borderBottom: '1px solid #F5F5F4', background: i % 2 === 0 ? 'transparent' : '#F5F5F4' }}>
                          <td style={{ padding: '10px 14px', color: H.muted, fontWeight: 600 }}>{i + 1}</td>
                          <td style={{ padding: '10px 14px', fontWeight: 600 }}>{row.full_name || <span style={{ color: '#f87171', fontStyle: 'italic' }}>missing</span>}</td>
                          <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: '11px' }}>{row.email || <span style={{ color: '#f87171', fontStyle: 'italic' }}>missing</span>}</td>
                          <td style={{ padding: '10px 14px', color: H.sub }}>{row.phone || '—'}</td>
                          <td style={{ padding: '10px 14px' }}>
                            {row.subjects.length > 0
                              ? <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                  {row.subjects.map(s => (
                                    <span key={s} style={{ fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: '10px', background: 'rgb(99 102 241/0.1)', color: '#6366f1' }}>{s}</span>
                                  ))}
                                </div>
                              : <span style={{ color: H.muted, fontSize: '11px' }}>—</span>
                            }
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: st.color, fontWeight: 700, fontSize: '11px' }}>
                                {st.icon}
                                {row.status === 'valid'     && 'Ready'}
                                {row.status === 'error'     && 'Fix errors'}
                                {row.status === 'duplicate' && 'Duplicate'}
                                {row.status === 'imported'  && 'Imported ✓'}
                                {row.status === 'failed'    && 'Failed'}
                              </div>
                              {row.errors.map((e, ei) => (
                                <div key={ei} style={{ fontSize: '10px', color: '#dc2626' }}>• {e}</div>
                              ))}
                              {row.failReason && (
                                <div style={{ fontSize: '10px', color: row.status === 'duplicate' ? '#d97706' : '#dc2626' }}>• {row.failReason}</div>
                              )}
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
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Import button */}
            {!done && validCount > 0 && (
              <button onClick={handleImport} disabled={importing || validCount === 0}
                style={{ alignSelf: 'flex-end', padding: '12px 28px' }}>
                {importing
                  ? <><Loader2 size={15} style={{ animation:'spin 0.7s linear infinite' }}/> Importing…</>
                  : <><Upload size={15}/> Import {validCount} Teacher{validCount !== 1 ? 's' : ''}</>
                }
              </button>
            )}

            {done && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderRadius: '12px', background: 'rgba(143,179,57,0.1)', border: '2px solid rgba(143,179,57,0.3)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <CheckCircle2 size={18} style={{ color: '#22c55e' }}/>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '14px', color: '#16a34a' }}>
                      {importedCount} teacher{importedCount !== 1 ? 's' : ''} imported successfully
                    </div>
                    <div style={{ fontSize: '12px', color: H.sub }}>
                      Accounts added — teachers can now sign in using their email address and temporary password.
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button onClick={exportCredentials} style={grass({ padding:'6px 14px', fontSize:12 })}>
                    <Download size={13}/> Export Passwords CSV
                  </button>
                  <Link href="/admin/teachers" style={hBtn({ padding:'6px 14px', fontSize:12 })}>
                    <Users size={13}/> View Teachers
                  </Link>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}*{box-sizing:border-box}::-webkit-scrollbar{width:5px}::-webkit-scrollbar-thumb{background:rgba(238,189,43,0.3);border-radius:99px}`}</style>
    </div>
  )
}
