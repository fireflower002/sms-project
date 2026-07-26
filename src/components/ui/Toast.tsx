'use client'
import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react'
import { H } from '@/lib/honey'

export type ToastType = 'success' | 'error' | 'info' | 'warning'

export interface ToastMessage {
  id: string
  message: string
  type: ToastType
  duration?: number
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType, duration?: number) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const showToast = useCallback((message: string, type: ToastType = 'info', duration = 4000) => {
    const id = Math.random().toString(36).substring(2, 9)
    setToasts(prev => [...prev.slice(-4), { id, message, type, duration }])

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id)
      }, duration)
    }
  }, [removeToast])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast Container */}
      <div
        style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          maxWidth: '380px',
          width: 'calc(100vw - 40px)',
          pointerEvents: 'none',
        }}
      >
        {toasts.map(toast => {
          const config = getToastConfig(toast.type)
          const Icon = config.icon

          return (
            <div
              key={toast.id}
              style={{
                pointerEvents: 'auto',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                borderRadius: '12px',
                backgroundColor: H.surface,
                border: `1px solid ${config.borderColor}`,
                boxShadow: H.shadows.lg,
                fontFamily: H.font,
                fontSize: '13px',
                fontWeight: 600,
                color: H.textPrimary,
                animation: 'slideUp 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                boxSizing: 'border-box',
              }}
            >
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '8px',
                  backgroundColor: config.bgColor,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: config.iconColor,
                  flexShrink: 0,
                }}
              >
                <Icon size={16} />
              </div>
              <span style={{ flex: 1, minWidth: 0, lineHeight: 1.4 }}>
                {toast.message}
              </span>
              <button
                onClick={() => removeToast(toast.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: H.textMuted,
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  borderRadius: '6px',
                  transition: 'color 0.15s ease',
                }}
                title="Close notification"
              >
                <X size={14} />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

function getToastConfig(type: ToastType) {
  switch (type) {
    case 'success':
      return {
        icon: CheckCircle2,
        iconColor: '#10B981',
        bgColor: '#D1FAE5',
        borderColor: '#10B98140',
      }
    case 'error':
      return {
        icon: AlertCircle,
        iconColor: '#EF4444',
        bgColor: '#FEF2F2',
        borderColor: '#EF444440',
      }
    case 'warning':
      return {
        icon: AlertTriangle,
        iconColor: '#F59E0B',
        bgColor: '#FEF3C7',
        borderColor: '#F59E0B40',
      }
    case 'info':
    default:
      return {
        icon: Info,
        iconColor: '#3B82F6',
        bgColor: '#EFF6FF',
        borderColor: '#3B82F640',
      }
  }
}
