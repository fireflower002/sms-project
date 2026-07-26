'use client'
import { useState, useEffect } from 'react'
import { X, Plus, Edit2, Check, Loader2, Sparkles, AlertCircle, Palette } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { H } from '@/lib/honey'

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
  English: '#06B6D4', // Cyan
  Music: '#EAB308',   // Golden Yellow (Visually distinct from Cyan)
  Maths: '#F43F5E',   // Rose Red
  Science: '#10B981', // Emerald Green
  Sinhala: '#F97316', // Orange
  Tamil: '#8B5CF6',   // Purple
  History: '#B45309', // Bronze
  Geography: '#3B82F6', // Blue
  ICT: '#84CC16',     // Lime Green
  Art: '#EC4899',     // Pink
  PE: '#059669',      // Mint Green
  Religion: '#7C3AED',// Deep Violet
  Commerce: '#D946EF',// Fuchsia
  Biology: '#14B8A6', // Teal
  Chemistry: '#6366F1',// Indigo
  Physics: '#0284C7', // Ocean Blue
  Economics: '#F59E0B',// Warm Amber
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
  const [subjectColors, setSubjectColors] = useState<Record<string, string>>({})
  const [subjectsList, setSubjectsList] = useState<string[]>([])
  
  // New subject state
  const [newSubjectName, setNewSubjectName] = useState('')
  const [selectedColor, setSelectedColor] = useState(CURATED_PALETTE[0])
  const [editingSubject, setEditingSubject] = useState<string | null>(null)
  const [editColor, setEditColor] = useState('')

  useEffect(() => {
    if (!isOpen) return
    const loadSubjects = async () => {
      setLoading(true)
      setError('')
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

      const list = Array.from(set).sort()
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
    const name = newSubjectName.trim()
    if (!name) return

    if (subjectsList.map(s => s.toLowerCase()).includes(name.toLowerCase())) {
      setError(`Subject "${name}" already exists.`)
      return
    }

    setSaving(true)
    setError('')

    const updatedMap = { ...subjectColors, [name]: selectedColor }
    const updatedList = [...subjectsList, name].sort()

    try {
      // 1. Update profiles subject_colors
      const { data: profs } = await supabase.from('profiles').select('id, subject_colors')
      if (profs && profs.length > 0) {
        for (const p of profs) {
          await supabase.from('profiles').update({
            subject_colors: { ...(p.subject_colors || {}), [name]: selectedColor }
          }).eq('id', p.id)
        }
      }

      setSubjectColors(updatedMap)
      setSubjectsList(updatedList)
      setNewSubjectName('')
      
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
    setSaving(true)
    setError('')
    const updatedMap = { ...subjectColors, [subj]: newColor }

    try {
      // Update profiles and schedule_assignments
      const [{ data: profs }] = await Promise.all([
        supabase.from('profiles').select('id, subject_colors'),
        supabase.from('schedule_assignments').update({ subject_color: newColor }).eq('subject', subj),
      ])

      if (profs && profs.length > 0) {
        for (const p of profs) {
          await supabase.from('profiles').update({
            subject_colors: { ...(p.subject_colors || {}), [subj]: newColor }
          }).eq('id', p.id)
        }
      }

      setSubjectColors(updatedMap)
      setEditingSubject(null)
      onSuccess(updatedMap)
    } catch (err: any) {
      setError(err.message || 'Failed to update color.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      backgroundColor: 'rgba(28, 25, 23, 0.6)',
      backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '16px', boxSizing: 'border-box'
    }}>
      <div style={{
        backgroundColor: H.surface,
        border: `1px solid ${H.border}`,
        borderRadius: H.radius['2xl'],
        boxShadow: H.shadows.modal,
        maxWidth: '600px',
        width: '100%',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontFamily: H.font,
        animation: 'modalScale 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        transition: H.motion.transitionFast,
      }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${H.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: H.surface }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: H.purpleLight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Palette size={20} style={{ color: H.purpleDark }} />
            </div>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: H.textPrimary, margin: 0 }}>Manage Subjects & Colors</h2>
              <p style={{ fontSize: '12px', color: H.textSec, margin: '2px 0 0' }}>Assign unique, persistent colors to subjects</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: H.textMuted, padding: 4 }}>
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {error && (
            <div style={{ padding: '10px 14px', borderRadius: '10px', background: H.dangerLight, border: `1px solid ${H.danger}40`, color: H.danger, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={15} /> <span>{error}</span>
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                        <div style={{ width: 16, height: 16, borderRadius: '50%', backgroundColor: color, flexShrink: 0, border: '1px solid rgba(0,0,0,0.1)' }} />
                        <span style={{ fontWeight: 600, fontSize: '13px', color: H.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {subj}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => { setEditingSubject(isEditingThis ? null : subj); setEditColor(color); }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: H.textSec, padding: 4 }}
                        title="Change Color"
                      >
                        <Edit2 size={13} />
                      </button>

                      {isEditingThis && (
                        <div style={{
                          position: 'absolute', zIndex: 110, padding: '12px', borderRadius: '12px',
                          backgroundColor: H.surface, border: `1px solid ${H.border}`, boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                          display: 'flex', flexDirection: 'column', gap: '8px'
                        }}>
                          <span style={{ fontSize: '11px', fontWeight: 700, color: H.textPrimary }}>Pick Color for {subj}:</span>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxWidth: '200px' }}>
                            {CURATED_PALETTE.map(c => (
                              <button
                                key={c}
                                type="button"
                                onClick={() => handleUpdateSubjectColor(subj, c)}
                                style={{ width: 22, height: 22, borderRadius: '50%', backgroundColor: c, border: c === color ? '2px solid #1C1917' : '1px solid #FFF', cursor: 'pointer' }}
                              />
                            ))}
                          </div>
                          <button onClick={() => setEditingSubject(null)} style={{ fontSize: '11px', color: H.textMuted, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'right' }}>Cancel</button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: `1px solid ${H.border}`, backgroundColor: '#FAF9F6', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 18px', borderRadius: '10px', border: `1px solid ${H.border}`,
              backgroundColor: H.surface, color: H.textPrimary, fontWeight: 600, fontSize: '13px', cursor: 'pointer'
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
