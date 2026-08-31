'use client'

import { useState } from 'react'
import { AlertTriangle, UserCheck, Trash2, Edit2, X, Check, BookOpen, Star } from 'lucide-react'
import { H } from '@/lib/honey'
import Badge from '@/components/ui/Badge'
import { useFocusTrap } from '@/lib/useFocusTrap'

interface TeacherCandidate {
  id: string
  full_name: string
  subjects?: string[]
  isClassTeacher?: boolean
  assignedClassName?: string
  isSameSubject?: boolean
}

interface AssignedClass {
  id: string
  name: string
  grade_level?: string
}

interface ReassignClassTeacherModalProps {
  isOpen: boolean
  teacherName: string
  teacherSubjects?: string[]
  assignedClasses: AssignedClass[]
  candidates: TeacherCandidate[]
  onConfirmReassignAndDelete: (reassignments: Record<string, string | null>) => Promise<void>
  onEditProfileInstead: () => void
  onClose: () => void
  loading?: boolean
}

export default function ReassignClassTeacherModal({
  isOpen,
  teacherName,
  teacherSubjects = [],
  assignedClasses,
  candidates,
  onConfirmReassignAndDelete,
  onEditProfileInstead,
  onClose,
  loading = false,
}: ReassignClassTeacherModalProps) {
  const modalRef = useFocusTrap({ isOpen, onClose })

  // Map of classId -> selectedReplacementTeacherId (or null for unassigned)
  const [selectedMap, setSelectedMap] = useState<Record<string, string | null>>(() => {
    const initial: Record<string, string | null> = {}
    assignedClasses.forEach((c) => {
      // Pick top Tier 1 recommendation by default if available
      const topRec = candidates.find((cand) => cand.isSameSubject && !cand.isClassTeacher) ||
                     candidates.find((cand) => !cand.isClassTeacher)
      initial[c.id] = topRec ? topRec.id : null
    })
    return initial
  })

  if (!isOpen) return null

  const [validationError, setValidationError] = useState<string>('')

  const handleSelectChange = (classId: string, val: string) => {
    setValidationError('')
    setSelectedMap((prev) => ({
      ...prev,
      [classId]: val === 'unassigned' ? null : val,
    }))
  }

  const handleConfirm = async () => {
    setValidationError('')
    const selectedTeacherIds = Object.values(selectedMap).filter(Boolean) as string[]

    // Check for duplicate selection across classes in the same modal
    const uniqueSelected = new Set(selectedTeacherIds)
    if (uniqueSelected.size !== selectedTeacherIds.length) {
      setValidationError('The same replacement teacher cannot be assigned to multiple classes simultaneously.')
      return
    }

    // Check if any selected teacher is ALREADY a class teacher elsewhere
    for (const [classId, teacherId] of Object.entries(selectedMap)) {
      if (!teacherId) continue
      const cand = candidates.find((c) => c.id === teacherId)
      if (cand && cand.isClassTeacher) {
        setValidationError(`${cand.full_name} is already the Class Teacher for ${cand.assignedClassName || 'another class'} and cannot be assigned to another class.`)
        return
      }
    }

    await onConfirmReassignAndDelete(selectedMap)
  }

  if (!isOpen) return null

  // Categorize candidates for UI clarity
  const sameSubjectFree = candidates.filter((c) => c.isSameSubject && !c.isClassTeacher)
  const diffSubjectFree = candidates.filter((c) => !c.isSameSubject && !c.isClassTeacher)
  const currentlyAssigned = candidates.filter((c) => c.isClassTeacher)

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.55)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        boxSizing: 'border-box',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onClose()
      }}
    >
      <div
        ref={modalRef as any}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reassign-modal-title"
        style={{
          backgroundColor: H.surface,
          borderRadius: '20px',
          border: `1px solid ${H.border}`,
          boxShadow: '0 20px 45px rgba(0, 0, 0, 0.2)',
          width: '100%',
          maxWidth: '620px',
          maxHeight: '90vh',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '24px 28px 18px',
            borderBottom: `1px solid ${H.border}`,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                backgroundColor: '#FEF3C7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#D97706',
                flexShrink: 0,
              }}
            >
              <AlertTriangle size={24} />
            </div>
            <div>
              <h2
                id="reassign-modal-title"
                style={{
                  fontSize: '18px',
                  fontWeight: 800,
                  color: H.textPrimary,
                  margin: 0,
                  fontFamily: H.font,
                }}
              >
                Class Teacher Reassignment Required
              </h2>
              <p
                style={{
                  fontSize: '13px',
                  color: H.textSec,
                  margin: '4px 0 0',
                  fontFamily: H.font,
                }}
              >
                {teacherName} is currently assigned as Class Teacher.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            style={{
              background: 'transparent',
              border: 'none',
              color: H.textMuted,
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div
            style={{
              backgroundColor: '#FEF3C7',
              border: '1px solid #FDE68A',
              borderRadius: '12px',
              padding: '14px 16px',
              fontSize: '13px',
              color: H.textPrimary,
              lineHeight: 1.5,
            }}
          >
            <strong>Attention:</strong> Before deleting <strong>{teacherName}</strong>, you must assign a replacement class teacher (or leave unassigned) for affected class(es). A teacher who is already a Class Teacher elsewhere cannot be assigned to another class.
          </div>

          {validationError && (
            <div
              style={{
                backgroundColor: '#FEF2F2',
                border: '1px solid #FECACA',
                borderRadius: '12px',
                padding: '12px 16px',
                fontSize: '13px',
                color: '#991B1B',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <AlertTriangle size={16} /> {validationError}
            </div>
          )}

          {/* Assigned Classes Reassignment Controls */}
          {assignedClasses.map((cls) => {
            const currentSelectedId = selectedMap[cls.id] || 'unassigned'

            return (
              <div
                key={cls.id}
                style={{
                  backgroundColor: H.bg,
                  border: `1px solid ${H.border}`,
                  borderRadius: '14px',
                  padding: '18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 800, color: H.textPrimary }}>
                    Class: {cls.name} {cls.grade_level ? `(${cls.grade_level})` : ''}
                  </span>
                  <Badge variant="pending">Class Teacher Role</Badge>
                </div>

                <label
                  style={{
                    fontSize: '12px',
                    fontWeight: 700,
                    color: H.textMuted,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  Select Replacement Teacher:
                </label>

                <select
                  value={currentSelectedId}
                  onChange={(e) => handleSelectChange(cls.id, e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: `1px solid ${H.border}`,
                    backgroundColor: H.surface,
                    color: H.textPrimary,
                    fontFamily: H.font,
                    fontSize: '13px',
                    fontWeight: 600,
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <option value="unassigned">-- Leave Class Teacher Unassigned (Vacant) --</option>

                  {/* Priority 1: Same Subject & Not Class Teacher */}
                  {sameSubjectFree.length > 0 && (
                    <optgroup label="★ Recommended: Same Subject Teachers (Free)">
                      {sameSubjectFree.map((cand) => {
                        const isSelectedElsewhere = Object.entries(selectedMap).some(
                          ([otherClassId, selectedId]) => otherClassId !== cls.id && selectedId === cand.id
                        )
                        return (
                          <option key={cand.id} value={cand.id} disabled={isSelectedElsewhere}>
                            ★ {cand.full_name} ({cand.subjects?.join(', ') || 'No subject'}) {isSelectedElsewhere ? '— (Selected for another class)' : '— Free'}
                          </option>
                        )
                      })}
                    </optgroup>
                  )}

                  {/* Priority 2: Different Subject & Not Class Teacher */}
                  {diffSubjectFree.length > 0 && (
                    <optgroup label="Free Teachers (Different Subjects)">
                      {diffSubjectFree.map((cand) => {
                        const isSelectedElsewhere = Object.entries(selectedMap).some(
                          ([otherClassId, selectedId]) => otherClassId !== cls.id && selectedId === cand.id
                        )
                        return (
                          <option key={cand.id} value={cand.id} disabled={isSelectedElsewhere}>
                            {cand.full_name} ({cand.subjects?.join(', ') || 'General'}) {isSelectedElsewhere ? '— (Selected for another class)' : '— Free'}
                          </option>
                        )
                      })}
                    </optgroup>
                  )}

                  {/* Priority 3: Already Class Teachers (Disabled) */}
                  {currentlyAssigned.length > 0 && (
                    <optgroup label="⛔ Unavailable: Already Class Teachers Elsewhere">
                      {currentlyAssigned.map((cand) => (
                        <option key={cand.id} value={cand.id} disabled>
                          ⛔ {cand.full_name} (Class Teacher: {cand.assignedClassName || 'another class'}) — Cannot Reassign
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>
            )
          })}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '18px 28px 24px',
            borderTop: `1px solid ${H.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            backgroundColor: H.surface,
            borderRadius: '0 0 20px 20px',
          }}
        >
          <button
            type="button"
            onClick={onEditProfileInstead}
            disabled={loading}
            style={{
              background: 'transparent',
              color: H.honey,
              border: `1px solid ${H.border}`,
              borderRadius: '10px',
              padding: '9px 16px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Edit2 size={15} /> Edit Profile Instead
          </button>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{
                background: '#F4F4F5',
                color: H.textSec,
                border: `1px solid ${H.border}`,
                borderRadius: '10px',
                padding: '9px 16px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleConfirm}
              disabled={loading}
              style={{
                background: H.danger,
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '10px',
                padding: '9px 18px',
                fontSize: '13px',
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? (
                'Processing...'
              ) : (
                <>
                  <Trash2 size={15} /> Reassign & Delete Teacher
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
