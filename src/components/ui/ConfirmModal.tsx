'use client'
import { useEffect } from 'react'
import { AlertTriangle, Info, X } from 'lucide-react'
import { H } from '@/lib/honey'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ModalVariant = 'danger' | 'neutral' | 'warning'

interface ConfirmModalProps {
  /** Controls visibility */
  open: boolean
  /** Bold heading shown at the top */
  title: string
  /** Descriptive body text */
  message: string
  /** Label for the confirm button (default "Confirm") */
  confirmLabel?: string
  /** Label for the cancel button (default "Cancel") */
  cancelLabel?: string
  /**
   * danger  — red confirm button; destructive actions (delete, deactivate)
   * warning — amber confirm button; irreversible but non-destructive
   * neutral — primary amber button; routine confirmations
   */
  variant?: ModalVariant
  /** Whether the confirm action is currently in flight (shows spinner) */
  loading?: boolean
  /** Called when the user clicks the confirm button */
  onConfirm: () => void
  /** Called when the user clicks Cancel or the backdrop */
  onCancel: () => void
}

// ─── Colour map ───────────────────────────────────────────────────────────────

const VARIANT_STYLES: Record<
  ModalVariant,
  { iconBg: string; iconColor: string; confirmBg: string; confirmColor: string; icon: React.FC<{ size: number }> }
> = {
  danger: {
    iconBg: H.dangerLight,
    iconColor: H.danger,
    confirmBg: H.danger,
    confirmColor: '#FFFFFF',
    icon: ({ size }) => <AlertTriangle size={size} />,
  },
  warning: {
    iconBg: H.accentLight,
    iconColor: H.chocolate,
    confirmBg: H.honey,
    confirmColor: '#FFFFFF',
    icon: ({ size }) => <AlertTriangle size={size} />,
  },
  neutral: {
    iconBg: H.skyLight,
    iconColor: '#1E40AF',
    confirmBg: H.honey,
    confirmColor: '#FFFFFF',
    icon: ({ size }) => <Info size={size} />,
  },
}

// ─── Base button style ────────────────────────────────────────────────────────

const btn = (extra?: React.CSSProperties): React.CSSProperties => ({
  border: 'none',
  borderRadius: '12px',
  fontWeight: 700,
  fontSize: '14px',
  padding: '10px 22px',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  fontFamily: H.font,
  transition: 'opacity 0.15s ease',
  ...extra,
})

/**
 * ConfirmModal — replaces native confirm() / alert() dialogs.
 *
 * Usage pattern (confirm):
 *
 *   // State in the parent:
 *   const [confirmState, setConfirmState] = useState<ConfirmState | null>(null)
 *
 *   // Trigger:
 *   setConfirmState({
 *     title: 'Delete Grade 6?',
 *     message: 'This will remove all 3 classes. Cannot be undone.',
 *     variant: 'danger',
 *     confirmLabel: 'Yes, Delete',
 *     onConfirm: async () => { await doDelete(); setConfirmState(null); },
 *   })
 *
 *   // Render:
 *   <ConfirmModal
 *     open={!!confirmState}
 *     {...(confirmState ?? { title: '', message: '', onConfirm: () => {} })}
 *     onCancel={() => setConfirmState(null)}
 *   />
 *
 * For pure-alert usage (no cancel button) pass onConfirm that just closes
 * and omit confirmLabel / cancelLabel:
 *   confirmLabel="OK"
 *   cancelLabel=""     ← empty string hides the Cancel button
 */
export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'neutral',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onCancel])

  if (!open) return null

  const vs = VARIANT_STYLES[variant]
  const IconComp = vs.icon

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      {/* Backdrop */}
      <div
        onClick={loading ? undefined : onCancel}
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'rgba(28,25,23,0.6)',
          backdropFilter: 'blur(4px)',
          animation: 'fadeIn 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      />

      {/* Dialog */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '460px',
          backgroundColor: H.surface,
          border: `1px solid ${H.border}`,
          borderRadius: H.radius['3xl'],
          boxShadow: H.shadows.modal,
          overflow: 'hidden',
          animation: 'modalScale 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          transition: H.motion.transitionFast,
        }}
        // Stop backdrop click from bleeding through
        onClick={e => e.stopPropagation()}
      >
        {/* Close button */}
        {!loading && (
          <button
            onClick={onCancel}
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: H.textMuted,
              padding: '4px',
              borderRadius: '8px',
              display: 'flex',
            }}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        )}

        {/* Body */}
        <div style={{ padding: '32px 32px 24px' }}>
          {/* Icon */}
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '14px',
              backgroundColor: vs.iconBg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '20px',
              color: vs.iconColor,
            }}
          >
            <IconComp size={26} />
          </div>

          <h2
            style={{
              fontSize: '18px',
              fontWeight: 800,
              color: H.textPrimary,
              margin: '0 0 10px',
              fontFamily: H.font,
            }}
          >
            {title}
          </h2>
          <p
            style={{
              fontSize: '14px',
              color: H.textSec,
              lineHeight: 1.6,
              margin: 0,
              fontFamily: H.font,
            }}
          >
            {message}
          </p>
        </div>

        {/* Footer buttons */}
        <div
          style={{
            display: 'flex',
            gap: '10px',
            padding: '0 32px 28px',
            justifyContent: cancelLabel ? 'flex-end' : 'flex-end',
          }}
        >
          {cancelLabel && (
            <button
              onClick={onCancel}
              disabled={loading}
              style={btn({
                background: '#F5F5F4',
                color: H.textSec,
                border: `1px solid ${H.border}`,
                opacity: loading ? 0.5 : 1,
              })}
            >
              {cancelLabel}
            </button>
          )}

          <button
            onClick={onConfirm}
            disabled={loading}
            style={btn({
              background: vs.confirmBg,
              color: vs.confirmColor,
              minWidth: '110px',
              opacity: loading ? 0.8 : 1,
            })}
          >
            {loading ? (
              <LoadingSpinner size={16} color={vs.confirmColor} />
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Convenience type for parent state ───────────────────────────────────────
/**
 * Drop this type in parent components to manage the modal state cleanly:
 *
 *   const [modal, setModal] = useState<ConfirmModalState | null>(null)
 */
export interface ConfirmModalState {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: ModalVariant
  /** The async action to run on confirm. Should call setModal(null) when done. */
  onConfirm: () => void | Promise<void>
}
