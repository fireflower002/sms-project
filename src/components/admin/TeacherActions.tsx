'use client'
import { useState } from 'react'
import { Loader2, CheckCircle2, XCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import ConfirmModal, { ConfirmModalState } from '@/components/ui/ConfirmModal'

interface Props {
  teacherId: string
  isActive: boolean
  teacherName: string
  onDone: () => void
}

// Design System Tokens
const colors = {
  success_green: '#10B981',
  success_dark: '#065F46',
  success_light: '#D1FAE5',
  success_border: '#A7F3D0',
  danger_background: '#FEF2F2',
  danger_text: '#DC2626',
  danger_border: '#FECACA',
};

const styles = {
  button: {
    borderRadius: '12px',
    padding: '8px 14px',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    fontSize: '13px',
    fontWeight: '700',
    border: '1px solid transparent',
    transition: 'opacity 0.2s ease',
  },
  activate: {
    background: colors.success_light,
    color: colors.success_dark,
    borderColor: colors.success_border,
  },
  deactivate: {
    background: colors.danger_background,
    color: colors.danger_text,
    borderColor: colors.danger_border,
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

  const handleToggle = async () => {
    const action = isActive ? 'Deactivate' : 'Activate';
    setModal({
      title: `${action} Teacher?`,
      message: `Are you sure you want to ${action.toLowerCase()} ${teacherName}'s account access?`,
      variant: isActive ? 'danger' : 'neutral',
      confirmLabel: action,
      onConfirm: async () => {
        setModal(null);
        setLoading(true);
        try {
          const { error } = await supabase
            .from('profiles')
            .update({ is_active: !isActive })
            .eq('id', teacherId);

          if (error) {
            console.error('Failed to update teacher status:', error.message);
            setModal({
              title: 'Error',
              message: 'Could not update teacher status. Please check your connection and try again.',
              variant: 'danger',
              confirmLabel: 'OK',
              cancelLabel: '',
              onConfirm: () => setModal(null),
            });
          } else {
            onDone();
          }
        } catch (e: any) {
          console.error('Unexpected error updating teacher status:', e.message);
          setModal({
            title: 'Unexpected Error',
            message: 'An unexpected error occurred. Please refresh the page and try again.',
            variant: 'danger',
            confirmLabel: 'OK',
            cancelLabel: '',
            onConfirm: () => setModal(null),
          });
        } finally {
          setLoading(false);
        }
      }
    });
  }

  const currentStyle = isActive ? styles.deactivate : styles.activate;

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
        ) : isActive ? (
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

