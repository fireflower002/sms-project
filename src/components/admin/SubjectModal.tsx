'use client'
import { useState, useEffect } from 'react'
import { X, Plus, Edit2, Check, Loader2, Sparkles, AlertCircle, Palette } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { H } from '@/lib/honey'
import { getSubjectSuggestion, formatSubjectName } from '@/lib/subjectUtils'
import { useFocusTrap } from '@/lib/useFocusTrap'

export const CURATED_PALETTE = [
  '#F59E0B', // Warm Amber (38°)
  '#8B5CF6', // Purple (258°)
  '#EAB308', // Golden Yellow (48°)
  '#EF4444', // Red (0°)
  '#06B6D4', // Cyan (189°)
  '#EC4899', // Pink (330°)
  '#10B981', // Emerald Green (160°)
  '#F97316', // Orange (24°)
  '#3B82F6', // Blue (217°)
  '#84CC16', // Lime Green (84°)
  '#D946EF', // Fuchsia (292°)
  '#059669', // Mint Green (160°)
  '#7C3AED', // Deep Purple (263°)
  '#F43F5E', // Rose (349°)
  '#14B8A6', // Teal (173°)
  '#6366F1', // Indigo (239°)
  '#B45309', // Bronze (28°)
  '#0EA5E9', // Sky Blue (199°)
  '#E11D48', // Crimson (348°)
  '#1D4ED8', // Deep Blue (224°)
  '#15803D', // Forest Green (142°)
  '#0284C7', // Ocean Blue (201°)
  '#4338CA', // Iris (244°)
]

export const DEFAULT_SUBJECT_COLORS: Record<string, string> = {
  English: '#3B82F6',   // Blue
  Maths: '#6366F1',     // Indigo
  Mathematics: '#6366F1',// Indigo
  Science: '#10B981',   // Emerald Green
  History: '#F59E0B',   // Warm Amber
  Music: '#EAB308',     // Golden Yellow
  Sinhala: '#F97316',   // Orange
  Tamil: '#8B5CF6',     // Purple
  Geography: '#0284C7', // Ocean Blue
  ICT: '#84CC16',       // Lime Green
  Art: '#EC4899',       // Pink
  PE: '#059669',        // Mint Green
  Religion: '#7C3AED',  // Deep Violet
  Commerce: '#D946EF',  // Fuchsia
  Biology: '#14B8A6',   // Teal
  Chemistry: '#4338CA', // Deep Iris
  Physics: '#0EA5E9',   // Sky Blue
  Economics: '#B45309', // Bronze
  'Combined Maths': '#E11D48',// Crimson
}

export const PREDEFINED_SUBJECTS = [
  'Maths','Science','English','Sinhala','Tamil','History',
  'Geography','ICT','Art','Music','PE','Religion',
  'Commerce','Biology','Chemistry','Physics','Economics','Combined Maths'
]

interface SubjectModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (updatedColors: Record<string, string>) => void
}

