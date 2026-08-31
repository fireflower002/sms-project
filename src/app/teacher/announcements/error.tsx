'use client'

import React, { useEffect } from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { H } from '@/lib/honey'

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Route error boundary caught error:', error)
  }, [error])

  return (
    <div style={{ minHeight: '60vh', backgroundColor: H.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: H.font }}>
      <div style={{ maxWidth: '440px', width: '100%', backgroundColor: H.surface, border: `1px solid ${H.border}`, borderRadius: '16px', padding: '32px 24px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', backgroundColor: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <AlertCircle size={26} color="#DC2626" />
        </div>
        <h2 style={{ fontSize: '18px', fontWeight: 800, color: H.textPrimary, margin: '0 0 8px' }}>
          Something went wrong
        </h2>
        <p style={{ fontSize: '13px', color: H.textSec, lineHeight: 1.5, margin: '0 0 20px' }}>
          {error?.message || 'An unexpected error occurred while loading this section.'}
        </p>
        <button
          onClick={() => reset()}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 18px',
            borderRadius: '8px',
            backgroundColor: '#18181B',
            color: '#FFFFFF',
            fontWeight: 600,
            fontSize: '13px',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          <RefreshCw size={14} /> Try Again
        </button>
      </div>
    </div>
  )
}
