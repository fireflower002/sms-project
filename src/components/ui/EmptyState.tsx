import React from 'react'
import { Package, type LucideIcon } from 'lucide-react'
import { H } from '@/lib/honey'

interface EmptyStateProps {
  icon?: any
  title: string
  message?: string
  description?: string
  actionLabel?: string
  onAction?: () => void
  action?: React.ReactNode
  style?: React.CSSProperties
}

export function EmptyState({
  icon: IconProp = Package,
  title,
  message,
  description,
  actionLabel,
  onAction,
  action,
  style,
}: EmptyStateProps) {
  const displayMessage = message || description || ''

  const renderIcon = () => {
    if (!IconProp) return <Package size={28} />
    if (React.isValidElement(IconProp)) return IconProp
    const IconComponent = IconProp as React.ElementType
    return <IconComponent size={28} />
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 24px',
        textAlign: 'center',
        backgroundColor: H.surface,
        border: `1px dashed ${H.border}`,
        borderRadius: H.radius.xl,
        margin: '16px 0',
        ...style,
      }}
    >
      <div
        style={{
          width: '56px',
          height: '56px',
          borderRadius: H.radius.full,
          backgroundColor: '#F4F4F5',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: H.muted,
          marginBottom: '16px',
        }}
      >
        {renderIcon()}
      </div>
      <h4
        style={{
          fontFamily: H.font,
          fontSize: H.fontSize.lg,
          fontWeight: H.fontWeight.bold,
          color: H.textPrimary,
          margin: '0 0 6px 0',
        }}
      >
        {title}
      </h4>
      <p
        style={{
          fontFamily: H.font,
          fontSize: H.fontSize.sm,
          color: H.textMuted,
          maxWidth: '380px',
          margin: '0 0 20px 0',
          lineHeight: 1.5,
        }}
      >
        {displayMessage}
      </p>
      {action ? action : (actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          style={{
            backgroundColor: '#18181B',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: H.radius.lg,
            padding: '10px 18px',
            fontFamily: H.font,
            fontWeight: H.fontWeight.bold,
            fontSize: H.fontSize.sm,
            cursor: 'pointer',
            transition: H.motion.transitionFast,
          }}
        >
          {actionLabel}
        </button>
      ))}
    </div>
  )
}

export default EmptyState
