'use client'

import { H } from '@/lib/honey'
import { FileQuestion, Home } from 'lucide-react'

export default function NotFound() {
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
          maxWidth: '460px',
          backgroundColor: H.surface,
          borderRadius: H.radius.xl,
          border: `1px solid ${H.border}`,
          boxShadow: H.shadows.card,
          padding: H.spacing['3xl'],
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: '56px',
            height: '56px',
            borderRadius: H.radius.full,
            backgroundColor: H.accentLight,
            color: H.chocolate,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
          }}
        >
          <FileQuestion size={28} />
        </div>

        <h2
          style={{
            fontSize: H.fontSize['2xl'],
            fontWeight: H.fontWeight.bold,
            color: H.textPrimary,
            marginBottom: H.spacing.sm,
          }}
        >
          Page Not Found
        </h2>

        <p
          style={{
            fontSize: H.fontSize.base,
            color: H.textSec,
            lineHeight: 1.5,
            marginBottom: H.spacing.xl,
          }}
        >
          The page or resource you requested could not be found. It may have been moved or removed.
        </p>

        <a
          href="/"
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
            textDecoration: 'none',
            cursor: 'pointer',
            padding: `0 ${H.spacing.xl}`,
            width: '100%',
          }}
        >
          <Home size={16} />
          Return to Dashboard
        </a>
      </div>
    </div>
  )
}
