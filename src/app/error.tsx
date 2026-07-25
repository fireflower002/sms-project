'use client'

import { useEffect } from 'react'
import { H } from '@/lib/honey'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log exception for telemetry / diagnostic monitoring
    console.error('[App Error Boundary]:', error)
  }, [error])

  return (
    <div
      style={{
        minHeight: '80vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: H.spacing.xl,
        backgroundColor: H.bg,
        fontFamily: H.font,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '480px',
          backgroundColor: H.surface,
          borderRadius: H.radius.xl,
          border: `1px solid ${H.border}`,
          boxShadow: H.shadows.modal,
          padding: H.spacing['3xl'],
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: '56px',
            height: '56px',
            borderRadius: H.radius.full,
            backgroundColor: H.dangerLight,
            color: H.danger,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
          }}
        >
          <AlertTriangle size={28} />
        </div>

        <h2
          style={{
            fontSize: H.fontSize['2xl'],
            fontWeight: H.fontWeight.bold,
            color: H.textPrimary,
            marginBottom: H.spacing.sm,
          }}
        >
          Something went wrong
        </h2>

        <p
          style={{
            fontSize: H.fontSize.base,
            color: H.textSec,
            lineHeight: 1.5,
            marginBottom: H.spacing.xl,
          }}
        >
          An unexpected system error occurred. Our system logged this issue and you can attempt to retry the operation.
        </p>

        {error.digest && (
          <div
            style={{
              fontSize: H.fontSize.xs,
              color: H.textMuted,
              backgroundColor: H.bg,
              padding: `${H.spacing.xs} ${H.spacing.sm}`,
              borderRadius: H.radius.sm,
              marginBottom: H.spacing.xl,
              fontFamily: 'monospace',
              wordBreak: 'break-all',
            }}
          >
            Ref Code: {error.digest}
          </div>
        )}

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: H.spacing.md,
          }}
        >
          <button
            onClick={() => reset()}
            style={{
              height: H.targetSizes.buttonMd,
              backgroundColor: H.accent,
              color: H.accentDark,
              border: `1px solid ${H.accent}`,
              borderRadius: H.radius.md,
              fontWeight: H.fontWeight.semibold,
              fontSize: H.fontSize.base,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: H.spacing.sm,
              cursor: 'pointer',
              boxShadow: H.shadows.sm,
            }}
          >
            <RefreshCw size={16} />
            Try again
          </button>

          <a
            href="/"
            style={{
              height: H.targetSizes.buttonMd,
              backgroundColor: H.surface,
              color: H.textPrimary,
              border: `1px solid ${H.border}`,
              borderRadius: H.radius.md,
              fontWeight: H.fontWeight.medium,
              fontSize: H.fontSize.base,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: H.spacing.sm,
              textDecoration: 'none',
              cursor: 'pointer',
            }}
          >
            <Home size={16} />
            Return to Dashboard
          </a>
        </div>
      </div>
    </div>
  )
}
