'use client'
import { useState } from 'react'
import { Loader2, CheckCircle2, XCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import ConfirmModal, { ConfirmModalState } from '@/components/ui/ConfirmModal'

import { H } from '@/lib/honey'

interface Props {
  teacherId: string
  isActive: boolean
  teacherName: string
  onDone: () => void
}

const styles = {
  button: {
    borderRadius: '12px',
    padding: '8px 14px',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    fontFamily: H.font,
    fontSize: '13px',
    fontWeight: '700',
    border: '1px solid transparent',
    transition: 'opacity 0.2s ease',
  },
  activate: {
    background: H.successLight,
    color: H.successGreen,
    borderColor: H.border,
  },
  deactivate: {
    background: H.dangerLight,
    color: H.danger,
    borderColor: H.border,
  },
  loading: {
    opacity: 0.7,
    cursor: 'not-allowed',
  }
};

export default function TeacherActions({ teacherId, isActive, teacherName, onDone }: Props) {
  const [loading, setLoading] = useState(false)
  const [modal, setModal] = useState<ConfirmModalState | null>(null)
  const supabase = createClient()

  const currentlyActive = Boolean(isActive)

  const handleToggle = async () => {
    const nextStatus = !currentlyActive
    const action = nextStatus ? 'Activate' : 'Deactivate'

    setModal({
      title: `${action} Teacher Account?`,
      message: currentlyActive
        ? `Are you sure you want to deactivate ${teacherName}'s account? They will lose access to the portal until reactivated.`
        : `Are you sure you want to activate ${teacherName}'s account? They will regain access to the portal.`,
      variant: currentlyActive ? 'danger' : 'neutral',
      confirmLabel: action,
      onConfirm: async () => {
        setModal(null)
        setLoading(true)
        try {
          // Update both profiles and allowed_users tables to keep state in sync
          const { error: profErr } = await supabase
            .from('profiles')
            .update({ is_active: nextStatus })
            .eq('id', teacherId)

          await supabase
            .from('allowed_users')
            .update({ is_active: nextStatus })
            .eq('id', teacherId)

          if (profErr) {
            console.error('Failed to update teacher status:', profErr.message)
            setModal({
              title: 'Error Updating Status',
              message: 'Could not update teacher status: ' + profErr.message,
              variant: 'danger',
              confirmLabel: 'OK',
              cancelLabel: '',
              onConfirm: () => setModal(null),
            })
          } else {
            onDone()
          }
        } catch (e: any) {
          console.error('Unexpected error updating teacher status:', e.message)
          setModal({
            title: 'Unexpected Error',
            message: 'An unexpected error occurred. Please refresh the page and try again.',
            variant: 'danger',
            confirmLabel: 'OK',
            cancelLabel: '',
            onConfirm: () => setModal(null),
          })
        } finally {
          setLoading(false)
        }
      },
    })
  }

  const currentStyle = currentlyActive ? styles.deactivate : styles.activate

  return (
    <>
      <button 
        onClick={handleToggle} 
        disabled={loading}
        style={{
          ...styles.button,
          ...currentStyle,
          ...(loading ? styles.loading : {}),
        }}
      >
        {loading ? (
          <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
        ) : currentlyActive ? (
          <>
            <XCircle size={14} /> Deactivate
          </>
        ) : (
          <>
            <CheckCircle2 size={14} /> Activate
          </>
        )}
      </button>

      <ConfirmModal
        open={!!modal}
        {...(modal ?? { title: '', message: '', onConfirm: () => {} })}
        onCancel={() => setModal(null)}
      />
    </>
  )
}

