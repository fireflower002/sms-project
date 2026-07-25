'use client'

import { useEffect } from 'react'
import { H, STYLE } from '@/lib/honey'
import { AlertOctagon, RefreshCw } from 'lucide-react'

export default function GlobalRootError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[Global Root Error Boundary]:', error)
  }, [error])

  return (
    <html lang="en">
      <head>
        <title>Application Error | SMS</title>
        <style dangerouslySetInnerHTML={{ __html: STYLE }} />
      </head>
      <body
        style={{
          margin: 0,
          padding: 0,
          backgroundColor: H.bg,
          fontFamily: H.font,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: '90%',
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
            <AlertOctagon size={28} />
          </div>

          <h1
            style={{
              fontSize: H.fontSize['2xl'],
              fontWeight: H.fontWeight.bold,
              color: H.textPrimary,
              marginBottom: H.spacing.sm,
            }}
          >
            Critical System Error
          </h1>

          <p
            style={{
              fontSize: H.fontSize.base,
              color: H.textSec,
              lineHeight: 1.5,
              marginBottom: H.spacing.xl,
            }}
          >
            The application encountered an unexpected runtime failure. Please refresh the page or click below to recover.
          </p>

          <button
            onClick={() => reset()}
            style={{
              width: '100%',
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
            }}
          >
            <RefreshCw size={16} />
            Reload Application
          </button>
        </div>
      </body>
    </html>
  )
}
