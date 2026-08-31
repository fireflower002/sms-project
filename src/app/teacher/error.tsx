'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { H } from '@/lib/honey'

export default function TeacherError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[Teacher Error Boundary caught exception]:', error)
  }, [error])

  const isDev = process.env.NODE_ENV === 'development'

  return (
    <div
      style={{
        minHeight: '80vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: H.bg,
        padding: H.spacing['2xl'],
        fontFamily: H.font,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '480px',
          backgroundColor: H.surface,
          border: `1px solid ${H.border}`,
          borderRadius: H.radius.xl,
          padding: H.spacing['3xl'],
          boxShadow: H.shadows.card,
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
            margin: '0 auto 16px auto',
          }}
        >
          <svg
            style={{ width: '28px', height: '28px' }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        <h2
          style={{
            fontSize: H.fontSize['2xl'],
            fontWeight: H.fontWeight.semibold,
            color: H.text,
            marginBottom: H.spacing.sm,
          }}
        >
          Something went wrong
        </h2>

        <p
          style={{
            fontSize: H.fontSize.base,
            color: H.muted,
            marginBottom: H.spacing['2xl'],
            lineHeight: '1.5',
          }}
        >
          An unexpected error occurred while loading this page.
          {isDev && error?.message ? ` (${error.message})` : ' Please try again or return to the portal.'}
        </p>

        <div
          style={{
            display: 'flex',
            gap: H.spacing.md,
            justifyContent: 'center',
            flexWrap: 'wrap',
          }}
        >
          <button
            onClick={() => reset()}
            style={{
              height: H.targetSizes.buttonMd,
              padding: `0 ${H.spacing.lg}`,
              backgroundColor: H.honey,
              color: '#FFFFFF',
              border: 'none',
              borderRadius: H.radius.md,
              fontSize: H.fontSize.base,
              fontWeight: H.fontWeight.medium,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            Try Again
          </button>

          <Link
            href="/teacher"
            style={{
              height: H.targetSizes.buttonMd,
              padding: `0 ${H.spacing.lg}`,
              backgroundColor: H.accentLight,
              color: H.text,
              border: `1px solid ${H.border}`,
              borderRadius: H.radius.md,
              fontSize: H.fontSize.base,
              fontWeight: H.fontWeight.medium,
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            Go to Teacher Portal
          </Link>
        </div>
      </div>
    </div>
  )
}