export default function SubjectModal({ isOpen, onClose, onSuccess }: SubjectModalProps) {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [subjectColors, setSubjectColors] = useState<Record<string, string>>({})
  const [subjectsList, setSubjectsList] = useState<string[]>([])
  
  // New subject state
  const [newSubjectName, setNewSubjectName] = useState('')
  const [selectedColor, setSelectedColor] = useState(CURATED_PALETTE[0])
  const [editingSubject, setEditingSubject] = useState<string | null>(null)
  const [editColor, setEditColor] = useState('')

  const containerRef = useFocusTrap<HTMLDivElement>({
    isOpen,
    onClose,
  })

  useEffect(() => {
    if (!isOpen) return
    const loadSubjects = async () => {
      setLoading(true)
      setError('')
      setNotice('')
      const [{ data: profs }, { data: asgns }] = await Promise.all([
        supabase.from('profiles').select('id, subjects, subject_colors'),
        supabase.from('schedule_assignments').select('subject, subject_color'),
      ])

      const set = new Set(PREDEFINED_SUBJECTS)
      const colorMap: Record<string, string> = {}

      ;(profs || []).forEach((p: any) => {
        (p.subjects || []).forEach((s: string) => { if (s && s !== 'Other') set.add(s.trim()) })
        if (p.subject_colors) Object.assign(colorMap, p.subject_colors)
      })

      ;(asgns || []).forEach((a: any) => {
        if (a.subject && a.subject !== 'Other') {
          set.add(a.subject.trim())
          if (a.subject_color && !colorMap[a.subject]) {
            colorMap[a.subject] = a.subject_color
          }
        }
      })

      const list = Array.from(set).sort((a, b) => a.localeCompare(b))
      const usedColors = new Set(Object.values(colorMap))

      list.forEach((subj, idx) => {
        if (!colorMap[subj] || (subj === 'Music' && (colorMap[subj] === '#14B8A6' || colorMap[subj] === '#06B6D4'))) {
          let chosen = DEFAULT_SUBJECT_COLORS[subj] || CURATED_PALETTE.find(c => !usedColors.has(c)) || CURATED_PALETTE[idx % CURATED_PALETTE.length]
          usedColors.add(chosen)
          colorMap[subj] = chosen
        }
      })

      setSubjectsList(list)
      setSubjectColors(colorMap)
      
      // Auto pick an unused color for new subject
      const unused = CURATED_PALETTE.find(c => !usedColors.has(c)) || CURATED_PALETTE[0]
      setSelectedColor(unused)
      setLoading(false)
    }
    loadSubjects()
  }, [isOpen, supabase])

  if (!isOpen) return null

  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault()
    const name = formatSubjectName(newSubjectName)
    if (!name) return

    setError('')
    setNotice('')

    // Case-insensitive exact match check
    const existingMatch = subjectsList.find(s => s.toLowerCase() === name.toLowerCase())
    if (existingMatch) {
      setError(`Subject "${existingMatch}" already exists.`)
      return
    }

    // Hex color format validation
    if (!/^#[0-9A-Fa-f]{6}$/.test(selectedColor)) {
      setError(`Invalid hex color format: "${selectedColor}". Must be 6-digit hex code.`)
      return
    }

    setSaving(true)

    const updatedMap = { ...subjectColors, [name]: selectedColor }
    const updatedList = Array.from(new Set([...subjectsList, name])).sort((a, b) => a.localeCompare(b))

    try {
      // Primary Path: Call Postgres RPC function for atomic per-profile JSONB merge
      const { error: rpcErr } = await supabase.rpc('sync_subject_color_globally', {
        p_subject: name,
        p_color: selectedColor,
      })

      if (rpcErr) {
        console.warn('[SubjectModal] RPC failed or not present, running client-side JSONB merge loop with rollback:', rpcErr.message)
        // Fallback: Per-profile snapshot & atomic rollback loop
        const { data: profs, error: fetchErr } = await supabase.from('profiles').select('id, subject_colors')
        if (fetchErr) throw fetchErr

        const snapshots = new Map<string, any>()
        const updatedIds: string[] = []

        if (profs && profs.length > 0) {
          try {
            for (const p of profs) {
              snapshots.set(p.id, p.subject_colors || {})
              const merged = { ...(p.subject_colors || {}), [name]: selectedColor }
              const { error: updErr } = await supabase.from('profiles').update({ subject_colors: merged }).eq('id', p.id)
              if (updErr) throw updErr
              updatedIds.push(p.id)
            }
          } catch (fallbackErr: any) {
            console.error('[SubjectModal] Fallback loop failed, executing rollback on updated profiles...')
            for (const id of updatedIds) {
              await supabase.from('profiles').update({ subject_colors: snapshots.get(id) }).eq('id', id)
            }
            throw new Error(`Subject creation failed: ${fallbackErr.message}. All profile changes were cleanly rolled back.`)
          }
        }
      }

      setSubjectColors(updatedMap)
      setSubjectsList(updatedList)
      setNewSubjectName('')
      setNotice(`Subject "${name}" added successfully.`)

      // Pick next unused color
      const used = new Set(Object.values(updatedMap))
      setSelectedColor(CURATED_PALETTE.find(c => !used.has(c)) || CURATED_PALETTE[0])

      onSuccess(updatedMap)
    } catch (err: any) {
      setError(err.message || 'Failed to add subject.')
    } finally {
      setSaving(false)
    }
  }

  const handleUpdateSubjectColor = async (subj: string, newColor: string) => {
    // Hex color format validation
    if (!/^#[0-9A-Fa-f]{6}$/.test(newColor)) {
      setError(`Invalid hex color format: "${newColor}". Must be 6-digit hex code.`)
      return
    }

    setSaving(true)
    setError('')
    const updatedMap = { ...subjectColors, [subj]: newColor }

    try {
      // Primary Path: Call Postgres RPC function for atomic per-profile JSONB merge
      const { error: rpcErr } = await supabase.rpc('sync_subject_color_globally', {
        p_subject: subj,
        p_color: newColor,
      })

      if (rpcErr) {
        console.warn('[SubjectModal] RPC failed or not present, running client-side JSONB merge loop with rollback:', rpcErr.message)
        const { data: profs, error: fetchErr } = await supabase.from('profiles').select('id, subject_colors')
        if (fetchErr) throw fetchErr

        const snapshots = new Map<string, any>()
        const updatedIds: string[] = []

        if (profs && profs.length > 0) {
          try {
            for (const p of profs) {
              snapshots.set(p.id, p.subject_colors || {})
              const merged = { ...(p.subject_colors || {}), [subj]: newColor }
              const { error: updErr } = await supabase.from('profiles').update({ subject_colors: merged }).eq('id', p.id)
              if (updErr) throw updErr
              updatedIds.push(p.id)
            }
          } catch (fallbackErr: any) {
            console.error('[SubjectModal] Fallback loop failed, executing rollback on updated profiles...')
            for (const id of updatedIds) {
              await supabase.from('profiles').update({ subject_colors: snapshots.get(id) }).eq('id', id)
            }
            throw new Error(`Subject color update failed: ${fallbackErr.message}. All profile changes were cleanly rolled back.`)
          }
        }
      }

      setSubjectColors(updatedMap)
      setEditingSubject(null)
      onSuccess(updatedMap)
    } catch (err: any) {
      setError(err.message || 'Failed to update subject color.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="subject-modal-title"
      style={{
        position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(28, 25, 23, 0.6)', backdropFilter: 'blur(4px)', padding: '16px'
      }}
    >
      <div style={{
        position: 'relative', width: '100%', maxWidth: '640px', borderRadius: '16px', backgroundColor: H.surface,
        border: `1px solid ${H.border}`, boxShadow: H.shadows.modal, padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px',
        maxHeight: '90vh', overflowY: 'auto'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 id="subject-modal-title" style={{ fontSize: '20px', fontWeight: 800, color: H.textPrimary, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Palette size={20} style={{ color: H.purple }} /> Subject & Color Manager
            </h2>
            <p style={{ fontSize: '13px', color: H.textSec, margin: '4px 0 0' }}>
              Manage global subjects and customize palette colors across the school schedule.
            </p>
          </div>
          <button onClick={onClose} style={{ background: H.bg, border: `1px solid ${H.border}`, borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <X size={18} style={{ color: H.textSec }} />
          </button>
        </div>

        {error && (
          <div style={{ padding: '12px 16px', borderRadius: '10px', backgroundColor: H.dangerLight, border: `1px solid ${H.danger}`, color: H.danger, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {notice && (
          <div style={{ padding: '12px 16px', borderRadius: '10px', backgroundColor: H.successLight, border: `1px solid ${H.successGreen}`, color: '#065F46', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Check size={16} /> {notice}
          </div>
        )}

        {/* Add New Subject Form */}
        <form onSubmit={handleAddSubject} style={{ padding: '16px', borderRadius: '12px', backgroundColor: '#FAF9F6', border: `1px solid ${H.border}` }}>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: H.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
            Add New Subject
          </label>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="text"
              value={newSubjectName}
              onChange={e => setNewSubjectName(e.target.value)}
              placeholder="Subject name (e.g. Robotics, Astronomy)..."
              style={{
                flex: 1, minWidth: '200px', padding: '10px 14px', borderRadius: '10px',
                border: `1px solid ${H.border}`, background: H.surface, color: H.textPrimary,
                fontSize: '13px', outline: 'none'
              }}
            />
            <button
              type="submit"
              disabled={saving || !newSubjectName.trim()}
              style={{
                backgroundColor: H.purple, color: '#FFFFFF', border: 'none',
                borderRadius: '10px', fontWeight: 700, fontSize: '13px',
                padding: '10px 18px', cursor: 'pointer', display: 'inline-flex',
                alignItems: 'center', gap: '6px', opacity: (saving || !newSubjectName.trim()) ? 0.6 : 1
              }}
            >
              {saving ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Plus size={15} />}
              Add Subject
            </button>
          </div>

          {/* FUZZY CLOSEST MATCH SUGGESTION HINT */}
          {(() => {
            const suggestion = getSubjectSuggestion(newSubjectName, subjectsList)
            if (!suggestion) return null
            return (
              <div style={{
                marginTop: '8px',
                padding: '6px 10px',
                borderRadius: '8px',
                backgroundColor: '#FEF3C7',
                border: '1px solid #F59E0B',
                color: '#92400E',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                flexWrap: 'wrap'
              }}>
                <span>💡 Did you mean:</span>
                <button
                  type="button"
                  onClick={() => {
                    setNewSubjectName('')
                    setEditingSubject(suggestion)
                    setEditColor(subjectColors[suggestion] || CURATED_PALETTE[0])
                    setNotice(`Found existing subject "${suggestion}".`)
                  }}
                  style={{
                    background: '#F59E0B',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '2px 8px',
                    fontWeight: 700,
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                >
                  {suggestion}
                </button>
              </div>
            )
          })()}

          {/* Color Palette Selector for New Subject */}
          <div style={{ marginTop: '12px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: H.textSec, display: 'block', marginBottom: '6px' }}>Select Color Palette:</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {CURATED_PALETTE.map(color => {
                const isSelected = selectedColor === color
                return (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setSelectedColor(color)}
                    style={{
                      width: 26, height: 26, borderRadius: '50%', backgroundColor: color,
                      border: isSelected ? '3px solid #1C1917' : '2px solid #FFFFFF',
                      cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}
                  >
                    {isSelected && <Check size={12} style={{ color: '#FFFFFF' }} />}
                  </button>
                )
              })}
            </div>
          </div>
        </form>

        {/* Existing Subjects List */}
        <div>
          <h3 style={{ fontSize: '13px', fontWeight: 700, color: H.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 10px' }}>
            Active Subjects ({subjectsList.length})
          </h3>

          {loading ? (
            <div style={{ padding: '24px', textAlign: 'center' }}>
              <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', color: H.purple }} />
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '10px' }}>
              {subjectsList.map(subj => {
                const color = subjectColors[subj] || CURATED_PALETTE[0]
                const isEditingThis = editingSubject === subj

                return (
                  <div key={subj} style={{
                    padding: '10px 14px', borderRadius: '10px', border: `1px solid ${H.border}`,
                    backgroundColor: H.surface, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ width: 14, height: 14, borderRadius: '50%', backgroundColor: color, display: 'inline-block', flexShrink: 0 }} />
                      <span style={{ fontSize: '13px', fontWeight: 700, color: H.textPrimary }}>{subj}</span>
                    </div>

                    {!isEditingThis ? (
                      <button
                        type="button"
                        onClick={() => { setEditingSubject(subj); setEditColor(color) }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: H.textSec, padding: '4px' }}
                      >
                        <Edit2 size={14} />
                      </button>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <div style={{ display: 'flex', gap: '2px' }}>
                          {CURATED_PALETTE.slice(0, 5).map(c => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => handleUpdateSubjectColor(subj, c)}
                              style={{ width: 14, height: 14, borderRadius: '50%', backgroundColor: c, border: editColor === c ? '2px solid #000' : 'none', cursor: 'pointer' }}
                            />
                          ))}
                        </div>
                        <button type="button" onClick={() => setEditingSubject(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: H.textMuted }}>
                          <X size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
